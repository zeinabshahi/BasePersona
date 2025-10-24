// ui/components/WalletStats.tsx
import React, { useMemo, useEffect, useRef, useState } from 'react'
import styles from './wallet-stats.module.css'

export type WalletStatRecord = {
  address: string
  baseBuilderHolder: boolean
  baseIntroducedHolder: boolean
  balanceETH: number
  volumeETH: number
  nativeTxCount: number
  tokenTxCount: number
  totalContractInteractions: number
  uniqueContractInteractions: number
  walletAgeDays: number
  uniqueDays: number
  uniqueWeeks: number
  uniqueMonths: number
  uniqueNftContractCount?: number
}

type Props = { stats?: WalletStatRecord | null }

/* ---------------- deterministic helpers ---------------- */

function hashString(s: string) {
  let h = 2166136261 >>> 0
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}
function seededRandom(seed: number) {
  let x = seed || 1234567
  return () => {
    x ^= x << 13; x ^= x >>> 17; x ^= x << 5
    return ((x >>> 0) % 10000) / 10000
  }
}
function clamp(n: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, n)) }

/* ---------------- month helpers (Aug 2023 → now, up to 30 months) ---------------- */

function yyyymm(d: Date) {
  const y = d.getUTCFullYear()
  const m = (d.getUTCMonth() + 1).toString().padStart(2, '0')
  return `${y}-${m}`
}
function monthLabel(ym: string) {
  const [Y, M] = ym.split('-').map(Number)
  const mnames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  return `${mnames[(M-1)%12]} ${String(Y).slice(-2)}`
}
function lastNMonthsFromBase(maxN = 30, until?: Date) {
  const end = until ? new Date(Date.UTC(until.getUTCFullYear(), until.getUTCMonth(), 1)) : new Date()
  const startAnchor = new Date(Date.UTC(2023, 7, 1)) // Aug 2023 (Base mainnet Aug 9)
  const out: string[] = []
  let cur = new Date(end)
  for (let i = 0; i < maxN; i++) {
    const ym = yyyymm(cur)
    if (cur >= startAnchor) out.unshift(ym)
    cur = new Date(Date.UTC(cur.getUTCFullYear(), cur.getUTCMonth() - 1, 1))
  }
  return out
}

/** سری ماهانه که به KPI فعلی ختم می‌شود؛ نوسان ملایم و دترمینستیک دارد */
function seriesMonthlyDet(seed: number, lastValue: number, months: string[], volatility = 0.22): number[] {
  const rnd = seededRandom(seed)
  const n = Math.max(2, months.length)
  const out = new Array<number>(n)
  const last = Math.max(0, Number.isFinite(lastValue) ? lastValue : 0)
  // شروع around 60–120% آخرین مقدار
  let prev = last * (0.6 + rnd() * 0.6)
  for (let i = 0; i < n - 1; i++) {
    const t = (i + 1) / (n - 1) // 0..1
    const target = last * (0.5 + 0.6 * t)
    const noise = (rnd() - 0.5) * (Math.abs(last) + 1) * volatility
    prev = clamp(prev * (0.86 + 0.22 * rnd()) + (target - prev) * 0.35 + noise, 0, Math.max(last * 2.5, 1))
    out[i] = +prev.toFixed(3)
  }
  out[n - 1] = +last.toFixed(3)
  return out
}

function delta(series: number[]) {
  if (!series || series.length < 2) return 0
  const first = series[0], last = series[series.length - 1]
  if (Math.abs(first) < 1e-9) return last === 0 ? 0 : 100
  return ((last - first) / Math.abs(first)) * 100
}
function fmt(n: number | string | undefined) {
  if (n === undefined || n === null) return '—'
  if (typeof n === 'number') {
    if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(2) + 'M'
    if (Math.abs(n) >= 1e3) return (n / 1e3).toFixed(1) + 'k'
    return (Math.round((n + Number.EPSILON) * 1000) / 1000).toString()
  }
  return String(n)
}

/* --------------------------------- UI bits ---------------------------------- */

