'use client'

import React from 'react'
import { useAccount } from 'wagmi'
import { useWeb3Modal } from '@web3modal/wagmi/react'

const PILL_H = 44
const PILL_R = PILL_H / 2

function useW3MReady() {
  const [ready, setReady] = React.useState(false)
  React.useEffect(() => {
    const check = () => {
      if (typeof window !== 'undefined' && (window as any).__W3M__?.initialized) {
        setReady(true); return true
      }
      return false
    }
    if (check()) return
    const id = setInterval(() => { if (check()) clearInterval(id) }, 60)
    return () => clearInterval(id)
  }, [])
  return ready
}

export default function ConnectWallet() {
  const ready = useW3MReady()
  const { address, isConnected } = useAccount()
  const { open } = useWeb3Modal()
  const [busy, setBusy] = React.useState(false)

  const handleOpen = async (view?: 'Account') => {
    if (busy) return
    try { setBusy(true); await open(view ? { view } : undefined) }
    catch (e) { console.error('[W3M open] failed:', e) }
    finally { setBusy(false) }
  }

  const baseBtn: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    gap: 10, height: PILL_H, padding: '0 16px',
    borderRadius: PILL_R, minWidth: 160,
    border: '1px solid rgba(59,130,246,0.35)',
    background: 'linear-gradient(180deg, #60a5fa, #3b82f6)',
    color: '#fff', fontWeight: 800, fontSize: 14,
    boxShadow: '0 12px 28px rgba(59,130,246,0.30)',
    cursor: 'pointer', transition: 'transform .12s ease, box-shadow .12s ease'
  }

  const disabledBtn: React.CSSProperties = {
    ...baseBtn,
    background: 'linear-gradient(180deg, rgba(203,213,225,0.65), rgba(226,232,240,0.65))',
    color: '#334155',
    border: '1px solid rgba(148,163,184,0.45)',
    boxShadow: '0 6px 16px rgba(0,0,0,0.06)',
    cursor: 'not-allowed',
  }

  if (!ready) return <button style={disabledBtn} disabled>Loading Wallet…</button>

  if (isConnected) {
    return (
      <button
        onClick={() => handleOpen('Account')}
        disabled={busy}
        style={busy ? disabledBtn : baseBtn}
        onMouseEnter={(e) => { if (!busy) e.currentTarget.style.transform = 'translateY(-2px) scale(1.02)' }}
        onMouseLeave={(e) => { if (!busy) e.currentTarget.style.transform = 'translateY(0)' }}
        title="Wallet / Account"
      >
        {address!.slice(0,6)}…{address!.slice(-4)}
      </button>
    )
  }

  return (
    <button
      onClick={() => handleOpen()}
      disabled={busy}
      style={busy ? disabledBtn : baseBtn}
      onMouseEnter={(e) => { if (!busy) e.currentTarget.style.transform = 'translateY(-2px) scale(1.02)' }}
      onMouseLeave={(e) => { if (!busy) e.currentTarget.style.transform = 'translateY(0)' }}
      title="Connect Wallet"
    >
      {busy ? 'Connecting…' : 'Connect'}
    </button>
  )
}
