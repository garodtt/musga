import { Link } from 'react-router-dom'

export default function ListCard({ list }) {
  const count = list.list_items?.length ?? 0
  return (
    <Link to={`/lista/${list.id}`} className="card" style={{ display: 'block' }}>
      <h3 style={{ fontSize: 17 }}>{list.title}</h3>
      {list.description && (
        <p style={{ color: 'var(--text-dim)', fontSize: 13.5, marginTop: 4 }}>{list.description}</p>
      )}
      <p className="mono" style={{ color: 'var(--text-faint)', fontSize: 12.5, marginTop: 10 }}>
        {count} item(ns) {!list.is_public && '· privada'}
      </p>
    </Link>
  )
}
