# Documentação técnica — Musgas

Este arquivo é o complemento "modo detalhado" do README. Se você só quer rodar
o projeto rápido, o README já basta. Se você quer entender **por que** cada
peça existe, o que fazer quando algo dá errado, ou está configurando o projeto
do zero pela primeira vez, este é o lugar certo.

## Índice

1. [Visão geral da arquitetura](#visão-geral-da-arquitetura)
2. [Criando o projeto no Supabase](#1-criando-o-projeto-no-supabase)
3. [Rodando o schema do banco](#2-rodando-o-schema-do-banco)
4. [Criando o app no Spotify](#3-criando-o-app-no-spotify)
5. [Deploy da Edge Function](#4-deploy-da-edge-function)
6. [Configurando login social (Google e Spotify)](#5-configurando-login-social-google-e-spotify)
7. [Variáveis de ambiente](#6-variáveis-de-ambiente)
8. [Deploy do front-end (Netlify)](#7-deploy-do-front-end-netlify)
9. [Como funcionam as migrations](#como-funcionam-as-migrations)
10. [Perguntas frequentes / problemas comuns](#perguntas-frequentes--problemas-comuns)

---

## Visão geral da arquitetura

O Musgas tem três peças que rodam em lugares diferentes:

```
┌─────────────────┐        ┌──────────────────────┐        ┌─────────────┐
│   Netlify        │  HTTP  │   Supabase            │  HTTP  │   Spotify   │
│   (React + Vite) │───────▶│   Postgres + Auth +   │───────▶│   API       │
│   front-end       │        │   Storage + Edge Fn   │        │             │
└─────────────────┘        └──────────────────────┘        └─────────────┘
```

- **Netlify** serve só arquivos estáticos (HTML/CSS/JS) — não tem servidor
  rodando ali, é tudo front-end puro.
- **Supabase** é o backend inteiro: banco de dados, autenticação, storage de
  arquivos (fotos de perfil) e uma função serverless (Edge Function) que faz
  o papel de "servidor" quando é preciso esconder um segredo (o client secret
  do Spotify) ou executar lógica que não pode rodar no navegador.
- **Spotify** só é consultado pela Edge Function, nunca diretamente pelo
  navegador do usuário — isso é o que mantém o client secret seguro.

Cada peça precisa ser configurada e "deployada" separadamente. É comum, ao
longo do desenvolvimento, esquecer de atualizar uma delas — por exemplo,
mudar o código da Edge Function e só dar `git push` (que só afeta a Netlify),
esquecendo do `supabase functions deploy`. Se algo parece não ter efeito
depois de uma mudança, o primeiro passo é sempre conferir se as **três**
partes foram atualizadas.

### Por que cachear o catálogo do Spotify no nosso próprio banco?

Duas razões:

1. **Performance**: perguntar pro Spotify toda vez que alguém abre um álbum
   seria lento. Cacheando localmente, a segunda pessoa que visita o mesmo
   álbum recebe os dados instantaneamente, direto do nosso Postgres.
2. **Necessidade**: pra dar nota numa faixa, ela precisa ter um `id` na nossa
   tabela `tracks` (as notas são uma relação com essa tabela, não com o
   Spotify diretamente). Então cachear não é só otimização, é parte de como
   o sistema de notas funciona.

O cache expira sozinho depois de 7 dias (definido em `isCacheStale` dentro de
`src/lib/db.js`), pra pegar informações atualizadas do Spotify de tempos em
tempos sem precisar de intervenção manual.

---

## 1. Criando o projeto no Supabase

1. Crie uma conta em [supabase.com](https://supabase.com) (tem plano gratuito
   que é suficiente pra esse projeto)
2. **New Project** → escolha um nome, uma senha forte pro banco (guarde essa
   senha, você não vai precisar dela no dia a dia, mas é bom ter guardada) e
   a região mais próxima de você
3. Espere o projeto terminar de provisionar (leva 1-2 minutos)
4. Em **Project Settings → API**, anote dois valores — você vai precisar
   deles depois:
   - **Project URL** (algo como `https://xxxxxxxxxxxxx.supabase.co`)
   - **anon public key** (uma string longa começando com `eyJ...`)
5. Em **Project Settings → General**, anote o **Reference ID** (é um código
   curto tipo `xxxxxxxxxxxxx` — é o mesmo que aparece na Project URL, entre
   `https://` e `.supabase.co`). Você vai usar isso pra "linkar" o Supabase
   CLI ao projeto.

## 2. Rodando o schema do banco

O arquivo `supabase/schema.sql` contém **tudo**: todas as tabelas, todas as
views, todas as políticas de segurança (RLS), tudo que o app precisa pra
funcionar. Pra um projeto novo, esse é o único arquivo que você precisa rodar
— não precisa rodar os arquivos de `supabase/migrations/` também (veja a
seção [Como funcionam as migrations](#como-funcionam-as-migrations) pra
entender por quê).

1. No painel do Supabase, abra **SQL Editor**
2. Clique em **New query**
3. Abra o arquivo `supabase/schema.sql` do projeto, copie o conteúdo inteiro
   e cole ali
4. Clique em **Run**

Se der algum erro, o mais comum é tentar rodar o arquivo **duas vezes** sem
ter limpado o banco antes (`create table` falha se a tabela já existe). Se
isso acontecer e você quiser recomeçar do zero, é possível apagar todas as
tabelas do schema `public` pelo painel (**Table Editor** → selecionar todas →
excluir) e rodar o `schema.sql` de novo.

### O que exatamente o schema cria

- **Tabelas de catálogo** (`artists`, `albums`, `tracks`): guardam os dados
  vindos do Spotify. Só a Edge Function escreve nelas (usando a service role
  key, que ignora as políticas de RLS) — o usuário comum só lê.
- **Tabelas de interação** (`ratings`, `reviews`, `review_likes`,
  `review_comments`, `follows`, `lists`, `list_items`, `list_collaborators`,
  `wishlist_items`): tudo que os usuários criam. Protegidas por RLS — cada
  política define exatamente quem pode ler, inserir, atualizar ou apagar
  cada linha.
- **Views de agregação** (`track_rating_stats`, `album_rating_stats`,
  `album_rating_distribution`, `trending_tracks`, `profile_activity_counts`):
  são "consultas salvas" que calculam médias e contagens on-the-fly, sem
  precisar guardar esses números redundantemente nas tabelas.
- **Triggers automáticos**: por exemplo, quando alguém cria uma conta, um
  trigger (`handle_new_user`) cria automaticamente uma linha em `profiles`;
  quando alguém segue outra pessoa, curte ou comenta uma review, um trigger
  cria a notificação correspondente sozinho — o código do front-end nunca
  precisa se preocupar em criar notificações manualmente.
- **Bucket de Storage** (`avatars`): onde ficam as fotos de perfil enviadas
  pelos usuários.

---

## 3. Criando o app no Spotify

Você precisa de um Client ID e um Client Secret do Spotify pra Edge Function
conseguir buscar dados de artistas/álbuns/faixas.

> ⚠️ Desde fevereiro de 2026, o Spotify exige que a conta usada pra criar o
> app tenha **Spotify Premium**. Sem Premium, o botão de criar app fica
> bloqueado no painel deles.

1. Acesse [developer.spotify.com/dashboard](https://developer.spotify.com/dashboard)
   logado com uma conta Premium
2. **Create app**
3. Preencha:
   - **App name**: qualquer nome (ex: "Musgas")
   - **App description**: qualquer descrição
   - **Website**: pode deixar em branco
   - **Redirect URI**: obrigatório preencher, mas não é usado de fato pelo
     Musgas nessa etapa — coloque `http://127.0.0.1:3000` e clique em **Add**
   - Marque a caixinha dos Termos de Uso
4. **Save**
5. Na página do app criado, vá em **Settings**
6. O **Client ID** já aparece na tela. Clique em **View client secret** pra
   revelar o **Client Secret**
7. Guarde os dois — vai usar no próximo passo

### Por que o app não precisa de mercado/site de verdade?

O Musgas usa o fluxo **Client Credentials** do Spotify — é uma autenticação
"aplicativo para aplicativo", sem envolver login de nenhum usuário do
Spotify. Por isso não precisa de site nem de usuários cadastrados no app; o
Redirect URI só é exigido pelo formulário de criação, mas nunca é
efetivamente chamado nesse fluxo.

### Limitações atuais da API do Spotify

Em fevereiro de 2026 o Spotify removeu vários endpoints da API pública
(recomendações automáticas, "novos lançamentos", top faixas oficiais do
artista, artistas relacionados, entre outros) e reduziu o limite de itens por
página da maioria dos endpoints que sobraram (de até 50 pra 10). O código do
Musgas já foi escrito considerando essas limitações:

- A discografia de um artista é buscada **paginando** (10 em 10) até pegar
  tudo, em vez de confiar num único request com limite alto
- "Faixas mais bem avaliadas", "quem ouviu isso também ouviu" e "artistas
  parecidos" são calculados a partir dos **dados da nossa própria
  comunidade** (não do Spotify), já que os endpoints equivalentes do Spotify
  não existem mais

---

## 4. Deploy da Edge Function

Com o Client ID/Secret em mãos:

```bash
npm install -g supabase   # se ainda não tiver o CLI instalado
supabase login
supabase link --project-ref SEU_PROJECT_REF   # o Reference ID do passo 1

supabase secrets set SPOTIFY_CLIENT_ID=xxxxx SPOTIFY_CLIENT_SECRET=xxxxx

supabase functions deploy spotify-proxy
```

`SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` já ficam disponíveis
automaticamente dentro da Edge Function — não precisa configurar.

**Sempre que o arquivo `supabase/functions/spotify-proxy/index.ts` mudar**,
é preciso rodar `supabase functions deploy spotify-proxy` de novo. Esse passo
é independente do deploy do site — dar `git push` não reimplanta a função.

---

## 5. Configurando login social (Google e Spotify)

Esses dois são **opcionais** — o login por e-mail/senha já funciona sem
nenhuma configuração extra.

### Google

1. No [Google Cloud Console](https://console.cloud.google.com), crie um
   **OAuth 2.0 Client ID** (tipo "Web application"), em **APIs & Services →
   Credentials**
2. Em **Authorized redirect URIs**, adicione:
   ```
   https://SEU-PROJETO.supabase.co/auth/v1/callback
   ```
   (o painel do Supabase, em **Authentication → Providers → Google**, mostra
   essa URL pronta pra copiar — use exatamente o que estiver lá, garante que
   bate certinho)
3. Copie o Client ID e o Client Secret do Google
4. No painel do Supabase: **Authentication → Providers → Google** → ative o
   toggle → cole os dois valores → **Save**

### Spotify (login de usuário, diferente do Client Credentials da Edge Function)

Esse é um uso **diferente** das mesmas credenciais do passo 3 — aqui é sobre
deixar visitantes entrarem no Musgas usando a própria conta Spotify deles.

1. No mesmo app criado no passo 3, vá em **Settings**
2. Em **Redirect URIs**, adicione (mantendo o que já tinha):
   ```
   https://SEU-PROJETO.supabase.co/auth/v1/callback
   ```
3. Em **User Management** (mesma tela), adicione o e-mail de cada conta
   Spotify que vai poder fazer login — **até 5 contas**, porque esse é o
   limite do "Development Mode" do Spotify (a versão gratuita/inicial do app)
4. No painel do Supabase: **Authentication → Providers → Spotify** → ative →
   cole o mesmo Client ID/Secret do passo 3 → **Save**

> O limite de 5 contas só afeta quem usa "Entrar com Spotify". Não afeta o
> catálogo (busca de artistas/álbuns/faixas), que usa Client Credentials e
> não tem esse limite.

---

## 6. Variáveis de ambiente

Copie `.env.example` para `.env` e preencha:

```dotenv
VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
VITE_SUPABASE_ANON_KEY=sua-anon-key-aqui
```

Essas duas variáveis são as únicas que o front-end usa diretamente. A
`anon key` é segura de expor no navegador — ela só permite o que as políticas
de RLS liberarem, então mesmo estando visível no código do site, não dá
acesso a nada que não devesse ser público.

Nunca coloque o `SPOTIFY_CLIENT_SECRET` num arquivo `.env` do front-end — ele
só deve existir como secret da Edge Function (passo 4), nunca em código que
roda no navegador.

---

## 7. Deploy do front-end (Netlify)

1. Suba o projeto pro GitHub (`git push`)
2. Na Netlify: **Add new site → Import an existing project** → conecte o
   repositório
3. Configuração de build:
   - **Build command**: `npm run build`
   - **Publish directory**: `dist`
4. Em **Site configuration → Environment variables**, adicione as mesmas
   duas variáveis do `.env` (`VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`)
   — o build da Netlify não lê o arquivo `.env` local, precisa configurar
   separadamente ali
5. Deploy

### Por que existe o arquivo `public/_redirects`?

Esse projeto é uma SPA (Single Page Application) — o React Router cuida do
roteamento **no navegador**, sem o servidor saber nada sobre `/album/xyz` ou
`/perfil/fulano`. Sem esse arquivo, recarregar a página em qualquer rota que
não seja a raiz (`/`) resulta em "Page not found", porque a Netlify tentaria
achar um arquivo físico nesse caminho e não existe. O arquivo `_redirects`
diz pra Netlify: "qualquer caminho, devolve o `index.html` e deixa o React
cuidar do resto".

---

## Como funcionam as migrations

Existem dois lugares com SQL no projeto, e eles servem propósitos diferentes:

- **`supabase/schema.sql`**: a "foto" completa e atual do banco. Sempre que
  alguma tabela, coluna ou política muda, esse arquivo é atualizado por
  inteiro. É o arquivo certo pra configurar um projeto **novo, do zero**.
- **`supabase/migrations/*.sql`**: o histórico incremental de mudanças, na
  ordem em que aconteceram. Cada arquivo tem só o que mudou **naquele
  momento** (um `alter table`, um `create table` novo, etc.). Servem pra
  quem **já tem o banco rodando** aplicar só a parte nova, sem precisar
  rodar o schema inteiro de novo (o que poderia falhar, já que `create
  table` dá erro se a tabela já existe).

Ou seja: **schema novo → só `schema.sql`. Banco já existente → só a migration
mais recente que ainda não rodou.**

A pasta `supabase/maintenance/` guarda scripts pontuais de limpeza de dados
(não são mudanças de estrutura, só correções de dados existentes) — não
fazem parte do histórico de schema e não precisam ser rodados em setups
novos.

---

## Perguntas frequentes / problemas comuns

**"Page not found" ao recarregar uma página que não é a Home**
Falta o arquivo `public/_redirects` no deploy, ou ele não foi commitado /
não chegou no build da Netlify. Veja a seção sobre o [deploy do
front-end](#7-deploy-do-front-end-netlify).

**"Edge Function returned a non-2xx status code"**
Mensagem genérica — não diz o motivo real. Vá em **Edge Functions →
spotify-proxy → Logs** no painel do Supabase e procure a invocação mais
recente; o log detalhado aparece ali. As causas mais comuns até hoje foram:
um parâmetro fora do limite atual da API do Spotify, uma coluna que a Edge
Function tenta gravar mas não existe no banco (migration não rodada), ou
limite de taxa (rate limit) do Spotify por causa de chamadas repetidas em
sequência — nesse último caso, o erro se resolve sozinho depois de
alguns minutos.

**Erro `PGRST205: Could not find the table` ou coluna "does not exist"**
Uma migration não foi rodada, ou rodou parcialmente e parou no meio por
causa de um erro. Confira quais tabelas/colunas existem de fato com:
```sql
select table_name from information_schema.tables
where table_schema = 'public' order by table_name;
```
e compare com o que `schema.sql` define.

**Login com Google/Spotify dá erro de redirect_uri_mismatch**
A URL de callback cadastrada no Google Cloud Console ou no app do Spotify
não bate exatamente com a URL de callback do Supabase. Copie a URL mostrada
em **Authentication → Providers → [Google ou Spotify]** no painel do
Supabase e cole exatamente ali, sem digitar de cabeça.

**Mudei o código da Edge Function e nada aconteceu**
Faltou rodar `supabase functions deploy spotify-proxy`. Esse comando é
separado do `git push` — nenhum dos dois substitui o outro.

**Um álbum abre mas não mostra nenhuma faixa**
Provavelmente ele foi cacheado só "pela metade" — visitado através da página
de um artista (que salva os álbuns, mas não as faixas) e nunca aberto
diretamente antes dessa correção existir no código. A lógica de carregamento
do álbum já detecta esse caso e busca as faixas de verdade automaticamente;
se isso ainda acontecer, force recarregar visitando o álbum de novo.

**Como faço pra limpar o cache de um artista/álbum específico e forçar
buscar tudo de novo no Spotify?**
```sql
delete from public.artists where name = 'Nome do Artista';
```
Isso apaga em cascata os álbuns e faixas relacionados a esse artista — e
também qualquer nota/review que já existia sobre eles. Use com cuidado se já
tiver dado nota real em algo desse artista.