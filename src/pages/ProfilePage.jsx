import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  getProfileByUsername,
  getFollowCounts,
  isFollowing,
  followUser,
  unfollowUser,
  getRecentRatingsByUser,
  getUserStats,
} from '../lib/db'
import { computeBadges } from '../lib/badges'

export default function ProfilePage() {
  const { username } = useParams()
  const { user } = useAuth()

  const [profile, setProfile] = useState(null)
  const [counts, setCounts] = useState({ followers: 0, following: 0 })
  const [following, setFollowing] = useState(false)
  const [ratings, setRatings] = useState([])
  const [stats, setStats] = useState(null)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    setProfile(null)
    setNotFound(false)
    getProfileByUsername(username).then(async (p) => {
      if (!p) {
        setNotFound(true)
        return
      }
      setProfile(p)
      const [c, ratingsList, userStats] = await Promise.all([
        getFollowCounts(p.id),
        getRecentRatingsByUser(p.id),
        getUserStats(p.id),
      ])
      setCounts(c)
      setRatings(ratingsList)
      setStats(userStats)
      if (user && user.id !== p.id) {
        setFollowing(await isFollowing(user.id, p.id))
      }
    })
  }, [username, user])

  async function toggleFollow() {
    if (!user) return
    if (following) {
      await unfollowUser(user.id, profile.id)
      setFollowing(false)
      setCounts((c) => ({ ...c, followers: c.followers - 1 }))
    } else {
      await followUser(user.id, profile.id)
      setFollowing(true)
      setCounts((c) => ({ ...c, followers: c.followers + 1 }))
    }
  }

  if (notFound) {
    return (
      <div className="page">
        <div className="empty-state">
          <h3>Usuário não encontrado</h3>
        </div>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="page">
        <p style={{ color: 'var(--text-dim)' }}>Carregando perfil…</p>
      </div>
    )
  }

  const isOwnProfile = user?.id === profile.id
  const badges = stats ? computeBadges(stats) : []

  return (
    <div className="page">
      <div className="profile-header">
        <img src={profile.avatar_url || undefined} alt="" className="profile-header__avatar" />
        <div>
          <h1>{profile.display_name || profile.username}</h1>
          <p style={{ color: 'var(--text-faint)', fontSize: 13.5 }}>@{profile.username}</p>
          {profile.bio && <p style={{ color: 'var(--text-dim)', marginTop: 6 }}>{profile.bio}</p>}
          <div className="profile-header__stats">
            <span>
              <b className="mono">{counts.followers}</b> seguidores
            </span>
            <span>
              <b className="mono">{counts.following}</b> seguindo
            </span>
          </div>
        </div>

        {!isOwnProfile && user && (
          <button className={`btn ${following ? '' : 'btn--primary'}`} onClick={toggleFollow} style={{ marginLeft: 'auto' }}>
            {following ? 'Deixar de seguir' : 'Seguir'}
          </button>
        )}
      </div>

      {stats && (
        <>
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-card__value">{stats.ratingsCount}</div>
              <div className="stat-card__label">faixas avaliadas</div>
            </div>
            <div className="stat-card">
              <div className="stat-card__value">{stats.reviewsCount}</div>
              <div className="stat-card__label">reviews</div>
            </div>
            <div className="stat-card">
              <div className="stat-card__value">{stats.listsCount}</div>
              <div className="stat-card__label">listas</div>
            </div>
            <div className="stat-card">
              <div className="stat-card__value">{stats.avgScore ?? '—'}</div>
              <div className="stat-card__label">nota média dada</div>
            </div>
            <div className="stat-card">
              <div className="stat-card__value">{stats.distinctArtists}</div>
              <div className="stat-card__label">artistas diferentes</div>
            </div>
          </div>

          {stats.topArtist && (
            <p style={{ color: 'var(--text-dim)', fontSize: 13.5, marginBottom: 24 }}>
              Artista mais avaliado: <b style={{ color: 'var(--text)' }}>{stats.topArtist.name}</b> (
              {stats.topArtist.count} faixa(s))
            </p>
          )}

          <p className="section-title">Selos</p>
          <div className="badges-grid" style={{ marginBottom: 36 }}>
            {badges.map((b) => (
              <span
                key={b.id}
                className={`badge-pill ${b.unlocked ? 'badge-pill--unlocked' : 'badge-pill--locked'}`}
                title={b.description}
              >
                <span className="badge-pill__dot" />
                {b.label}
              </span>
            ))}
          </div>
        </>
      )}

      <p className="section-title">Avaliações recentes</p>
      {ratings.length === 0 && (
        <div className="empty-state">
          <h3>Nenhuma avaliação ainda</h3>
        </div>
      )}
      <div className="card">
        {ratings.map((r) => (
          <Link
            to={r.tracks?.albums?.spotify_id ? `/album/${r.tracks.albums.spotify_id}` : '#'}
            key={r.id}
            className="item-row"
          >
            <img src={r.tracks?.albums?.cover_url || undefined} alt="" className="item-row__cover" />
            <div style={{ flex: 1 }}>
              <div className="item-row__title">{r.tracks?.name}</div>
              <div className="item-row__subtitle">
                {r.tracks?.albums?.artists?.name} · {r.tracks?.albums?.name}
              </div>
            </div>
            <span className="mono" style={{ color: 'var(--accent-strong)' }}>{r.score}/5</span>
          </Link>
        ))}
      </div>
    </div>
  )
}