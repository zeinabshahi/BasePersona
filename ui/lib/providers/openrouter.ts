// lib/providers/openrouter.ts
const BASE = 'https://openrouter.ai/api';

function headersJson() {
  const key =
    process.env.OPENROUTER_API_KEY ||
    process.env.IMG_OPENROUTER_API_KEY ||
    process.env.LLM_OPENROUTER_API_KEY;

  if (!key) throw new Error('missing_openrouter_key');

  const site = process.env.OPENROUTER_SITE_URL || 'http://localhost:3000';
  const app  = process.env.OPENROUTER_SITE_NAME || 'Rankora';

  return {
    'Authorization': `Bearer ${key}`,
    'Content-Type': 'application/json',
    'HTTP-Referer': site,
    'X-Title': app,
  };
}

type ImgResult = {
  ok: true;
  imageB64?: string | null;
  imageUrl?: string | null;
  provider: 'openrouter';
  promptUsed: string;
};

async function imagesEndpoint({
  model, prompt, size,
}:{ model:string; prompt:string; size:string; }) {
  const r = await fetch(`${BASE}/v1/images`, {
    method: 'POST',
    headers: headersJson(),
    body: JSON.stringify({
      model,
      prompt,
      size,
      response_format: 'b64_json',
    }),
  });
  const t = await r.text();
  if (!r.ok) {
    // به کالر می‌سپاریم تصمیم بگیرد
    return { ok:false as const, status:r.status, body:t };
  }
  try {
    const j = JSON.parse(t);
    const b64 = j?.data?.[0]?.b64_json;
    if (typeof b64 === 'string' && b64.length > 0) {
      return { ok:true as const, imageB64:b64 };
    }
    // بعضی مدل‌ها url می‌دهند
    const url = j?.data?.[0]?.url;
    if (typeof url === 'string' && url.startsWith('http')) {
      return { ok:true as const, imageUrl:url };
    }
    return { ok:false as const, status:200, body:'no_b64_or_url_from_images_endpoint' };
  } catch {
    return { ok:false as const, status:200, body:'images_endpoint_json_parse_error' };
  }
}

async function responsesEndpoint({
  model, prompt,
}:{ model:string; prompt:string; }) {
  const r = await fetch(`${BASE}/v1/responses`, {
    method: 'POST',
    headers: headersJson(),
    body: JSON.stringify({
      model,
      input: [
        {
          role: 'user',
          content: [{ type: 'input_text', text: prompt }],
        }
      ],
      // خروجی تصویر معمولاً در content می‌آید
      max_output_tokens: 0,
    }),
  });
  const t = await r.text();
  if (!r.ok) throw new Error(`openrouter_responses_${r.status}: ${t.slice(0,200)}`);

  let j: any;
  try { j = JSON.parse(t); } catch { throw new Error('openrouter_responses_json_error'); }

  const content = j?.output?.[0]?.content || j?.data?.[0]?.content || [];
  let imageUrl: string | null = null;
  let imageB64: string | null = null;

  for (const c of content) {
    if (typeof c?.image_url === 'string') { imageUrl = c.image_url; break; }
    if (typeof c?.b64_json  === 'string')  { imageB64 = c.b64_json; break; }
    if (c?.type === 'output_image') {
      if (typeof c?.image_url === 'string') { imageUrl = c.image_url; break; }
      if (typeof c?.b64_json  === 'string')  { imageB64 = c.b64_json; break; }
    }
  }

  if (!imageUrl && !imageB64) throw new Error('no_image_payload_from_openrouter');

  const out: ImgResult = { ok:true, provider:'openrouter', promptUsed: prompt,
    imageB64: imageB64 || null, imageUrl: imageUrl || null };
  return out;
}

/**
 * Universal image call:
 * - اگر مدل openai/gpt-image-1 باشد → اول /v1/images
 * - اگر invalid model id/404/400 → فال‌بک به responses با مدل fallback
 * - در غیر این صورت → مستقیم responses با همان مدل
 */
export async function orImage({
  model,
  prompt,
  size = '1024x1024',
}:{
  model: string;
  prompt: string;
  size?: string;
}): Promise<ImgResult> {
  const wantsGptImage = model === 'openai/gpt-image-1';

  if (wantsGptImage) {
    const r1 = await imagesEndpoint({ model, prompt, size });
    if (r1.ok) {
      return { ok:true, provider:'openrouter', promptUsed: prompt,
        imageB64: (r1 as any).imageB64 || null, imageUrl: (r1 as any).imageUrl || null };
    }
    // اگر پیام «not a valid model id» بود یا 400/404، روی مدل fallback برو
    const body = String((r1 as any).body || '');
    const invalid = /not a valid model id/i.test(body) || (r1 as any).status === 400 || (r1 as any).status === 404;
    const fb = process.env.IMG_OPENROUTER_FALLBACK_MODEL || 'recraft-ai/recraft-v3';
    if (invalid) {
      return await responsesEndpoint({ model: fb, prompt });
    }
    // سایر خطاها را شفاف پاس بدهیم
    throw new Error(`openrouter_images_${(r1 as any).status}: ${body.slice(0,200)}`);
  }

  // مدل‌های دیگر → مستقیم responses
  return await responsesEndpoint({ model, prompt });
}
