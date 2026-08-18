import { useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { isInWishlist, addToWishlist, removeFromWishlist } from '../../lib/db'

export default function WishlistButton({ itemType, itemId }) {
  const { user } = useAuth()
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!user) return
    isInWishlist(user.id, itemType, itemId)
      .then(setSaved)
      .catch((err) => console.error('Falha ao checar lista de desejos:', err.message))
  }, [user, itemType, itemId])

  if (!user) return null

  async function toggle() {
    setBusy(true)
    try {
      if (saved) {
        await removeFromWishlist(user.id, itemType, itemId)
        setSaved(false)
      } else {
        await addToWishlist(user.id, itemType, itemId)
        setSaved(true)
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      type="button"
      className={`btn btn--sm ${saved ? 'btn--wishlist-saved' : ''}`}
      onClick={toggle}
      disabled={busy}
      title={saved ? 'Remover de ouvir depois' : 'Salvar para ouvir depois'}
    >
      {saved ? '♥ Salvo' : '♡ Ouvir depois'}
    </button>
  )
}