import * as React from 'react'
import css from './frames.module.css'
import { genDemoPayload } from '../lib/demoMetrics'

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
  uniq_weeks?: number
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

function fmt(n?: number, d=2){ return (n==null||isNaN(n))?'—':Number(n).toFixed(d) }
function delta(a?: number, b?: number){
  if(a==null||b==null) return {diff:null,pct:null,sign:0 as -1|0|1}
  const diff=a-b; const pct=b===0?(a===0?0:100):(diff/b)*100
  return {diff,pct,sign:(diff===0?0:(diff>0?1:-1)) as -1|0|1}
}

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

function Arrow({s}:{s:-1|0|1}){ return s>0? <span className={css.up}>▲</span> : s<0? <span className={css.down}>▼</span> : <span className={css.flat}>■</span> }

export default function WalletFrames({ address }:{ address:string }) {
  const [data,setData]=React.useState<Payload|null>(null)
  const [err,setErr]=React.useState<string|null>(null)

  // سِلکشن سراسری ماه + بازه
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
          const start = 0
          setRange([start,last])
          setPreset('last12')
        }
      }catch(e:any){ if(!off) setErr(e?.message||'fetch failed') }
    }
    if(address) load()
    return ()=>{off=true}
  },[address])

  if(!data) return err? <div className={css.error}>Error: {err}</div> : null

  const months = data.monthly
  const [r0,r1] = range ?? [0, months.length-1]
  const view = months.slice(0, months.length)
  const selLocal = Math.min(Math.max(sel-r0,0), view.length-1)

  const cur = months[sel] || {}
  const prev = months[sel-1] || {}

  // سری‌ها
  const labels = view.map(x=> x.month)
  const sBalEth = view.map(x=> Number(x.avg_balance_eth||0))
  const sVolUsd = view.map(x=> Number(x.volume_usd||0))
  const sInter  = view.map(x=> Number((x.native_txs||0)+(x.token_txs||0)+(x.nft_unique_contracts||0)+(x.uniq_contracts||0)))
  const sAct    = view.map(x=> Number((x.native_txs||0)+(x.token_txs||0)))
  const sNftCnt = view.map(x=> Number(x.nft_unique_contracts||0))
  const sDays   = view.map(x=> Number(x.uniq_days||0))
  const sTokU   = view.map(x=> Number(x.tokens_traded_unique||0))
  const sGas    = view.map(x=> Number(x.gas_spent_eth||0))
  const sOvScore= view.map(x=> Number(x.ranks?.overall?.score ?? 0)) // 0..1

  // دلتاها
  const dBal = delta(cur.avg_balance_eth, prev.avg_balance_eth)
  const dVol = delta(cur.volume_usd, prev.volume_usd)
  const dNft = delta(cur.nft_unique_contracts, prev.nft_unique_contracts)
  const dAct = delta((cur.native_txs||0)+(cur.token_txs||0), (prev.native_txs||0)+(prev.token_txs||0))
  const dInt = delta(
    (cur.native_txs||0)+(cur.token_txs||0)+(cur.nft_unique_contracts||0)+(cur.uniq_contracts||0),
    (prev.native_txs||0)+(prev.token_txs||0)+(prev.nft_unique_contracts||0)+(prev.uniq_contracts||0)
  )
  const dDays= delta(cur.uniq_days, prev.uniq_days)
  const dTokU= delta(cur.tokens_traded_unique, prev.tokens_traded_unique)
  const rankCur = cur.ranks?.overall?.rank
  const rankPrev= prev.ranks?.overall?.rank
  const dRank = (rankCur==null || rankPrev==null)
    ? { diff:null as number|null, pct:null as number|null, sign:0 as -1|0|1 }
    : { diff: rankPrev - rankCur, pct: null, sign: (rankPrev - rankCur)===0?0:((rankPrev - rankCur)>0?1:-1) as -1|0|1 }

  function applyPreset(v:'last6'|'last12'|'all'){
    setPreset(v)
    const n=months.length
    if(v==='all'){ setRange([0,n-1]); setSel(n-1); return }
    const take = v==='last6'?6:12
    const s=Math.max(0, n-take)
    setRange([s,n-1]); setSel(n-1)
  }
  function setLocal(i:number){ setSel(r0 + i) }

  // Helper: اگر کل سری صفر باشد، فریم را مخفی کن
  const hasAny = (arr:number[]) => arr.some(v => Number(v) !== 0)

  return (
    <div className={css.wrap}>
      {/* ── نوار بالا: فقط یک‌بار برای همهٔ فریم‌ها ── */}
      <div className={css.toolbar}>
        <div className={css.pills}>
          <button className={preset==='last6'?css.pillSel:css.pill} onClick={()=>applyPreset('last6')}>Last 6 months</button>
          <button className={preset==='last12'?css.pillSel:css.pill} onClick={()=>applyPreset('last12')}>Last 12 months</button>
          <button className={preset==='all'?css.pillSel:css.pill} onClick={()=>applyPreset('all')}>All time</button>
        </div>
        <div className={css.selMonth}>Month: <strong>{months[sel]?.month || '—'}</strong></div>
        <div className={css.streaks}>
          {(data.summary?.current_streak_months ?? 0) > 0 && (
            <span className={css.badge}>Streak: {data.summary!.current_streak_months}</span>
          )}
          {data.summary?.cum_ranks?.balance?.bucket && (
            <span className={css.badge}>Bucket: {data.summary.cum_ranks.balance.bucket}</span>
          )}
        </div>
      </div>

      {/* GRID: ۹ فریم (۳×۳) */}
      <div className={css.grid}>
        {/* Row 1: Balance / Volume / Interactions */}
        {hasAny(sBalEth) && (
          <div className={css.card}>
            <div className={css.head}><div className={css.title}>Balance (ETH)</div><div className={css.rank}>{cur?.ranks?.balance?.rank ? `Rank #${cur.ranks.balance.rank}` : '—'}</div></div>
            <div className={css.row}><div className={css.big}>{fmt(cur?.avg_balance_eth,3)}</div><div className={css.sub}>on-chain (avg)</div><div className={css.delta}><Arrow s={dBal.sign}/> {dBal.diff==null?'—':fmt(dBal.diff,3)} <span className={css.muted}>({dBal.pct==null?'—':fmt(dBal.pct,1)+'%'})</span></div></div>
            <Spark series={sBalEth} labels={labels} selected={selLocal} onSelect={setLocal} color="rgb(34,197,94)"/>
          </div>
        )}

        {hasAny(sVolUsd) && (
          <div className={css.card}>
            <div className={css.head}><div className={css.title}>Volume (USD)</div><div className={css.rank}>{cur?.ranks?.volume?.rank ? `Rank #${cur.ranks.volume.rank}` : '—'}</div></div>
            <div className={css.row}><div className={css.big}>${fmt(cur?.volume_usd,2)}</div><div className={css.sub}>swap + bridge</div><div className={css.delta}><Arrow s={dVol.sign}/> {dVol.diff==null?'—':`$${fmt(dVol.diff,2)}`} <span className={css.muted}>({dVol.pct==null?'—':fmt(dVol.pct,1)+'%'})</span></div></div>
            <Spark series={sVolUsd} labels={labels} selected={selLocal} onSelect={setLocal} color="rgb(59,130,246)"/>
          </div>
        )}

        {hasAny(sInter) && (
          <div className={css.card}>
            <div className={css.head}><div className={css.title}>Interactions</div><div className={css.rank}>{cur?.ranks?.activity?.rank ? `Rank #${cur.ranks.activity.rank}` : '—'}</div></div>
            <div className={css.row}><div className={css.big}>{(cur?.native_txs||0)+(cur?.token_txs||0)+(cur?.nft_unique_contracts||0)+(cur?.uniq_contracts||0)}</div><div className={css.sub}>total</div><div className={css.delta}><Arrow s={dInt.sign}/> {dInt.diff==null?'—':String(dInt.diff)} <span className={css.muted}>({dInt.pct==null?'—':fmt(dInt.pct,1)+'%'})</span></div></div>
            <Spark series={sInter} labels={labels} selected={selLocal} onSelect={setLocal} color="rgb(2,132,199)"/>
          </div>
        )}

        {/* Row 2: Activity / NFT Holders / Time & engagement */}
        {hasAny(sAct) && (
          <div className={css.card}>
            <div className={css.head}><div className={css.title}>Activity</div><div className={css.rank}>{cur?.ranks?.activity?.rank ? `Rank #${cur.ranks.activity.rank}` : '—'}</div></div>
            <div className={css.kpis}>
              <div className={css.kpi}><div className={css.kv}>{cur?.native_txs ?? 0}</div><div className={css.kk}>Native TXs</div></div>
              <div className={css.kpi}><div className={css.kv}>{cur?.token_txs ?? 0}</div><div className={css.kk}>Token TXs</div></div>
              <div className={css.kpi}><div className={css.kv}>{cur?.uniq_contracts ?? 0}</div><div className={css.kk}>Unique Contracts</div></div>
            </div>
            <div className={css.delta}><Arrow s={dAct.sign}/> {dAct.diff==null?'—':String(dAct.diff)} <span className={css.muted}>({dAct.pct==null?'—':fmt(dAct.pct,1)+'%'})</span></div>
            <Spark series={sAct} labels={labels} selected={selLocal} onSelect={setLocal} color="rgb(234,179,8)"/>
          </div>
        )}

        {hasAny(sNftCnt) && (
          <div className={css.card}>
            <div className={css.head}><div className={css.title}>NFT Holders</div><div className={css.rank}>{cur?.ranks?.nft?.rank ? `Rank #${cur.ranks.nft.rank}` : '—'}</div></div>
            <div className={css.badgeRow}>
              <span className={cur?.nft_holds_builder?css.badgeOn:css.badgeOff}>Base Builder {cur?.nft_holds_builder? 'Yes':'No'}</span>
              <span className={cur?.nft_holds_introduced?css.badgeOn:css.badgeOff}>Base Introduced {cur?.nft_holds_introduced? 'Yes':'No'}</span>
            </div>
            <div className={css.row}><div className={css.big}>{cur?.nft_unique_contracts ?? '—'}</div><div className={css.sub}>NFT contracts</div><div className={css.delta}><Arrow s={dNft.sign}/> {dNft.diff==null?'—':String(dNft.diff)} <span className={css.muted}>({dNft.pct==null?'—':fmt(dNft.pct,1)+'%'})</span></div></div>
            <Spark series={sNftCnt} labels={labels} selected={selLocal} onSelect={setLocal} color="rgb(99,102,241)"/>
          </div>
        )}

        {hasAny(sDays) && (
          <div className={css.card}>
            <div className={css.head}><div className={css.title}>Time & engagement</div><div className={css.rank}>—</div></div>
            <div className={css.kpis}>
              <div className={css.kpi}><div className={css.kv}>{data.summary?.wallet_age_days ?? '—'}</div><div className={css.kk}>Wallet age (days)</div></div>
              <div className={css.kpi}><div className={css.kv}>{cur?.uniq_days ?? 0}</div><div className={css.kk}>Unique days</div></div>
              <div className={css.kpi}><div className={css.kv}>{cur?.uniq_weeks ?? 0}</div><div className={css.kk}>Unique weeks</div></div>
            </div>
            <div className={css.delta}><Arrow s={dDays.sign}/> {dDays.diff==null?'—':String(dDays.diff)} <span className={css.muted}>({dDays.pct==null?'—':fmt(dDays.pct,1)+'%'})</span></div>
            <Spark series={sDays} labels={labels} selected={selLocal} onSelect={setLocal} color="rgb(147,51,234)"/>
          </div>
        )}

        {/* Row 3: Unique Tokens / Overall Ranking / Gas Paid */}
        {hasAny(sTokU) && (
          <div className={css.card}>
            <div className={css.head}><div className={css.title}>Unique Tokens Traded</div><div className={css.rank}>—</div></div>
            <div className={css.row}><div className={css.big}>{cur?.tokens_traded_unique ?? 0}</div><div className={css.sub}>this month</div><div className={css.delta}><Arrow s={dTokU.sign}/> {dTokU.diff==null?'—':String(dTokU.diff)} <span className={css.muted}>({dTokU.pct==null?'—':fmt(dTokU.pct,1)+'%'})</span></div></div>
            <Spark series={sTokU} labels={labels} selected={selLocal} onSelect={setLocal} color="rgb(20,184,166)"/>
          </div>
        )}

        {hasAny(sOvScore) && (
          <div className={css.card}>
            <div className={css.head}><div className={css.title}>Overall Ranking</div><div className={css.rank}>{rankCur ? `Rank #${rankCur}` : '—'}</div></div>
            <div className={css.row}>
              <div className={css.big}>{rankCur ?? '—'}</div>
              <div className={css.sub}>better is lower</div>
              <div className={css.delta}><Arrow s={dRank.sign}/> {dRank.diff==null?'—':(dRank.diff>0?`+${dRank.diff}`:`${dRank.diff}`)} <span className={css.muted}>{cur?.ranks?.overall?.score!=null ? `(score ${fmt(cur.ranks.overall.score,2)})` : ''}</span></div>
            </div>
            <Spark series={sOvScore} labels={labels} selected={selLocal} onSelect={setLocal} color="rgb(107,114,128)"/>
          </div>
        )}

        {hasAny(sGas) && (
          <div className={css.card}>
            <div className={css.head}><div className={css.title}>Gas Paid (ETH)</div><div className={css.rank}>—</div></div>
            <div className={css.row}>
              <div className={css.big}>{fmt(cur?.gas_spent_eth,4)}</div>
              <div className={css.sub}>this month</div>
              <div className={css.delta}>
                {(() => { const d=delta(cur.gas_spent_eth, prev.gas_spent_eth); return (<><Arrow s={d.sign}/> {d.diff==null?'—':fmt(d.diff,4)} <span className={css.muted}>{d.pct==null?'':`(${fmt(d.pct,1)}%)`}</span></>) })()}
              </div>
            </div>
            <Spark series={sGas} labels={labels} selected={selLocal} onSelect={setLocal} color="rgb(244,63,94)"/>
          </div>
        )}
      </div>
    </div>
  )
}
