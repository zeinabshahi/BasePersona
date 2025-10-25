import type { NextApiRequest, NextApiResponse } from "next";
import { createHash } from "crypto";
import { isAddress, createPublicClient, http } from "viem";
import { gateAbi } from "../../lib/abi/gate";
import { composePng } from "../../lib/img/compose";
import { uploadBufferAsFile, uploadJSON } from "../../lib/storage/ipfs";
import { usedTodayFor, incToday } from "../../lib/server/compose-usage";

type Attr = { trait_type: string; value: string | number };
type ReqBody = {
  from: `0x${string}`;      // آدرس کاربر که generate را انجام داده
  baseImage: string;        // data:, http(s), ipfs://
  overlaySVG: string;       // SVG نهایی
  name: string;             // نام NFT
  description?: string;
  attributes?: Attr[];
  external_url?: string;
  outWidth?: number;
  outHeight?: number;
};

type Resp =
  | {
      ok: true;
      image: { cid: string; uri: string; gateway: string; sha256: string; width: number; height: number };
      metadata: { cid: string; uri: string; gateway: string };
      tokenUri: string;
      imageHash: `0x${string}`;
    }
  | { ok: false; error: string };

const CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID || 8453);
const GATE = process.env.NEXT_PUBLIC_GATE as `0x${string}`;

export default async function handler(req: NextApiRequest, res: NextApiResponse<Resp>) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "method_not_allowed" });

  try {
    // اختیاری: کلید داخلی
    const requiredKey = process.env.INTERNAL_API_KEY;
    if (requiredKey && req.headers["x-internal-api-key"] !== requiredKey) {
      return res.status(401).json({ ok: false, error: "unauthorized" });
    }

    const { from, baseImage, overlaySVG, name, description, attributes, external_url, outWidth, outHeight } = req.body as ReqBody;

    if (!from || !isAddress(from)) return res.status(400).json({ ok: false, error: "bad_from" });
    if (!baseImage || !overlaySVG || !name) return res.status(400).json({ ok: false, error: "missing_fields" });
    if (!GATE) return res.status(500).json({ ok: false, error: "gate_not_configured" });

    // 1) استعلام on-chain برای enforce کردن «Generate قبل از Compose»
    const client = createPublicClient({ transport: http(process.env.RPC_URL || "https://mainnet.base.org") });

    const [cap, remaining] = await Promise.all([
      client.readContract({ address: GATE, abi: gateAbi, functionName: "dailyCap" }) as Promise<bigint>,
      client.readContract({ address: GATE, abi: gateAbi, functionName: "remainingToday", args: [from] }) as Promise<bigint>,
    ]);

    const generatedToday = Number(cap - remaining);   // چند بار generate امروز انجام شده
    const used = usedTodayFor(from);                  // چند بار compose قبلاً مصرف شده (سمت سرور)
    if (generatedToday <= used) {
      return res.status(403).json({ ok: false, error: "compose_quota_exhausted" });
    }

    // 2) Compose PNG
    const { png, width, height } = await composePng({ baseImage, overlaySVG, outWidth, outHeight });

    // 3) Hash برای EIP-712 (imageHash)
    const digestHex = createHash("sha256").update(png).digest("hex");
    const imageHash = ("0x" + digestHex) as `0x${string}`;

    // 4) Upload image
    const imgUp = await uploadBufferAsFile(png, "image.png", "image/png");

    // 5) Build + Upload metadata
    const metadata = {
      name,
      description: description || "Base Persona — on-chain generated image",
      image: imgUp.uri,
      external_url: external_url || process.env.NEXT_PUBLIC_APP_URL,
      attributes: attributes || [],
      properties: {
        files: [{ uri: imgUp.uri, type: "image/png", sha256: digestHex, width, height }],
        generator: "Compose(Server)+SVG overlay",
      },
    };
    const metaUp = await uploadJSON(metadata, "metadata.json");

    // 6) مصرف یک «Compose ticket»
    incToday(from);

    return res.status(200).json({
      ok: true,
      image: { ...imgUp, sha256: digestHex, width, height },
      metadata: metaUp,
      tokenUri: metaUp.uri,
      imageHash,
    });
  } catch (e: any) {
    console.error("[compose-store]", e);
    return res.status(500).json({ ok: false, error: e?.message || "compose_store_failed" });
  }
}
