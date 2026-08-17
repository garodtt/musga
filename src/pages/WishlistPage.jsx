import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getWishlist, removeFromWishlist } from '../lib/db'

function itemHref(item) {
  if (item.item_type === 'track') return item.tracks?.albums?.spotify_id ? `/album/${item.tracks.albums.spotify_id}` : null
  return item.albums?.spotify_id ? `/album/${item.albums.spotify_id}` : null
}

function itemDisplay(item) {
  if (item.item_type === 'track') {
    return {
      title: item.tracks?.name,
      subtitle: `${item.tracks?.albums?.artists?.name || ''} · ${item.tracks?.albums?.name || ''}`,
      cover: item.tracks?.albums?.cover_url,
    }
  }
  return {
    title: item.albums?.name,
    subtitle: item.albums?.artists?.name,
    cover: item.albums?.cover_url,
  }
}

export default function WishlistPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [items, setItems] = useState([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (!user) return
    getWishlist(user.id).then((data) => {
      setItems(data)
      setLoaded(true)
    })
  }, [user])

  async function handleRemove(item) {
    const itemId = item.item_type === 'track' ? item.tracks?.id : item.albums?.id
    await removeFromWishlist(user.id, item.item_type, itemId)
    setItems((prev) => prev.filter((i) => i.id !== item.id))
  }

  return (
    <div className="page">
      <h1 style={{ fontSize: 24, marginBottom: 24 }}>Ouvir depois</h1>

      {loaded && items.length === 0 && (
        <div className="empty-state">
          <h3>Nada salvo ainda</h3>
          <p>Use o botão "Ouvir depois" em qualquer faixa ou álbum para salvar aqui.</p>
        </div>
      )}

      <div className="card">
        {items.map((item) => {
          const { title, subtitle, cover } = itemDisplay(item)
          const href = itemHref(item)
          return (
            <div className="item-row" key={item.id}>
              <div
                style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, cursor: href ? 'pointer' : 'default' }}
                onClick={() => href && navigate(href)}
              >
                <img src={cover || undefined} alt="" className="item-row__cover" />
                <div>
                  <div className="item-row__title">{title}</div>
                  <div className="item-row__subtitle">
                    {subtitle} · {item.item_type === 'track' ? 'Faixa' : 'Álbum'}
                  </div>
                </div>
              </div>
              <button className="btn btn--ghost btn--sm" onClick={() => handleRemove(item)}>
                Remover
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}