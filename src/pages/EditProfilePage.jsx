import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { updateProfile, uploadAvatar } from '../lib/db'
import AvatarCropper from '../components/profile/AvatarCropper'

export default function EditProfilePage() {
  const { profile, user, refreshProfile } = useAuth()
  const navigate = useNavigate()
  const [displayName, setDisplayName] = useState('')
  const [bio, setBio] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [pendingFile, setPendingFile] = useState(null)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name || '')
      setBio(profile.bio || '')
      setAvatarUrl(profile.avatar_url || '')
    }
  }, [profile])

  function handleFileSelect(e) {
    const file = e.target.files?.[0]
    if (file) setPendingFile(file)
    e.target.value = ''
  }

  async function handleCropConfirm(blob) {
    setUploadingAvatar(true)
    setError('')
    try {
      const url = await uploadAvatar(user.id, blob)
      setAvatarUrl(url)
    } catch (err) {
      setError(err.message)
    } finally {
      setUploadingAvatar(false)
      setPendingFile(null)
    }
  }

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
            <label>Foto de perfil</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <img src={avatarUrl || undefined} alt="" className="profile-header__avatar" />
              <label className="btn btn--sm" style={{ cursor: 'pointer' }}>
                {uploadingAvatar ? 'Enviando…' : 'Escolher foto'}
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  style={{ display: 'none' }}
                  disabled={uploadingAvatar}
                />
              </label>
            </div>
          </div>

          <div className="field">
            <label>Nome de exibição</label>
            <input className="input" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          </div>

          <div className="field">
            <label>Bio</label>
            <textarea className="input" value={bio} onChange={(e) => setBio(e.target.value)} maxLength={280} />
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

      {pendingFile && (
        <AvatarCropper file={pendingFile} onCancel={() => setPendingFile(null)} onConfirm={handleCropConfirm} />
      )}
    </div>
  )
}