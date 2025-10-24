import * as React from 'react';
import css from './frames.module.css';
import { genDemoPayload, type Payload, type Monthly } from '../lib/demoMetrics';

type Rank = { rank: number; pct: number; score?: number };

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'] as const;
const ORIGIN_YM = 202307;

const fmt = (n?: number, d = 2) => (n == null || Number.isNaN(n) ? '—' : Number(n).toFixed(d));
function delta(a?: number, b?: number) {
  if (a == null || b == null) return { diff: null as number | null, pct: null as number | null, sign: 0 as -1 | 0 | 1 };
  const diff = a - b;
  const pct = b === 0 ? (a === 0 ? 0 : 100) : (diff / b) * 100;
  return { diff, pct, sign: (diff === 0 ? 0 : diff > 0 ? 1 : -1) as -1 | 0 | 1 };
}
const ymToText = (ym: number) => `${MONTHS[(ym % 100) - 1]} ${Math.floor(ym / 100)}`;

/* -------------------- Responsive sparkline with hover tooltip -------------------- */
function useResize(cb: (w: number) => void) {
  const ref = React.useRef<HTMLDivElement | null>(null);
  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const RO: any = (typeof window !== 'undefined' && (window as any).ResizeObserver) ? (window as any).ResizeObserver : null;
    if (RO) {
      const ro = new RO((entries: any[]) => {
        const rect = entries?.[0]?.contentRect;
        if (rect && typeof rect.width === 'number') cb(rect.width);
      });
      try { ro.observe(el); } catch {}
      return () => { try { ro.disconnect(); } catch {} };
    }
    const onResize = () => { try { cb(el.getBoundingClientRect().width); } catch {} };
    window.addEventListener('resize', onResize); onResize();
    return () => window.removeEventListener('resize', onResize);
  }, [cb]);
  return ref;
}

