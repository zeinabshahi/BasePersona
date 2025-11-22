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
  defaultPrompt: string; // transparency only; server builds locked prompt
  title?: string;
  subtitle?: string;
  stats?: Stat[];
  badgeText?: string; // فعلاً استفاده نمی‌کنیم (قبلاً ALL-TIME بود)
  placeholderSrc?: string;
  logoHref?: string;

  // Optional API inputs
  address?: string; // falls back to connected wallet
  traitsJson?: ImageTraits | null; // فقط برای /api/generate
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
  } catch {
    return '0';
  }
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

// ---------- Build SVG overlay ----------
function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function escapeAddress(s: string): string {
  return escapeXml(s);
}

/**
 * Layout:
 * - فریم کیف بالا و فریم شیشه‌ای پایین، دقیقاً هم‌عرض و هم‌تراز
 * - فریم شیشه‌ای ۱۰٪ باریک‌تر از عرض پایه و هر دو از یک عرض استفاده می‌کنند
 * - بدون خط عمودی
 * - RANK رنگ متفاوت
 * - فریم کیف دوخطی (MY WALLET + آدرس)
 */
function buildOverlaySVG(
  title: string | undefined,
  addressStr: string | undefined,
  statsIn: Stat[] | undefined,
  logoHref: string = '/base_logo.svg', // فقط برای سازگاری امضاء
): string {
  const stats = Array.isArray(statsIn) ? statsIn : [];
  const maxRows = 6;
  const safeStats = stats
    .slice(0, maxRows)
    .map((s) => ({
      label: (s?.label ?? '').toString(),
      value: (s?.value ?? '').toString(),
    }));

  const padLeft = 44;
  const frameBaseWidth = 320; // عرض پایه
  const frameX = padLeft - 6;
  const statsWidth = Math.round(frameBaseWidth * 0.9); // ۱۰٪ باریک‌تر
  const sharedWidth = statsWidth; // عرض مشترک فریم بالا و پایین
  const sharedX = frameX + (frameBaseWidth - sharedWidth) / 2; // X مشترک

  const statsTop = 620;
  const rowGap = 60;
  const n = safeStats.length || 1;

  const panelY = statsTop - 90;
  const panelH = rowGap * n + 110;

  const titleSafe = title ? escapeXml(title) : '';
  const addrSafe = addressStr ? escapeAddress(addressStr) : '';

  const rows = safeStats
    .map((row, i) => {
      const yLabel = statsTop + rowGap * i;
      const yValue = yLabel + 26;

      const rawLabel = row.label || '';
      const label = escapeXml(rawLabel.toUpperCase());
      const value = escapeXml(row.value);
      const isRank = rawLabel.trim().toLowerCase() === 'rank';
      const valueColor = isRank ? '#FACC15' : '#22D3EE';

      return `
      <g>
        <text
          x="${padLeft + 22}"
          y="${yLabel}"
          fill="#93C5FD"
          font-size="15"
          font-weight="600"
          font-family="Space Grotesk,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif"
          letter-spacing="0.18em">
          ${label}
        </text>
        <text
          x="${padLeft + 22}"
          y="${yValue}"
          fill="${valueColor}"
          stroke="#020617"
          stroke-width="0.6"
          paint-order="stroke"
          font-size="32"
          font-weight="800"
          font-family="Space Grotesk,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
          ${value}
        </text>
      </g>`;
    })
    .join('\n');

  const titleBlock = titleSafe
    ? `
    <g>
      <text x="${padLeft}" y="60"
            fill="#F9FAFB"
            font-size="34"
            font-weight="800"
            font-family="Space Grotesk,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
        ${titleSafe}
      </text>
    </g>`
    : '';

  const addrBlock = addrSafe
    ? `
    <g opacity="0.96">
      <rect x="${sharedX}" y="72" rx="18" ry="18" width="${sharedWidth}" height="68"
            fill="#020617" fill-opacity="0.8"
            stroke="#38BDF8" stroke-width="1.2" stroke-opacity="0.55" />
      <text x="${padLeft + 22}" y="98"
            fill="#F9FAFB"
            font-size="15"
            font-weight="600"
            letter-spacing="0.18em"
            font-family="Space Grotesk,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
        MY WALLET
      </text>
      <text x="${padLeft + 22}" y="124"
            fill="#38BDF8"
            font-size="22"
            font-weight="700"
            font-family="Space Grotesk,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
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
    <linearGradient id="panelBg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#020617" stop-opacity="0.60" />
      <stop offset="100%" stop-color="#020617" stop-opacity="0.35" />
    </linearGradient>

    <!-- گرادیانت و سایه برای مکعب Base -->
    <linearGradient id="baseCubeGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#38BDF8" />
      <stop offset="40%" stop-color="#0EA5E9" />
      <stop offset="100%" stop-color="#0369A1" />
    </linearGradient>
    <linearGradient id="baseCubeHighlight" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#E0F2FE" />
      <stop offset="100%" stop-color="#0EA5E9" />
    </linearGradient>
    <filter id="softShadow" x="-50%" y="-50%" width="200%" height="200%">
      <feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="#0F172A" flood-opacity="0.45" />
    </filter>
  </defs>

  <!-- مربع آبی بالا راست (لوگوی بیس) -->
  <g filter="url(#softShadow)">
    <rect x="888" y="80" width="56" height="56" rx="18" ry="18" fill="url(#baseCubeGrad)" />
    <rect x="888" y="80" width="56" height="28" rx="18" ry="18"
          fill="url(#baseCubeHighlight)" fill-opacity="0.55" />
  </g>

  <!-- پنل شیشه‌ای برای استت‌ها (۱۰٪ باریک‌تر و هم‌عرض فریم کیف) -->
  <rect x="${sharedX}" y="${panelY}" width="${sharedWidth}" height="${panelH}"
        rx="24" ry="24"
        fill="url(#panelBg)"
        stroke="#38BDF8"
        stroke-width="1.5"
        stroke-opacity="0.35" />

  <!-- عنوان و آدرس -->
  ${titleBlock}
  ${addrBlock}

  <!-- ردیف‌های استت -->
  ${rows}
</svg>`;
}

