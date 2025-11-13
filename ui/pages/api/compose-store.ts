// pages/api/compose-store.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import sharp from 'sharp';
import crypto from 'crypto';

/**
 * اجازه بدیم بدنه‌ی درخواست تا چند مگابایت بزرگ‌تر باشه
 * چون baseImage به صورت data: URL میاد و می‌تونه >1MB باشه.
 */
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '6mb', // در صورت نیاز می‌تونی بیشترش کنی
    },
  },
};

function dataUrlToBuffer(u: string) {
  if (typeof u !== 'string' || !u.startsWith('data:')) {
    throw new Error('baseImage must be data: URL');
  }
  const b64 = u.split(',')[1] || '';
  return Buffer.from(b64, 'base64');
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'POST') {
    return res
      .status(405)
      .json({ ok: false, error: 'method_not_allowed' });
  }

  try {
    const {
      baseImage,
      overlaySVG,
      name,
      description,
      attributes,
      external_url,
    } = (req.body || {}) as {
      baseImage?: string;
      overlaySVG?: string;
      name?: string;
      description?: string;
      attributes?: any;
      external_url?: string;
    };

    if (typeof baseImage !== 'string' || !baseImage.startsWith('data:')) {
      return res
        .status(400)
        .json({ ok: false, error: 'bad_base_image' });
    }
    if (typeof overlaySVG !== 'string' || overlaySVG.trim() === '') {
      return res
        .status(400)
        .json({ ok: false, error: 'bad_overlay_svg' });
    }

    const baseBuf = dataUrlToBuffer(baseImage);
    const svgBuf = Buffer.from(overlaySVG, 'utf8');

    // compose (SVG روی PNG)
    const png = await sharp(baseBuf)
      .composite([{ input: svgBuf, gravity: 'centre' }])
      .png({ compressionLevel: 9 })
      .toBuffer();

    // hash برای تطبیق هنگام مینت
    const imageHash =
      '0x' + crypto.createHash('sha256').update(png).digest('hex');

    // data URL برای پیش‌نمایش/دانلود
    const dataURL = `data:image/png;base64,${png.toString('base64')}`;

    // metadata به صورت data: (فعلاً بدون pin کردن)
    const meta = {
      name: name || 'MegaPersona Card',
      description: description || '',
      image: dataURL,
      attributes: Array.isArray(attributes) ? attributes : [],
      external_url: external_url || '',
    };
    const tokenUri =
      'data:application/json;base64,' +
      Buffer.from(JSON.stringify(meta)).toString('base64');

    return res.status(200).json({
      ok: true,
      image: { gateway: dataURL }, // فعلاً همان dataURL برای UI
      imageHash,
      tokenUri,
    });
  } catch (e: any) {
    console.error('[api/compose-store] fatal:', e);
    return res.status(500).json({
      ok: false,
      error: e?.message || 'compose_failed',
    });
  }
}
