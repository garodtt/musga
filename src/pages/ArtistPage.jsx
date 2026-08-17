import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { fetchArtist } from '../lib/spotify'
import { getArtistFromCache, getAlbumsByArtistId, isCacheStale } from '../lib/db'
import AlbumCard from '../components/cards/AlbumCard'

export default function ArtistPage() {
  const { spotifyId } = useParams()
  const [data, setData] = useState(null) // { artist, albums }
  const [error, setError] = useState('')
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    let cancelled = false
    setData(null)
    setError('')

    async function load() {
      // 1) Tenta mostrar o que já está cacheado no nosso banco — instantâneo.
      try {
        const cachedArtist = await getArtistFromCache(spotifyId)
        if (cachedArtist && !cancelled) {
          const albums = await getAlbumsByArtistId(cachedArtist.id)
          if (!cancelled) setData({ artist: cachedArtist, albums })
        }

        // 2) Se não tinha nada em cache, ou o cache está velho (>7 dias),
        // busca no Spotify (via edge function) e atualiza.
        if (!cachedArtist || isCacheStale(cachedArtist.cached_at)) {
          if (cachedArtist && !cancelled) setRefreshing(true)
          const fresh = await fetchArtist(spotifyId)
          if (!cancelled) setData(fresh)
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
          </div>
        </div>
      </div>

      <p className="section-title">Álbuns e singles</p>
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
    </div>
  )
}