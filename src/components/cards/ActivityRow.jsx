import { Link, useNavigate } from 'react-router-dom'

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

export default function ActivityRow({ rating }) {
  const navigate = useNavigate()
  const albumHref = rating.tracks?.albums?.spotify_id ? `/album/${rating.tracks.albums.spotify_id}` : null

  return (
    <div
      className="item-row"
      role="button"
      tabIndex={0}
      onClick={() => albumHref && navigate(albumHref)}
      onKeyDown={(e) => {
        if (albumHref && (e.key === 'Enter' || e.key === ' ')) navigate(albumHref)
      }}
      style={{ cursor: albumHref ? 'pointer' : 'default' }}
    >
      <img src={rating.tracks?.albums?.cover_url || undefined} alt="" className="item-row__cover" />
      <div style={{ flex: 1 }}>
        <div className="item-row__title">
          <Link to={`/perfil/${rating.profiles?.username}`} onClick={(e) => e.stopPropagation()}>
            {rating.profiles?.display_name || rating.profiles?.username}
          </Link>{' '}
          avaliou {rating.tracks?.name}
        </div>
        <div className="item-row__subtitle">
          {rating.tracks?.albums?.artists?.name} · {rating.tracks?.albums?.name} · {formatDate(rating.created_at)}
        </div>
      </div>
      <span className="mono" style={{ color: 'var(--accent-strong)' }}>
        {rating.score}/5
      </span>
    </div>
  )
}