# 🎵 Musgas

Letterboxd, mas para música. Avalie faixas, veja a nota de cada álbum, escreva
reviews, monte listas, siga outras pessoas e descubra o que a comunidade está
ouvindo — tudo num catálogo alimentado pelo Spotify.

🔗 **[musgas-list.netlify.app](https://musgas-list.netlify.app/)**

---

## O que dá pra fazer

**Catálogo e avaliação**
- Buscar artistas, álbuns e faixas com busca em tempo real (autocomplete)
- Avaliar qualquer faixa de 1 a 5 — a nota do álbum é a média das faixas avaliadas
- Distribuição visual das notas de um álbum
- Avaliar rápido direto no dropdown de busca, sem abrir o álbum

**Reviews e comunidade**
- Escrever reviews por faixa, curtir e comentar nas dos outros
- Notificações automáticas (seguidas, curtidas, comentários)
- Comparação de gosto musical entre dois perfis
- Feed de atividade de quem você segue

**Perfil**
- Estatísticas pessoais (faixas avaliadas, reviews, artistas diferentes, distribuição das próprias notas)
- Selos de incentivo (Ouvinte Assíduo, Crítico, Madrugador, Nostálgico...)
- Resumo de atividade da semana/mês
- Editar nome, bio e foto — com upload, recorte e zoom direto no navegador
- Lista de seguidores/seguindo estilo Instagram

**Listas**
- Criar listas com tags, sem duplicar itens
- Reordenar arrastando, convidar colaboradores
- Exportar como texto ou imagem (PNG)

**Descoberta**
- Home com músicas em alta, recomendações e mais bem avaliados (com filtro por gênero/década)
- "Quem ouviu isso também ouviu" nos álbuns
- Página de artista completa: discografia inteira, seguidores/popularidade no Spotify, faixas mais bem avaliadas pela comunidade, reviews recentes e artistas parecidos
- Buscar e seguir pessoas, lista de desejos ("ouvir depois")

**Extra**
- Tema claro/escuro
- Login por e-mail, Google ou Spotify

---

## Tecnologias

| Camada | Stack |
|---|---|
| Front-end | React 18 + Vite, React Router |
| Estilo | CSS puro, sistema de design com variáveis (sem framework de UI) |
| Backend | Supabase — Postgres, Auth, Storage, Edge Functions, Row Level Security |
| Dados externos | API do Spotify (Client Credentials Flow) |
| Deploy | Netlify (front-end) + Supabase (banco e funções) |

Sem Redux, sem TypeScript no front, sem CSS-in-JS — só o necessário pra rodar rápido e ser fácil de mexer.

## Como o catálogo funciona

O Spotify não permite mais busca de catálogo totalmente livre. O Musgas contorna
isso com um **cache inteligente**: a primeira vez que alguém busca um artista ou
abre um álbum, uma Edge Function do Supabase busca no Spotify e salva no banco.
Das próximas vezes (de qualquer usuário), os dados vêm direto do banco —
instantâneo, sem depender da API externa a cada visita.

## Estrutura do projeto

```
musgas/
├── supabase/
│   ├── schema.sql                 → schema completo do banco (tabelas, views, RLS)
│   ├── migrations/                → histórico de mudanças incrementais
│   └── functions/spotify-proxy/   → Edge Function que fala com a API do Spotify
├── src/
│   ├── lib/                       → clientes (Supabase, Spotify), dados, exportação de listas
│   ├── context/                   → autenticação
│   ├── hooks/                     → debounce, tema claro/escuro
│   ├── components/                → navbar, cards, notas, reviews, listas, perfil, notificações
│   └── pages/                     → Home, Busca, Artista, Álbum, Perfil, Listas, Pessoas, Login...
└── public/                        → arquivos estáticos
```

## Rodando localmente

Pré-requisitos: Node 18+, uma conta no [Supabase](https://supabase.com) e um app
criado no [Spotify for Developers](https://developer.spotify.com/dashboard).

```bash
git clone <seu-repositório>
cd musgas
npm install
cp .env.example .env   # preencha com a URL e a anon key do seu projeto Supabase
npm run dev
```

Pra funcionar de ponta a ponta (login, catálogo, avaliações), também é preciso:

1. Rodar `supabase/schema.sql` inteiro no SQL Editor do seu projeto Supabase
2. Criar um app no Spotify for Developers e configurar `SPOTIFY_CLIENT_ID` /
   `SPOTIFY_CLIENT_SECRET` como secrets da Edge Function
3. Fazer o deploy da função: `supabase functions deploy spotify-proxy`
4. (Opcional) Habilitar login social em **Authentication → Providers** no
   painel do Supabase, se quiser Google/Spotify além de e-mail e senha