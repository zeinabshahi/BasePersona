import fs from "fs/promises";
import path from "path";
import { program } from "commander";
import { pickTraits } from "./traits.js";
import { buildPrompt } from "./prompt.js";
import { renderSubject } from "./render.js";
import { compositeFinal } from "./composite.js";
import { WalletInput } from "./types.js";

program
  .option("-i, --input <path>", "JSON file containing an array of wallet records")
  .option("-n, --limit <number>", "Number of records to process", "10");
program.parse(process.argv);
const opts = program.opts();

async function readWallets(filePath?: string): Promise<WalletInput[]> {
  if (!filePath) return [];
  const raw = await fs.readFile(filePath, "utf-8");
  return JSON.parse(raw) as WalletInput[];
}

async function ensureDir(dir: string) {
  await fs.mkdir(dir, { recursive: true });
}

async function main() {
  const wallets = await readWallets(opts.input);
  const limit = parseInt(opts.limit, 10);
  const subset = wallets.slice(0, isNaN(limit) ? wallets.length : limit);
  const outputBase = path.resolve(process.cwd(), "output");
  await ensureDir(path.join(outputBase, "subjects"));
  await ensureDir(path.join(outputBase, "finals"));
  await ensureDir(path.join(outputBase, "metadata"));
  for (let i = 0; i < subset.length; i++) {
    const w = subset[i];
    const { traits, names } = pickTraits(w);
    const prompt = buildPrompt(traits);
    const safeName = w.address.toLowerCase().replace(/[^a-z0-9]/g, "_");
    const subjectPath = path.join(outputBase, "subjects", `${safeName}.png`);
    // Render the subject image (transparent background).  If API is not configured this writes a placeholder.
    await renderSubject({
      prompt,
      outPath: subjectPath,
      size: parseInt(process.env.OUTPUT_SIZE || "1024", 10),
      transparent: true,
      chromaKey: process.env.GEN_CHROMA_KEY || undefined
    });
    // Determine background based on NFT holdings
    let bgName: "Simple Blue" | "Builder Grid" | "Dual Core";
    if (w.holds_base_builder && w.holds_base_introduced) bgName = "Dual Core";
    else if (w.holds_base_builder || w.holds_base_introduced) bgName = "Builder Grid";
    else bgName = "Simple Blue";
    const finalPath = path.join(outputBase, "finals", `${safeName}.png`);
    await compositeFinal({ subjectPath, backgroundName: bgName, outPath: finalPath });
    // Write metadata
    const meta = {
      name: `Base Persona ${i + 1}`,
      description: "Anime Cyberpunk generated persona based on wallet activity.",
      image: path.basename(finalPath),
      attributes: Object.entries(names).map(([trait_type, value]) => ({ trait_type, value }))
    };
    const metaPath = path.join(outputBase, "metadata", `${safeName}.json`);
    await fs.writeFile(metaPath, JSON.stringify(meta, null, 2), "utf-8");
    console.log(`Generated ${w.address} → ${finalPath}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});