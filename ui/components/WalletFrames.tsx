// components/WalletFrames.tsx
import * as React from 'react'
import css from './frames.module.css'

type Rank = { rank:number; pct:number, score?:number }
type Monthly = {
  month: string
  ym: number
  avg_balance_usd?: number
  avg_balance_eth?: number
  volume_usd?: number
  swap_volume_usd?: number
  bridge_volume_usd?: number
  native_txs?: number
  token_txs?: number
  uniq_contracts?: number
  uniq_days?: number
  uniq_weeks?: number   // ← در JSON شما = streak روز
  nft_unique_contracts?: number
  nft_holds_builder?: number
  nft_holds_introduced?: number
  tokens_traded_unique?: number
  gas_spent_eth?: number
  ranks?: {
    balance?: Rank
    volume?: Rank
    activity?: Rank
    nft?: Rank
    overall?: Rank
  } | null
}
type Summary = {
  current_streak_months?: number
  best_streak_months?: number
  active_months_total?: number
  wallet_age_days?: number
  cum_ranks?: {
    balance?: { rank:number; pct:number; bucket?:string }
    activity?: Rank
    volume?: Rank
    overall?: { score:number; rank:number; pct:number }
  } | null
}
type Payload = { summary: Summary; monthly: Monthly[] }

/* ---------------- helpers ---------------- */
function fmt(n?: number, d=2){ return (n==null||isNaN(n))?'—':Number(n).toFixed(d) }
function delta(a?: number, b?: number){
  if(a==null||b==null) return {diff:null as number|null, pct:null as number|null, sign:0 as -1|0|1}
  const diff=a-b; const pct=b===0?(a===0?0:100):(diff/b)*100
  return {diff,pct,sign:(diff===0?0:(diff>0?1:-1)) as -1|0|1}
}

// دمو پایدار وقتی آدرس نداریم/خطا داریم (از Jul-2023 تا 24 ماه)
function demoPayload(): Payload {
  const start = new Date('2023-07-01')
  const months: Monthly[] = []
  for(let i=0;i<24;i++){
    const d = new Date(start); d.setMonth(start.getMonth()+i)
    const ym = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
    months.push({
      month: ym, ym: parseInt(ym.replace('-',''),10),
      avg_balance_eth: +(0.2 + Math.sin(i/3)*0.05 + (i>18?0.02:0)).toFixed(3),
      native_txs: Math.max(0, Math.round(10 + Math.sin(i/2)*6 + (i>15?5:0))),
      token_txs:  Math.max(0, Math.round((i%7===0?12:0) + (i%5===0?7:0))),
      uniq_contracts: Math.max(0, Math.round(3 + Math.sin(i/1.8)*2 + (i>12?2:0))),
      uniq_days: Math.max(0, Math.round(5 + Math.sin(i/1.7)*4 + (i>10?3:0))),
      uniq_weeks: Math.max(0, Math.round(2 + (i%6===0?4:0))),
      nft_unique_contracts: (i%4===0?1:0),
      gas_spent_eth: +(0.003 + Math.abs(Math.sin(i))*0.002).toFixed(4),
      ranks: { overall: { rank: 50000 + (i%8)*1000, pct: 0.5 } }
    })
  }
  return { summary:{ active_months_total: months.length, wallet_age_days: 0, cum_ranks:{ overall:{score:0,rank:0,pct:0} } }, monthly: months }
}

