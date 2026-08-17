import { useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import {
  getListsByUser,
  getListIdsContainingItem,
  addItemToList,
  removeItemFromListByItem,
  createList,
} from '../../lib/db'

export default function AddToListButton({ itemType, itemId }) {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [lists, setLists] = useState([])
  const [listIdsWithItem, setListIdsWithItem] = useState(new Set())
  const [search, setSearch] = useState('')
  const [newTitle, setNewTitle] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open || !user) return
    setLoading(true)
    setError('')
    getListsByUser(user.id)
      .then(async (userLists) => {
        setLists(userLists)
        const ids = await getListIdsContainingItem(
          userLists.map((l) => l.id),
          itemType,
          itemId
        )
        setListIdsWithItem(ids)
      })
      .finally(() => setLoading(false))
  }, [open, user, itemType, itemId])

  if (!user) return null

  async function handleToggle(listId) {
    setError('')
    try {
      if (listIdsWithItem.has(listId)) {
        await removeItemFromListByItem(listId, itemType, itemId)
        setListIdsWithItem((prev) => {
          const next = new Set(prev)
          next.delete(listId)
          return next
        })
      } else {
        await addItemToList(listId, itemType, itemId)
        setListIdsWithItem((prev) => new Set(prev).add(listId))
      }
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleCreateAndAdd(e) {
    e.preventDefault()
    if (!newTitle.trim()) return
    setError('')
    try {
      const list = await createList(user.id, newTitle.trim(), '', true)
      await addItemToList(list.id, itemType, itemId)
      setNewTitle('')
      setLists((prev) => [{ ...list, list_items: [] }, ...prev])
      setListIdsWithItem((prev) => new Set(prev).add(list.id))
    } catch (err) {
      setError(err.message)
    }
  }

  const filteredLists = lists.filter((l) => l.title.toLowerCase().includes(search.toLowerCase()))

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button type="button" className="btn btn--sm" onClick={() => setOpen((v) => !v)}>
        + Lista
      </button>

      {open && (
        <div className="card list-picker" style={{ position: 'absolute', top: '110%', right: 0, zIndex: 30 }}>
          <input
            className="input"
            placeholder="Buscar suas listas…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ marginBottom: 8, fontSize: 13 }}
          />

          {error && <p className="error-text" style={{ marginTop: 0 }}>{error}</p>}
          {loading && <p style={{ fontSize: 13, color: 'var(--text-faint)' }}>Carregando…</p>}

          {!loading && filteredLists.length === 0 && lists.length > 0 && (
            <p style={{ fontSize: 13, color: 'var(--text-faint)' }}>Nenhuma lista com esse nome.</p>
          )}
          {!loading && lists.length === 0 && (
            <p style={{ fontSize: 13, color: 'var(--text-faint)' }}>Você ainda não tem listas.</p>
          )}

          <div className="list-picker__items">
            {filteredLists.map((l) => {
              const inList = listIdsWithItem.has(l.id)
              return (
                <div key={l.id} className="list-picker__row">
                  <span className="list-picker__title">{l.title}</span>
                  <button
                    type="button"
                    className={`btn btn--sm ${inList ? 'btn--danger' : 'btn--primary'}`}
                    onClick={() => handleToggle(l.id)}
                  >
                    {inList ? 'Remover' : 'Adicionar'}
                  </button>
                </div>
              )
            })}
          </div>

          <form onSubmit={handleCreateAndAdd} style={{ marginTop: 10, display: 'flex', gap: 6 }}>
            <input
              className="input"
              placeholder="Nova lista…"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              style={{ fontSize: 13 }}
            />
            <button type="submit" className="btn btn--primary btn--sm">
              Criar
            </button>
          </form>
        </div>
      )}
    </div>
  )
}