export default function ConfirmDialog({
  title = 'Confirmar ação',
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  danger = false,
  onConfirm,
  onCancel,
}) {
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-card" style={{ maxWidth: 360 }} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ marginBottom: 10 }}>{title}</h3>
        {message && <p style={{ color: 'var(--text-dim)', fontSize: 14, marginBottom: 22 }}>{message}</p>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn--ghost" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button type="button" className={`btn ${danger ? 'btn--danger-solid' : 'btn--primary'}`} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}