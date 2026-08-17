import { Link } from 'react-router-dom'

export default function AlbumCard({ spotifyId, coverUrl, name, artistName, score }) {
  return (
    <Link to={`/album/${spotifyId}`} className="tile">
      <div style={{ position: 'relative' }}>
        <img src={coverUrl || undefined} alt="" className="tile__cover" loading="lazy" />
        {score != null && <span className="tile__score-badge mono">{score}</span>}
      </div>
      <div className="tile__title">{name}</div>
      <div className="tile__subtitle">{artistName}</div>
    </Link>
  )
}