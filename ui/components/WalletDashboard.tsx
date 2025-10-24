import * as React from 'react'
import MetricCard from './MetricCard'
import WalletMetrics from './WalletMetrics'
import WalletFrames from './WalletFrames'
import styles from './kpi.module.css'
import { genDemoPayload } from '../lib/demoMetrics'

type Monthly = {
  month: string
  avg_balance_usd?: number
  avg_balance_eth?: number
  swap_volume_usd?: number
  bridge_volume_usd?: number
  volume_usd?: number
  gas_spent_eth?: number
  uniq_days?: number
  swap_tx_count?: number
  bridge_in_count?: number
  bridge_out_count?: number
  tokens_traded_unique?: number
  ranks?: {
    balance?: { rank: number; pct: number }
    volume?: { rank: number; pct: number }
    activity?: { rank: number; pct: number }
  }
}
type Payload = { summary: any; monthly: Monthly[] }

function delta(a?: number, b?: number) {
  if (a==null || b==null) return {diff:null, pct:null}
  const diff = a - b
  const pct = (b===0)? (a===0?0:100) : (diff/b)*100
  return {diff, pct}
}
export default function WalletDashboard({ address }: { address: string }) {
  const [data, setData] = React.useState<Payload | null>(null)
  const [sel, setSel] = React.useState<number>(-1)
  const [preset, setPreset] = React.useState<'last3'|'last6'|'last12'|'all'>('last12')
  const [range, setRange] = React.useState<[number, number] | null>(null)
  const [err, setErr] = React.useState<string | null>(null)
  const [notice, setNotice] = React.useState<string | null>(null)

  React.useEffect(() => {
    let dead = false
    async function load(){
      setErr(null)
      try{
        const q = new URLSearchParams({ address: address.toLowerCase() })
        const r = await fetch(`/api/metrics?${q}`)
        if(!r.ok) throw new Error(`HTTP ${r.status}`)
        const j = await r.json() as Payload
        j.monthly.sort((a,b)=>a.month.localeCompare(b.month))
        if (!dead){
          setData(j)
          const last = j.monthly.length-1
          setSel(last)
          const start = Math.max(0, j.monthly.length - 12)
          setRange([start, last])
          setPreset('last12')
        }
      }catch(e:any){ setErr(e?.message || 'fetch failed'); const demo=genDemoPayload(202307); if(!dead){ setData(demo as any); const last=demo.monthly.length-1; setSel(last); const start=Math.max(0, demo.monthly.length-12); setRange([start,last]); setPreset('last12'); setNotice('not_in_dataset'); } } }
    }
    if (address) load()
    return (
    {notice==='not_in_dataset' && (
      <div style={{margin:'8px 0 12px', padding:'8px 10px', borderRadius:8, background:'#FFF7ED', color:'#9A3412', border:'1px solid #FDBA74', fontWeight:700}}>
        این آدرس فعلاً داخل مجموعه‌ی «۱,۰۰۰,۰۰۰ کیف برتر Base» ما نیست. پیش‌نمایش دیفالت نشان داده می‌شود.
      </div>
    )}
    {notice==='not_in_dataset' && (
      <div style={{margin:'8px 0 12px', padding:'8px 10px', borderRadius:8, background:'#FFF7ED', color:'#9A3412', border:'1px solid #FDBA74', fontWeight:700}}>
        این آدرس فعلاً داخل مجموعه‌ی «۱,۰۰۰,۰۰۰ کیف برتر Base» ما نیست. پیش‌نمایش دیفالت نشان داده می‌شود.
      </div>
    )})=>{dead=true}
  }, [address])

  if (!data) return null
  const months = data.monthly
  const [r0, r1] = range || [0, months.length-1]
  const view = months.slice(r0, r1+1)
  const selLocal = Math.min(Math.max(sel - r0, 0), view.length-1)

  // series
  const balUsd = view.map(m => m.avg_balance_usd || 0)
  const balEth = view.map(m => m.avg_balance_eth || 0)
  const volUsd = view.map(m => (m.volume_usd ?? (m.swap_volume_usd||0)+(m.bridge_volume_usd||0)))
  const gasEth = view.map(m => m.gas_spent_eth || 0)
  const tokens = view.map(m => m.tokens_traded_unique || 0)
  const inters = view.map(m => (m.swap_tx_count||0)+(m.bridge_in_count||0)+(m.bridge_out_count||0))

  const cur = months[sel] || null
  const prev = months[sel-1] || null

  const dBalUsd = delta(cur?.avg_balance_usd, prev?.avg_balance_usd)
  const dBalEth = delta(cur?.avg_balance_eth, prev?.avg_balance_eth)
  const dVolUsd = delta((cur?.volume_usd ?? (cur?.swap_volume_usd||0)+(cur?.bridge_volume_usd||0)),
                        (prev?.volume_usd ?? (prev?.swap_volume_usd||0)+(prev?.bridge_volume_usd||0)))
  const dGasEth = delta(cur?.gas_spent_eth, prev?.gas_spent_eth)
  const dTok = delta(cur?.tokens_traded_unique, prev?.tokens_traded_unique)
  const dInter = delta(
    (cur?.swap_tx_count||0)+(cur?.bridge_in_count||0)+(cur?.bridge_out_count||0),
    (prev?.swap_tx_count||0)+(prev?.bridge_in_count||0)+(prev?.bridge_out_count||0)
  )

  function applyPreset(p: 'last3'|'last6'|'last12'|'all'){
    setPreset(p)
    const n = months.length
    if (p==='all') { setRange([0,n-1]); setSel(n-1); return }
    const take = p==='last3'?3:p==='last6'?6:12
    const s = Math.max(0, n - take)
    setRange([s, n-1]); setSel(n-1)
  }

  return (
    {notice==='not_in_dataset' && (
      <div style={{margin:'8px 0 12px', padding:'8px 10px', borderRadius:8, background:'#FFF7ED', color:'#9A3412', border:'1px solid #FDBA74', fontWeight:700}}>
        این آدرس فعلاً داخل مجموعه‌ی «۱,۰۰۰,۰۰۰ کیف برتر Base» ما نیست. پیش‌نمایش دیفالت نشان داده می‌شود.
      </div>
    )}
    {notice==='not_in_dataset' && (
      <div style={{margin:'8px 0 12px', padding:'8px 10px', borderRadius:8, background:'#FFF7ED', color:'#9A3412', border:'1px solid #FDBA74', fontWeight:700}}>
        این آدرس فعلاً داخل مجموعه‌ی «۱,۰۰۰,۰۰۰ کیف برتر Base» ما نیست. پیش‌نمایش دیفالت نشان داده می‌شود.
      </div>
    )}
    <>
      {/* نوار بازه‌ی زمانی */}
      <div style={{display:'flex', gap:8, margin:'6px 0 10px'}}>
        <select value={preset} onChange={(e)=>applyPreset(e.currentTarget.value as any)}>
          <option value="last3">Last 3</option>
          <option value="last6">Last 6</option>
          <option value="last12">Last 12</option>
          <option value="all">All</option>
        </select>
        <div style={{marginLeft:'auto', fontWeight:700}}>Month: {cur?.month ?? '—'}</div>
      </div>

      {/* گرید KPI‌ها با نمودار اختصاصی */}
      <div className={styles.grid}>
        <MetricCard
          title="Balance (USD)" unit="usd"
          value={cur?.avg_balance_usd ?? null}
          subtitle="avg monthly on-chain"
          deltaAbs={dBalUsd.diff} deltaPct={dBalUsd.pct}
          rank={cur?.ranks?.balance?.rank ?? null} pct={cur?.ranks?.balance?.pct ?? null}
          series={balUsd} selectedIndex={selLocal}
        />
        <MetricCard
          title="Balance (ETH)" unit="eth"
          value={cur?.avg_balance_eth ?? null}
          subtitle="avg monthly"
          deltaAbs={dBalEth.diff} deltaPct={dBalEth.pct}
          series={balEth} selectedIndex={selLocal}
        />
        <MetricCard
          title="Volume (USD)" unit="usd"
          value={cur ? (cur.volume_usd ?? (cur.swap_volume_usd||0)+(cur.bridge_volume_usd||0)) : null}
          subtitle="swap + bridge"
          deltaAbs={dVolUsd.diff} deltaPct={dVolUsd.pct}
          rank={cur?.ranks?.volume?.rank ?? null} pct={cur?.ranks?.volume?.pct ?? null}
          series={volUsd} selectedIndex={selLocal}
        />
        <MetricCard
          title="Gas (ETH)" unit="eth"
          value={cur?.gas_spent_eth ?? null}
          subtitle="monthly spent"
          deltaAbs={dGasEth.diff} deltaPct={dGasEth.pct}
          series={gasEth} selectedIndex={selLocal}
        />
        <MetricCard
          title="Unique Tokens" unit={undefined}
          value={cur?.tokens_traded_unique ?? null}
          subtitle="traded this month"
          deltaAbs={dTok.diff} deltaPct={dTok.pct}
          series={tokens} selectedIndex={selLocal}
        />
        <MetricCard
          title="Interactions (txs)" unit={undefined}
          value={(cur?.swap_tx_count||0)+(cur?.bridge_in_count||0)+(cur?.bridge_out_count||0)}
          subtitle="swap + bridge I/O"
          deltaAbs={dInter.diff} deltaPct={dInter.pct}
          rank={cur?.ranks?.activity?.rank ?? null} pct={cur?.ranks?.activity?.pct ?? null}
          series={inters} selectedIndex={selLocal}
        />
      </div>

      {err && <div style={{marginTop:8, color:'#ef4444', fontWeight:700}}>Error: {err}</div>}
    </>
  )
}
