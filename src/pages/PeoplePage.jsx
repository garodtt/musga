import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useDebounce } from '../hooks/useDebounce'
import { searchProfiles, getSuggestedProfiles, getFollowingIds, followUser, unfollowUser } from '../lib/db'

export default function PeoplePage() {
  const { user, profile } = useAuth()
  const [query, setQuery] = useState('')
  const debouncedQuery = useDebounce(query, 300)
  const [results, setResults] = useState([])
  const [followingIds, setFollowingIds] = useState(new Set())
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (user) getFollowingIds(user.id).then(setFollowingIds)
  }, [user])

  useEffect(() => {
    setLoaded(false)
    const loader = debouncedQuery.trim()
      ? searchProfiles(debouncedQuery, user?.id)
      : getSuggestedProfiles(user?.id, 15)
    loader.then((data) => {
      setResults(data)
      setLoaded(true)
    })
  }, [debouncedQuery, user])

  async function toggleFollow(targetId) {
    if (!user) return
    if (followingIds.has(targetId)) {
      await unfollowUser(user.id, targetId)
      setFollowingIds((prev) => {
        const next = new Set(prev)
        next.delete(targetId)
        return next
      })
    } else {
      await followUser(user.id, targetId)
      setFollowingIds((prev) => new Set(prev).add(targetId))
    }
  }

  return (
    <div className="page">
      <h1 style={{ fontSize: 24, marginBottom: 6 }}>Pessoas</h1>
      <p style={{ color: 'var(--text-dim)', fontSize: 14, marginBottom: 20 }}>
        Encontre outros usuários pelo nome ou usuário, ou veja sugestões de quem está mais ativo.
      </p>

      <input
        className="input"
        placeholder="Buscar por nome ou usuário…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        style={{ marginBottom: 24 }}
      />

      <p className="section-title">{query.trim() ? 'Resultados' : 'Sugestões de quem seguir'}</p>

      {loaded && results.length === 0 && (
        <div className="empty-state">
          <h3>{query.trim() ? 'Ninguém encontrado' : 'Nenhuma sugestão por enquanto'}</h3>
        </div>
      )}

      <div className="card">
        {results
          .filter((p) => p.id !== profile?.id)
          .map((p) => (
            <div className="item-row" key={p.id}>
              <Link to={`/perfil/${p.username}`} style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
                <img src={p.avatar_url || undefined} alt="" className="item-row__cover item-row__cover--round" />
                <div>
                  <div className="item-row__title">{p.display_name || p.username}</div>
                  <div className="item-row__subtitle">@{p.username}</div>
                </div>
              </Link>
              {user && (
                <button
                  className={`btn btn--sm ${followingIds.has(p.id) ? '' : 'btn--primary'}`}
                  onClick={() => toggleFollow(p.id)}
                >
                  {followingIds.has(p.id) ? 'Deixar de seguir' : 'Seguir'}
                </button>
              )}
            </div>
          ))}
      </div>
    </div>
  )
}