import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { fetchArtist } from '../lib/spotify'
import {
  getArtistFromCache,
  getAlbumsByArtistId,
  isCacheStale,
  getArtistCommunityStats,
  getTopTracksForArtist,
  getRecentReviewsForArtist,
  getSimilarArtists,
} from '../lib/db'
import AlbumCard from '../components/cards/AlbumCard'
import ArtistCard from '../components/cards/ArtistCard'
import ReviewItem from '../components/reviews/ReviewItem'

function formatCount(n) {
  if (n == null) return null
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace('.0', '')} mi`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace('.0', '')} mil`
  return String(n)
}

export default function ArtistPage() {
  const { spotifyId } = useParams()
  const [data, setData] = useState(null) // { artist, albums }
  const [error, setError] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const [communityStats, setCommunityStats] = useState(null)
  const [topTracks, setTopTracks] = useState([])
  const [recentReviews, setRecentReviews] = useState([])
  const [similarArtists, setSimilarArtists] = useState([])

  useEffect(() => {
    let cancelled = false
    setData(null)
    setError('')
    setCommunityStats(null)
    setTopTracks([])
    setRecentReviews([])
    setSimilarArtists([])

    async function load() {
      try {
        const cachedArtist = await getArtistFromCache(spotifyId)
        let cachedAlbums = []
        if (cachedArtist && !cancelled) {
          cachedAlbums = await getAlbumsByArtistId(cachedArtist.id)
          if (cachedAlbums.length > 0) {
            setData({ artist: cachedArtist, albums: cachedAlbums })
            loadCommunityData(cachedArtist.id)
          }
        }

        const needsFreshFetch =
          !cachedArtist || cachedAlbums.length === 0 || cachedArtist.followers_count == null || isCacheStale(cachedArtist.cached_at)
        if (needsFreshFetch) {
          if (cachedArtist && cachedAlbums.length > 0 && !cancelled) setRefreshing(true)
          const fresh = await fetchArtist(spotifyId)
          if (!cancelled) {
            setData(fresh)
            loadCommunityData(fresh.artist.id)
          }
        }
      } catch (err) {
        if (!cancelled) setError(err.message)
      } finally {
        if (!cancelled) setRefreshing(false)
      }
    }

    function loadCommunityData(artistId) {
      getArtistCommunityStats(artistId).then((s) => !cancelled && setCommunityStats(s))
      getTopTracksForArtist(artistId, 8).then((t) => !cancelled && setTopTracks(t))
      getRecentReviewsForArtist(artistId, 6).then((r) => !cancelled && setRecentReviews(r))
      getSimilarArtists(artistId, 8).then((a) => !cancelled && setSimilarArtists(a))
    }

    load()
    return () => {
      cancelled = true
    }
  }, [spotifyId])

  if (error && !data) {
    return (
      <div className="page">
        <p className="error-text">{error}</p>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="page">
        <div className="hero-skeleton" />
      </div>
    )
  }

  const { artist, albums } = data
  const followersLabel = formatCount(artist.followers_count)

  return (
    <div className="page">
      <div className="hero">
        <div className="hero__backdrop" style={{ backgroundImage: `url(${artist.image_url})` }} />
        <div className="hero__overlay" />
        <div className="hero__content">
          <img src={artist.image_url || undefined} alt="" className="hero__cover" style={{ borderRadius: '50%' }} />
          <div>
            <p className="hero__eyebrow">Artista{refreshing ? ' · atualizando…' : ''}</p>
            <h1 className="hero__title">{artist.name}</h1>
            {artist.genres?.length > 0 && <p className="hero__meta">{artist.genres.slice(0, 4).join(' · ')}</p>}

            <div className="artist-stat-row">
              {followersLabel && (
                <span>
                  <b>{followersLabel}</b> seguidores no Spotify
                </span>
              )}
              {artist.popularity != null && (
                <span>
                  <b>{artist.popularity}</b>/100 popularidade no Spotify
                </span>
              )}
              {communityStats?.avgScore != null && (
                <span>
                  <b>{communityStats.avgScore}</b>/5 no Musgas ({communityStats.totalRatings} nota(s))
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {error && <p className="error-text">{error}</p>}

      {topTracks.length > 0 && (
        <section style={{ marginBottom: 36 }}>
          <p className="section-title">Mais bem avaliadas no Musgas</p>
          <div className="card">
            {topTracks.map((t) => (
              <Link to={`/album/${t.albums?.spotify_id}`} key={t.id} className="item-row">
                <img src={t.albums?.cover_url || undefined} alt="" className="item-row__cover" />
                <div style={{ flex: 1 }}>
                  <div className="item-row__title">{t.name}</div>
                  <div className="item-row__subtitle">{t.albums?.name}</div>
                </div>
                <span className="mono" style={{ color: 'var(--accent-strong)' }}>
                  {t.stats.avg_score} · {t.stats.rating_count}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section style={{ marginBottom: 36 }}>
        <p className="section-title">Discografia completa ({albums.length})</p>
        <div className="grid">
          {albums.map((al) => (
            <AlbumCard
              key={al.spotify_id}
              spotifyId={al.spotify_id}
              coverUrl={al.cover_url}
              name={al.name}
              artistName={artist.name}
            />
          ))}
        </div>
      </section>

      {recentReviews.length > 0 && (
        <section style={{ marginBottom: 36 }}>
          <p className="section-title">Reviews recentes</p>
          <div className="card">
            {recentReviews.map((r) => (
              <div key={r.id}>
                <p style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 12 }}>sobre "{r.tracks?.name}"</p>
                <ReviewItem review={r} />
              </div>
            ))}
          </div>
        </section>
      )}

      {similarArtists.length > 0 && (
        <section>
          <p className="section-title">Fãs desse artista também curtem</p>
          <div className="grid">
            {similarArtists.map((a) => (
              <ArtistCard key={a.spotify_id} spotifyId={a.spotify_id} imageUrl={a.image_url} name={a.name} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}