/* --------- Mini chart (ticks حذف شد، tooltip اضافه شد) --------- */
type SparkProps = {
  series:number[]; labels:string[]; selected:number; onSelect:(i:number)=>void; color:string
}
function Spark({series, labels, selected, onSelect, color}:SparkProps){
  const w=320,h=96, pad=10
  const n=series.length
  const xs = series.map((_,i)=> pad + (n>1? i*(w-pad*2)/(n-1):0))
  const max = Math.max(0.0001, ...series)
  const y = (v:number)=> h-pad-(v/max)*(h-pad*2)
  const d = xs.map((x,i)=> `${i?'L':'M'}${x.toFixed(1)},${y(series[i]).toFixed(1)}`).join(' ')
  const area = `${d} L${xs[n-1]?.toFixed(1)||pad},${(h-pad).toFixed(1)} L${xs[0]?.toFixed(1)||pad},${(h-pad).toFixed(1)} Z`

  return (
    <div className={css.sparkWrap}>
      <svg viewBox={`0 0 ${w} ${h}`} className={css.spark} preserveAspectRatio="none"
           onMouseMove={(e)=>{
             const rect=(e.target as SVGElement).closest('svg')!.getBoundingClientRect()
             const x=e.clientX-rect.left
             // نزدیک‌ترین نقطه
             let best=0,bd=1e9
             for(let i=0;i<xs.length;i++){ const dd=Math.abs(xs[i]-x); if(dd<bd){bd=dd;best=i} }
             onSelect(best)
           }}>
        <path d={area} style={{fill: color.replace('rgb','rgba').replace(')',',.14)')}} />
        <path d={d} style={{stroke: color, strokeWidth: 2, fill: 'none'}} />
        {xs.map((x,i)=>(
          <circle key={i} cx={x} cy={y(series[i])} r={i===selected?4:2}
                  className={i===selected?css.dotSel:css.dot}>
            <title>{`${labels[i]} • ${series[i]}`}</title>
          </circle>
        ))}
      </svg>
    </div>
  )
}

function Arrow({s}:{s:-1|0|1}){ return s>0? <span className={css.up}>▲</span> : s<0? <span className={css.down}>▼</span> : <span className={css.flat}>■</span> }

