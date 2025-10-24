// lib/w3m-init.ts
import { createWeb3Modal } from '@web3modal/wagmi/react'
import { base } from 'wagmi/chains'
import { config } from './wallet'

declare global {
  interface Window { __W3M__?: { initialized?: boolean } }
}

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || ''

export function initWeb3Modal() {
  if (typeof window === 'undefined') return
  if (window.__W3M__?.initialized) return

  if (!projectId) {
    console.warn('[W3M] Missing NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID')
    return
  }

  // قبل از فراخوانی فلگ بذار تا HMR دوبار اجرا نشه
  window.__W3M__ = { initialized: true }
  try {
    console.log('[W3M] boot', { hasProjectId: !!projectId })
    createWeb3Modal({
      wagmiConfig: config,
      projectId,
      chains: [base],
      themeMode: 'dark',
      enableAnalytics: false,
    })
    console.log('[W3M] initialized')
  } catch (e) {
    window.__W3M__ = { initialized: false }
    console.error('[W3M] init failed:', (e as any)?.message || e)
  }
}

initWeb3Modal()
