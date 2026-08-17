import { supabase } from './supabaseClient'

// ---------- Cache local (evita chamar a Edge Function/Spotify quando possível) ----------

const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 dias

export function isCacheStale(cachedAt) {
  if (!cachedAt) return true
  return Date.now() - new Date(cachedAt).getTime() > CACHE_TTL_MS
}

export async function getArtistFromCache(spotifyId) {
  const { data, error } = await supabase.from('artists').select('*').eq('spotify_id', spotifyId).maybeSingle()
  if (error) throw error
  return data
}

export async function getAlbumsByArtistId(artistId) {
  const { data, error } = await supabase
    .from('albums')
    .select('*')
    .eq('artist_id', artistId)
    .order('release_date', { ascending: false })
  if (error) throw error
  return data
}

export async function getAlbumFromCache(spotifyId) {
  const { data, error } = await supabase
    .from('albums')
    .select('*, artists ( * )')
    .eq('spotify_id', spotifyId)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function getTracksByAlbumId(albumId) {
  const { data, error } = await supabase
    .from('tracks')
    .select('*')
    .eq('album_id', albumId)
    .order('track_number', { ascending: true })
  if (error) throw error
  return data
}

// ---------- Notas (ratings) ----------

/** Nota que o usuário logado deu para uma faixa (ou null). */
export async function getMyRating(trackId, userId) {
  if (!userId) return null
  const { data, error } = await supabase
    .from('ratings')
    .select('score')
    .eq('track_id', trackId)
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw error
  return data?.score ?? null
}

/** Cria ou atualiza a nota (1 a 5) do usuário logado para uma faixa. */
export async function rateTrack(trackId, userId, score) {
  const { error } = await supabase
    .from('ratings')
    .upsert({ track_id: trackId, user_id: userId, score }, { onConflict: 'user_id,track_id' })
  if (error) throw error
}

export async function removeRating(trackId, userId) {
  const { error } = await supabase
    .from('ratings')
    .delete()
    .eq('track_id', trackId)
    .eq('user_id', userId)
  if (error) throw error
}

/** Média + nº de notas de cada faixa de um álbum. Mapa: track_id -> stats */
export async function getTrackStatsForAlbum(trackIds) {
  if (!trackIds.length) return {}
  const { data, error } = await supabase
    .from('track_rating_stats')
    .select('*')
    .in('track_id', trackIds)
  if (error) throw error
  return Object.fromEntries(data.map((row) => [row.track_id, row]))
}

/** Nota agregada do álbum (média das médias das faixas). */
export async function getAlbumStats(albumId) {
  const { data, error } = await supabase
    .from('album_rating_stats')
    .select('*')
    .eq('album_id', albumId)
    .maybeSingle()
  if (error) throw error
  return data
}

/** Distribuição percentual de notas (1..5) dentro de um álbum. */
export async function getAlbumDistribution(albumId) {
  const { data, error } = await supabase
    .from('album_rating_distribution')
    .select('score, cnt')
    .eq('album_id', albumId)
  if (error) throw error

  const total = data.reduce((sum, row) => sum + row.cnt, 0)
  const byScore = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  data.forEach((row) => {
    byScore[row.score] = row.cnt
  })
  return Object.entries(byScore).map(([score, cnt]) => ({
    score: Number(score),
    count: cnt,
    pct: total > 0 ? Math.round((cnt / total) * 100) : 0,
  }))
}

/** Mapa track_id -> nota do usuário logado, para todas as faixas de um álbum. */
export async function getMyRatingsMap(trackIds, userId) {
  if (!userId || !trackIds.length) return {}
  const { data, error } = await supabase
    .from('ratings')
    .select('track_id, score')
    .eq('user_id', userId)
    .in('track_id', trackIds)
  if (error) throw error
  return Object.fromEntries(data.map((r) => [r.track_id, r.score]))
}

/** Mapa track_id -> quantidade de reviews, para todas as faixas de um álbum. */
export async function getReviewCountsForTracks(trackIds) {
  if (!trackIds.length) return {}
  const { data, error } = await supabase.from('reviews').select('track_id').in('track_id', trackIds)
  if (error) throw error
  const counts = {}
  data.forEach((r) => {
    counts[r.track_id] = (counts[r.track_id] || 0) + 1
  })
  return counts
}

// ---------- Reviews ----------

export async function getReviewsForTrack(trackId) {
  const { data, error } = await supabase
    .from('reviews')
    .select('id, body, created_at, user_id, profiles ( username, display_name, avatar_url )')
    .eq('track_id', trackId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function upsertReview(trackId, userId, body) {
  const { error } = await supabase
    .from('reviews')
    .upsert({ track_id: trackId, user_id: userId, body }, { onConflict: 'user_id,track_id' })
  if (error) throw error
}

export async function deleteReview(trackId, userId) {
  const { error } = await supabase
    .from('reviews')
    .delete()
    .eq('track_id', trackId)
    .eq('user_id', userId)
  if (error) throw error
}

// ---------- Perfis / seguidores ----------

export async function getProfileByUsername(username) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('username', username)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function getFollowCounts(userId) {
  const [followers, following] = await Promise.all([
    supabase.from('follows').select('follower_id', { count: 'exact', head: true }).eq('following_id', userId),
    supabase.from('follows').select('following_id', { count: 'exact', head: true }).eq('follower_id', userId),
  ])
  return { followers: followers.count ?? 0, following: following.count ?? 0 }
}

export async function isFollowing(followerId, followingId) {
  if (!followerId) return false
  const { data, error } = await supabase
    .from('follows')
    .select('follower_id')
    .eq('follower_id', followerId)
    .eq('following_id', followingId)
    .maybeSingle()
  if (error) throw error
  return !!data
}

export async function followUser(followerId, followingId) {
  const { error } = await supabase.from('follows').insert({ follower_id: followerId, following_id: followingId })
  if (error) throw error
}

export async function unfollowUser(followerId, followingId) {
  const { error } = await supabase
    .from('follows')
    .delete()
    .eq('follower_id', followerId)
    .eq('following_id', followingId)
  if (error) throw error
}

/** Faixas com mais notas nos últimos 7 dias — "Músicas do momento". */
export async function getTrendingTracks(limit = 8) {
  const { data: trending, error } = await supabase
    .from('trending_tracks')
    .select('track_id, recent_rating_count, recent_avg_score')
    .order('recent_rating_count', { ascending: false })
    .limit(limit)
  if (error) throw error
  if (!trending.length) return []

  const trackIds = trending.map((t) => t.track_id)
  const { data: tracks, error: tracksError } = await supabase
    .from('tracks')
    .select('id, name, album_id, albums ( name, spotify_id, cover_url, artists ( name ) )')
    .in('id', trackIds)
  if (tracksError) throw tracksError

  const byId = Object.fromEntries(tracks.map((t) => [t.id, t]))
  return trending.map((t) => ({ ...t, track: byId[t.track_id] })).filter((t) => t.track)
}

/**
 * Recomendações simples: outros álbuns de artistas que o usuário avaliou
 * bem (nota 4 ou 5), que ele ainda não avaliou. Usa só o catálogo já
 * cacheado no nosso banco — não depende do Spotify, então é rápido.
 */
export async function getRecommendedAlbumsForUser(userId, limit = 8) {
  if (!userId) return []

  const { data: favRatings, error } = await supabase
    .from('ratings')
    .select('score, tracks ( artist_id )')
    .eq('user_id', userId)
    .gte('score', 4)
  if (error) throw error

  const artistIds = [...new Set((favRatings || []).map((r) => r.tracks?.artist_id).filter(Boolean))]
  if (!artistIds.length) return []

  const { data: ratedRows } = await supabase.from('ratings').select('tracks ( album_id )').eq('user_id', userId)
  const ratedAlbumIds = new Set((ratedRows || []).map((r) => r.tracks?.album_id).filter(Boolean))

  const { data: albums, error: albumsError } = await supabase
    .from('albums')
    .select('id, name, spotify_id, cover_url, artists ( name )')
    .in('artist_id', artistIds)
    .limit(limit + ratedAlbumIds.size)
  if (albumsError) throw albumsError

  return albums.filter((a) => !ratedAlbumIds.has(a.id)).slice(0, limit)
}

/** Estatísticas de um usuário — usadas na página de perfil (selos, resumo). */
export async function getUserStats(userId) {
  const [ratingsCountRes, reviewsCountRes, listsCountRes, ratingsWithArtist] = await Promise.all([
    supabase.from('ratings').select('id', { count: 'exact', head: true }).eq('user_id', userId),
    supabase.from('reviews').select('id', { count: 'exact', head: true }).eq('user_id', userId),
    supabase.from('lists').select('id', { count: 'exact', head: true }).eq('user_id', userId),
    supabase.from('ratings').select('score, tracks ( artist_id, artists ( name ) )').eq('user_id', userId),
  ])

  const rows = ratingsWithArtist.data || []
  const avgScore = rows.length ? rows.reduce((sum, r) => sum + r.score, 0) / rows.length : null

  const artistCounts = {}
  rows.forEach((r) => {
    const name = r.tracks?.artists?.name
    if (!name) return
    artistCounts[name] = (artistCounts[name] || 0) + 1
  })
  const topArtistEntry = Object.entries(artistCounts).sort((a, b) => b[1] - a[1])[0]

  return {
    ratingsCount: ratingsCountRes.count || 0,
    reviewsCount: reviewsCountRes.count || 0,
    listsCount: listsCountRes.count || 0,
    avgScore: avgScore != null ? Math.round(avgScore * 100) / 100 : null,
    topArtist: topArtistEntry ? { name: topArtistEntry[0], count: topArtistEntry[1] } : null,
    distinctArtists: Object.keys(artistCounts).length,
  }
}

/** Atividade recente (notas) de todo o site — usada na Home para dar vida à página. */
export async function getRecentSiteActivity(limit = 10) {
  const { data, error } = await supabase
    .from('ratings')
    .select(`
      id, score, created_at, user_id,
      profiles ( username, display_name, avatar_url ),
      tracks ( id, name, album_id, albums ( name, spotify_id, cover_url, artists ( name ) ) )
    `)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data
}

/** Álbuns mais bem avaliados do site (por média das faixas), para a Home. */
export async function getTopRatedAlbums(limit = 10) {
  const { data: stats, error } = await supabase
    .from('album_rating_stats')
    .select('album_id, avg_score, total_ratings')
    .order('avg_score', { ascending: false })
    .limit(limit)
  if (error) throw error
  if (!stats.length) return []

  const albumIds = stats.map((s) => s.album_id)
  const { data: albums, error: albumsError } = await supabase
    .from('albums')
    .select('id, name, spotify_id, cover_url, artists ( name )')
    .in('id', albumIds)
  if (albumsError) throw albumsError

  const albumsById = Object.fromEntries(albums.map((a) => [a.id, a]))
  return stats.map((s) => ({ ...s, album: albumsById[s.album_id] })).filter((s) => s.album)
}

/** Atividade recente (notas) de quem o usuário segue — usada na Home. */
export async function getFeedForUser(userId) {
  const { data: followingRows, error: followingError } = await supabase
    .from('follows')
    .select('following_id')
    .eq('follower_id', userId)
  if (followingError) throw followingError

  const ids = followingRows.map((f) => f.following_id)
  if (ids.length === 0) return []

  const { data, error } = await supabase
    .from('ratings')
    .select(`
      id, score, created_at, user_id,
      profiles ( username, display_name, avatar_url ),
      tracks ( id, name, album_id, albums ( name, spotify_id, cover_url, artists ( name ) ) )
    `)
    .in('user_id', ids)
    .order('created_at', { ascending: false })
    .limit(30)
  if (error) throw error
  return data
}

/** Faixas avaliadas recentemente por um usuário (para a página de perfil). */
export async function getRecentRatingsByUser(userId) {
  const { data, error } = await supabase
    .from('ratings')
    .select(`
      id, score, created_at,
      tracks ( id, name, album_id, albums ( name, spotify_id, cover_url, artists ( name ) ) )
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(40)
  if (error) throw error
  return data
}

// ---------- Listas ----------

export async function getListsByUser(userId) {
  const { data, error } = await supabase
    .from('lists')
    .select('*, list_items ( id )')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function getListById(listId) {
  const { data, error } = await supabase
    .from('lists')
    .select(`
      *,
      profiles ( username, display_name ),
      list_items (
        id, item_type, position, added_at,
        tracks ( id, name, album_id, albums ( name, spotify_id, cover_url, artists ( name ) ) ),
        albums ( id, name, spotify_id, cover_url, artists ( name ) ),
        artists ( id, name, spotify_id, image_url )
      )
    `)
    .eq('id', listId)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function createList(userId, title, description, isPublic) {
  const { data, error } = await supabase
    .from('lists')
    .insert({ user_id: userId, title, description, is_public: isPublic })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteList(listId) {
  const { error } = await supabase.from('lists').delete().eq('id', listId)
  if (error) throw error
}

export async function addItemToList(listId, itemType, itemId) {
  const row = { list_id: listId, item_type: itemType }
  if (itemType === 'track') row.track_id = itemId
  if (itemType === 'album') row.album_id = itemId
  if (itemType === 'artist') row.artist_id = itemId
  const { error } = await supabase.from('list_items').insert(row)
  if (error) {
    if (error.code === '23505') throw new Error('Esse item já está nessa lista.')
    throw error
  }
}

export async function removeItemFromList(listItemId) {
  const { error } = await supabase.from('list_items').delete().eq('id', listItemId)
  if (error) throw error
}

/** Remove um item de uma lista sem precisar saber o id da linha em list_items. */
export async function removeItemFromListByItem(listId, itemType, itemId) {
  const column = itemType === 'track' ? 'track_id' : itemType === 'album' ? 'album_id' : 'artist_id'
  const { error } = await supabase.from('list_items').delete().eq('list_id', listId).eq(column, itemId)
  if (error) throw error
}

/** Entre as listas informadas, quais já contêm este item — usado para
 * mostrar "Adicionar" ou "Remover" corretamente no seletor de listas. */
export async function getListIdsContainingItem(listIds, itemType, itemId) {
  if (!listIds.length) return new Set()
  const column = itemType === 'track' ? 'track_id' : itemType === 'album' ? 'album_id' : 'artist_id'
  const { data, error } = await supabase
    .from('list_items')
    .select('list_id')
    .eq(column, itemId)
    .in('list_id', listIds)
  if (error) throw error
  return new Set(data.map((d) => d.list_id))
}

// ---------- Lista de desejos ("ouvir depois") ----------

export async function isInWishlist(userId, itemType, itemId) {
  if (!userId) return false
  const column = itemType === 'track' ? 'track_id' : 'album_id'
  const { data, error } = await supabase
    .from('wishlist_items')
    .select('id')
    .eq('user_id', userId)
    .eq(column, itemId)
    .maybeSingle()
  if (error) throw error
  return !!data
}

export async function addToWishlist(userId, itemType, itemId) {
  const row = { user_id: userId, item_type: itemType }
  if (itemType === 'track') row.track_id = itemId
  if (itemType === 'album') row.album_id = itemId
  const { error } = await supabase.from('wishlist_items').insert(row)
  if (error && error.code !== '23505') throw error
}

export async function removeFromWishlist(userId, itemType, itemId) {
  const column = itemType === 'track' ? 'track_id' : 'album_id'
  const { error } = await supabase.from('wishlist_items').delete().eq('user_id', userId).eq(column, itemId)
  if (error) throw error
}

export async function getWishlist(userId) {
  const { data, error } = await supabase
    .from('wishlist_items')
    .select(`
      id, item_type, added_at,
      tracks ( id, name, album_id, albums ( name, spotify_id, cover_url, artists ( name ) ) ),
      albums ( id, name, spotify_id, cover_url, artists ( name ) )
    `)
    .eq('user_id', userId)
    .order('added_at', { ascending: false })
  if (error) throw error
  return data
}