function RankBadge({ rank }: { rank: number }) {
  return <span className={styles.rank}>Rank #{rank.toLocaleString()}</span>
}
function DeltaBadge({ pct }: { pct: number }) {
  const pos = pct >= 0
  const sign = pos ? '+' : '−'
  const val = Math.abs(pct).toFixed(1) + '%'
  return (
    <span className={`${styles.delta} ${pos ? styles.up : styles.down}`}>
      <i />{sign}{val}
    </span>
  )
}
function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div className={styles.sectionTitle}>{children}</div>
}
function BigNum({ children }: { children: React.ReactNode }) {
  return <span className={styles.bigNum}>{children}</span>
}

/* -------- Full-width chart support (ResizeObserver) -------- */

function useMeasure() {
  const ref = useRef<HTMLDivElement | null>(null)
  const [w, setW] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) setW(e.contentRect.width)
    })
    ro.observe(el)
    setW(el.getBoundingClientRect().width)
    return () => ro.disconnect()
  }, [])
  return [ref, w] as const
}

/* ----------------------------- Line + area (monthly, full width) ----------------------------- */

function LineAreaMonthly({
  values,
  months,
  height = 92,
  padX = 2,
}: { values: number[]; months: string[]; height?: number; padX?: number }) {
  if (!values || values.length < 2) return null

  const [wrapRef, wrapW] = useMeasure()
  const w = Math.max(260, Math.floor(wrapW) - padX * 2)
  const h = height

  const min = Math.min(...values), max = Math.max(...values)
  const spread = max - min || 1
  const pts = values.map((v, i) => {
    const x = padX + (i / (values.length - 1)) * (w - padX * 2)
    const y = h - ((v - min) / spread) * h
    return [x, y] as [number, number]
  })
  const path = 'M ' + pts.map(p => `${p[0]},${p[1]}`).join(' L ')
  const area = `${path} L ${w - padX},${h} L ${padX},${h} Z`

  // X ticks: 6 برچسب از آرایهٔ months
  const ticks = Math.min(6, months.length)
  const step = Math.max(1, Math.floor((months.length - 1) / (ticks - 1)))
  const tickIdxs = Array.from({ length: ticks }, (_, k) => clamp(k * step, 0, months.length - 1))

  return (
    <div ref={wrapRef} className={styles.chartWrap}>
      <svg className={styles.spark} width={w} height={h + 22} viewBox={`0 0 ${w} ${h + 22}`} role="img" aria-label="monthly trend">
        <path d={area} className={styles.sparkArea} />
        <path d={path} className={styles.sparkLine} />
        {tickIdxs.map((i, k) => {
          const x = padX + (i / (months.length - 1)) * (w - padX * 2)
          return (
            <g key={k} transform={`translate(${x}, ${h})`}>
              <line x1="0" y1="0" x2="0" y2="6" stroke="#D1D5DB" />
              <text x="0" y="18" textAnchor="middle" fontSize="10" fill="#6B7280">{monthLabel(months[i])}</text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

/* ------------------------------------ Main ---------------------------------- */

export default function WalletStats({ stats }: Props) {
  const s: WalletStatRecord = stats ?? {
    address: '—',
    baseBuilderHolder: false,
    baseIntroducedHolder: false,
    balanceETH: 0.111,
    volumeETH: 0.222,
    nativeTxCount: 3,
    tokenTxCount: 2,
    totalContractInteractions: 7,
    uniqueContractInteractions: 2,
    walletAgeDays: 12,
    uniqueDays: 4,
    uniqueWeeks: 1,
    uniqueMonths: 1,
    uniqueNftContractCount: 1
  }

  const seed = useMemo(() => hashString(String(s.address || 'placeholder')), [s.address])
  const months = useMemo(() => lastNMonthsFromBase(30, new Date()), [])

  // سری‌های ماهانه: به KPI فعلی ختم می‌شود
  const seriesBalance = useMemo(() => seriesMonthlyDet((seed ^ 0xB1) >>> 0, s.balanceETH || 0, months, 0.18), [seed, s.balanceETH, months])
  const seriesVolume  = useMemo(() => seriesMonthlyDet((seed ^ 0xB2) >>> 0, s.volumeETH || 0, months, 0.22),  [seed, s.volumeETH, months])
  const seriesInter   = useMemo(() => seriesMonthlyDet((seed ^ 0xB3) >>> 0, s.totalContractInteractions || 0, months, 0.25), [seed, s.totalContractInteractions, months])
  const seriesAct     = useMemo(() => seriesMonthlyDet((seed ^ 0xB4) >>> 0, (s.nativeTxCount + s.tokenTxCount) || 0, months, 0.28), [seed, s.nativeTxCount, s.tokenTxCount, months])
  const seriesTime    = useMemo(() => seriesMonthlyDet((seed ^ 0xB5) >>> 0, s.uniqueDays || 0, months, 0.2), [seed, s.uniqueDays, months])
  const seriesNft     = useMemo(() => seriesMonthlyDet((seed ^ 0xB6) >>> 0, (s.uniqueNftContractCount ?? 0), months, 0.2), [seed, s.uniqueNftContractCount, months])

  const rank = (offset: number) => ((seed >>> 8) % 9000) + 500 + offset

  // برای توازن 3-آیتمی در کارت Interactions:
  const avgPerDay = useMemo(
    () => Number((s.totalContractInteractions / Math.max(1, s.walletAgeDays)).toFixed(2)),
    [s.totalContractInteractions, s.walletAgeDays]
  )

  return (
    <div className={styles.wsGrid}>

      {/* KPI Row */}
      <div className={styles.kpiRow}>
        <div className={`${styles.card} ${styles.kpiCard}`}>
          <div className={styles.sectionTop}>
            <div className={styles.titleWithRank}>
              <SectionTitle>Balance (ETH)</SectionTitle>
              <RankBadge rank={rank(10)} />
            </div>
            <DeltaBadge pct={delta(seriesBalance)} />
          </div>
          <div className={styles.kpiValue}>
            <BigNum>{fmt(s.balanceETH)}</BigNum>
            <span className={styles.muted}>on-chain</span>
          </div>
          <LineAreaMonthly values={seriesBalance} months={months} />
        </div>

        <div className={`${styles.card} ${styles.kpiCard}`}>
          <div className={styles.sectionTop}>
            <div className={styles.titleWithRank}>
              <SectionTitle>Volume (ETH)</SectionTitle>
              <RankBadge rank={rank(20)} />
            </div>
            <DeltaBadge pct={delta(seriesVolume)} />
          </div>
          <div className={styles.kpiValue}>
            <BigNum>{fmt(s.volumeETH)}</BigNum>
            <span className={styles.muted}>30d</span>
          </div>
          <LineAreaMonthly values={seriesVolume} months={months} />
        </div>

        <div className={`${styles.card} ${styles.kpiCard}`}>
          <div className={styles.sectionTop}>
            <div className={styles.titleWithRank}>
              <SectionTitle>Interactions</SectionTitle>
              <RankBadge rank={rank(30)} />
            </div>
            <DeltaBadge pct={delta(seriesInter)} />
          </div>
          <div className={styles.kpiValue}>
            <BigNum>{fmt(s.totalContractInteractions)}</BigNum>
            <span className={styles.muted}>total</span>
          </div>
          <LineAreaMonthly values={seriesInter} months={months} />
        </div>
      </div>

      {/* NFT + Activity */}
      <div className={styles.twoCols}>
        {/* NFT Holders */}
        <div className={styles.card}>
          <div className={styles.sectionTop}>
            <div className={styles.titleWithRank}>
              <SectionTitle>NFT Holders</SectionTitle>
              <RankBadge rank={rank(40)} />
            </div>
            <DeltaBadge pct={delta(seriesNft)} />
          </div>

          <div className={styles.holdersRow}>
            <div className={styles.holderItem}>
              <div className={`${styles.holderLabel} ${styles.ellipsis}`}>Base Builder</div>
              <span className={`${styles.pill} ${s.baseBuilderHolder ? styles.pillGreen : styles.pillRed}`}>
                <span className={styles.ellipsis}>{s.baseBuilderHolder ? 'Yes' : 'No'}</span>
              </span>
            </div>
            <div className={styles.holderItem}>
              <div className={`${styles.holderLabel} ${styles.ellipsis}`}>Base Introduced</div>
              <span className={`${styles.pill} ${s.baseIntroducedHolder ? styles.pillGreen : styles.pillRed}`}>
                <span className={styles.ellipsis}>{s.baseIntroducedHolder ? 'Yes' : 'No'}</span>
              </span>
            </div>
            <div className={styles.holderItem}>
              <div className={`${styles.holderLabel} ${styles.dim} ${styles.ellipsis}`}>NFT contracts</div>
              <div className={styles.holderValue}>{fmt(s.uniqueNftContractCount)}</div>
            </div>
          </div>

          <LineAreaMonthly values={seriesNft} months={months} />
        </div>

        {/* Activity */}
        <div className={styles.card}>
          <div className={styles.sectionTop}>
            <div className={styles.titleWithRank}>
              <SectionTitle>Activity</SectionTitle>
              <RankBadge rank={rank(50)} />
            </div>
            <DeltaBadge pct={delta(seriesAct)} />
          </div>

          <div className={styles.metricsRow}>
            <div className={styles.metric}>
              <div className={styles.metricNum}><BigNum>{fmt(s.nativeTxCount)}</BigNum></div>
              <div className={styles.muted}>Native TXs</div>
            </div>
            <div className={styles.metric}>
              <div className={styles.metricNum}><BigNum>{fmt(s.tokenTxCount)}</BigNum></div>
              <div className={styles.muted}>Token TXs</div>
            </div>
            <div className={styles.metric}>
              <div className={styles.metricNum}><BigNum>{fmt(s.uniqueContractInteractions)}</BigNum></div>
              <div className={styles.muted}>Unique Contracts</div>
            </div>
          </div>

          <LineAreaMonthly values={seriesAct} months={months} />
        </div>
      </div>

      {/* Interactions + Time */}
      <div className={styles.twoCols}>
        {/* Interactions breakdown — 3 متریک */}
        <div className={styles.card}>
          <div className={styles.sectionTop}>
            <div className={styles.titleWithRank}>
              <SectionTitle>Interactions</SectionTitle>
              <RankBadge rank={rank(60)} />
            </div>
            <DeltaBadge pct={delta(seriesInter)} />
          </div>

          <div className={styles.metricsRow}>
            <div className={styles.metric}>
              <div className={styles.metricNum}><BigNum>{fmt(s.totalContractInteractions)}</BigNum></div>
              <div className={styles.muted}>Total</div>
            </div>
            <div className={styles.metric}>
              <div className={styles.metricNum}><BigNum>{fmt(s.uniqueContractInteractions)}</BigNum></div>
              <div className={styles.muted}>Unique</div>
            </div>
            <div className={styles.metric}>
              <div className={styles.metricNum}><BigNum>{fmt(avgPerDay)}</BigNum></div>
              <div className={styles.muted}>Avg / day</div>
            </div>
          </div>

          <LineAreaMonthly values={seriesInter} months={months} />
        </div>

        {/* Time & engagement — 3 متریک */}
        <div className={styles.card}>
          <div className={styles.sectionTop}>
            <div className={styles.titleWithRank}>
              <SectionTitle>Time & engagement</SectionTitle>
              <RankBadge rank={rank(70)} />
            </div>
            <DeltaBadge pct={delta(seriesTime)} />
          </div>

          <div className={styles.metricsRow}>
            <div className={styles.metric}>
              <div className={styles.metricNum}><BigNum>{fmt(s.walletAgeDays)}</BigNum></div>
              <div className={styles.muted}>Wallet age</div>
            </div>
            <div className={styles.metric}>
              <div className={styles.metricNum}><BigNum>{fmt(s.uniqueDays)}</BigNum></div>
              <div className={styles.muted}>Unique days</div>
            </div>
            <div className={styles.metric}>
              <div className={styles.metricNum}><BigNum>{fmt(s.uniqueWeeks)}</BigNum></div>
              <div className={styles.muted}>Unique weeks</div>
            </div>
          </div>

          <LineAreaMonthly values={seriesTime} months={months} />
        </div>
      </div>
    </div>
  )
}
