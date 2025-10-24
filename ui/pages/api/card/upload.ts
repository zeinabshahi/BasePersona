import type { NextApiRequest, NextApiResponse } from 'next'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ ok:false, error:'method_not_allowed' })
  try {
    const { cardPngDataURL, name, description, attributes, properties } = req.body || {}
    if (!cardPngDataURL || !name) return res.status(400).json({ ok:false, error:'missing_fields' })
    const token = process.env.WEB3STORAGE_TOKEN
    if (!token) return res.status(400).json({ ok:false, error:'missing_WEB3STORAGE_TOKEN' })

    const comma = cardPngDataURL.indexOf(',')
    const b64 = cardPngDataURL.slice(comma+1)
    const bin = Buffer.from(b64, 'base64')

    const r1 = await fetch('https://api.web3.storage/upload', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: bin
    })
    const j1 = await r1.json()
    const imageCid = j1?.cid
    if (!imageCid) return res.status(500).json({ ok:false, error:'upload_image_failed' })

    const meta = {
      name, description,
      image: `ipfs://${imageCid}`,
      attributes: attributes || [],
      properties: properties || {},
    }
    const r2 = await fetch('https://api.web3.storage/upload', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(meta)
    })
    const j2 = await r2.json()
    const metaCid = j2?.cid
    if (!metaCid) return res.status(500).json({ ok:false, error:'upload_metadata_failed' })

    res.status(200).json({ ok:true, imageCid, metaCid, tokenURI: `ipfs://${metaCid}` })
  } catch (e:any) {
    res.status(500).json({ ok:false, error: e?.message || 'upload_failed' })
  }
}
