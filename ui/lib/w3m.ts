// ui/lib/w3m.ts
'use client'

import { createWeb3Modal } from '@web3modal/wagmi/react'
import { config } from './wallet'
// اگر لازم شد زنجیرهٔ پیش‌فرض رو ست کنی، از این استفاده کن:
// import { base } from 'wagmi/chains'

declare global {
  interface Window { __W3M_INIT__?: boolean }
}

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || ''

export function initW3M() {
  if (typeof window === 'undefined') return
  if (window.__W3M_INIT__) return
  if (!projectId) {
    console.warn('[W3M] Missing NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID')
    window.__W3M_INIT__ = true
    return
  }

  createWeb3Modal({
    wagmiConfig: config,
    projectId,
    themeMode: 'dark',
    enableAnalytics: false,
    // در v5 دیگر گزینهٔ "chains" نداریم؛ از wagmiConfig خوانده می‌شود.
    // اگر می‌خواهی زنجیرهٔ پیش‌فرض را مشخص کنی:
    // defaultChain: base,
  })

  window.__W3M_INIT__ = true
}

// یک‌بار در کلاینت بوت شود
initW3M()
