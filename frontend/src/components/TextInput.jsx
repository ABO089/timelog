import { useState, useRef } from 'react'

export default function TextInput({ onResult, loading }) {
  const [text, setText] = useState('')
  const ref = useRef(null)

  function handleSubmit() {
    if (text.trim()) onResult(text.trim())
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSubmit()
  }

  return (
    <div style={{ padding: '12px 16px 0' }}>
      <textarea
        ref={ref}
        value={text}
        onChange={e => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        rows={4}
        placeholder={`Was hast du heute gemacht?\n\nBeispiel: ZIM 2h Konzeption Berechtigungskonzept, Fuchs 1,5h Workshop Systemeinführung, intern 30min Teammeeting`}
        style={{
          width: '100%',
          fontSize: '0.95rem',
          lineHeight: 1.5,
          resize: 'vertical',
          borderRadius: 10,
          border: '1.5px solid var(--border)',
          padding: '12px 14px',
          background: '#fff',
          color: 'var(--text-primary)',
          transition: 'border-color 0.15s',
        }}
        onFocus={e => e.target.style.borderColor = 'var(--brand)'}
        onBlur={e => e.target.style.borderColor = 'var(--border)'}
        disabled={loading}
      />
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <button
          className="btn-primary"
          onClick={handleSubmit}
          disabled={loading || !text.trim()}
          style={{ flex: 1, padding: '11px 0', fontSize: '0.95rem' }}
        >
          {loading ? '⏳ Analysiere…' : '✨ Analysieren'}
        </button>
        {text && (
          <button
            className="btn-ghost"
            onClick={() => setText('')}
            style={{ padding: '11px 14px' }}
            disabled={loading}
          >
            ✕
          </button>
        )}
      </div>
      <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: 6, marginBottom: 0 }}>
        Tipp: Auf dem Smartphone Spracheingabe über die Tastatur nutzen · Strg+Enter zum Absenden
      </p>
    </div>
  )
}
