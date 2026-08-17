import { useEffect, useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { searchMusic } from '../lib/spotify'
import AlbumCard from '../components/cards/AlbumCard'
import ArtistCard from '../components/cards/ArtistCard'

export default function Search() {
  const [params] = useSearchParams()
  const query = params.get('q') || ''
  const [results, setResults] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!query) {
      setResults(null)
      return
    }
    setLoading(true)
    setError('')
    searchMusic(query)
      .then(setResults)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [query])

  if (!query) {
    return (
      <div className="page">
        <div className="empty-state">
          <h3>Busque por um artista, álbum ou faixa</h3>
          <p>Use a barra de busca no topo da página.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="page">
      <h2 style={{ marginBottom: 24 }}>Resultados para "{query}"</h2>

      {loading && <p style={{ color: 'var(--text-dim)' }}>Buscando…</p>}
      {error && <p className="error-text">{error}</p>}

      {results && (
        <>
          {results.artists.length > 0 && (
            <section style={{ marginBottom: 36 }}>
              <p className="section-title">Artistas</p>
              <div className="grid">
                {results.artists.map((a) => (
                  <ArtistCard key={a.spotify_id} spotifyId={a.spotify_id} imageUrl={a.image_url} name={a.name} />
                ))}
              </div>
            </section>
          )}

          {results.albums.length > 0 && (
            <section style={{ marginBottom: 36 }}>
              <p className="section-title">Álbuns</p>
              <div className="grid">
                {results.albums.map((al) => (
                  <AlbumCard
                    key={al.spotify_id}
                    spotifyId={al.spotify_id}
                    coverUrl={al.cover_url}
                    name={al.name}
                    artistName={al.artist_name}
                  />
                ))}
              </div>
            </section>
          )}

          {results.tracks.length > 0 && (
            <section>
              <p className="section-title">Faixas</p>
              <div className="card">
                {results.tracks.map((t) => (
                  <Link to={`/album/${t.album_spotify_id}`} key={t.spotify_id} className="item-row">
                    <img src={t.album_cover_url || undefined} alt="" className="item-row__cover" />
                    <div>
                      <div className="item-row__title">{t.name}</div>
                      <div className="item-row__subtitle">
                        {t.artist_name} · {t.album_name}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {results.artists.length === 0 && results.albums.length === 0 && results.tracks.length === 0 && (
            <div className="empty-state">
              <h3>Nada encontrado</h3>
              <p>Tente outro termo de busca.</p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
