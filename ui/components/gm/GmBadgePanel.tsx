import React from 'react'
import GmBadgeBar from './GmBadgeBar'
import GmButton from './GmButton'

type Props = { contract?: string }

export default function GmBadgePanel({ contract }: Props) {
  // هدر شفاف/بدون کارت؛ فقط چینش خطی با فاصله
  const row: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
  }

  const titleWrap: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    marginRight: 6
  }

  const titleStyle: React.CSSProperties = {
    fontSize: 14,
    fontWeight: 800,
    color: '#0f172a'
  }

  const subStyle: React.CSSProperties = {
    fontSize: 12,
    color: '#64748b'
  }

  return (
    <div style={row}>
      <div style={titleWrap}>
        <div style={titleStyle}>BM Streak</div>
        <div style={subStyle}>Collect time-based badges by sending one BM per day</div>
      </div>

      {/* بج‌ها در خط */}
      <GmBadgeBar contract={contract} />

      {/* دکمه BM در همان خط */}
      <div style={{ marginLeft: 6 }}>
        <GmButton contract={contract} />
      </div>
    </div>
  )
}
