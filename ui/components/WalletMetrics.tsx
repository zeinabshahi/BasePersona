// components/WalletMetrics.tsx
import * as React from 'react'
import styles from './frames.module.css'

/* ---------- types: مطابق /api/metrics ---------- */
type Rank = { rank: number; pct: number; score?: number }
type Monthly = {
  month: string
  ym: number
  avg_balance_eth?: number
  volume_usd?: number
  swap_volume_usd?: number
  bridge_volume_usd?: number
  native_txs?: number
  token_txs?: number
  uniq_contracts?: number
  uniq_days?: number
  uniq_weeks?: number
  nft_unique_contracts?: number
  gas_spent_eth?: number
  tokens_traded_unique?: number
  ranks?: { overall?: Rank } | null
}
type Summary = {
  active_months_total?: number
  wallet_age_days?: number
  current_streak_months?: number
  best_streak_months?: number
  cum_ranks?: { overall?: { score: number; rank: number; pct: number } } | null
}
type Payload = { summary: Summary; monthly: Monthly[] }

type MonthOpt = { ym: number; label: string }

type Props = {
  address?: string
  selectedYm: number | null
  onMonthsLoaded?: (list: MonthOpt[]) => void
  onSelectionChange?: (ym: number) => void
}

/* ---------- helpers ---------- */
const fmt = (n?: number, d = 2) =>
  n == null || Number.isNaN(n) ? '—' : Number(n).toFixed(d)

function sum(arr: number[]) { return arr.reduce((a, b) => a + b, 0) }
function mean(arr: number[]) { return arr.length ? sum(arr) / arr.length : 0 }

function delta(cur?: number, prev?: number) {
  if (cur == null || prev == null) return { diff: null as number | null, pct: null as number | null, sign: 0 as -1 | 0 | 1 }
  const diff = cur - prev
  const pct = prev === 0 ? (cur === 0 ? 0 : 100) : (diff / prev) * 100
  return { diff, pct, sign: diff === 0 ? 0 : (diff > 0 ? 1 : -1) as -1 | 0 | 1 }
}