// ---------- Live overlay (for on-page preview) ----------
function LiveOverlay({
  title,
  addressStr,
  stats = [],
  badgeText,
  logoHref = '/base_logo.svg',
}: {
  title?: string;
  addressStr?: string;
  stats?: Stat[];
  badgeText?: string;
  logoHref?: string;
}) {
  const safeStats = Array.isArray(stats) ? stats : [];
  const maxRows = 6;
  const rowsArr = safeStats.slice(0, maxRows);

  const padLeft = 44;
  const frameBaseWidth = 320;
  const frameX = padLeft - 6;
  const statsWidth = Math.round(frameBaseWidth * 0.9);
  const sharedWidth = statsWidth;
  const sharedX = frameX + (frameBaseWidth - sharedWidth) / 2;

  const statsTop = 620;
  const rowGap = 60;
  const n = rowsArr.length || 1;

  const panelY = statsTop - 90;
  const panelH = rowGap * n + 110;

  return (
    <svg viewBox="0 0 1024 1024" preserveAspectRatio="none" width="100%" height="100%">
      <defs>
        <linearGradient id="panelBgLive" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#020617" stopOpacity={0.6} />
          <stop offset="100%" stopColor="#020617" stopOpacity={0.35} />
        </linearGradient>

        {/* گرادیانت و سایه لوگوی Base */}
        <linearGradient id="baseCubeGradLive" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#38BDF8" />
          <stop offset="40%" stopColor="#0EA5E9" />
          <stop offset="100%" stopColor="#0369A1" />
        </linearGradient>
        <linearGradient id="baseCubeHighlightLive" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#E0F2FE" />
          <stop offset="100%" stopColor="#0EA5E9" />
        </linearGradient>
        <filter id="softShadowLive" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow
            dx={0}
            dy={4}
            stdDeviation={6}
            floodColor="#0F172A"
            floodOpacity={0.45}
          />
        </filter>
      </defs>

      {/* مربع آبی بالا راست */}
      <g filter="url(#softShadowLive)">
        <rect x={888} y={80} width={56} height={56} rx={18} ry={18} fill="url(#baseCubeGradLive)" />
        <rect
          x={888}
          y={80}
          width={56}
          height={28}
          rx={18}
          ry={18}
          fill="url(#baseCubeHighlightLive)"
          fillOpacity={0.55}
        />
      </g>

      {/* پنل شیشه‌ای پایین، ۱۰٪ باریک‌تر و هم‌عرض فریم کیف */}
      <rect
        x={sharedX}
        y={panelY}
        width={sharedWidth}
        height={panelH}
        rx={24}
        ry={24}
        fill="url(#panelBgLive)"
        stroke="#38BDF8"
        strokeWidth={1.5}
        strokeOpacity={0.35}
      />

      {/* عنوان */}
      {title && (
        <text
          x={padLeft}
          y={60}
          fill="#F9FAFB"
          style={{
            fontFamily:
              "Space Grotesk,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
            fontSize: 34,
            fontWeight: 800,
          }}
        >
          {title}
        </text>
      )}

      {/* فریم کیف دوخطی و هم‌عرض با پایین */}
      {addressStr && (
        <g opacity={0.96}>
          <rect
            x={sharedX}
            y={72}
            rx={18}
            ry={18}
            width={sharedWidth}
            height={68}
            fill="#020617"
            fillOpacity={0.8}
            stroke="#38BDF8"
            strokeWidth={1.2}
            strokeOpacity={0.55}
          />
          <text
            x={padLeft + 22}
            y={98}
            fill="#F9FAFB"
            style={{
              fontFamily:
                "Space Grotesk,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
              fontSize: 15,
              fontWeight: 600,
              letterSpacing: '0.18em',
            }}
          >
            MY WALLET
          </text>
          <text
            x={padLeft + 22}
            y={124}
            fill="#38BDF8"
            style={{
              fontFamily:
                "Space Grotesk,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
              fontSize: 22,
              fontWeight: 700,
            }}
          >
            {addressStr}
          </text>
        </g>
      )}

      {/* ردیف‌های استت با فاصله بیشتر و Rank رنگ متفاوت */}
      {rowsArr.map((s, i) => {
        const yLabel = statsTop + rowGap * i;
        const yValue = yLabel + 26;
        const rawLabel = (s?.label || '').toString();
        const label = rawLabel.toUpperCase();
        const value = (s?.value || '').toString();
        const isRank = rawLabel.trim().toLowerCase() === 'rank';
        const valueColor = isRank ? '#FACC15' : '#22D3EE';

        return (
          <g key={i}>
            <text
              x={padLeft + 22}
              y={yLabel}
              fill="#93C5FD"
              style={{
                fontFamily:
                  "Space Grotesk,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
                fontSize: 15,
                fontWeight: 600,
                letterSpacing: '0.18em',
              }}
            >
              {label}
            </text>
            <text
              x={padLeft + 22}
              y={yValue}
              fill={valueColor}
              stroke="#020617"
              strokeWidth={0.6}
              style={{
                fontFamily:
                  "Space Grotesk,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
                fontSize: 32,
                fontWeight: 800,
                paintOrder: 'stroke',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {value}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ---------- main component ----------
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
        const monthlyA: any[] = Array.isArray(data.monthly)
          ? data.monthly
          : Array.isArray(data.metrics?.monthly)
          ? data.metrics.monthly
          : [];

        if (monthlyA.length > 0) {
          const sBal = monthlyA.map((m) => Number(m.avg_balance_eth ?? m.balance_eth ?? 0));
          const sTxs = monthlyA.map((m) => Number(m.native_txs ?? m.txs ?? 0));
          const sUniq = monthlyA.map((m) => Number(m.uniq_contracts ?? m.uniq ?? 0));
          const sDays = monthlyA.map((m) => Number(m.uniq_days ?? m.days ?? 0));
          const sRank = monthlyA.map((m) => Number(m.ranks?.overall?.rank ?? m.rank_m ?? 0));

          const activeMonths = monthlyA.filter(
            (m) =>
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
            rank: sRank.filter((x) => x > 0).length ? Math.min(...sRank.filter((x) => x > 0)) : 0,
          };

          overlay = [
            {
              label: 'Rank',
              value: V.rank ? V.rank.toLocaleString() : '—', // بدون #
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

          const rank = root.rank ?? lifetime.rank ?? root.rank_lt ?? root.composite_rank_lt ?? 0;

          const txSum =
            lifetime.tx_sum ??
            monthsArr.reduce((acc, m) => acc + Number(m.txs || 0), 0);

          const uniqSum =
            lifetime.uniq_sum ??
            monthsArr.reduce((acc, m) => acc + Number(m.uniq || 0), 0);

          const daysSum = monthsArr.reduce((acc, m) => acc + Number(m.days || 0), 0);

          const activeMonths = monthsArr.filter(
            (m) =>
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
              value: rank ? Number(rank).toLocaleString() : '—',
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
    return () => {
      alive = false;
    };
  }, [effectiveAddress]);

  // اول متریک‌های خودمون، بعد اگر نبود، props.stats
  const statsToUse: Stat[] =
    metricsStats && metricsStats.length > 0
      ? metricsStats
      : stats && stats.length > 0
      ? stats
      : [];

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
    args: [(connected as any) || '0x0000000000000000000000000000000000000000'],
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
    args: [(connected as any) || '0x0000000000000000000000000000000000000000'],
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
        const j = await fetch('/api/eth-usd').then((r) => r.json());
        if (alive && j?.ok && typeof j.usd === 'number') setEthUsd(j.usd);
      } catch {}
    };
    load();
    const id = setInterval(load, 60_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  const preview = cardImg || baseImg || placeholderSrc;

  const mintFeeEth = fmtEth(mintFeeWei);
  const genFeeEth = fmtEth(genFeeWei);
  const genFeeUsd =
    ethUsd != null && genFeeWei != null
      ? Number(formatEther(toBigIntSafe(genFeeWei))) * ethUsd
      : null;

  const cap = toNumberSafe(gateCap, 2);
  const rem = toNumberSafe(gateRemain, cap);
  const used = Math.max(0, cap - rem);
  const pct = Math.max(0, Math.min(100, Math.round((used / (cap || 1)) * 100)));
  const quotaStr = `${used}/${cap} today`;

  async function parseJsonOrText(r: Response) {
    const ct = r.headers.get('content-type') || '';
    const text = await r.text();
    if (ct.includes('application/json')) {
      try {
        return JSON.parse(text);
      } catch {}
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
      setBusy((b) => ({ ...b, paying: true }));
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
        setBusy((b) => ({ ...b, paying: false }));
        setError(String(e?.message || e));
        return;
      }
      setBusy((b) => ({ ...b, paying: false }));
    }

    setBusy((b) => ({ ...b, gen: true }));
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
      setBusy((b) => ({ ...b, gen: false }));
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
    setBusy((b) => ({ ...b, compose: true }));
    let composedImg: string | null = null;
    let composedHash: string | null = null;
    let composedTokenUri: string | null = null;

    try {
      const svg = buildOverlaySVG(
        title,
        subtitle ||
          (effectiveAddress
            ? `${effectiveAddress.slice(0, 6)}…${effectiveAddress.slice(-4)}`
            : ''),
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
          attributes: (statsToUse || []).map((s) => ({
            trait_type: s.label,
            value: s.value,
          })),
          external_url:
            typeof window !== 'undefined'
              ? window.location.origin + `/nft/${effectiveAddress}`
              : '',
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
      setBusy((b) => ({ ...b, compose: false }));
      setError(String(e?.message || e));
      return;
    }
    setBusy((b) => ({ ...b, compose: false }));

    // 2) Mint
    if (!composedImg || !composedTokenUri) {
      setError('Missing composed image or tokenURI');
      return;
    }

    setBusy((b) => ({ ...b, mint: true }));
    try {
      const deadline = Math.floor(Date.now() / 1000) + 3600;
      const nonce = Number(nextNonce || 0);

      // از هشِ تازه استفاده کن، اگر نبود از state قبلی
      let imageHash: string | null = composedHash || cardHash;
      if (!imageHash && composedImg.startsWith('data:')) {
        imageHash = keccak256(dataUrlBytes(composedImg));
      }
      if (!imageHash) throw new Error('missing image hash');

      const sc = await fetch('/api/sign-claim', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          to: effectiveAddress,
          tokenURI: composedTokenUri,
          imageHash,
          deadline,
          nonce,
        }),
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
      setBusy((b) => ({ ...b, mint: false }));
    }
  }

  const Frame: React.FC<{
    title: string;
    value: React.ReactNode;
    canButton?: boolean;
    onClick?: () => void;
  }> = ({ title, value, canButton, onClick }) =>
    canButton ? (
      <button
        onClick={onClick}
        style={{
          padding: '10px 12px',
          borderRadius: 12,
          border: '1px solid rgba(0,0,0,.08)',
          background: 'linear-gradient(135deg,#64748b,#0ea5e9)',
          color: '#fff',
          fontWeight: 800,
          boxShadow: '0 2px 8px rgba(0,0,0,.08)',
        }}
      >
        Download
      </button>
    ) : (
      <div
        style={{
          padding: '10px 12px',
          border: '1px solid rgba(0,0,0,.08)',
          borderRadius: 12,
          background: '#fff',
          boxShadow: '0 2px 8px rgba(0,0,0,.04)',
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          minHeight: 56,
          justifyContent: 'center',
        }}
      >
        <div style={{ fontSize: 12, opacity: 0.7, fontWeight: 600 }}>{title}</div>
        <div style={{ fontSize: 14, fontWeight: 800 }}>{value}</div>
      </div>
    );

  const anyBusy = busy.paying || busy.gen || busy.compose || busy.mint;
  const busyText = busy.paying
    ? 'Paying…'
    : busy.gen
    ? 'Generating…'
    : busy.compose
    ? 'Composing…'
    : busy.mint
    ? 'Minting…'
    : '';

  return (
    <div className="grid gap-3">
      {/* Buttons */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
          gap: 10,
          alignItems: 'center',
        }}
      >
        <button
          onClick={handleGenerate}
          disabled={
            !!busy.gen ||
            !!busy.paying ||
            (!!GATE && gateRemain !== undefined && toNumberSafe(gateRemain) === 0)
          }
          style={{
            ...btn('linear-gradient(135deg,#7c3aed,#2563eb)'),
            ...((busy.gen ||
              busy.paying ||
              (!!GATE && gateRemain !== undefined && toNumberSafe(gateRemain) === 0))
              ? btnDisabled
              : {}),
          }}
          title={GATE ? 'Pay & Generate' : 'Generate'}
        >
          {busy.paying ? 'Paying…' : 'Generate'}
        </button>
        <button
          onClick={handleComposeAndMint}
          disabled={!baseImg || !!busy.compose || !!busy.mint}
          style={{
            ...btn('linear-gradient(135deg,#10b981,#059669)'),
            ...(!baseImg || busy.compose || busy.mint ? btnDisabled : {}),
          }}
          title="Compose & Mint"
        >
          {busy.compose || busy.mint ? 'Processing…' : 'Mint'}
        </button>
      </div>

      {/* Frames row: Generate | Mint | Quota | Download */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
          gap: 10,
          margin: '6px 0 4px',
        }}
      >
        <Frame
          title="Generate"
          value={
            <>
              {genFeeEth || '—'} ETH
              {genFeeUsd != null && <> (≈ ${genFeeUsd.toFixed(2)})</>}
            </>
          }
        />
        <Frame title="Mint" value={<>{mintFeeEth || '—'} ETH</>} />
        <Frame title="Quota" value={quotaStr} />
        {mintTx && cardImg ? (
          <Frame
            title="Download"
            value=""
            canButton
            onClick={() => downloadFile(cardImg!, 'persona_card.png')}
          />
        ) : (
          <Frame title="Download" value="—" />
        )}
      </div>

      {/* Daily usage progress */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            width: '100%',
            maxWidth: 520,
          }}
        >
          <div
            style={{
              flex: 1,
              height: 8,
              borderRadius: 8,
              background: 'rgba(0,0,0,.08)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${pct}%`,
                height: '100%',
                background: 'linear-gradient(90deg,#60a5fa,#a78bfa)',
                transition: 'width .3s',
              }}
            />
          </div>
          <div
            style={{
              fontSize: 12,
              opacity: 0.75,
              minWidth: 80,
              textAlign: 'right',
            }}
          >
            {quotaStr}
          </div>
        </div>
      </div>

      {error && <div style={{ color: 'crimson', whiteSpace: 'pre-wrap' }}>{error}</div>}

      {/* Preview */}
      <div
        style={{
          width: '100%',
          maxWidth: 520,
          aspectRatio: '1 / 1',
          borderRadius: 20,
          border: '1px solid rgba(0,0,0,0.08)',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        <img
          src={preview}
          alt="preview"
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
        {!cardImg && (
          <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
            <LiveOverlay
              title={title}
              addressStr={
                subtitle ||
                (effectiveAddress
                  ? `${effectiveAddress.slice(0, 6)}…${effectiveAddress.slice(-4)}`
                  : '')
              }
              stats={statsToUse}
              badgeText={badgeText}
              logoHref={logoHref}
            />
          </div>
        )}

        {/* Busy overlay loader */}
        {anyBusy && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(15,23,42,.45)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 14,
              color: '#fff',
            }}
          >
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: '50%',
                border: '4px solid rgba(255,255,255,.25)',
                borderTopColor: '#fff',
                animation: 'spin 1s linear infinite',
              }}
            />
            <div style={{ fontWeight: 800 }}>{busyText}</div>
            <style jsx>{`
              @keyframes spin {
                to {
                  transform: rotate(360deg);
                }
              }
            `}</style>
            <div
              style={{
                width: '70%',
                height: 6,
                borderRadius: 6,
                background: 'rgba(255,255,255,.25)',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: '60%',
                  height: '100%',
                  borderRadius: 6,
                  background: '#fff',
                  animation: 'bar 1.5s ease-in-out infinite',
                }}
              />
            </div>
            <style jsx>{`
              @keyframes bar {
                0% {
                  transform: translateX(-60%);
                }
                50% {
                  transform: translateX(20%);
                }
                100% {
                  transform: translateX(120%);
                }
              }
            `}</style>
            <div style={{ fontSize: 12, opacity: 0.9 }}>
              Don’t refresh. This can take a few seconds.
            </div>
          </div>
        )}
      </div>

      {/* After mint badge */}
      {mintTx && <div className="badge">Mint tx: {mintTx.slice(0, 10)}…</div>}
    </div>
  );
}
