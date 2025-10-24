// pages/_app.tsx
import type { AppProps } from 'next/app'
import { QueryClientProvider } from '@tanstack/react-query'
import { WagmiProvider, cookieToInitialState } from 'wagmi'
import { queryClient, config } from '../lib/wallet'

// ⬇️ فقط همینجا init را import کن
import '../lib/w3m-init'

import '../lib/ui.css'
export default function App({ Component, pageProps }: AppProps) {
  const initialState = cookieToInitialState(config)
  return (
    <QueryClientProvider client={queryClient}>
      <WagmiProvider config={config} initialState={initialState}>
        <Component {...pageProps} />
      </WagmiProvider>
    </QueryClientProvider>
  )
}