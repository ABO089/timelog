import { useState, useRef } from 'react'

export default function VoiceInput({ onResult, loading }) {
  const [listening, setListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [error, setError] = useState('')
  const recogRef = useRef(null)

  function startListening() {
    setError('')
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) {
      setError('Web Speech API nicht verfügbar. Bitte Chrome verwenden.')
      return
    }
    const recog = new SpeechRecognition()
    recog.lang = 'de-DE'
    recog.interimResults = true
    recog.maxAlternatives = 1
    recogRef.current = recog

    recog.onstart = () => setListening(true)
    recog.onend = () => setListening(false)
    recog.onerror = (e) => {
      setListening(false)
      setError(`Fehler: ${e.error}`)
    }
    recog.onresult = (e) => {
      let interim = ''
      let final = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript
        if (e.results[i].isFinal) final += t
        else interim += t
      }
      setTranscript((prev) => prev + final || interim)
    }
    recog.start()
  }

  function stopListening() {
    recogRef.current?.stop()
  }

  function handleSubmit() {
    if (transcript.trim()) onResult(transcript.trim())
  }

  function handleClear() {
    setTranscript('')
    setError('')
  }

  const isRecording = listening

  return (
    <div style={{ padding: '0 16px' }}>
      <div style={{ display: 'flex', justifyContent: 'center', margin: '24px 0 16px' }}>
        <button
          onPointerDown={startListening}
          onPointerUp={stopListening}
          onPointerLeave={stopListening}
          disabled={loading}
          style={{
            width: 88,
            height: 88,
            borderRadius: '50%',
            background: isRecording ? '#e53935' : 'var(--brand)',
            color: '#fff',
            fontSize: '2.2rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: isRecording
              ? '0 0 0 12px rgba(229,57,53,0.2), 0 4px 16px rgba(0,0,0,0.2)'
              : '0 4px 16px rgba(0,112,242,0.35)',
            transition: 'all 0.2s',
            transform: isRecording ? 'scale(1.08)' : 'scale(1)',
          }}
          aria-label={isRecording ? 'Aufnahme stoppen' : 'Aufnahme starten'}
        >
          {isRecording ? '⏹' : '🎤'}
        </button>
      </div>

      <p style={{ textAlign: 'center', fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: 16 }}>
        {isRecording ? 'Spreche jetzt… loslassen zum Stoppen' : 'Gedrückt halten zum Sprechen'}
      </p>

      {error && (
        <div style={{ background: '#fff0f0', border: '1px solid #f44', borderRadius: 8, padding: 10, marginBottom: 12, fontSize: '0.85rem', color: '#c00' }}>
          {error}
        </div>
      )}

      {transcript && (
        <div className="card" style={{ padding: 12, marginBottom: 12 }}>
          <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
            Erkannter Text (bearbeitbar)
          </label>
          <textarea
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            rows={3}
            style={{ resize: 'vertical', fontSize: '0.95rem' }}
          />
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button className="btn-primary" onClick={handleSubmit} disabled={loading} style={{ flex: 1 }}>
              {loading ? 'Analysiere…' : '✨ Analysieren'}
            </button>
            <button className="btn-ghost" onClick={handleClear}>✕</button>
          </div>
        </div>
      )}
    </div>
  )
}
