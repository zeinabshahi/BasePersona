import type { NextApiRequest, NextApiResponse } from 'next'
import { privateKeyToAccount } from 'viem/accounts'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  try {
    const { to, tokenURI, imageHash, deadline, nonce } = req.body || {}
    if (!to || !tokenURI || !imageHash || !deadline || typeof nonce !== 'number') {
      return res.status(400).json({ error: 'missing_fields' })
    }
    const pk = process.env.PRIVATE_KEY as `0x${string}` | undefined
    if (!pk) return res.status(500).json({ error: 'server_key_missing' })
    const account = privateKeyToAccount(pk)

    const domain = {
      name: 'BMImage721',
      version: '1',
      chainId: Number(process.env.NEXT_PUBLIC_CHAIN_ID || 8453),
      verifyingContract: process.env.NEXT_PUBLIC_CONTRACT as `0x${string}`,
    }

    const types = {
      Claim: [
        { name: 'to', type: 'address' },
        { name: 'tokenURI', type: 'string' },
        { name: 'imageHash', type: 'bytes32' },
        { name: 'deadline', type: 'uint256' },
        { name: 'nonce', type: 'uint256' },
      ]
    }

    const message = {
      to: to as `0x${string}`,
      tokenURI: String(tokenURI),
      imageHash: imageHash as `0x${string}`,
      deadline: BigInt(deadline),
      nonce: BigInt(nonce),
    } as const

    const sig = await account.signTypedData({ domain, types, primaryType: 'Claim', message })
    return res.status(200).json({ claim: message, sig })
  } catch (e:any) {
    return res.status(500).json({ error: e?.message || 'sign_failed' })
  }
}
