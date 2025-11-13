// lib/imageProvider.ts
/* OpenRouter image generator with locked minimal/cartoony prompt */
type GenArgs = {
  address?: string;
  species?: string;        // مثلا "owl", "fox", "whale", ...
  traits?: Record<string, any>; // تریت‌های discretized (UC/AD/Gas/Rank/.../Tx)
  size?: string;           // مثلا "1024x1024"
};

type GenResult = { ok: true; imageURL: string; promptUsed: string } | { ok: false; error: string; raw?: any };

function shaSeed(input: string): number {
  const h = Array.from(new TextEncoder().encode(input)).reduce((a, b) => (a * 33 + b) >>> 0, 5381);
  return (h % 1_000_000_000) || 1;
}

function lockedPrompt({ address, species, traits }: GenArgs) {
  // ⛔️ سبک قفل‌شده: مینیمال/کارتونی/2D/پس‌زمینه پاستیلیِ تخت، ضخامت خط ثابت، بدون متن/واترمارک
  const speciesLine = `Species: ${species || 'owl'} — use a fixed base body silhouette & proportions every time (locked pose and frame).`;
  const style =
`Minimal 2D cartoon, clean vector-like edges, flat shading, soft pastel solid background (no gradients), Base-blue accents,
consistent line thickness, no photorealism, no 3D render, no text, no watermark, single centered character, square 1:1 canvas.`;

  const t = traits ? Object.entries(traits).map(([k,v]) => `${k}: ${v}`).join(', ') : '';
  const addr = address ? `Wallet: ${address}.` : '';
  const accessories =
`Render accessories ONLY from traits (no extra). Keep base body identity intact; small expressive facial/eye variants allowed.`;

  return [
    style,
    speciesLine,
    accessories,
    t && `Traits: ${t}`,
    addr,
  ].filter(Boolean).join('\n');
}

async function callOpenRouterImages({ prompt, size }: { prompt: string; size: string }): Promise<GenResult> {
  const base = process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1';
  const key  = process.env.OPENROUTER_API_KEY;
  const model = process.env.IMG_OPENROUTER_MODEL || 'black-forest-labs/flux-1.1-pro';
  const site = process.env.OPENROUTER_SITE_URL || 'http://localhost:3000';
  const app  = process.env.OPENROUTER_SITE_NAME || 'Rankora Persona';

  if (!key) return { ok: false, error: 'missing OPENROUTER_API_KEY' };

  const r = await fetch(`${base}/images`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'HTTP-Referer': site,
      'X-Title': app,
    },
    body: JSON.stringify({
      model,
      prompt,
      size,
      // بعضی مدل‌ها seed را پشتیبانی می‌کنند؛ اگر نادیده گرفت هم اشکالی ندارد.
    }),
  });

  const ct = r.headers.get('content-type') || '';
  const text = await r.text();

  // اگر HTML برگشت یعنی مدل/آدرس اشتباه است (صفحه سایت به‌جای API)
  if (!ct.includes('application/json')) {
    return { ok: false, error: 'openrouter_200_but_html', raw: text.slice(0, 240) };
  }

  let j: any;
  try { j = JSON.parse(text); } catch { return { ok: false, error: 'images_endpoint_json_parse_error', raw: text.slice(0, 240) }; }

  const item = j?.data?.[0] || j?.choices?.[0] || j?.output?.[0] || j?.result?.[0];
  const b64  = item?.b64_json || item?.image || item?.content?.[0]?.image?.base64;
  const url  = item?.url;

  if (!b64 && !url) return { ok: false, error: 'no_image_payload_from_openrouter', raw: j };

  const imageURL = b64 ? `data:image/png;base64,${b64}` : String(url);
  return { ok: true, imageURL, promptUsed: prompt };
}

export async function generateImage(args: GenArgs): Promise<GenResult> {
  const size = args.size || process.env.IMG_SIZE || '1024x1024';
  const prompt = lockedPrompt({
    address: args.address,
    species: args.species,
    traits: args.traits,
  });

  // (اختیاری) اگر مدل از seed پشتیبانی کند:
  // const seed = shaSeed(`${args.address || ''}-${args.species || ''}`);
  // … در بدنهٔ fetch اضافه می‌شود. فعلاً مینیمم نگه می‌داریم.

  return await callOpenRouterImages({ prompt, size: String(size) });
}

// هم named هم default برای سازگاری import
export default { generateImage };
