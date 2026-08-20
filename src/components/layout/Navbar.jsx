import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useDebounce } from '../../hooks/useDebounce'
import { searchMusic, fetchAlbum } from '../../lib/spotify'
import { rateTrack } from '../../lib/db'
import NotificationsBell from '../notifications/NotificationsBell'
import SignalRating from '../rating/SignalRating'

export default function Navbar() {
  const { user, profile, signOut } = useAuth()
  const [query, setQuery] = useState('')
  const [liveResults, setLiveResults] = useState(null)
  const [loadingLive, setLoadingLive] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [quickRateStatus, setQuickRateStatus] = useState({})
  const debouncedQuery = useDebounce(query, 300)
  const navigate = useNavigate()
  const wrapperRef = useRef(null)
  const mobileSearchInputRef = useRef(null)

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

  // Fecha o dropdown desktop ao clicar fora dele
  useEffect(() => {
    function handleClickOutside(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Trava o scroll do body enquanto a busca mobile em tela cheia está aberta
  useEffect(() => {
    if (mobileSearchOpen) {
      document.body.style.overflow = 'hidden'
      mobileSearchInputRef.current?.focus()
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [mobileSearchOpen])

  function goTo(path) {
    setDropdownOpen(false)
    setMobileSearchOpen(false)
    setMobileMenuOpen(false)
    setQuery('')
    setLiveResults(null)
    navigate(path)
  }

  function handleSearchSubmit(e) {
    e.preventDefault()
    if (query.trim()) goTo(`/buscar?q=${encodeURIComponent(query.trim())}`)
  }

  /** Avalia uma faixa direto no dropdown de busca, sem abrir o álbum.
   * Precisa cachear o álbum primeiro pra existir um id local pra faixa
   * (é rápido se o álbum já tiver sido visitado por alguém antes). */
  async function handleQuickRate(track, score) {
    if (!user) return
    setQuickRateStatus((prev) => ({ ...prev, [track.spotify_id]: 'saving' }))
    try {
      const { tracks } = await fetchAlbum(track.album_spotify_id)
      const localTrack = tracks.find((t) => t.spotify_id === track.spotify_id)
      if (localTrack) await rateTrack(localTrack.id, user.id, score)
      setQuickRateStatus((prev) => ({ ...prev, [track.spotify_id]: 'done' }))
    } catch {
      setQuickRateStatus((prev) => ({ ...prev, [track.spotify_id]: null }))
    }
  }

  const hasLiveResults =
    liveResults &&
    (liveResults.artists.length > 0 || liveResults.albums.length > 0 || liveResults.tracks.length > 0)

  // Lista de resultados compartilhada entre o dropdown desktop e a busca
  // mobile em tela cheia — evita duplicar o markup nos dois lugares.
  function renderResultsList() {
    return (
      <>
        {loadingLive && <p className="search-dropdown__hint">Buscando…</p>}
        {!loadingLive && !hasLiveResults && <p className="search-dropdown__hint">Nada encontrado ainda.</p>}

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
          <div key={t.spotify_id} className="item-row search-dropdown__item">
            <div
              style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0, cursor: 'pointer' }}
              onClick={() => goTo(`/album/${t.album_spotify_id}`)}
            >
              <img src={t.album_cover_url || undefined} alt="" className="item-row__cover" />
              <div style={{ minWidth: 0 }}>
                <div className="item-row__title">{t.name}</div>
                <div className="item-row__subtitle">{t.artist_name} · Faixa</div>
              </div>
            </div>
            {user && (
              <div className="quick-rate" onClick={(e) => e.stopPropagation()}>
                {quickRateStatus[t.spotify_id] === 'done' ? (
                  <span className="mono" style={{ color: 'var(--accent-strong)', fontSize: 12 }}>
                    avaliado ✓
                  </span>
                ) : (
                  <SignalRating value={0} onRate={(score) => handleQuickRate(t, score)} size="sm" />
                )}
              </div>
            )}
          </div>
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
      </>
    )
  }

  return (
    <>
      <header className="navbar">
        {/* ---------- Linha única (desktop) ---------- */}
        <div className="navbar__desktop-row">
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
              <div className="search-dropdown">{renderResultsList()}</div>
            )}
          </div>

          <nav className="navbar__links">
            <NavLink to="/" end>
              Início
            </NavLink>
            {user && <NavLink to="/pessoas">Pessoas</NavLink>}
            {user && <NavLink to="/listas">Minhas listas</NavLink>}
            {user && <NavLink to="/desejos">Ouvir depois</NavLink>}
            {user ? (
              <>
                <NotificationsBell />
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
        </div>

        {/* ---------- Barra superior (mobile) ---------- */}
        <div className="navbar__mobile-row">
          <Link to="/" className="navbar__brand navbar__brand--mobile">
            MUS<span>GAS</span>
          </Link>
          <div className="navbar__mobile-actions">
            {user && <NotificationsBell />}
            <button
              type="button"
              className="navbar__hamburger"
              onClick={() => setMobileMenuOpen((v) => !v)}
              aria-label="Mais opções"
            >
              ☰
            </button>
          </div>
        </div>
      </header>

      {/* ---------- Menu deslizante (mobile) — itens secundários ---------- */}
      {mobileMenuOpen && (
        <div className="mobile-menu-overlay" onClick={() => setMobileMenuOpen(false)}>
          <div className="mobile-menu-panel" onClick={(e) => e.stopPropagation()}>
            <button className="mobile-menu-panel__close" onClick={() => setMobileMenuOpen(false)} aria-label="Fechar">
              ✕
            </button>
            {user && (
              <Link to="/listas" className="mobile-menu-panel__item" onClick={() => setMobileMenuOpen(false)}>
                Minhas listas
              </Link>
            )}
            {user && (
              <Link to="/desejos" className="mobile-menu-panel__item" onClick={() => setMobileMenuOpen(false)}>
                Ouvir depois
              </Link>
            )}
            {!user && (
              <Link to="/pessoas" className="mobile-menu-panel__item" onClick={() => setMobileMenuOpen(false)}>
                Pessoas
              </Link>
            )}
            {user ? (
              <button type="button" className="mobile-menu-panel__item mobile-menu-panel__item--danger" onClick={signOut}>
                Sair
              </button>
            ) : (
              <Link to="/login" className="mobile-menu-panel__item" onClick={() => setMobileMenuOpen(false)}>
                Entrar
              </Link>
            )}
          </div>
        </div>
      )}

      {/* ---------- Busca em tela cheia (mobile) ---------- */}
      {mobileSearchOpen && (
        <div className="mobile-search-overlay">
          <form className="mobile-search-overlay__header" onSubmit={handleSearchSubmit}>
            <input
              ref={mobileSearchInputRef}
              className="input"
              placeholder="Buscar artistas, álbuns, faixas…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={() => {
                setMobileSearchOpen(false)
                setQuery('')
                setLiveResults(null)
              }}
            >
              Cancelar
            </button>
          </form>
          <div className="mobile-search-overlay__results">
            {query.trim().length < 2 ? (
              <p className="search-dropdown__hint">Digite pelo menos 2 letras.</p>
            ) : (
              renderResultsList()
            )}
          </div>
        </div>
      )}

      {/* ---------- Barra inferior fixa (mobile) ---------- */}
      <nav className="mobile-bottom-nav">
        <NavLink to="/" end className="mobile-bottom-nav__item">
          <span className="mobile-bottom-nav__icon">🏠</span>
          <span>Início</span>
        </NavLink>
        <button
          type="button"
          className="mobile-bottom-nav__item"
          onClick={() => setMobileSearchOpen(true)}
        >
          <span className="mobile-bottom-nav__icon">🔍</span>
          <span>Buscar</span>
        </button>
        {user ? (
          <NavLink to="/pessoas" className="mobile-bottom-nav__item">
            <span className="mobile-bottom-nav__icon">👥</span>
            <span>Pessoas</span>
          </NavLink>
        ) : (
          <NavLink to="/login" className="mobile-bottom-nav__item">
            <span className="mobile-bottom-nav__icon">🔑</span>
            <span>Entrar</span>
          </NavLink>
        )}
        {user && (
          <NavLink to={`/perfil/${profile?.username ?? ''}`} className="mobile-bottom-nav__item">
            <span className="mobile-bottom-nav__icon">👤</span>
            <span>Perfil</span>
          </NavLink>
        )}
      </nav>
    </>
  )
}