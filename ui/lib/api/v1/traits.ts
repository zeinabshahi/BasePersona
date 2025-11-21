// lib/api/v1/traits.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { pickTraits } from '../../../lib/traits';
import { canonicalJson, toKeccakHex } from '../../../lib/utils';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  }

  try {
    const { address, metrics = {}, modelVersion = 1 } = (req.body || {}) as any;
    if (!address) {
      return res.status(400).json({ ok: false, error: 'missing_address' });
    }

    // متریک‌ها رو به فرمت جدید Metrics برای pickTraits نگه می‌داریم
    const m = {
      uniqueContracts: Number(
        metrics.unique_contracts ??
          metrics.uniqueContracts ??
          0,
      ),
      activeDays: Number(
        metrics.active_days ??
          metrics.activeDays ??
          0,
      ),
      gasEth: Number(
        metrics.gas_eth ??
          metrics.gasEth ??
          0,
      ),
      monthlyRank: Number(
        metrics.monthlyRank ??
          metrics.monthly_rank ??
          500000,
      ),
      nftCount: Number(
        metrics.nft_mints ??
          metrics.nftCount ??
          0,
      ),
      balanceEth: Number(
        metrics.balance_eth ??
          metrics.balanceEth ??
          0,
      ),
      totalTxs: Number(
        metrics.total_txs ??
          metrics.totalTxs ??
          metrics.txCount ??
          0,
      ),
    };

    // نسخه‌ی جدید pickTraits: m + species
    // این endpoint v1 فقط برای دیباگ/سازگاری قدیمیه → یه species ثابت می‌ذاریم
    const built = pickTraits(m as any, 'owl' as any);
    const names = built.names;

    // پرامپت جنریک فقط برای اینکه فیلد خالی نباشه
    const prompt =
      'waist-up portrait of a Base-native onchain persona, flat minimal cartoon/anime style, soft pastel background, 1:1 aspect ratio';

    const promptHash = toKeccakHex(
      canonicalJson({ names, prompt, modelVersion }),
    );

    return res.status(200).json({
      ok: true,
      names,
      prompt,
      promptHash,
    });
  } catch (e: any) {
    return res.status(500).json({
      ok: false,
      error: e?.message || 'traits_failed',
    });
  }
}
