// pages/index.tsx
import Head from 'next/head';
import dynamic from 'next/dynamic';
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { PersonaText } from '../components/PersonaText';
import { useAccount } from 'wagmi';
import type { WalletStatRecord } from '../components/WalletStats';
import styles from '../components/frames.module.css';
import { SpeciesId } from '../lib/species';

declare global { interface Window { ethereum?: any } }

/** Minimal client-side error boundary */
class ClientBoundary extends React.Component<{children: React.ReactNode},{hasError:boolean}>{
  constructor(p:any){ super(p); this.state={hasError:false} }
  static getDerivedStateFromError(){ return {hasError:true} }
  componentDidCatch(){ /* noop */ }
  render(){ return this.state.hasError ? <div className="card" style={{padding:24}}>Something went wrong in a client widget.</div> : this.props.children }
}

/** Default image prompt as a safety fallback */
const DEFAULT_PROMPT =
  'waist-up portrait of a futuristic Base-themed character, stylized 3D render, cinematic studio lighting, electric blue and platinum palette, ultra detailed, symmetrical composition, 1:1 aspect ratio';

type MonthOpt = { ym: number; label: string }
type WalletMetricsProps = {
  address?: string
  selectedYm: number | null
  onMonthsLoaded?: (list: MonthOpt[]) => void
  onSelectionChange?: (ym: number) => void
}

/** traitsJson برای /api/generate */
type ImageTraits = {
  uniqueContracts: number;
  activeDays: number;
  gasPaidEth: number;
  monthlyRank: number;
  nftCount: number;
  balanceEth: number;
  txCount: number;
}

/** Dynamic chunks */
const WalletMetricsComp = dynamic(() =>
  import('../components/WalletMetrics').then(m => (m as any).default || m),
  { ssr: false, loading: () => <div className="card" style={{height:320}}/> }
) as React.ComponentType<WalletMetricsProps>;

const CardPreviewMint = dynamic(
  () => import('../components/CardPreviewMint').then(m => (m as any).default || m),
  { ssr: false, loading: () => <div className="card" style={{height:320}}/> }
) as React.ComponentType<any>;

/** Small helpers */
function rnd(a: number, b: number) { return a + (b - a) * Math.random() }
function rint(a: number, b: number) { return Math.floor(rnd(a, b)) }
function isAddr(s?: string) { return !!s && /^0x[0-9a-fA-F]{40}$/.test(s.trim()) }

/** Random metrics (only used if API metrics fail) */
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

/** species → short visual cue (no need for SPECIES map) */
function speciesCueFor(s?: SpeciesId) {
  switch (s) {
    case 'fox': return 'Base-blue cyber fox character';
    case 'dolphin': return 'Base-blue cyber dolphin character';
    case 'owl': return 'Base-blue cyber owl character';
    case 'panda': return 'Base-blue cyber panda character';
    default: return 'futuristic Base-native avatar';
  }
}

/** Locked image prompt built from traits locks (قدیمی؛ فقط برای UI به‌عنوان fallback) */
function buildLockedPrompt(traitsResp: any): string {
  const t = traitsResp?.traitsJson || traitsResp || {};
  const species: SpeciesId | undefined = t?.species;
  const speciesCue = speciesCueFor(species);

  const lock = t?.styleLock || {};
  const bg = lock?.bgLock === 'brand_orb_v1'
    ? 'Base-blue orbital gradient with soft particles'
    : 'deep electric blue gradient';

  const bits = [
    speciesCue,                // the only semantic variable
    'waist-up portrait',       // camera lock
    'stylized 3D render',      // style lock
    lock?.lighting || 'cinematic studio lighting',
    'ultra detailed',          // quality lock
    `background: ${bg}`,       // bg lock
    'symmetrical composition', // composition lock
    '1:1 aspect ratio',        // aspect lock
  ];
  return bits.join(', ');
}

/** Persona/narrative normalizer for PersonaText */
type PersonaCopy = {
  title: string; oneLiner: string; summary: string; highlights: string[]; personalityTags: string[];
};
function coerceCopy(x: any | null | undefined): PersonaCopy | null {
  if (!x) return null;
  const src = x.narrativeJson || x.personaJson || x;
  const title = src?.title || 'Onchain Persona';
  const oneLiner = src?.oneLiner || '';
  const summary = src?.summary || '';
  const highlights = Array.isArray(src?.highlights) ? src.highlights : [];
  const personalityTags = Array.isArray(src?.personalityTags) ? src.personalityTags : [];
  if (!title && !oneLiner && !summary && highlights.length===0) return null;
  return { title, oneLiner, summary, highlights, personalityTags };
}

