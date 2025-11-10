import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';
import readline from 'node:readline';

const inPath = process.argv[2];
const outDir = process.argv[3] || './cdn_wallets';

if (!inPath) {
  console.error('Usage: node scripts/split_jsonl_to_files.mjs <input.jsonl|.gz> [outDir]');
  process.exit(1);
}

const st = await fsp.stat(inPath).catch(() => null);
if (!st) {
  console.error('Input not found:', inPath);
  process.exit(1);
}
if (st.isDirectory()) {
  console.error('Input is a DIRECTORY, not a file:', inPath);
  console.error('Please pass the actual file path (e.g. ...\\wallets_MIN__gasfixed.jsonl or .jsonl.gz)');
  process.exit(2);
}

await fsp.mkdir(outDir, { recursive: true });

const stream = inPath.endsWith('.gz')
  ? fs.createReadStream(inPath).pipe(zlib.createGunzip())
  : fs.createReadStream(inPath);

const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

const made = new Set();
let n = 0, bad = 0;

function isHexAddr(s) { return /^0x[0-9a-fA-F]{40}$/.test(s); }

async function writeOne(obj) {
  const addr = String(obj.wallet || obj.address || '').toLowerCase();
  if (!isHexAddr(addr)) { bad++; return; }

  const payload = {
    wallet: addr,
    rank: obj.rank ?? null,
    lifetime: obj.lifetime ?? {},
    months: obj.months ?? {},
  };

  const shard = addr.slice(2, 4);
  const dir = path.join(outDir, shard);
  if (!made.has(shard)) {
    await fsp.mkdir(dir, { recursive: true });
    made.add(shard);
  }
  const fp = path.join(dir, `${addr}.json`);
  await fsp.writeFile(fp, JSON.stringify(payload));
}

const pending = [];
const FLUSH_EVERY = 500;

for await (const line of rl) {
  const s = line.trim();
  if (!s) continue;
  try {
    const obj = JSON.parse(s);
    pending.push(writeOne(obj));
    if (pending.length >= FLUSH_EVERY) {
      await Promise.all(pending.splice(0));
      n += FLUSH_EVERY;
      if (n % 5000 === 0) process.stdout.write(`written ~${n}\r`);
    }
  } catch {
    bad++;
  }
}
await Promise.all(pending);
console.log(`\nDone. bad=${bad}`);
