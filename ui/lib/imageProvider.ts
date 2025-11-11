// lib/imageProvider.ts
import fs from 'fs/promises';
import path from 'path';

export type ProviderResult = {
  ok: boolean;
  imageB64?: string;
  error?: string;
  provider?: string;
  promptUsed?: string;
};

function asDataURL(buf: Buffer, mime = 'image/png') {
  return `data:${mime};base64,` + buf.toString('base64');
}

async function readBaseImageB64(species: string) {
  const p = path.join(process.cwd(), 'public', 'assets', 'species', species, 'base.png');
  const buf = await fs.readFile(p);
  return { buf, dataUrl: asDataURL(buf) };
}

/**
 * Strategy:
 * 1) Try OpenAI "edits" with base-image as reference (keeps identity).
 * 2) Fallback to OpenAI "generate" with locked prompt only.
 * Notes:
 * - You need OPENAI_API_KEY.
 */
export async function generateWithOpenAI(opts: {
  species: string;
  prompt: string;
}): Promise<ProviderResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return { ok: false, error: 'OPENAI_API_KEY not set' };

  const { species, prompt } = opts;
  const { buf: baseBuf } = await readBaseImageB64(species);

  // --- Try edits (DALL·E style) ---
  try {
    const form = new FormData();
    form.append('model', 'gpt-image-1');
    form.append('prompt', prompt);
    // Pass base image as reference; without mask → full image can be reinterpreted with constraints.
    form.append('image[]', new Blob([baseBuf], { type: 'image/png' }), 'base.png');
    form.append('size', '1024x1024');

    const r = await fetch('https://api.openai.com/v1/images/edits', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form as any,
    });

    if (r.ok) {
      const j = await r.json();
      const b64 = j?.data?.[0]?.b64_json;
      if (b64) return { ok: true, imageB64: b64, provider: 'openai:edits', promptUsed: prompt };
    }
  } catch { /* fall through */ }

  // --- Fallback: pure generate ---
  try {
    const r = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-image-1',
        prompt,
        size: '1024x1024',
      }),
    });
    if (!r.ok) {
      const txt = await r.text();
      return { ok: false, error: `openai_generate_failed: ${r.status} ${txt}` };
    }
    const j = await r.json();
    const b64 = j?.data?.[0]?.b64_json;
    if (!b64) return { ok: false, error: 'no_image_in_response' };
    return { ok: true, imageB64: b64, provider: 'openai:generate', promptUsed: prompt };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'openai_error' };
  }
}

export async function loadBaseImageDataUrl(species: string) {
  const { dataUrl } = await readBaseImageB64(species);
  return dataUrl;
}
