// pages/api/traits.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { pickSpeciesByNibble, type SpeciesId } from '../../lib/species';
import { pickTraits, type Metrics } from '../../lib/traits';

function isAddr(s?: string) {
  return !!s && /^0x[a-fA-F0-9]{40}$/.test(String(s));
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST')
    return res.status(405).json({ ok: false, error: 'method_not_allowed' });

  try {
    const { address, metrics = {} } = (req.body || {}) as {
      address?: string;
      metrics?: Partial<Metrics>;
    };
    if (!isAddr(address))
      return res.status(400).json({ ok: false, error: 'bad_address' });

    const species: SpeciesId = pickSpeciesByNibble(address!);
    const traitsJson = pickTraits(
      {
        uniqueContracts: Number(metrics.uniqueContracts ?? metrics.uniqContracts ?? 0),
        activeDays: Number(metrics.activeDays ?? metrics.uniqDays ?? 0),
        gasEth: Number(metrics.gasEth ?? metrics.gas ?? 0),
        monthlyRank: Number(metrics.monthlyRank ?? metrics.rank ?? 9_999_999),
        nftCount: Number(metrics.nftCount ?? metrics.nftMints ?? 0),
        balanceEth: Number(metrics.balanceEth ?? metrics.balance ?? 0),
        totalTxs: Number(metrics.totalTxs ?? metrics.txs ?? 0),
      },
      species
    );

    return res.status(200).json({
      ok: true,
      address,
      species,
      traitsJson,
    });
  } catch (e: any) {
    return res
      .status(500)
      .json({ ok: false, error: e?.message || 'traits_failed' });
  }
}
