import fs from 'node:fs/promises'
import path from 'node:path'

const SRC = process.argv[2] || './cdn_wallets'
const OUT = process.argv[3] || './cdn_hex'

await fs.mkdir(OUT, { recursive: true })
const entries = await fs.readdir(SRC, { withFileTypes: true })
for (const e of entries) {
  if (!e.isDirectory()) continue
  const p2 = e.name.toLowerCase()
  if (!/^[0-9a-f]{2}$/.test(p2)) continue
  const shard = p2[0]                // نیم‌نیبل اول
  const srcPath = path.join(SRC, p2)
  const dstPath = path.join(OUT, shard, p2)
  await fs.mkdir(path.dirname(dstPath), { recursive: true })
  await fs.cp(srcPath, dstPath, { recursive: true })
  console.log(`${p2} -> ${shard}`)
}
console.log('DONE.')
