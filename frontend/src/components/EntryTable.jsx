import { useState } from 'react'

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
            <EntryRow key={i} entry={entry} projects={projects} onChange={(upd) => onChange(i, upd)} onRemove={() => onRemove(i)} />
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
  return (
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
        <input
          type="text"
          value={entry.description || ''}
          onChange={(e) => onChange({ ...entry, description: e.target.value })}
          placeholder="Beschreibung…"
          style={{ fontSize: '0.85rem', padding: '4px 6px' }}
        />
      </td>
      <td style={{ ...td, textAlign: 'center' }}>
        <button onClick={onRemove} style={{ background: 'none', color: '#aaa', fontSize: '1rem', padding: 4 }} aria-label="Entfernen">✕</button>
      </td>
    </tr>
  )
}

const th = { padding: '8px 12px', textAlign: 'left', fontWeight: 600, fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: 0.5 }
const td = { padding: '6px 8px', borderTop: '1px solid var(--border)', verticalAlign: 'middle' }
