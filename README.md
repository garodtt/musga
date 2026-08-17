# Musgas

Letterboxd, mas para música. Avalie faixas de 0 a 5, veja a nota do álbum
(média das notas das faixas), escreva reviews, siga outros usuários e monte
listas. Catálogo de artistas/álbuns/faixas vem do Spotify e é cacheado no seu
banco conforme as pessoas navegam.

Stack: **React 18 + Vite** no front-end, **Supabase** (Postgres + Auth + Edge
Functions) no back-end.

---

## 1. Criar o projeto no Supabase

1. Crie um projeto em https://supabase.com/dashboard.
2. No **SQL Editor**, cole e rode o conteúdo inteiro de `supabase/schema.sql`.
   Isso cria todas as tabelas, views de agregação e as políticas de RLS.
3. Em **Project Settings → API**, copie a **Project URL** e a **anon public
   key** — vão para o `.env` do front-end (passo 4).

## 2. Criar um app no Spotify (para buscar artistas/álbuns/faixas)

1. Acesse https://developer.spotify.com/dashboard e crie um app.
2. Copie o **Client ID** e o **Client Secret**.
3. Não precisa configurar Redirect URI — usamos o fluxo *Client Credentials*
   (autenticação app-a-app, sem login do usuário no Spotify).

## 3. Deploy da Edge Function (proxy do Spotify)

O Client Secret do Spotify nunca pode ir para o front-end — por isso existe
`supabase/functions/spotify-proxy`, que roda no servidor.

```bash
npm install -g supabase
supabase login
supabase link --project-ref SEU_PROJECT_REF

supabase secrets set SPOTIFY_CLIENT_ID=xxxxx SPOTIFY_CLIENT_SECRET=xxxxx

supabase functions deploy spotify-proxy
```

`SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` já ficam disponíveis
automaticamente dentro da Edge Function — não precisa configurá-los.

## 4. Configurar login com Google (opcional, mas recomendado)

Você pediu simplicidade + login social — o Supabase Auth já entrega os dois
sem custo extra de código: o e-mail/senha funciona pronto, e o Google é
só configuração no painel (o botão "Continuar com Google" já está no código).

1. No **Google Cloud Console** → *APIs & Services → Credentials*, crie um
   **OAuth Client ID** do tipo "Web application".
2. Em *Authorized redirect URIs*, adicione a URL de callback que o Supabase
   mostra em **Authentication → Providers → Google** (algo como
   `https://SEU-PROJETO.supabase.co/auth/v1/callback`).
3. Copie o Client ID/Secret do Google para essa mesma tela do Supabase e
   habilite o provider.

Se preferir começar só com e-mail/senha, não faça nada aqui — o login social
some da tela sozinho quando o provider não está habilitado no seu Supabase
(o botão continua aparecendo, mas ative o provider antes de divulgar o app).

## 5. Configurar o front-end

```bash
cp .env.example .env
# preencha VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY

npm install
npm run dev
```

Abra http://localhost:5173.

## 6. Subir para o GitHub

```bash
git init
git add .
git commit -m "Primeira versão do Musgas"
git branch -M main
git remote add origin https://github.com/SEU-USUARIO/musgas.git
git push -u origin main
```

O `.env` está no `.gitignore` — suas chaves não vão para o repositório.

---

## Como a nota do álbum é calculada

- Cada faixa tem sua própria nota média (`track_rating_stats`, média de 1 a 5
  entre todos os usuários que avaliaram aquela faixa).
- A nota do álbum (`album_rating_stats`) é a **média das médias das faixas**
  que já têm pelo menos uma avaliação — exatamente como você descreveu: se um
  álbum tem 5 faixas e você marca todas como 1, a nota do álbum fica 1.
- A página do álbum também mostra a **distribuição percentual** das notas
  (quantos % das avaliações do álbum são nota 1, 2, 3, 4 ou 5).

## Estrutura de pastas

```
supabase/
  schema.sql                    → todas as tabelas, views e políticas de RLS
  functions/spotify-proxy/      → edge function que fala com a API do Spotify
src/
  lib/                          → clientes Supabase/Spotify e helpers de dados
  context/AuthContext.jsx       → sessão, login, cadastro, Google OAuth
  components/                   → navbar, cards, sistema de notas, reviews, listas
  pages/                        → Home, Busca, Artista, Álbum, Perfil, Listas, Login
```

## Próximos passos possíveis

- Avatar/bio editáveis na página de perfil.
- Notificações quando alguém que você segue avalia algo.
- Paginação/scroll infinito na busca e no feed.