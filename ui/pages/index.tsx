import Head from 'next/head'
import dynamic from 'next/dynamic'
import React, { useEffect, useMemo, useState } from 'react'
import Header from '../components/Header'
import Footer from '../components/Footer'
import { PersonaText } from '../components/PersonaText'
import { useAccount } from 'wagmi'
import type { WalletStatRecord } from '../components/WalletStats'
import styles from '../components/frames.module.css'

declare global { interface Window { ethereum?: any } }

const DEFAULT_PROMPT =
  'waist-up 3D rendered portrait of a futuristic male character in ornate mythic sci-fi armor with gold reflections and glowing blue energy veins, realistic skin and metal materials, cinematic studio lighting, platinum halo above head emitting soft light, floating omni headdress with luminous parts, full AR visor showing holographic interface, surrounded by glowing golden aura and subtle particle fog, deep electric blue background, stylized 3D render, ultra detailed, symmetrical composition, 1:1 aspect ratio'

type MonthOpt = { ym: number; label: string }

/* ------- types for WalletMetrics dynamic import (must match component) ------- */
type WalletMetricsProps = {
  address?: string
  selectedYm: number | null
  onMonthsLoaded?: (list: MonthOpt[]) => void
  onSelectionChange?: (ym: number) => void
}

/* Safe dynamic import (ensures default component) */
const WalletMetricsComp = dynamic<WalletMetricsProps>(
  () => import('../components/WalletMetrics').then(m => (m as any).default ?? m as any),
  { ssr: false }
)

const CardPreviewMint = dynamic(
  () => import('../components/CardPreviewMint'),
  { ssr: false }
)

/* ---------------- helpers ---------------- */
function rnd(a: number, b: number) { return a + (b - a) * Math.random() }
function rint(a: number, b: number) { return Math.floor(rnd(a, b)) }

function buildRandomMetrics(addr: string): WalletStatRecord {
  return {
    address: addr,
    baseBuilderHolder: Math.random() < 0.3,
    baseIntroducedHolder: Math.random() < 0.4,
    balanceETH: +rnd(0, 6).toFixed(3),
    volumeETH: +rnd(0, 12).toFixed(3),
    nativeTxCount: rint(3, 240),
    tokenTxCount: rint(0, 160),
    totalContractInteractions: rint(1, 140),
    uniqueContractInteractions: rint(1, 30),
    walletAgeDays: rint(3, 1500),
    uniqueDays: rint(1, 365),
    uniqueWeeks: rint(1, 52),
    uniqueMonths: rint(1, 36),
    uniqueNftContractCount: rint(0, 20),
  }
}

/* Minimal adapter for Persona Preview (optional) */
type WalletDocCDN = {
  wallet: string
  rank: number
  lifetime: {
    months_active: number
    first: string
    last: string
    tx_sum: number
    uniq_sum: number
    trade_sum: number
    nft_sum: number
    gas_sum: number
    avg_balance_eth_mean: number
    streak_best_days: number
  }
  months: Record<string, {
    txs?: number
    uniq?: number
    trade?: number
    nft?: number
    gas?: number
    bal?: number
    days?: number
    spread?: number
    streak?: number
    rank_m?: number
    pct_m?: number
  }>
}

function adaptDocToStats(doc: WalletDocCDN): WalletStatRecord {
  const monthsArr = Object.keys(doc.months || {}).sort()
  const volumeETH = 0
  const uniqueDays = monthsArr.reduce((acc, ym) => acc + (doc.months[ym]?.days ?? 0), 0)
  const uniqueNftContractCount = monthsArr.reduce((acc, ym) => acc + (doc.months[ym]?.nft ?? 0), 0)
  const uniqueContracts = monthsArr.reduce((acc, ym) => acc + (doc.months[ym]?.uniq ?? 0), 0)
  const txSum = doc.lifetime?.tx_sum ?? 0

  return {
    address: doc.wallet,
    baseBuilderHolder: false,
    baseIntroducedHolder: false,
    balanceETH: +(doc.lifetime?.avg_balance_eth_mean ?? 0),
    volumeETH,
    nativeTxCount: txSum,
    tokenTxCount: 0,
    totalContractInteractions: uniqueContracts,
    uniqueContractInteractions: uniqueContracts,
    walletAgeDays: 0,
    uniqueDays,
    uniqueWeeks: 0,
    uniqueMonths: doc.lifetime?.months_active ?? monthsArr.length,
    uniqueNftContractCount,
  }
}

