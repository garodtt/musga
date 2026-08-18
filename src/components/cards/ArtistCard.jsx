import { Link } from 'react-router-dom'

export default function ArtistCard({ spotifyId, imageUrl, name }) {
  const initial = name?.trim()?.[0]?.toUpperCase() || '?'
  return (
    <Link to={`/artista/${spotifyId}`} className="tile">
      {imageUrl ? (
        <img src={imageUrl} alt="" className="tile__cover tile__cover--round" loading="lazy" />
      ) : (
        <div className="tile__cover tile__cover--round tile__cover--fallback" aria-hidden="true">
          {initial}
        </div>
      )}
      <div className="tile__title" style={{ textAlign: 'center' }}>
        {name}
      </div>
    </Link>
  )
}