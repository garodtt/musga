import { ChevronUp, ChevronDown } from 'lucide-react'
import SignalRating from '../rating/SignalRating'
import AddToListButton from '../lists/AddToListButton'
import WishlistButton from '../lists/WishlistButton'

function formatDuration(ms) {
  if (!ms) return '--:--'
  const totalSeconds = Math.round(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

export default function TrackRow({
  track,
  myScore,
  stats,
  onRate,
  onToggleReviews,
  reviewsOpen,
  reviewCount,
}) {
  return (
    <div className="track-row">
      <div className="track-row__main">
        <span className="track-row__number mono">{track.track_number}</span>

        <div className="track-row__name">
          <div className="track-row__name-text">{track.name}</div>
          <div className="track-row__stats mono">
            {stats?.avg_score ? `${stats.avg_score} · ${stats.rating_count} nota(s)` : 'sem notas ainda'}
          </div>
        </div>
      </div>

      <div className="track-row__actions">
        <button
          type="button"
          className="btn btn--ghost btn--sm"
          onClick={onToggleReviews}
          title="Ver reviews desta faixa"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
        >
          {reviewCount > 0 ? `${reviewCount} review(s)` : 'review'}
          {reviewsOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>

        <SignalRating value={myScore} onRate={onRate} />

        <AddToListButton itemType="track" itemId={track.id} />

        <WishlistButton itemType="track" itemId={track.id} />

        <span className="track-row__duration">{formatDuration(track.duration_ms)}</span>
      </div>
    </div>
  )
}