import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Sun, Moon } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import {
  getProfileByUsername,
  getFollowCounts,
  isFollowing,
  followUser,
  unfollowUser,
  getRecentRatingsByUser,
  getUserStats,
  getTasteCompatibility,
  getUserRecap,
  getUserRatingDistribution,
  getUserTopArtistsAndAlbums,
  getFollowersList,
  getFollowingListProfiles,
} from '../lib/db'
import { computeBadges } from '../lib/badges'
import { useTheme } from '../hooks/useTheme'
import RatingDistribution from '../components/rating/RatingDistribution'
import FollowListModal from '../components/profile/FollowListModal'

export default function ProfilePage() {
  const { username } = useParams()
  const { user } = useAuth()
  const [theme, setTheme] = useTheme()

  const [profile, setProfile] = useState(null)
  const [counts, setCounts] = useState({ followers: 0, following: 0 })
  const [following, setFollowing] = useState(false)
  const [ratings, setRatings] = useState([])
  const [stats, setStats] = useState(null)
  const [compatibility, setCompatibility] = useState(null)
  const [recap, setRecap] = useState(null)
  const [distribution, setDistribution] = useState([])
  const [topArtistsAlbums, setTopArtistsAlbums] = useState({ topArtists: [], topAlbums: [] })
  const [notFound, setNotFound] = useState(false)
  const [followModal, setFollowModal] = useState(null) // 'followers' | 'following' | null
  const [modalProfiles, setModalProfiles] = useState([])
  const [modalLoading, setModalLoading] = useState(false)

  async function openFollowModal(type) {
    setFollowModal(type)
    setModalLoading(true)
    try {
      const list = type === 'followers' ? await getFollowersList(profile.id) : await getFollowingListProfiles(profile.id)
      setModalProfiles(list)
    } finally {
      setModalLoading(false)
    }
  }

  useEffect(() => {
    setProfile(null)
    setNotFound(false)
    setCompatibility(null)
    setRecap(null)
    getProfileByUsername(username).then(async (p) => {
      if (!p) {
        setNotFound(true)
        return
      }
      setProfile(p)
      const [c, ratingsList, userStats, dist, topLists] = await Promise.all([
        getFollowCounts(p.id),
        getRecentRatingsByUser(p.id),
        getUserStats(p.id),
        getUserRatingDistribution(p.id),
        getUserTopArtistsAndAlbums(p.id, 5),
      ])
      setCounts(c)
      setRatings(ratingsList)
      setStats(userStats)
      setDistribution(dist)
      setTopArtistsAlbums(topLists)
      if (user && user.id === p.id) {
        getUserRecap(p.id).then(setRecap)
      }
      if (user && user.id !== p.id) {
        setFollowing(await isFollowing(user.id, p.id))
        getTasteCompatibility(user.id, p.id).then(setCompatibility)
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
  const hasAnyRating = distribution.some((d) => d.count > 0)

  return (
    <div className="page">
      <div className="profile-header">
        <img src={profile.avatar_url || undefined} alt="" className="profile-header__avatar" />
        <div className="profile-header__info">
          <h1>{profile.display_name || profile.username}</h1>
          <p style={{ color: 'var(--text-faint)', fontSize: 13.5 }}>@{profile.username}</p>
          {profile.bio && <p style={{ color: 'var(--text-dim)', marginTop: 6 }}>{profile.bio}</p>}
          <div className="profile-header__stats">
            <button className="link-button" onClick={() => openFollowModal('followers')}>
              <b className="mono">{counts.followers}</b> seguidores
            </button>
            <button className="link-button" onClick={() => openFollowModal('following')}>
              <b className="mono">{counts.following}</b> seguindo
            </button>
          </div>
        </div>

        {isOwnProfile && (
          <div className="profile-header__actions">
            <button
              type="button"
              className="btn"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
              {theme === 'dark' ? 'Tema claro' : 'Tema escuro'}
            </button>
            <Link to="/perfil/editar" className="btn">
              Editar perfil
            </Link>
          </div>
        )}
        {!isOwnProfile && user && (
          <div className="profile-header__actions">
            <button className={`btn ${following ? '' : 'btn--primary'}`} onClick={toggleFollow}>
              {following ? 'Deixar de seguir' : 'Seguir'}
            </button>
          </div>
        )}
      </div>

      {!isOwnProfile && compatibility && compatibility.commonCount >= 3 && (
        <div className="card" style={{ marginBottom: 28 }}>
          <p className="section-title" style={{ marginBottom: 6 }}>Compatibilidade musical</p>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
            <span className="mono" style={{ fontSize: 26, color: 'var(--accent-strong)' }}>
              {compatibility.pct}%
            </span>
            <span style={{ fontSize: 13, color: 'var(--text-dim)' }}>
              de acordo em {compatibility.commonCount} faixa(s) avaliadas por ambos
            </span>
          </div>
        </div>
      )}

      {stats && (
        <>
          {recap && (
            <div className="stats-grid" style={{ marginBottom: 12 }}>
              <div className="stat-card">
                <div className="stat-card__value">{recap.week.count}</div>
                <div className="stat-card__label">faixas nesta semana{recap.week.avg != null ? ` · média ${recap.week.avg}` : ''}</div>
              </div>
              <div className="stat-card">
                <div className="stat-card__value">{recap.month.count}</div>
                <div className="stat-card__label">faixas neste mês{recap.month.avg != null ? ` · média ${recap.month.avg}` : ''}</div>
              </div>
            </div>
          )}

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
            <p style={{ color: 'var(--text-dim)', fontSize: 13.5, marginTop: 12, marginBottom: 24 }}>
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

          {hasAnyRating && (
            <div className="card" style={{ marginBottom: 36 }}>
              <p className="section-title">Distribuição das notas dadas</p>
              <RatingDistribution distribution={distribution} />
            </div>
          )}

          {(topArtistsAlbums.topArtists.length > 0 || topArtistsAlbums.topAlbums.length > 0) && (
            <div className="top-artists-albums-grid" style={{ marginBottom: 36 }}>
              {topArtistsAlbums.topArtists.length > 0 && (
                <div className="card">
                  <p className="section-title">Top artistas</p>
                  {topArtistsAlbums.topArtists.map((a, i) => (
                    <div key={a.name} className="item-row">
                      <span className="mono" style={{ color: 'var(--text-faint)', width: 20 }}>
                        {i + 1}
                      </span>
                      <span style={{ flex: 1, fontSize: 14 }}>{a.name}</span>
                      <span className="mono" style={{ color: 'var(--text-faint)', fontSize: 12.5 }}>
                        {a.count} faixa(s)
                      </span>
                    </div>
                  ))}
                </div>
              )}
              {topArtistsAlbums.topAlbums.length > 0 && (
                <div className="card">
                  <p className="section-title">Top álbuns</p>
                  {topArtistsAlbums.topAlbums.map((a, i) => (
                    <div key={a.album?.spotify_id} className="item-row">
                      <span className="mono" style={{ color: 'var(--text-faint)', width: 20 }}>
                        {i + 1}
                      </span>
                      <img src={a.album?.cover_url || undefined} alt="" className="item-row__cover" />
                      <span style={{ flex: 1, fontSize: 14 }}>{a.album?.name}</span>
                      <span className="mono" style={{ color: 'var(--text-faint)', fontSize: 12.5 }}>
                        {a.count} faixa(s)
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
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

      {followModal && (
        <FollowListModal
          title={followModal === 'followers' ? 'Seguidores' : 'Seguindo'}
          profiles={modalProfiles}
          loading={modalLoading}
          onClose={() => setFollowModal(null)}
        />
      )}
    </div>
  )
}