// pages/api/compose-store.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import sharp from 'sharp';
import { keccak256 } from 'viem';
import fs from 'fs';
import path from 'path';

const PINATA_JWT = process.env.PINATA_JWT || '';
const PINATA_GATEWAY = (process.env.PINATA_GATEWAY || 'https://gateway.pinata.cloud/ipfs').replace(
  /\/+$/,
  '',
);

// data:image/png;base64,...  →  { mimeType, buffer }
function decodeDataUrl(dataUrl: string): { mimeType: string; buffer: Buffer } {
  const m = /^data:(.+);base64,(.*)$/.exec(dataUrl);
  if (!m) throw new Error('bad_data_url');
  const mimeType = m[1] || 'image/png';
  const buffer = Buffer.from(m[2], 'base64');
  return { mimeType, buffer };
}

/** ---- Space Grotesk embed در SVG ---- **/

let spaceGroteskCssCache: string | null = null;

function getSpaceGroteskCss(): string {
  if (spaceGroteskCssCache !== null) return spaceGroteskCssCache;

  try {
    const baseDir = path.join(process.cwd(), 'public', 'fonts', 'space-grotesk');

    const regularPath = path.join(baseDir, 'SpaceGrotesk-Regular.otf');
    const boldPath = path.join(baseDir, 'SpaceGrotesk-Bold.otf');

    const regularBuf = fs.readFileSync(regularPath);
    const boldBuf = fs.readFileSync(boldPath);

    const regularUrl = 'data:font/otf;base64,' + regularBuf.toString('base64');
    const boldUrl = 'data:font/otf;base64,' + boldBuf.toString('base64');

    spaceGroteskCssCache = `
<style type="text/css">
@font-face {
  font-family: 'Space Grotesk';
  src: url('${regularUrl}') format('opentype');
  font-weight: 400;
  font-style: normal;
}
@font-face {
  font-family: 'Space Grotesk';
  src: url('${boldUrl}') format('opentype');
  font-weight: 600;
  font-style: normal;
}
@font-face {
  font-family: 'Space Grotesk';
  src: url('${boldUrl}') format('opentype');
  font-weight: 700;
  font-style: normal;
}
@font-face {
  font-family: 'Space Grotesk';
  src: url('${boldUrl}') format('opentype');
  font-weight: 800;
  font-style: normal;
}
</style>`;
  } catch (e) {
    console.error('[compose-store] failed to load SpaceGrotesk fonts:', e);
    spaceGroteskCssCache = '';
  }

  return spaceGroteskCssCache!;
}

function inlineSpaceGrotesk(svg: string): string {
  const css = getSpaceGroteskCss();
  if (!css) return svg;

  // اگر <defs> هست، استایل را بعدش تزریق کن
  if (svg.includes('<defs>')) {
    return svg.replace('<defs>', `<defs>${css}`);
  }

  // اگر defs نیست، قبل از </svg> اضافه کن
  if (svg.includes('</svg>')) {
    return svg.replace('</svg>', `<defs>${css}</defs></svg>`);
  }

  // در بدترین حالت همان svg را برگردان
  return svg;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  }

  try {
    const { from, baseImage, overlaySVG, name, description, attributes, external_url } = (req.body ||
      {}) as {
      from?: string;
      baseImage?: string;
      overlaySVG?: string;
      name?: string;
      description?: string;
      attributes?: Array<{ trait_type: string; value: string | number }>;
      external_url?: string;
    };

    if (typeof baseImage !== 'string' || !baseImage.startsWith('data:')) {
      return res.status(400).json({ ok: false, error: 'missing_or_bad_base_image' });
    }
    if (typeof overlaySVG !== 'string' || !overlaySVG.trim()) {
      return res.status(400).json({ ok: false, error: 'missing_overlay_svg' });
    }
    if (!PINATA_JWT) {
      return res.status(500).json({ ok: false, error: 'missing_PINATA_JWT_env' });
    }

    // ۱) decode base image
    const { buffer: baseBuf } = decodeDataUrl(baseImage);

    // ۲) SVG + فونت Space Grotesk اینلاین
    const svgWithFont = inlineSpaceGrotesk(overlaySVG);
    const svgBuf = Buffer.from(svgWithFont, 'utf8');

    // ۳) ترکیب base + SVG overlay با sharp
    const composedPng = await sharp(baseBuf)
      .composite([{ input: svgBuf, top: 0, left: 0 }])
      .png()
      .toBuffer();

    // ۴) keccak256 برای قفل‌کردن تصویر در قرارداد
    const imageHash = keccak256(composedPng); // hex string مثل 0xabc...

    // data URL برای پیش‌نمایش لوکال
    const dataUrl = 'data:image/png;base64,' + composedPng.toString('base64');

    // ۵) آپلود تصویر روی Pinata → /pinning/pinFileToIPFS
    const formData = new FormData();
    const blob = new Blob([composedPng], { type: 'image/png' });
    formData.append('file', blob, 'rankora-persona-card.png');

    const pinataFileRes = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${PINATA_JWT}`,
      },
      body: formData as any,
    });

    if (!pinataFileRes.ok) {
      const txt = await pinataFileRes.text();
      throw new Error(`pinFileToIPFS_failed_${pinataFileRes.status}: ${txt.slice(0, 200)}`);
    }

    const fileJson: any = await pinataFileRes.json();
    const imageCid: string | undefined = fileJson?.IpfsHash;
    if (!imageCid) {
      throw new Error('pinFileToIPFS_missing_IpfsHash');
    }

    const ipfsImageUri = `ipfs://${imageCid}`;
    const gatewayImageUrl = `${PINATA_GATEWAY}/${imageCid}`;

    // ۶) ساخت متادیتا و آپلود آن روی Pinata → /pinning/pinJSONToIPFS
    const metaName = name || 'Base Persona Card';

    const metaDesc =
      description ||
      'Base Persona Card generated by Rankora from public Base wallet activity. Soft 3D avatar + onchain stats overlay, no private keys, no extra permissions.';

    const metadataObj = {
      name: metaName,
      description: metaDesc,
      image: ipfsImageUri,
      external_url: external_url || undefined,
      attributes: Array.isArray(attributes) ? attributes : [],
    };

    const pinataJsonRes = await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${PINATA_JWT}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(metadataObj),
    });

    if (!pinataJsonRes.ok) {
      const txt = await pinataJsonRes.text();
      throw new Error(`pinJSONToIPFS_failed_${pinataJsonRes.status}: ${txt.slice(0, 200)}`);
    }

    const jsonResult: any = await pinataJsonRes.json();
    const metaCid: string | undefined = jsonResult?.IpfsHash;
    if (!metaCid) {
      throw new Error('pinJSONToIPFS_missing_IpfsHash');
    }

    const tokenUri = `ipfs://${metaCid}`;

    return res.status(200).json({
      ok: true,
      tokenUri,
      imageHash, // برای /api/sign-claim
      image: {
        ipfs: ipfsImageUri,
        gateway: gatewayImageUrl,
        dataUrl,
      },
      from: from || null,
    });
  } catch (e: any) {
    console.error('[api/compose-store] fatal:', e);
    return res.status(500).json({
      ok: false,
      error: String(e?.message || e || 'compose_failed'),
    });
  }
}

// برای اینکه base64 تصویر رو قبول کنه
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};
