import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getListById, removeItemFromList, deleteList } from '../lib/db'

function itemHref(item) {
  if (item.item_type === 'track' && item.tracks?.albums) return `/album/${item.tracks.albums.spotify_id || ''}`
  if (item.item_type === 'album' && item.albums) return `/album/${item.albums.spotify_id || ''}`
  if (item.item_type === 'artist' && item.artists) return `/artista/${item.artists.spotify_id || ''}`
  return '#'
}

function itemDisplay(item) {
  if (item.item_type === 'track') {
    return { title: item.tracks?.name, subtitle: item.tracks?.albums?.artists?.name, cover: item.tracks?.albums?.cover_url }
  }
  if (item.item_type === 'album') {
    return { title: item.albums?.name, subtitle: item.albums?.artists?.name, cover: item.albums?.cover_url }
  }
  return { title: item.artists?.name, subtitle: 'Artista', cover: item.artists?.image_url }
}

export default function ListDetailPage() {
  const { listId } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [list, setList] = useState(null)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    getListById(listId)
      .then((data) => (data ? setList(data) : setNotFound(true)))
      .catch(() => setNotFound(true))
  }, [listId])

  async function handleRemoveItem(itemId) {
    await removeItemFromList(itemId)
    setList((prev) => ({ ...prev, list_items: prev.list_items.filter((i) => i.id !== itemId) }))
  }

  async function handleDeleteList() {
    if (!confirm('Excluir esta lista? Essa ação não pode ser desfeita.')) return
    await deleteList(list.id)
    navigate('/listas')
  }

  if (notFound) {
    return (
      <div className="page">
        <div className="empty-state">
          <h3>Lista não encontrada ou privada</h3>
        </div>
      </div>
    )
  }

  if (!list) {
    return (
      <div className="page">
        <p style={{ color: 'var(--text-dim)' }}>Carregando lista…</p>
      </div>
    )
  }

  const isOwner = user?.id === list.user_id

  return (
    <div className="page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: 26 }}>{list.title}</h1>
          <p style={{ color: 'var(--text-faint)', fontSize: 13.5, marginTop: 4 }}>
            por <Link to={`/perfil/${list.profiles?.username}`}>{list.profiles?.display_name || list.profiles?.username}</Link>
            {!list.is_public && ' · privada'}
          </p>
          {list.description && <p style={{ color: 'var(--text-dim)', marginTop: 10 }}>{list.description}</p>}
        </div>
        {isOwner && (
          <button className="btn btn--danger" onClick={handleDeleteList}>
            Excluir lista
          </button>
        )}
      </div>

      <div className="card" style={{ marginTop: 24 }}>
        {list.list_items.length === 0 && (
          <p style={{ color: 'var(--text-faint)', fontSize: 14 }}>Essa lista ainda não tem itens.</p>
        )}
        {list.list_items
          .sort((a, b) => a.position - b.position)
          .map((item) => {
            const { title, subtitle, cover } = itemDisplay(item)
            return (
              <div className="item-row" key={item.id}>
                <Link to={itemHref(item)} style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
                  <img
                    src={cover || undefined}
                    alt=""
                    className={`item-row__cover ${item.item_type === 'artist' ? 'item-row__cover--round' : ''}`}
                  />
                  <div>
                    <div className="item-row__title">{title}</div>
                    <div className="item-row__subtitle">{subtitle}</div>
                  </div>
                </Link>
                {isOwner && (
                  <button className="btn btn--ghost btn--sm" onClick={() => handleRemoveItem(item.id)}>
                    Remover
                  </button>
                )}
              </div>
            )
          })}
      </div>
    </div>
  )
}
