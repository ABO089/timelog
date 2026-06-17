import { useState, useEffect } from 'react'
import { Outlet, NavLink } from 'react-router-dom'
import { api } from './api'

const navItems = [
  { to: '/today', label: 'Heute', icon: '🕐' },
  { to: '/week', label: 'Woche', icon: '📅' },
  { to: '/projects', label: 'Projekte', icon: '📁' },
]

export default function App({ email, onLogout }) {
  const [showProfile, setShowProfile] = useState(false)
  const [jobContext, setJobContext] = useState(localStorage.getItem('job_context') || 'SAP Berater')
  const [jobInput, setJobInput] = useState(jobContext)
  const [saving, setSaving] = useState(false)

  async function handleSaveProfile() {
    setSaving(true)
    try {
      const res = await api.updateProfile({ job_context: jobInput })
      setJobContext(res.job_context)
      localStorage.setItem('job_context', res.job_context)
      setShowProfile(false)
    } finally {
      setSaving(false)
    }
  }

  useEffect(() => {
    api.me().then(u => {
      if (u.job_context) {
        setJobContext(u.job_context)
        setJobInput(u.job_context)
        localStorage.setItem('job_context', u.job_context)
      }
    }).catch(() => {})
  }, [])

  return (
    <>
      {/* Shell header */}
      <header className="shell-header">
        <span style={{ fontWeight: 700, fontSize: '1.1rem', letterSpacing: 0.5 }}>⏱ TimeLog</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={() => { setJobInput(jobContext); setShowProfile(true) }}
            title="Profil bearbeiten"
            style={{
              background: 'rgba(255,255,255,0.12)',
              color: '#fff',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: 6,
              padding: '4px 10px',
              fontSize: '0.78rem',
              cursor: 'pointer',
            }}
          >
            👤 {email}
          </button>
          <button
            onClick={onLogout}
            style={{
              background: 'transparent',
              color: 'rgba(255,255,255,0.7)',
              border: 'none',
              fontSize: '1.1rem',
              cursor: 'pointer',
              padding: '4px 6px',
            }}
            title="Abmelden"
          >
            ↩
          </button>
        </div>
      </header>

      {/* App body: sidebar (desktop) + content */}
      <div className="app-body">
        {/* Sidebar — only visible on desktop via CSS */}
        <aside className="sidebar">
          {navItems.map(({ to, label, icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => 'sidebar-link' + (isActive ? ' active' : '')}
            >
              <span className="nav-icon">{icon}</span>
              {label}
            </NavLink>
          ))}
          <div style={{ flex: 1 }} />
          <div style={{ padding: '12px 20px', fontSize: '0.72rem', color: 'var(--text-secondary)', borderTop: '1px solid var(--border)' }}>
            {jobContext}
          </div>
        </aside>

        {/* Main content */}
        <main className="app-content">
          <Outlet />
        </main>
      </div>

      {/* Bottom tab bar — only visible on mobile via CSS */}
      <nav className="tab-bar">
        {navItems.map(({ to, label, icon }) => (
          <NavLink key={to} to={to} style={({ isActive }) => ({
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 2,
            padding: '8px 0',
            textDecoration: 'none',
            color: isActive ? 'var(--brand)' : 'var(--text-secondary)',
            fontSize: '0.7rem',
            fontWeight: isActive ? 700 : 400,
            borderTop: isActive ? '2px solid var(--brand)' : '2px solid transparent',
            transition: 'color 0.15s',
          })}>
            <span style={{ fontSize: '1.4rem', lineHeight: 1 }}>{icon}</span>
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Profil-Modal */}
      {showProfile && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end', zIndex: 200 }}>
          <div style={{ background: '#fff', borderRadius: '16px 16px 0 0', padding: 24, width: '100%', maxWidth: 480, margin: '0 auto' }}>
            <div style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: 6 }}>Profil</div>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: 20 }}>
              Der Berufskontext hilft der KI, Beschreibungen passend zu formulieren.
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
                Dein Beruf / Rolle
              </label>
              <input
                value={jobInput}
                onChange={e => setJobInput(e.target.value)}
                placeholder="z.B. SAP Berater, Webentwickler, Projektmanager"
              />
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                {['SAP Berater', 'SAP Entwickler', 'IT-Projektleiter', 'Webentwickler', 'Business Analyst'].map(p => (
                  <button
                    key={p}
                    onClick={() => setJobInput(p)}
                    style={{
                      background: jobInput === p ? 'var(--brand)' : 'var(--page-bg)',
                      color: jobInput === p ? '#fff' : 'var(--text-secondary)',
                      border: '1px solid var(--border)',
                      borderRadius: 20,
                      padding: '4px 12px',
                      fontSize: '0.78rem',
                      cursor: 'pointer',
                    }}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn-ghost" style={{ flex: 1 }} onClick={() => setShowProfile(false)}>Abbrechen</button>
              <button className="btn-primary" style={{ flex: 2 }} onClick={handleSaveProfile} disabled={saving}>
                {saving ? 'Speichert…' : 'Speichern'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
