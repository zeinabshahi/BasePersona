// lib/w3m-init.ts
'use client'

import { createWeb3Modal } from '@web3modal/wagmi/react'
import { config } from './wallet'
// اگر واقعاً می‌خوای زنجیرهٔ پیش‌فرض رو مشخص کنی، اینو باز کن:
// import { base } from 'wagmi/chains'

declare global {
  interface Window {
    __W3M__?: { initialized?: boolean }
  }
}

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || ''

export function initWeb3Modal() {
  if (typeof window === 'undefined') return
  if (window.__W3M__?.initialized) return

  if (!projectId) {
    console.warn('[W3M] Missing NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID')
    return
  }

  // جلوی دوبار بوت شدن در HMR
  window.__W3M__ = { initialized: true }
  try {
    console.log('[W3M] boot', { hasProjectId: !!projectId })
    createWeb3Modal({
      wagmiConfig: config,
      projectId,
      themeMode: 'dark',
      enableAnalytics: false,
      // در v5 دیگر "chains" وجود ندارد. اگر خواستی زنجیرهٔ پیش‌فرض را مشخص کنی:
      // defaultChain: base,
    })
    console.log('[W3M] initialized')
  } catch (e) {
    window.__W3M__ = { initialized: false }
    console.error('[W3M] init failed:', (e as any)?.message || e)
  }
}

// در کلاینت، یک بار اجرا شود
initWeb3Modal()
