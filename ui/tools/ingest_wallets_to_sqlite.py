#!/usr/bin/env python3
import argparse, sqlite3, json, sys, time
from pathlib import Path

DDL = """
PRAGMA journal_mode=WAL;
PRAGMA synchronous=NORMAL;
CREATE TABLE IF NOT EXISTS wallet_doc (
  wallet        TEXT PRIMARY KEY,
  rank          INTEGER NOT NULL,
  lifetime_json TEXT    NOT NULL,
  months_json   TEXT    NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_wallet_rank ON wallet_doc(rank);
"""

def ensure_db(conn):
    conn.executescript(DDL)
    conn.commit()

def insert_many(conn, batch):
    conn.executemany(
        "INSERT OR REPLACE INTO wallet_doc(wallet,rank,lifetime_json,months_json) VALUES(?,?,?,?)",
        batch
    )
    conn.commit()

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--in", required=True, dest="inp", help="input .jsonl (each line = a wallet doc)")
    ap.add_argument("--out", default="data/wallets.sqlite")
    ap.add_argument("--commit-every", type=int, default=5000)
    args = ap.parse_args()

    inpath = Path(args.inp)
    out    = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)

    conn = sqlite3.connect(str(out))
    ensure_db(conn)

    t0 = time.time()
    total = 0
    batch = []

    with inpath.open("r", encoding="utf-8") as f:
        for ln, line in enumerate(f, 1):
            line = line.strip()
            if not line: continue
            try:
                obj = json.loads(line)
            except Exception as e:
                print(f"[warn] line {ln} parse error: {e}", file=sys.stderr)
                continue

            w = str(obj.get("wallet","")).lower()
            if not (w.startswith("0x") and len(w)==42): 
                continue
            rank     = int(obj.get("rank", 0) or 0)
            lifetime = obj.get("lifetime", {})
            months   = obj.get("months", {})
            batch.append((w, rank, json.dumps(lifetime, separators=(',',':')), json.dumps(months, separators=(',',':'))))

            if len(batch) >= args.commit_every:
                insert_many(conn, batch)
                total += len(batch)
                batch.clear()
                print(f"[ingest] {total} rows...", file=sys.stderr)

    if batch:
        insert_many(conn, batch)
        total += len(batch)

    print(f"[done] inserted {total} wallets in {time.time()-t0:.1f}s → {out}")

if __name__ == "__main__":
    main()
