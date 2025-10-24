// components/JsonBlock.tsx
import React, { useMemo, useState } from 'react'

type Props = {
  title: string
  data: unknown
  summary?: Array<{ label: string; value?: string | number }>
  clippedHeight?: number
  filename?: string
}

export function JsonBlock({ title, data, summary = [], clippedHeight = 260, filename }: Props) {
  const [expanded, setExpanded] = useState(false)

  const pretty = useMemo(() => {
    try { return JSON.stringify(data ?? {}, null, 2) } catch { return '{}' }
  }, [data])

  const onCopy = async () => {
    try { await navigator.clipboard.writeText(pretty) } catch {}
  }
  const onDownload = () => {
    const blob = new Blob([pretty], { type: 'application/json;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = (filename || title.toLowerCase()) + '.json'
    document.body.appendChild(a); a.click(); a.remove()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="card">
      <div className="cardHeader">
        <h3>{title}</h3>
        <div className="toolbar">
          <button className="chip" onClick={() => setExpanded(v => !v)}>{expanded ? 'Collapse' : 'Expand'}</button>
          <button className="chip" onClick={onCopy}>Copy</button>
          <button className="chip" onClick={onDownload}>Download</button>
        </div>
      </div>

      {summary.length > 0 && (
        <div className="summaryRow">
          {summary.map((s, i) => (
            <div key={i} className="summaryItem">
              <div className="k">{s.label}</div>
              <div className="v">{(s.value ?? '–').toString()}</div>
            </div>
          ))}
        </div>
      )}

      <pre
        className={`pre ${expanded ? 'expand' : 'clip'}`}
        style={!expanded ? { maxHeight: clippedHeight } : undefined}
      >
        {pretty}
      </pre>
    </div>
  )
}
