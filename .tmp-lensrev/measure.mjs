import { renderFrame, lensOffset, lensOffsetOld } from './port.mjs';
import { gateFor, tintBudget } from '../src/lib/skyLegibility.ts';

const W = 720, H = 450;           // 0.5x internal res of 1440x900
const VW = 1440;
const DOCH = 6000;                // homepage-ish
const uDepthSpan = 900 / DOCH;    // 0.15
const uYSpan = 900 / 1440;        // 0.625

function cfgFor({ variant, depth0, uTime, ptr, lens }) {
  const g = gateFor(1, variant);
  const b = tintBudget(variant);
  return {
    W, H, uTime,
    uYOffset: (depth0 * DOCH) / VW,
    uYSpan,
    uDepth0: depth0,
    uDepthSpan: variant === 'reading' ? 900 / 3000 : uDepthSpan,
    uGateTop: variant === 'reading' ? 0.0 : 0.45,
    uGateDark: g.dark, uGateLight: g.light,
    uReading: variant === 'reading' ? 1 : 0,
    uAmp: 1.8, uTintCap: b.cap, uViscousFloor: b.viscousFloor,
    ptr, lens,
  };
}

// pointer at screen centre-ish: uv.x = 0.5, sy = uYOffset + 0.5*uYSpan
function ptrAt(depth0, { presence = 1, speed = 0, R, A, fade, sat, on = true } = {}) {
  const uYOffset = (depth0 * DOCH) / VW;
  return { on, px: 0.5, py: uYOffset + 0.5 * uYSpan, presence, speed, R, A, fade, sat };
}

function stats(a, b, mask) {
  let peak = 0, sum = 0, n = 0;
  for (let i = 0; i < a.length; i += 3) {
    const p = i / 3;
    if (mask && !mask(p % W, Math.floor(p / W))) continue;
    let d = 0;
    for (let c = 0; c < 3; c++) d = Math.max(d, Math.abs(a[i + c] - b[i + c]));
    peak = Math.max(peak, d); sum += d; n++;
  }
  return { peak, mean: sum / n, n };
}

// footprint mask: disc of radius R (in sample units) around pointer, in internal px
function discMask(Rsample) {
  const Rx = Rsample * W;                    // x: 1 sample unit = full width
  return (x, y) => {
    const dx = (x + 0.5) / W - 0.5;
    const dy = ((H - 0.5 - y) / H - 0.5) * uYSpan;
    return Math.hypot(dx, dy) <= Rsample;
  };
}

const SCENES = [
  { name: 'hero      d=0.00', variant: 'descent', depth0: 0.00 },
  { name: 'interlude d=0.22', variant: 'descent', depth0: 0.22 },
  { name: 'mountains d=0.45', variant: 'descent', depth0: 0.45 },
  { name: 'ground    d=0.85', variant: 'descent', depth0: 0.85 },
  { name: 'reading   d=0.30', variant: 'reading', depth0: 0.30 },
];

console.log('=== AMBIENT CHURN (lens off), consecutive-frame and 250ms deltas ===');
const ambient = {};
for (const s of SCENES) {
  const off = ptrAt(s.depth0, { on: false });
  const f0 = renderFrame(cfgFor({ ...s, uTime: 8.0, ptr: off }));
  const f33 = renderFrame(cfgFor({ ...s, uTime: 8.0 + 0.033, ptr: off }));
  const f250 = renderFrame(cfgFor({ ...s, uTime: 8.25, ptr: off }));
  const m = discMask(0.085);
  const a33 = stats(f0, f33), a250 = stats(f0, f250);
  const a33d = stats(f0, f33, m), a250d = stats(f0, f250, m);
  ambient[s.name] = { f0, a33, a250, a33d, a250d };
  console.log(`${s.name}  frame(33ms): peak ${a33.peak.toFixed(1)} mean ${a33.mean.toFixed(2)} | 250ms: peak ${a250.peak.toFixed(1)} mean ${a250.mean.toFixed(2)}  || in-disc frame peak ${a33d.peak.toFixed(1)} mean ${a33d.mean.toFixed(2)} / 250ms peak ${a250d.peak.toFixed(1)}`);
}

console.log('\n=== PROPOSED LENS (R=0.085 A=0.16), still pointer, presence=1 ===');
for (const s of SCENES) {
  const base = ambient[s.name].f0;
  const on = renderFrame(cfgFor({ ...s, uTime: 8.0, ptr: ptrAt(s.depth0, { speed: 0 }) }));
  const m = discMask(0.085);
  const all = stats(base, on), disc = stats(base, on, m);
  const amb = ambient[s.name];
  console.log(`${s.name}  static peak ${all.peak.toFixed(1)} | in-disc peak ${disc.peak.toFixed(1)} mean ${disc.mean.toFixed(2)}  -> ratio vs ambient250 peak ${(disc.peak / amb.a250d.peak).toFixed(2)}, vs ambient-frame mean x${(disc.mean / amb.a33d.mean).toFixed(2)}`);
}

console.log('\n=== SHIPPED LENS TODAY (R=0.115, k^2*1.45) for reference ===');
for (const s of SCENES) {
  const base = ambient[s.name].f0;
  const on = renderFrame(cfgFor({ ...s, uTime: 8.0, ptr: ptrAt(s.depth0, {}), lens: lensOffsetOld }));
  const disc = stats(base, on, discMask(0.115));
  console.log(`${s.name}  in-disc peak ${disc.peak.toFixed(1)} mean ${disc.mean.toFixed(2)}`);
}

console.log('\n=== A SWEEP at R=0.085 (interlude + hero), still ===');
for (const s of [SCENES[0], SCENES[1], SCENES[2]]) {
  const base = ambient[s.name].f0;
  const row = [];
  for (const A of [0.05, 0.10, 0.16, 0.22, 0.30, 0.60, 1.45]) {
    const on = renderFrame(cfgFor({ ...s, uTime: 8.0, ptr: ptrAt(s.depth0, { A }) }));
    const d = stats(base, on, discMask(0.085));
    row.push(`A=${A}: pk ${d.peak.toFixed(1)}/mn ${d.mean.toFixed(2)}`);
  }
  console.log(`${s.name}  ${row.join('  ')}`);
}

console.log('\n=== R SWEEP at A=0.16 (interlude) ===');
{
  const s = SCENES[1]; const base = ambient[s.name].f0;
  const row = [];
  for (const R of [0.045, 0.055, 0.085, 0.12, 0.17, 0.24]) {
    const on = renderFrame(cfgFor({ ...s, uTime: 8.0, ptr: ptrAt(s.depth0, { R }) }));
    const d = stats(base, on, discMask(R));
    row.push(`R=${R} (${Math.round(R * 1440)}px): pk ${d.peak.toFixed(1)}/mn ${d.mean.toFixed(2)}`);
  }
  console.log(row.join('\n  '));
}
