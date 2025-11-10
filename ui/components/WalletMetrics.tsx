import * as React from "react";
import css from "./frames.module.css"; // از همون استایل‌های قبلی استفاده می‌کنیم

type Rank = { rank: number; pct: number; score?: number };
type Monthly = {
  month: string;
  ym: number;
  avg_balance_eth?: number;   // bal
  native_txs?: number;        // txs
  token_txs?: number;         // trade
  uniq_contracts?: number;    // uniq
  uniq_days?: number;         // days
  uniq_weeks?: number;        // streak (days)
  nft_unique_contracts?: number; // nft
  gas_spent_eth?: number;     // gas
  ranks?: { overall?: Rank } | null;
};
type Summary = { /* فعلاً استفاده خاصی نداریم؛ همه‌چیز ماه‌محور است */ };
type Payload = { summary: Summary; monthly: Monthly[] };

type MonthOpt = { ym: number; label: string };

function fmt(n?: number, d = 2) {
  if (n == null || Number.isNaN(n)) return "—";
  return Number(n).toFixed(d);
}
function sum(a: number[]) { return a.reduce((s, x) => s + (Number(x) || 0), 0); }
function avg(a: number[]) { return a.length ? sum(a) / a.length : 0; }

type SparkProps = {
  series: number[];
  labels: string[];
  selected: number;
  onSelect: (i: number) => void;
};
function Spark({ series, labels, selected, onSelect }: SparkProps) {
  const w = 520, h = 130, pad = 12;
  const n = series.length || 1;
  const xs = series.map((_, i) => pad + (n > 1 ? (i * (w - pad * 2)) / (n - 1) : 0));
  const max = Math.max(0.0001, ...series);
  const min = Math.min(...series, 0);
  const y = (v: number) => {
    const rr = max - min || 1;
    return h - pad - ((v - min) / rr) * (h - pad * 2);
  };
  const d = xs.map((x, i) => `${i ? "L" : "M"}${x.toFixed(1)},${y(series[i]).toFixed(1)}`).join(" ");
  const area = `${d} L${xs.at(-1)?.toFixed(1) ?? pad},${(h - pad).toFixed(1)} L${xs[0]?.toFixed(1) ?? pad},${(h - pad).toFixed(1)} Z`;
  const showEvery = Math.max(1, Math.ceil(n / 6));
  return (
    <div className={css.sparkWrap}>
      <svg viewBox={`0 0 ${w} ${h}`} className={css.spark} preserveAspectRatio="none">
        <path d={area} style={{ fill: "rgba(59,130,246,.12)" }} />
        <path d={d} style={{ stroke: "rgb(59,130,246)", strokeWidth: 2, fill: "none" }} />
        {xs.map((x, i) => (
          <circle
            key={i}
            cx={x}
            cy={y(series[i])}
            r={i === selected ? 4 : 2}
            className={i === selected ? css.dotSel : css.dot}
            onClick={() => onSelect(i)}
          />
        ))}
      </svg>
      <div className={css.ticks}>
        {labels.map((lb, i) => (
          <button
            key={i}
            type="button"
            className={i === selected ? css.tickSel : css.tick}
            onClick={() => onSelect(i)}
            style={{ visibility: i % showEvery === 0 || i === labels.length - 1 ? "visible" : "hidden" }}
            title={lb}
          >
            {lb}
          </button>
        ))}
      </div>
    </div>
  );
}

type Props = {
  address: string;                     // همیشه string؛ صفحه بهش "" می‌ده
  selectedYm: number | null;           // null = All time
  onMonthsLoaded: (list: MonthOpt[]) => void;
  onSelectionChange: (ym: number) => void;
};

