import { Web3Storage, File } from "web3.storage";
const IPFS_TOKEN = process.env.IPFS_TOKEN || "";
function client() {
  if (!IPFS_TOKEN) throw new Error("Missing IPFS_TOKEN");
  return new Web3Storage({ token: IPFS_TOKEN });
}
export async function uploadBufferAsFile(buf: Buffer, filename: string, contentType = "image/png") {
  const c = client();
  const files = [new File([buf], filename, { type: contentType })];
  const cid = await c.put(files, { wrapWithDirectory: false });
  return { cid, uri: `ipfs://${cid}`, gateway: `https://w3s.link/ipfs/${cid}` };
}
export async function uploadJSON(obj: any, filename = "metadata.json") {
  const c = client();
  const data = Buffer.from(JSON.stringify(obj, null, 2));
  const files = [new File([data], filename, { type: "application/json" })];
  const cid = await c.put(files, { wrapWithDirectory: false });
  return { cid, uri: `ipfs://${cid}`, gateway: `https://w3s.link/ipfs/${cid}` };
}
