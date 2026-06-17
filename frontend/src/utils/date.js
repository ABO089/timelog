export function toLocalISO(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function todayIso() {
  return toLocalISO(new Date())
}

export function getMonday(d) {
  const date = new Date(d)
  const day = date.getDay()
  date.setDate(date.getDate() + (day === 0 ? -6 : 1 - day))
  return toLocalISO(date)
}

export function addDays(iso, n) {
  const d = new Date(iso + 'T00:00:00')
  d.setDate(d.getDate() + n)
  return toLocalISO(d)
}

export function formatDay(iso, opts = { weekday: 'short', day: '2-digit', month: '2-digit' }) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('de-DE', opts)
}

export function formatKW(iso) {
  const d = new Date(iso + 'T00:00:00')
  const thu = new Date(d)
  thu.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7)
  const jan4 = new Date(thu.getFullYear(), 0, 4)
  const kw = 1 + Math.round(((thu - jan4) / 86400000 - 3 + (jan4.getDay() + 6) % 7) / 7)
  return `KW ${kw} / ${thu.getFullYear()}`
}
