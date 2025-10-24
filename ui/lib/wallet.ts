// lib/wallet.ts
import { createConfig, http, cookieStorage, createStorage } from 'wagmi'
import { base } from 'wagmi/chains'
import { injected, walletConnect } from '@wagmi/connectors'
import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: false } },
})

/** خواندن تنظیمات از env */
const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID
const appUrl =
  process.env.NEXT_PUBLIC_APP_URL ||
  (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000')

/** metadata توصیه‌شده برای WalletConnect (نمایش در کیف‌ها) */
const metadata = {
  name: process.env.NEXT_PUBLIC_APP_NAME || 'Base Persona',
  description: 'Onchain persona analytics & mint.',
  url: appUrl,
  icons: [`${appUrl}/favicon.ico`], // اگر آیکون اختصاصی داری مسیرش را بگذار
}

/** فقط اگر Project ID داریم، کانکتور WalletConnect را اضافه کن */
const connectors = [
  // injected برای MetaMask/Brave/…  — محدود به target خاص نکن تا پوشش کامل باشد
  injected({ shimDisconnect: true }),

  ...(projectId
    ? [
        walletConnect({
          projectId,
          showQrModal: false,    // چون Web3Modal داریم، QR داخلی WC را خاموش کن
          metadata,              // کمک می‌کند اتصال در برخی کیف‌ها روان‌تر شود
        }),
      ]
    : []),
]

export const config = createConfig({
  chains: [base],
  transports: { [base.id]: http(process.env.NEXT_PUBLIC_RPC_URL) },
  connectors,
  ssr: true,
  storage: createStorage({ storage: cookieStorage }),
})
