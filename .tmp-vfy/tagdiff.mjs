import fs from 'fs';
const strip = (s) => s
  .replace(/<script[\s\S]*?<\/script>/g, '<script></script>')
  .replace(/<style[\s\S]*?<\/style>/g, '<style></style>');
function tags(file) {
  const s = strip(fs.readFileSync(file, 'utf8'));
  const out = [];
  const re = /<([a-zA-Z][a-zA-Z0-9-]*)((?:"[^"]*"|'[^']*'|[^>"'])*)>/g;
  let m;
  while ((m = re.exec(s))) {
    const name = m[1].toLowerCase();
    const attrs = m[2];
    const cls = /class\s*=\s*"([^"]*)"/.exec(attrs)?.[1] ?? '';
    const clean = cls.split(/\s+/).filter((c) => c && !/^astro-/.test(c)).join('.');
    out.push(`${name}${clean ? '.' + clean : ''}`);
  }
  return out;
}
const a = tags(process.argv[2]), b = tags(process.argv[3]);
console.log('local open tags:', a.length, ' prod open tags:', b.length);
const count = (arr) => arr.reduce((m, x) => (m[x] = (m[x] || 0) + 1, m), {});
const ca = count(a), cb = count(b);
const keys = new Set([...Object.keys(ca), ...Object.keys(cb)]);
const rows = [];
for (const k of keys) if ((ca[k] || 0) !== (cb[k] || 0)) rows.push([k, ca[k] || 0, cb[k] || 0]);
rows.sort();
console.log('--- per-tag/class deltas (local vs prod) ---');
for (const [k, x, y] of rows) console.log(`${x > y ? '+' : '-'}${Math.abs(x - y)}  ${k}   local=${x} prod=${y}`);