/** Seeded demo narrative (so Persona panel is never empty) */
function seededRng(addr?: string) {
  let t = parseInt((addr?.slice(-8) || 'deadbeef'), 16) >>> 0;
  return () => {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}
function demoPersona(address?: string, species?: SpeciesId | undefined) {
  const rng = seededRng(address);
  const titles = ['Halo Runner','Quiet Voltage','Midfield Explorer','Base Native','Signal Walker'];
  const openers = [
    'On Base, summer doesn’t end—tempo just shifts.',
    'Some wallets shout; this one hums on purpose.',
    'Builders build. This one actually ships.',
    'Low noise, high signal—that’s the whole brand.',
  ];
  const stylesArr = [
    'curious without the chaos, focused without the fuss',
    'patient in the lull, decisive on the spike',
    'soft steps, sharp timing',
    'no drama, just direction',
  ];
  const animals: Record<SpeciesId,'fox'|'dolphin'|'owl'|'panda'> = {
    fox:'fox', dolphin:'dolphin', owl:'owl', panda:'panda'
  } as any;
  const animal = species ? animals[species] : ['fox','dolphin','owl','panda'][Math.floor(rng()*4)];

  const title = titles[Math.floor(rng()*titles.length)];
  const opener = openers[Math.floor(rng()*openers.length)];
  const style = stylesArr[Math.floor(rng()*stylesArr.length)];

  return {
    title,
    oneLiner: 'Explorer energy with builder instincts.',
    summary:
      `${opener} Reads like someone who finds the signal early and lets the noise pass. ` +
      `There’s a steady, human pattern here—${style}. When timelines get loud, this one edits; ` +
      `when chances whisper, it listens. Not a farm-everything-maxxer—more like a patient scout who ` +
      `likes clean merges and working code. If you had to assign a spirit guide, call it a ${animal}: ` +
      `quick when it matters, calm when it doesn’t, and impossible to bait into bad trades. ` +
      `Feels very Base: “ship > shout”, identity onchain, and a quiet belief that better apps beat louder threads. ` +
      `A wallet that keeps showing up — the kind that other builders recognize, even if it never asks for the spotlight.`,
    highlights: [
      'cadence: bursts, then breathers',
      'risk: measured curiosity',
      'social: ship > shout',
    ],
    personalityTags: [],
  };
}

export default function Page() {
  const { address: connectedAddress, isConnected } = useAccount();

  const [address, setAddress] = useState<string>('');
  const [walletStats, setWalletStats] = useState<WalletStatRecord | null>(null);
  const [persona, setPersona] = useState<any>(null);
  const [traits, setTraits] = useState<any>(null);
  const [narrative, setNarrative] = useState<any>(null);
  const [busy, setBusy] = useState<{ analyze?: boolean }>({});
  const [mounted, setMounted] = useState(false);

  const [monthOptions, setMonthOptions] = useState<MonthOpt[]>([]);
  const [selectedYm, setSelectedYm] = useState<number | null>(null);

  /** traitsJson که به /api/generate پاس می‌دیم */
  const [imageTraits, setImageTraits] = useState<ImageTraits | null>(null);

  useEffect(() => setMounted(true), []);
  useEffect(() => { if (isConnected && connectedAddress) setAddress(connectedAddress) }, [isConnected, connectedAddress]);
  useEffect(() => { setSelectedYm(null) }, [address]);

  const handleMonthsLoaded = useCallback((list: MonthOpt[]) => setMonthOptions(list), []);
  const handleSelectionChange = useCallback((ym: number) => setSelectedYm(ym), []);

  /** Analyze → lifetime metrics → persona → traits → narrative */
  async function analyze() {
    const addrRaw = (isConnected && connectedAddress) ? connectedAddress : (address?.trim() || '');
    const addr = isAddr(addrRaw) ? addrRaw : '0x000000000000000000000000000000000000dEaD';
    setAddress(isAddr(addrRaw) ? addrRaw : '');
    setBusy(b => ({ ...b, analyze: true }));

    try {
      // 1) lifetime metrics
      let stats: WalletStatRecord;
      let imageTraitsNext: ImageTraits;

      try {
        const r = await fetch(`/api/metrics?address=${addr}`, { cache: 'no-store' });
        if (!r.ok) throw new Error(`metrics ${r.status}`);
        const m = await r.json();

        const gRank = Number(
          m?.global_rank ?? m?.rank_global ?? m?.rank_lifetime ?? m?.rank ?? m?.rank_all ?? 0
        );

        stats = {
          address: addr,
          baseBuilderHolder: !!m?.base_builder_holder,
          baseIntroducedHolder: !!m?.base_introduced_holder,
          balanceETH: Number(m?.avg_balance_eth ?? 0),
          volumeETH: Number(m?.volume_eth ?? m?.volume_eth_total ?? 0),
          nativeTxCount: Number(m?.tx_count_native ?? m?.tx_count ?? 0),
          tokenTxCount: Number(m?.tx_count_token ?? 0),
          totalContractInteractions: Number(m?.uniq_contracts ?? 0),
          uniqueContractInteractions: Number(m?.uniq_contracts ?? 0),
          walletAgeDays: Number(m?.age_days ?? 0),
          uniqueDays: Number(m?.active_days ?? 0),
          uniqueWeeks: Number(m?.active_weeks ?? 0),
          uniqueMonths: Number(m?.active_months ?? 1),
          uniqueNftContractCount: Number(m?.nft_mints ?? m?.nft_contracts ?? 0),
          ...(gRank ? { globalRank: gRank } : {}),
        };

        // --- FIXED: monthlyRank بدون قاطی شدن ?? با || ---
        const rawMonthlyRank =
          m?.ranks?.overall?.rank ??
          m?.ranks?.activity?.rank ??
          (gRank && gRank > 0 ? gRank : undefined);

        const monthlyRank = Number(
          rawMonthlyRank ?? 500000
        );

        // traitsJson برای /api/generate (RawTraits)
        imageTraitsNext = {
          uniqueContracts: Number(m?.uniq_contracts ?? 0),
          activeDays: Number(m?.active_days ?? 0),
          gasPaidEth: Number(m?.gas_spent_eth ?? 0),
          monthlyRank,
          nftCount: Number(m?.nft_mints ?? m?.nft_contracts ?? 0),
          balanceEth: Number(m?.avg_balance_eth ?? 0),
          txCount:
            Number(m?.tx_count_native ?? m?.tx_count ?? 0) +
            Number(m?.tx_count_token ?? 0),
        };
      } catch {
        // fallback: رندوم
        stats = buildRandomMetrics(addr);
        const anyStats: any = stats;

        imageTraitsNext = {
          uniqueContracts: stats.uniqueContractInteractions ?? 0,
          activeDays: stats.uniqueDays ?? 0,
          gasPaidEth: 0,
          monthlyRank: typeof anyStats?.globalRank === 'number'
            ? Number(anyStats.globalRank)
            : 500000,
          nftCount: stats.uniqueNftContractCount ?? 0,
          balanceEth: stats.balanceETH ?? 0,
          txCount: (stats.nativeTxCount ?? 0) + (stats.tokenTxCount ?? 0),
        };
      }

      setWalletStats(stats);
      setImageTraits(imageTraitsNext);

      // 2) qualitative persona (no raw numbers in text)
      const metricsPersona = {
        total_txs: (stats.nativeTxCount ?? 0) + (stats.tokenTxCount ?? 0),
        unique_contracts: stats.uniqueContractInteractions ?? 0,
        active_days: stats.uniqueDays ?? 0,
        wallet_age_days: stats.walletAgeDays ?? 0,
        unique_months: stats.uniqueMonths ?? 1,
        volume_eth: stats.volumeETH ?? 0,
        nft_contracts: stats.uniqueNftContractCount ?? 0,
        dex_trades: 0,
        gas_eth: 0,
        global_rank: (stats as any).globalRank || undefined,
        cohort_size: 940000,
      };

      let personaResp: any = null;
      try {
        const r = await fetch('/api/persona', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          cache: 'no-store',
          body: JSON.stringify({ metrics: metricsPersona, address: addr }),
        });
        personaResp = await r.json();
      } catch { personaResp = null; }
      setPersona(personaResp);

      // 3) traits (species & hard style locks for image)
      const nowUnix = Math.floor(Date.now()/1000);
      const metricsTraits = {
        txCount: metricsPersona.total_txs,
        volumeETH: metricsPersona.volume_eth,
        uniqueContracts: metricsPersona.unique_contracts,
        activeDays: metricsPersona.active_days,
        dexTrades: metricsPersona.dex_trades,
        nftMints: metricsPersona.nft_contracts,
        firstSeenBlock: 0,
      };
      let traitsResp: any = null;
      try {
        const r = await fetch('/api/traits', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          cache: 'no-store',
          body: JSON.stringify({
            address: addr,
            persona: personaResp?.personaJson ?? personaResp ?? null,
            metrics: metricsTraits,
            timeAnchor: { nowUnix },
          }),
        });
        traitsResp = await r.json();
      } catch { traitsResp = null; }
      setTraits(traitsResp);

      // 4) narrative (long, human, Base-flavored; no visual words)
      let narrativeResp: any = null;
      try {
        const r = await fetch('/api/narrative', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          cache: 'no-store',
          body: JSON.stringify({ persona: personaResp?.personaJson ?? null, address: addr }),
        });
        narrativeResp = await r.json();
      } catch { narrativeResp = null; }
      setNarrative(narrativeResp);
    } finally {
      setBusy(b => ({ ...b, analyze: false }));
    }
  }

  // Stats for the right-hand card
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
  );

  // آدرس مؤثر برای کارت و زیرنویس (یا کانکت‌شده، یا تایپ‌شده)
  const effectivePersonaAddress = useMemo(
    () => (isConnected && connectedAddress) ? connectedAddress : address,
    [isConnected, connectedAddress, address]
  );

  // Persona text: narrative → persona → seeded demo (never empty)
  const personaCopy = useMemo(() => {
    const seeded = demoPersona(
      effectivePersonaAddress,
      (traits?.traitsJson?.species ?? traits?.species) as SpeciesId | undefined
    );
    return coerceCopy(narrative) || coerceCopy(persona) || seeded;
  }, [narrative, persona, traits, effectivePersonaAddress]);

  // Locked prompt for image generation (فقط برای UI؛ /api/generate خودش پرامپت قفل‌شده می‌سازد)
  const promptForImage = useMemo(() => {
    try {
      const p = buildLockedPrompt(traits);
      return p && p.length > 12 ? p : DEFAULT_PROMPT;
    } catch { return DEFAULT_PROMPT }
  }, [traits]);

  const anyStats = statsToShow as any;
  const rankStr = typeof anyStats?.globalRank === 'number' ? `#${anyStats.globalRank}` : '—';
  const statsForCard = [
    { label: 'Rank',             value: rankStr },
    { label: 'Age',              value: `${statsToShow.walletAgeDays ?? 0} days` },
    { label: 'Active Days',      value: String(statsToShow.uniqueDays ?? 0) },
    { label: 'Interactions',     value: String(statsToShow.totalContractInteractions ?? 0) },
    { label: 'Unique Contracts', value: String(statsToShow.uniqueContractInteractions ?? 0) },
    { label: 'Volume',           value: `${(statsToShow.volumeETH ?? 0).toFixed(2)} ETH` },
  ];

  const subtitleAddr = effectivePersonaAddress
    ? `${effectivePersonaAddress.slice(0, 6)}…${effectivePersonaAddress.slice(-4)}`
    : '';

  const twoCol: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'stretch' };
  const col: React.CSSProperties    = { display: 'flex', minHeight: 680 };
  const card: React.CSSProperties   = { flex: 1, display: 'flex', flexDirection: 'column' };

  return (
    <>
      <Head><title>Rankora — Base Persona</title></Head>
      <div className="appShell">
        <Header />
        <main className="main">
          <div className="container" style={{ maxWidth: 1200 }}>
            {/* Controls */}
            <div className="card" style={{ marginBottom: 16 }}>
              <div className="row align" style={{ gap: 8 }}>
                <input
                  className="input"
                  placeholder="0xYourAddress (leave empty for demo)"
                  value={address}
                  onChange={e => setAddress(e.target.value)}
                  readOnly={!!(isConnected && connectedAddress)}
                  title={isConnected ? 'Using connected wallet' : 'Type an address or leave blank (demo)'}
                  style={{
                    ...(isConnected ? { opacity: 0.85, cursor: 'not-allowed' } : {}),
                    fontWeight: 800,
                    fontSize: 16,
                    letterSpacing: '0.3px',
                  }}
                />
                {/* Month dropdown (for charts only; persona is lifetime) */}
                <div className={styles.selectShell}>
                  <select
                    className={styles.selectMonth}
                    value={selectedYm == null ? 'ALL' : String(selectedYm)}
                    onChange={(e) => {
                      const v = e.target.value;
                      setSelectedYm(v === 'ALL' ? null : parseInt(v, 10));
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
              <ClientBoundary>
                <WalletMetricsComp
                  address={effectivePersonaAddress || ''}
                  selectedYm={selectedYm}
                  onMonthsLoaded={handleMonthsLoaded}
                  onSelectionChange={handleSelectionChange}
                />
              </ClientBoundary>
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
                    <PersonaText narrative={personaCopy || undefined} isLoading={busy.analyze} />
                  </div>
                </div>
              </div>
              <div style={col}>
                <div className="card" style={card}>
                  <div style={{ padding: 16 }}>
                    <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Preview & Mint</div>
                    <CardPreviewMint
                      defaultPrompt={promptForImage}
                      title=""
                      subtitle={subtitleAddr}
                      stats={statsForCard}
                      badgeText={selectedYm ? `YM ${selectedYm}` : 'ALL-TIME'}
                      logoHref="/base_logo.svg"
                      address={effectivePersonaAddress || ''}
                      traitsJson={imageTraits || undefined}
                      persona={persona}
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
  );
}
