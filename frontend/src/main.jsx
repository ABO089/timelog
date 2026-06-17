import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import App from './App'
import Today from './pages/Today'
import Week from './pages/Week'
import Projects from './pages/Projects'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />}>
          <Route index element={<Navigate to="/today" replace />} />
          <Route path="today" element={<Today />} />
          <Route path="week" element={<Week />} />
          <Route path="projects" element={<Projects />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
)

// Register service worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  })
}

// Schedule daily push notification at 16:30
async function scheduleDailyReminder() {
  if (!('Notification' in window)) return
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return

  const now = new Date()
  const target = new Date(now)
  target.setHours(16, 30, 0, 0)
  if (target <= now) target.setDate(target.getDate() + 1)

  const msUntil = target - now
  setTimeout(async () => {
    // Only notify if no entries today
    const today = new Date().toISOString().split('T')[0]
    try {
      const res = await fetch(`/api/entries/day/${today}`)
      const data = await res.json()
      if (data.total_hours === 0) {
        new Notification('TimeLog', {
          body: 'Zeiten noch nicht erfasst! Kurz eintragen?',
          icon: '/icon-192.png',
        })
      }
    } catch {}
  }, msUntil)
}

scheduleDailyReminder()
