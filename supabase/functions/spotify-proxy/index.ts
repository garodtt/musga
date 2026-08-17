// Edge Function: spotify-proxy
//
// Motivo de existir: o Client Secret do Spotify NUNCA pode ir para o
// front-end. Esta função roda no servidor (Supabase Edge Functions / Deno),
// pede um token via "Client Credentials Flow" e fala com a API do Spotify.
// Ela também aproveita a Service Role Key para gravar (cachear) artistas,
// álbuns e faixas nas tabelas do Postgres, contornando o RLS -- é o único
// lugar do sistema que tem permissão de escrever no catálogo.
//
// Deploy:
//   supabase functions deploy spotify-proxy
// Secrets necessários:
//   supabase secrets set SPOTIFY_CLIENT_ID=xxx SPOTIFY_CLIENT_SECRET=xxx
//
// Chamada (a partir do front-end, via supabase.functions.invoke):
//   { action: "search",  query: "radiohead" }
//   { action: "artist",  spotifyId: "4Z8W4fKeB5YxbusRsdQVPb" }
//   { action: "album",   spotifyId: "6dVIqQ8qmQ5GBnJ9shOYGE" }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SPOTIFY_CLIENT_ID = Deno.env.get("SPOTIFY_CLIENT_ID")!;
const SPOTIFY_CLIENT_SECRET = Deno.env.get("SPOTIFY_CLIENT_SECRET")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Token do Spotify fica em memória entre chamadas (enquanto a function
// estiver "quente"), evitando pedir um token novo em toda requisição.
let cachedToken: { token: string; expiresAt: number } | null = null;

async function getSpotifyToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.token;
  }
  const resp = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization:
        "Basic " + btoa(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`),
    },
    body: "grant_type=client_credentials",
  });
  if (!resp.ok) {
    throw new Error(`Falha ao autenticar no Spotify: ${resp.status}`);
  }
  const data = await resp.json();
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 60) * 1000,
  };
  return cachedToken.token;
}

async function spotifyFetch(path: string) {
  const token = await getSpotifyToken();
  const resp = await fetch(`https://api.spotify.com/v1${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!resp.ok) {
    throw new Error(`Spotify API ${path} -> ${resp.status}`);
  }
  return resp.json();
}

function biggestImage(images: { url: string }[] | undefined) {
  return images?.[0]?.url ?? null;
}

// ---- Handlers ----------------------------------------------------------

async function handleSearch(query: string) {
  const data = await spotifyFetch(
    `/search?q=${encodeURIComponent(query)}&type=track,album,artist&limit=8`
  );

  return {
    artists: (data.artists?.items ?? []).map((a: any) => ({
      spotify_id: a.id,
      name: a.name,
      image_url: biggestImage(a.images),
      genres: a.genres ?? [],
    })),
    albums: (data.albums?.items ?? []).map((al: any) => ({
      spotify_id: al.id,
      name: al.name,
      cover_url: biggestImage(al.images),
      release_date: al.release_date,
      artist_name: al.artists?.[0]?.name,
      artist_spotify_id: al.artists?.[0]?.id,
    })),
    tracks: (data.tracks?.items ?? []).map((t: any) => ({
      spotify_id: t.id,
      name: t.name,
      duration_ms: t.duration_ms,
      album_spotify_id: t.album?.id,
      album_name: t.album?.name,
      album_cover_url: biggestImage(t.album?.images),
      artist_name: t.artists?.[0]?.name,
      artist_spotify_id: t.artists?.[0]?.id,
    })),
  };
}

async function upsertArtist(spotifyArtist: any) {
  const row = {
    spotify_id: spotifyArtist.id,
    name: spotifyArtist.name,
    image_url: biggestImage(spotifyArtist.images),
    genres: spotifyArtist.genres ?? [],
    cached_at: new Date().toISOString(),
  };
  const { data, error } = await supabaseAdmin
    .from("artists")
    .upsert(row, { onConflict: "spotify_id" })
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function handleArtist(spotifyId: string) {
  const artistData = await spotifyFetch(`/artists/${spotifyId}`);
  const artist = await upsertArtist(artistData);

  const albumsData = await spotifyFetch(
    `/artists/${spotifyId}/albums?include_groups=album,single&limit=10&market=BR`
  );

  // Remove álbuns duplicados (o Spotify repete o mesmo álbum por mercado)
  const seen = new Set<string>();
  const uniqueAlbums = (albumsData.items ?? []).filter((al: any) => {
    const key = al.name.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const albumRows = uniqueAlbums.map((al: any) => ({
    spotify_id: al.id,
    artist_id: artist.id,
    name: al.name,
    cover_url: biggestImage(al.images),
    release_date: al.release_date || null,
    album_type: al.album_type,
    total_tracks: al.total_tracks,
    cached_at: new Date().toISOString(),
  }));

  let albums = [];
  if (albumRows.length > 0) {
    const { data, error } = await supabaseAdmin
      .from("albums")
      .upsert(albumRows, { onConflict: "spotify_id" })
      .select();
    if (error) throw error;
    albums = data;
  }

  return { artist, albums };
}

async function handleAlbum(spotifyId: string) {
  const albumData = await spotifyFetch(
    `/albums/${spotifyId}?market=BR`
  );

  const artist = await upsertArtist(albumData.artists[0]);

  const albumRow = {
    spotify_id: albumData.id,
    artist_id: artist.id,
    name: albumData.name,
    cover_url: biggestImage(albumData.images),
    release_date: albumData.release_date || null,
    album_type: albumData.album_type,
    total_tracks: albumData.total_tracks,
    cached_at: new Date().toISOString(),
  };
  const { data: album, error: albumError } = await supabaseAdmin
    .from("albums")
    .upsert(albumRow, { onConflict: "spotify_id" })
    .select()
    .single();
  if (albumError) throw albumError;

  const trackRows = (albumData.tracks?.items ?? []).map((t: any) => ({
    spotify_id: t.id,
    album_id: album.id,
    artist_id: artist.id,
    name: t.name,
    track_number: t.track_number,
    duration_ms: t.duration_ms,
    cached_at: new Date().toISOString(),
  }));

  let tracks = [];
  if (trackRows.length > 0) {
    const { data, error } = await supabaseAdmin
      .from("tracks")
      .upsert(trackRows, { onConflict: "spotify_id" })
      .select()
      .order("track_number", { ascending: true });
    if (error) throw error;
    tracks = data;
  }

  return { artist, album, tracks };
}

// ---- Servidor HTTP ------------------------------------------------------

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  try {
    const { action, query, spotifyId } = await req.json();

    let result;
    switch (action) {
      case "search":
        result = await handleSearch(query);
        break;
      case "artist":
        result = await handleArtist(spotifyId);
        break;
      case "album":
        result = await handleAlbum(spotifyId);
        break;
      default:
        return new Response(
          JSON.stringify({ error: `Ação desconhecida: ${action}` }),
          { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
        );
    }

    return new Response(JSON.stringify(result), {
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }
});