function buildRandomNarrative(stats?: WalletStatRecord) {
  const tone = (stats?.volumeETH ?? 0) > 5 ? 'active degen' : 'calm builder'
  return {
    narrativeJson: {
      title: 'Your Onchain Persona',
      oneLiner: 'Clean lines, degen spirit. You play the long game.',
      summary: `Anchored at now. Signals point to a consistent on-chain pattern with a ${tone} vibe.`,
      highlights: [`Age: ~${stats?.walletAgeDays ?? 0} days`],
      personalityTags: ['degen', 'neutral', 'builder'],
    },
  }
}

/* ---------------- page ---------------- */
export default function Page() {
  const { address: connectedAddress, isConnected } = useAccount()

  const [address, setAddress] = useState<string>('') // always string
  const [walletStats, setWalletStats] = useState<WalletStatRecord | null>(null)
  const [persona, setPersona] = useState<any>(null)
  const [narrative, setNarrative] = useState<any>(null)
  const [busy, setBusy] = useState<{ analyze?: boolean }>({})
  const [mounted, setMounted] = useState(false)

  const [monthOptions, setMonthOptions] = useState<MonthOpt[]>([])
  const [selectedYm, setSelectedYm] = useState<number | null>(null)

  useEffect(() => setMounted(true), [])
  useEffect(() => { if (isConnected && connectedAddress) setAddress(connectedAddress) }, [isConnected, connectedAddress])
  useEffect(() => { setSelectedYm(null) }, [address])

  async function analyze() {
    const addr = (isConnected && connectedAddress) ? connectedAddress : address
    if (!addr || addr.length < 4) return
    setAddress(addr)
    setBusy(b => ({ ...b, analyze: true }))
    try {
      try {
        const r = await fetch(`/api/wcdn/${addr}`)
        if (!r.ok) throw new Error(`wallet cdn ${r.status}`)
        const doc = (await r.json()) as WalletDocCDN
        setWalletStats(adaptDocToStats(doc))
      } catch {
        setWalletStats(buildRandomMetrics(addr))
      }

      try {
        const p = await fetch('/api/persona', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ metrics: {}, timeAnchor: null }),
        }).then(r => r.json())
        setPersona(p)
      } catch { setPersona(null) }

      try {
        const n = await fetch('/api/narrative', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ persona: persona?.personaJson || null }),
        }).then(r => r.json())
        setNarrative(n)
      } catch {
        setNarrative(buildRandomNarrative(walletStats ?? undefined))
      }
    } finally {
      setBusy(b => ({ ...b, analyze: false }))
    }
  }

  const statsToShow = useMemo(
    () => walletStats ?? {
      address: address || '—',
      baseBuilderHolder: false, baseIntroducedHolder: false,
      balanceETH: 0.111, volumeETH: 0.222,
      nativeTxCount: 3, tokenTxCount: 2,
      totalContractInteractions: 7, uniqueContractInteractions: 2,
      walletAgeDays: 12, uniqueDays: 4, uniqueWeeks: 1, uniqueMonths: 1, uniqueNftContractCount: 1,
    } as WalletStatRecord,
    [walletStats, address]
  )

  const anyStats = statsToShow as any
  const rankStr = typeof anyStats?.globalRank === 'number' ? `#${anyStats.globalRank}` : '—'
  const statsForCard = [
    { label: 'Rank',             value: rankStr },
    { label: 'Age',              value: `${statsToShow.walletAgeDays ?? 0} days` },
    { label: 'Active Days',      value: String(statsToShow.uniqueDays ?? 0) },
    { label: 'Interactions',     value: String(statsToShow.totalContractInteractions ?? 0) },
    { label: 'Unique Contracts', value: String(statsToShow.uniqueContractInteractions ?? 0) },
    { label: 'Volume',           value: `${(statsToShow.volumeETH ?? 0).toFixed(2)} ETH` },
  ]

  const subtitleAddr = address ? `${address.slice(0, 6)}…${address.slice(-4)}` : ''
  const twoCol: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'stretch' }
  const col: React.CSSProperties    = { display: 'flex', minHeight: 680 }
  const card: React.CSSProperties   = { flex: 1, display: 'flex', flexDirection: 'column' }

  return (
    <>
      <Head><title>Base Persona — Degen Flow</title></Head>
      <div className="appShell">
        <Header />
        <main className="main">
          <div className="container" style={{ maxWidth: 1200 }}>
            {/* Controls */}
            <div className="card" style={{ marginBottom: 16 }}>
              <div className="row align" style={{ gap: 8 }}>
                <input
                  className="input"
                  placeholder="0xYourAddress"
                  value={address}
                  onChange={e => setAddress(e.target.value)}
                  readOnly={!!(isConnected && connectedAddress)}
                  title={isConnected ? 'Using connected wallet' : 'Type an address or leave blank (demo)'}
                  style={isConnected ? { opacity: 0.85, cursor: 'not-allowed' } : undefined}
                />

                {/* Month dropdown (fed by WalletMetrics) */}
                <div className={styles.selectShell}>
                  <select
                    className={styles.selectMonth}
                    value={selectedYm == null ? 'ALL' : String(selectedYm)}
                    onChange={(e) => {
                      const v = e.target.value
                      setSelectedYm(v === 'ALL' ? null : parseInt(v, 10))
                    }}
                  >
                    <option value="ALL">All time</option>
                    {monthOptions.map(m => (
                      <option key={m.ym} value={m.ym}>{m.label}</option>
                    ))}
                  </select>
                </div>

                <button className="btn primary" onClick={analyze} disabled={busy.analyze}>
                  {busy.analyze ? 'Analyzing…' : 'Analyze'}
                </button>
              </div>
            </div>

            {/* Metrics */}
            {mounted && (
              <WalletMetricsComp
                address={address || ''}
                selectedYm={selectedYm}
                onMonthsLoaded={(list: MonthOpt[]) => setMonthOptions(list)}
                onSelectionChange={(ym: number) => setSelectedYm(ym)}
              />
            )}

            {/* Persona + Preview */}
            <div style={{ ...twoCol, marginTop: 16 }}>
              <div style={col}>
                <div className="card" style={card}>
                  <div style={{
                    padding: 18, display: 'flex', flexDirection: 'column', gap: 10, flex: 1,
                    background: 'linear-gradient(180deg, #f7fbff 0%, #eef7ff 45%, #eaf9ff 100%)',
                    borderRadius: 12, color: '#1f2937', fontSize: 17, lineHeight: 1.7,
                    boxShadow: 'inset 0 1px 0 rgba(255,255,255,.6)', overflowY: 'auto'
                  }}>
                    <PersonaText narrative={narrative ?? (persona ?? null)} isLoading={busy.analyze} />
                  </div>
                </div>
              </div>
              <div style={col}>
                <div className="card" style={card}>
                  <div style={{ padding: 16 }}>
                    <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Preview & Mint</div>
                    <CardPreviewMint
                      defaultPrompt={DEFAULT_PROMPT}
                      title=""
                      subtitle={subtitleAddr}
                      stats={statsForCard}
                      badgeText={selectedYm ? `YM ${selectedYm}` : 'ALL-TIME'}
                      logoHref="/base_logo.svg"
                    />
                  </div>
                </div>
              </div>
            </div>

            <Footer />
          </div>
        </main>
      </div>
    </>
  )
}
