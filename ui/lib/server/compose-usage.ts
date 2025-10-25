import fs from "fs";
import path from "path";

const DIR = path.join(process.cwd(), "data");
const FILE = path.join(DIR, "compose-usage.json");

type UsageMap = Record<string, number>; // key = `${date}:${user}` , value = usedCount

function ensure() {
  if (!fs.existsSync(DIR)) fs.mkdirSync(DIR, { recursive: true });
  if (!fs.existsSync(FILE)) fs.writeFileSync(FILE, "{}", "utf-8");
}

export function loadUsage(): UsageMap {
  try {
    ensure();
    const txt = fs.readFileSync(FILE, "utf-8");
    return JSON.parse(txt || "{}");
  } catch {
    return {};
  }
}

export function saveUsage(m: UsageMap) {
  ensure();
  fs.writeFileSync(FILE, JSON.stringify(m, null, 2), "utf-8");
}

export function usedTodayFor(user: string) {
  const map = loadUsage();
  const key = makeKey(user);
  return map[key] || 0;
}

export function incToday(user: string) {
  const map = loadUsage();
  const key = makeKey(user);
  map[key] = (map[key] || 0) + 1;
  saveUsage(map);
}

function makeKey(user: string) {
  const d = new Date().toISOString().slice(0, 10); // UTC date
  return `${d}:${user.toLowerCase()}`;
}
