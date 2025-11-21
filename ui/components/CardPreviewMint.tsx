// components/CardPreviewMint.tsx
'use client';

import React, { useEffect, useState } from 'react';
import { useAccount, useReadContract, useWriteContract } from 'wagmi';
import { keccak256, formatEther } from 'viem';
import { bmImage721Abi } from '../lib/abi/BMImage721';
import { gateAbi } from '../lib/abi/gate';

type Stat = { label: string; value: string };

type ImageTraits = {
  uniqueContracts: number;
  activeDays: number;
  gasPaidEth: number;
  monthlyRank: number;
  nftCount: number;
  balanceEth: number;
  txCount: number;
};

type Props = {
  // UI
  defaultPrompt: string;   // transparency only; server builds locked prompt
  title?: string;
  subtitle?: string;
  stats?: Stat[];
  badgeText?: string;      // فعلاً استفاده نمی‌کنیم (قبلاً ALL-TIME بود)
  placeholderSrc?: string;
  logoHref?: string;

  // Optional API inputs
  address?: string;        // falls back to connected wallet
  traitsJson?: ImageTraits | null;  // فقط برای /api/generate
  persona?: any;
};

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
});
const btnDisabled: React.CSSProperties = { opacity: 0.5, cursor: 'not-allowed' };

function safeAtob(b64: string): string {
  try {
    if (typeof window !== 'undefined' && typeof window.atob === 'function') {
      return window.atob(b64);
    }
    // Node/SSR fallback
    // @ts-ignore
    return Buffer.from(b64, 'base64').toString('binary');
  } catch {
    return '';
  }
}

function dataUrlBytes(dataUrl: string): Uint8Array {
  const b64 = dataUrl.split(',')[1] || '';
  const bin = safeAtob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr;
}

// Pretty ETH string (rounded)
function fmtEth(wei: unknown, decimals = 6): string {
  try {
    const s = formatEther(toBigIntSafe(wei));
    const n = Number(s);
    return n.toFixed(decimals).replace(/\.?0+$/, '');
  } catch { return '0'; }
}

function toBigIntSafe(x: unknown): bigint {
  try {
    if (typeof x === 'bigint') return x;
    if (typeof x === 'number') return BigInt(Math.trunc(x));
    if (typeof x === 'string' && x.trim() !== '') return BigInt(x);
    if (x && typeof x === 'object' && '_hex' in (x as any)) {
      const hex = (x as any)._hex as string;
      return BigInt(hex);
    }
  } catch {}
  return 0n;
}

function toNumberSafe(x: unknown, fallback = 0): number {
  if (x == null) return fallback;
  if (typeof x === 'number') return x;
  if (typeof x === 'bigint') return Number(x);
  const n = Number(x as any);
  return Number.isFinite(n) ? n : fallback;
}

// small math helpers
const sum = (arr: number[]) => arr.reduce((a, b) => a + b, 0);
const mean = (arr: number[]) => (arr.length ? sum(arr) / arr.length : 0);

// ---------- Build SVG overlay (server-side composition uses this) ----------
function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function escapeAddress(s: string): string {
  return escapeXml(s);
}

