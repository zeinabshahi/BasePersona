import Database from 'better-sqlite3'

let _db: Database.Database | null = null
export const DB_PATH = process.env.WALLETS_DB || 'data/wallets.sqlite'

export function getDb(): Database.Database {
  if (!_db) {
    _db = new Database(DB_PATH, { readonly: false })
    _db.pragma('journal_mode = WAL')
  }
  return _db
}
