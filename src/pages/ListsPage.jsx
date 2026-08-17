import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { getListsByUser, createList } from '../lib/db'
import ListCard from '../components/lists/ListCard'

export default function ListsPage() {
  const { user } = useAuth()
  const [lists, setLists] = useState([])
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [isPublic, setIsPublic] = useState(true)
  const [showForm, setShowForm] = useState(false)

  useEffect(() => {
    if (user) getListsByUser(user.id).then(setLists)
  }, [user])

  async function handleCreate(e) {
    e.preventDefault()
    if (!title.trim()) return
    const list = await createList(user.id, title.trim(), description.trim(), isPublic)
    setLists((prev) => [{ ...list, list_items: [] }, ...prev])
    setTitle('')
    setDescription('')
    setShowForm(false)
  }

  return (
    <div className="page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ fontSize: 24 }}>Minhas listas</h1>
        <button className="btn btn--primary" onClick={() => setShowForm((v) => !v)}>
          Nova lista
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="card" style={{ marginBottom: 24 }}>
          <div className="field">
            <label>Título</label>
            <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} required />
          </div>
          <div className="field">
            <label>Descrição (opcional)</label>
            <textarea className="input" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, marginBottom: 14 }}>
            <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} />
            Lista pública
          </label>
          <button type="submit" className="btn btn--primary">
            Criar lista
          </button>
        </form>
      )}

      {lists.length === 0 && !showForm && (
        <div className="empty-state">
          <h3>Nenhuma lista ainda</h3>
          <p>Crie sua primeira lista para organizar faixas, álbuns e artistas.</p>
        </div>
      )}

      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
        {lists.map((l) => (
          <ListCard list={l} key={l.id} />
        ))}
      </div>
    </div>
  )
}
