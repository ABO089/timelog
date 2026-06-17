import { useState, useEffect, useCallback } from 'react'
import { api } from '../api'
import ProjectBadge from '../components/ProjectBadge'

const COLORS = ['#0070F2', '#107e3e', '#bb0000', '#e9730c', '#6800d4', '#00627a', '#5a2a82', '#c87b00']

const BILLING_OPTIONS = [
  { value: 'fakturierbar', label: 'Fakturierbar', color: '#107e3e' },
  { value: 'intern', label: 'Intern', color: '#0070f2' },
  { value: 'nicht_fakturierbar', label: 'Keine Faktura', color: '#6a6d70' },
]

export default function Projects() {
  const [projects, setProjects] = useState([])
  const [editing, setEditing] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm())

  const load = useCallback(async () => {
    const data = await api.getProjects()
    setProjects(data)
  }, [])

  useEffect(() => { load() }, [load])

  function emptyForm() {
    return { name: '', shortcode: '', client_name: '', color: '#0070F2', aliases: '', active: true, pinned: false, billing_type: 'fakturierbar' }
  }

  function openNew() {
    setForm(emptyForm())
    setEditing(null)
    setShowForm(true)
  }

  function openEdit(p) {
    setForm({ ...p, aliases: (p.aliases || []).join(', ') })
    setEditing(p.id)
    setShowForm(true)
  }

  async function handleSubmit() {
    const data = { ...form, aliases: form.aliases.split(',').map((a) => a.trim()).filter(Boolean) }
    if (editing) {
      await api.updateProject(editing, data)
    } else {
      await api.createProject(data)
    }
    setShowForm(false)
    await load()
  }

  async function toggleActive(p) {
    await api.updateProject(p.id, { active: !p.active })
    await load()
  }

  async function togglePinned(p) {
    await api.updateProject(p.id, { pinned: !p.pinned })
    await load()
  }

  async function handleDelete(p) {
    if (!confirm(`Projekt "${p.name}" wirklich löschen?`)) return
    await api.deleteProject(p.id)
    await load()
  }

  async function moveUp(i) {
    if (i === 0) return
    const arr = [...projects]
    ;[arr[i - 1], arr[i]] = [arr[i], arr[i - 1]]
    const order = arr.map((p, idx) => ({ id: p.id, sort_order: idx }))
    await api.reorderProjects(order)
    await load()
  }

  async function moveDown(i) {
    if (i === projects.length - 1) return
    const arr = [...projects]
    ;[arr[i], arr[i + 1]] = [arr[i + 1], arr[i]]
    const order = arr.map((p, idx) => ({ id: p.id, sort_order: idx }))
    await api.reorderProjects(order)
    await load()
  }

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ fontWeight: 700, fontSize: '1rem' }}>Projekte ({projects.length})</div>
        <button className="btn-primary" onClick={openNew} style={{ borderRadius: 24, padding: '8px 18px' }}>+ Neu</button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {projects.map((p, i) => (
          <div key={p.id} className="card" style={{ padding: '12px 14px', opacity: p.active ? 1 : 0.5 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <ProjectBadge color={p.color} name={p.name} shortcode={p.shortcode} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                  {p.name}
                  {(() => { const b = BILLING_OPTIONS.find(o => o.value === (p.billing_type || 'fakturierbar')); return b ? <span style={{ fontSize: '0.65rem', background: b.color + '18', color: b.color, border: `1px solid ${b.color}40`, borderRadius: 10, padding: '1px 7px', fontWeight: 600 }}>{b.label}</span> : null })()}
                </div>
                {p.client_name && <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{p.client_name}</div>}
                {p.aliases?.length > 0 && <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Aliase: {p.aliases.join(', ')}</div>}
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                <button onClick={() => togglePinned(p)} title={p.pinned ? 'Entpinnen' : 'Anpinnen'} style={{ background: 'none', fontSize: '1rem', padding: 4, opacity: p.pinned ? 1 : 0.35 }}>📌</button>
                <button onClick={() => toggleActive(p)} title={p.active ? 'Deaktivieren' : 'Aktivieren'} style={{ background: 'none', fontSize: '1rem', padding: 4 }}>{p.active ? '✅' : '⬜'}</button>
                <button onClick={() => openEdit(p)} style={{ background: 'none', fontSize: '1rem', padding: 4, color: 'var(--brand)' }}>✏️</button>
                <button onClick={() => handleDelete(p)} style={{ background: 'none', fontSize: '1rem', padding: 4, color: '#aaa' }}>🗑</button>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
              <button onClick={() => moveUp(i)} disabled={i === 0} className="btn-ghost" style={{ padding: '2px 10px', fontSize: '0.75rem', opacity: i === 0 ? 0.3 : 1 }}>▲</button>
              <button onClick={() => moveDown(i)} disabled={i === projects.length - 1} className="btn-ghost" style={{ padding: '2px 10px', fontSize: '0.75rem', opacity: i === projects.length - 1 ? 0.3 : 1 }}>▼</button>
            </div>
          </div>
        ))}
      </div>

      {projects.length === 0 && (
        <div className="card" style={{ padding: 32, textAlign: 'center', color: 'var(--text-secondary)' }}>
          Noch keine Projekte. Lege jetzt das erste an!
        </div>
      )}

      {/* Edit/Create modal */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end', zIndex: 200 }}>
          <div style={{ background: '#fff', borderRadius: '16px 16px 0 0', padding: 24, width: '100%', maxWidth: 480, margin: '0 auto', maxHeight: '90dvh', overflowY: 'auto' }}>
            <div style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: 16 }}>
              {editing ? 'Projekt bearbeiten' : 'Neues Projekt'}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={labelStyle}>Projektname *</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="z.B. ZIM Stadtwerke" />
              </div>
              <div>
                <label style={labelStyle}>Kürzel *</label>
                <input value={form.shortcode} onChange={(e) => setForm({ ...form, shortcode: e.target.value.toUpperCase() })} placeholder="z.B. ZIM" maxLength={8} />
              </div>
              <div>
                <label style={labelStyle}>Kunde</label>
                <input value={form.client_name} onChange={(e) => setForm({ ...form, client_name: e.target.value })} placeholder="Kundenname" />
              </div>
              <div>
                <label style={labelStyle}>Farbe</label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
                  {COLORS.map((c) => (
                    <div key={c} onClick={() => setForm({ ...form, color: c })} style={{
                      width: 32, height: 32, borderRadius: '50%', background: c, cursor: 'pointer',
                      border: form.color === c ? '3px solid #32363a' : '2px solid transparent',
                    }} />
                  ))}
                  <input type="color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} style={{ width: 32, height: 32, padding: 1, borderRadius: '50%', cursor: 'pointer' }} />
                </div>
              </div>
              <div>
                <label style={labelStyle}>Abrechnungsart</label>
                <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                  {BILLING_OPTIONS.map(o => (
                    <button
                      key={o.value}
                      type="button"
                      onClick={() => setForm({ ...form, billing_type: o.value })}
                      style={{
                        flex: 1, padding: '7px 4px', borderRadius: 8, cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, border: '2px solid',
                        borderColor: form.billing_type === o.value ? o.color : 'var(--border)',
                        background: form.billing_type === o.value ? o.color + '15' : 'transparent',
                        color: form.billing_type === o.value ? o.color : 'var(--text-secondary)',
                      }}
                    >{o.label}</button>
                  ))}
                </div>
              </div>
              <div>
                <label style={labelStyle}>Aliase (kommagetrennt, für Spracherkennung)</label>
                <input value={form.aliases} onChange={(e) => setForm({ ...form, aliases: e.target.value })} placeholder="z.B. Zim, Stadtwerke, ZIM AG" />
              </div>
              <div style={{ display: 'flex', gap: 16 }}>
                <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: '0.9rem' }}>
                  <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} style={{ width: 18, height: 18 }} />
                  Aktiv
                </label>
                <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: '0.9rem' }}>
                  <input type="checkbox" checked={form.pinned} onChange={(e) => setForm({ ...form, pinned: e.target.checked })} style={{ width: 18, height: 18 }} />
                  Angepinnt (Top 4)
                </label>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
              <button className="btn-ghost" style={{ flex: 1 }} onClick={() => setShowForm(false)}>Abbrechen</button>
              <button className="btn-primary" style={{ flex: 2 }} onClick={handleSubmit} disabled={!form.name || !form.shortcode}>
                {editing ? 'Speichern' : 'Anlegen'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const labelStyle = { fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: 4, fontWeight: 600 }
