// pages/api/wcdn/[addr].ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { isHexAddress, rawGithubUrl } from '../../../lib/wcdn';

const OWNER = process.env.WALLET_CDN_OWNER || 'zeinabshahi';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const addr = String(req.query.addr || req.query.address || '').trim().toLowerCase();
    if (!isHexAddress(addr)) {
      res.status(400).json({ error: 'invalid address' });
      return;
    }

    const url = rawGithubUrl(OWNER, addr);
    const gh = await fetch(url, {
      // اپشِن‌های کش سمت سرور نِکست
      next: { revalidate: 60 * 60 * 24 }, // 24h
      // تذکر: برای dev اهمیتی نداره؛ تو prod لبه/سرور مفیده
    });

    if (!gh.ok) {
      // 404 یا هر خطای دیگه
      res.status(gh.status).json({ error: `upstream ${gh.status}` });
      return;
    }

    const text = await gh.text();
    // هدرهای کش معقول برای کلاینت + لبه
    res.setHeader(
      'Cache-Control',
      'public, max-age=60, s-maxage=86400, stale-while-revalidate=604800'
    );
    // JSONِ خام رو عبور بدیم (فایل‌های شما همین فرمته)
    res.status(200).send(text);
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'internal error' });
  }
}
