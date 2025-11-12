'use client';

import * as React from 'react';
import useSWR from 'swr';
import styles from './frames.module.css';

type Rank = { rank: number; pct: number; score?: number }
type Monthly = {
  month: string; ym: number;
  avg_balance_eth?: number; volume_usd?: number;
  swap_volume_usd?: number; bridge_volume_usd?: number;
  native_txs?: number; token_txs?: number;
  uniq_contracts?: number; uniq_days?: number; uniq_weeks?: number;
  nft_unique_contracts?: number; gas_spent_eth?: number; tokens_traded_unique?: number;
  ranks?: { overall?: Rank } | null;
}
type Summary = {
  active_months_total?: number; wallet_age_days?: number;
  current_streak_months?: number; best_streak_months?: number;
  cum_ranks?: { overall?: { score: number; rank: number; pct: number } } | null;
}
type Payload = { summary: Summary; monthly: Monthly[] }
type MonthOpt = { ym: number; label: string }

type Props = {
  address?: string
  selectedYm: number | null
  onMonthsLoaded?: (list: MonthOpt[]) => void
  /** وقتی روی نقطه‌ای کلیک می‌شود، والد می‌تواند selectedYm را به آن ماه ببرد */
  onSelectionChange?: (ym: number) => void
}

const fmt = (n?: number, d = 2) => (n == null || Number.isNaN(n) ? '—' : Number(n).toFixed(d))
const sum = (arr: number[]) => arr.reduce((a, b) => a + b, 0)
const mean = (arr: number[]) => (arr.length ? sum(arr) / arr.length : 0)
function delta(cur?: number, prev?: number) {
  if (cur == null || prev == null) return { diff: null as number | null, pct: null as number | null, sign: 0 as -1 | 0 | 1 }
  const diff = cur - prev
  const pct = prev === 0 ? (cur === 0 ? 0 : 100) : (diff / prev) * 100
  return { diff, pct, sign: diff === 0 ? 0 : (diff > 0 ? 1 : -1) as -1 | 0 | 1 }
}

