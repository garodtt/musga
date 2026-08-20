import { Link } from 'react-router-dom'
import { X } from 'lucide-react'

export default function FollowListModal({ title, profiles, loading, onClose }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h3>{title}</h3>
          <button className="btn btn--ghost btn--sm" onClick={onClose} aria-label="Fechar">
            <X size={16} />
          </button>
        </div>

        {loading && <p style={{ color: 'var(--text-dim)', fontSize: 14 }}>Carregando…</p>}
        {!loading && profiles.length === 0 && (
          <p style={{ color: 'var(--text-faint)', fontSize: 14 }}>Ninguém por aqui ainda.</p>
        )}

        <div className="follow-modal__list">
          {profiles.map((p) => (
            <Link to={`/perfil/${p.username}`} key={p.id} className="item-row" onClick={onClose}>
              <img src={p.avatar_url || undefined} alt="" className="item-row__cover item-row__cover--round" />
              <div>
                <div className="item-row__title">{p.display_name || p.username}</div>
                <div className="item-row__subtitle">@{p.username}</div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}