function buildOverlaySVG(
  title: string | undefined,
  addressStr: string | undefined,
  statsIn: Stat[] | undefined,
  logoHref: string = '/base_logo.svg', // فقط برای سازگاری امضاء
): string {
  const stats = Array.isArray(statsIn) ? statsIn : [];
  const max = Math.min(5, stats.length);       // حداکثر ۵ ردیف روی تصویر نهایی

  const safeStats = stats
    .slice(0, max)
    .map((s) => ({
      label: (s?.label ?? '').toString(),
      value: (s?.value ?? '').toString(),
    }));

  const padX = 120;
  const padBottom = 90;
  const rowHeight = 64;

  const rowsCount = safeStats.length || 1;
  const firstBase = 1024 - padBottom - (rowsCount - 1) * rowHeight;
  const yTopRect = firstBase - 46;
  const yBottomRect = 1024 - padBottom - 46 + 56;
  const lineX = padX - 40;
  const lineY1 = yTopRect - 24;
  const lineY2 = yBottomRect + 18;

  const rows = safeStats
    .map((row, i) => {
      const yBase = 1024 - padBottom - (rowsCount - 1 - i) * rowHeight;
      const rectY = yBase - 46;
      const labelY = yBase - 18;
      const valueY = yBase + 10;

      const rawLabel = (row.label || '').toString();
      const label = escapeXml(rawLabel.toUpperCase());
      const value = escapeXml(row.value || '');

      return `
      <g>
        <!-- پس‌زمینه نیمه‌شفاف هر ردیف -->
        <rect x="${padX - 8}" y="${rectY}" width="520" height="56" rx="18" ry="18"
              fill="#020617" fill-opacity="0.82" />
        <!-- نوار آبی کوچک کنار متن -->
        <rect x="${padX - 8}" y="${rectY}" width="6" height="56" rx="3" ry="3"
              fill="#38BDF8" />

        <!-- لیبل -->
        <text x="${padX + 20}" y="${labelY}"
              fill="#9CA3AF"
              font-size="17"
              font-family="system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif"
              letter-spacing="0.18em">
          ${label}
        </text>

        <!-- مقدار -->
        <text x="${padX + 20}" y="${valueY}"
              fill="#FACC15"
              font-size="26"
              font-weight="700"
              font-family="system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
          ${value}
        </text>
      </g>`;
    })
    .join('\n');

  const titleSafe = title ? escapeXml(title) : '';
  const addrSafe = addressStr ? escapeAddress(addressStr) : '';

  const titleBlock = titleSafe
    ? `
    <g>
      <text x="120" y="140"
            fill="#F9FAFB"
            font-size="40"
            font-weight="800"
            font-family="system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
        ${titleSafe}
      </text>
    </g>`
    : '';

  const addrBlock = addrSafe
    ? `
    <g opacity="0.95">
      <rect x="120" y="154" rx="999" ry="999" width="280" height="40"
            fill="#020617" fill-opacity="0.75" />
      <text x="142" y="181"
            fill="#E5E7EB"
            font-size="20"
            font-family="system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
        ${addrSafe}
      </text>
    </g>`
    : '';

  return `
<svg viewBox="0 0 1024 1024"
     preserveAspectRatio="none"
     width="1024"
     height="1024"
     xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="topFade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%"  stop-color="#000000" stop-opacity="0.58" />
      <stop offset="65%" stop-color="#000000" stop-opacity="0" />
    </linearGradient>
    <linearGradient id="bottomFade" x1="0" y1="1" x2="0" y2="0">
      <stop offset="0%"  stop-color="#000000" stop-opacity="0.52" />
      <stop offset="55%" stop-color="#000000" stop-opacity="0" />
    </linearGradient>
    <linearGradient id="leftRail" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%"  stop-color="#38BDF8" stop-opacity="0.0" />
      <stop offset="18%" stop-color="#38BDF8" stop-opacity="0.9" />
      <stop offset="82%" stop-color="#38BDF8" stop-opacity="0.9" />
      <stop offset="100%" stop-color="#38BDF8" stop-opacity="0.0" />
    </linearGradient>
  </defs>

  <!-- شیدر بالا و پایین برای خوانایی متن -->
  <rect x="0" y="0"    width="1024" height="260" fill="url(#topFade)" />
  <rect x="0" y="764"  width="1024" height="260" fill="url(#bottomFade)" />

  <!-- ریل عمودی سمت چپ (حس HUD / گیمی) -->
  <rect x="${lineX - 2}" y="${lineY1}" width="4" height="${lineY2 - lineY1}"
        fill="#020617" fill-opacity="0.9" />
  <rect x="${lineX}" y="${lineY1}" width="2" height="${lineY2 - lineY1}"
        fill="url(#leftRail)" />

  <!-- لوگوی مربع بالا راست کارت -->
  <rect x="872" y="104" width="40" height="40" rx="12" ry="12"
        fill="#0EA5E9" />
  <rect x="882" y="114" width="20" height="20" rx="5" ry="5"
        fill="#0F172A" fill-opacity="0.65" />

  <!-- عنوان و آدرس کوتاه -->
  ${titleBlock}
  ${addrBlock}

  <!-- ردیف‌های استت‌ها -->
  ${rows}
</svg>`;
}

