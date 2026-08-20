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
  const { data: reviews, error } = await supabase
    .from('reviews')
    .select('id, body, created_at, user_id')
    .eq('track_id', trackId)
    .order('created_at', { ascending: false })
  if (error) throw error
  if (!reviews.length) return []

  const userIds = [...new Set(reviews.map((r) => r.user_id))]
  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url')
    .in('id', userIds)
  if (profilesError) throw profilesError

  const profilesById = Object.fromEntries(profiles.map((p) => [p.id, p]))
  return reviews.map((r) => ({ ...r, profiles: profilesById[r.user_id] }))
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
  const [ratingsCountRes, reviewsCountRes, listsCountRes, ratingsWithArtist, ratingsWithDates] = await Promise.all([
    supabase.from('ratings').select('id', { count: 'exact', head: true }).eq('user_id', userId),
    supabase.from('reviews').select('id', { count: 'exact', head: true }).eq('user_id', userId),
    supabase.from('lists').select('id', { count: 'exact', head: true }).eq('user_id', userId),
    supabase.from('ratings').select('score, tracks ( artist_id, artists ( name ) )').eq('user_id', userId),
    supabase.from('ratings').select('created_at, tracks ( albums ( release_date ) )').eq('user_id', userId),
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

  const dateRows = ratingsWithDates.data || []
  const hasEarlyBird = dateRows.some((r) => {
    const releaseDate = r.tracks?.albums?.release_date
    if (!releaseDate) return false
    const days = (new Date(r.created_at) - new Date(releaseDate)) / 86400000
    return days >= 0 && days <= 7
  })
  const hasNostalgic = dateRows.some((r) => {
    const releaseDate = r.tracks?.albums?.release_date
    if (!releaseDate) return false
    const years = (new Date(r.created_at) - new Date(releaseDate)) / (365.25 * 86400000)
    return years >= 20
  })
  const distinctDays = [...new Set(dateRows.map((r) => r.created_at.slice(0, 10)))]
  const streakDays = computeCurrentStreak(distinctDays)

  return {
    ratingsCount: ratingsCountRes.count || 0,
    reviewsCount: reviewsCountRes.count || 0,
    listsCount: listsCountRes.count || 0,
    avgScore: avgScore != null ? Math.round(avgScore * 100) / 100 : null,
    topArtist: topArtistEntry ? { name: topArtistEntry[0], count: topArtistEntry[1] } : null,
    distinctArtists: Object.keys(artistCounts).length,
    hasEarlyBird,
    hasNostalgic,
    streakDays,
  }
}

function computeCurrentStreak(daysList) {
  if (!daysList.length) return 0
  const daySet = new Set(daysList)
  let streak = 0
  const cursor = new Date()
  cursor.setHours(0, 0, 0, 0)
  if (!daySet.has(cursor.toISOString().slice(0, 10))) {
    cursor.setDate(cursor.getDate() - 1)
  }
  while (daySet.has(cursor.toISOString().slice(0, 10))) {
    streak++
    cursor.setDate(cursor.getDate() - 1)
  }
  return streak
}

/** Distribuição das notas que o usuário deu (1 a 5), em percentual. */
export async function getUserRatingDistribution(userId) {
  const { data, error } = await supabase.from('ratings').select('score').eq('user_id', userId)
  if (error) throw error
  const counts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  data.forEach((r) => {
    counts[r.score] = (counts[r.score] || 0) + 1
  })
  const total = data.length
  return [1, 2, 3, 4, 5].map((score) => ({
    score,
    count: counts[score],
    pct: total ? Math.round((counts[score] / total) * 100) : 0,
  }))
}

/** Top artistas e álbuns pessoais do usuário, por quantidade de faixas avaliadas. */
export async function getUserTopArtistsAndAlbums(userId, limit = 5) {
  const { data, error } = await supabase
    .from('ratings')
    .select('tracks ( album_id, artists ( name ), albums ( name, spotify_id, cover_url ) )')
    .eq('user_id', userId)
  if (error) throw error

  const artistCounts = {}
  const albumCounts = {}
  ;(data || []).forEach((r) => {
    const artistName = r.tracks?.artists?.name
    if (artistName) artistCounts[artistName] = (artistCounts[artistName] || 0) + 1

    const albumId = r.tracks?.album_id
    if (albumId) {
      if (!albumCounts[albumId]) albumCounts[albumId] = { count: 0, album: r.tracks?.albums }
      albumCounts[albumId].count += 1
    }
  })

  const topArtists = Object.entries(artistCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([name, count]) => ({ name, count }))

  const topAlbums = Object.values(albumCounts)
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)

  return { topArtists, topAlbums }
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
    .select('id, name, spotify_id, cover_url, release_date, artists ( name, genres )')
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

// ---------- Curtidas em reviews ----------

/** Mapa reviewId -> { count, likedByMe }, para uma lista de reviews. */
export async function getReviewLikesInfo(reviewIds, userId) {
  const info = {}
  reviewIds.forEach((id) => {
    info[id] = { count: 0, likedByMe: false }
  })
  if (!reviewIds.length) return info

  const { data, error } = await supabase.from('review_likes').select('review_id, user_id').in('review_id', reviewIds)
  if (error) throw error
  data.forEach((row) => {
    info[row.review_id].count += 1
    if (userId && row.user_id === userId) info[row.review_id].likedByMe = true
  })
  return info
}

export async function likeReview(reviewId, userId) {
  const { error } = await supabase.from('review_likes').insert({ review_id: reviewId, user_id: userId })
  if (error && error.code !== '23505') throw error
}

export async function unlikeReview(reviewId, userId) {
  const { error } = await supabase.from('review_likes').delete().eq('review_id', reviewId).eq('user_id', userId)
  if (error) throw error
}

// ---------- Comentários em reviews ----------

export async function getCommentsForReview(reviewId) {
  const { data: comments, error } = await supabase
    .from('review_comments')
    .select('id, body, created_at, user_id')
    .eq('review_id', reviewId)
    .order('created_at', { ascending: true })
  if (error) throw error
  if (!comments.length) return []

  const userIds = [...new Set(comments.map((c) => c.user_id))]
  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url')
    .in('id', userIds)
  if (profilesError) throw profilesError

  const profilesById = Object.fromEntries(profiles.map((p) => [p.id, p]))
  return comments.map((c) => ({ ...c, profiles: profilesById[c.user_id] }))
}

export async function addReviewComment(reviewId, userId, body) {
  const { error } = await supabase.from('review_comments').insert({ review_id: reviewId, user_id: userId, body })
  if (error) throw error
}

export async function deleteReviewComment(commentId) {
  const { error } = await supabase.from('review_comments').delete().eq('id', commentId)
  if (error) throw error
}

// ---------- Notificações ----------

export async function getNotifications(userId, limit = 20) {
  const { data, error } = await supabase
    .from('notifications')
    .select(`
      id, type, read, created_at,
      actor:profiles!actor_id ( username, display_name, avatar_url ),
      reviews ( id, tracks ( name, albums ( spotify_id ) ) )
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data
}

export async function getUnreadNotificationCount(userId) {
  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('read', false)
  if (error) throw error
  return count || 0
}

export async function markNotificationsRead(userId) {
  const { error } = await supabase.from('notifications').update({ read: true }).eq('user_id', userId).eq('read', false)
  if (error) throw error
}

// ---------- Comparação de gosto musical ----------

/**
 * % de "concordância" entre dois usuários nas faixas que ambos avaliaram
 * (nota com diferença de até 1 ponto conta como "de acordo"). Retorna
 * null se não há faixas em comum avaliadas pelos dois.
 */
export async function getTasteCompatibility(userIdA, userIdB) {
  const [resA, resB] = await Promise.all([
    supabase.from('ratings').select('track_id, score').eq('user_id', userIdA),
    supabase.from('ratings').select('track_id, score').eq('user_id', userIdB),
  ])
  if (resA.error) throw resA.error
  if (resB.error) throw resB.error

  const scoresB = Object.fromEntries(resB.data.map((r) => [r.track_id, r.score]))
  const common = resA.data.filter((r) => scoresB[r.track_id] != null)
  if (!common.length) return null

  const agreements = common.filter((r) => Math.abs(r.score - scoresB[r.track_id]) <= 1).length
  return {
    pct: Math.round((agreements / common.length) * 100),
    commonCount: common.length,
  }
}

// ---------- Descobrir pessoas pra seguir ----------

export async function searchProfiles(query, excludeUserId, limit = 20) {
  let q = supabase.from('profiles').select('id, username, display_name, avatar_url, bio').limit(limit)
  if (query.trim()) {
    q = q.or(`username.ilike.%${query}%,display_name.ilike.%${query}%`)
  } else {
    q = q.order('created_at', { ascending: false })
  }
  const { data, error } = await q
  if (error) throw error
  return excludeUserId ? data.filter((p) => p.id !== excludeUserId) : data
}

/** Sugestão simples: os usuários mais ativos (mais notas dadas), exclui você mesmo. */
export async function getSuggestedProfiles(userId, limit = 10) {
  const { data: activity, error } = await supabase
    .from('profile_activity_counts')
    .select('user_id, ratings_count')
    .order('ratings_count', { ascending: false })
    .limit(limit + 1)
  if (error) throw error

  const ids = activity.map((a) => a.user_id).filter((id) => id !== userId).slice(0, limit)
  if (!ids.length) return []

  const { data: profiles, error: pErr } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, bio')
    .in('id', ids)
  if (pErr) throw pErr
  const byId = Object.fromEntries(profiles.map((p) => [p.id, p]))
  return ids.map((id) => byId[id]).filter(Boolean)
}

/** ids dos usuários que o usuário logado já segue — usado pra marcar quem já é seguido. */
export async function getFollowingIds(userId) {
  const { data, error } = await supabase.from('follows').select('following_id').eq('follower_id', userId)
  if (error) throw error
  return new Set(data.map((f) => f.following_id))
}

// ---------- "Quem ouviu isso também ouviu" ----------

/**
 * Outros álbuns bem avaliados (nota 4-5) pelas mesmas pessoas que também
 * avaliaram bem alguma faixa deste álbum. Usa só dados já no nosso banco.
 */
export async function getListenersAlsoLiked(albumId, limit = 8) {
  const { data: albumTracks, error: tErr } = await supabase.from('tracks').select('id').eq('album_id', albumId)
  if (tErr) throw tErr
  const trackIds = albumTracks.map((t) => t.id)
  if (!trackIds.length) return []

  const { data: likers, error: lErr } = await supabase
    .from('ratings')
    .select('user_id')
    .in('track_id', trackIds)
    .gte('score', 4)
  if (lErr) throw lErr
  const userIds = [...new Set(likers.map((l) => l.user_id))]
  if (!userIds.length) return []

  const { data: otherRatings, error: oErr } = await supabase
    .from('ratings')
    .select('tracks ( album_id )')
    .in('user_id', userIds)
    .gte('score', 4)
  if (oErr) throw oErr

  const albumCounts = {}
  otherRatings.forEach((r) => {
    const aId = r.tracks?.album_id
    if (!aId || aId === albumId) return
    albumCounts[aId] = (albumCounts[aId] || 0) + 1
  })
  const topIds = Object.entries(albumCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([id]) => id)
  if (!topIds.length) return []

  const { data: albums, error: aErr } = await supabase
    .from('albums')
    .select('id, name, spotify_id, cover_url, artists ( name )')
    .in('id', topIds)
  if (aErr) throw aErr
  const byId = Object.fromEntries(albums.map((a) => [a.id, a]))
  return topIds.map((id) => byId[id]).filter(Boolean)
}

// ---------- Resumo por período (semana/mês) ----------

export async function getUserRecap(userId) {
  const now = new Date()
  const startOfWeek = new Date(now)
  startOfWeek.setDate(now.getDate() - now.getDay())
  startOfWeek.setHours(0, 0, 0, 0)
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

  function summarize(rows) {
    if (!rows.length) return { count: 0, avg: null }
    return { count: rows.length, avg: Math.round((rows.reduce((sum, r) => sum + r.score, 0) / rows.length) * 100) / 100 }
  }

  const [weekRes, monthRes] = await Promise.all([
    supabase.from('ratings').select('score').eq('user_id', userId).gte('created_at', startOfWeek.toISOString()),
    supabase.from('ratings').select('score').eq('user_id', userId).gte('created_at', startOfMonth.toISOString()),
  ])
  if (weekRes.error) throw weekRes.error
  if (monthRes.error) throw monthRes.error

  return { week: summarize(weekRes.data), month: summarize(monthRes.data) }
}

// ---------- Listas ----------

export async function getListsByUser(userId) {
  const { data: owned, error } = await supabase
    .from('lists')
    .select('*, list_items ( id )')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw error

  const { data: collabRows, error: collabError } = await supabase
    .from('list_collaborators')
    .select('list_id')
    .eq('user_id', userId)
  if (collabError) throw collabError

  const collabIds = collabRows.map((c) => c.list_id)
  let collabLists = []
  if (collabIds.length) {
    const { data, error: collabListsError } = await supabase
      .from('lists')
      .select('*, list_items ( id )')
      .in('id', collabIds)
    if (collabListsError) throw collabListsError
    collabLists = data
  }

  return [...owned, ...collabLists]
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

export async function createList(userId, title, description, isPublic, tags = []) {
  const { data, error } = await supabase
    .from('lists')
    .insert({ user_id: userId, title, description, is_public: isPublic, tags })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateListTags(listId, tags) {
  const { error } = await supabase.from('lists').update({ tags }).eq('id', listId)
  if (error) throw error
}

export async function updateList(listId, updates) {
  const { error } = await supabase.from('lists').update(updates).eq('id', listId)
  if (error) throw error
}

export async function deleteList(listId) {
  const { error } = await supabase.from('lists').delete().eq('id', listId)
  if (error) throw error
}

/** Atualiza a posição de vários itens de uma lista de uma vez (drag and drop). */
export async function updateListItemPositions(itemsWithPositions) {
  await Promise.all(
    itemsWithPositions.map(({ id, position }) => supabase.from('list_items').update({ position }).eq('id', id))
  )
}

// ---------- Colaboradores de lista ----------

export async function getCollaborators(listId) {
  const { data, error } = await supabase
    .from('list_collaborators')
    .select('user_id, profiles ( username, display_name, avatar_url )')
    .eq('list_id', listId)
  if (error) throw error
  return data
}

export async function addCollaboratorByUsername(listId, username) {
  const profile = await getProfileByUsername(username)
  if (!profile) throw new Error('Usuário não encontrado.')
  const { error } = await supabase.from('list_collaborators').insert({ list_id: listId, user_id: profile.id })
  if (error) {
    if (error.code === '23505') throw new Error('Essa pessoa já é colaboradora dessa lista.')
    throw error
  }
  return profile
}

export async function removeCollaborator(listId, userId) {
  const { error } = await supabase.from('list_collaborators').delete().eq('list_id', listId).eq('user_id', userId)
  if (error) throw error
}

// ---------- Editar perfil ----------

export async function updateProfile(userId, updates) {
  const { error } = await supabase.from('profiles').update(updates).eq('id', userId)
  if (error) throw error
}

/** Envia a foto (já recortada, como Blob) para o Storage e retorna a URL pública. */
export async function uploadAvatar(userId, blob) {
  const path = `${userId}/avatar.png`
  const { error } = await supabase.storage.from('avatars').upload(path, blob, {
    upsert: true,
    contentType: 'image/png',
  })
  if (error) throw error
  const { data } = supabase.storage.from('avatars').getPublicUrl(path)
  // cache-busting: sem isso o navegador pode continuar mostrando a foto antiga,
  // já que o caminho do arquivo é sempre o mesmo.
  return `${data.publicUrl}?v=${Date.now()}`
}

// ---------- Listas de seguidores/seguindo (estilo Instagram) ----------

export async function getFollowersList(userId) {
  const { data: rows, error } = await supabase.from('follows').select('follower_id').eq('following_id', userId)
  if (error) throw error
  if (!rows.length) return []
  const { data: profiles, error: pErr } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url')
    .in('id', rows.map((r) => r.follower_id))
  if (pErr) throw pErr
  return profiles
}

export async function getFollowingListProfiles(userId) {
  const { data: rows, error } = await supabase.from('follows').select('following_id').eq('follower_id', userId)
  if (error) throw error
  if (!rows.length) return []
  const { data: profiles, error: pErr } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url')
    .in('id', rows.map((r) => r.following_id))
  if (pErr) throw pErr
  return profiles
}

// ---------- Página do artista ("tudo dele") ----------

/** ids das faixas de um artista — compartilhado pelas funções abaixo, pra
 * não repetir a mesma consulta 3 vezes na mesma visita à página. */
export async function getArtistTrackIds(artistId) {
  const { data, error } = await supabase.from('tracks').select('id').eq('artist_id', artistId)
  if (error) throw error
  return data.map((t) => t.id)
}

/** Nota média e total de avaliações da comunidade para todas as faixas do artista. */
export async function getArtistCommunityStats(artistId, trackIds) {
  const ids = trackIds ?? (await getArtistTrackIds(artistId))
  if (!ids.length) return { avgScore: null, totalRatings: 0 }

  const { data: ratings, error: rErr } = await supabase.from('ratings').select('score').in('track_id', ids)
  if (rErr) throw rErr
  if (!ratings.length) return { avgScore: null, totalRatings: 0 }

  const avg = ratings.reduce((sum, r) => sum + r.score, 0) / ratings.length
  return { avgScore: Math.round(avg * 100) / 100, totalRatings: ratings.length }
}

/** Faixas do artista mais bem avaliadas pela comunidade do Musgas. */
export async function getTopTracksForArtist(artistId, limit = 10) {
  const { data: tracks, error } = await supabase
    .from('tracks')
    .select('id, name, album_id, albums ( name, spotify_id, cover_url )')
    .eq('artist_id', artistId)
  if (error) throw error
  if (!tracks.length) return []

  const trackIds = tracks.map((t) => t.id)
  const { data: stats, error: sErr } = await supabase
    .from('track_rating_stats')
    .select('track_id, avg_score, rating_count')
    .in('track_id', trackIds)
  if (sErr) throw sErr

  const statsById = Object.fromEntries(stats.map((s) => [s.track_id, s]))
  return tracks
    .map((t) => ({ ...t, stats: statsById[t.id] }))
    .filter((t) => t.stats)
    .sort((a, b) => b.stats.avg_score - a.stats.avg_score || b.stats.rating_count - a.stats.rating_count)
    .slice(0, limit)
}

/** Reviews recentes escritas sobre qualquer faixa deste artista. */
export async function getRecentReviewsForArtist(artistId, limit = 6, trackIds) {
  const ids = trackIds ?? (await getArtistTrackIds(artistId))
  if (!ids.length) return []

  const { data: reviews, error: rErr } = await supabase
    .from('reviews')
    .select('id, body, created_at, user_id, tracks ( name )')
    .in('track_id', ids)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (rErr) throw rErr
  if (!reviews.length) return []

  const userIds = [...new Set(reviews.map((r) => r.user_id))]
  const { data: profiles, error: pErr } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url')
    .in('id', userIds)
  if (pErr) throw pErr

  const profilesById = Object.fromEntries(profiles.map((p) => [p.id, p]))
  return reviews.map((r) => ({ ...r, profiles: profilesById[r.user_id] }))
}

/** Outros artistas curtidos por quem também curte este (nota 4-5 em comum). */
export async function getSimilarArtists(artistId, limit = 8, trackIds) {
  const ids = trackIds ?? (await getArtistTrackIds(artistId))
  if (!ids.length) return []

  const { data: likers, error: lErr } = await supabase
    .from('ratings')
    .select('user_id')
    .in('track_id', ids)
    .gte('score', 4)
  if (lErr) throw lErr
  const userIds = [...new Set(likers.map((l) => l.user_id))]
  if (!userIds.length) return []

  const { data: otherRatings, error: oErr } = await supabase
    .from('ratings')
    .select('tracks ( artist_id )')
    .in('user_id', userIds)
    .gte('score', 4)
  if (oErr) throw oErr

  const counts = {}
  otherRatings.forEach((r) => {
    const aId = r.tracks?.artist_id
    if (!aId || aId === artistId) return
    counts[aId] = (counts[aId] || 0) + 1
  })
  const topIds = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([id]) => id)
  if (!topIds.length) return []

  const { data: artists, error: aErr } = await supabase
    .from('artists')
    .select('id, name, spotify_id, image_url')
    .in('id', topIds)
  if (aErr) throw aErr
  const byId = Object.fromEntries(artists.map((a) => [a.id, a]))
  return topIds.map((id) => byId[id]).filter(Boolean)
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