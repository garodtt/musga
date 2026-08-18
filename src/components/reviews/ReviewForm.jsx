import { useState } from 'react'

export default function ReviewForm({ initialBody = '', onSubmit, onCancel }) {
  const [body, setBody] = useState(initialBody)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    if (!body.trim()) return
    setSaving(true)
    setError('')
    try {
      await onSubmit(body.trim())
      setBody('')
    } catch (err) {
      setError(err.message || 'Não foi possível publicar a review.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ marginTop: 10 }}>
      <textarea
        className="input"
        placeholder="O que você achou dessa faixa?"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        maxLength={2000}
      />
      {error && <p className="error-text">{error}</p>}
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <button type="submit" className="btn btn--primary btn--sm" disabled={saving}>
          {saving ? 'Salvando…' : 'Publicar review'}
        </button>
        {onCancel && (
          <button type="button" className="btn btn--ghost btn--sm" onClick={onCancel}>
            Cancelar
          </button>
        )}
      </div>
    </form>
  )
}