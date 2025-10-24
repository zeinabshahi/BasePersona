// lib/w3m.ts
import { createWeb3Modal } from '@web3modal/wagmi/react'
import { base } from 'wagmi/chains'
import { config } from './wallet'

// برای جلوگیری از init دوباره
declare global {
  interface Window { __W3M_INIT__?: boolean }
}

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID

if (typeof window !== 'undefined' && !window.__W3M_INIT__) {
  if (!projectId) {
    console.warn('Missing NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID')
  } else {
    createWeb3Modal({
      wagmiConfig: config,
      projectId,
      chains: [base],
      themeMode: 'dark',
      enableAnalytics: false,
    })
  }
  window.__W3M_INIT__ = true
}