/* ---------------- main ---------------- */
export default function WalletFrames({ address }:{ address?: string }) {
  const [data,setData]=React.useState<Payload|null>(null)
  const [err,setErr]=React.useState<string|null>(null)

  // انتخاب ماه + بازه (فعلاً همه‌ی ماه‌ها؛ کنترل بازه از کرکرهٔ بیرونی انجام می‌شه)
  const [sel,setSel]=React.useState(0)
  const [range,setRange]=React.useState<[number,number]|null>(null)

  React.useEffect(()=>{
    let off=false
    async function load(){
      setErr(null)
      try{
        if(address && /^0x[0-9a-fA-F]{40}$/.test(address)){
          const r=await fetch(`/api/metrics?${new URLSearchParams({address:address.toLowerCase()}).toString()}`)
          if(!r.ok) throw new Error(`HTTP ${r.status}`)
          const j=await r.json() as Payload
          j.monthly.sort((a,b)=> a.month.localeCompare(b.month))
          if(!off){
            setData(j)
            const last=j.monthly.length-1
            setSel(last)
            setRange([0,last])
          }
        }else{
          if(!off){ const j=demoPayload(); setData(j); setSel(j.monthly.length-1); setRange([0, j.monthly.length-1]) }
        }
      }catch(e:any){
        if(!off){ const j=demoPayload(); setData(j); setSel(j.monthly.length-1); setRange([0, j.monthly.length-1]); setErr(null) }
      }
    }
    load()
    return ()=>{off=true}
  },[address])

  if(!data) return err? <div className={css.error}>Error: {err}</div> : null

  const months = data.monthly
  const [r0,r1] = range ?? [0, months.length-1]
  const view = months.slice(Math.max(0,r0), Math.min(months.length-1, r1)+1)
  const selLocal = Math.min(Math.max(sel-r0,0), Math.max(0, view.length-1))

  const cur  = months[sel] || {}
  const prev = months[sel-1] || {}

  // سری‌ها روی view
  const labels   = view.map(x=> x.month)
  const sBalEth  = view.map(x=> Number(x.avg_balance_eth||0))
  const sTrades  = view.map(x=> Number(x.token_txs||0))        // Trades (count)
  const sTx      = view.map(x=> Number(x.native_txs||0))       // Transactions
  const sUniq    = view.map(x=> Number(x.uniq_contracts||0))   // Unique Contracts
  const sDays    = view.map(x=> Number(x.uniq_days||0))        // Active Days
  const sStreak  = view.map(x=> Number(x.uniq_weeks||0))       // Best Streak (days)
  const sGas     = view.map(x=> Number(x.gas_spent_eth||0))
  const sNFT     = view.map(x=> Number(x.nft_unique_contracts||0))
  const sRank    = view.map(x=> Number(x.ranks?.overall?.rank ?? 0))

  // دلتاها
  const dBal  = delta(cur.avg_balance_eth, prev.avg_balance_eth)
  const dTrd  = delta(cur.token_txs, prev.token_txs)
  const dTx   = delta(cur.native_txs, prev.native_txs)
  const dUniq = delta(cur.uniq_contracts, prev.uniq_contracts)
  const dDays = delta(cur.uniq_days, prev.uniq_days)
  const dStrk = delta(cur.uniq_weeks, prev.uniq_weeks)
  const dGas  = delta(cur.gas_spent_eth, prev.gas_spent_eth)
  const dNft  = delta(cur.nft_unique_contracts, prev.nft_unique_contracts)
  const rankCur = cur.ranks?.overall?.rank
  const rankPrev= prev.ranks?.overall?.rank
  const dRank = (rankCur==null || rankPrev==null)
    ? { diff:null as number|null, pct:null as number|null, sign:0 as -1|0|1 }
    : { diff: rankPrev - rankCur, pct: null, sign: (rankPrev - rankCur)===0?0:((rankPrev - rankCur)>0?1:-1) as -1|0|1 }

  const setLocal=(i:number)=> setSel(r0 + i)

  return (
    <div className={css.wrap}>
      {/* Toolbar (دکمه‌های 6/12/All حذف شد) */}
      <div className={css.toolbar}>
        <div className={css.selMonth}>Month: <strong>{months[sel]?.month || '—'}</strong></div>
        <div className={css.streaks}>
          {data.summary?.cum_ranks?.balance?.bucket && <span className={css.badge}>Bucket: {data.summary.cum_ranks.balance.bucket}</span>}
        </div>
      </div>

      {/* GRID: فریم‌ها مطابق UI قدیمی */}
      <div className={css.grid}>
        {/* Row 1 */}
        <div className={css.card}>
          <div className={css.head}><div className={css.title}>Balance (ETH)</div></div>
          <div className={css.row}>
            <div className={css.big}>{fmt(cur?.avg_balance_eth,3)}</div>
            <div className={css.sub}>on-chain (avg)</div>
            <div className={css.delta}><Arrow s={dBal.sign}/> {dBal.diff==null?'—':fmt(dBal.diff,3)} <span className={css.muted}>({dBal.pct==null?'—':fmt(dBal.pct,1)+'%'})</span></div>
          </div>
          <Spark series={sBalEth} labels={labels} selected={selLocal} onSelect={setLocal} color="rgb(59,130,246)"/>
        </div>

        <div className={css.card}>
          <div className={css.head}><div className={css.title}>Trades (count)</div></div>
          <div className={css.row}><div className={css.big}>{cur?.token_txs ?? 0}</div><div className={css.sub}>swap/trade tx count</div><div className={css.delta}><Arrow s={dTrd.sign}/> {dTrd.diff==null?'—':String(dTrd.diff)} <span className={css.muted}>({dTrd.pct==null?'—':fmt(dTrd.pct,1)+'%'})</span></div></div>
          <Spark series={sTrades} labels={labels} selected={selLocal} onSelect={setLocal} color="rgb(16,185,129)"/>
        </div>

        <div className={css.card}>
          <div className={css.head}><div className={css.title}>Transactions</div></div>
          <div className={css.row}><div className={css.big}>{cur?.native_txs ?? 0}</div><div className={css.sub}>txs per month</div><div className={css.delta}><Arrow s={dTx.sign}/> {dTx.diff==null?'—':String(dTx.diff)} <span className={css.muted}>({dTx.pct==null?'—':fmt(dTx.pct,1)+'%'})</span></div></div>
          <Spark series={sTx} labels={labels} selected={selLocal} onSelect={setLocal} color="rgb(37,99,235)"/>
        </div>

        {/* Row 2 */}
        <div className={css.card}>
          <div className={css.head}><div className={css.title}>Unique Contracts</div></div>
          <div className={css.row}><div className={css.big}>{cur?.uniq_contracts ?? 0}</div><div className={css.sub}>per month</div><div className={css.delta}><Arrow s={dUniq.sign}/> {dUniq.diff==null?'—':String(dUniq.diff)} <span className={css.muted}>({dUniq.pct==null?'—':fmt(dUniq.pct,1)+'%'})</span></div></div>
          <Spark series={sUniq} labels={labels} selected={selLocal} onSelect={setLocal} color="rgb(234,179,8)"/>
        </div>

        <div className={css.card}>
          <div className={css.head}><div className={css.title}>Active Days</div></div>
          <div className={css.row}><div className={css.big}>{cur?.uniq_days ?? 0}</div><div className={css.sub}>per month</div><div className={css.delta}><Arrow s={dDays.sign}/> {dDays.diff==null?'—':String(dDays.diff)} <span className={css.muted}>({dDays.pct==null?'—':fmt(dDays.pct,1)+'%'})</span></div></div>
          <Spark series={sDays} labels={labels} selected={selLocal} onSelect={setLocal} color="rgb(168,85,247)"/>
        </div>

        <div className={css.card}>
          <div className={css.head}><div className={css.title}>Best Streak (days)</div></div>
          <div className={css.row}><div className={css.big}>{cur?.uniq_weeks ?? 0}</div><div className={css.sub}>within month</div><div className={css.delta}><Arrow s={dStrk.sign}/> {dStrk.diff==null?'—':String(dStrk.diff)} <span className={css.muted}>({dStrk.pct==null?'—':fmt(dStrk.pct,1)+'%'})</span></div></div>
          <Spark series={sStreak} labels={labels} selected={selLocal} onSelect={setLocal} color="rgb(251,191,36)"/>
        </div>

        {/* Row 3 (اختیاری: اگر پایین صفحه داری) */}
        <div className={css.card}>
          <div className={css.head}><div className={css.title}>Gas Paid (ETH)</div></div>
          <div className={css.row}>
            <div className={css.big}>{fmt(cur?.gas_spent_eth,4)}</div>
            <div className={css.sub}>this month</div>
            <div className={css.delta}>
              {(()=>{ const d=dGas; return (<><Arrow s={d.sign}/> {d.diff==null?'—':fmt(d.diff,4)} <span className={css.muted}>{d.pct==null?'':`(${fmt(d.pct,1)}%)`}</span></>) })()}
            </div>
          </div>
          <Spark series={sGas} labels={labels} selected={selLocal} onSelect={setLocal} color="rgb(239,68,68)"/>
        </div>

        <div className={css.card}>
          <div className={css.head}><div className={css.title}>NFT (count)</div></div>
          <div className={css.row}><div className={css.big}>{cur?.nft_unique_contracts ?? 0}</div><div className={css.sub}>per month</div><div className={css.delta}><Arrow s={dNft.sign}/> {dNft.diff==null?'—':String(dNft.diff)} <span className={css.muted}>({dNft.pct==null?'—':fmt(dNft.pct,1)+'%'})</span></div></div>
          <Spark series={sNFT} labels={labels} selected={selLocal} onSelect={setLocal} color="rgb(99,102,241)"/>
        </div>

        <div className={css.card}>
          <div className={css.head}><div className={css.title}>Monthly Rank</div></div>
          <div className={css.row}>
            <div className={css.big}>{rankCur ?? '—'}</div>
            <div className={css.sub}>better is lower</div>
            <div className={css.delta}><Arrow s={dRank.sign}/> {dRank.diff==null?'—':(dRank.diff>0?`+${dRank.diff}`:`${dRank.diff}`)}</div>
          </div>
          <Spark series={sRank} labels={labels} selected={selLocal} onSelect={setLocal} color="rgb(107,114,128)"/>
        </div>
      </div>
    </div>
  )
}
