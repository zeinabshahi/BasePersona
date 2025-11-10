// hooks/useWallet.ts
import { useQuery } from '@tanstack/react-query'

const USE_LOCAL_FALLBACK =
  (process.env.NEXT_PUBLIC_LOCAL_WALLET_API ?? '0') === '1'

export function useWallet(address?: string) {
  const addr = address?.toLowerCase()
  const enabled = !!addr && /^0x[0-9a-f]{40}$/.test(addr)

  return useQuery({
    queryKey: ['wallet', addr],
    enabled,
    retry: (count, err: any) => {
      if (err?.status === 404) return false
      return count < 2
    },
    staleTime: 60_000,
    queryFn: async () => {
      if (!enabled) throw Object.assign(new Error('disabled'), { status: 400 })

      // 1) CDN (GitHub raw via our API)
      let r = await fetch(`/api/wcdn/${addr}`, { cache: 'no-store' })
      if (r.ok) return r.json()

      // 2) Optional fallback: local DB
      if (USE_LOCAL_FALLBACK) {
        r = await fetch(`/api/wallet?address=${addr}`, { cache: 'no-store' })
        if (r.ok) return r.json()
      }

      const err = new Error(`HTTP ${r.status}`)
      ;(err as any).status = r.status
      throw err
    },
  })
}
