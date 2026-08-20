import { useEffect, useState } from 'react'
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom'
import { GripVertical, ChevronUp, ChevronDown } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import {
  getListById,
  removeItemFromList,
  deleteList,
  updateList,
  updateListItemPositions,
  getCollaborators,
  addCollaboratorByUsername,
  removeCollaborator,
} from '../lib/db'
import { buildListText, downloadListAsImage } from '../lib/exportList'
import ConfirmDialog from '../components/ui/ConfirmDialog'

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
  const [searchParams, setSearchParams] = useSearchParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [list, setList] = useState(null)
  const [notFound, setNotFound] = useState(false)
  const [collaborators, setCollaborators] = useState([])
  const [collabUsername, setCollabUsername] = useState('')
  const [collabError, setCollabError] = useState('')
  const [copyFeedback, setCopyFeedback] = useState('')
  const [shareFeedback, setShareFeedback] = useState('')
  const [editing, setEditing] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editTags, setEditTags] = useState('')
  const [editIsPublic, setEditIsPublic] = useState(true)
  const [editError, setEditError] = useState('')
  const [draggedId, setDraggedId] = useState(null)
  const [dragOverId, setDragOverId] = useState(null)
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  useEffect(() => {
    getListById(listId)
      .then((data) => (data ? setList(data) : setNotFound(true)))
      .catch(() => setNotFound(true))
  }, [listId])

  useEffect(() => {
    if (list) getCollaborators(list.id).then(setCollaborators)
  }, [list?.id])

  // Abre o formulário de edição sozinho quando chega pelo menu rápido do
  // card (/lista/:id?edit=1), sem precisar clicar em "Editar" de novo.
  useEffect(() => {
    if (list && searchParams.get('edit') === '1' && user?.id === list.user_id) {
      openEditForm()
      setSearchParams({}, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list])

  const isOwner = user?.id === list?.user_id
  const isCollaborator = collaborators.some((c) => c.user_id === user?.id)
  const canEdit = isOwner || isCollaborator
  const sortedItems = list ? [...list.list_items].sort((a, b) => a.position - b.position) : []

  async function handleRemoveItem(itemId) {
    await removeItemFromList(itemId)
    setList((prev) => ({ ...prev, list_items: prev.list_items.filter((i) => i.id !== itemId) }))
  }

  async function handleDeleteList() {
    await deleteList(list.id)
    navigate('/listas')
  }

  async function handleAddCollaborator(e) {
    e.preventDefault()
    setCollabError('')
    if (!collabUsername.trim()) return
    try {
      await addCollaboratorByUsername(list.id, collabUsername.trim())
      setCollaborators(await getCollaborators(list.id))
      setCollabUsername('')
    } catch (err) {
      setCollabError(err.message)
    }
  }

  async function handleRemoveCollaborator(userId) {
    await removeCollaborator(list.id, userId)
    setCollaborators((prev) => prev.filter((c) => c.user_id !== userId))
  }

  async function handleLeaveList() {
    await removeCollaborator(list.id, user.id)
    navigate('/listas')
  }

  function handleDrop(targetId) {
    if (!draggedId || draggedId === targetId) {
      setDraggedId(null)
      setDragOverId(null)
      return
    }
    const items = [...sortedItems]
    const fromIndex = items.findIndex((i) => i.id === draggedId)
    const toIndex = items.findIndex((i) => i.id === targetId)
    const [moved] = items.splice(fromIndex, 1)
    items.splice(toIndex, 0, moved)
    const withPositions = items.map((item, idx) => ({ ...item, position: idx }))
    setList((prev) => ({ ...prev, list_items: withPositions }))
    setDraggedId(null)
    setDragOverId(null)
    updateListItemPositions(withPositions.map((i) => ({ id: i.id, position: i.position })))
  }

  /** Move um item pra cima/baixo por botão — o "arrastar" nativo do HTML
   * não funciona em telas de toque, então isso garante reordenar em
   * qualquer aparelho (celular incluso). */
  function moveItem(index, direction) {
    const newIndex = index + direction
    if (newIndex < 0 || newIndex >= sortedItems.length) return
    const items = [...sortedItems]
    const [moved] = items.splice(index, 1)
    items.splice(newIndex, 0, moved)
    const withPositions = items.map((item, idx) => ({ ...item, position: idx }))
    setList((prev) => ({ ...prev, list_items: withPositions }))
    updateListItemPositions(withPositions.map((i) => ({ id: i.id, position: i.position })))
  }

  function handleCopyText() {
    navigator.clipboard.writeText(buildListText(list))
    setCopyFeedback('Copiado!')
    setTimeout(() => setCopyFeedback(''), 1500)
  }

  function handleShareLink() {
    const url = `${window.location.origin}/lista/${list.id}`
    navigator.clipboard.writeText(url)
    setShareFeedback('Link copiado!')
    setTimeout(() => setShareFeedback(''), 1500)
  }

  function openEditForm() {
    setEditTitle(list.title)
    setEditDescription(list.description || '')
    setEditTags((list.tags || []).join(', '))
    setEditIsPublic(list.is_public)
    setEditError('')
    setEditing(true)
  }

  async function handleSaveEdit(e) {
    e.preventDefault()
    if (!editTitle.trim()) return
    const tags = editTags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)
    const updates = {
      title: editTitle.trim(),
      description: editDescription.trim() || null,
      tags,
      is_public: editIsPublic,
    }
    try {
      await updateList(list.id, updates)
      setList((prev) => ({ ...prev, ...updates }))
      setEditing(false)
    } catch (err) {
      setEditError(err.message)
    }
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

  return (
    <div className="page">
      {editing ? (
        <form onSubmit={handleSaveEdit} className="card" style={{ marginBottom: 16 }}>
          <div className="field">
            <label>Título</label>
            <input className="input" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} required />
          </div>
          <div className="field">
            <label>Descrição (opcional)</label>
            <textarea className="input" value={editDescription} onChange={(e) => setEditDescription(e.target.value)} />
          </div>
          <div className="field">
            <label>Tags (separadas por vírgula, opcional)</label>
            <input className="input" value={editTags} onChange={(e) => setEditTags(e.target.value)} />
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, marginBottom: 14 }}>
            <input type="checkbox" checked={editIsPublic} onChange={(e) => setEditIsPublic(e.target.checked)} />
            Lista pública
          </label>
          {editError && <p className="error-text">{editError}</p>}
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="submit" className="btn btn--primary">
              Salvar alterações
            </button>
            <button type="button" className="btn btn--ghost" onClick={() => setEditing(false)}>
              Cancelar
            </button>
          </div>
        </form>
      ) : (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 style={{ fontSize: 26 }}>{list.title}</h1>
            <p style={{ color: 'var(--text-faint)', fontSize: 13.5, marginTop: 4 }}>
              por <Link to={`/perfil/${list.profiles?.username}`}>{list.profiles?.display_name || list.profiles?.username}</Link>
              {!list.is_public && ' · privada'}
            </p>
            {list.description && <p style={{ color: 'var(--text-dim)', marginTop: 10 }}>{list.description}</p>}
            {list.tags?.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 10 }}>
                {list.tags.map((t) => (
                  <span key={t} className="tag-chip">
                    {t}
                  </span>
                ))}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            {isOwner && (
              <button className="btn" onClick={openEditForm}>
                Editar
              </button>
            )}
            {isOwner && (
              <button className="btn btn--danger" onClick={() => setConfirmingDelete(true)}>
                Excluir lista
              </button>
            )}
            {!isOwner && isCollaborator && (
              <button className="btn btn--ghost" onClick={handleLeaveList}>
                Sair da lista
              </button>
            )}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
        <button className="btn btn--sm" onClick={handleShareLink}>
          {shareFeedback || 'Compartilhar link'}
        </button>
        <button className="btn btn--sm" onClick={handleCopyText}>
          {copyFeedback || 'Copiar como texto'}
        </button>
        <button className="btn btn--sm" onClick={() => downloadListAsImage(list)}>
          Baixar como imagem
        </button>
      </div>

      <div className="card" style={{ marginTop: 24 }}>
        {sortedItems.length === 0 && (
          <p style={{ color: 'var(--text-faint)', fontSize: 14 }}>Essa lista ainda não tem itens.</p>
        )}
        {sortedItems.map((item, index) => {
          const { title, subtitle, cover } = itemDisplay(item)
          return (
            <div
              className={`item-row ${canEdit ? 'item-row--draggable' : ''} ${dragOverId === item.id ? 'item-row--drag-over' : ''}`}
              key={item.id}
              draggable={canEdit}
              onDragStart={() => setDraggedId(item.id)}
              onDragOver={(e) => {
                e.preventDefault()
                if (dragOverId !== item.id) setDragOverId(item.id)
              }}
              onDrop={() => handleDrop(item.id)}
            >
              {canEdit && <GripVertical size={16} className="drag-handle" />}
              <Link to={itemHref(item)} style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
                <img
                  src={cover || undefined}
                  alt=""
                  className={`item-row__cover ${item.item_type === 'artist' ? 'item-row__cover--round' : ''}`}
                />
                <div style={{ minWidth: 0 }}>
                  <div className="item-row__title">{title}</div>
                  <div className="item-row__subtitle">{subtitle}</div>
                </div>
              </Link>
              {canEdit && (
                <div className="reorder-buttons">
                  <button
                    type="button"
                    className="reorder-buttons__btn"
                    onClick={() => moveItem(index, -1)}
                    disabled={index === 0}
                    aria-label="Mover pra cima"
                  >
                    <ChevronUp size={14} />
                  </button>
                  <button
                    type="button"
                    className="reorder-buttons__btn"
                    onClick={() => moveItem(index, 1)}
                    disabled={index === sortedItems.length - 1}
                    aria-label="Mover pra baixo"
                  >
                    <ChevronDown size={14} />
                  </button>
                </div>
              )}
              {canEdit && (
                <button className="btn btn--ghost btn--sm" onClick={() => handleRemoveItem(item.id)}>
                  Remover
                </button>
              )}
            </div>
          )
        })}
      </div>

      {isOwner && (
        <div className="card" style={{ marginTop: 24 }}>
          <p className="section-title">Colaboradores</p>
          <p style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 12 }}>
            Pessoas convidadas podem adicionar, remover e reordenar itens desta lista.
          </p>

          {collaborators.map((c) => (
            <div className="collaborator-row" key={c.user_id}>
              <img src={c.profiles?.avatar_url || undefined} alt="" className="collaborator-row__avatar" />
              <span style={{ flex: 1, fontSize: 13.5 }}>{c.profiles?.display_name || c.profiles?.username}</span>
              <button className="btn btn--ghost btn--sm" onClick={() => handleRemoveCollaborator(c.user_id)}>
                Remover
              </button>
            </div>
          ))}

          <form onSubmit={handleAddCollaborator} style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <input
              className="input"
              placeholder="Nome de usuário…"
              value={collabUsername}
              onChange={(e) => setCollabUsername(e.target.value)}
            />
            <button type="submit" className="btn btn--primary btn--sm">
              Convidar
            </button>
          </form>
          {collabError && <p className="error-text">{collabError}</p>}
        </div>
      )}

      {confirmingDelete && (
        <ConfirmDialog
          title="Excluir lista?"
          message="Essa ação não pode ser desfeita."
          confirmLabel="Excluir"
          danger
          onCancel={() => setConfirmingDelete(false)}
          onConfirm={() => {
            setConfirmingDelete(false)
            handleDeleteList()
          }}
        />
      )}
    </div>
  )
}