import * as React from 'react'
import css from './frames.module.css' // از همون استایل فریم‌ها استفاده می‌کنیم
// اگر Spark جدا دارید، می‌تونید import کنید. اینجا نسخه‌ی سبک داخلی گذاشتم.

type Rank = { rank:number; pct:number; score?:number }
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
  uniq_weeks?: number
  nft_unique_contracts?: number
  nft_holds_builder?: number
  nft_holds_introduced?: number
  tokens_traded_unique?: number
  gas_spent_eth?: number
  // برخی دیتابیس‌ها این فیلدها را دارند؛ اگر نبودند مشکلی نیست:
  // streak_best_days?: number
  // streak_days?: number
  // streak?: number
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

function fmt(n?: number, d=2){ return (n==null||Number.isNaN(n)) ? '—' : Number(n).toFixed(d) }
function delta(a?: number, b?: number){
  if(a==null||b==null) return {diff:null as number|null, pct:null as number|null, sign:0 as -1|0|1}
  const diff=a-b
  const pct=b===0 ? (a===0?0:100) : (diff/b)*100
  return {diff, pct, sign: diff===0?0:(diff>0?1:-1) as -1|0|1}
}

/* --------- Spark (لوکال) --------- */
type SparkProps = {
  series:number[]; labels:string[]; selected:number; onSelect:(i:number)=>void; color:string
}
function Spark({series, labels, selected, onSelect, color}:SparkProps){
  const w=320, h=96, pad=10
  const n=series.length
  const xs = series.map((_,i)=> pad + (n>1? i*(w-pad*2)/(n-1):0))
  const max = Math.max(0.0001, ...series)
  const y = (v:number)=> h-pad-(v/max)*(h-pad*2)
  const d = xs.map((x,i)=> `${i?'L':'M'}${x.toFixed(1)},${y(series[i]).toFixed(1)}`).join(' ')
  const area = `${d} L${xs[n-1]?.toFixed(1)||pad},${(h-pad).toFixed(1)} L${xs[0]?.toFixed(1)||pad},${(h-pad).toFixed(1)} Z`
  const showEvery = Math.max(1, Math.ceil(n/6))
  return (
    <div className={css.sparkWrap}>
      <svg viewBox={`0 0 ${w} ${h}`} className={css.spark} preserveAspectRatio="none">
        <path d={area} style={{fill: color.replace('rgb','rgba').replace(')',',.16)')}} />
        <path d={d} style={{stroke: color, strokeWidth: 2, fill: 'none'}} />
        {xs.map((x,i)=>(
          <circle key={i} cx={x} cy={y(series[i])} r={i===selected?4:2}
                  className={i===selected?css.dotSel:css.dot}
                  onClick={()=>onSelect(i)} />
        ))}
      </svg>
      <div className={css.ticks}>
        {labels.map((lb,i)=>(
          <button
            key={i}
            type="button"
            className={i===selected?css.tickSel:css.tick}
            onClick={()=>onSelect(i)}
            style={{visibility: (i%showEvery===0 || i===labels.length-1)?'visible':'hidden'}}
            title={lb}
          >
            {lb}
          </button>
        ))}
      </div>
    </div>
  )
}

function Arrow({s}:{s:-1|0|1}){ 
  return s>0? <span className={css.up}>▲</span> 
       : s<0? <span className={css.down}>▼</span> 
       : <span className={css.flat}>■</span> 
}

