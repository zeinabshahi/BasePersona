import sharp from "sharp";

async function fetchBufferFromSource(src: string): Promise<Buffer> {
  if (src.startsWith("data:")) {
    const b64 = src.split(",").pop()!;
    return Buffer.from(b64, "base64");
  }
  if (src.startsWith("ipfs://")) {
    const cid = src.replace("ipfs://", "");
    const r = await fetch(`https://w3s.link/ipfs/${cid}`);
    if (!r.ok) throw new Error("ipfs_fetch_failed");
    return Buffer.from(await r.arrayBuffer());
  }
  const r = await fetch(src);
  if (!r.ok) throw new Error("fetch_failed");
  return Buffer.from(await r.arrayBuffer());
}

export type ComposeInput = {
  baseImage: string;
  overlaySVG: string;
  autoFit?: boolean;
  outWidth?: number;
  outHeight?: number;
};

export async function composePng({ baseImage, overlaySVG, autoFit = true, outWidth, outHeight }: ComposeInput) {
  const baseBuf = await fetchBufferFromSource(baseImage);
  let base = sharp(baseBuf, { failOn: "none" });
  const meta = await base.metadata();
  const w = outWidth  || meta.width  || 1024;
  const h = outHeight || meta.height || 1024;
  if (outWidth || outHeight) base = base.resize(w, h, { fit: "cover" });

  let overlay = overlaySVG;
  if (autoFit) {
    if (!/width=/.test(overlay))  overlay = overlay.replace("<svg", `<svg width="${w}"`);
    if (!/height=/.test(overlay)) overlay = overlay.replace("<svg", `<svg height="${h}"`);
    if (!/viewBox=/.test(overlay)) overlay = overlay.replace("<svg", `<svg viewBox="0 0 ${w} ${h}"`);
  }

  const out = await base.composite([{ input: Buffer.from(overlay), top: 0, left: 0 }]).png({ compressionLevel: 9 }).toBuffer();
  return { png: out, width: w, height: h };
}
