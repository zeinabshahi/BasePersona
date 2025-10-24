// lib/ai/image.ts
// Image rendering helpers for multiple providers (OpenAI, SD-WebUI, Stability).

import { toKeccakHex } from '../utils'

export type ImageProvider = 'openai' | 'sdwebui' | 'stability'

type Size = '1024x1024' | '768x768' | '512x512'

export type RenderImageOpts = {
  prompt: string
  seedInput?: string
  size?: Size
  provider?: ImageProvider                  // ← per-request override (optional)
  negativePrompt?: string                   // ← per-request override (optional)
  highDetail?: boolean                      // ← for OpenAI (quality)
}

const DEFAULT_NEGATIVE =
  'low quality, blurry, watermark, text, logo, signature, extra limbs, extra fingers, mutated hands, deformed, cropped, jpeg artifacts, nsfw'

const FALLBACK_B64_PNG =
  // 1x1 transparent PNG
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII='

function sizeToWH(size: Size | undefined) {
  const s = size || '1024x1024'
  const [w, h] = s.split('x').map((n) => parseInt(n, 10))
  return { width: w || 1024, height: h || 1024, size: s as Size }
}

function deriveSeed(seedInput?: string) {
  // 32-bit positive seed (avoid 0 for some samplers)
  if (!seedInput) return Math.max(1, Math.floor(Math.random() * 0x7fffffff))
  const hex = toKeccakHex(seedInput) // 0x...
  const n = Number(BigInt(hex) % 2147483647n)
  return n === 0 ? 1 : n
}

function abortSignal(ms: number) {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), ms)
  return { signal: ctrl.signal, cancel: () => clearTimeout(t) }
}

export async function renderImage(opts: RenderImageOpts): Promise<{
  b64png: string
  providerUsed: ImageProvider
  promptUsed: string
  seed?: number
  size: Size
}> {
  const providerEnv = (process.env.IMG_PROVIDER || 'openai') as ImageProvider
  const provider = (opts.provider || providerEnv) as ImageProvider
  const negative = opts.negativePrompt || DEFAULT_NEGATIVE
  const { width, height, size } = sizeToWH(opts.size)

  // برای گزارش و دیباگ: پرامپت نهایی که برای مدل می‌فرستیم
  const promptUsed = opts.prompt

  // Timeout پیش‌فرض قابل‌تنظیم
  const timeoutMs = Number(process.env.IMG_TIMEOUT_MS ?? 30000)
  const { signal, cancel } = abortSignal(timeoutMs)

  try {
    if (provider === 'sdwebui') {
      const url = (process.env.SD_WEBUI_URL || '').replace(/\/+$/, '')
      if (!url) throw new Error('Missing SD_WEBUI_URL')
      const auth = process.env.SD_WEBUI_AUTH || ''
      const headers: Record<string, string> = { 'content-type': 'application/json' }
      if (auth) headers.Authorization = `Bearer ${auth}`

      const seed = deriveSeed(opts.seedInput)
      const body = {
        prompt: promptUsed,
        negative_prompt: negative,
        width,
        height,
        steps: 28,
        cfg_scale: 7,
        sampler_name: 'DPM++ 2M Karras',
        seed,
      }

      const r = await fetch(`${url}/sdapi/v1/txt2img`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal,
      })
      if (!r.ok) throw new Error(`sdwebui HTTP ${r.status}`)
      const j: any = await r.json()
      const b64 = j?.images?.[0]
      if (!b64) throw new Error('sdwebui returned no image')
      cancel()
      return { b64png: b64, providerUsed: 'sdwebui', promptUsed, seed, size }
    }

    if (provider === 'stability') {
      const key = process.env.STABILITY_API_KEY
      if (!key) throw new Error('Missing STABILITY_API_KEY')

      const stableModel =
        process.env.STABILITY_MODEL || 'stable-diffusion-xl-1024-v1-0'
      // Stability برای نِگِتیو پرامپت وزن منفی می‌گیرد
      const text_prompts = [
        { text: promptUsed, weight: 1 },
        { text: negative, weight: -1 },
      ]

      const r = await fetch(
        `https://api.stability.ai/v1/generation/${stableModel}/text-to-image`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${key}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({
            text_prompts,
            samples: 1,
            width,
            height,
            steps: 30,
            cfg_scale: 7,
          }),
          signal,
        }
      )
      if (!r.ok) throw new Error(`stability HTTP ${r.status}`)
      const j: any = await r.json()
      const b64 = j?.artifacts?.[0]?.base64
      if (!b64) throw new Error('stability returned no image')
      cancel()
      return { b64png: b64, providerUsed: 'stability', promptUsed, size }
    }

    // OpenAI (default)
    const key = process.env.IMG_OPENAI_API_KEY
    if (!key) throw new Error('Missing IMG_OPENAI_API_KEY')
    const model = process.env.IMG_OPENAI_MODEL || 'gpt-image-1'

    // برای OpenAI پارامتر negative رسمی نداریم؛
    // بهتره منفی‌ها را از قبل در template قفل کرده باشیم (prompt-lock).
    // اینجا فقط پرامپت قفل‌شده را می‌فرستیم.
    const body: any = {
      model,
      prompt: promptUsed,
      size,
    }
    if (opts.highDetail) body.quality = 'high'

    const r = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal,
    })
    if (!r.ok) throw new Error(`openai images HTTP ${r.status}`)
    const j: any = await r.json()
    const b64 = j?.data?.[0]?.b64_json
    if (!b64) throw new Error('openai returned no image')
    cancel()
    return { b64png: b64, providerUsed: 'openai', promptUsed, size }
  } catch (err: any) {
    // سقوط نرم + fallback شفاف تا فرانت 500 نبیند
    console.error('[renderImage] error -> fallback pixel:', err?.message || err)
    cancel()
    return { b64png: FALLBACK_B64_PNG, providerUsed: provider, promptUsed, size }
  }
}