export default function WalletMetrics({ address, selectedYm, onMonthsLoaded, onSelectionChange }: Props) {
  const [data, setData] = React.useState<Payload | null>(null);
  const [err, setErr] = React.useState<string | null>(null);

  // بازه نمایش (Last 6 / Last 12 / All time)
  const [preset, setPreset] = React.useState<"last6" | "last12" | "all">("all");
  const [selIdx, setSelIdx] = React.useState<number>(0);
  const [r0, setR0] = React.useState<number>(0);
  const [r1, setR1] = React.useState<number>(0);

  // fetch
  React.useEffect(() => {
    let off = false;
    async function load() {
      try {
        setErr(null);
        if (!address || address.length < 4) { setData(null); return; }
        const r = await fetch(`/api/metrics?${new URLSearchParams({ address: address.toLowerCase() }).toString()}`);
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const j = (await r.json()) as Payload;
        j.monthly.sort((a, b) => a.month.localeCompare(b.month));
        if (off) return;
        setData(j);
        const last = j.monthly.length - 1;
        setSelIdx(last);
        setR0(0);
        setR1(last);
        setPreset("all");

        // کرکرهٔ ماه‌ها
        const monthsList: MonthOpt[] = j.monthly.map(m => ({ ym: m.ym, label: m.month }));
        onMonthsLoaded(monthsList);
      } catch (e: any) {
        if (!off) setErr(e?.message || "fetch failed");
      }
    }
    load();
    return () => { off = true; };
  }, [address, onMonthsLoaded]);

  // اگر از بیرون ماه انتخاب شد، ایندکس محلی را سینک کن
  React.useEffect(() => {
    if (!data || selectedYm == null) return;
    const idx = data.monthly.findIndex(m => m.ym === selectedYm);
    if (idx >= 0) setSelIdx(idx);
  }, [selectedYm, data]);

  if (!data) return err ? <div className={css.error}>Error: {err}</div> : null;

  const months = data.monthly;
  const view = months.slice(Math.max(0, r0), Math.min(months.length - 1, r1) + 1);
  const localSel = Math.min(Math.max(selIdx - r0, 0), Math.max(0, view.length - 1));
  const cur = view[localSel] ?? months.at(-1)!;

  // سری‌های کارت‌ها (دقیقاً مثل یوآی قدیمی)
  const labels = view.map(x => x.month);
  const sBal = view.map(x => Number(x.avg_balance_eth || 0));
  const sTrades = view.map(x => Number(x.token_txs || 0)); // trade
  const sTxs = view.map(x => Number(x.native_txs || 0));   // txs
  const sUniq = view.map(x => Number(x.uniq_contracts || 0));
  const sDays = view.map(x => Number(x.uniq_days || 0));
  const sStreak = view.map(x => Number(x.uniq_weeks || 0)); // streak days
  const sGas = view.map(x => Number(x.gas_spent_eth || 0));
  const sNft = view.map(x => Number(x.nft_unique_contracts || 0));
  const sRank = view.map(x => Number(x.ranks?.overall?.rank ?? 0));

  // مقدارهای بزرگ کارت (All time = خلاصه؛ otherwise = مقدار ماهِ انتخابی)
  const AT = selectedYm == null;
  const big = {
    bal: AT ? avg(sBal) : (cur.avg_balance_eth ?? 0),
    trades: AT ? avg(sTrades) : (cur.token_txs ?? 0),
    txs: AT ? avg(sTxs) : (cur.native_txs ?? 0),
    uniq: AT ? avg(sUniq) : (cur.uniq_contracts ?? 0),
    days: AT ? avg(sDays) : (cur.uniq_days ?? 0),
    streak: AT ? Math.max(...sStreak) : (cur.uniq_weeks ?? 0),
    gas: AT ? avg(sGas) : (cur.gas_spent_eth ?? 0),
    nft: AT ? avg(sNft) : (cur.nft_unique_contracts ?? 0),
    rank: AT ? avg(sRank) : (cur.ranks?.overall?.rank ?? 0),
  };

  function applyPreset(v: "last6" | "last12" | "all") {
    setPreset(v);
    const n = months.length;
    if (v === "all") { setR0(0); setR1(n - 1); setSelIdx(n - 1); return; }
    const take = v === "last6" ? 6 : 12;
    const s = Math.max(0, n - take);
    setR0(s); setR1(n - 1); setSelIdx(n - 1);
  }
  function selectLocal(i: number) {
    const idx = r0 + i;
    setSelIdx(idx);
    const ym = months[idx]?.ym;
    if (ym != null) onSelectionChange(ym);
  }

  return (
    <div className={css.wrap}>
      {/* Toolbar قدیمی */}
      <div className={css.toolbar}>
        <div className={css.pills}>
          <button className={preset === "last6" ? css.pillSel : css.pill} onClick={() => applyPreset("last6")}>Last 6 months</button>
          <button className={preset === "last12" ? css.pillSel : css.pill} onClick={() => applyPreset("last12")}>Last 12 months</button>
          <button className={preset === "all" ? css.pillSel : css.pill} onClick={() => applyPreset("all")}>All time</button>
        </div>
        <div className={css.selMonth}>
          Month: <strong>{months[selIdx]?.month || "—"}</strong>
        </div>
        <div className={css.badge}>Best Streak: {Math.max(...sStreak)} days</div>
      </div>

      {/* GRID 3×3 با کارت‌های قدیمی */}
      <div className={css.grid}>
        {/* Row 1 */}
        <div className={css.card}>
          <div className={css.head}><div className={css.title}>Balance (ETH)</div></div>
          <div className={css.row}><div className={css.big}>{fmt(big.bal, 3)}</div><div className={css.sub}>{AT ? "on-chain (avg)" : "on-chain (avg)"}</div></div>
          <Spark series={sBal} labels={labels} selected={localSel} onSelect={selectLocal} />
        </div>

        <div className={css.card}>
          <div className={css.head}><div className={css.title}>Trades (count)</div></div>
          <div className={css.row}><div className={css.big}>{fmt(big.trades, 0)}</div><div className={css.sub}>swap/trade tx count</div></div>
          <Spark series={sTrades} labels={labels} selected={localSel} onSelect={selectLocal} />
        </div>

        <div className={css.card}>
          <div className={css.head}><div className={css.title}>Transactions</div></div>
          <div className={css.row}><div className={css.big}>{fmt(big.txs, 0)}</div><div className={css.sub}>txs per month</div></div>
          <Spark series={sTxs} labels={labels} selected={localSel} onSelect={selectLocal} />
        </div>

        {/* Row 2 */}
        <div className={css.card}>
          <div className={css.head}><div className={css.title}>Unique Contracts</div></div>
          <div className={css.row}><div className={css.big}>{fmt(big.uniq, 0)}</div><div className={css.sub}>per month</div></div>
          <Spark series={sUniq} labels={labels} selected={localSel} onSelect={selectLocal} />
        </div>

        <div className={css.card}>
          <div className={css.head}><div className={css.title}>Active Days</div></div>
          <div className={css.row}><div className={css.big}>{fmt(big.days, 0)}</div><div className={css.sub}>per month</div></div>
          <Spark series={sDays} labels={labels} selected={localSel} onSelect={selectLocal} />
        </div>

        <div className={css.card}>
          <div className={css.head}><div className={css.title}>Best Streak (days)</div></div>
          <div className={css.row}><div className={css.big}>{fmt(big.streak, 0)}</div><div className={css.sub}>within month</div></div>
          <Spark series={sStreak} labels={labels} selected={localSel} onSelect={selectLocal} />
        </div>

        {/* Row 3 */}
        <div className={css.card}>
          <div className={css.head}><div className={css.title}>Gas Paid (ETH)</div></div>
          <div className={css.row}><div className={css.big}>{fmt(big.gas, 6)}</div><div className={css.sub}>{AT ? "avg per month" : "this month"}</div></div>
          <Spark series={sGas} labels={labels} selected={localSel} onSelect={selectLocal} />
        </div>

        <div className={css.card}>
          <div className={css.head}><div className={css.title}>NFT (count)</div></div>
          <div className={css.row}><div className={css.big}>{fmt(big.nft, 0)}</div><div className={css.sub}>per month</div></div>
          <Spark series={sNft} labels={labels} selected={localSel} onSelect={selectLocal} />
        </div>

        <div className={css.card}>
          <div className={css.head}><div className={css.title}>Monthly Rank</div></div>
          <div className={css.row}><div className={css.big}>#{fmt(big.rank, 0)}</div><div className={css.sub}>better is lower</div></div>
          <Spark series={sRank} labels={labels} selected={localSel} onSelect={selectLocal} />
        </div>
      </div>
    </div>
  );
}
