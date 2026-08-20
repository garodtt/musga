import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { getListsByUser, createList } from '../lib/db'
import ListCard from '../components/lists/ListCard'

export default function ListsPage() {
  const { user } = useAuth()
  const [lists, setLists] = useState([])
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [tagsInput, setTagsInput] = useState('')
  const [isPublic, setIsPublic] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [activeTag, setActiveTag] = useState(null)

  useEffect(() => {
    if (user) getListsByUser(user.id).then(setLists)
  }, [user])

  const allTags = useMemo(() => {
    const set = new Set()
    lists.forEach((l) => (l.tags || []).forEach((t) => set.add(t)))
    return [...set]
  }, [lists])

  const filteredLists = activeTag ? lists.filter((l) => (l.tags || []).includes(activeTag)) : lists

  async function handleCreate(e) {
    e.preventDefault()
    if (!title.trim()) return
    const tags = tagsInput
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)
    const list = await createList(user.id, title.trim(), description.trim(), isPublic, tags)
    setLists((prev) => [{ ...list, list_items: [] }, ...prev])
    setTitle('')
    setDescription('')
    setTagsInput('')
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
          <div className="field">
            <label>Tags (separadas por vírgula, opcional)</label>
            <input
              className="input"
              placeholder="chill, treino, trabalho…"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
            />
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

      {allTags.length > 0 && (
        <div className="filter-chips">
          {allTags.map((t) => (
            <button
              key={t}
              type="button"
              className={`chip ${activeTag === t ? 'chip--active' : ''}`}
              onClick={() => setActiveTag(activeTag === t ? null : t)}
            >
              {t}
            </button>
          ))}
        </div>
      )}

      {lists.length === 0 && !showForm && (
        <div className="empty-state">
          <h3>Nenhuma lista ainda</h3>
          <p>Crie sua primeira lista para organizar faixas, álbuns e artistas.</p>
        </div>
      )}

      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
        {filteredLists.map((l) => (
          <ListCard
            list={l}
            key={l.id}
            onDeleted={(deletedId) => setLists((prev) => prev.filter((x) => x.id !== deletedId))}
          />
        ))}
      </div>
    </div>
  )
}