export default function WalletMetrics({ address }:{ address:string }){
  const [data,setData]=React.useState<Payload|null>(null)
  const [err,setErr]=React.useState<string|null>(null)

  // انتخاب ماه + بازه
  const [sel,setSel]=React.useState(0)
  const [range,setRange]=React.useState<[number,number]|null>(null)
  const [preset,setPreset]=React.useState<'all'|'last6'|'last12'>('all')

  React.useEffect(()=>{
    let off=false
    async function load(){
      setErr(null)
      try{
        const r=await fetch(`/api/metrics?${new URLSearchParams({address:address.toLowerCase()}).toString()}`)
        if(!r.ok) throw new Error(`HTTP ${r.status}`)
        const j=await r.json() as Payload
        j.monthly.sort((a,b)=> a.month.localeCompare(b.month))
        if(!off){
          setData(j)
          const last=j.monthly.length-1
          setSel(last)
          const start=0
          setRange([start,last])
          setPreset('last12')
        }
      }catch(e:any){ if(!off) setErr(e?.message||'fetch failed') }
    }
    if(address) load()
    return ()=>{ off=true }
  },[address])

  if(!data) return err? <div className={css.error}>Error: {err}</div> : null

  const months = data.monthly
  const [r0,r1] = range ?? [0, months.length-1]
  const view = months.slice(r0, r1+1)
  const selLocal = Math.min(Math.max(sel-r0,0), view.length-1)

  const cur = months[sel] || {}
  const prev = months[sel-1] || {}

  // برچسب‌ها
  const labels = view.map(x=> x.month)

  // --- سری استریک روزها (انعطاف‌پذیر نسبت به نام فیلد در دیتابیس) ---
  const getStreakDays = (m:Monthly) =>
    Number((m as any).streak_best_days ?? (m as any).streak_days ?? (m as any).streak ?? 0)
  const sStrk = view.map(getStreakDays)
  const curStrk = getStreakDays(cur)
  const prevStrk = getStreakDays(prev)
  const dStrk = delta(curStrk, prevStrk)
  const hasAny = (arr:number[]) => arr.some(v => Number(v)!==0)

  // --- چند KPI خلاصه ---
  const ageDays = data.summary?.wallet_age_days ?? null
  const activeMonths = data.summary?.active_months_total ?? null
  const bucket = data.summary?.cum_ranks?.balance?.bucket
  const cumOverall = data.summary?.cum_ranks?.overall // {score, rank, pct}

  function applyPreset(v:'last6'|'last12'|'all'){
    setPreset(v)
    const n=months.length
    if(v==='all'){ setRange([0,n-1]); setSel(n-1); return }
    const take = v==='last6'?6:12
    const s=Math.max(0, n-take)
    setRange([s,n-1]); setSel(n-1)
  }
  function setLocal(i:number){ setSel(r0 + i) }

  return (
    <div className={css.wrap}>
      {/* نوار ابزار */}
      <div className={css.toolbar}>
        <div className={css.pills}>
          <button className={preset==='last6'?css.pillSel:css.pill} onClick={()=>applyPreset('last6')}>Last 6 months</button>
          <button className={preset==='last12'?css.pillSel:css.pill} onClick={()=>applyPreset('last12')}>Last 12 months</button>
          <button className={preset==='all'?css.pillSel:css.pill} onClick={()=>applyPreset('all')}>All time</button>
        </div>
        <div className={css.selMonth}>Month: <strong>{months[sel]?.month || '—'}</strong></div>
        <div className={css.streaks}>
          {/* بالای صفحه: فقط current streak ماه‌ها اگر >0 بود */}
          {(data.summary?.current_streak_months ?? 0) > 0 && (
            <span className={css.badge}>Streak: {data.summary!.current_streak_months}</span>
          )}
          {bucket && <span className={css.badge}>Bucket: {bucket}</span>}
        </div>
      </div>

      {/* GRID */}
      <div className={css.grid}>
        {/* --- Best Streak (days) — فقط اگر سری صفر-صفر نباشد --- */}
        {hasAny(sStrk) && (
          <div className={css.card}>
            <div className={css.head}>
              <div className={css.title}>Best Streak (days)</div>
              <div className={css.rank}>—</div>
            </div>
            <div className={css.row}>
              <div className={css.big}>{fmt(curStrk, 0)}</div>
              <div className={css.sub}>longest daily streak (selected month)</div>
              <div className={css.delta}>
                <Arrow s={dStrk.sign}/> {dStrk.diff==null?'—':fmt(dStrk.diff,0)} 
                <span className={css.muted}>({dStrk.pct==null?'—':fmt(dStrk.pct,1)+'%'})</span>
              </div>
            </div>
            <Spark series={sStrk} labels={labels} selected={selLocal} onSelect={setLocal} color="rgb(250,204,21)"/>
          </div>
        )}

        {/* Wallet age (days) */}
        <div className={css.card}>
          <div className={css.head}>
            <div className={css.title}>Wallet age</div>
            <div className={css.rank}>—</div>
          </div>
          <div className={css.row}>
            <div className={css.big}>{ageDays==null ? '—' : fmt(ageDays,0)}</div>
            <div className={css.sub}>days since first activity</div>
            <div className={css.delta}>—</div>
          </div>
        </div>

        {/* Active months total */}
        <div className={css.card}>
          <div className={css.head}>
            <div className={css.title}>Active months</div>
            <div className={css.rank}>—</div>
          </div>
          <div className={css.row}>
            <div className={css.big}>{activeMonths==null ? '—' : fmt(activeMonths,0)}</div>
            <div className={css.sub}>with any on-chain activity</div>
            <div className={css.delta}>—</div>
          </div>
        </div>

        {/* Cumulative overall rank/score (اگر موجود بود) */}
        {cumOverall && (
          <div className={css.card}>
            <div className={css.head}>
              <div className={css.title}>Overall (cumulative)</div>
              <div className={css.rank}>{cumOverall.rank!=null ? `Rank #${cumOverall.rank}` : '—'}</div>
            </div>
            <div className={css.row}>
              <div className={css.big}>{cumOverall.rank ?? '—'}</div>
              <div className={css.sub}>score & percentile</div>
              <div className={css.delta}>
                {cumOverall.score!=null && <span className={css.muted}>score {fmt(cumOverall.score,2)} </span>}
                {cumOverall.pct!=null && <span className={css.muted}> · top {fmt(cumOverall.pct*100,1)}%</span>}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
