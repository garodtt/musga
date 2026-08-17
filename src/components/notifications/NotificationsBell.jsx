import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { getNotifications, getUnreadNotificationCount, markNotificationsRead } from '../../lib/db'

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

function describeNotification(n) {
  const actorName = n.actor?.display_name || n.actor?.username || 'Alguém'
  const trackName = n.reviews?.tracks?.name
  if (n.type === 'follow') return `${actorName} começou a seguir você`
  if (n.type === 'review_like') return `${actorName} curtiu sua review de "${trackName}"`
  if (n.type === 'review_comment') return `${actorName} comentou na sua review de "${trackName}"`
  return 'Nova notificação'
}

function notificationHref(n) {
  if (n.type === 'follow') return n.actor?.username ? `/perfil/${n.actor.username}` : null
  const spotifyId = n.reviews?.tracks?.albums?.spotify_id
  return spotifyId ? `/album/${spotifyId}` : null
}

export default function NotificationsBell() {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState([])
  const [unread, setUnread] = useState(0)
  const wrapperRef = useRef(null)
  const navigate = useNavigate()

  useEffect(() => {
    if (!user) return
    getUnreadNotificationCount(user.id).then(setUnread)
    const interval = setInterval(() => {
      getUnreadNotificationCount(user.id).then(setUnread)
    }, 30000)
    return () => clearInterval(interval)
  }, [user])

  useEffect(() => {
    function handleClickOutside(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  async function handleToggle() {
    const opening = !open
    setOpen(opening)
    if (opening && user) {
      const data = await getNotifications(user.id)
      setItems(data)
      if (unread > 0) {
        await markNotificationsRead(user.id)
        setUnread(0)
      }
    }
  }

  if (!user) return null

  return (
    <div style={{ position: 'relative' }} ref={wrapperRef}>
      <button type="button" className="notif-bell" onClick={handleToggle} title="Notificações">
        🔔
        {unread > 0 && <span className="notif-bell__badge">{unread > 9 ? '9+' : unread}</span>}
      </button>

      {open && (
        <div className="card search-dropdown notif-dropdown">
          {items.length === 0 && <p className="search-dropdown__hint">Nenhuma notificação ainda.</p>}
          {items.map((n) => {
            const href = notificationHref(n)
            return (
              <button
                key={n.id}
                type="button"
                className="item-row search-dropdown__item"
                onClick={() => {
                  setOpen(false)
                  if (href) navigate(href)
                }}
              >
                <img src={n.actor?.avatar_url || undefined} alt="" className="item-row__cover item-row__cover--round" />
                <div>
                  <div className="item-row__title" style={{ whiteSpace: 'normal' }}>
                    {describeNotification(n)}
                  </div>
                  <div className="item-row__subtitle">{formatDate(n.created_at)}</div>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}