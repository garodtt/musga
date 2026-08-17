import ReviewItem from './ReviewItem'

export default function ReviewList({ reviews }) {
  if (reviews.length === 0) {
    return (
      <p style={{ color: 'var(--text-faint)', fontSize: 14, padding: '10px 0' }}>
        Nenhuma review ainda. Seja o primeiro.
      </p>
    )
  }

  return (
    <div>
      {reviews.map((r) => (
        <ReviewItem review={r} key={r.id} />
      ))}
    </div>
  )
}