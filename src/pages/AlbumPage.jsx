import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { fetchAlbum } from '../lib/spotify'
import {
  getAlbumFromCache,
  getTracksByAlbumId,
  isCacheStale,
  getTrackStatsForAlbum,
  getAlbumStats,
  getAlbumDistribution,
  getMyRatingsMap,
  getReviewCountsForTracks,
  rateTrack,
  removeRating,
  getReviewsForTrack,
  upsertReview,
} from '../lib/db'
import { useAuth } from '../context/AuthContext'
import TrackRow from '../components/cards/TrackRow'
import RatingDistribution from '../components/rating/RatingDistribution'
import ReviewForm from '../components/reviews/ReviewForm'
import ReviewList from '../components/reviews/ReviewList'
import AddToListButton from '../components/lists/AddToListButton'
import WishlistButton from '../components/lists/WishlistButton'

export default function AlbumPage() {
  const { spotifyId } = useParams()
  const { user } = useAuth()

  const [albumData, setAlbumData] = useState(null) // { artist, album, tracks }
  const [refreshing, setRefreshing] = useState(false)
  const [trackStats, setTrackStats] = useState({})
  const [albumStats, setAlbumStats] = useState(null)
  const [distribution, setDistribution] = useState([])
  const [myRatings, setMyRatings] = useState({})
  const [reviewCounts, setReviewCounts] = useState({})
  const [openReviewsFor, setOpenReviewsFor] = useState(null)
  const [reviewsByTrack, setReviewsByTrack] = useState({})
  const [error, setError] = useState('')

  const reloadAggregates = useCallback(
    async (trackIds, albumId) => {
      const [stats, aStats, dist, mine, counts] = await Promise.all([
        getTrackStatsForAlbum(trackIds),
        getAlbumStats(albumId),
        getAlbumDistribution(albumId),
        getMyRatingsMap(trackIds, user?.id),
        getReviewCountsForTracks(trackIds),
      ])
      setTrackStats(stats)
      setAlbumStats(aStats)
      setDistribution(dist)
      setMyRatings(mine)
      setReviewCounts(counts)
    },
    [user?.id]
  )

  useEffect(() => {
    let cancelled = false
    setError('')
    setAlbumData(null)

    async function load() {
      try {
        // 1) Mostra o que já está cacheado no nosso banco — instantâneo,
        // não depende do Spotify estar respondendo rápido.
        const cachedAlbum = await getAlbumFromCache(spotifyId)
        if (cachedAlbum && !cancelled) {
          const tracks = await getTracksByAlbumId(cachedAlbum.id)
          const data = { artist: cachedAlbum.artists, album: cachedAlbum, tracks }
          setAlbumData(data)
          await reloadAggregates(tracks.map((t) => t.id), cachedAlbum.id)
        }

        // 2) Se não tinha nada em cache, ou o cache está velho (>7 dias),
        // busca no Spotify (via edge function) por trás e atualiza a tela.
        if (!cachedAlbum || isCacheStale(cachedAlbum.cached_at)) {
          if (cachedAlbum && !cancelled) setRefreshing(true)
          const fresh = await fetchAlbum(spotifyId)
          if (!cancelled) {
            setAlbumData(fresh)
            await reloadAggregates(fresh.tracks.map((t) => t.id), fresh.album.id)
          }
        }
      } catch (err) {
        if (!cancelled) setError(err.message)
      } finally {
        if (!cancelled) setRefreshing(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spotifyId])

  async function handleRate(trackId, score) {
    if (!user) {
      setError('Entre na sua conta para avaliar faixas.')
      return
    }
    if (score === 0) {
      await removeRating(trackId, user.id)
    } else {
      await rateTrack(trackId, user.id, score)
    }
    const trackIds = albumData.tracks.map((t) => t.id)
    await reloadAggregates(trackIds, albumData.album.id)
  }

  async function handleToggleReviews(trackId) {
    if (openReviewsFor === trackId) {
      setOpenReviewsFor(null)
      return
    }
    setOpenReviewsFor(trackId)
    if (!reviewsByTrack[trackId]) {
      const reviews = await getReviewsForTrack(trackId)
      setReviewsByTrack((prev) => ({ ...prev, [trackId]: reviews }))
    }
  }

  async function handleSubmitReview(trackId, body) {
    await upsertReview(trackId, user.id, body)
    const reviews = await getReviewsForTrack(trackId)
    setReviewsByTrack((prev) => ({ ...prev, [trackId]: reviews }))
    const trackIds = albumData.tracks.map((t) => t.id)
    setReviewCounts(await getReviewCountsForTracks(trackIds))
  }

  if (error && !albumData) {
    return (
      <div className="page">
        <p className="error-text">{error}</p>
      </div>
    )
  }

  if (!albumData) {
    return (
      <div className="page">
        <div className="hero-skeleton" />
      </div>
    )
  }

  const { artist, album, tracks } = albumData

  return (
    <div className="page">
      <div className="hero">
        <div className="hero__backdrop" style={{ backgroundImage: `url(${album.cover_url})` }} />
        <div className="hero__overlay" />
        <div className="hero__content">
          <img src={album.cover_url || undefined} alt="" className="hero__cover" />
          <div style={{ flex: 1 }}>
            <p className="hero__eyebrow">
              {album.album_type === 'single' ? 'Single' : 'Álbum'}
              {refreshing ? ' · atualizando…' : ''}
            </p>
            <h1 className="hero__title">{album.name}</h1>
            <p className="hero__meta">
              {artist?.name} · {album.release_date?.slice(0, 4)} · {album.total_tracks} faixa(s)
            </p>

            <div className="hero__score">
              <span className="hero__score-value mono">{albumStats?.avg_score ?? '—'}</span>
              <span className="hero__score-label">
                nota do álbum
                <br />
                (média das faixas avaliadas)
              </span>
            </div>

            <div style={{ marginTop: 14, display: 'flex', gap: 8 }}>
              <AddToListButton itemType="album" itemId={album.id} />
              <WishlistButton itemType="album" itemId={album.id} />
            </div>
          </div>
        </div>
      </div>

      {error && <p className="error-text">{error}</p>}

      <div className="album-layout">
        <div className="card">
          <p className="section-title">Faixas</p>
          {tracks.map((track) => (
            <div key={track.id}>
              <TrackRow
                track={track}
                myScore={myRatings[track.id] || 0}
                stats={trackStats[track.id]}
                onRate={(score) => handleRate(track.id, score)}
                onToggleReviews={() => handleToggleReviews(track.id)}
                reviewsOpen={openReviewsFor === track.id}
                reviewCount={reviewCounts[track.id] || 0}
              />
              {openReviewsFor === track.id && (
                <div style={{ padding: '4px 10px 18px' }}>
                  {user && (
                    <ReviewForm
                      initialBody={reviewsByTrack[track.id]?.find((r) => r.user_id === user.id)?.body || ''}
                      onSubmit={(body) => handleSubmitReview(track.id, body)}
                    />
                  )}
                  <ReviewList reviews={reviewsByTrack[track.id] || []} />
                </div>
              )}
            </div>
          ))}
        </div>

        <div>
          <div className="card">
            <p className="section-title">Distribuição de notas</p>
            <RatingDistribution distribution={distribution} />
            <p className="mono" style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 10 }}>
              {albumStats?.total_ratings ?? 0} nota(s) no total
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}