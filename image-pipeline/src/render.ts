import fs from "fs/promises";
import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

export interface RenderOptions {
  prompt: string;
  outPath: string;
  size?: number;
  transparent?: boolean;
  chromaKey?: string;
}

const API_URL = process.env.GEN_API_URL || "";
const API_KEY = process.env.GEN_API_KEY || "";

/**
 * Render a subject image via a Stable Diffusion API.  If no API endpoint is configured,
 * a tiny placeholder PNG will be written instead.  The API payload can be adjusted
 * as needed for your specific backend.
 */
export async function renderSubject(opts: RenderOptions): Promise<void> {
  const size = opts.size ?? 1024;
  // If no API URL is set, write a 1x1 transparent PNG as a placeholder
  if (!API_URL) {
    const pngBuffer = Buffer.from(
      "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c636000000200015d0a2db40000000049454e44ae426082",
      "hex"
    );
    await fs.writeFile(opts.outPath, pngBuffer);
    return;
  }
  // Construct payload for the API.  This example uses the AUTOMATIC1111 txt2img API.
  const payload: any = {
    prompt: opts.prompt,
    width: size,
    height: size,
    steps: 30,
    cfg_scale: 9,
    sampler_index: "DPM++ 2M",
    restore_faces: false
  };
  if (opts.transparent) {
    // If transparent output is desired, some backends support specifying it in the prompt.
    payload.prompt += ", background transparent";
    if (opts.chromaKey) {
      payload.negative_prompt = (payload.negative_prompt || "") + ", complex background";
      payload.prompt += ", flat background " + opts.chromaKey;
    }
  }
  const headers: any = {};
  if (API_KEY) headers.Authorization = `Bearer ${API_KEY}`;
  const response = await axios.post(`${API_URL}/sdapi/v1/txt2img`, payload, { headers });
  const b64 = response.data?.images?.[0];
  if (!b64) throw new Error("No image returned from API");
  const buffer = Buffer.from(b64, "base64");
  await fs.writeFile(opts.outPath, buffer);
}