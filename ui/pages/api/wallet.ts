// pages/api/wallet.ts
import type { NextApiRequest, NextApiResponse } from 'next'

/**
 * Sample wallet API.
 * Query: /api/wallet?address=0x...
 *
 * NOTE: Replace the mocked logic with calls to Moralis/Covalent/Alchemy
 * to return real metrics. Keep API key server-side (env var).
 */

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const address = (req.query.address as string || '').toLowerCase()
  if (!address) {
    res.status(400).json({ error: 'Missing address query' })
    return
  }

  // TODO: Replace this mocked response with real provider calls.
  const sample = {
    address,
    baseBuilderHolder: Math.random() > 0.7,
    baseIntroducedHolder: Math.random() > 0.85,
    balanceETH: +(Math.random() * 3).toFixed(6),
    volumeETH: +(Math.random() * 30).toFixed(3),
    nativeTxCount: Math.floor(Math.random()*500),
    tokenTxCount: Math.floor(Math.random()*200),
    totalContractInteractions: Math.floor(Math.random()*300),
    uniqueContractInteractions: Math.floor(Math.random()*80),
    walletAgeDays: Math.floor(Math.random()*2000),
    uniqueDays: Math.floor(Math.random()*300),
    uniqueWeeks: Math.floor(Math.random()*100),
    uniqueMonths: Math.floor(Math.random()*36)
  }

  res.status(200).json(sample)
}
