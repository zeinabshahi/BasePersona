// lib/db.ts
import 'server-only';

// Load only on the server; avoid TS typing for better-sqlite3
let BetterSqlite3: any;
if (typeof window === 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  BetterSqlite3 = require('better-sqlite3');
} else {
  // This module is not supposed to run on the client
  throw new Error('lib/db.ts must be used on the server only.');
}

let _db: any = null;
export const DB_PATH = process.env.WALLETS_DB || 'data/wallets.sqlite';

export function getDb() {
  if (!_db) {
    // keep your settings: readonly=false + WAL
    _db = new BetterSqlite3(DB_PATH, { readonly: false });
    _db.pragma('journal_mode = WAL');
  }
  return _db;
}
