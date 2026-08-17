import { Link } from 'react-router-dom'

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function ReviewList({ reviews }) {
  if (reviews.length === 0) {
    return <p style={{ color: 'var(--text-faint)', fontSize: 14, padding: '10px 0' }}>Nenhuma review ainda. Seja o primeiro.</p>
  }

  return (
    <div>
      {reviews.map((r) => (
        <div className="review" key={r.id}>
          <img src={r.profiles?.avatar_url || undefined} alt="" className="review__avatar" />
          <div>
            <span className="review__author">
              <Link to={`/perfil/${r.profiles?.username}`}>
                {r.profiles?.display_name || r.profiles?.username}
              </Link>
            </span>
            <span className="review__date">{formatDate(r.created_at)}</span>
            <div className="review__body">{r.body}</div>
          </div>
        </div>
      ))}
    </div>
  )
}
