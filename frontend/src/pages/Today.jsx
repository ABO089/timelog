import { useState, useEffect, useCallback } from 'react'
import { api } from '../api'
import VoiceInput from '../components/VoiceInput'
import EntryTable from '../components/EntryTable'
import NewProjectBanner from '../components/NewProjectBanner'
import ProjectBadge from '../components/ProjectBadge'

function todayIso() {
  return new Date().toISOString().split('T')[0]
}

function hoursBadgeClass(h) {
  if (h >= 8) return 'green'
  if (h >= 6) return 'yellow'
  return 'red'
}

function formatDate(iso) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })
}

export default function Today() {
  const today = todayIso()
  const [projects, setProjects] = useState([])
  const [savedEntries, setSavedEntries] = useState([])
  const [totalHours, setTotalHours] = useState(0)
  const [parseLoading, setParseLoading] = useState(false)
  const [parseError, setParseError] = useState('')
  const [previewEntries, setPreviewEntries] = useState([])
  const [newProjectSuggestions, setNewProjectSuggestions] = useState([])
  const [saveLoading, setSaveLoading] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [newProjectModal, setNewProjectModal] = useState(null)

  const loadDay = useCallback(async () => {
    const [proj, day] = await Promise.all([api.getProjects(), api.getDayEntries(today)])
    setProjects(proj)
    setSavedEntries(day.entries)
    setTotalHours(day.total_hours)
  }, [today])

  useEffect(() => { loadDay() }, [loadDay])

  async function handleVoiceResult(text) {
    setParseLoading(true)
    setParseError('')
    setPreviewEntries([])
    setNewProjectSuggestions([])
    try {
      const result = await api.parseVoice(text, today)
      setPreviewEntries(result.entries || [])
      setNewProjectSuggestions(result.new_project_suggestions || [])
    } catch (e) {
      setParseError(e.message)
    } finally {
      setParseLoading(false)
    }
  }

  async function handleSave() {
    if (!previewEntries.length) return
    setSaveLoading(true)
    try {
      const valid = previewEntries.filter((e) => e.project_id && e.hours > 0)
      await api.createEntriesBulk(valid.map((e) => ({
        date: today,
        project_id: e.project_id,
        duration_hours: parseFloat(e.hours),
        description: e.description || '',
      })))
      setPreviewEntries([])
      setNewProjectSuggestions([])
      await loadDay()
    } catch (e) {
      alert('Fehler beim Speichern: ' + e.message)
    } finally {
      setSaveLoading(false)
    }
  }

  async function handleDeleteSaved(id) {
    if (!confirm('Eintrag löschen?')) return
    await api.deleteEntry(id)
    await loadDay()
  }

  async function handleUpdateSaved(id, data) {
    await api.updateEntry(id, data)
    setEditingId(null)
    await loadDay()
  }

  async function handleCreateProject(detectedName) {
    setNewProjectModal(detectedName)
  }

  async function submitNewProject(name, shortcode, color) {
    const proj = await api.createProject({ name, shortcode, color, active: true })
    setProjects((prev) => [...prev, proj])
    setNewProjectSuggestions((prev) => prev.filter((s) => s.detected_name !== name))
    setPreviewEntries((prev) => prev.map((e) =>
      e.project_name === name ? { ...e, project_id: proj.id } : e
    ))
    setNewProjectModal(null)
  }

  const activeProjects = projects.filter((p) => p.active)
  const pinnedFirst = [...activeProjects].sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0))

  return (
    <div>
      {/* Date + total hours header */}
      <div style={{ padding: '16px 16px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Heute</div>
          <div style={{ fontWeight: 600, fontSize: '1rem', color: 'var(--text-primary)' }}>{formatDate(today)}</div>
        </div>
        <span className={`hours-badge ${hoursBadgeClass(totalHours)}`}>{totalHours.toFixed(1)} h</span>
      </div>

      {/* Voice input */}
      <VoiceInput onResult={handleVoiceResult} loading={parseLoading} />

      {parseError && (
        <div style={{ margin: '0 16px 12px', background: '#fff0f0', border: '1px solid #f44', borderRadius: 8, padding: 10, fontSize: '0.85rem', color: '#c00' }}>
          {parseError}
        </div>
      )}

      {/* New project suggestions */}
      {newProjectSuggestions.map((s, i) => (
        <div key={i} style={{ margin: '0 16px 10px' }}>
          <NewProjectBanner
            detectedName={s.detected_name}
            onAccept={() => handleCreateProject(s.detected_name)}
            onIgnore={() => setNewProjectSuggestions((prev) => prev.filter((_, j) => j !== i))}
          />
        </div>
      ))}

      {/* Preview entries */}
      {previewEntries.length > 0 && (
        <div className="card" style={{ margin: '0 16px 16px' }}>
          <div style={{ padding: '12px 12px 8px', fontWeight: 600, borderBottom: '1px solid var(--border)' }}>
            Vorschau — bitte prüfen
          </div>
          <EntryTable
            entries={previewEntries}
            projects={pinnedFirst}
            onChange={(i, upd) => setPreviewEntries((prev) => prev.map((e, j) => j === i ? upd : e))}
            onRemove={(i) => setPreviewEntries((prev) => prev.filter((_, j) => j !== i))}
          />
          <div style={{ padding: '12px 12px 12px', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button className="btn-ghost" onClick={() => setPreviewEntries([])}>Verwerfen</button>
            <button className="btn-primary" onClick={handleSave} disabled={saveLoading}>
              {saveLoading ? 'Speichert…' : '💾 Speichern'}
            </button>
          </div>
        </div>
      )}

      {/* Saved entries */}
      <div style={{ padding: '0 16px' }}>
        <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>
          Gespeicherte Einträge
        </div>
        {savedEntries.length === 0 ? (
          <div className="card" style={{ padding: 24, textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Noch keine Einträge heute. Spracheingabe nutzen ☝️
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {savedEntries.map((e) => (
              <SavedEntryRow
                key={e.id}
                entry={e}
                projects={pinnedFirst}
                isEditing={editingId === e.id}
                onEdit={() => setEditingId(e.id)}
                onSave={(data) => handleUpdateSaved(e.id, data)}
                onCancel={() => setEditingId(null)}
                onDelete={() => handleDeleteSaved(e.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* New project quick-create modal */}
      {newProjectModal && (
        <QuickCreateProject
          detectedName={newProjectModal}
          onSubmit={submitNewProject}
          onClose={() => setNewProjectModal(null)}
        />
      )}
    </div>
  )
}

function SavedEntryRow({ entry, projects, isEditing, onEdit, onSave, onCancel, onDelete }) {
  const [hours, setHours] = useState(entry.duration_hours)
  const [desc, setDesc] = useState(entry.description)
  const [projectId, setProjectId] = useState(entry.project_id)

  if (!isEditing) {
    return (
      <div className="card" style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <ProjectBadge color={entry.project_color} name={entry.project_name} shortcode={entry.project_shortcode} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{entry.duration_hours.toFixed(2)} h</div>
          {entry.description && <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{entry.description}</div>}
        </div>
        <button onClick={onEdit} style={{ background: 'none', fontSize: '1rem', padding: 4, color: 'var(--brand)' }}>✏️</button>
        <button onClick={onDelete} style={{ background: 'none', fontSize: '1rem', padding: 4, color: '#aaa' }}>🗑</button>
      </div>
    )
  }

  return (
    <div className="card" style={{ padding: 12 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <select value={projectId} onChange={(e) => setProjectId(parseInt(e.target.value))}>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.shortcode} – {p.name}</option>)}
        </select>
        <input type="number" min="0.25" step="0.25" value={hours} onChange={(e) => setHours(e.target.value)} />
        <input type="text" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Beschreibung" />
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn-ghost" onClick={onCancel}>Abbrechen</button>
          <button className="btn-primary" onClick={() => onSave({ project_id: projectId, duration_hours: parseFloat(hours), description: desc })}>Speichern</button>
        </div>
      </div>
    </div>
  )
}

function QuickCreateProject({ detectedName, onSubmit, onClose }) {
  const [name, setName] = useState(detectedName)
  const [shortcode, setShortcode] = useState(detectedName.slice(0, 4).toUpperCase())
  const [color, setColor] = useState('#0070F2')

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end', zIndex: 200 }}>
      <div style={{ background: '#fff', borderRadius: '16px 16px 0 0', padding: 24, width: '100%', maxWidth: 480, margin: '0 auto' }}>
        <div style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: 16 }}>Neues Projekt anlegen</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Projektname" />
          <input value={shortcode} onChange={(e) => setShortcode(e.target.value)} placeholder="Kürzel (z.B. ZIM)" maxLength={6} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <label style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', flexShrink: 0 }}>Farbe:</label>
            <input type="color" value={color} onChange={(e) => setColor(e.target.value)} style={{ width: 44, height: 36, padding: 2, cursor: 'pointer' }} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <button className="btn-ghost" style={{ flex: 1 }} onClick={onClose}>Abbrechen</button>
          <button className="btn-primary" style={{ flex: 2 }} onClick={() => onSubmit(name, shortcode, color)}>Anlegen</button>
        </div>
      </div>
    </div>
  )
}
