import React, { useState, useEffect } from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import App from './App'
import Login from './pages/Login'
import Today from './pages/Today'
import Week from './pages/Week'
import Projects from './pages/Projects'
import './index.css'

function Root() {
  const [user, setUser] = useState(localStorage.getItem('email'))

  function handleLogin(email) {
    setUser(email)
  }

  function handleLogout() {
    localStorage.removeItem('token')
    localStorage.removeItem('email')
    setUser(null)
  }

  if (!user) {
    return <Login onLogin={handleLogin} />
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App email={user} onLogout={handleLogout} />}>
          <Route index element={<Navigate to="/today" replace />} />
          <Route path="today" element={<Today />} />
          <Route path="week" element={<Week />} />
          <Route path="projects" element={<Projects />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
)

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  })
}

async function scheduleDailyReminder() {
  if (!('Notification' in window)) return
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return
  const now = new Date()
  const target = new Date(now)
  target.setHours(16, 30, 0, 0)
  if (target <= now) target.setDate(target.getDate() + 1)
  setTimeout(async () => {
    const today = new Date().toISOString().split('T')[0]
    try {
      const token = localStorage.getItem('token')
      if (!token) return
      const res = await fetch(`/api/entries/day/${today}`, { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      if (data.total_hours === 0) new Notification('TimeLog', { body: 'Zeiten noch nicht erfasst! Kurz eintragen?', icon: '/icon-192.png' })
    } catch {}
  }, target - now)
}

scheduleDailyReminder()
