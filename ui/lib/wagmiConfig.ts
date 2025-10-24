import { createConfig, http } from 'wagmi'
import { base } from 'viem/chains'
import { injected, walletConnect } from '@wagmi/connectors'

let _config: ReturnType<typeof createConfig> | null = null

export function getWagmiConfig() {
  if (_config) return _config
  _config = createConfig({
    chains: [base],
    transports: { [base.id]: http() },
    connectors: [
      injected({ shimDisconnect: true, target: 'metaMask' }),
      walletConnect({ projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID! }),
    ],
  })
  return _config
}
