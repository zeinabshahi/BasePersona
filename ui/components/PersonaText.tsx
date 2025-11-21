// components/PersonaText.tsx
'use client';

import React from 'react';

type PersonaCopy = {
  title?: string;
  oneLiner?: string;
  summary?: string;
  highlights?: string[];
};

export function PersonaText({
  narrative,
  isLoading,
}: {
  narrative?: any;
  isLoading?: boolean;
}) {
  const raw = (narrative?.narrativeJson || narrative || {}) as PersonaCopy;
  const rawHighlights = Array.isArray(raw.highlights) ? raw.highlights : [];
  const hasRealContent =
    !!raw.title || !!raw.oneLiner || !!raw.summary || rawHighlights.length > 0;

  // 🔹 متن دمو وقتی هنوز چیزی نداریم
  const demo: PersonaCopy = {
    title: 'Demo Base Persona',
    oneLiner: 'Connect a Base wallet to see its onchain story.',
    summary:
      'This is a demo view. Once you connect a wallet and hit Generate, this panel turns into a short story about how that address spends time on Base — what it tends to do, how often it shows up, and what kind of builder energy it carries.',
    highlights: [
      'Curious about new apps on Base',
      'Shows up in focused bursts, not constant noise',
    ],
  };

  const src: PersonaCopy = hasRealContent ? raw : demo;
  const highlights = Array.isArray(src.highlights) ? src.highlights : [];

  // 👇 متن کامل برای Copy (وقتی در حال لود نیست)
  const fullText = !isLoading
    ? (() => {
        const parts: string[] = [];
        if (src.title) parts.push(src.title);
        if (src.oneLiner) parts.push(src.oneLiner);
        if (src.summary) parts.push('', src.summary);
        if (highlights.length > 0) {
          parts.push('');
          for (const h of highlights) parts.push(`• ${h}`);
        }
        return parts.join('\n').trim();
      })()
    : '';

  const [copied, setCopied] = React.useState(false);

  async function handleCopy() {
    if (!fullText) return;
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(fullText);
      } else {
        const ta = document.createElement('textarea');
        ta.value = fullText;
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  }

  const canCopy = Boolean(fullText);

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        padding: '20px 24px 22px',
        borderRadius: 24,
        background:
          'linear-gradient(180deg, #e0f2ff 0%, #e5f2ff 45%, #e7f4ff 100%)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* شِیپ تزئینی پایین کارت */}
      <div
        style={{
          position: 'absolute',
          bottom: -60,
          left: -40,
          width: 260,
          height: 160,
          borderRadius: 999,
          background:
            'radial-gradient(circle at 10% 0%, rgba(148,163,184,0.14), rgba(148,163,184,0))',
          pointerEvents: 'none',
        }}
      />

      <div
        style={{
          position: 'relative',
          zIndex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          height: '100%',
        }}
      >
        {/* 🔵 بنر بالای کارت – سایز ثابت */}
        <div
          style={{
            width: '100%',
            height: 160, // ارتفاع ثابت
            borderRadius: 18,
            overflow: 'hidden',
            boxShadow: '0 18px 40px rgba(15,23,42,0.10)',
            background: 'rgba(15,23,42,0.04)',
          }}
        >
          <img
            src="/persona_header_base.png" // PNG خودت
            alt="Base persona banner"
            style={{
              width: '100%',
              height: '100%',
              display: 'block',
              objectFit: 'cover', // اگر بزرگ بود، همان فریم ثابت نمایش داده می‌شود
            }}
          />
        </div>

        {/* ردیف عنوان + برچسب + دکمه Copy */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <div>
            {src.title && (
              <div
                style={{
                  fontWeight: 800,
                  fontSize: 18,
                  marginBottom: 4,
                  color: 'rgba(15,23,42,0.96)',
                }}
              >
                {src.title}
              </div>
            )}
            {src.oneLiner && (
              <div
                style={{
                  fontWeight: 600,
                  fontSize: 13,
                  color: 'rgba(15,23,42,0.78)',
                }}
              >
                {src.oneLiner}
              </div>
            )}
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <div
              style={{
                padding: '6px 12px',
                borderRadius: 999,
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: 0.04,
                textTransform: 'uppercase',
                background:
                  'linear-gradient(135deg, rgba(59,130,246,0.08), rgba(56,189,248,0.10))',
                color: 'rgba(37,99,235,0.95)',
                border: '1px solid rgba(129,140,248,0.45)',
                boxShadow: '0 6px 14px rgba(37,99,235,0.18)',
                whiteSpace: 'nowrap',
              }}
            >
              WALLET STORY
            </div>

            {/* دکمه Copy متن */}
            <button
              type="button"
              onClick={handleCopy}
              disabled={!canCopy}
              style={{
                padding: '6px 10px',
                borderRadius: 999,
                border: '1px solid rgba(148,163,184,0.7)',
                background: 'rgba(15,23,42,0.02)',
                fontSize: 11,
                fontWeight: 600,
                color: 'rgba(15,23,42,0.78)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                cursor: canCopy ? 'pointer' : 'default',
                opacity: canCopy ? 1 : 0.4,
              }}
            >
              <span style={{ fontSize: 12 }}>
                {copied ? '✓' : '⧉'}
              </span>
              <span>{copied ? 'Copied' : 'Copy text'}</span>
            </button>
          </div>
        </div>

        {/* فریم خلاصه اصلی */}
        <div
          style={{
            borderRadius: 16,
            padding: '16px 18px',
            background:
              'linear-gradient(135deg, rgba(255,255,255,0.98), rgba(241,245,249,0.96))',
            border: '1px solid rgba(226,232,240,0.9)',
            boxShadow: '0 12px 32px rgba(15,23,42,0.06)',
          }}
        >
          {isLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div
                style={{
                  height: 10,
                  borderRadius: 999,
                  background: 'rgba(148,163,184,0.4)',
                  width: '60%',
                }}
              />
              <div
                style={{
                  height: 9,
                  borderRadius: 999,
                  background: 'rgba(148,163,184,0.35)',
                  width: '95%',
                }}
              />
              <div
                style={{
                  height: 9,
                  borderRadius: 999,
                  background: 'rgba(148,163,184,0.30)',
                  width: '90%',
                }}
              />
              <div
                style={{
                  marginTop: 6,
                  fontSize: 12,
                  color: 'rgba(15,23,42,0.65)',
                }}
              >
                Generating wallet story…
              </div>
            </div>
          ) : (
            src.summary && (
              <p
                style={{
                  margin: 0,
                  fontSize: 14,
                  lineHeight: 1.75,
                  color: 'rgba(15,23,42,0.9)',
                }}
              >
                {src.summary}
              </p>
            )
          )}
        </div>

        {/* بولت‌ها – فقط وقتی لودینگ نیست */}
        {!isLoading && highlights.length > 0 && (
          <ul
            style={{
              margin: 0,
              marginTop: 6,
              paddingLeft: 18,
              fontSize: 13,
              color: 'rgba(15,23,42,0.9)',
            }}
          >
            {highlights.map((h, i) => (
              <li key={i} style={{ marginBottom: 4 }}>
                {h}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default PersonaText;
