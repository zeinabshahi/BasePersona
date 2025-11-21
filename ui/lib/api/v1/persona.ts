// lib/api/v1/persona.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import crypto from 'crypto';
import { pickTraits } from '../../../lib/traits';
import { buildPrompt } from '../../../lib/prompt';
import { renderImage } from '../../../lib/ai/image';
import { generateNarrative } from '../../../lib/ai/llm';
import { canonicalJson, toKeccakHex } from '../../../lib/utils';
import {
  rateLimit,
  requireApiKey,
  send401,
  send429,
} from '../../../lib/api/auth';

type Metrics = {
  wallet_birth_month?: number;
  wallet_age_days?: number;
  unique_contracts?: number;
  active_days?: number;
  total_txs?: number;
  distinct_tokens?: number;
  dex_trades?: number;
  nft_mints?: number;
  baseBuilderHolder?: boolean;
  baseIntroducedHolder?: boolean;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'POST') {
    return res
      .status(405)
      .json({ ok: false, error: 'method_not_allowed' });
  }
  if (!rateLimit(req, 40, 60_000)) return send429(res);

  try {
    const {
      address,
      metrics,
      persona = {},
      timeAnchor = { nowUnix: Math.floor(Date.now() / 1000) },
      modelVersion = 1,
      dryRun = false, // اگر true باشد، تصویر تولید نمی‌شود
      imgProvider, // override اختیاری provider تصویر
      llmProvider, // override اختیاری provider متن
    } = (req.body || {}) as {
      address?: string;
      metrics?: Metrics;
      persona?: any;
      timeAnchor?: any;
      modelVersion?: number;
      dryRun?: boolean;
      imgProvider?: string;
      llmProvider?: string;
    };

    if (!address) {
      return res
        .status(400)
        .json({ ok: false, error: 'missing_address' });
    }

    // امنیت: اگر INTERNAL_API_KEY تنظیم شده، برای تصویر لازم است
    if (!dryRun && !requireApiKey(req)) return send401(res);

    // 1) traits + prompt (برای سازگاری با نسخه‌ی جدید pickTraits)
    const traitMetrics = {
      uniqueContracts: Number(metrics?.unique_contracts ?? 0),
      activeDays: Number(metrics?.active_days ?? 0),
      gasEth: 0, // در این مسیر v1 چیزی برای گس نداریم، فعلاً ۰ می‌گذاریم
      monthlyRank: 500000, // پیش‌فرض محافظه‌کارانه
      nftCount: Number(metrics?.nft_mints ?? 0),
      balanceEth: 0,
      totalTxs: Number(metrics?.total_txs ?? 0),
    };

    const built = pickTraits(traitMetrics);
    const names = built.names;
    const prompt = buildPrompt(built);

    const promptHash = toKeccakHex(
      canonicalJson({ names, prompt, modelVersion }),
    );
    const seedInput = canonicalJson({ address, modelVersion });

    // 2) narrative
    const narrativeJson = await generateNarrative({
      persona: {
        address,
        ...persona,
        llmProvider:
          llmProvider ||
          process.env.LLM_PROVIDER ||
          'openai',
      },
      traits: { names },
      analytics: metrics || {},
      timeAnchor,
    });

    // 3) image (اختیاری با dryRun)
    let imageURL: string | undefined;
    let imageSHA256: string | undefined;

    if (!dryRun) {
      const old = process.env.IMG_PROVIDER;
      if (imgProvider) (process.env as any).IMG_PROVIDER = imgProvider;

      const { b64png } = await renderImage({
        prompt,
        seedInput,
        size: '1024x1024',
      });

      if (imgProvider) (process.env as any).IMG_PROVIDER = old;

      const sha = crypto
        .createHash('sha256')
        .update(Buffer.from(b64png, 'base64'))
        .digest('hex');

      imageSHA256 = '0x' + sha;
      imageURL = `data:image/png;base64,${b64png}`;
    }

    const id = Date.now().toString(36);

    return res.status(200).json({
      ok: true,
      id,
      address,
      modelVersion,
      traitNames: names,
      prompt,
      promptHash,
      narrative: narrativeJson,
      imageURL, // در dryRun: undefined
      imageSHA256, // در dryRun: undefined
    });
  } catch (e: any) {
    return res
      .status(500)
      .json({ ok: false, error: e?.message || 'persona_failed' });
  }
}
