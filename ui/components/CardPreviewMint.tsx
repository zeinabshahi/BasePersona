'use client'

import React, { useEffect, useState } from 'react'
import { useAccount, useReadContract, useWriteContract } from 'wagmi'
import { keccak256, formatEther } from 'viem'
import { bmImage721Abi } from '../lib/abi/BMImage721'
import { gateAbi } from '../lib/abi/gate'

type Stat = { label: string; value: string }
type GenerateArgs = { prompt: string }

// ---------- Small utils ----------
const btn = (grad: string): React.CSSProperties => ({
  padding: '10px 14px',
  borderRadius: 12,
  color: '#fff',
  background: grad,
  border: 'none',
  boxShadow: '0 6px 18px rgba(0,0,0,.12)',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  fontWeight: 700,
  cursor: 'pointer',
  minWidth: 150,
})
const btnDisabled: React.CSSProperties = { opacity: 0.5, cursor: 'not-allowed' }

function safeAtob(b64: string): string {
  if (typeof window !== 'undefined' && typeof window.atob === 'function') return window.atob(b64)
  // Node/SSR fallback
  return ''
}

function dataUrlBytes(dataUrl: string): Uint8Array {
  const b64 = dataUrl.split(',')[1] || ''
  const bin = safeAtob(b64)
  const arr = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i)
  return arr
}

// نمایش ETH با گرد کردن تا ۶ رقم اعشار
function fmtEth(wei: unknown, decimals = 6): string {
  try {
    const s = formatEther(toBigIntSafe(wei))
    const n = Number(s)
    return n.toFixed(decimals).replace(/\.?0+$/, '')
  } catch { return '0' }
}

function toBigIntSafe(x: unknown): bigint {
  try {
    if (typeof x === 'bigint') return x
    if (typeof x === 'number') return BigInt(Math.trunc(x))
    if (typeof x === 'string' && x.trim() !== '') return BigInt(x)
    if (x && typeof x === 'object' && '_hex' in (x as any)) {
      const hex = (x as any)._hex as string
      return BigInt(hex)
    }
  } catch {}
  return 0n
}

function toNumberSafe(x: unknown, fallback = 0): number {
  if (x == null) return fallback
  if (typeof x === 'number') return x
  if (typeof x === 'bigint') return Number(x)
  const n = Number(x as any)
  return Number.isFinite(n) ? n : fallback
}

