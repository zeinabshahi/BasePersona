// ui/components/Footer.tsx
import React from 'react'

export default function Footer() {
  return (
    <footer style={{ marginTop: 28, padding: 18, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
      <div>Made with ❤️ · Rankora-Base Persona</div>
      <div style={{ marginTop: 6 }}>
        <small>Privacy: we only read onchain public data. No keys requested.</small>
      </div>
    </footer>
  )
}
