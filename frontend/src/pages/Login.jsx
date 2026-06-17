import { useState } from 'react'
import { api } from '../api'

export default function Login({ onLogin }) {
  const [mode, setMode] = useState('login') // 'login' | 'register'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const data = mode === 'login'
        ? await api.login(email, password)
        : await api.register(email, password)
      localStorage.setItem('token', data.access_token)
      localStorage.setItem('email', data.email)
      onLogin(data.email)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100dvh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--page-bg)',
      padding: 16,
    }}>
      <div style={{ width: '100%', maxWidth: 380 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 64, height: 64, borderRadius: 16,
            background: 'var(--brand)', display: 'inline-flex',
            alignItems: 'center', justifyContent: 'center',
            fontSize: '2rem', marginBottom: 12,
            boxShadow: '0 4px 16px rgba(0,112,242,0.35)',
          }}>⏱</div>
          <div style={{ fontWeight: 800, fontSize: '1.6rem', color: 'var(--text-primary)' }}>TimeLog</div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: 4 }}>SAP Consultant Time Tracker</div>
        </div>

        <div className="card" style={{ padding: 28 }}>
          <div style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: 20 }}>
            {mode === 'login' ? 'Anmelden' : 'Account erstellen'}
          </div>

          {error && (
            <div style={{ background: '#fff0f0', border: '1px solid #f88', borderRadius: 8, padding: '10px 12px', marginBottom: 16, fontSize: '0.88rem', color: '#c00' }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={labelStyle}>E-Mail</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="deine@email.de"
                required
                autoComplete="email"
              />
            </div>
            <div>
              <label style={labelStyle}>Passwort</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={8}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              />
            </div>
            <button
              type="submit"
              className="btn-primary"
              disabled={loading}
              style={{ marginTop: 6, padding: '12px 0', fontSize: '1rem', width: '100%' }}
            >
              {loading ? '…' : mode === 'login' ? 'Anmelden' : 'Registrieren'}
            </button>
          </form>

          <div style={{ marginTop: 20, textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            {mode === 'login' ? (
              <>Noch kein Account?{' '}
                <button onClick={() => { setMode('register'); setError('') }} style={{ background: 'none', color: 'var(--brand)', fontWeight: 600, padding: 0, fontSize: '0.85rem' }}>
                  Registrieren
                </button>
              </>
            ) : (
              <>Bereits registriert?{' '}
                <button onClick={() => { setMode('login'); setError('') }} style={{ background: 'none', color: 'var(--brand)', fontWeight: 600, padding: 0, fontSize: '0.85rem' }}>
                  Anmelden
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

const labelStyle = { fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 5 }
