import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Signup() {
  const { signUpWithEmail, signInWithGoogle } = useAuth()
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await signUpWithEmail(email, password, username)
      setDone(true)
    } catch (err) {
      setError(err.message || 'Não foi possível criar a conta.')
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <div className="page page--narrow">
        <div className="card auth-card">
          <h1>Confira seu e-mail</h1>
          <p className="auth-card__subtitle">
            Enviamos um link de confirmação para {email}. Depois de confirmar, já pode entrar.
          </p>
          <button className="btn btn--primary btn--block" onClick={() => navigate('/login')}>
            Ir para o login
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="page page--narrow">
      <div className="card auth-card">
        <h1>Criar conta</h1>
        <p className="auth-card__subtitle">Monte seu catálogo pessoal de música.</p>

        <button type="button" className="btn btn--block" onClick={signInWithGoogle}>
          Continuar com Google
        </button>

        <div className="auth-divider">ou</div>

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>Nome de usuário</label>
            <input
              className="input"
              required
              minLength={3}
              value={username}
              onChange={(e) => setUsername(e.target.value.trim())}
            />
          </div>
          <div className="field">
            <label>E-mail</label>
            <input
              className="input"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="field">
            <label>Senha</label>
            <input
              className="input"
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {error && <p className="error-text">{error}</p>}

          <button type="submit" className="btn btn--primary btn--block" disabled={loading}>
            {loading ? 'Criando…' : 'Criar conta'}
          </button>
        </form>

        <p className="auth-switch">
          Já tem conta? <Link to="/login">Entrar</Link>
        </p>
      </div>
    </div>
  )
}
