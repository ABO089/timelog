const BASE = '/api'

function getToken() {
  return localStorage.getItem('token')
}

async function req(method, path, body) {
  const token = getToken()
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`
  const opts = { method, headers }
  if (body !== undefined) opts.body = JSON.stringify(body)
  const res = await fetch(BASE + path, opts)
  if (res.status === 401) {
    localStorage.removeItem('token')
    localStorage.removeItem('email')
    window.location.href = '/login'
    throw new Error('Nicht angemeldet')
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || res.statusText)
  }
  return res.json()
}

export const api = {
  // Auth
  login: (email, password) => req('POST', '/auth/login', { email, password }),
  register: (email, password) => req('POST', '/auth/register', { email, password }),
  me: () => req('GET', '/auth/me'),
  logout: () => { localStorage.removeItem('token'); localStorage.removeItem('email') },

  // Projects
  getProjects: () => req('GET', '/projects/'),
  createProject: (data) => req('POST', '/projects/', data),
  updateProject: (id, data) => req('PATCH', `/projects/${id}`, data),
  deleteProject: (id) => req('DELETE', `/projects/${id}`),
  reorderProjects: (order) => req('POST', '/projects/reorder', order),

  // Entries
  getDayEntries: (day) => req('GET', `/entries/day/${day}`),
  getWeekEntries: (weekStart) => req('GET', `/entries/week/${weekStart}`),
  createEntry: (data) => req('POST', '/entries/', data),
  createEntriesBulk: (entries) => req('POST', '/entries/bulk', entries),
  updateEntry: (id, data) => req('PATCH', `/entries/${id}`, data),
  deleteEntry: (id) => req('DELETE', `/entries/${id}`),

  // Parse
  parseVoice: (text, date) => req('POST', '/parse-voice', { text, entry_date: date }),
}
