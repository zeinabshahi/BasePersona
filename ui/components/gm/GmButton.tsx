import React from 'react'
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { gmStreak1155Abi } from '../../lib/abi/gmStreak1155'

type Props = { contract?: string }

const PILL_H = 44
const PILL_R = PILL_H / 2

function fmtHMS(totalSec: number) {
  const s = Math.max(0, Math.floor(totalSec))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  return `${h}h ${m}m ${sec}s`
}

export default function GmButton({ contract }: Props) {
  const { address } = useAccount()

  const { data: userData } = useReadContract({
    address: (contract as `0x${string}`) || undefined,
    abi: gmStreak1155Abi,
    functionName: 'getUser',
    args: [address ?? '0x0000000000000000000000000000000000000000'],
    query: { enabled: Boolean(contract && address) },
  })
  const { data: feeData } = useReadContract({
    address: (contract as `0x${string}`) || undefined,
    abi: gmStreak1155Abi,
    functionName: 'bmFeeWei',
    args: [],
    query: { enabled: Boolean(contract) },
  })

  const lastDay = Number((userData as any)?.[0] ?? 0)
  const longest = Number((userData as any)?.[2] ?? 0)

  const nowSec = Math.floor(Date.now() / 1000)
  const nowDay = Math.floor(nowSec / 86400)
  const canBm = address ? (lastDay < nowDay) : false
  const nextAt = (lastDay + 1) * 86400
  const remain = Math.max(0, nextAt - nowSec)

  const { writeContract, data: hash, isPending } = useWriteContract()
  const { isLoading: isMining } = useWaitForTransactionReceipt({ hash })

  const onBm = () => {
    if (!contract) return
    const value = (feeData as bigint | undefined) ?? 0n
    writeContract({
      address: contract as `0x${string}`,
      abi: gmStreak1155Abi,
      functionName: 'bm',
      args: [1],
      value
    })
  }

  if (!contract) {
    return (
      <span title="Set NEXT_PUBLIC_BM_STREAK1155 in .env.local" style={{
        height: PILL_H, lineHeight: `${PILL_H}px`,
        padding: '0 14px', borderRadius: PILL_R,
        border: '1px solid #e5e7eb', color: '#6b7280', fontSize: 12, display: 'inline-block'
      }}>
        BM disabled
      </span>
    )
  }

  const disabled = !address || isPending || isMining || !canBm

  const btnStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 10,
    height: PILL_H,
    padding: '0 16px',
    borderRadius: PILL_R,
    border: '1px solid rgba(59,130,246,0.35)',
    background: disabled
      ? 'linear-gradient(180deg, rgba(203,213,225,0.65), rgba(226,232,240,0.65))'
      : 'linear-gradient(180deg, #60a5fa, #3b82f6)',
    color: disabled ? '#334155' : '#fff',
    fontWeight: 800,
    fontSize: 14,
    boxShadow: disabled ? '0 6px 16px rgba(0,0,0,0.06)' : '0 12px 28px rgba(59,130,246,0.30)',
    cursor: disabled ? 'not-allowed' : 'pointer',
    transition: 'transform .12s ease, box-shadow .12s ease, filter .12s ease, width .12s ease',
    transform: disabled ? 'none' : 'translateY(-1px)',
    filter: disabled ? 'grayscale(.15)' : 'none',
    minWidth: 200,            // پهنای پایهٔ بیشتر
    justifyContent: 'center'
  }

  const supStyle: React.CSSProperties = { fontSize: 11, fontWeight: 900, marginLeft: 2, opacity: disabled ? .85 : 1 }

  const smallPill: React.CSSProperties = {
    height: PILL_H - 18,      // کمی کوچکتر از دکمه
    display: 'inline-flex',
    alignItems: 'center',
    padding: '0 10px',
    borderRadius: 999,
    border: '1px solid rgba(255,255,255,0.45)',
    background: disabled ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.25)',
    color: disabled ? '#0f172a' : '#f8fafc',
    fontSize: 11,
    fontWeight: 800
  }

  return (
    <button
      onClick={onBm}
      disabled={disabled}
      aria-live="polite"
      aria-busy={isPending || isMining}
      title={canBm ? `Send BM — longest ${longest}d` : `Next BM in ~ ${fmtHMS(remain)} — longest ${longest}d`}
      style={btnStyle}
      onMouseEnter={(e) => { if (!disabled) e.currentTarget.style.transform = 'translateY(-2px) scale(1.02)' }}
      onMouseLeave={(e) => { if (!disabled) e.currentTarget.style.transform = 'translateY(-1px)' }}
    >
      <span style={{ display:'inline-flex', alignItems:'baseline', gap:4 }}>
        <span>BM!</span>
        {longest > 0 && <sup style={supStyle} aria-label="longest-streak">{longest}</sup>}
      </span>

      {(isPending || isMining) && <span style={smallPill}>Sending…</span>}
      {!canBm && !isPending && !isMining && <span style={smallPill}>in {fmtHMS(remain)}</span>}
    </button>
  )
}
