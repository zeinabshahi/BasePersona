// ui/lib/wagmi.ts
import { createConfig, http } from 'wagmi'
import { baseSepolia } from 'wagmi/chains'
import { injected } from 'wagmi/connectors'
import { walletConnect } from 'wagmi/connectors/walletConnect'

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID as string

export const config = createConfig({
  chains: [baseSepolia],
  connectors: [
    injected({
      shimDisconnect: true,
      // هیچ فیلتری روی نام/provider نگذار؛ Brave هم از window.ethereum استفاده می‌کند.
    }),
    walletConnect({
      projectId,
      showQrModal: true,
      metadata: {
        name: 'Base Persona',
        description: 'GM streak + wallet stats',
        url: 'http://localhost:3000',
        icons: ['https://raw.githubusercontent.com/walletconnect/walletconnect-assets/master/Icon/Gradient/Icon.png'],
      },
    }),
  ],
  transports: {
    [baseSepolia.id]: http(process.env.NEXT_PUBLIC_RPC_URL || 'https://sepolia.base.org'),
  },
  pollingInterval: 10_000,
})