// ---------- Build SVG overlay string (to be composed on server)
function buildOverlaySVG(
  title: string | undefined,
  addressStr: string | undefined,
  stats: Stat[],
  badgeText: string | undefined,
  logoHref: string = '/base_logo.svg'
): string {
  const pad = 48
  const line = 44
  const max = Math.min(6, stats.length)

  const rows = Array.from({ length: max })
    .map((_, i) => {
      const y = 1024 - pad - 20 - (max - 1 - i) * line
      const s = stats[i]
      return `
        <text x="${pad}" y="${y}" style="font:500 28px Inter,Segoe UI,Arial; fill: rgba(255,255,255,.95)">
          ${escapeXml(s.label)}:
          <tspan style="font-weight:700">${escapeXml(s.value)}</tspan>
        </text>`
    })
    .join('\n')

  const badge = badgeText
    ? `
    <rect x="806" y="32" rx="14" ry="14" width="170" height="44"
      fill="rgba(255,215,0,0.12)" stroke="rgba(255,215,0,0.55)"/>
    <text x="891" y="62" text-anchor="middle" style="font:700 22px Inter; fill: rgba(255,215,0,0.95)">
      ${escapeXml(badgeText)}
    </text>`
    : ''

  const titleEl = title
    ? `<text x="${pad}" y="${pad + 10}" style="font:800 40px Inter,Segoe UI,Arial; fill:#fff">${escapeXml(title)}</text>`
    : ''

  const addrEl = addressStr
    ? `<text x="${pad}" y="${pad + (title ? 52 : 50)}" style="font:600 26px Inter,Segoe UI,Arial; fill:rgba(255,255,255,.9)">${escapeAddress(addressStr)}</text>`
    : ''

  return `
<svg viewBox="0 0 1024 1024" preserveAspectRatio="none" width="1024" height="1024" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="topFade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="rgba(0,0,0,.55)" />
      <stop offset="60%" stop-color="rgba(0,0,0,0)" />
    </linearGradient>
    <linearGradient id="bottomFade" x1="0" y1="1" x2="0" y2="0">
      <stop offset="0%" stop-color="rgba(0,0,0,.50)" />
      <stop offset="55%" stop-color="rgba(0,0,0,0)" />
    </linearGradient>
  </defs>

  <rect width="1024" height="430" fill="url(#topFade)" />
  <rect y="594" width="1024" height="430" fill="url(#bottomFade)" />

  <image href="${logoHref}" x="904" y="32" width="88" height="88" />

  ${badge}
  ${titleEl}
  ${addrEl}
  ${rows}
</svg>`.trim()
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
function escapeAddress(s: string): string {
  // keep ellipsis visually; escape only XML special chars
  return escapeXml(s)
}

export default function CardPreviewMint({
  defaultPrompt,
  title = '',
  subtitle,
  stats = [],
  badgeText = 'ALL-TIME',
  placeholderSrc = '/persona_placeholder.png',
  logoHref = '/base_logo.svg',
}: {
  defaultPrompt: string
  title?: string
  subtitle?: string
  stats?: Stat[]
  badgeText?: string
  placeholderSrc?: string
  logoHref?: string
}) {
  const { address } = useAccount()

  const CONTRACT = process.env.NEXT_PUBLIC_CONTRACT as `0x${string}`
  const GATE = (process.env.NEXT_PUBLIC_GATE || '') as `0x${string}` | ''

  // خواندن امن (مشروط) از زنجیره
  const { data: mintFeeWei } = useReadContract({
    address: CONTRACT,
    abi: bmImage721Abi as any,
    functionName: 'mintFeeWei',
    query: { enabled: Boolean(CONTRACT) },
  })
  const { data: nextNonce } = useReadContract({
    address: CONTRACT,
    abi: bmImage721Abi as any,
    functionName: 'nonces',
    args: [(address as any) || '0x0000000000000000000000000000000000000000'],
    query: { enabled: Boolean(CONTRACT && address) },
  })

  // Gate: gen fee + quota
  const { data: genFeeWei } = useReadContract({
    address: GATE || undefined,
    abi: gateAbi as any,
    functionName: 'genFeeWei',
    query: { enabled: Boolean(GATE) },
  })
  const { data: gateCap } = useReadContract({
    address: GATE || undefined,
    abi: gateAbi as any,
    functionName: 'dailyCap',
    query: { enabled: Boolean(GATE) },
  })
  const { data: gateRemain } = useReadContract({
    address: GATE || undefined,
    abi: gateAbi as any,
    functionName: 'remainingToday',
    args: [(address as any) || '0x0000000000000000000000000000000000000000'],
    query: { enabled: Boolean(GATE && address) },
  })

  const { writeContractAsync } = useWriteContract()

  const [baseImg, setBaseImg] = useState<string | null>(null)
  const [cardImg, setCardImg] = useState<string | null>(null)   // gateway URL (https://...) after compose-store
  const [cardHash, setCardHash] = useState<string | null>(null) // 0x... sha256 from server
  const [tokenUri, setTokenUri] = useState<string | null>(null) // ipfs://... metadata
  const [busy, setBusy] = useState<{ gen?: boolean; compose?: boolean; mint?: boolean; paying?: boolean }>({})
  const [error, setError] = useState<string | null>(null)
  const [payTx, setPayTx] = useState<string | null>(null)
  const [mintTx, setMintTx] = useState<string | null>(null)

  // USD اختیاری
  const [ethUsd, setEthUsd] = useState<number | null>(null)
  useEffect(() => {
    let alive = true
    const load = async () => {
      try {
        const j = await fetch('/api/eth-usd').then(r => r.json())
        if (alive && j?.ok && typeof j.usd === 'number') setEthUsd(j.usd)
      } catch {}
    }
    load()
    const id = setInterval(load, 60_000)
    return () => { alive = false; clearInterval(id) }
  }, [])

  const preview = cardImg || baseImg || placeholderSrc
  const showLiveOverlay = !cardImg

  const mintFeeEth = fmtEth(mintFeeWei)
  const genFeeEth  = fmtEth(genFeeWei)
  const genFeeUsd  = (ethUsd != null && genFeeWei != null)
    ? Number(formatEther(toBigIntSafe(genFeeWei))) * ethUsd
    : null

  // Quota (حتی بدون Gate → پیش‌فرض)
  const cap = toNumberSafe(gateCap, 2)
  const rem = toNumberSafe(gateRemain, cap)
  const used = Math.max(0, cap - rem)
  const pct  = Math.max(0, Math.min(100, Math.round((used / (cap || 1)) * 100)))
  const quotaStr = `${used}/${cap} today`

  async function parseJsonOrText(r: Response) {
    const ct = r.headers.get('content-type') || ''
    const text = await r.text()
    if (ct.includes('application/json')) {
      try { return JSON.parse(text) } catch {}
    }
    throw new Error(`API ${r.status} ${ct}: ${text.slice(0, 180)}`)
  }

  function downloadFile(url: string, filename: string) {
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
  }

  // --- Pay + Generate ---
  async function generateBase(args: GenerateArgs) {
    setError(null)

    // سهمیه روزانه
    if (GATE && gateRemain !== undefined && toNumberSafe(gateRemain) === 0) {
      setError('Daily generate limit reached. Try again tomorrow.')
      return
    }

    // پرداخت
    let payHash: string | null = null
    if (GATE && genFeeWei != null) {
      setBusy(b => ({ ...b, paying: true }))
      try {
        const txHash = await writeContractAsync({
          address: GATE,
          abi: gateAbi as any,
          functionName: 'payGenerate',
          args: [],
          value: toBigIntSafe(genFeeWei),
        })
        payHash = String(txHash)
        setPayTx(payHash)
      } catch (e: any) {
        setBusy(b => ({ ...b, paying: false }))
        setError(String(e?.message || e))
        return
      }
      setBusy(b => ({ ...b, paying: false }))
    }

    // ساخت تصویر
    setBusy(b => ({ ...b, gen: true }))
    try {
      const r = await fetch('/api/v1/image', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          prompt: args.prompt,
          size: '1024x1024',
          highDetail: false,
          payTxHash: payHash,
        }),
      })
      const j = await parseJsonOrText(r)
      if (!j?.ok) throw new Error(j?.error || 'image_failed')
      setBaseImg(j.imageURL); setCardImg(null); setCardHash(null); setTokenUri(null); setMintTx(null)
    } catch (e: any) {
      setError(String(e?.message || e))
    } finally {
      setBusy(b => ({ ...b, gen: false }))
    }
  }

  // --- Compose → Store(IPFS) ---
  async function composeCard() {
    if (!baseImg || !address) { setError('Generate first (and connect wallet).'); return }
    setBusy(b => ({ ...b, compose: true })); setError(null)
    try {
      const svg = buildOverlaySVG(
        title,
        subtitle || (address ? `${address.slice(0,6)}…${address.slice(-4)}` : ''),
        stats,
        badgeText,
        logoHref
      )

      const r = await fetch('/api/compose-store', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          from: address,
          baseImage: baseImg,   // data:/http(s)/ipfs://
          overlaySVG: svg,      // SVG string
          name: 'MegaPersona Card',
          description: 'Deterministic persona generated from on-chain activity.',
          attributes: stats.map(s => ({ trait_type: s.label, value: s.value })),
          external_url: window.location.origin + `/nft/${address}`,
        }),
      })
      const j = await parseJsonOrText(r)
      if (!j?.ok) throw new Error(j?.error || 'compose_failed')

      // server returns { image: { gateway }, tokenUri, imageHash }
      setCardImg(j.image?.gateway || null)
      setCardHash(j.imageHash || null)
      setTokenUri(j.tokenUri || null)
      setMintTx(null)
    } catch (e: any) {
      setError(String(e?.message || e))
    } finally {
      setBusy(b => ({ ...b, compose: false }))
    }
  }

  // --- Sign → Claim ---
  async function uploadSignMint() {
    if (!cardImg || !tokenUri) { setError('Compose card first'); return }
    if (!address) { setError('Connect wallet first'); return }

    setBusy(b => ({ ...b, mint: true })); setError(null)
    try {
      // 1) deadline + nonce
      const deadline = Math.floor(Date.now()/1000) + 3600
      const nonce = Number(nextNonce || 0)

      // imageHash از compose-store آمده؛ اگر نبود، fallback keccak از dataURL
      let imageHash = cardHash
      if (!imageHash && cardImg.startsWith('data:')) {
        imageHash = keccak256(dataUrlBytes(cardImg))
      }
      if (!imageHash) throw new Error('missing image hash')

      // 2) امضا
      const sc = await fetch('/api/sign-claim', {
        method:'POST', headers:{'content-type':'application/json'},
        body: JSON.stringify({ to: address, tokenURI: tokenUri, imageHash, deadline, nonce })
      }).then(parseJsonOrText)
      if (!sc?.sig) throw new Error(sc?.error || 'sign_claim_failed')

      // 3) value (اگر payable باشد)
      const value = toBigIntSafe(mintFeeWei)

      // 4) claim
      const args = [ { to: address, tokenURI: tokenUri, imageHash, deadline, nonce }, sc.sig ] as any
      const txHash = await writeContractAsync({
        address: CONTRACT, abi: bmImage721Abi as any, functionName: 'claim', args, value
      })
      setMintTx(String(txHash))
      if (typeof window !== 'undefined') window.alert('Mint tx sent: ' + txHash)
    } catch(e:any) {
      setError(String(e?.message || e))
    } finally {
      setBusy(b=>({ ...b, mint:false }))
    }
  }

  // ---------- Small helpers for UI ----------
  const Frame: React.FC<{ title: string; value: React.ReactNode; canButton?: boolean; onClick?: ()=>void }> = ({ title, value, canButton, onClick }) => (
    canButton ? (
      <button onClick={onClick}
        style={{
          padding:'10px 12px', borderRadius:12, border:'1px solid rgba(0,0,0,.08)',
          background:'linear-gradient(135deg,#64748b,#0ea5e9)', color:'#fff',
          fontWeight:800, boxShadow:'0 2px 8px rgba(0,0,0,.08)'
        }}>
        Download
      </button>
    ) : (
      <div style={{
        padding:'10px 12px', border:'1px solid rgba(0,0,0,.08)', borderRadius:12,
        background:'#fff', boxShadow:'0 2px 8px rgba(0,0,0,.04)', display:'flex',
        flexDirection:'column', gap:6, minHeight:56, justifyContent:'center'
      }}>
        <div style={{fontSize:12, opacity:.7, fontWeight:600}}>{title}</div>
        <div style={{fontSize:14, fontWeight:800}}>{value}</div>
      </div>
    )
  )

  // ---------- Render ----------
  return (
    <div className="grid gap-3">
      {/* Buttons */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3, minmax(0, 1fr))', gap: 10, alignItems:'center' }}>
        <button
          onClick={()=>generateBase({ prompt: defaultPrompt })}
          disabled={!!busy.gen || !!busy.paying || (!!GATE && gateRemain!==undefined && toNumberSafe(gateRemain)===0)}
          style={{ ...btn('linear-gradient(135deg,#7c3aed,#2563eb)'), ...((busy.gen||busy.paying||((!!GATE) && gateRemain!==undefined && toNumberSafe(gateRemain)===0))?btnDisabled:{}) }}
          title={GATE ? 'Pay & Generate' : 'Generate'}
        >
          {busy.paying ? 'Paying…' : 'Generate'}
        </button>
        <button
          onClick={composeCard}
          disabled={!baseImg || !!busy.compose}
          style={{ ...btn('linear-gradient(135deg,#0ea5e9,#6366f1)'), ...(!baseImg||busy.compose?btnDisabled:{}) }}
          title="Compose"
        >
          Compose
        </button>
        <button
          onClick={uploadSignMint}
          disabled={!cardImg || !!busy.mint}
          style={{ ...btn('linear-gradient(135deg,#10b981,#059669)'), ...(!cardImg||busy.mint?btnDisabled:{}) }}
          title="Mint"
        >
          Mint
        </button>
      </div>

      {/* Frames row: Generate | Mint | Quota | Download */}
      <div style={{display:'grid', gridTemplateColumns:'repeat(4, minmax(0,1fr))', gap:10, margin:'6px 0 4px'}}>
        <Frame title="Generate" value={<>{genFeeEth || '—'} ETH{genFeeUsd!=null && <> (≈ ${genFeeUsd.toFixed(2)})</>}</>} />
        <Frame title="Mint" value={<>{mintFeeEth || '—'} ETH</>} />
        <Frame title="Quota" value={quotaStr} />
        {mintTx && cardImg
          ? <Frame title="Download" value="" canButton onClick={()=>downloadFile(cardImg!, 'persona_card.png')} />
          : <Frame title="Download" value="—" />}
      </div>

      {/* Daily usage progress */}
      <div style={{display:'flex', alignItems:'center', gap:10}}>
        <div style={{display:'flex', alignItems:'center', gap:10, width:'100%', maxWidth:520}}>
          <div style={{flex:1, height:8, borderRadius:8, background:'rgba(0,0,0,.08)', overflow:'hidden'}}>
            <div style={{width: `${pct}%`, height:'100%', background:'linear-gradient(90deg,#60a5fa,#a78bfa)', transition:'width .3s'}}/>
          </div>
          <div style={{fontSize:12, opacity:.75, minWidth:80, textAlign:'right'}}>{quotaStr}</div>
        </div>
      </div>

      {error && <div style={{color:'crimson', whiteSpace:'pre-wrap'}}>{error}</div>}

      {/* Preview */}
      <div style={{ width:'100%', maxWidth:520, aspectRatio:'1 / 1', borderRadius:20, border:'1px solid rgba(0,0,0,0.08)', overflow:'hidden', position:'relative' }}>
        <img src={preview} alt="preview" style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }} />
        {showLiveOverlay && (
          <div style={{ position:'absolute', inset:0, pointerEvents:'none' }}>
            <LiveOverlay
              title={title}
              addressStr={subtitle || (address ? `${address.slice(0,6)}…${address.slice(-4)}` : '')}
              stats={stats}
              badgeText={badgeText}
              logoHref={logoHref}
            />
          </div>
        )}
      </div>

      {/* After mint badge */}
      {mintTx && <div className="badge">Mint tx: {mintTx.slice(0,10)}…</div>}
    </div>
  )
}
