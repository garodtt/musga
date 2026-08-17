import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { getReviewLikesInfo, likeReview, unlikeReview, getCommentsForReview, addReviewComment } from '../../lib/db'

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function ReviewItem({ review }) {
  const { user } = useAuth()
  const [likeInfo, setLikeInfo] = useState({ count: 0, likedByMe: false })
  const [commentsOpen, setCommentsOpen] = useState(false)
  const [comments, setComments] = useState(null)
  const [commentBody, setCommentBody] = useState('')

  useEffect(() => {
    getReviewLikesInfo([review.id], user?.id).then((info) => setLikeInfo(info[review.id]))
  }, [review.id, user?.id])

  async function toggleLike() {
    if (!user) return
    if (likeInfo.likedByMe) {
      await unlikeReview(review.id, user.id)
      setLikeInfo((prev) => ({ count: Math.max(0, prev.count - 1), likedByMe: false }))
    } else {
      await likeReview(review.id, user.id)
      setLikeInfo((prev) => ({ count: prev.count + 1, likedByMe: true }))
    }
  }

  async function toggleComments() {
    const opening = !commentsOpen
    setCommentsOpen(opening)
    if (opening && !comments) {
      const data = await getCommentsForReview(review.id)
      setComments(data)
    }
  }

  async function handleSubmitComment(e) {
    e.preventDefault()
    if (!commentBody.trim() || !user) return
    await addReviewComment(review.id, user.id, commentBody.trim())
    setCommentBody('')
    setComments(await getCommentsForReview(review.id))
  }

  return (
    <div className="review">
      <img src={review.profiles?.avatar_url || undefined} alt="" className="review__avatar" />
      <div style={{ flex: 1, minWidth: 0 }}>
        <span className="review__author">
          <Link to={`/perfil/${review.profiles?.username}`}>
            {review.profiles?.display_name || review.profiles?.username}
          </Link>
        </span>
        <span className="review__date">{formatDate(review.created_at)}</span>
        <div className="review__body">{review.body}</div>

        <div className="review__actions">
          <button
            type="button"
            className={`review__action ${likeInfo.likedByMe ? 'review__action--active' : ''}`}
            onClick={toggleLike}
            disabled={!user}
          >
            ♥ {likeInfo.count > 0 ? likeInfo.count : ''}
          </button>
          <button type="button" className="review__action" onClick={toggleComments}>
            💬 {comments?.length > 0 ? comments.length : ''} {commentsOpen ? 'ocultar' : 'comentários'}
          </button>
        </div>

        {commentsOpen && (
          <div className="review__comments">
            {(comments || []).map((c) => (
              <div key={c.id} className="review__comment">
                <b>
                  <Link to={`/perfil/${c.profiles?.username}`}>{c.profiles?.display_name || c.profiles?.username}</Link>
                </b>{' '}
                {c.body}
              </div>
            ))}
            {user && (
              <form onSubmit={handleSubmitComment} className="review__comment-form">
                <input
                  className="input"
                  placeholder="Escreva um comentário…"
                  value={commentBody}
                  onChange={(e) => setCommentBody(e.target.value)}
                  maxLength={1000}
                />
                <button type="submit" className="btn btn--sm btn--primary">
                  Enviar
                </button>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  )
}