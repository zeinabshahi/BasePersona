import type { NextApiRequest, NextApiResponse } from 'next'
import sharp from 'sharp'
import { keccak256 } from 'viem'

type Stat = { label: string; value: string }
type Body = { imageURL: string; title: string; subtitle?: string; stats?: Stat[]; badgeText?: string; logoUrl?: string; size?: number }

function svgOverlay(opts: Body, size=1024){
  const pad=48, yTop=pad+10, line=44
  const rows=(opts.stats||[]).slice(0,6).map((s,i)=>{
    const y = size - pad - 20 - (((opts.stats||[]).slice(0,6).length-1 - i)*line)
    return `<text x="${pad}" y="${y}" font="500 28px Inter,Segoe UI,Arial" fill="rgba(255,255,255,0.95)">${s.label}: <tspan font-weight="700">${s.value}</tspan></text>`
  }).join('')
  const subtitle = opts.subtitle ? `<text x="${pad}" y="${yTop+42}" font="400 26px Inter,Segoe UI,Arial" fill="rgba(255,255,255,0.85)">${opts.subtitle}</text>` : ''
  const badge = opts.badgeText ? `<rect x="${size-pad-170}" y="${pad}" rx="14" ry="14" width="170" height="44" fill="rgba(255,215,0,0.12)" stroke="rgba(255,215,0,0.55)"/><text x="${size-pad-85}" y="${pad+30}" text-anchor="middle" font="700 22px Inter" fill="rgba(255,215,0,0.95)">${opts.badgeText}</text>` : ''
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <defs><linearGradient id="topFade" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="rgba(0,0,0,0.55)"/><stop offset="60%" stop-color="rgba(0,0,0,0)"/></linearGradient><linearGradient id="bottomFade" x1="0" y1="1" x2="0" y2="0"><stop offset="0%" stop-color="rgba(0,0,0,0.50)"/><stop offset="55%" stop-color="rgba(0,0,0,0)"/></linearGradient></defs>
  <rect width="100%" height="42%" fill="url(#topFade)"/><rect y="${size*0.58}" width="100%" height="${size*0.42}" fill="url(#bottomFade)"/>
  ${badge}<text x="${pad}" y="${yTop}" font="600 40px Inter,Segoe UI,Arial" fill="white">${opts.title}</text>${subtitle}${rows}</svg>`
}

function parseDataUrl(dataUrl: string){ const idx=dataUrl.indexOf(','); return Buffer.from(dataUrl.slice(idx+1),'base64') }

export default async function handler(req: NextApiRequest, res: NextApiResponse){
  if (req.method!=='POST') return res.status(405).json({ ok:false, error:'method_not_allowed' })
  try{
    const body = req.body as Body
    const size = body.size || 1024
    const baseBuf = parseDataUrl(body.imageURL)
    const svg = svgOverlay(body, size)
    const out = await sharp(baseBuf).resize(size,size,{fit:'cover'}).composite([{ input: Buffer.from(svg), top:0, left:0 }]).png({compressionLevel:9}).toBuffer()
    const imageURL = `data:image/png;base64,${out.toString('base64')}`
    const imageKeccak = keccak256(out)
    res.status(200).json({ ok:true, imageURL, imageKeccak })
  }catch(e:any){ res.status(500).json({ ok:false, error:e?.message || 'compose_failed' }) }
}
