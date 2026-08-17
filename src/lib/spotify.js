import { supabase } from './supabaseClient'

async function callProxy(body) {
  const { data, error } = await supabase.functions.invoke('spotify-proxy', {
    body,
  })
  if (error) throw error
  if (data?.error) throw new Error(data.error)
  return data
}

/** Busca leve (não grava no banco ainda) — usada na página de busca. */
export function searchMusic(query) {
  return callProxy({ action: 'search', query })
}

/**
 * Busca um artista completo + seus álbuns no Spotify e cacheia no Supabase.
 * Retorna as linhas já com os IDs locais (uuid) usados para avaliar/seguir.
 */
export function fetchArtist(spotifyId) {
  return callProxy({ action: 'artist', spotifyId })
}

/**
 * Busca um álbum completo + faixas no Spotify e cacheia no Supabase.
 * Retorna { artist, album, tracks } com IDs locais.
 */
export function fetchAlbum(spotifyId) {
  return callProxy({ action: 'album', spotifyId })
}