/* mini spark (بدون لیبل‌های تاریخ) */
function Spark({
  series, labels, selected, color,
}: { series: number[]; labels: string[]; selected: number; color: string }) {
  const w = 320, h = 96, pad = 10
  const n = series.length
  const xs = series.map((_, i) => pad + (n > 1 ? (i * (w - pad * 2)) / (n - 1) : 0))
  const max = Math.max(0.0001, ...series)
  const y = (v: number) => h - pad - (v / max) * (h - pad * 2)
  const d = xs.map((x, i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y(series[i]).toFixed(1)}`).join(' ')
  const area = `${d} L${xs[n - 1]?.toFixed(1) || pad},${(h - pad).toFixed(1)} L${xs[0]?.toFixed(1) || pad},${(h - pad).toFixed(1)} Z`

  return (
    <div className={styles.sparkWrap}>
      <svg viewBox={`0 0 ${w} ${h}`} className={styles.spark} preserveAspectRatio="none">
        <path d={area} style={{ fill: color.replace('rgb', 'rgba').replace(')', ',.16)') }} />
        <path d={d} style={{ stroke: color, strokeWidth: 2, fill: 'none' }} />
        {xs.map((x, i) => (
          <circle
            key={i}
            cx={x}
            cy={y(series[i])}
            r={i === selected ? 4 : 2}
            className={i === selected ? styles.dotSel : styles.dot}
          >
            <title>{`${labels[i]} • ${series[i]}`}</title>
          </circle>
        ))}
      </svg>
    </div>
  )
}

function Arrow({ s }: { s: -1 | 0 | 1 }) {
  return s > 0 ? <span className={styles.up}>▲</span> : s < 0 ? <span className={styles.down}>▼</span> : <span className={styles.flat}>■</span>
}

/* ---------- demo payload (وقتی آدرس/فچ نامعتبر است) ---------- */
function demoPayload(): Payload {
  const months: Monthly[] = []
  const base = new Date(); base.setMonth(base.getMonth() - 11)
  for (let i = 0; i < 12; i++) {
    const y = base.getFullYear(), m = base.getMonth() + 1
    const ym = Number(`${y}${String(m).padStart(2, '0')}`)
    const month = `${y}-${String(m).padStart(2, '0')}`
    const rnd = (a: number, b: number) => a + Math.random() * (b - a)
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
    })
    base.setMonth(base.getMonth() + 1)
  }
  return { summary: { active_months_total: months.length, wallet_age_days: 0, cum_ranks: { overall: { score: 0, rank: 0, pct: 0 } } }, monthly: months }
}

/* ===================================== */
/*                COMPONENT              */
/* ===================================== */
const WalletMetrics: React.FC<Props> = ({ address, selectedYm, onMonthsLoaded, onSelectionChange }) => {
  const [data, setData] = React.useState<Payload | null>(null)
  const [err, setErr] = React.useState<string | null>(null)

  // fetch
  React.useEffect(() => {
    let off = false
    async function load() {
      setErr(null)
      try {
        if (!address || !/^0x[0-9a-fA-F]{40}$/.test(address)) {
          const d = demoPayload()
          if (!off) setData(d)
          if (!off && onMonthsLoaded) {
            onMonthsLoaded(d.monthly.map(m => ({ ym: m.ym, label: m.month })))
          }
          return
        }
        const r = await fetch(`/api/metrics?address=${address.toLowerCase()}`)
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        const j = (await r.json()) as Payload
        j.monthly.sort((a, b) => a.month.localeCompare(b.month))
        if (!off) setData(j)
        if (!off && onMonthsLoaded) {
          onMonthsLoaded(j.monthly.map(m => ({ ym: m.ym, label: m.month })))
        }
      } catch (e: any) {
        if (!off) {
          setErr(e?.message || 'fetch failed')
          const d = demoPayload()
          setData(d)
          onMonthsLoaded?.(d.monthly.map(m => ({ ym: m.ym, label: m.month })))
        }
      }
    }
    load()
    return () => { off = true }
  }, [address])

  if (!data) return err ? <div className={styles.error}>Error: {err}</div> : null

  const months = data.monthly
  const labels = months.map(m => m.month)

  // selected index
  const selIndex = React.useMemo(() => {
    if (selectedYm == null) return months.length - 1
    const i = months.findIndex(m => m.ym === selectedYm)
    return i >= 0 ? i : months.length - 1
  }, [months, selectedYm])

  const modeAllTime = selectedYm == null
  const cur = months[selIndex] || {}
  const prev = months[selIndex - 1] || {}

  // series
  const sBal = months.map(m => Number(m.avg_balance_eth || 0))
  const sTrades = months.map(m => Number(m.token_txs || 0))
  const sTxs = months.map(m => Number(m.native_txs || 0))
  const sUniq = months.map(m => Number(m.uniq_contracts || 0))
  const sDays = months.map(m => Number(m.uniq_days || 0))
  const sStreak = months.map(m => Number(m.uniq_weeks || 0))
  const sGas = months.map(m => Number(m.gas_spent_eth || 0))
  const sNft = months.map(m => Number(m.nft_unique_contracts || 0))
  const sRank = months.map(m => Number(m.ranks?.overall?.rank ?? 0))

  // values (all-time vs monthly)
  const V = {
    balance: modeAllTime ? mean(sBal) : (cur.avg_balance_eth ?? 0),
    trades: modeAllTime ? sum(sTrades) : (cur.token_txs ?? 0),
    txs: modeAllTime ? sum(sTxs) : (cur.native_txs ?? 0),
    uniq: modeAllTime ? sum(sUniq) : (cur.uniq_contracts ?? 0),
    days: modeAllTime ? sum(sDays) : (cur.uniq_days ?? 0),
    streak: modeAllTime ? Math.max(...sStreak, 0) : (cur.uniq_weeks ?? 0),
    gas: modeAllTime ? sum(sGas) : (cur.gas_spent_eth ?? 0),
    nft: modeAllTime ? sum(sNft) : (cur.nft_unique_contracts ?? 0),
    rank: modeAllTime ? Math.min(...sRank.filter(x => x > 0), 0) || 0 : (cur.ranks?.overall?.rank ?? 0),
  }

  // deltas (در حالت All time مخفی/—)
  const dBalance = modeAllTime ? null : delta(cur.avg_balance_eth, prev.avg_balance_eth)
  const dTrades = modeAllTime ? null : delta(cur.token_txs, prev.token_txs)
  const dTxs = modeAllTime ? null : delta(cur.native_txs, prev.native_txs)
  const dUniq = modeAllTime ? null : delta(cur.uniq_contracts, prev.uniq_contracts)
  const dDays = modeAllTime ? null : delta(cur.uniq_days, prev.uniq_days)
  const dStreak = modeAllTime ? null : delta(cur.uniq_weeks, prev.uniq_weeks)
  const dGas = modeAllTime ? null : delta(cur.gas_spent_eth, prev.gas_spent_eth)
  const dNft = modeAllTime ? null : delta(cur.nft_unique_contracts, prev.nft_unique_contracts)
  const dRank = modeAllTime
    ? null
    : (() => {
        const a = cur.ranks?.overall?.rank
        const b = prev.ranks?.overall?.rank
        if (a == null || b == null) return null
        const diff = b - a // بهبود اگر مثبت باشد
        return { diff, pct: null, sign: diff === 0 ? 0 : (diff > 0 ? 1 : -1) as -1 | 0 | 1 }
      })()

  const selLocal = selIndex // فقط برای هایلایت نقطه

  /* ---------- card helper ---------- */
  const Card = ({
    title, value, unit, deltaObj, series, labels, color, subtitle, footNote,
  }: {
    title: string
    value: string
    unit?: string
    deltaObj?: { diff: number | null; pct: number | null; sign: -1 | 0 | 1 } | null
    series: number[]
    labels: string[]
    color: string
    subtitle?: string
    footNote?: string
  }) => (
    <div className={styles.card}>
      <div className={styles.head}>
        <div className={styles.title}>{title}</div>
        <div className={styles.rank}>{footNote ?? ' '}</div>
      </div>
      <div className={styles.row}>
        <div className={styles.big}>
          {value}
          {unit ? <span style={{ fontSize: 14, marginLeft: 6 }}>{unit}</span> : null}
        </div>
        <div className={styles.sub}>{subtitle ?? ''}</div>
        <div className={styles.delta}>
          {deltaObj
            ? (<><Arrow s={deltaObj.sign} /> {deltaObj.diff == null ? '—' : fmt(deltaObj.diff, 2)} <span className={styles.muted}>{deltaObj.pct == null ? '' : `(${fmt(deltaObj.pct, 1)}%)`}</span></>)
            : '—'}
        </div>
      </div>
      <Spark series={series} labels={labels} selected={selLocal} color={color} />
    </div>
  )

  return (
    <div className={styles.grid}>
      {/* Row 1 */}
      <Card
        title="Balance (ETH)"
        value={fmt(V.balance, 3)}
        unit=""
        deltaObj={dBalance ?? undefined}
        series={sBal}
        labels={labels}
        color="rgb(59,130,246)"
        subtitle="on-chain (avg)"
      />
      <Card
        title="Trades (count)"
        value={fmt(V.trades, 0)}
        unit=""
        deltaObj={dTrades ?? undefined}
        series={sTrades}
        labels={labels}
        color="rgb(16,185,129)"
        subtitle="swap/trade tx count"
      />
      <Card
        title="Transactions"
        value={fmt(V.txs, 0)}
        unit=""
        deltaObj={dTxs ?? undefined}
        series={sTxs}
        labels={labels}
        color="rgb(37,99,235)"
        subtitle="txs per month"
      />

      {/* Row 2 */}
      <Card
        title="Unique Contracts"
        value={fmt(V.uniq, 0)}
        deltaObj={dUniq ?? undefined}
        series={sUniq}
        labels={labels}
        color="rgb(234,179,8)"
        subtitle="per month"
      />
      <Card
        title="Active Days"
        value={fmt(V.days, 0)}
        deltaObj={dDays ?? undefined}
        series={sDays}
        labels={labels}
        color="rgb(147,51,234)"
        subtitle="per month"
      />
      <Card
        title="Best Streak (days)"
        value={fmt(V.streak, 0)}
        deltaObj={dStreak ?? undefined}
        series={sStreak}
        labels={labels}
        color="rgb(245,158,11)"
        subtitle="within month"
      />

      {/* Row 3 */}
      <Card
        title="Gas Paid (ETH)"
        value={fmt(V.gas, 4)}
        deltaObj={dGas ?? undefined}
        series={sGas}
        labels={labels}
        color="rgb(244,63,94)"
        subtitle={modeAllTime ? 'all-time' : 'this month'}
      />
      <Card
        title="NFT (count)"
        value={fmt(V.nft, 0)}
        deltaObj={dNft ?? undefined}
        series={sNft}
        labels={labels}
        color="rgb(99,102,241)"
        subtitle="unique NFT contracts"
      />
      <Card
        title="Monthly Rank"
        value={V.rank ? `#${fmt(V.rank, 0)}` : '—'}
        deltaObj={dRank ?? undefined}
        series={sRank}
        labels={labels}
        color="rgb(107,114,128)"
        subtitle="better is lower"
        footNote=""
      />
    </div>
  )
}

export default WalletMetrics
