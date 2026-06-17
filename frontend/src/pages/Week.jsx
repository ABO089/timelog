import { useState, useEffect, useCallback } from 'react'
import { api } from '../api'
import ProjectBadge from '../components/ProjectBadge'

function CopyText({ text }) {
  const [copied, setCopied] = useState(false)
  if (!text) return null
  function handleCopy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }
  return (
    <span
      onClick={handleCopy}
      title="Klicken zum Kopieren"
      style={{ cursor: 'pointer', color: copied ? 'var(--green)' : 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 3 }}
    >
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {copied ? '✓ Kopiert!' : text}
      </span>
      {!copied && <span style={{ opacity: 0.35, fontSize: '0.65rem', flexShrink: 0 }}>⎘</span>}
    </span>
  )
}

function toLocalISO(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function getMonday(d) {
  const date = new Date(d)
  const day = date.getDay()
  const diff = (day === 0 ? -6 : 1 - day)
  date.setDate(date.getDate() + diff)
  return toLocalISO(date)
}

function addDays(iso, n) {
  const d = new Date(iso + 'T00:00:00')
  d.setDate(d.getDate() + n)
  return toLocalISO(d)
}

function formatDay(iso) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' })
}

function formatKW(iso) {
  const d = new Date(iso + 'T00:00:00')
  // ISO 8601 week number: shift to nearest Thursday, then count from Jan 4
  const thu = new Date(d)
  thu.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7)
  const jan4 = new Date(thu.getFullYear(), 0, 4)
  const kw = 1 + Math.round(((thu - jan4) / 86400000 - 3 + (jan4.getDay() + 6) % 7) / 7)
  return `KW ${kw} / ${thu.getFullYear()}`
}

function hoursBadgeStyle(h) {
  if (h === 0) return {}
  if (h >= 7) return { color: '#107e3e', fontWeight: 700 }
  if (h >= 5) return { color: '#e9730c', fontWeight: 700 }
  return { color: '#bb0000', fontWeight: 700 }
}

export default function Week() {
  const [weekStart, setWeekStart] = useState(getMonday(new Date()))
  const [entries, setEntries] = useState([])
  const [copied, setCopied] = useState(false)

  const load = useCallback(async () => {
    const data = await api.getWeekEntries(weekStart)
    setEntries(data)
  }, [weekStart])

  useEffect(() => { load() }, [load])

  function prevWeek() { setWeekStart(addDays(weekStart, -7)) }
  function nextWeek() { setWeekStart(addDays(weekStart, 7)) }

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

  const byDay = {}
  days.forEach((d) => { byDay[d] = { entries: [], total: 0 } })
  entries.forEach((e) => {
    if (byDay[e.date]) {
      byDay[e.date].entries.push(e)
      byDay[e.date].total += e.duration_hours
    }
  })

  const byProject = {}
  entries.forEach((e) => {
    if (!byProject[e.project_id]) {
      byProject[e.project_id] = { name: e.project_name, shortcode: e.project_shortcode, color: e.project_color, total: 0 }
    }
    byProject[e.project_id].total += e.duration_hours
  })
  const grandTotal = entries.reduce((s, e) => s + e.duration_hours, 0)

  function buildMarkdown() {
    let md = `## Zeiterfassung ${formatKW(weekStart)}\n\n`
    md += `| Datum | Projekt | Stunden | Beschreibung |\n`
    md += `|---|---|---|---|\n`
    days.forEach((d) => {
      byDay[d].entries.forEach((e) => {
        md += `| ${formatDay(d)} | ${e.project_shortcode || e.project_name} | ${e.duration_hours.toFixed(2)} | ${e.description || ''} |\n`
      })
    })
    md += `\n### Zusammenfassung\n\n`
    Object.values(byProject).forEach((p) => {
      md += `- **${p.shortcode || p.name}**: ${p.total.toFixed(2)} h\n`
    })
    md += `\n**Gesamt: ${grandTotal.toFixed(2)} h**\n`
    return md
  }

  async function handleExport() {
    await navigator.clipboard.writeText(buildMarkdown())
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const lowDays = days.filter((d) => byDay[d].total > 0 && byDay[d].total < 7)

  return (
    <div style={{ padding: '16px' }}>
      {/* Week nav */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <button className="btn-ghost" onClick={prevWeek} style={{ fontSize: '1.2rem', padding: '6px 10px' }}>‹</button>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ fontWeight: 700, fontSize: '1rem' }}>{formatKW(weekStart)}</div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
            {formatDay(weekStart)} – {formatDay(addDays(weekStart, 6))}
          </div>
        </div>
        <button className="btn-ghost" onClick={nextWeek} style={{ fontSize: '1.2rem', padding: '6px 10px' }}>›</button>
      </div>

      {/* Low hours warning */}
      {lowDays.length > 0 && (
        <div style={{ background: '#fff3e0', border: '1px solid #ffe082', borderRadius: 8, padding: '8px 12px', marginBottom: 12, fontSize: '0.85rem', color: '#5d4037' }}>
          ⚠️ Tage unter 7h: {lowDays.map(formatDay).join(', ')}
        </div>
      )}

      {/* Summary by project */}
      {Object.keys(byProject).length > 0 && (
        <div className="card" style={{ padding: 12, marginBottom: 16 }}>
          <div style={{ fontWeight: 600, marginBottom: 10, fontSize: '0.85rem' }}>Zusammenfassung</div>
          {Object.entries(byProject).map(([id, p]) => (
            <div key={id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <ProjectBadge color={p.color} name={p.name} shortcode={p.shortcode} />
              <span style={{ fontWeight: 600 }}>{p.total.toFixed(2)} h</span>
            </div>
          ))}
          <div style={{ borderTop: '2px solid var(--border)', marginTop: 8, paddingTop: 8, display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
            <span>Gesamt</span>
            <span>{grandTotal.toFixed(2)} h</span>
          </div>
        </div>
      )}

      {/* Per-day breakdown */}
      {days.map((d) => {
        const day = byDay[d]
        if (day.entries.length === 0) return null
        return (
          <div key={d} className="card" style={{ marginBottom: 10, overflow: 'hidden' }}>
            <div style={{ padding: '8px 12px', background: 'var(--page-bg)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)' }}>
              <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{formatDay(d)}</span>
              <span style={{ fontSize: '0.88rem', ...hoursBadgeStyle(day.total) }}>{day.total.toFixed(1)} h</span>
            </div>
            {day.entries.map((e) => (
              <div key={e.id} style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 10, alignItems: 'center' }}>
                <ProjectBadge color={e.project_color} name={e.project_name} shortcode={e.project_shortcode} />
                <span style={{ fontSize: '0.88rem', fontWeight: 600, flexShrink: 0 }}>{e.duration_hours.toFixed(2)} h</span>
                <span style={{ fontSize: '0.82rem', flex: 1, overflow: 'hidden' }}><CopyText text={e.description} /></span>
              </div>
            ))}
          </div>
        )
      })}

      {entries.length === 0 && (
        <div className="card" style={{ padding: 32, textAlign: 'center', color: 'var(--text-secondary)' }}>
          Keine Einträge diese Woche
        </div>
      )}

      {/* Export button */}
      <button className="btn-secondary" style={{ width: '100%', marginTop: 12 }} onClick={handleExport}>
        {copied ? '✅ Kopiert!' : '📋 Als Markdown kopieren'}
      </button>
    </div>
  )
}
