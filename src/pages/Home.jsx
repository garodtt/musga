import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  getFeedForUser,
  getRecentSiteActivity,
  getTopRatedAlbums,
  getTrendingTracks,
  getRecommendedAlbumsForUser,
} from '../lib/db'
import ActivityRow from '../components/cards/ActivityRow'
import AlbumCard from '../components/cards/AlbumCard'

export default function Home() {
  const { user } = useAuth()
  const [feed, setFeed] = useState([])
  const [topAlbums, setTopAlbums] = useState([])
  const [siteActivity, setSiteActivity] = useState([])
  const [trending, setTrending] = useState([])
  const [recommended, setRecommended] = useState([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    Promise.all([
      user ? getFeedForUser(user.id) : Promise.resolve([]),
      getTopRatedAlbums(10),
      getRecentSiteActivity(10),
      getTrendingTracks(8),
      user ? getRecommendedAlbumsForUser(user.id, 8) : Promise.resolve([]),
    ])
      .then(([feedData, top, activity, trend, recs]) => {
        setFeed(feedData)
        setTopAlbums(top)
        setSiteActivity(activity)
        setTrending(trend)
        setRecommended(recs)
      })
      .finally(() => setLoaded(true))
  }, [user])

  return (
    <div className="page">
      {!user && (
        <div className="empty-state" style={{ padding: '40px 20px' }}>
          <h3>Bem-vindo(a) ao Musgas</h3>
          <p>
            Avalie faixas, veja a nota de cada álbum e monte suas próprias listas. Use a busca no
            topo da página para encontrar artistas, álbuns e faixas.
          </p>
          <Link to="/login" className="btn btn--primary" style={{ marginTop: 16, display: 'inline-flex' }}>
            Entrar
          </Link>
        </div>
      )}

      {user && recommended.length > 0 && (
        <section style={{ marginBottom: 40 }}>
          <p className="section-title">Recomendado pra você</p>
          <div className="grid">
            {recommended.map((al) => (
              <AlbumCard
                key={al.id}
                spotifyId={al.spotify_id}
                coverUrl={al.cover_url}
                name={al.name}
                artistName={al.artists?.name}
              />
            ))}
          </div>
        </section>
      )}

      {trending.length > 0 && (
        <section style={{ marginBottom: 40 }}>
          <p className="section-title">Músicas do momento</p>
          <div className="card">
            {trending.map((t) => (
              <Link
                to={t.track?.albums?.spotify_id ? `/album/${t.track.albums.spotify_id}` : '#'}
                key={t.track_id}
                className="item-row"
              >
                <img src={t.track?.albums?.cover_url || undefined} alt="" className="item-row__cover" />
                <div style={{ flex: 1 }}>
                  <div className="item-row__title">{t.track?.name}</div>
                  <div className="item-row__subtitle">
                    {t.track?.albums?.artists?.name} · {t.recent_rating_count} nota(s) nos últimos 7 dias
                  </div>
                </div>
                <span className="mono" style={{ color: 'var(--accent-strong)' }}>{t.recent_avg_score}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {user && (
        <section style={{ marginBottom: 40 }}>
          <p className="section-title">Atividade de quem você segue</p>
          {loaded && feed.length === 0 && (
            <div className="empty-state">
              <h3>Seu feed está vazio</h3>
              <p>Siga outros usuários para ver as notas e reviews deles aqui.</p>
            </div>
          )}
          {feed.length > 0 && (
            <div className="card">
              {feed.map((r) => (
                <ActivityRow rating={r} key={r.id} />
              ))}
            </div>
          )}
        </section>
      )}

      {topAlbums.length > 0 && (
        <section style={{ marginBottom: 40 }}>
          <p className="section-title">Mais bem avaliados no Musgas</p>
          <div className="grid">
            {topAlbums.map((s) => (
              <AlbumCard
                key={s.album.id}
                spotifyId={s.album.spotify_id}
                coverUrl={s.album.cover_url}
                name={s.album.name}
                artistName={s.album.artists?.name}
                score={s.avg_score}
              />
            ))}
          </div>
        </section>
      )}

      {siteActivity.length > 0 && (
        <section>
          <p className="section-title">Avaliado recentemente por todo mundo</p>
          <div className="card">
            {siteActivity.map((r) => (
              <ActivityRow rating={r} key={r.id} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}