type SparkProps = {
  series: number[];
  labels: string[];
  selected: number | null;
  onPointClick?: (i: number) => void;
  color: string;
  tooltip?: (value: number, label: string) => string;
};
function Spark({ series, labels, selected, onPointClick, color, tooltip }: SparkProps) {
  const [w, setW] = React.useState<number>(360);
  const h = 96, pad = 10;
  const wrapRef = useResize((ww) => setW(Math.max(260, Math.min(ww, 1200))));
  const n = series.length;
  const xs = React.useMemo(() => series.map((_, i) => pad + (n > 1 ? (i * (w - pad * 2)) / (n - 1) : 0)), [n, w, series.length, pad]);
  const max = Math.max(0.0001, ...series);
  const y = (v: number) => h - pad - (v / max) * (h - pad * 2);
  const d = xs.map((x, i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y(series[i]).toFixed(1)}`).join(' ');
  const area = `${d} L${xs[n - 1]?.toFixed(1) || pad},${(h - pad).toFixed(1)} L${xs[0]?.toFixed(1) || pad},${(h - pad).toFixed(1)} Z`;

  // tooltip
  const tipRef = React.useRef<{x:number,y:number,text:string}|null>(null);
  const [, force] = React.useState(0);
  const rafRef = React.useRef<number|undefined>(undefined);
  function setTip(next:{x:number,y:number,text:string}|null){
    tipRef.current = next;
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => { force(v=>v+1); rafRef.current = undefined; });
  }
  function showTip(e: React.MouseEvent, i:number){
    const el = wrapRef.current as any;
    const rect = el?.getBoundingClientRect?.();
    if(!rect) return;
    const vx = e.clientX - rect.left + 8;
    const vy = e.clientY - rect.top - 24;
    const text = tooltip ? tooltip(series[i], labels[i]) : `${labels[i]} • ${fmt(series[i])}`;
    setTip({x:vx, y:vy, text});
  }
  const tip = tipRef.current;

  return (
    <div ref={wrapRef} className={css.sparkWrap} style={{ position: 'relative' }}>
      <svg viewBox={`0 0 ${w} ${h}`} className={css.spark} preserveAspectRatio="none" onMouseLeave={()=>setTip(null)}>
        <path d={area} style={{ fill: color.replace('rgb','rgba').replace(')',',.16)') }} />
        <path d={d} style={{ stroke: color, strokeWidth: 2, fill: 'none' }} />
        {xs.map((x, i) => (
          <circle
            key={i}
            cx={x}
            cy={y(series[i])}
            r={selected === i ? 4 : 2}
            className={selected === i ? css.dotSel : css.dot}
            onMouseEnter={(e)=>showTip(e,i)}
            onMouseMove={(e)=>showTip(e,i)}
            onClick={() => onPointClick?.(i)}
          />
        ))}
      </svg>
      {tip && (
        <div
          style={{
            position:'absolute', left: tip.x, top: tip.y, pointerEvents:'none',
            background:'rgba(0,0,0,0.78)', color:'#fff', fontSize:12, padding:'4px 6px',
            borderRadius:6, whiteSpace:'nowrap', transform:'translate(-50%,-100%)'
          }}
        >{tip.text}</div>
      )}
    </div>
  );
}
/* ------------------------------------------------------------------------------- */

function Arrow({ s }: { s: -1 | 0 | 1 }) {
  return s > 0 ? <span className={css.up}>▲</span> : s < 0 ? <span className={css.down}>▼</span> : <span className={css.flat}>■</span>;
}

export default function WalletMetrics(props: {
  address: string;
  selectedYm?: number | null;
  onMonthsLoaded?: (list: { ym: number; label: string }[]) => void;
  onSelectionChange?: (ym: number) => void;
}) {
  const { address, selectedYm = null, onMonthsLoaded, onSelectionChange } = props;
  const [data, setData] = React.useState<Payload | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);

  // 1) always show demo preview first
  React.useEffect(() => {
    const demo = genDemoPayload(ORIGIN_YM);
    const sorted = [...demo.monthly].sort((a, b) => a.ym - b.ym);
    setData({ ...demo, monthly: sorted });
    setNotice(null);
    onMonthsLoaded?.(sorted.map(m => ({ ym: m.ym, label: ymToText(m.ym) })));
  }, [address]); // eslint-disable-line

  // 2) then try to replace with real data
  React.useEffect(() => {
    let dead = false;
    (async () => {
      try {
        const r = await fetch(`/api/metrics?${new URLSearchParams({ address: address.toLowerCase() })}`);
        if (!r.ok) throw new Error(String(r.status));
        const j = (await r.json()) as Payload;
        const sorted = [...j.monthly].map(m => ({ ...m, ym: m.ym })).sort((a, b) => (a.ym || 0) - (b.ym || 0));
        if (!dead) {
          setData({ ...j, monthly: sorted });
          setNotice(null);
          onMonthsLoaded?.(sorted.map(m => ({ ym: m.ym, label: ymToText(m.ym) })));
        }
      } catch {
        if (!dead) setNotice('not_in_dataset');
      }
    })();
    return () => { dead = true; };
  }, [address, onMonthsLoaded]);

  if (!data) return null;

  const months: Monthly[] = data.monthly;
  const labels = months.map((m) => ymToText(m.ym));
  const selIndex = (() => {
    if (selectedYm == null) return months.length - 1;
    const i = months.findIndex((m) => m.ym === selectedYm);
    return i >= 0 ? i : months.length - 1;
  })();
  const setSelIndex = (i: number) => {
    const idx = Math.max(0, Math.min(i, months.length - 1));
    const ym = months[idx]?.ym;
    if (ym && onSelectionChange) onSelectionChange(ym);
  };

  const cur = months[selIndex] ?? months[months.length - 1];
  const prev = months[selIndex - 1] ?? cur;

  // series
  const sBalEth = months.map((m) => m.avg_balance_eth ?? 0);
  const sVolUsd = months.map((m) => m.volume_usd ?? 0);
  const sInter  = months.map((m) => (m.native_txs ?? 0) + (m.token_txs ?? 0) + (m.nft_unique_contracts ?? 0) + (m.uniq_contracts ?? 0));
  const sAct    = months.map((m) => (m.native_txs ?? 0) + (m.token_txs ?? 0));
  const sDays   = months.map((m) => m.uniq_days ?? 0);
  const sTokU   = months.map((m) => m.tokens_traded_unique ?? 0);
  const sGas    = months.map((m) => m.gas_spent_eth ?? 0);
  const sNftCnt = months.map((m) => m.nft_unique_contracts ?? 0);
  const sOvScore= months.map((m) => m.ranks?.overall?.score ?? 0);

  // deltas
  const dBal = delta(cur.avg_balance_eth, prev.avg_balance_eth);
  const dVol = delta(cur.volume_usd, prev.volume_usd);
  const dInt = delta(sInter[selIndex], sInter[Math.max(0, selIndex - 1)]);
  const dAct = delta(sAct[selIndex], sAct[Math.max(0, selIndex - 1)]);
  const dDays= delta(cur.uniq_days, prev.uniq_days);
  const dTokU= delta(cur.tokens_traded_unique, prev.tokens_traded_unique);
  const dNft = delta(cur.nft_unique_contracts, prev.nft_unique_contracts);
  const rankCur = cur.ranks?.overall?.rank ?? null;
  const rankPrev= prev.ranks?.overall?.rank ?? null;
  const dRank = (rankCur==null || rankPrev==null)
    ? { diff:null as number|null, pct:null as number|null, sign:0 as -1|0|1 }
    : { diff: rankPrev - rankCur, pct: null, sign: (rankPrev - rankCur)===0?0:((rankPrev - rankCur)>0?1:-1) as -1|0|1 };

  // Best streak (DAYS): interpret as the max active days recorded in any month
  const bestStreakDays = Math.max(0, ...months.map(m => m.uniq_days ?? 0));

  return (
    <div className={css.wrap}>
      {notice === 'not_in_dataset' && (
        <div style={{ margin:'8px 0 12px', padding:'8px 10px', borderRadius:8, background:'#FFF7ED', color:'#9A3412', border:'1px solid #FDBA74', fontWeight:600 }}>
          This address is not in our “Top 1,000,000 Base wallets” dataset. Showing a demo preview.
        </div>
      )}

      <div className={css.topinfo}>
        <div className={css.selMonth}>Month: <strong>{labels[selIndex] || '—'}</strong></div>
        <div className={css.streaks}>
          <span className={css.badge}>Best Streak: {bestStreakDays} days</span>
        </div>
      </div>

      {/* === GRID (3×3) — order restored === */}
      <div className={css.grid}>
        {/* Row 1: Balance / Volume / Interactions */}
        <div className={css.card}>
          <div className={css.head}><div className={css.title}>Balance (ETH)</div><div className={css.rank}>{cur?.ranks?.balance?.rank ? `Rank #${cur.ranks.balance.rank}` : '—'}</div></div>
          <div className={css.row}>
            <div className={css.big}>{fmt(cur?.avg_balance_eth, 3)}</div>
            <div className={css.sub}>on-chain (avg)</div>
            <div className={css.delta}><Arrow s={dBal.sign} /> {dBal.diff == null ? '—' : fmt(dBal.diff, 3)} <span className={css.muted}>({dBal.pct == null ? '—' : `${fmt(dBal.pct, 1)}%`})</span></div>
          </div>
          <Spark series={sBalEth} labels={labels} selected={selIndex} onPointClick={setSelIndex} color="rgb(34,197,94)" tooltip={(v,l)=>`${l} • ${fmt(v,3)} ETH`} />
        </div>

        <div className={css.card}>
          <div className={css.head}><div className={css.title}>Volume (USD)</div><div className={css.rank}>{cur?.ranks?.volume?.rank ? `Rank #${cur.ranks.volume.rank}` : '—'}</div></div>
          <div className={css.row}>
            <div className={css.big}>${fmt(cur?.volume_usd, 2)}</div>
            <div className={css.sub}>swap + bridge</div>
            <div className={css.delta}><Arrow s={dVol.sign} /> {dVol.diff == null ? '—' : `$${fmt(dVol.diff, 2)}`} <span className={css.muted}>({dVol.pct == null ? '—' : `${fmt(dVol.pct, 1)}%`})</span></div>
          </div>
          <Spark series={sVolUsd} labels={labels} selected={selIndex} onPointClick={setSelIndex} color="rgb(59,130,246)" tooltip={(v,l)=>`${l} • $${fmt(v,2)}`} />
        </div>

        <div className={css.card}>
          <div className={css.head}><div className={css.title}>Interactions</div><div className={css.rank}>{cur?.ranks?.activity?.rank ? `Rank #${cur.ranks.activity.rank}` : '—'}</div></div>
          <div className={css.row}>
            <div className={css.big}>{(cur?.native_txs ?? 0) + (cur?.token_txs ?? 0) + (cur?.nft_unique_contracts ?? 0) + (cur?.uniq_contracts ?? 0)}</div>
            <div className={css.sub}>total</div>
            <div className={css.delta}><Arrow s={dInt.sign} /> {dInt.diff == null ? '—' : String(dInt.diff)} <span className={css.muted}>({dInt.pct == null ? '—' : `${fmt(dInt.pct, 1)}%`})</span></div>
          </div>
          <Spark series={sInter} labels={labels} selected={selIndex} onPointClick={setSelIndex} color="rgb(2,132,199)" tooltip={(v,l)=>`${l} • ${fmt(v,0)} interactions`} />
        </div>

        {/* Row 2: Activity / Time & engagement / NFT Holders */}
        <div className={css.card}>
          <div className={css.head}><div className={css.title}>Activity</div><div className={css.rank}>{cur?.ranks?.activity?.rank ? `Rank #${cur.ranks.activity.rank}` : '—'}</div></div>
          <div className={css.kpis}>
            <div className={css.kpi}><div className={css.kv}>{cur?.native_txs ?? 0}</div><div className={css.kk}>Native TXs</div></div>
            <div className={css.kpi}><div className={css.kv}>{cur?.token_txs ?? 0}</div><div className={css.kk}>Token TXs</div></div>
            <div className={css.kpi}><div className={css.kv}>{cur?.uniq_contracts ?? 0}</div><div className={css.kk}>Unique Contracts</div></div>
          </div>
          <div className={css.delta}><Arrow s={dAct.sign} /> {dAct.diff == null ? '—' : String(dAct.diff)} <span className={css.muted}>({dAct.pct == null ? '—' : `${fmt(dAct.pct, 1)}%`})</span></div>
          <Spark series={sAct} labels={labels} selected={selIndex} onPointClick={setSelIndex} color="rgb(234,179,8)" tooltip={(v,l)=>`${l} • ${fmt(v,0)} txs`} />
        </div>

        <div className={css.card}>
          <div className={css.head}><div className={css.title}>Time & engagement</div><div className={css.rank}>—</div></div>
          <div className={css.kpis}>
            <div className={css.kpi}><div className={css.kv}>{cur?.uniq_days ?? 0}</div><div className={css.kk}>Active days</div></div>
            <div className={css.kpi}><div className={css.kv}>{bestStreakDays}</div><div className={css.kk}>Best streak (days)</div></div>
            <div className={css.kpi}><div className={css.kv}>{data.summary?.wallet_age_days ?? '—'}</div><div className={css.kk}>Wallet age (days)</div></div>
          </div>
          <div className={css.delta}><Arrow s={dDays.sign}/> {dDays.diff==null?'—':String(dDays.diff)} <span className={css.muted}>({dDays.pct==null?'—':`${fmt(dDays.pct,1)}%`})</span></div>
          <Spark series={sDays} labels={labels} selected={selIndex} onPointClick={setSelIndex} color="rgb(147,51,234)" tooltip={(v,l)=>`${l} • ${fmt(v,0)} days`} />
        </div>

        <div className={css.card}>
          <div className={css.head}><div className={css.title}>NFT Holders</div><div className={css.rank}>{cur?.ranks?.nft?.rank ? `Rank #${cur.ranks.nft.rank}` : '—'}</div></div>
          <div className={css.badgeRow}>
            <span className={cur?.nft_holds_builder?css.badgeOn:css.badgeOff}>Base Builder {cur?.nft_holds_builder? 'Yes':'No'}</span>
            <span className={cur?.nft_holds_introduced?css.badgeOn:css.badgeOff}>Base Introduced {cur?.nft_holds_introduced? 'Yes':'No'}</span>
          </div>
          <div className={css.row}>
            <div className={css.big}>{cur?.nft_unique_contracts ?? '—'}</div>
            <div className={css.sub}>NFT contracts</div>
            <div className={css.delta}><Arrow s={dNft.sign}/> {dNft.diff==null?'—':String(dNft.diff)} <span className={css.muted}>({dNft.pct==null?'—':`${fmt(dNft.pct,1)}%`})</span></div>
          </div>
          <Spark series={sNftCnt} labels={labels} selected={selIndex} onPointClick={setSelIndex} color="rgb(99,102,241)" tooltip={(v,l)=>`${l} • ${fmt(v,0)} NFT contracts`} />
        </div>

        {/* Row 3: Unique Tokens / Overall Ranking / Gas Paid */}
        <div className={css.card}>
          <div className={css.head}><div className={css.title}>Unique Tokens Traded</div><div className={css.rank}>—</div></div>
          <div className={css.row}>
            <div className={css.big}>{cur?.tokens_traded_unique ?? 0}</div>
            <div className={css.sub}>this month</div>
            <div className={css.delta}><Arrow s={dTokU.sign}/> {dTokU.diff==null?'—':String(dTokU.diff)} <span className={css.muted}>({dTokU.pct==null?'—':`${fmt(dTokU.pct,1)}%`})</span></div>
          </div>
          <Spark series={sTokU} labels={labels} selected={selIndex} onPointClick={setSelIndex} color="rgb(20,184,166)" tooltip={(v,l)=>`${l} • ${fmt(v,0)} tokens`} />
        </div>

        <div className={css.card}>
          <div className={css.head}><div className={css.title}>Overall Ranking</div><div className={css.rank}>{rankCur ? `Rank #${rankCur}` : '—'}</div></div>
          <div className={css.row}>
            <div className={css.big}>{rankCur ?? '—'}</div>
            <div className={css.sub}>better is lower</div>
            <div className={css.delta}><Arrow s={dRank.sign}/> {dRank.diff==null?'—':(dRank.diff>0?`+${dRank.diff}`:`${dRank.diff}`)} <span className={css.muted}>{cur?.ranks?.overall?.score!=null ? `(score ${fmt(cur.ranks.overall.score,2)})` : ''}</span></div>
          </div>
          <Spark series={sOvScore} labels={labels} selected={selIndex} onPointClick={setSelIndex} color="rgb(107,114,128)" tooltip={(v,l)=>`${l} • score ${fmt(v,2)}`} />
        </div>

        <div className={css.card}>
          <div className={css.head}><div className={css.title}>Gas Paid (ETH)</div><div className={css.rank}>—</div></div>
          <div className={css.row}>
            <div className={css.big}>{fmt(cur?.gas_spent_eth,4)}</div>
            <div className={css.sub}>this month</div>
            <div className={css.delta}>
              {(() => { const d=delta(cur.gas_spent_eth, prev.gas_spent_eth); return (<><Arrow s={d.sign}/> {d.diff==null?'—':fmt(d.diff,4)} <span className={css.muted}>{d.pct==null?'':`(${fmt(d.pct,1)}%)`}</span></>) })()}
            </div>
          </div>
          <Spark series={sGas} labels={labels} selected={selIndex} onPointClick={setSelIndex} color="rgb(244,63,94)" tooltip={(v,l)=>`${l} • ${fmt(v,4)} ETH`} />
        </div>
      </div>
    </div>
  );
}
