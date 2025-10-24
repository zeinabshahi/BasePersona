// lib/ai/llm.ts
// Narrative generation helpers for LLM providers.

export type Narrative = {
  title: string
  oneLiner: string
  summary: string
  highlights: string[]
  personalityTags: string[]
}

const FALLBACK: Narrative = {
  title: 'Your Onchain Persona',
  oneLiner: 'Clean lines, degen spirit. You play the long game.',
  summary: 'Anchored to Base wallet activity. Deterministic narrative.',
  highlights: ['Consistent activity', 'Risk-aware', 'Builder-friendly'],
  personalityTags: ['degen', 'neutral', 'builder'],
}

export type NarrativeResp = {
  narrative: Narrative
  meta: {
    provider: 'openai' | 'fallback'
    rateLimited?: boolean
    retryAfterSec?: number
    requestId?: string
    error?: string
    tries: number
  }
}

function toStr(v: any, def = ''): string {
  return typeof v === 'string' ? v : def
}
function toStrArr(v: any): string[] {
  if (!Array.isArray(v)) return []
  return v.map((x) => (typeof x === 'string' ? x : '')).filter(Boolean)
}
function validateNarrative(x: any): Narrative {
  return {
    title: toStr(x?.title, FALLBACK.title),
    oneLiner: toStr(x?.oneLiner, FALLBACK.oneLiner),
    summary: toStr(x?.summary, FALLBACK.summary),
    highlights: toStrArr(x?.highlights).length ? toStrArr(x?.highlights) : FALLBACK.highlights,
    personalityTags: toStrArr(x?.personalityTags).length ? toStrArr(x?.personalityTags) : FALLBACK.personalityTags,
  }
}
function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n))
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** Generate a concise narrative with soft-fallback + meta/debug info */
export async function generateNarrative(payload: {
  persona: any
  traits: any
  analytics?: any
  timeAnchor?: any
}): Promise<NarrativeResp> {
  const provider = process.env.LLM_PROVIDER || 'openai'
  if (provider !== 'openai' || !process.env.LLM_OPENAI_API_KEY) {
    return { narrative: FALLBACK, meta: { provider: 'fallback', error: 'provider_or_key_missing', tries: 0 } }
  }

  const key = process.env.LLM_OPENAI_API_KEY!
  const model = process.env.LLM_OPENAI_MODEL || 'gpt-4o-mini'
  const temperature = clamp(Number(process.env.LLM_TEMPERATURE ?? 0.6), 0, 1)

  const systemPrompt =
    `You are a precise, brand-safe copywriter. Output strict JSON with keys:\n` +
    `{ "title": string, "oneLiner": string, "summary": string, "highlights": string[], "personalityTags": string[] }.\n` +
    `- No financial advice, no identity claims, no sensitive judgments.\n` +
    `- Keep it concise.`

  const body = {
    model,
    temperature,
    response_format: { type: 'json_object' as const },
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: 'Generate a short persona narrative JSON for this input:' },
      { role: 'user', content: JSON.stringify(payload) },
    ],
  }

  const timeoutMs = Number(process.env.LLM_TIMEOUT_MS ?? 25000)

  // تا 2 بار retry روی 429/5xx
  const MAX_TRIES = 3
  for (let attempt = 1; attempt <= MAX_TRIES; attempt++) {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), timeoutMs)
    try {
      const r = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: ctrl.signal,
      })
      clearTimeout(t)

      const reqId = r.headers.get('x-request-id') || undefined
      const retryAfter = Number(r.headers.get('retry-after') || '') || undefined

      if (!r.ok) {
        const code = r.status
        console.error(`[generateNarrative] OpenAI HTTP ${code} (try ${attempt}/${MAX_TRIES})`)
        // فقط روی 429 و 5xx تلاش مجدد کن
        if ((code === 429 || (code >= 500 && code < 600)) && attempt < MAX_TRIES) {
          const wait = retryAfter ? retryAfter * 1000 : 400 * attempt + Math.floor(Math.random() * 200)
          await sleep(wait)
          continue
        }
        // سقوط نرم
        return {
          narrative: FALLBACK,
          meta: {
            provider: 'fallback',
            rateLimited: code === 429,
            retryAfterSec: retryAfter,
            requestId: reqId,
            error: `openai_${code}`,
            tries: attempt,
          },
        }
      }

      const j = await r.json()
      const txt = j?.choices?.[0]?.message?.content || '{}'
      let parsed: any
      try { parsed = JSON.parse(txt) } catch { parsed = null }
      if (!parsed) {
        return { narrative: FALLBACK, meta: { provider: 'fallback', error: 'json_parse_failed', tries: attempt } }
      }
      return { narrative: validateNarrative(parsed), meta: { provider: 'openai', tries: attempt } }
    } catch (err: any) {
      clearTimeout(t)
      console.error('[generateNarrative] error, falling back (try', attempt, '):', err?.message || err)
      if (attempt < MAX_TRIES) {
        await sleep(300 * attempt + Math.floor(Math.random() * 150))
        continue
      }
      return { narrative: FALLBACK, meta: { provider: 'fallback', error: 'network_or_timeout', tries: attempt } }
    }
  }

  // نباید به اینجا برسیم، ولی برای اطمینان:
  return { narrative: FALLBACK, meta: { provider: 'fallback', error: 'unexpected', tries: MAX_TRIES } }
}
