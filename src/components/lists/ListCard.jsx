import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { deleteList } from '../../lib/db'

export default function ListCard({ list, onDeleted }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const [shareFeedback, setShareFeedback] = useState('')
  const menuRef = useRef(null)

  const isOwner = user?.id === list.user_id
  const count = list.list_items?.length ?? 0

  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function handleShare(e) {
    e.preventDefault()
    e.stopPropagation()
    navigator.clipboard.writeText(`${window.location.origin}/lista/${list.id}`)
    setShareFeedback('Link copiado!')
    setTimeout(() => {
      setShareFeedback('')
      setMenuOpen(false)
    }, 1200)
  }

  function handleEdit(e) {
    e.preventDefault()
    e.stopPropagation()
    setMenuOpen(false)
    navigate(`/lista/${list.id}?edit=1`)
  }

  async function handleDelete(e) {
    e.preventDefault()
    e.stopPropagation()
    if (!confirm('Excluir esta lista? Essa ação não pode ser desfeita.')) return
    await deleteList(list.id)
    setMenuOpen(false)
    onDeleted?.(list.id)
  }

  return (
    <div className="card list-card">
      <div className="list-card__menu-wrap" ref={menuRef}>
        <button
          type="button"
          className="list-card__menu-btn"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            setMenuOpen((v) => !v)
          }}
          aria-label="Mais opções"
        >
          ⋮
        </button>

        {menuOpen && (
          <div className="list-card__menu" onClick={(e) => e.stopPropagation()}>
            {isOwner && (
              <button type="button" className="list-card__menu-item" onClick={handleEdit}>
                Editar
              </button>
            )}
            <button type="button" className="list-card__menu-item" onClick={handleShare}>
              {shareFeedback || 'Compartilhar'}
            </button>
            {isOwner && (
              <button
                type="button"
                className="list-card__menu-item list-card__menu-item--danger"
                onClick={handleDelete}
              >
                Excluir
              </button>
            )}
          </div>
        )}
      </div>

      <Link to={`/lista/${list.id}`} className="list-card__link">
        <h3 style={{ fontSize: 17, paddingRight: 22 }}>{list.title}</h3>
        {list.description && (
          <p style={{ color: 'var(--text-dim)', fontSize: 13.5, marginTop: 4 }}>{list.description}</p>
        )}
        {list.tags?.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
            {list.tags.map((t) => (
              <span key={t} className="tag-chip">
                {t}
              </span>
            ))}
          </div>
        )}
        <p className="mono" style={{ color: 'var(--text-faint)', fontSize: 12.5, marginTop: 10 }}>
          {count} item(ns) {!list.is_public && '· privada'}
        </p>
      </Link>
    </div>
  )
}