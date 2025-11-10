import * as React from 'react';
import WalletFrames from './WalletFrames';
import css from './frames.module.css';

type MonthOpt = { ym: number; label: string };

type Rank = { rank:number; pct:number; score?:number };
type Monthly = {
  month: string; ym: number;
  avg_balance_usd?: number; avg_balance_eth?: number;
  volume_usd?: number; swap_volume_usd?: number; bridge_volume_usd?: number;
  native_txs?: number; token_txs?: number;
  uniq_contracts?: number; uniq_days?: number; uniq_weeks?: number;
  nft_unique_contracts?: number; nft_holds_builder?: number; nft_holds_introduced?: number;
  tokens_traded_unique?: number; gas_spent_eth?: number;
  ranks?: { balance?:Rank; volume?:Rank; activity?:Rank; nft?:Rank; overall?:Rank } | null;
};
type Summary = {
  current_streak_months?: number;
  best_streak_months?: number;
  active_months_total?: number;
  wallet_age_days?: number;
  cum_ranks?: { balance?: { rank:number; pct:number; bucket?:string }; activity?:Rank; volume?:Rank;
                overall?: { score:number; rank:number; pct:number } } | null;
};
type Payload = { summary: Summary; monthly: Monthly[] };

type Props = {
  address: string;                       // همیشه string بده (حتی '')
  selectedYm: number | null;
  onMonthsLoaded: (list: MonthOpt[]) => void;
  onSelectionChange: (ym: number) => void;
};

export default function WalletMetrics({
  address,
  selectedYm,
  onMonthsLoaded,
  onSelectionChange,
}: Props) {
  const [err, setErr] = React.useState<string | null>(null);

  // فقط برای پر کردن دراپ‌داون ماه‌ها در بالای صفحه
  React.useEffect(() => {
    let off = false;
    async function loadMonths() {
      setErr(null);
      if (!address) { onMonthsLoaded([]); return; }
      try {
        const r = await fetch(`/api/metrics?address=${address.toLowerCase()}`);
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const j = (await r.json()) as Payload;
        const opts = (j.monthly || [])
          .map(m => ({ ym: m.ym, label: m.month }))
          .sort((a, b) => a.ym - b.ym);
        if (!off) onMonthsLoaded(opts);
        // اگر parent ماه خاصی انتخاب کرد، بهش خبر بده (اگر داخل لیست بود)
        if (!off && selectedYm != null && opts.some(o => o.ym === selectedYm)) {
          onSelectionChange(selectedYm);
        }
      } catch (e: any) {
        if (!off) setErr(e?.message || 'failed to load months');
      }
    }
    loadMonths();
    return () => { off = true; };
  }, [address]);

  return (
    <div className={css.wrap} style={{ paddingTop: 0 }}>
      {err && <div className={css.error}>Error: {err}</div>}
      {/* کل Grid و اسپارک‌ها در همین کامپوننت رندر می‌شود */}
      {address ? <WalletFrames address={address} /> : null}
    </div>
  );
}
