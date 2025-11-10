import * as React from 'react'
import { useRouter } from 'next/router'

type Row = { wallet: string; rank: number }

export default function SearchBox() {
  const [q, setQ] = React.useState('')
  const [items, setItems] = React.useState<Row[]>([])
  const [open, setOpen] = React.useState(false)
  const [loading, setLoading] = React.useState(false)
  const router = useRouter()

  // debounce
  React.useEffect(() => {
    const qq = q.trim()
    if (!qq) { setItems([]); setOpen(false); return }
    const id = setTimeout(async () => {
      try {
        setLoading(true)
        const r = await fetch(`/api/search?q=${encodeURIComponent(qq)}`)
        if (!r.ok) { setItems([]); setOpen(false); return }
        const data = await r.json()
        setItems((data?.results || []) as Row[])
        setOpen(true)
      } finally { setLoading(false) }
    }, 180)
    return () => clearTimeout(id)
  }, [q])

  const go = (addr: string) => {
    setOpen(false)
    if (!addr?.startsWith('0x') || addr.length !== 42) return
    router.push(`/wallet/${addr}`)
  }

  const onSubmit: React.FormEventHandler = (e) => {
    e.preventDefault()
    let addr = q.trim().toLowerCase()
    if (!addr.startsWith('0x')) addr = '0x' + addr
    go(addr)
  }

  return (
    <div style={{ position:'relative', width:'100%' }}>
      <form onSubmit={onSubmit}>
        <input
          value={q}
          onChange={(e)=>setQ(e.currentTarget.value)}
          placeholder="Search wallet (0x… or prefix)"
          spellCheck={false}
          autoCorrect="off"
          autoCapitalize="none"
          style={{
            width:'100%', padding:'10px 12px', borderRadius:12,
            border:'1px solid #1d2a44', background:'#0b1220', color:'#e5e7eb'
          }}
        />
      </form>

      {open && items.length > 0 && (
        <div style={{
          position:'absolute', top:'110%', left:0, right:0, zIndex:50,
          background:'#0b1220', border:'1px solid #1d2a44', borderRadius:12,
          overflow:'hidden'
        }}>
          {items.map(r => (
            <div
              key={r.wallet}
              onClick={()=>go(r.wallet)}
              style={{ padding:'10px 12px', cursor:'pointer', display:'flex', justifyContent:'space-between' }}
              onMouseDown={(e)=>e.preventDefault()}
            >
              <span style={{ fontFamily:'ui-monospace, SFMono-Regular, Menlo, monospace' }}>{r.wallet}</span>
              <span style={{ color:'#98a2b3' }}>#{r.rank}</span>
            </div>
          ))}
        </div>
      )}

      {open && !loading && items.length === 0 && (
        <div style={{
          position:'absolute', top:'110%', left:0, right:0, zIndex:50,
          background:'#0b1220', border:'1px solid #1d2a44', borderRadius:12,
          padding:'10px 12px', color:'#98a2b3'
        }}>
          No results
        </div>
      )}
    </div>
  )
}
