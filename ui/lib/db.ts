// lib/db.ts
// NOTE: Use this ONLY from API routes or other server-side code (pages/api/*, getServerSideProps).
// Do not import from client components.

let BetterSqlite3: any = null

// Try to resolve the native module in Node. In client bundles this stays null.
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  BetterSqlite3 = require('better-sqlite3')
} catch {
  // ignored on non-Node environments during build scanning
}

let _db: any = null
export const DB_PATH = process.env.WALLETS_DB || 'data/wallets.sqlite'

export function getDb() {
  // Safety guard: never allow usage on the client
  if (typeof window !== 'undefined') {
    throw new Error('getDb() must be called on the server (API routes / server-side only).')
  }

  if (!_db) {
    if (!BetterSqlite3) {
      // Lazy require in case the first attempt was skipped by bundler
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      BetterSqlite3 = require('better-sqlite3')
    }
    _db = new BetterSqlite3(DB_PATH, { readonly: false })
    try { _db.pragma('journal_mode = WAL') } catch {}
  }
  return _db
}
