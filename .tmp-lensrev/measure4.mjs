import { renderFrame } from './port.mjs';
import { gateFor, tintBudget } from '../src/lib/skyLegibility.ts';
const W = 720, H = 450, VW = 1440, DOCH = 6000, uYSpan = 900 / 1440;
function cfgFor({ variant, depth0, uTime, ptr, uDark = 0 }) {
  const g = gateFor(1, variant), b = tintBudget(variant);
  return { W, H, uTime, uYOffset: (depth0 * DOCH) / VW, uYSpan, uDepth0: depth0,
    uDepthSpan: variant === 'reading' ? 900 / 3000 : 900 / DOCH,
    uGateTop: variant === 'reading' ? 0.0 : 0.45, uGateDark: g.dark, uGateLight: g.light,
    uReading: variant === 'reading' ? 1 : 0, uAmp: 1.8, uTintCap: b.cap, uViscousFloor: b.viscousFloor, uDark, ptr };
}
const ptrAt = (d0, o = {}) => ({ on: o.on ?? true, px: 0.5, py: (d0 * DOCH) / VW + 0.5 * uYSpan, presence: 1, speed: o.speed ?? 0, R: o.R, A: o.A });
const rad = (x, y) => Math.hypot((x + 0.5) / W - 0.5, ((H - 0.5 - y) / H - 0.5) * uYSpan);
const cd = (a, b, i) => { let d = 0; for (let c = 0; c < 3; c++) d = Math.max(d, Math.abs(a[i + c] - b[i + c])); return d; };
function st(a, b, Rm) { let mx = 0, s = 0, n = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { if (rad(x, y) > Rm) continue;
    const d = cd(a, b, (y * W + x) * 3); mx = Math.max(mx, d); s += d; n++; }
  return { mx, mean: s / n, area: n / (W * H) * 100 }; }

const SC = [
  { name: 'hero      d=0.00', variant: 'descent', depth0: 0.00 },
  { name: 'interlude d=0.22', variant: 'descent', depth0: 0.22 },
  { name: 'mountains d=0.45', variant: 'descent', depth0: 0.45 },
];
const pd = (R, A) => R * 0.378 * A * 0.6297 * 1440;

console.log('MATCHED-DISC comparison: lens static delta vs ambient 250ms delta in the SAME disc\n');
for (const [R, A] of [[0.085, 0.16], [0.065, 0.209], [0.055, 0.247], [0.045, 0.302]]) {
  console.log(`--- R=${R} (${Math.round(R * 1440)}px rad, ${(Math.PI * (R * 1440) ** 2 / (1440 * 900) * 100).toFixed(1)}% vp) A=${A}  peakDisp ${pd(R, A).toFixed(2)}px`);
  for (const s of SC) {
    const off = renderFrame(cfgFor({ ...s, uTime: 8.0, ptr: ptrAt(s.depth0, { on: false }) }));
    const off250 = renderFrame(cfgFor({ ...s, uTime: 8.25, ptr: ptrAt(s.depth0, { on: false }) }));
    const on = renderFrame(cfgFor({ ...s, uTime: 8.0, ptr: ptrAt(s.depth0, { R, A }) }));
    const amb = st(off, off250, R), len = st(off, on, R);
    console.log(`    ${s.name}  ambient250 pk ${amb.mx.toFixed(1)} mn ${amb.mean.toFixed(2)}  |  lens pk ${len.mx.toFixed(1)} mn ${len.mean.toFixed(2)}  -> pk ratio ${(len.mx / amb.mx).toFixed(2)}, mn ratio ${(len.mean / amb.mean).toFixed(2)}`);
  }
}
