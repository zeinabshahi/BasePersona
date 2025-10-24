import * as React from 'react'
import styles from './kpi.module.css'
import KpiSpark from './KpiSpark'

export type MetricCardProps = {
  title: string
  unit?: string
  value?: number | null
  subtitle?: string
  deltaAbs?: number | null
  deltaPct?: number | null
  rank?: number | null
  pct?: number | null
  series?: number[]
  selectedIndex?: number | null
}
function fmt(n?: number | null, d=2) {
  if (n==null || isNaN(Number(n))) return '—'
  return Number(n).toFixed(d)
}
function Arrow({dir}:{dir:-1|0|1}) {
  if (dir>0) return <span className={styles.up}>▲</span>
  if (dir<0) return <span className={styles.down}>▼</span>
  return <span className={styles.flat}>■</span>
}
export default function MetricCard({
  title, unit, value, subtitle, deltaAbs, deltaPct, rank, pct, series=[], selectedIndex=null
}: MetricCardProps) {
  const dir: -1|0|1 = (deltaAbs==null)?0:(deltaAbs>0?1:(deltaAbs<0?-1:0))
  return (
    <div className={styles.card}>
      <div className={styles.cardHead}>
        <div className={styles.title}>{title}</div>
        {rank!=null && <div className={styles.rank}>Rank #{rank}{pct!=null?` • ${(pct*100).toFixed(1)}%`:''}</div>}
      </div>

      <div className={styles.valueRow}>
        <div className={styles.valuePrimary}>
          {unit==='usd' ? '$' : unit==='eth' ? '' : ''}{fmt(value, unit==='eth'?4:2)}
          {unit==='eth' && <span className={styles.unit}> ETH</span>}
          {unit==='usd' && <span className={styles.unit}> </span>}
        </div>
        <div className={styles.delta}>
          <Arrow dir={dir}/> {deltaAbs==null?'—':(unit==='usd'?'$':'')+fmt(deltaAbs, unit==='eth'?4:2)}
          <span className={styles.muted}> {deltaPct==null?'':'('+fmt(deltaPct,1)+'%)'}</span>
        </div>
      </div>

      {subtitle && <div className={styles.subtitle}>{subtitle}</div>}

      <div className={styles.sparkWrap}>
        <KpiSpark series={series} selected={selectedIndex ?? null} ariaLabel={`${title} sparkline`}/>
      </div>
    </div>
  )
}
