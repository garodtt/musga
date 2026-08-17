import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useDebounce } from '../../hooks/useDebounce'
import { searchMusic } from '../../lib/spotify'

export default function Navbar() {
  const { user, profile, signOut } = useAuth()
  const [query, setQuery] = useState('')
  const [liveResults, setLiveResults] = useState(null)
  const [loadingLive, setLoadingLive] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const debouncedQuery = useDebounce(query, 300)
  const navigate = useNavigate()
  const wrapperRef = useRef(null)

  useEffect(() => {
    const term = debouncedQuery.trim()
    if (term.length < 2) {
      setLiveResults(null)
      return
    }
    let cancelled = false
    setLoadingLive(true)
    searchMusic(term)
      .then((data) => {
        if (!cancelled) setLiveResults(data)
      })
      .catch(() => {
        if (!cancelled) setLiveResults(null)
      })
      .finally(() => {
        if (!cancelled) setLoadingLive(false)
      })
    return () => {
      cancelled = true
    }
  }, [debouncedQuery])

  // Fecha o dropdown ao clicar fora dele
  useEffect(() => {
    function handleClickOutside(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function goTo(path) {
    setDropdownOpen(false)
    setQuery('')
    setLiveResults(null)
    navigate(path)
  }

  function handleSearchSubmit(e) {
    e.preventDefault()
    if (query.trim()) goTo(`/buscar?q=${encodeURIComponent(query.trim())}`)
  }

  const hasLiveResults =
    liveResults &&
    (liveResults.artists.length > 0 || liveResults.albums.length > 0 || liveResults.tracks.length > 0)

  return (
    <header className="navbar">
      <Link to="/" className="navbar__brand">
        MUS<span>GAS</span>
      </Link>

      <div className="navbar__search" ref={wrapperRef} style={{ position: 'relative' }}>
        <form onSubmit={handleSearchSubmit}>
          <input
            className="input"
            placeholder="Buscar artistas, álbuns, faixas…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setDropdownOpen(true)
            }}
            onFocus={() => setDropdownOpen(true)}
          />
        </form>

        {dropdownOpen && query.trim().length >= 2 && (
          <div className="search-dropdown">
            {loadingLive && <p className="search-dropdown__hint">Buscando…</p>}

            {!loadingLive && !hasLiveResults && (
              <p className="search-dropdown__hint">Nada encontrado ainda.</p>
            )}

            {liveResults?.artists.slice(0, 3).map((a) => (
              <button
                key={a.spotify_id}
                type="button"
                className="item-row search-dropdown__item"
                onClick={() => goTo(`/artista/${a.spotify_id}`)}
              >
                <img src={a.image_url || undefined} alt="" className="item-row__cover item-row__cover--round" />
                <div>
                  <div className="item-row__title">{a.name}</div>
                  <div className="item-row__subtitle">Artista</div>
                </div>
              </button>
            ))}

            {liveResults?.albums.slice(0, 3).map((al) => (
              <button
                key={al.spotify_id}
                type="button"
                className="item-row search-dropdown__item"
                onClick={() => goTo(`/album/${al.spotify_id}`)}
              >
                <img src={al.cover_url || undefined} alt="" className="item-row__cover" />
                <div>
                  <div className="item-row__title">{al.name}</div>
                  <div className="item-row__subtitle">{al.artist_name} · Álbum</div>
                </div>
              </button>
            ))}

            {liveResults?.tracks.slice(0, 4).map((t) => (
              <button
                key={t.spotify_id}
                type="button"
                className="item-row search-dropdown__item"
                onClick={() => goTo(`/album/${t.album_spotify_id}`)}
              >
                <img src={t.album_cover_url || undefined} alt="" className="item-row__cover" />
                <div>
                  <div className="item-row__title">{t.name}</div>
                  <div className="item-row__subtitle">{t.artist_name} · Faixa</div>
                </div>
              </button>
            ))}

            {hasLiveResults && (
              <button
                type="button"
                className="btn btn--ghost btn--sm btn--block search-dropdown__seeall"
                onClick={() => goTo(`/buscar?q=${encodeURIComponent(query.trim())}`)}
              >
                Ver todos os resultados
              </button>
            )}
          </div>
        )}
      </div>

      <nav className="navbar__links">
        <NavLink to="/" end>
          Início
        </NavLink>
        {user && <NavLink to="/listas">Minhas listas</NavLink>}
        {user && <NavLink to="/desejos">Ouvir depois</NavLink>}
        {user ? (
          <>
            <NavLink to={`/perfil/${profile?.username ?? ''}`}>Perfil</NavLink>
            <button className="btn btn--ghost btn--sm" onClick={signOut}>
              Sair
            </button>
          </>
        ) : (
          <Link to="/login" className="btn btn--primary btn--sm">
            Entrar
          </Link>
        )}
      </nav>
    </header>
  )
}