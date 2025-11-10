// lib/db.ts
// Dynamic require for server-only usage inside pages/api/*
let BetterSqlite3: any = null;
if (typeof window === 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  try { BetterSqlite3 = require('better-sqlite3'); } catch {}
}

let _db: any = null;
export const DB_PATH = process.env.WALLETS_DB || 'data/wallets.sqlite';

export function getDb() {
  if (typeof window !== 'undefined') {
    throw new Error('getDb() is server-only.');
  }
  if (!BetterSqlite3) {
    throw new Error('better-sqlite3 is not available in this environment.');
  }
  if (!_db) {
    _db = new BetterSqlite3(DB_PATH, { readonly: false });
    try { _db.pragma('journal_mode = WAL'); } catch {}
  }
  return _db;
}
