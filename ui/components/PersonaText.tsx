import React from 'react'

type Props = { narrative?: any; isLoading?: boolean }

function buildCopy(narrative?: any) {
  const n = narrative?.narrativeJson ?? narrative ?? {}
  const lines: string[] = []
  if (n.title) lines.push(n.title)
  if (n.oneLiner) lines.push(n.oneLiner)
  if (n.summary) lines.push(n.summary)
  if (typeof n === 'string' && !lines.length) lines.push(n)
  if (Array.isArray(n.highlights) && n.highlights.length) {
    lines.push('', 'Highlights:')
    for (const h of n.highlights) lines.push(`• ${h}`)
  }
  if (Array.isArray(n.personalityTags) && n.personalityTags.length) {
    lines.push('', 'Tags: ' + n.personalityTags.join(', '))
  }
  return lines.join('\n')
}

export function PersonaText({ narrative, isLoading }: Props) {
  const copyText = buildCopy(narrative)

  const defaultText = `This wallet has not been analyzed yet.

Click "Analyze" to generate a concise on-chain persona for this address. The generated persona will include:
• Overall activity level (active / inactive) and wallet age (days since first tx);
• Native and token transaction counts;
• ETH volume (30d and total);
• Total and unique contract interactions;
• NFT ownership summary (whether the wallet holds Base Builder / Base Introduced and how many unique NFT contracts it holds);
• A short, shareable narrative sentence describing the wallet's on-chain behavior and personality.

Analysis usually takes a few seconds depending on API latency. The full persona will appear here as soon as it's ready.`

  const onCopy = async () => {
    try { await navigator.clipboard.writeText(copyText || defaultText) } catch {}
  }

  return (
    <div className="card">
      <div className="cardHeader">
        <h3>Persona</h3>
        <div className="toolbar"><button className="chip" onClick={onCopy}>Copy</button></div>
      </div>

      <div className="personaText" style={{ padding: 14 }}>
        {isLoading
          ? <p className="personaLine"><b>Analyzing wallet…</b> Please wait a moment.</p>
          : (copyText || defaultText).split('\n').map((l, i) => <p key={i} className="personaLine">{l}</p>)
        }
      </div>
    </div>
  )
}

export default PersonaText
