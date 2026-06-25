import { useState } from 'react'
import { api } from '../api'

export default function EntryTable({ entries, projects, onChange, onRemove }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
        <thead>
          <tr style={{ background: 'var(--page-bg)', color: 'var(--text-secondary)' }}>
            <th style={th}>Projekt</th>
            <th style={{ ...th, width: 72 }}>Std</th>
            <th style={th}>Beschreibung</th>
            <th style={{ ...th, width: 36 }}></th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry, i) => (
            <EntryRow
              key={i}
              entry={entry}
              projects={projects}
              onChange={(upd) => onChange(i, upd)}
              onRemove={() => onRemove(i)}
            />
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={4} style={{ padding: '8px 12px', borderTop: '2px solid var(--border)' }}>
              <strong>Gesamt: {entries.reduce((s, e) => s + (parseFloat(e.hours) || 0), 0).toFixed(1)} h</strong>
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

function EntryRow({ entry, projects, onChange, onRemove }) {
  const [improving, setImproving] = useState(false)
  const [suggestion, setSuggestion] = useState(null)

  async function handleImprove() {
    setImproving(true)
    setSuggestion(null)
    try {
      const project = projects.find(p => p.id === entry.project_id)
      const res = await api.improveDescription(
        entry.description || '',
        project?.name || entry.project_name || '',
        parseFloat(entry.hours) || 0,
      )
      setSuggestion(res.improved)
    } catch {
      setSuggestion(null)
    } finally {
      setImproving(false)
    }
  }

  function acceptSuggestion() {
    onChange({ ...entry, description: suggestion })
    setSuggestion(null)
  }

  return (
    <>
      <tr>
        <td style={td}>
          <select
            value={entry.project_id || ''}
            onChange={(e) => onChange({ ...entry, project_id: parseInt(e.target.value) })}
            style={{ fontSize: '0.85rem', padding: '4px 6px' }}
          >
            <option value="">— wählen —</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.shortcode} – {p.name}</option>
            ))}
          </select>
        </td>
        <td style={td}>
          <input
            type="number"
            min="0.25"
            max="24"
            step="0.25"
            value={entry.hours}
            onChange={(e) => onChange({ ...entry, hours: e.target.value })}
            style={{ fontSize: '0.85rem', padding: '4px 6px', width: 64 }}
          />
        </td>
        <td style={td}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 4 }}>
            <textarea
              value={entry.description || ''}
              onChange={(e) => onChange({ ...entry, description: e.target.value })}
              placeholder="Beschreibung…"
              rows={Math.max(1, Math.ceil((entry.description || '').length / 50))}
              style={{
                fontSize: '0.85rem',
                padding: '4px 6px',
                flex: 1,
                resize: 'vertical',
                minHeight: 32,
                lineHeight: 1.4,
                fontFamily: 'inherit',
                borderRadius: 4,
                border: '1px solid var(--border)',
              }}
            />
            <button
              onClick={handleImprove}
              disabled={improving || !entry.description}
              title="KI-Verbesserungsvorschlag für Faktura"
              style={{
                background: 'none',
                border: '1px solid var(--border)',
                borderRadius: 6,
                padding: '3px 6px',
                fontSize: '0.8rem',
                cursor: 'pointer',
                flexShrink: 0,
                opacity: improving || !entry.description ? 0.4 : 1,
              }}
            >
              {improving ? '…' : '✨'}
            </button>
          </div>
        </td>
        <td style={{ ...td, textAlign: 'center' }}>
          <button onClick={onRemove} style={{ background: 'none', color: '#aaa', fontSize: '1rem', padding: 4 }} aria-label="Entfernen">✕</button>
        </td>
      </tr>
      {suggestion && (
        <tr>
          <td colSpan={4} style={{ padding: '6px 10px', background: '#f0f6ff', borderTop: '1px solid #c8deff' }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 4 }}>
              ✨ Vorschlag für Faktura:
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <p style={{ fontSize: '0.85rem', flex: 1, fontStyle: 'italic', margin: 0, wordBreak: 'break-word' }}>{suggestion}</p>
              <button
                onClick={acceptSuggestion}
                style={{
                  background: 'var(--brand)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 6,
                  padding: '4px 10px',
                  fontSize: '0.78rem',
                  cursor: 'pointer',
                  flexShrink: 0,
                }}
              >
                Übernehmen
              </button>
              <button
                onClick={() => setSuggestion(null)}
                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.85rem' }}
              >
                ✕
              </button>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

const th = { padding: '8px 12px', textAlign: 'left', fontWeight: 600, fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: 0.5 }
const td = { padding: '6px 8px', borderTop: '1px solid var(--border)', verticalAlign: 'middle' }