// ---------- Live overlay (for on-page preview) ----------
function LiveOverlay({
  title,
  addressStr,
  stats = [],
  badgeText,          // فعلاً استفاده نمی‌کنیم
  logoHref = '/base_logo.svg',
}: {
  title?: string;
  addressStr?: string;
  stats?: Stat[];
  badgeText?: string;
  logoHref?: string;
}) {
  const safeStats = Array.isArray(stats) ? stats : [];
  const padX = 120;
  const padBottom = 90;
  const rowHeight = 64;
  const n = Math.min(5, safeStats.length);

  const rowsCount = n || 1;
  const firstBase = 1024 - padBottom - (rowsCount - 1) * rowHeight;
  const yTopRect = firstBase - 46;
  const yBottomRect = 1024 - padBottom - 46 + 56;
  const lineX = padX - 40;
  const lineY1 = yTopRect - 24;
  const lineY2 = yBottomRect + 18;

  const rows = Array.from({ length: n }).map((_, i) => {
    const yBase = 1024 - padBottom - (rowsCount - 1 - i) * rowHeight;
    const rectY = yBase - 46;
    const labelY = yBase - 18;
    const valueY = yBase + 10;
    const s = safeStats[i];

    const rawLabel = (s?.label || '').toString().toUpperCase();
    const rawValue = (s?.value || '').toString();

    return (
      <g key={i}>
        {/* پس‌زمینه هر ردیف */}
        <rect
          x={padX - 8}
          y={rectY}
          width={520}
          height={56}
          rx={18}
          ry={18}
          fill="#020617"
          fillOpacity={0.82}
        />
        <rect
          x={padX - 8}
          y={rectY}
          width={6}
          height={56}
          rx={3}
          ry={3}
          fill="#38BDF8"
        />
        {/* لیبل */}
        <text
          x={padX + 20}
          y={labelY}
          fill="#9CA3AF"
          style={{
            fontFamily:
              "system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
            fontSize: 17,
            letterSpacing: '0.18em',
          }}
        >
          {rawLabel}
        </text>
        {/* مقدار */}
        <text
          x={padX + 20}
          y={valueY}
          fill="#FACC15"
          style={{
            fontFamily:
              "system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
            fontSize: 26,
            fontWeight: 700,
          }}
        >
          {rawValue}
        </text>
      </g>
    );
  });

  return (
    <svg viewBox="0 0 1024 1024" preserveAspectRatio="none" width="100%" height="100%">
      <defs>
        <linearGradient id="topFade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#000000" stopOpacity={0.58} />
          <stop offset="65%" stopColor="#000000" stopOpacity={0} />
        </linearGradient>
        <linearGradient id="bottomFade" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="#000000" stopOpacity={0.52} />
          <stop offset="55%" stopColor="#000000" stopOpacity={0} />
        </linearGradient>
        <linearGradient id="leftRail" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#38BDF8" stopOpacity={0} />
          <stop offset="18%" stopColor="#38BDF8" stopOpacity={0.9} />
          <stop offset="82%" stopColor="#38BDF8" stopOpacity={0.9} />
          <stop offset="100%" stopColor="#38BDF8" stopOpacity={0} />
        </linearGradient>
      </defs>

      {/* top / bottom fades */}
      <rect width={1024} height={260} fill="url(#topFade)" />
      <rect y={764} width={1024} height={260} fill="url(#bottomFade)" />

      {/* ریل عمودی سمت چپ */}
      <rect
        x={lineX - 2}
        y={lineY1}
        width={4}
        height={lineY2 - lineY1}
        fill="#020617"
        fillOpacity={0.9}
      />
      <rect
        x={lineX}
        y={lineY1}
        width={2}
        height={lineY2 - lineY1}
        fill="url(#leftRail)"
      />

      {/* مربع آبی Base بالا راست */}
      <rect x={924} y={32} width={64} height={64} rx={16} ry={16} fill="#0052ff" />

      {title && (
        <text
          x={120}
          y={120}
          fill="#ffffff"
          style={{
            fontFamily:
              "system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
            fontSize: 40,
            fontWeight: 800,
          }}
        >
          {title}
        </text>
      )}

      {addressStr && (
        <g opacity={0.95}>
          <rect
            x={120}
            y={134}
            rx={999}
            ry={999}
            width={280}
            height={40}
            fill="#020617"
            fillOpacity={0.75}
          />
          <text
            x={142}
            y={161}
            fill="#E5E7EB"
            style={{
              fontFamily:
                "system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
              fontSize: 20,
            }}
          >
            {addressStr}
          </text>
        </g>
      )}

      {rows}
    </svg>
  );
}

