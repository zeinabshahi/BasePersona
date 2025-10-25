// pages/api/store-art.ts
import type { NextApiRequest, NextApiResponse } from "next";
import crypto from "crypto";
import { uploadBufferAsFile, uploadJSON } from "../../lib/storage/ipfs";

type Attr = { trait_type: string; value: string | number };
type Body = {
  // تصویر نهایی (base64 بدون header data:)
  pngBase64: string;
  name: string;
  description?: string;
  attributes?: Attr[];
  external_url?: string;  // لینک صفحه NFT روی سایتت
  seed?: string;          // اختیاری: برای رفرنس
  statsHash?: string;     // اختیاری: برای رفرنس
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== "POST") return res.status(405).json({ ok: false, error: "method_not_allowed" });

    const body = req.body as Body;
    if (!body?.pngBase64 || !body?.name) {
      return res.status(400).json({ ok: false, error: "missing_fields" });
    }

    // decode image
    const png = Buffer.from(body.pngBase64, "base64");
    // integrity checksum (optional but good)
    const sha256 = crypto.createHash("sha256").update(png).digest("hex");

    // 1) Upload image
    const imgUp = await uploadBufferAsFile(png, "image.png", "image/png");

    // 2) Build ERC-721 metadata
    const metadata = {
      name: body.name,
      description: body.description || "Base Persona — on-chain generated image",
      image: imgUp.uri,                             // ipfs://...
      external_url: body.external_url || process.env.NEXT_PUBLIC_APP_URL,
      attributes: body.attributes || [],
      properties: {
        files: [{ uri: imgUp.uri, type: "image/png", sha256 }],
        seed: body.seed || null,
        statsHash: body.statsHash || null,
        generator: "OpenAI + Rankora compositor",
      },
    };

    // 3) Upload metadata JSON
    const metaUp = await uploadJSON(metadata, "metadata.json");

    return res.status(200).json({
      ok: true,
      image: { cid: imgUp.cid, uri: imgUp.uri, gateway: imgUp.gateway, sha256 },
      metadata: { cid: metaUp.cid, uri: metaUp.uri, gateway: metaUp.gateway },
      tokenUri: metaUp.uri,
    });
  } catch (e: any) {
    console.error("[store-art]", e);
    return res.status(500).json({ ok: false, error: "store_failed" });
  }
}
