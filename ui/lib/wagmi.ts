// ui/lib/wagmi.ts
'use client'

import { createConfig, http } from 'wagmi'
import { baseSepolia } from 'wagmi/chains'
import { injected, walletConnect } from '@wagmi/connectors'

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || ''
const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || 'https://sepolia.base.org'

// اگر projectId نداشتی، فقط injected فعال می‌مونه
const connectors = [
  injected({
    shimDisconnect: true,
  }),
  ...(projectId
    ? [
        walletConnect({
          projectId,
          showQrModal: true,
          metadata: {
            name: 'Base Persona',
            description: 'GM streak + wallet stats',
            url: 'https://example.com', // درصورت نیاز دامنه‌ات را بگذار
            icons: [
              'https://raw.githubusercontent.com/walletconnect/walletconnect-assets/master/Icon/Gradient/Icon.png',
            ],
          },
        }),
      ]
    : []),
]

export const config = createConfig({
  chains: [baseSepolia],
  transports: {
    [baseSepolia.id]: http(rpcUrl),
  },
  connectors,
  pollingInterval: 10_000,
})
