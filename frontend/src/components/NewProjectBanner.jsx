export default function NewProjectBanner({ detectedName, onAccept, onIgnore }) {
  return (
    <div style={{
      background: '#fff8e1',
      border: '1px solid #ffe082',
      borderRadius: 8,
      padding: '10px 14px',
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      flexWrap: 'wrap',
    }}>
      <span style={{ flex: 1, fontSize: '0.88rem', color: '#5d4037' }}>
        🆕 Neues Projekt erkannt: <strong>{detectedName}</strong> — Jetzt anlegen?
      </span>
      <div style={{ display: 'flex', gap: 6 }}>
        <button className="btn-primary" style={{ padding: '6px 14px', fontSize: '0.82rem' }} onClick={onAccept}>
          Anlegen
        </button>
        <button className="btn-ghost" style={{ fontSize: '0.82rem' }} onClick={onIgnore}>
          Ignorieren
        </button>
      </div>
    </div>
  )
}
