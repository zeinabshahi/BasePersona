import React from 'react'
import dynamic from 'next/dynamic'
const CardPreviewMint = dynamic(()=>import('../components/CardPreviewMint'), { ssr:false })

const DEFAULT_PROMPT = 'waist-up 3D rendered portrait of a futuristic male character in ornate mythic sci-fi armor with gold reflections and glowing blue energy veins, realistic skin and metal materials, cinematic studio lighting, platinum halo above head emitting soft light, floating omni headdress with luminous parts, full AR visor showing holographic interface, surrounded by glowing golden aura and subtle particle fog, deep electric blue background, stylized 3D render, ultra detailed, symmetrical composition, 1:1'

export default function Page() {
  return (
    <div style={{padding:24}}>
      <h1 className="text-2xl font-bold mb-4">Card Composer Demo</h1>
      <CardPreviewMint
        defaultPrompt={DEFAULT_PROMPT}
        title="Mythic Sci‑Fi Paladin"
        stats={[
          { label:'Active Days', value:'88' },
          { label:'DEX Trades', value:'160' },
          { label:'Unique Contracts', value:'37' },
          { label:'NFT Mints', value:'12' },
        ]}
        badgeText='EPOCH‑3'
      />
    </div>
  )
}
