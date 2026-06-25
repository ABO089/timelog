import { useState, useRef } from 'react'

function getToken() {
  return localStorage.getItem('token')
}

export default function TextInput({ onResult, loading }) {
  const [text, setText] = useState('')
  const [recording, setRecording] = useState(false)
  const [transcribing, setTranscribing] = useState(false)
  const [recError, setRecError] = useState('')
  const mediaRecorder = useRef(null)
  const chunks = useRef([])

  async function startRecording() {
    setRecError('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      chunks.current = []
      const options = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? { mimeType: 'audio/webm;codecs=opus' }
        : {}
      mediaRecorder.current = new MediaRecorder(stream, options)
      mediaRecorder.current.ondataavailable = e => { if (e.data.size > 0) chunks.current.push(e.data) }
      mediaRecorder.current.onstop = handleStop
      mediaRecorder.current.start(200)
      setRecording(true)
    } catch (e) {
      setRecError('Mikrofon nicht verfügbar: ' + e.message)
    }
  }

  function stopRecording() {
    if (mediaRecorder.current?.state !== 'inactive') {
      mediaRecorder.current.stop()
      mediaRecorder.current.stream.getTracks().forEach(t => t.stop())
    }
    setRecording(false)
  }

  async function handleStop() {
    setTranscribing(true)
    try {
      const mimeType = chunks.current[0]?.type || 'audio/webm'
      const blob = new Blob(chunks.current, { type: mimeType })
      const ext = mimeType.includes('ogg') ? '.ogg' : mimeType.includes('mp4') ? '.mp4' : '.webm'
      const formData = new FormData()
      formData.append('audio', blob, `recording${ext}`)
      const res = await fetch('/api/transcribe', {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}` },
        body: formData,
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const { text: transcribed } = await res.json()
      if (transcribed) setText(prev => prev ? prev + ' ' + transcribed : transcribed)
    } catch (e) {
      setRecError('Transkription fehlgeschlagen: ' + e.message)
    } finally {
      setTranscribing(false)
    }
  }

  function handleSubmit() {
    if (text.trim()) onResult(text.trim())
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSubmit()
  }

  const micBusy = recording || transcribing

  return (
    <div style={{ padding: '12px 16px 0' }}>
      <textarea
        value={text}
        onChange={e => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        rows={3}
        placeholder="Tätigkeiten eingeben…"
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
        disabled={loading || micBusy}
      />

      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        {/* Mic button */}
        <button
          onClick={recording ? stopRecording : startRecording}
          disabled={loading || transcribing}
          title={recording ? 'Aufnahme stoppen' : 'Spracheingabe starten'}
          style={{
            padding: '11px 14px',
            borderRadius: 10,
            border: recording ? '2px solid #c00' : '1.5px solid var(--border)',
            background: recording ? '#fff0f0' : '#fff',
            fontSize: '1.1rem',
            cursor: loading || transcribing ? 'default' : 'pointer',
            opacity: loading || transcribing ? 0.6 : 1,
            position: 'relative',
            flexShrink: 0,
          }}
        >
          {transcribing ? '⏳' : recording ? '⏹' : '🎤'}
          {recording && (
            <span style={{
              position: 'absolute', top: 4, right: 4,
              width: 6, height: 6, borderRadius: '50%', background: '#c00',
              animation: 'pulse 1s infinite',
            }} />
          )}
        </button>

        {/* Analyse button */}
        <button
          className="btn-primary"
          onClick={handleSubmit}
          disabled={loading || micBusy || !text.trim()}
          style={{ flex: 1, padding: '11px 0', fontSize: '0.95rem' }}
        >
          {loading ? '⏳ Analysiere…' : '✨ Analysieren'}
        </button>

        {/* Clear */}
        {text && !micBusy && (
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

      {recError && (
        <p style={{ fontSize: '0.78rem', color: '#c00', marginTop: 6 }}>{recError}</p>
      )}

      <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: 6, marginBottom: 0 }}>
        {recording
          ? '🔴 Aufnahme läuft — nochmal tippen zum Stoppen'
          : transcribing
          ? '⏳ Whisper transkribiert…'
          : 'Strg+Enter zum Absenden · 🎤 für Spracheingabe'}
      </p>

      <style>{`@keyframes pulse { 0%,100% { opacity:1 } 50% { opacity:0.2 } }`}</style>
    </div>
  )
}
