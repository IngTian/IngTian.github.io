const SQRT3_2 = Math.sqrt(3) / 2;
const SIMPLEX = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0.5, y: SQRT3_2 }];
const toPlane = (w) => ({ x: w[1] + 0.5 * w[2], y: w[2] * SQRT3_2 });
const toWeights = (p) => { const w3 = p.y / SQRT3_2, w2 = p.x - 0.5 * w3; return [1 - w2 - w3, w2, w3]; };
const toHalfPlane = (c) => { const [a1, a2, a3] = c.a, i = 1 / Math.sqrt(3);
  return { nx: -a1 + a2, ny: -a1 * i - a2 * i + a3 * 2 * i, cc: c.b - a1 }; };
const slack = (p, c) => { const h = toHalfPlane(c); return h.nx * p.x + h.ny * p.y - h.cc; };
function dedupe(poly) { const out = []; for (const p of poly) { const l = out[out.length - 1];
  if (!l || Math.hypot(l.x - p.x, l.y - p.y) > 1e-9) out.push(p); }
  if (out.length > 1) { const f = out[0], l = out[out.length - 1]; if (Math.hypot(f.x - l.x, f.y - l.y) < 1e-9) out.pop(); } return out; }
function clip(poly, c) { if (!poly.length) return []; const out = [];
  for (let i = 0; i < poly.length; i++) { const cur = poly[i], nx = poly[(i + 1) % poly.length];
    const sc = slack(cur, c), sn = slack(nx, c), ic = sc <= 1e-12, iN = sn <= 1e-12;
    if (ic) out.push(cur);
    if (ic !== iN) { const t = sc / (sc - sn); out.push({ x: cur.x + (nx.x - cur.x) * t, y: cur.y + (nx.y - cur.y) * t }); } }
  return dedupe(out); }
const area = (poly) => { if (poly.length < 3) return 0; let s = 0;
  for (let i = 0; i < poly.length; i++) { const a = poly[i], b = poly[(i + 1) % poly.length]; s += a.x * b.y - b.x * a.y; }
  return Math.abs(s) / 2; };
const centroid = (poly) => { let x = 0, y = 0; for (const p of poly) { x += p.x; y += p.y; } return { x: x / poly.length, y: y / poly.length }; };
const clipAll = (poly, cs) => cs.reduce((p, c) => clip(p, c), poly);
const WHOLE = area(SIMPLEX);

const GOLD_FLOOR = (v) => ({ label: `Gold>=${v}`, a: [0, 0, -1], b: -v });
const NV_MIN = (v) => ({ label: `NVDA>=${v}`, a: [-1, 0, 0], b: -v });
const NV_MAX = (v) => ({ label: `NVDA<=${v}`, a: [1, 0, 0], b: v });
const BAC_MAX = (v) => ({ label: `BAC<=${v}`, a: [0, 1, 0], b: v });

const ROWS = [
  { key: 'frame', you: [], fund: [] },
  { key: 'safe', you: [GOLD_FLOOR(0.20)], fund: [GOLD_FLOOR(0.35)] },
  { key: 'band', you: [NV_MIN(0.04), NV_MAX(0.44)], fund: [NV_MIN(0.16), NV_MAX(0.32)] },
  { key: 'caps', you: [], fund: [NV_MAX(0.30), BAC_MAX(0.25)] },
];

let youAcc = [], fundAcc = [];
console.log('step   you-left you-cut  fund-left fund-cut verts');
for (const r of ROWS) {
  const yB = clipAll(SIMPLEX, youAcc), fB = clipAll(SIMPLEX, fundAcc);
  youAcc = youAcc.concat(r.you); fundAcc = fundAcc.concat(r.fund);
  const yA = clipAll(SIMPLEX, youAcc), fA = clipAll(SIMPLEX, fundAcc);
  console.log(r.key.padEnd(6),
    (area(yA) / WHOLE * 100).toFixed(2).padStart(8),
    ((area(yB) - area(yA)) / WHOLE * 100).toFixed(2).padStart(7),
    (area(fA) / WHOLE * 100).toFixed(2).padStart(9),
    ((area(fB) - area(fA)) / WHOLE * 100).toFixed(2).padStart(8),
    ' ', yA.length, fA.length);
}
const yF = clipAll(SIMPLEX, youAcc), fF = clipAll(SIMPLEX, fundAcc);
console.log('\nYOU  final %', (area(yF) / WHOLE * 100).toFixed(2), 'verts', yF.length, 'centroid', toWeights(centroid(yF)).map((v) => (v * 100).toFixed(1)));
console.log('FUND final %', (area(fF) / WHOLE * 100).toFixed(2), 'verts', fF.length, 'centroid', toWeights(centroid(fF)).map((v) => (v * 100).toFixed(1)));
console.log('fund as share of YOURS %', (area(fF) / area(yF) * 100).toFixed(2));
console.log('fund set nested in yours:', fF.every((p) => youAcc.every((c) => slack(p, c) <= 1e-9)));

const WANT = [0.40, 0.30, 0.30];
console.log('\nWANT 40/30/30 legal for you:', youAcc.every((c) => slack(toPlane(WANT), c) <= 1e-9));
console.log('fund rules it breaks:', fundAcc.filter((c) => slack(toPlane(WANT), c) > 1e-9).map((c) => c.label));
console.log('fund rule count:', fundAcc.length, fundAcc.map((c) => c.label).join(' '));

const reweightCost = (f, spreadBp = 2, impactBp = 35, part = 0.1) => (spreadBp / 10000) * f + (impactBp / 10000) * Math.sqrt(part) * f;
const move = 0.20;
console.log('\n-- 20-point reweight --');
console.log('you  4,000 @ part 0   :', (reweightCost(move, 2, 35, 0) * 4000).toFixed(4), 'bp', (reweightCost(move, 2, 35, 0) * 10000).toFixed(2));
console.log('fund 1e9  @ part 0.10 :', (reweightCost(move, 2, 35, 0.10) * 1e9).toFixed(0), 'bp', (reweightCost(move, 2, 35, 0.10) * 10000).toFixed(2));
console.log('ratio per dollar', (reweightCost(move, 2, 35, 0.10) / reweightCost(move, 2, 35, 0)).toFixed(2));
