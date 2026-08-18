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
  followers_count integer,
  popularity smallint,
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
-- CURTIDAS EM REVIEWS
-- ---------------------------------------------------------
create table public.review_likes (
  review_id uuid not null references public.reviews(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (review_id, user_id)
);

-- ---------------------------------------------------------
-- COMENTÁRIOS EM REVIEWS
-- ---------------------------------------------------------
create table public.review_comments (
  id uuid primary key default uuid_generate_v4(),
  review_id uuid not null references public.reviews(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);

create index on public.review_comments (review_id);

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
-- NOTIFICAÇÕES — geradas automaticamente por triggers (o cliente nunca
-- insere aqui diretamente, só lê as suas e marca como lidas).
-- ---------------------------------------------------------
create table public.notifications (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,   -- quem recebe
  actor_id uuid references public.profiles(id) on delete cascade,          -- quem causou
  type text not null check (type in ('follow', 'review_like', 'review_comment')),
  review_id uuid references public.reviews(id) on delete cascade,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create index on public.notifications (user_id, created_at desc);

create or replace function public.notify_new_follow()
returns trigger as $$
begin
  insert into public.notifications (user_id, actor_id, type)
  values (new.following_id, new.follower_id, 'follow');
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger on_follow_created
  after insert on public.follows
  for each row execute procedure public.notify_new_follow();

create or replace function public.notify_review_like()
returns trigger as $$
declare
  review_owner uuid;
begin
  select user_id into review_owner from public.reviews where id = new.review_id;
  if review_owner is not null and review_owner <> new.user_id then
    insert into public.notifications (user_id, actor_id, type, review_id)
    values (review_owner, new.user_id, 'review_like', new.review_id);
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger on_review_like_created
  after insert on public.review_likes
  for each row execute procedure public.notify_review_like();

create or replace function public.notify_review_comment()
returns trigger as $$
declare
  review_owner uuid;
begin
  select user_id into review_owner from public.reviews where id = new.review_id;
  if review_owner is not null and review_owner <> new.user_id then
    insert into public.notifications (user_id, actor_id, type, review_id)
    values (review_owner, new.user_id, 'review_comment', new.review_id);
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger on_review_comment_created
  after insert on public.review_comments
  for each row execute procedure public.notify_review_comment();

-- ---------------------------------------------------------
-- LISTAS (do tipo "minhas 10 favoritas de 2024")
-- ---------------------------------------------------------
create table public.lists (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text,
  tags text[] not null default '{}',
  is_public boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.list_collaborators (
  list_id uuid not null references public.lists(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (list_id, user_id)
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

-- Impede duplicar o mesmo item na mesma lista: a mesma faixa não pode
-- aparecer duas vezes na lista, nem o mesmo álbum duas vezes — mas
-- várias faixas diferentes do mesmo álbum continuam permitidas.
create unique index list_items_unique_track
  on public.list_items (list_id, track_id) where item_type = 'track';
create unique index list_items_unique_album
  on public.list_items (list_id, album_id) where item_type = 'album';
create unique index list_items_unique_artist
  on public.list_items (list_id, artist_id) where item_type = 'artist';

-- ---------------------------------------------------------
-- LISTA DE DESEJOS ("ouvir depois") — separada das listas nomeadas,
-- é um único bucket pessoal por usuário para salvar faixas/álbuns.
-- ---------------------------------------------------------
create table public.wishlist_items (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  item_type text not null check (item_type in ('track', 'album')),
  track_id uuid references public.tracks(id) on delete cascade,
  album_id uuid references public.albums(id) on delete cascade,
  added_at timestamptz not null default now()
);

create unique index wishlist_items_unique_track
  on public.wishlist_items (user_id, track_id) where item_type = 'track';
create unique index wishlist_items_unique_album
  on public.wishlist_items (user_id, album_id) where item_type = 'album';

create index on public.wishlist_items (user_id);

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

-- Quantidade de notas por usuário — usada para sugerir pessoas pra seguir
create view public.profile_activity_counts as
select user_id, count(*) as ratings_count
from public.ratings
group by user_id;

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
alter table public.review_likes enable row level security;
alter table public.review_comments enable row level security;
alter table public.notifications enable row level security;
alter table public.follows enable row level security;
alter table public.lists enable row level security;
alter table public.list_items enable row level security;
alter table public.list_collaborators enable row level security;
alter table public.wishlist_items enable row level security;

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

-- review_likes
create policy "review_likes_select_all" on public.review_likes for select using (true);
create policy "review_likes_insert_own" on public.review_likes for insert with check (auth.uid() = user_id);
create policy "review_likes_delete_own" on public.review_likes for delete using (auth.uid() = user_id);

-- review_comments
create policy "review_comments_select_all" on public.review_comments for select using (true);
create policy "review_comments_insert_own" on public.review_comments for insert with check (auth.uid() = user_id);
create policy "review_comments_delete_own" on public.review_comments for delete using (auth.uid() = user_id);

-- notifications — só o próprio destinatário vê/atualiza; inserir é feito
-- só pelos triggers (security definer), nenhuma policy de insert aqui
create policy "notifications_select_own" on public.notifications for select using (auth.uid() = user_id);
create policy "notifications_update_own" on public.notifications for update using (auth.uid() = user_id);

-- follows
create policy "follows_select_all" on public.follows for select using (true);
create policy "follows_insert_own" on public.follows for insert with check (auth.uid() = follower_id);
create policy "follows_delete_own" on public.follows for delete using (auth.uid() = follower_id);

-- lists (dono ou colaborador podem ver listas privadas; só o dono edita
-- título/descrição/visibilidade)
create policy "lists_select_visible" on public.lists
  for select using (
    is_public = true
    or auth.uid() = user_id
    or exists (select 1 from public.list_collaborators lc where lc.list_id = lists.id and lc.user_id = auth.uid())
  );
create policy "lists_insert_own" on public.lists for insert with check (auth.uid() = user_id);
create policy "lists_update_own" on public.lists for update using (auth.uid() = user_id);
create policy "lists_delete_own" on public.lists for delete using (auth.uid() = user_id);

-- list items (dono OU colaborador podem inserir/remover/reordenar itens)
create policy "list_items_select_visible" on public.list_items for select using (
  exists (
    select 1 from public.lists l
    where l.id = list_items.list_id
    and (
      l.is_public = true
      or l.user_id = auth.uid()
      or exists (select 1 from public.list_collaborators lc where lc.list_id = l.id and lc.user_id = auth.uid())
    )
  )
);
create policy "list_items_insert_own_or_collab" on public.list_items for insert with check (
  exists (
    select 1 from public.lists l
    where l.id = list_id
    and (l.user_id = auth.uid() or exists (select 1 from public.list_collaborators lc where lc.list_id = l.id and lc.user_id = auth.uid()))
  )
);
create policy "list_items_update_own_or_collab" on public.list_items for update using (
  exists (
    select 1 from public.lists l
    where l.id = list_id
    and (l.user_id = auth.uid() or exists (select 1 from public.list_collaborators lc where lc.list_id = l.id and lc.user_id = auth.uid()))
  )
);
create policy "list_items_delete_own_or_collab" on public.list_items for delete using (
  exists (
    select 1 from public.lists l
    where l.id = list_id
    and (l.user_id = auth.uid() or exists (select 1 from public.list_collaborators lc where lc.list_id = l.id and lc.user_id = auth.uid()))
  )
);

-- list_collaborators: dono da lista gerencia; um colaborador pode sair
-- sozinho (remover a própria linha)
create policy "list_collaborators_select" on public.list_collaborators for select using (
  exists (select 1 from public.lists l where l.id = list_id and l.user_id = auth.uid())
  or user_id = auth.uid()
);
create policy "list_collaborators_insert_owner" on public.list_collaborators for insert with check (
  exists (select 1 from public.lists l where l.id = list_id and l.user_id = auth.uid())
);
create policy "list_collaborators_delete_owner_or_self" on public.list_collaborators for delete using (
  exists (select 1 from public.lists l where l.id = list_id and l.user_id = auth.uid())
  or user_id = auth.uid()
);

-- wishlist (lista de desejos) — só o próprio dono vê/mexe
create policy "wishlist_select_own" on public.wishlist_items for select using (auth.uid() = user_id);
create policy "wishlist_insert_own" on public.wishlist_items for insert with check (auth.uid() = user_id);
create policy "wishlist_delete_own" on public.wishlist_items for delete using (auth.uid() = user_id);

-- =========================================================
-- STORAGE — bucket para fotos de perfil (upload + recorte)
-- Caminho de cada arquivo: {user_id}/avatar.png
-- =========================================================
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

create policy "avatars_public_read" on storage.objects for select using (bucket_id = 'avatars');
create policy "avatars_insert_own" on storage.objects for insert with check (
  bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
);
create policy "avatars_update_own" on storage.objects for update using (
  bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
);
create policy "avatars_delete_own" on storage.objects for delete using (
  bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
);