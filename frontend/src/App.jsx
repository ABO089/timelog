import { Outlet, NavLink } from 'react-router-dom'

const navItems = [
  { to: '/today', label: 'Heute', icon: '🕐' },
  { to: '/week', label: 'Woche', icon: '📅' },
  { to: '/projects', label: 'Projekte', icon: '📁' },
]

export default function App() {
  return (
    <>
      <header style={{
        background: 'var(--shell-bg)',
        color: '#fff',
        padding: '0 16px',
        height: 52,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
        position: 'sticky',
        top: 0,
        zIndex: 100,
      }}>
        <span style={{ fontWeight: 700, fontSize: '1.1rem', letterSpacing: 0.5 }}>⏱ TimeLog</span>
        <span style={{ fontSize: '0.8rem', opacity: 0.7 }}>SAP Consultant</span>
      </header>

      <main style={{ flex: 1, overflowY: 'auto', paddingBottom: 72 }}>
        <Outlet />
      </main>

      <nav style={{
        position: 'fixed',
        bottom: 0,
        left: '50%',
        transform: 'translateX(-50%)',
        width: '100%',
        maxWidth: 480,
        background: '#fff',
        borderTop: '1px solid var(--border)',
        display: 'flex',
        zIndex: 100,
      }}>
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
    </>
  )
}
