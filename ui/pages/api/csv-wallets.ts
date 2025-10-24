
import type { NextApiRequest, NextApiResponse } from 'next'
import fs from 'fs'
import path from 'path'

export default function handler(req: NextApiRequest, res: NextApiResponse){
  try{
    const csvName = process.env.WALLET_CSV || 'demo_wallet_monthly_full.csv'
    const p = path.join(process.cwd(),'public','data',csvName)
    if(!fs.existsSync(p)) return res.status(404).json({error:'csv_not_found'})
    const raw = fs.readFileSync(p,'utf-8').trim().split(/\r?\n/)
    const header = raw[0].split(',')
    const iAddr = header.indexOf('wallet')
    if(iAddr<0) return res.status(400).json({error:'wallet column not found'})
    const addrs = [...new Set(raw.slice(1).map(r=> (r.split(',')[iAddr]||'').toLowerCase()))]
    return res.status(200).json({count: addrs.length, sample: addrs.slice(0,20)})
  }catch(e:any){
    return res.status(500).json({error:e?.message||'internal'})
  }
}
