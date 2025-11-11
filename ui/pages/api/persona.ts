// pages/api/persona.ts
import type { NextApiRequest, NextApiResponse } from 'next';

function nz(n: any, d = 0) { const x = Number(n); return Number.isFinite(x) ? x : d; }
function clamp(n: number, a: number, b: number) { return Math.max(a, Math.min(b, n)); }

function rankBandFromPercentile(p: number) {
  if (!Number.isFinite(p)) return { band: 'Unknown', label: 'midfield' };
  if (p <= 1)  return { band: 'Apex',         label: 'top decile' };
  if (p <= 5)  return { band: 'Elite',        label: 'top 5%' };
  if (p <= 10) return { band: 'Trailblazer',  label: 'top 10%' };
  if (p <= 20) return { band: 'Veteran',      label: 'upper tier' };
  if (p <= 40) return { band: 'Seasoned',     label: 'upper-mid' };
  if (p <= 60) return { band: 'Explorer',     label: 'midfield' };
  if (p <= 80) return { band: 'Casual',       label: 'lower-mid' };
  return           { band: 'Newcomer',     label: 'fresh wave' };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  try {
    const { metrics = {}, address = '' } = req.body || {};

    const txs    = nz(metrics.total_txs);
    const uniq   = nz(metrics.unique_contracts);
    const actD   = nz(metrics.active_days);
    const ageD   = Math.max(nz(metrics.wallet_age_days), actD, 1);
    const months = nz(metrics.unique_months ?? metrics.active_months ?? 1);
    const volume = nz(metrics.volume_eth);
    const nft    = nz(metrics.nft_contracts ?? metrics.nft_mints);
    const dex    = nz(metrics.dex_trades);
    const cohort = nz(metrics.cohort_size, 940000);
    const gRank  = nz(metrics.global_rank ?? metrics.rank_global ?? metrics.rank);

    const percentile = gRank > 0 && cohort > 0 ? (gRank / cohort) * 100 : NaN;
    const rankInfo   = rankBandFromPercentile(percentile);

    const engagement      = clamp(actD / ageD, 0, 1);
    const intensityPerDay = clamp(txs / Math.max(actD, 1), 0, 999);
    const diversification  = clamp(uniq / Math.max(txs, 1), 0, 1);

    let archetype = 'Explorer';
    if (dex >= 80 || volume >= 20 || intensityPerDay >= 20) archetype = 'Degen';
    else if (nft >= 20 && uniq >= 30)                       archetype = 'Collector';
    else if (uniq >= 120 || (intensityPerDay >= 10 && months >= 8)) archetype = 'Power User';
    else if (engagement < 0.05 && txs > 0)                  archetype = 'Dormant Holder';
    else if (uniq >= 40 && diversification >= 0.4)          archetype = 'Generalist';

    let tone: 'hype' | 'calm' | 'builderish' = 'calm';
    if (['Apex','Elite','Trailblazer','Veteran','Power User','Degen'].includes(rankInfo.band) || intensityPerDay >= 10) tone = 'hype';
    if (diversification >= 0.45 && dex < 10) tone = 'builderish';

    const personaJson = {
      address,
      archetype,
      tone,
      rank: { band: rankInfo.band, label: rankInfo.label },
      traitsText: [
        archetype,
        rankInfo.label,
        engagement >= 0.5 ? 'consistent' : (txs ? 'sporadic' : 'inactive'),
        intensityPerDay >= 12 ? 'fast-paced' : intensityPerDay >= 5 ? 'steady' : 'unhurried',
        diversification >= 0.4 ? 'curious' : 'focused',
      ],
      signals: { engagement, intensityPerDay, diversification, spanMonths: months },
    };

    return res.status(200).json({ personaJson });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'persona_failed' });
  }
}
