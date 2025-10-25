'use client'

import React from 'react'
import {
  useAccount,
  useReadContract,
  useReadContracts,
  useWriteContract,
  useWaitForTransactionReceipt,
} from 'wagmi'
import { gmStreak1155Abi } from '../../lib/abi/gmStreak1155'

type Props = { contract?: string }

const PILL_H = 44
const PILL_R = PILL_H / 2
const ZERO = '0x0000000000000000000000000000000000000000' as const

const TIERS = [
  { id: 1, days: 7 as const },
  { id: 2, days: 30 as const },
  { id: 3, days: 90 as const },
  { id: 4, days: 180 as const },
  { id: 5, days: 365 as const },
] as const

const IMG_BASE = (process.env.NEXT_PUBLIC_BADGE_IMG_BASE || '/badges').replace(/\/$/, '')

export default function GmBadgeBar({ contract }: Props) {
  const { address } = useAccount()
  const enabled = Boolean(contract && address)

  // 1) user streak
  const { data: userData } = useReadContract({
    address: (contract as `0x${string}`) || undefined,
    abi: gmStreak1155Abi,
    functionName: 'getUser',
    args: [address ?? ZERO],
    query: { enabled },
  })
  const currentStreak = Number((userData as any)?.[1] ?? 0)

  // 2) balances (batch)
  const { data: balBatch } = useReadContracts({
    contracts: TIERS.map((t) => ({
      address: contract as `0x${string}`,
      abi: gmStreak1155Abi,
      functionName: 'balanceOf',
      args: [address ?? ZERO, BigInt(t.id)] as const,
    })),
    query: { enabled },
  })
  const balances: number[] = (balBatch ?? []).map((r: any) =>
    r?.result ? Number(r.result as bigint) : 0
  )

  // 3) images (fallback .PNG)
  const [srcs, setSrcs] = React.useState<string[]>(TIERS.map((t) => `${IMG_BASE}/${t.id}.png`))
  React.useEffect(() => {
    setSrcs(TIERS.map((t) => `${IMG_BASE}/${t.id}.png`))
    // IMG_BASE از env می‌آید و در runtime ثابت است
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const onImgError = React.useCallback(
    (i: number) => (e: React.SyntheticEvent<HTMLImageElement>) => {
      const cur = srcs[i]
      if (cur.toLowerCase().endsWith('.png') && !cur.endsWith('.PNG')) {
        setSrcs((arr) => arr.map((v, idx) => (idx === i ? cur.slice(0, -4) + '.PNG' : v)))
      } else {
        (e.currentTarget as HTMLImageElement).style.opacity = '0.35'
      }
    },
    [srcs]
  )

  // 4) claim
  const { writeContract, data: hash, isPending } = useWriteContract()
  const { isLoading: isMining } = useWaitForTransactionReceipt({ hash })
  const onClaim = (id: number) => {
    if (!contract) return
    writeContract({
      address: contract as `0x${string}`,
      abi: gmStreak1155Abi,
      functionName: 'claimBadge',
      args: [BigInt(id)],
    })
  }

  if (!contract) return null

  // progress mini-bar (از مرز قبلی تا بعدی)
  const bounds: number[] = [0, ...TIERS.map((t) => t.days)]
  let from: number = 0
  let to: number = TIERS[TIERS.length - 1].days
  for (let i = 0; i < bounds.length - 1; i++) {
    if (currentStreak < bounds[i + 1]) {
      from = bounds[i]
      to = bounds[i + 1]
      break
    }
  }
  const progress = Math.max(0, Math.min(1, (currentStreak - from) / (to - from || 1)))
  const progressPct = `${(progress * 100).toFixed(1)}%`

  return (
    <div className="frame" role="group" aria-label="BM Badges">
      {/* mini progress */}
      <div className="progress" aria-hidden>
        <span style={{ width: progressPct }} />
      </div>

      {TIERS.map((t, i) => {
        const has = (balances[i] ?? 0) > 0
        const eligible = currentStreak >= t.days && !has
        const colorful = eligible || has

        return (
          <button
            key={t.id}
            type="button"
            className={['slot', colorful ? 'on' : 'off', eligible ? 'eligible' : ''].join(' ')}
            title={`${t.days} days${eligible ? ' — claimable' : has ? ' — owned' : ''}`}
            onClick={() => eligible && !isPending && !isMining && onClaim(t.id)}
            disabled={!eligible || isPending || isMining}
          >
            <img
              src={srcs[i]}
              alt={`Badge ${t.id}`}
              className="img"
              onError={onImgError(i)}
            />
          </button>
        )
      })}

      <style jsx>{`
        .frame {
          position: relative;
          display: inline-flex;
          align-items: center;
          gap: 10px;
          height: ${PILL_H}px;
          padding: 0 12px;
          border-radius: ${PILL_R}px;
          border: 1px solid rgba(59,130,246,0.25);
          background: linear-gradient(180deg, rgba(59,130,246,0.06), rgba(59,130,246,0.03));
          box-shadow: 0 10px 24px rgba(59,130,246,0.10), inset 0 1px 0 rgba(255,255,255,0.45);
          overflow: hidden;
        }

        /* mini progress bar */
        .progress {
          position: absolute; left: 8px; right: 8px; bottom: 6px;
          height: 4px; background: rgba(59,130,246,0.10);
          border-radius: 999px; overflow: hidden;
        }
        .progress > span {
          display: block; height: 100%;
          background: linear-gradient(90deg, #60a5fa, #3b82f6);
          border-radius: 999px; box-shadow: 0 0 10px rgba(59,130,246,0.35);
          transition: width .35s ease;
        }

        .slot {
          all: unset;
          position: relative;
          width: 36px; height: 36px;
          display: inline-grid; place-items: center;
          cursor: default;
          border-radius: 8px;
          transition: transform .12s ease, filter .12s ease;
        }
        .slot.eligible { cursor: pointer; }
        .slot:hover .img { transform: scale(1.08); }

        .img {
          width: 28px; height: 28px; object-fit: contain;
          transition: transform .12s ease, filter .12s ease, opacity .12s ease;
          filter: drop-shadow(0 1px 2px rgba(0,0,0,0.12));
          pointer-events: none;
        }
        .slot.off .img {
          filter: grayscale(.75) saturate(.6) brightness(.98) drop-shadow(0 1px 2px rgba(0,0,0,0.08));
          opacity: .85;
        }
        .slot.on .img {
          filter: none drop-shadow(0 1px 2px rgba(0,0,0,0.18));
          opacity: 1;
        }
        .slot.eligible::after {
          content: "";
          position: absolute; inset: 2px;
          border-radius: 12px;
          box-shadow: 0 0 0 6px rgba(34,197,94,0.10);
          pointer-events: none;
        }

        @media (prefers-reduced-motion: reduce) {
          .slot:hover .img { transform: none; }
          .progress > span { transition: none; }
        }
      `}</style>
    </div>
  )
}
