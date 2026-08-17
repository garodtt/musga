import { Link } from 'react-router-dom'

export default function ArtistCard({ spotifyId, imageUrl, name }) {
  return (
    <Link to={`/artista/${spotifyId}`} className="tile">
      <img src={imageUrl || undefined} alt="" className="tile__cover tile__cover--round" loading="lazy" />
      <div className="tile__title" style={{ textAlign: 'center' }}>
        {name}
      </div>
    </Link>
  )
}