export default function CardPreviewMint({
  defaultPrompt,
  title = '',
  subtitle,
  stats = [],
  badgeText,
  placeholderSrc = '/persona_placeholder.gif',
  logoHref = '/base_logo.svg',
  address: addressProp,
  traitsJson,
  persona,
}: Props) {
  const { address: connected } = useAccount();

  const CONTRACT = process.env.NEXT_PUBLIC_CONTRACT as `0x${string}`;
  const GATE = (process.env.NEXT_PUBLIC_GATE || '') as `0x${string}` | '';

  const effectiveAddress = addressProp || connected || '';

  // ----- overlay stats from /api/metrics -----
  const [metricsStats, setMetricsStats] = useState<Stat[] | null>(null);

  useEffect(() => {
    let alive = true;

    async function load() {
      if (!effectiveAddress) {
        if (alive) setMetricsStats(null);
        return;
      }
      try {
        const r = await fetch(`/api/metrics?address=${effectiveAddress}`, { cache: 'no-store' });
        if (!r.ok) throw new Error(`metrics ${r.status}`);
        const data: any = await r.json();

        if (!alive || !data) return;

        let overlay: Stat[] = [];

        // ---- حالت ۱: ساختار /api/metrics → { summary, monthly } ----
        const monthlyA: any[] =
          Array.isArray(data.monthly) ? data.monthly :
          Array.isArray(data.metrics?.monthly) ? data.metrics.monthly :
          [];

        if (monthlyA.length > 0) {
          const sBal  = monthlyA.map(m => Number(m.avg_balance_eth ?? m.balance_eth ?? 0));
          const sTxs  = monthlyA.map(m => Number(m.native_txs ?? m.txs ?? 0));
          const sUniq = monthlyA.map(m => Number(m.uniq_contracts ?? m.uniq ?? 0));
          const sDays = monthlyA.map(m => Number(m.uniq_days ?? m.days ?? 0));
          const sRank = monthlyA.map(m => Number(m.ranks?.overall?.rank ?? m.rank_m ?? 0));

          const activeMonths = monthlyA.filter(m =>
            Number(m.native_txs ?? m.txs ?? 0) > 0 ||
            Number(m.uniq_days ?? m.days ?? 0) > 0 ||
            Number(m.uniq_contracts ?? m.uniq ?? 0) > 0,
          ).length;

          const V = {
            balance: mean(sBal),
            txs: sum(sTxs),
            uniq: sum(sUniq),
            days: sum(sDays),
            months: activeMonths,
            rank: (sRank.filter(x => x > 0).length ? Math.min(...sRank.filter(x => x > 0)) : 0),
          };

          overlay = [
            {
              label: 'Rank',
              value: V.rank ? `#${V.rank.toLocaleString()}` : '—',
            },
            {
              label: 'Active Months',
              value: String(V.months),
            },
            {
              label: 'Active Days',
              value: String(Math.round(V.days)),
            },
            {
              label: 'Transactions',
              value: Math.round(V.txs).toLocaleString(),
            },
            {
              label: 'Unique Contracts',
              value: Math.round(V.uniq).toLocaleString(),
            },
            {
              label: 'Average Balance',
              value: `${V.balance.toFixed(3)} ETH`,
            },
          ];
        } else {
          // ---- حالت ۲: ساختار wallets_FULL → { wallet, rank, lifetime, months:{...} } ----
          const root: any = data.metrics || data;
          const lifetime = root.lifetime || {};
          const monthsObj = root.months || {};
          const monthsArr = Object.values(monthsObj) as any[];

          const rank =
            root.rank ??
            lifetime.rank ??
            root.rank_lt ??
            root.composite_rank_lt ??
            0;

          const txSum =
            lifetime.tx_sum ??
            monthsArr.reduce((acc, m) => acc + Number(m.txs || 0), 0);

          const uniqSum =
            lifetime.uniq_sum ??
            monthsArr.reduce((acc, m) => acc + Number(m.uniq || 0), 0);

          const daysSum =
            monthsArr.reduce((acc, m) => acc + Number(m.days || 0), 0);

          const activeMonths = monthsArr.filter(m =>
            Number(m.txs || 0) > 0 ||
            Number(m.days || 0) > 0 ||
            Number(m.uniq || 0) > 0,
          ).length;

          const balanceMean =
            lifetime.avg_balance_eth_mean ??
            (monthsArr.length
              ? monthsArr.reduce((acc, m) => acc + Number(m.bal || 0), 0) / monthsArr.length
              : 0);

          overlay = [
            {
              label: 'Rank',
              value: rank ? `#${Number(rank).toLocaleString()}` : '—',
            },
            {
              label: 'Active Months',
              value: String(activeMonths),
            },
            {
              label: 'Active Days',
              value: String(Math.round(daysSum)),
            },
            {
              label: 'Transactions',
              value: Math.round(txSum).toLocaleString(),
            },
            {
              label: 'Unique Contracts',
              value: Math.round(uniqSum).toLocaleString(),
            },
            {
              label: 'Average Balance',
              value: `${Number(balanceMean || 0).toFixed(3)} ETH`,
            },
          ];
        }

        if (process.env.NODE_ENV !== 'production') {
          console.log('[/api/metrics raw]', data);
          console.log('[CardPreviewMint overlay]', overlay);
        }

        if (alive) setMetricsStats(overlay);
      } catch (e) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn('metrics overlay error', e);
        }
        if (alive) setMetricsStats(null);
      }
    }

    load();
    return () => { alive = false; };
  }, [effectiveAddress]);

  // اول متریک‌های خودمون، بعد اگر نبود، props.stats
  const statsToUse: Stat[] =
    (metricsStats && metricsStats.length > 0) ? metricsStats :
    (stats && stats.length > 0 ? stats : []);

  // On-chain reads
  const { data: mintFeeWei } = useReadContract({
    address: CONTRACT,
    abi: bmImage721Abi as any,
    functionName: 'mintFeeWei',
    query: { enabled: Boolean(CONTRACT) },
  });
  const { data: nextNonce } = useReadContract({
    address: CONTRACT,
    abi: bmImage721Abi as any,
    functionName: 'nonces',
    args: [((connected as any) || '0x0000000000000000000000000000000000000000')],
    query: { enabled: Boolean(CONTRACT && connected) },
  });

  // Gate reads (optional)
  const { data: genFeeWei } = useReadContract({
    address: GATE || undefined,
    abi: gateAbi as any,
    functionName: 'genFeeWei',
    query: { enabled: Boolean(GATE) },
  });
  const { data: gateCap } = useReadContract({
    address: GATE || undefined,
    abi: gateAbi as any,
    functionName: 'dailyCap',
    query: { enabled: Boolean(GATE) },
  });
  const { data: gateRemain } = useReadContract({
    address: GATE || undefined,
    abi: gateAbi as any,
    functionName: 'remainingToday',
    args: [((connected as any) || '0x0000000000000000000000000000000000000000')],
    query: { enabled: Boolean(GATE && connected) },
  });

  const { writeContractAsync } = useWriteContract();

  const [baseImg, setBaseImg] = useState<string | null>(null);
  const [cardImg, setCardImg] = useState<string | null>(null);
  const [cardHash, setCardHash] = useState<string | null>(null);
  const [tokenUri, setTokenUri] = useState<string | null>(null);
  const [busy, setBusy] = useState<{ gen?: boolean; compose?: boolean; mint?: boolean; paying?: boolean }>({});
  const [error, setError] = useState<string | null>(null);
  const [payTx, setPayTx] = useState<string | null>(null);
  const [mintTx, setMintTx] = useState<string | null>(null);

  const [ethUsd, setEthUsd] = useState<number | null>(null);
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const j = await fetch('/api/eth-usd').then(r => r.json());
        if (alive && j?.ok && typeof j.usd === 'number') setEthUsd(j.usd);
      } catch {}
    };
    load();
    const id = setInterval(load, 60_000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  const preview = cardImg || baseImg || placeholderSrc;

  const mintFeeEth = fmtEth(mintFeeWei);
  const genFeeEth  = fmtEth(genFeeWei);
  const genFeeUsd  = (ethUsd != null && genFeeWei != null)
    ? Number(formatEther(toBigIntSafe(genFeeWei))) * ethUsd
    : null;

  const cap = toNumberSafe(gateCap, 2);
  const rem = toNumberSafe(gateRemain, cap);
  const used = Math.max(0, cap - rem);
  const pct  = Math.max(0, Math.min(100, Math.round((used / (cap || 1)) * 100)));
  const quotaStr = `${used}/${cap} today`;

  async function parseJsonOrText(r: Response) {
    const ct = r.headers.get('content-type') || '';
    const text = await r.text();
    if (ct.includes('application/json')) {
      try { return JSON.parse(text); } catch {}
    }
    throw new Error(`API ${r.status} ${ct}: ${text.slice(0, 180)}`);
  }

  function downloadFile(url: string, filename: string) {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  // --- Pay (optional) + Generate via /api/generate ---
  async function handleGenerate() {
    setError(null);

    if (!effectiveAddress || !/^0x[0-9a-fA-F]{40}$/.test(effectiveAddress)) {
      setError('Connect wallet or enter a valid address first.');
      return;
    }

    if (GATE && gateRemain !== undefined && toNumberSafe(gateRemain) === 0) {
      setError('Daily generate limit reached. Try again tomorrow.');
      return;
    }

    let payHash: string | null = null;
    if (GATE && genFeeWei != null) {
      setBusy(b => ({ ...b, paying: true }));
      try {
        const txHash = await writeContractAsync({
          address: GATE,
          abi: gateAbi as any,
          functionName: 'payGenerate',
          args: [],
          value: toBigIntSafe(genFeeWei),
        });
        payHash = String(txHash);
        setPayTx(payHash);
      } catch (e: any) {
        setBusy(b => ({ ...b, paying: false }));
        setError(String(e?.message || e));
        return;
      }
      setBusy(b => ({ ...b, paying: false }));
    }

    setBusy(b => ({ ...b, gen: true }));
    try {
      const r = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({
          address: effectiveAddress,
          traitsJson: traitsJson ?? null,
          persona: persona ?? null,
          payTxHash: payHash || undefined,
        }),
      });
      const j = await parseJsonOrText(r);
      if (!j?.ok || !j?.imageURL) throw new Error(j?.error || 'generate_failed');
      setBaseImg(j.imageURL);
      setCardImg(null);
      setCardHash(null);
      setTokenUri(null);
      setMintTx(null);
    } catch (e: any) {
      setError(String(e?.message || e));
    } finally {
      setBusy(b => ({ ...b, gen: false }));
    }
  }

  // --- Compose + Mint در یک کلیک ---
  async function handleComposeAndMint() {
    setError(null);

    if (!effectiveAddress) {
      setError('Connect wallet first.');
      return;
    }
    if (!baseImg) {
      setError('Generate persona first.');
      return;
    }

    // 1) Compose / store
    setBusy(b => ({ ...b, compose: true }));
    let composedImg: string | null = null;
    let composedHash: string | null = null;
    let composedTokenUri: string | null = null;

    try {
      const svg = buildOverlaySVG(
        title,
        subtitle || (effectiveAddress ? `${effectiveAddress.slice(0,6)}…${effectiveAddress.slice(-4)}` : ''),
        statsToUse,
        logoHref,
      );

      const r = await fetch('/api/compose-store', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          from: effectiveAddress,
          baseImage: baseImg,
          overlaySVG: svg,
          name: 'Base Persona Card',
          description: 'Deterministic persona generated from onchain activity.',
          attributes: (statsToUse || []).map(s => ({ trait_type: s.label, value: s.value })),
          external_url: window.location.origin + `/nft/${effectiveAddress}`,
        }),
      });
      const j = await parseJsonOrText(r);
      if (!j?.ok) throw new Error(j?.error || 'compose_failed');

      composedImg = j.image?.gateway || null;
      composedHash = j.imageHash || null;
      composedTokenUri = j.tokenUri || null;

      setCardImg(composedImg);
      setCardHash(composedHash);
      setTokenUri(composedTokenUri);
      setMintTx(null);
    } catch (e: any) {
      setBusy(b => ({ ...b, compose: false }));
      setError(String(e?.message || e));
      return;
    }
    setBusy(b => ({ ...b, compose: false }));

    // 2) Mint
    if (!composedImg || !composedTokenUri) {
      setError('Missing composed image or tokenURI');
      return;
    }

    setBusy(b => ({ ...b, mint: true }));
    try {
      const deadline = Math.floor(Date.now() / 1000) + 3600;
      const nonce = Number(nextNonce || 0);

      let imageHash = composedHash;
      if (!imageHash && composedImg.startsWith('data:')) {
        imageHash = keccak256(dataUrlBytes(composedImg));
      }
      if (!imageHash) throw new Error('missing image hash');

      const sc = await fetch('/api/sign-claim', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ to: effectiveAddress, tokenURI: composedTokenUri, imageHash, deadline, nonce }),
      }).then(parseJsonOrText);
      if (!sc?.sig) throw new Error(sc?.error || 'sign_claim_failed');

      const value = toBigIntSafe(mintFeeWei);
      const args = [
        { to: effectiveAddress, tokenURI: composedTokenUri, imageHash, deadline, nonce },
        sc.sig,
      ] as any;

      const txHash = await writeContractAsync({
        address: CONTRACT,
        abi: bmImage721Abi as any,
        functionName: 'claim',
        args,
        value,
      });
      setMintTx(String(txHash));
      if (typeof window !== 'undefined') window.alert('Mint tx sent: ' + txHash);
    } catch (e: any) {
      setError(String(e?.message || e));
    } finally {
      setBusy(b => ({ ...b, mint: false }));
    }
  }

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
  );

  const anyBusy = busy.paying || busy.gen || busy.compose || busy.mint;
  const busyText = busy.paying ? 'Paying…' : busy.gen ? 'Generating…' : busy.compose ? 'Composing…' : busy.mint ? 'Minting…' : '';

  return (
    <div className="grid gap-3">
      {/* Buttons */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(2, minmax(0, 1fr))', gap: 10, alignItems:'center' }}>
        <button
          onClick={handleGenerate}
          disabled={!!busy.gen || !!busy.paying || (!!GATE && gateRemain!==undefined && toNumberSafe(gateRemain)===0)}
          style={{ ...btn('linear-gradient(135deg,#7c3aed,#2563eb)'), ...((busy.gen||busy.paying||((!!GATE) && gateRemain!==undefined && toNumberSafe(gateRemain)===0))?btnDisabled:{}) }}
          title={GATE ? 'Pay & Generate' : 'Generate'}
        >
          {busy.paying ? 'Paying…' : 'Generate'}
        </button>
        <button
          onClick={handleComposeAndMint}
          disabled={!baseImg || !!busy.compose || !!busy.mint}
          style={{ ...btn('linear-gradient(135deg,#10b981,#059669)'), ...(!baseImg||busy.compose||busy.mint?btnDisabled:{}) }}
          title="Compose & Mint"
        >
          {busy.compose || busy.mint ? 'Processing…' : 'Mint'}
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
        {!cardImg && (
          <div style={{ position:'absolute', inset:0, pointerEvents:'none' }}>
            <LiveOverlay
              title={title}
              addressStr={subtitle || (effectiveAddress ? `${effectiveAddress.slice(0,6)}…${effectiveAddress.slice(-4)}` : '')}
              stats={statsToUse}
              badgeText={badgeText}
              logoHref={logoHref}
            />
          </div>
        )}

        {/* Busy overlay loader */}
        {anyBusy && (
          <div style={{
            position:'absolute', inset:0, background:'rgba(15,23,42,.45)',
            display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:14, color:'#fff'
          }}>
            <div style={{
              width:48, height:48, borderRadius:'50%',
              border:'4px solid rgba(255,255,255,.25)',
              borderTopColor:'#fff', animation:'spin 1s linear infinite'
            }} />
            <div style={{fontWeight:800}}>{busyText}</div>
            <style jsx>{`@keyframes spin {to {transform: rotate(360deg);}}`}</style>
            <div style={{width:'70%', height:6, borderRadius:6, background:'rgba(255,255,255,.25)', overflow:'hidden'}}>
              <div style={{width:'60%', height:'100%', borderRadius:6, background:'#fff', animation:'bar 1.5s ease-in-out infinite'}} />
            </div>
            <style jsx>{`@keyframes bar { 0%{transform:translateX(-60%)} 50%{transform:translateX(20%)} 100%{transform:translateX(120%)} }`}</style>
            <div style={{fontSize:12, opacity:.9}}>Don’t refresh. This can take a few seconds.</div>
          </div>
        )}
      </div>

      {/* After mint badge */}
      {mintTx && <div className="badge">Mint tx: {mintTx.slice(0,10)}…</div>}
    </div>
  );
}
