import * as React from 'react'
type Props = {
  series: number[]
  height?: number
  strokeWidth?: number
  selected?: number | null
  ariaLabel?: string
}
export default function KpiSpark({ series, height=68, strokeWidth=2, selected=null, ariaLabel }: Props) {
  const w = 220, h = height, pad = 8
  const max = Math.max(0.0001, ...series)
  const min = Math.min(...series, 0)
  const scaleY = (v:number) => {
    const t = (v - min) / (max - min || 1)
    return h - pad - t * (h - pad*2)
  }
  const step = series.length>1 ? (w - pad*2) / (series.length-1) : 1
  const xs = series.map((_,i)=> pad + i*step)
  const line = series.map((v,i)=> `${i?'L':'M'}${xs[i].toFixed(1)},${scaleY(v).toFixed(1)}`).join(' ')
  const area = `${series.map((v,i)=> `${i?'L':'M'}${xs[i].toFixed(1)},${scaleY(v).toFixed(1)}`).join(' ')} L${xs[xs.length-1].toFixed(1)},${(h-pad).toFixed(1)} L${xs[0].toFixed(1)},${(h-pad).toFixed(1)} Z`
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} aria-label={ariaLabel}>
      <path d={area} fill="rgba(59,130,246,.18)"/>
      <path d={line} fill="none" stroke="rgb(59,130,246)" strokeWidth={strokeWidth}/>
      {series.map((v,i)=>(
        <circle key={i} cx={xs[i]} cy={scaleY(v)} r={selected===i?4:3}
          fill={selected===i?'#fff':'rgb(59,130,246)'} stroke={selected===i?'rgb(59,130,246)':'none'} strokeWidth={2}/>
      ))}
    </svg>
  )
}
