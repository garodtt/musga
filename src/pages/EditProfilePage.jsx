import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { updateProfile } from '../lib/db'

export default function EditProfilePage() {
  const { profile, user, refreshProfile } = useAuth()
  const navigate = useNavigate()
  const [displayName, setDisplayName] = useState('')
  const [bio, setBio] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name || '')
      setBio(profile.bio || '')
      setAvatarUrl(profile.avatar_url || '')
    }
  }, [profile])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      await updateProfile(user.id, {
        display_name: displayName.trim() || null,
        bio: bio.trim() || null,
        avatar_url: avatarUrl.trim() || null,
      })
      await refreshProfile()
      navigate(`/perfil/${profile.username}`)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (!profile) return null

  return (
    <div className="page page--narrow">
      <div className="card">
        <h1 style={{ fontSize: 22, marginBottom: 20 }}>Editar perfil</h1>

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>Nome de exibição</label>
            <input className="input" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          </div>

          <div className="field">
            <label>Bio</label>
            <textarea className="input" value={bio} onChange={(e) => setBio(e.target.value)} maxLength={280} />
          </div>

          <div className="field">
            <label>URL do avatar</label>
            <input
              className="input"
              placeholder="https://…"
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
            />
            {avatarUrl && <img src={avatarUrl} alt="" className="profile-header__avatar" style={{ marginTop: 10 }} />}
          </div>

          {error && <p className="error-text">{error}</p>}

          <div style={{ display: 'flex', gap: 8 }}>
            <button type="submit" className="btn btn--primary" disabled={saving}>
              {saving ? 'Salvando…' : 'Salvar'}
            </button>
            <button type="button" className="btn btn--ghost" onClick={() => navigate(-1)}>
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}