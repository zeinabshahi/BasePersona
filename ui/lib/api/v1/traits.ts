import type { NextApiRequest, NextApiResponse } from 'next'
import { pickTraits } from '../../../lib/traits'
import { buildPrompt } from '../../../lib/prompt'
import { canonicalJson, toKeccakHex } from '../../../lib/utils'

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ ok:false, error:'method_not_allowed' })
  try {
    const { address, metrics = {}, modelVersion = 1 } = req.body || {}
    if (!address) return res.status(400).json({ ok:false, error:'missing_address' })

    const w = {
      address: String(address),
      wallet_birth_month: Number(metrics.wallet_birth_month) || undefined,
      wallet_age_days: Number(metrics.wallet_age_days) || undefined,
      unique_contracts: Number(metrics.unique_contracts ?? 0),
      active_days: Number(metrics.active_days ?? 0),
      total_txs: Number(metrics.total_txs ?? 0),
      distinct_tokens: Number(metrics.distinct_tokens ?? 0),
      dex_trades: Number(metrics.dex_trades ?? 0),
      nft_mints: Number(metrics.nft_mints ?? 0),
      holds_builder: !!metrics.baseBuilderHolder,
      holds_introduced: !!metrics.baseIntroducedHolder
    }
    const { traits, names } = pickTraits(w as any)
    const prompt = buildPrompt(traits)
    const promptHash = toKeccakHex(canonicalJson({ names, prompt, modelVersion }))
    res.status(200).json({ ok:true, names, prompt, promptHash })
  } catch (e:any) {
    res.status(500).json({ ok:false, error:e?.message || 'traits_failed' })
  }
}