/** Dropdown label: “YYYY-MM • Mon YYYY” */
function longMonthLabel(m: string) {
  const [y, mm] = m.split('-').map(x => parseInt(x, 10));
  const dt = new Date(y, (mm || 1) - 1, 1);
  const long = dt.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  return `${m} • ${long}`;
}
/** Chart label: “Mon YYYY” (text only) */
function shortMonthLabel(m: string) {
  const [y, mm] = m.split('-').map(x => parseInt(x, 10));
  const dt = new Date(y, (mm || 1) - 1, 1);
  return dt.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

/** Spark chart with two-line tooltip + CLICKABLE points */
function Spark({
  series, labels, selected, color, tooltipLabel, onPick,
}:{
  series: number[]; labels: string[]; selected: number; color: string; tooltipLabel: string;
  onPick?: (index: number) => void;
}) {
  const w = 320, h = 96, pad = 10;
  const n = series.length;
  const xs = series.map((_, i) => pad + (n > 1 ? (i * (w - pad * 2)) / (n - 1) : 0));
  const max = Math.max(0.0001, ...series);
  const y = (v: number) => h - pad - (v / max) * (h - pad * 2);
  const d = xs.map((x, i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y(series[i]).toFixed(1)}`).join(' ');
  const area = `${d} L${xs[n - 1]?.toFixed(1) || pad},${(h - pad).toFixed(1)} L${xs[0]?.toFixed(1) || pad},${(h - pad).toFixed(1)} Z`;

  const fillSoft = color.replace('rgb', 'rgba').replace(')', ',.16)');
  const dotFill = color.replace('rgb', 'rgba').replace(')', ',.95)');
  const selStroke = '#ffffff';

  return (
    <div>
      <div className={styles.sparkWrap}>
        <svg viewBox={`0 0 ${w} ${h}`} className={styles.spark} preserveAspectRatio="none">
          <path d={area} style={{ fill: fillSoft }} />
          <path d={d} style={{ stroke: color, strokeWidth: 2, fill: 'none' }} />
          {xs.map((x, i) => {
            const selectedDot = i === selected;
            const cy = y(series[i]);
            const handleClick = () => onPick?.(i);
            const handleKey = (e: React.KeyboardEvent<SVGCircleElement>) => {
              if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick?.(i); }
            };
            return (
              <g key={i}>
                {/* invisible hit zone for easy clicks */}
                <circle
                  cx={x}
                  cy={cy}
                  r={8}
                  style={{ fill: 'transparent', cursor: onPick ? 'pointer' : 'default' }}
                  onClick={handleClick}
                />
                <circle
                  cx={x}
                  cy={cy}
                  r={selectedDot ? 4 : 3}
                  role="button"
                  tabIndex={0}
                  aria-label={`${labels[i]} • ${series[i]} ${tooltipLabel}`}
                  onClick={handleClick}
                  onKeyDown={handleKey}
                  style={{
                    fill: dotFill,
                    stroke: selectedDot ? selStroke : 'none',
                    strokeWidth: selectedDot ? 1.5 : 0,
                    cursor: onPick ? 'pointer' : 'default',
                    transition: 'r .1s',
                  }}
                >
                  <title>{`${labels[i]}\n${series[i]} ${tooltipLabel}`}</title>
                </circle>
              </g>
            );
          })}
        </svg>
      </div>
      {/* start/end dates under chart */}
      <div style={{display:'flex', justifyContent:'space-between', fontSize:12, opacity:.7, marginTop:4}}>
        <span>{labels[0] || ''}</span>
        <span>{labels[labels.length-1] || ''}</span>
      </div>
    </div>
  );
}

const Arrow = ({ s }: { s: -1 | 0 | 1 }) =>
  s > 0 ? <span className={styles.up}>▲</span> : s < 0 ? <span className={styles.down}>▼</span> : <span className={styles.flat}>■</span>

/** SWR fetcher with AbortController */
const fetcher = (url: string) => {
  const ctrl = new AbortController();
  const p = fetch(url, { signal: ctrl.signal, cache: 'no-store' }).then(r => {
    if (!r.ok) throw new Error(`metrics ${r.status}`);
    return r.json();
  });
  // @ts-ignore
  p.cancel = () => ctrl.abort();
  return p as Promise<Payload>;
};

/** Demo payload (stable shape) */
function demoPayload(): Payload {
  const months: Monthly[] = [];
  const base = new Date(); base.setMonth(base.getMonth() - 11);
  for (let i = 0; i < 12; i++) {
    const y = base.getFullYear(), m = base.getMonth() + 1;
    const ym = Number(`${y}${String(m).padStart(2, '0')}`);
    const month = `${y}-${String(m).padStart(2, '0')}`;
    const rnd = (a: number, b: number) => a + Math.random() * (b - a);
    months.push({
      month, ym,
      avg_balance_eth: +rnd(0.05, 2.5).toFixed(3),
      native_txs: Math.floor(rnd(0, 40)),
      token_txs: Math.floor(rnd(0, 20)),
      uniq_contracts: Math.floor(rnd(1, 12)),
      uniq_days: Math.floor(rnd(0, 25)),
      uniq_weeks: Math.floor(rnd(0, 28)),
      nft_unique_contracts: Math.floor(rnd(0, 5)),
      gas_spent_eth: +rnd(0, 0.05).toFixed(4),
      ranks: { overall: { rank: Math.floor(rnd(10000, 80000)), pct: rnd(0, 1) } },
    });
    base.setMonth(base.getMonth() + 1);
  }
  return { summary: { active_months_total: months.length, wallet_age_days: 0, cum_ranks: { overall: { score: 0, rank: 0, pct: 0 } } }, monthly: months };
}

const WalletMetrics: React.FC<Props> = ({ address, selectedYm, onMonthsLoaded, onSelectionChange }) => {
  const key = React.useMemo(() => {
    const ok = !!address && /^0x[a-fA-F0-9]{40}$/.test(address);
    return ok ? `/api/metrics?address=${address.toLowerCase()}` : null;
  }, [address]);

  const { data, error, isValidating } = useSWR<Payload>(key, fetcher, {
    dedupingInterval: 30_000,
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    shouldRetryOnError: false,
  });

  const isDemo = !key || !!error;
  const isLoadingReal = !!key && !data && !error;

  const dataOrDemo = React.useMemo<Payload>(() => {
    if (!key) return demoPayload();
    if (error) return demoPayload();
    return data ?? demoPayload();
  }, [key, data, error]);

  // send month list to parent (dropdown uses long label)
  const onMonthsLoadedRef = React.useRef(onMonthsLoaded);
  React.useEffect(() => { onMonthsLoadedRef.current = onMonthsLoaded }, [onMonthsLoaded]);
  React.useEffect(() => {
    const months = dataOrDemo.monthly || [];
    const list = months.map(m => ({ ym: m.ym, label: longMonthLabel(m.month) }));
    onMonthsLoadedRef.current?.(list);
  }, [dataOrDemo]);

  const months = dataOrDemo.monthly ?? [];
  const labels = React.useMemo(() => months.map(m => shortMonthLabel(m.month)), [months]);

  const selIndex = React.useMemo(() => {
    if (months.length === 0) return 0;
    if (selectedYm == null) return months.length - 1;
    const i = months.findIndex(m => m.ym === selectedYm);
    return i >= 0 ? i : months.length - 1;
  }, [months, selectedYm]);

  const modeAllTime = selectedYm == null;
  const cur = months[selIndex] ?? {};
  const prev = months[selIndex - 1] ?? {};

  const sBal   = React.useMemo(() => months.map(m => Number(m.avg_balance_eth || 0)), [months]);
  const sTrades= React.useMemo(() => months.map(m => Number(m.token_txs || 0)), [months]);
  const sTxs   = React.useMemo(() => months.map(m => Number(m.native_txs || 0)), [months]);
  const sUniq  = React.useMemo(() => months.map(m => Number(m.uniq_contracts || 0)), [months]);
  const sDays  = React.useMemo(() => months.map(m => Number(m.uniq_days || 0)), [months]);
  const sStreak= React.useMemo(() => months.map(m => Number(m.uniq_weeks || 0)), [months]);
  const sGas   = React.useMemo(() => months.map(m => Number(m.gas_spent_eth || 0)), [months]);
  const sNft   = React.useMemo(() => months.map(m => Number(m.nft_unique_contracts || 0)), [months]);
  const sRank  = React.useMemo(() => months.map(m => Number(m.ranks?.overall?.rank ?? 0)), [months]);

  const V = {
    balance: modeAllTime ? mean(sBal) : (cur as any).avg_balance_eth ?? 0,
    trades:  modeAllTime ? sum(sTrades) : (cur as any).token_txs ?? 0,
    txs:     modeAllTime ? sum(sTxs)    : (cur as any).native_txs ?? 0,
    uniq:    modeAllTime ? sum(sUniq)   : (cur as any).uniq_contracts ?? 0,
    days:    modeAllTime ? sum(sDays)   : (cur as any).uniq_days ?? 0,
    streak:  modeAllTime ? Math.max(...sStreak, 0) : (cur as any).uniq_weeks ?? 0,
    gas:     modeAllTime ? sum(sGas)    : (cur as any).gas_spent_eth ?? 0,
    nft:     modeAllTime ? sum(sNft)    : (cur as any).nft_unique_contracts ?? 0,
    rank:    modeAllTime ? (Math.min(...sRank.filter(x => x > 0)) || 0) : (cur as any).ranks?.overall?.rank ?? 0,
  };

  const dBalance = modeAllTime ? null : delta((cur as any).avg_balance_eth, (prev as any)?.avg_balance_eth);
  const dTrades  = modeAllTime ? null : delta((cur as any).token_txs,      (prev as any)?.token_txs);
  const dTxs     = modeAllTime ? null : delta((cur as any).native_txs,     (prev as any)?.native_txs);
  const dUniq    = modeAllTime ? null : delta((cur as any).uniq_contracts, (prev as any)?.uniq_contracts);
  const dDays    = modeAllTime ? null : delta((cur as any).uniq_days,      (prev as any)?.uniq_days);
  const dStreak  = modeAllTime ? null : delta((cur as any).uniq_weeks,     (prev as any)?.uniq_weeks);
  const dGas     = modeAllTime ? null : delta((cur as any).gas_spent_eth,  (prev as any)?.gas_spent_eth);
  const dNft     = modeAllTime ? null : delta((cur as any).nft_unique_contracts, (prev as any)?.nft_unique_contracts);
  const dRank    = modeAllTime ? null : (() => {
    const a = (cur as any).ranks?.overall?.rank, b = (prev as any)?.ranks?.overall?.rank;
    if (a == null || b == null) return null;
    const diff = b - a;
    return { diff, pct: null, sign: diff === 0 ? 0 : (diff > 0 ? 1 : -1) as -1 | 0 | 1 };
  })();

  const pickIndex = React.useCallback((i: number) => {
    const ym = months[i]?.ym;
    if (ym && onSelectionChange) onSelectionChange(ym);
  }, [months, onSelectionChange]);

  const Card = ({
    title, value, unit, deltaObj, series, labels, color, subtitle, footNote, tooltipLabel,
  }: {
    title: string; value: string; unit?: string;
    deltaObj?: { diff: number | null; pct: number | null; sign: -1 | 0 | 1 } | null;
    series: number[]; labels: string[]; color: string; subtitle?: string; footNote?: string;
    tooltipLabel: string;
  }) => (
    <div className={styles.card}>
      <div className={styles.head}>
        <div className={styles.title}>{title}</div>
        <div className={styles.rank}>{footNote ?? ' '}</div>
      </div>
      <div className={styles.row}>
        <div className={styles.big}>
          {value}{unit ? <span style={{ fontSize: 14, marginLeft: 6 }}>{unit}</span> : null}
        </div>
        <div className={styles.sub}>{subtitle ?? ''}</div>
        <div className={styles.delta}>
          {deltaObj
            ? (<><Arrow s={deltaObj.sign} /> {deltaObj.diff == null ? '—' : fmt(deltaObj.diff, 2)} <span className={styles.muted}>{deltaObj.pct == null ? '' : `(${fmt(deltaObj.pct, 1)}%)`}</span></>)
            : '—'}
        </div>
      </div>
      <Spark
        series={series}
        labels={labels}
        selected={selIndex}
        color={color}
        tooltipLabel={tooltipLabel}
        onPick={pickIndex}
      />
    </div>
  );

  return (
    <div className={styles.grid}>
      {/* در حالت دمو یک نوت کوچک نشان می‌دهیم */}
      {isDemo && (
        <div className={styles.muted} style={{gridColumn:'1 / -1', marginBottom: 4}}>
          Showing demo data (connect a wallet or enter an address to see real metrics)
        </div>
      )}

      {/* اگر واقعا در حال لودِ آدرس معتبر هستیم، یک خط لودینگ کوچک */}
      {isLoadingReal && (
        <div className={styles.muted} style={{gridColumn:'1 / -1', marginBottom: 4}}>
          Loading metrics…
        </div>
      )}

      <Card title="Balance (ETH)" value={fmt(V.balance, 3)} deltaObj={dBalance ?? undefined}
            series={sBal} labels={labels} color="rgb(59,130,246)" subtitle="on-chain (avg)" tooltipLabel="ETH balance" />
      <Card title="Trades (count)" value={fmt(V.trades, 0)} deltaObj={dTrades ?? undefined}
            series={sTrades} labels={labels} color="rgb(16,185,129)" subtitle="swap/trade tx count" tooltipLabel="trades" />
      <Card title="Transactions" value={fmt(V.txs, 0)} deltaObj={dTxs ?? undefined}
            series={sTxs} labels={labels} color="rgb(37,99,235)" subtitle="txs per month" tooltipLabel="transactions" />
      <Card title="Unique Contracts" value={fmt(V.uniq, 0)} deltaObj={dUniq ?? undefined}
            series={sUniq} labels={labels} color="rgb(234,179,8)" subtitle="per month" tooltipLabel="unique contracts" />
      <Card title="Active Days" value={fmt(V.days, 0)} deltaObj={dDays ?? undefined}
            series={sDays} labels={labels} color="rgb(147,51,234)" subtitle="per month" tooltipLabel="active days" />
      <Card title="Best Streak (days)" value={fmt(V.streak, 0)} deltaObj={dStreak ?? undefined}
            series={sStreak} labels={labels} color="rgb(245,158,11)" subtitle="within month" tooltipLabel="best streak (days)" />
      <Card title="Gas Paid (ETH)" value={fmt(V.gas, 4)} deltaObj={dGas ?? undefined}
            series={sGas} labels={labels} color="rgb(244,63,94)" subtitle={selectedYm==null ? "all-time" : "this month"} tooltipLabel="ETH gas" />
      <Card title="NFT (count)" value={fmt(V.nft, 0)} deltaObj={dNft ?? undefined}
            series={sNft} labels={labels} color="rgb(99,102,241)" subtitle="unique NFT contracts" tooltipLabel="NFT contracts" />
      <Card title="Monthly Rank" value={V.rank ? `#${fmt(V.rank, 0)}` : '—'} deltaObj={dRank ?? undefined}
            series={sRank} labels={labels} color="rgb(107,114,128)" subtitle="better is lower" tooltipLabel="rank (lower is better)" />

      {isValidating && <div className={styles.muted} style={{gridColumn:'1 / -1'}}>Refreshing…</div>}
    </div>
  );
}

export default WalletMetrics;
