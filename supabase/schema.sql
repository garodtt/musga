-- =========================================================
-- MUSGAS — schema do banco (Supabase / Postgres)
-- Rode este arquivo inteiro no SQL Editor do painel Supabase
-- =========================================================

create extension if not exists "uuid-ossp";

-- ---------------------------------------------------------
-- PROFILES (perfil público de cada usuário)
-- ---------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  display_name text,
  avatar_url text,
  bio text,
  created_at timestamptz not null default now()
);

-- Cria automaticamente um profile quando um usuário se cadastra
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, username, display_name, avatar_url)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'preferred_username',
      split_part(new.email, '@', 1)
    ) || '_' || substr(new.id::text, 1, 4),
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ---------------------------------------------------------
-- CATÁLOGO — artistas, álbuns e faixas (cache do Spotify)
-- Só a edge function (service role) escreve aqui.
-- ---------------------------------------------------------
create table public.artists (
  id uuid primary key default uuid_generate_v4(),
  spotify_id text unique not null,
  name text not null,
  image_url text,
  genres text[],
  cached_at timestamptz not null default now()
);

create table public.albums (
  id uuid primary key default uuid_generate_v4(),
  spotify_id text unique not null,
  artist_id uuid references public.artists(id) on delete cascade,
  name text not null,
  cover_url text,
  release_date date,
  album_type text,
  total_tracks int,
  cached_at timestamptz not null default now()
);

create table public.tracks (
  id uuid primary key default uuid_generate_v4(),
  spotify_id text unique not null,
  album_id uuid references public.albums(id) on delete cascade,
  artist_id uuid references public.artists(id) on delete cascade,
  name text not null,
  track_number int,
  duration_ms int,
  cached_at timestamptz not null default now()
);

create index on public.albums (artist_id);
create index on public.tracks (album_id);
create index on public.tracks (artist_id);

-- ---------------------------------------------------------
-- NOTAS (1 a 5, por faixa) — igual ao pedido: nota do álbum
-- é a média das notas médias das suas faixas.
-- ---------------------------------------------------------
create table public.ratings (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  track_id uuid not null references public.tracks(id) on delete cascade,
  score smallint not null check (score between 1 and 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, track_id)
);

create index on public.ratings (track_id);
create index on public.ratings (user_id);

-- ---------------------------------------------------------
-- REVIEWS (texto, uma por usuário por faixa)
-- ---------------------------------------------------------
create table public.reviews (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  track_id uuid not null references public.tracks(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, track_id)
);

create index on public.reviews (track_id);

-- ---------------------------------------------------------
-- SEGUIDORES
-- ---------------------------------------------------------
create table public.follows (
  follower_id uuid not null references public.profiles(id) on delete cascade,
  following_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  check (follower_id <> following_id)
);

