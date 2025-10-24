// ui/components/Header.tsx
import dynamic from 'next/dynamic'
const ConnectWallet = dynamic(() => import('./ConnectWallet'), { ssr: false })
import GmButton from './gm/GmButton'
import GmBadgeBar from './gm/GmBadgeBar'

const LOGO_HEIGHT = 56 // بزرگ‌تر از قبل

export default function Header() {
  const gmContract =
    (process.env.NEXT_PUBLIC_BM_STREAK1155 as `0x${string}` | undefined) ||
    (process.env.NEXT_PUBLIC_GM_CONTRACT as `0x${string}` | undefined)

  return (
    <header className="header" role="banner">
      <div className="headerInner">
        <a
          className="brandMark"
          href="/"
          aria-label="Base Persona"
          style={{ display: 'inline-flex', alignItems: 'center' }}
        >
          <img
            src="/logo2.png"                // ← اگر PNG داری: "/logo.png"
            alt="Base Persona"
            style={{ height: LOGO_HEIGHT, width: 'auto', display: 'block' }}
            onError={(e)=>{ (e.currentTarget as HTMLImageElement).src = '/logo.png' }}
          />
        </a>

        <div className="grow" />
        <div className="row center" style={{ gap: 8 }}>
          <GmBadgeBar contract={gmContract} />
          <GmButton contract={gmContract} />
          <ConnectWallet />
        </div>
      </div>
    </header>
  )
}
