import type { NextApiRequest, NextApiResponse } from 'next';
import { pickTraits } from '../../lib/traits';
import { buildPrompt } from '../../lib/prompt';
import { renderImage } from '../../lib/ai/image';
import { canonicalJson, toKeccakHex } from '../../lib/utils';
import crypto from 'crypto';

/**
 * Generate an image for a given wallet. This endpoint expects a POST body
 * containing `address`, `metrics`, optional `persona` and `timeAnchor`, and
 * versioning info. It selects traits, builds a prompt, renders the image
 * using the configured provider and returns the result inline with no
 * asynchronous polling. Errors are surfaced with status 500.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  try {
    const {
      address,
      metrics,
      persona,
      timeAnchor,
      modelVersion = 1,
      statsHash,
      traitsHash,
    } = req.body || {};
    if (!address || !metrics) {
      res.status(400).json({ error: 'Missing address or metrics' });
      return;
    }
    // Map input metrics into our WalletInput shape
    const w = {
      address: String(address),
      wallet_birth_month: Number(metrics.wallet_birth_month) || undefined,
      wallet_age_days:
        Number(metrics.wallet_age_days) || Number((metrics as any).walletAgeDays) || undefined,
      unique_contracts:
        Number(metrics.unique_contracts ?? (metrics as any).uniqueContractInteractions ?? 0),
      active_days: Number(metrics.active_days ?? (metrics as any).uniqueDays ?? 0),
      total_txs:
        Number(
          metrics.total_txs ??
            ((metrics as any).nativeTxCount || 0) + ((metrics as any).tokenTxCount || 0)
        ),
      distinct_tokens: Number(metrics.distinct_tokens ?? (metrics as any).uniqueTokenCount ?? 0),
      dex_trades: Number(metrics.dex_trades ?? (metrics as any).swap_tx_count ?? 0),
      nft_mints: Number(metrics.nft_mints ?? (metrics as any).nftMintCount ?? 0),
      holds_builder: !!metrics.baseBuilderHolder,
      holds_introduced: !!metrics.baseIntroducedHolder,
    };
    // 1) Select traits based on wallet metrics
    const { traits, names } = pickTraits(w);
    // 2) Build prompt string from selected trait prompts
    const finalPrompt = buildPrompt(traits);
    // 3) Compute prompt hash and seed input for reproducibility
    const promptHash = toKeccakHex(canonicalJson({ names, finalPrompt, modelVersion }));
    const seedInput = canonicalJson({ address, statsHash, traitsHash, modelVersion });
    // 4) Render image from provider
    const { b64png } = await renderImage({
      prompt: finalPrompt,
      seedInput,
      size: '1024x1024',
    });
    // 5) Compute SHA256 checksum of image for integrity
    const sha = crypto.createHash('sha256').update(Buffer.from(b64png, 'base64')).digest('hex');
    const dataUrl = `data:image/png;base64,${b64png}`;
    const jobId = Date.now().toString(36);
    // 6) Return result immediately; no polling necessary
    res.status(200).json({
      status: 'done',
      jobId,
      imageURL: dataUrl,
      imageSHA256: `0x${sha}`,
      promptHash,
      prompt: finalPrompt,
      traitNames: names,
      modelVersion,
    });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err?.message || 'render_failed' });
  }
}