-- ---------------------------------------------------------
-- LISTAS (do tipo "minhas 10 favoritas de 2024")
-- ---------------------------------------------------------
create table public.lists (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text,
  is_public boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.list_items (
  id uuid primary key default uuid_generate_v4(),
  list_id uuid not null references public.lists(id) on delete cascade,
  item_type text not null check (item_type in ('track', 'album', 'artist')),
  track_id uuid references public.tracks(id) on delete cascade,
  album_id uuid references public.albums(id) on delete cascade,
  artist_id uuid references public.artists(id) on delete cascade,
  position int not null default 0,
  added_at timestamptz not null default now()
);

create index on public.list_items (list_id);

-- ---------------------------------------------------------
-- VIEWS de agregação (média por faixa, média/distribuição por álbum)
-- ---------------------------------------------------------
create view public.track_rating_stats as
select
  track_id,
  round(avg(score)::numeric, 2) as avg_score,
  count(*) as rating_count
from public.ratings
group by track_id;

-- Nota do álbum = média das médias das faixas já avaliadas
create view public.album_rating_stats as
select
  t.album_id,
  round(avg(trs.avg_score)::numeric, 2) as avg_score,
  count(distinct trs.track_id) as rated_tracks,
  sum(trs.rating_count)::int as total_ratings
from public.tracks t
join public.track_rating_stats trs on trs.track_id = t.id
group by t.album_id;

-- Distribuição percentual das notas (1 a 5) dentro de um álbum
create view public.album_rating_distribution as
select
  t.album_id,
  r.score,
  count(*) as cnt
from public.ratings r
join public.tracks t on t.id = r.track_id
group by t.album_id, r.score;

-- Faixas com mais notas nos últimos 7 dias — "Músicas do momento" na Home
create view public.trending_tracks as
select
  track_id,
  count(*) as recent_rating_count,
  round(avg(score)::numeric, 2) as recent_avg_score
from public.ratings
where created_at > now() - interval '7 days'
group by track_id;

-- ---------------------------------------------------------
-- Trigger genérico de updated_at
-- ---------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger ratings_set_updated_at before update on public.ratings
  for each row execute procedure public.set_updated_at();
create trigger reviews_set_updated_at before update on public.reviews
  for each row execute procedure public.set_updated_at();
create trigger lists_set_updated_at before update on public.lists
  for each row execute procedure public.set_updated_at();

-- =========================================================
-- ROW LEVEL SECURITY
-- =========================================================
alter table public.profiles enable row level security;
alter table public.artists enable row level security;
alter table public.albums enable row level security;
alter table public.tracks enable row level security;
alter table public.ratings enable row level security;
alter table public.reviews enable row level security;
alter table public.follows enable row level security;
alter table public.lists enable row level security;
alter table public.list_items enable row level security;

-- profiles
create policy "profiles_select_all" on public.profiles for select using (true);
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id);

-- catálogo: leitura pública, escrita só via service role (edge function não passa por RLS)
create policy "artists_select_all" on public.artists for select using (true);
create policy "albums_select_all" on public.albums for select using (true);
create policy "tracks_select_all" on public.tracks for select using (true);

-- ratings
create policy "ratings_select_all" on public.ratings for select using (true);
create policy "ratings_insert_own" on public.ratings for insert with check (auth.uid() = user_id);
create policy "ratings_update_own" on public.ratings for update using (auth.uid() = user_id);
create policy "ratings_delete_own" on public.ratings for delete using (auth.uid() = user_id);

-- reviews
create policy "reviews_select_all" on public.reviews for select using (true);
create policy "reviews_insert_own" on public.reviews for insert with check (auth.uid() = user_id);
create policy "reviews_update_own" on public.reviews for update using (auth.uid() = user_id);
create policy "reviews_delete_own" on public.reviews for delete using (auth.uid() = user_id);

-- follows
create policy "follows_select_all" on public.follows for select using (true);
create policy "follows_insert_own" on public.follows for insert with check (auth.uid() = follower_id);
create policy "follows_delete_own" on public.follows for delete using (auth.uid() = follower_id);

-- lists
create policy "lists_select_visible" on public.lists
  for select using (is_public = true or auth.uid() = user_id);
create policy "lists_insert_own" on public.lists for insert with check (auth.uid() = user_id);
create policy "lists_update_own" on public.lists for update using (auth.uid() = user_id);
create policy "lists_delete_own" on public.lists for delete using (auth.uid() = user_id);

-- list items (segue a visibilidade da lista)
create policy "list_items_select_visible" on public.list_items for select using (
  exists (
    select 1 from public.lists l
    where l.id = list_items.list_id
    and (l.is_public = true or l.user_id = auth.uid())
  )
);
create policy "list_items_insert_own_list" on public.list_items for insert with check (
  exists (select 1 from public.lists l where l.id = list_id and l.user_id = auth.uid())
);
create policy "list_items_delete_own_list" on public.list_items for delete using (
  exists (select 1 from public.lists l where l.id = list_id and l.user_id = auth.uid())
);