// pages/api/sign-claim.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { privateKeyToAccount } from 'viem/accounts';
import { Hex, isHex } from 'viem';

type ClaimBody = {
  to?: string;                // ورودی از کلاینت
  tokenURI?: string;
  imageHash?: Hex;
  deadline?: number | string;
  nonce?: number | string;
};

/** سرور فقط از این متغیر استفاده می‌کند (روی کلاینت اکسپوز نمی‌شود) */
const RAW_PK =
  process.env.MINT_SIGNER_PRIVATE_KEY ||
  process.env.SIGNER_PRIVATE_KEY ||
  '';

const CONTRACT = process.env.NEXT_PUBLIC_CONTRACT as `0x${string}` | undefined;
const CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID || '8453'); // مثلاً Base mainnet

function getAccount() {
  if (!RAW_PK) {
    throw new Error('missing MINT_SIGNER_PRIVATE_KEY env');
  }

  // مطمئن شو 0x-prefixed هست
  let pk = RAW_PK.trim();
  if (!pk.startsWith('0x')) pk = '0x' + pk;

  if (!isHex(pk) || pk.length !== 66) {
    // 0x + 64 hex chars
    throw new Error(
      'invalid MINT_SIGNER_PRIVATE_KEY, expected 0x + 64 hex characters',
    );
  }

  return privateKeyToAccount(pk as Hex);
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
    const { to, tokenURI, imageHash, deadline, nonce } =
      (req.body || {}) as ClaimBody;

    if (!CONTRACT) {
      throw new Error('missing NEXT_PUBLIC_CONTRACT env');
    }

    if (!to || typeof to !== 'string') {
      return res
        .status(400)
        .json({ ok: false, error: 'missing_to_address' });
    }
    if (!tokenURI || typeof tokenURI !== 'string') {
      return res
        .status(400)
        .json({ ok: false, error: 'missing_tokenURI' });
    }
    if (!imageHash || typeof imageHash !== 'string') {
      return res
        .status(400)
        .json({ ok: false, error: 'missing_imageHash' });
    }

    // ولیدیشن ساده‌ی آدرس و هش از نظر فرم
    if (!isHex(to) || to.length !== 42) {
      return res
        .status(400)
        .json({ ok: false, error: 'bad_to_address' });
    }
    if (!isHex(imageHash) || imageHash.length !== 66) {
      return res
        .status(400)
        .json({ ok: false, error: 'bad_imageHash' });
    }

    const d = BigInt(deadline ?? 0);
    const n = BigInt(nonce ?? 0);

    const account = getAccount();

    const domain = {
      name: 'BMImage721',
      version: '1',
      chainId: CHAIN_ID,
      verifyingContract: CONTRACT,
    } as const;

    const types = {
      Claim: [
        { name: 'to', type: 'address' },
        { name: 'tokenURI', type: 'string' },
        { name: 'imageHash', type: 'bytes32' },
        { name: 'deadline', type: 'uint256' },
        { name: 'nonce', type: 'uint256' },
      ],
    } as const;

    // این‌جا تایپ رو طوری می‌سازیم که با انتظار viem یکی باشه
    const message: {
      to: `0x${string}`;
      tokenURI: string;
      imageHash: `0x${string}`;
      deadline: bigint;
      nonce: bigint;
    } = {
      to: to as `0x${string}`,
      tokenURI,
      imageHash: imageHash as `0x${string}`,
      deadline: d,
      nonce: n,
    };

    const sig = await account.signTypedData({
      domain,
      types,
      primaryType: 'Claim',
      message,
    });

    return res.status(200).json({
      ok: true,
      sig,
      signer: account.address,
    });
  } catch (e: any) {
    console.error('[api/sign-claim] fatal:', e);
    return res.status(500).json({
      ok: false,
      error: String(e?.message || e || 'sign_claim_failed'),
    });
  }
}
