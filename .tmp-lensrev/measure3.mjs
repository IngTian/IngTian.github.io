import { renderFrame, lensOffset } from './port.mjs';
import { gateFor, tintBudget } from '../src/lib/skyLegibility.ts';

const W = 720, H = 450, VW = 1440, DOCH = 6000;
const uYSpan = 900 / 1440;
function cfgFor({ variant, depth0, uTime, ptr, uDark = 0 }) {
  const g = gateFor(1, variant), b = tintBudget(variant);
  return {
    W, H, uTime, uYOffset: (depth0 * DOCH) / VW, uYSpan, uDepth0: depth0,
    uDepthSpan: variant === 'reading' ? 900 / 3000 : 900 / DOCH,
    uGateTop: variant === 'reading' ? 0.0 : 0.45,
    uGateDark: g.dark, uGateLight: g.light,
    uReading: variant === 'reading' ? 1 : 0,
    uAmp: 1.8, uTintCap: b.cap, uViscousFloor: b.viscousFloor, uDark, ptr,
  };
}
function ptrAt(depth0, o = {}) {
  return { on: o.on ?? true, px: o.px ?? 0.5, py: (depth0 * DOCH) / VW + 0.5 * uYSpan + (o.dy ?? 0), presence: o.presence ?? 1, speed: o.speed ?? 0, R: o.R, A: o.A, fade: o.fade, sat: o.sat };
}
function radiusOf(x, y, px = 0.5) {
  const dx = (x + 0.5) / W - px;
  const dy = ((H - 0.5 - y) / H - 0.5) * uYSpan;
  return Math.hypot(dx, dy);
}
function chanDelta(a, b, i) { let d = 0; for (let c = 0; c < 3; c++) d = Math.max(d, Math.abs(a[i + c] - b[i + c])); return d; }

const IL = { variant: 'descent', depth0: 0.22 }, MT = { variant: 'descent', depth0: 0.45 }, HR = { variant: 'descent', depth0: 0.00 };

console.log('### A. RADIAL PROFILE of the delta — is the change an ANNULUS? (interlude, R=0.085 A=0.16) ###\n');
{
  const off = renderFrame(cfgFor({ ...IL, uTime: 8.0, ptr: ptrAt(IL.depth0, { on: false }) }));
  const on = renderFrame(cfgFor({ ...IL, uTime: 8.0, ptr: ptrAt(IL.depth0, {}) }));
  const R = 0.085, NB = 12;
  const bins = Array.from({ length: NB }, () => ({ s: 0, n: 0, mx: 0 }));
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const u = radiusOf(x, y) / R;
    if (u >= 1.2) continue;
    const bi = Math.min(NB - 1, Math.floor(u / 1.2 * NB));
    const d = chanDelta(off, on, (y * W + x) * 3);
    bins[bi].s += d; bins[bi].n++; bins[bi].mx = Math.max(bins[bi].mx, d);
  }
  console.log('  u-band      mean|d|   max|d|   (peak DISPLACEMENT is at u=0.378)');
  bins.forEach((b, i) => {
    const lo = (i / NB * 1.2).toFixed(2), hi = ((i + 1) / NB * 1.2).toFixed(2);
    console.log(`  ${lo}-${hi}     ${(b.s / b.n).toFixed(2)}      ${b.mx.toFixed(1)}`);
  });
}

console.log('\n### B. MOVING pointer: per-frame (33ms) delta, the actual perceptual signal ###\n');
{
  // pointer sweeping horizontally at 430px/s -> 0.299 su/s; A_eff = 0.123
  for (const S of [HR, IL, MT]) {
    const dxFrame = (430 / VW) * 0.033;
    const t0 = 8.0, t1 = 8.033;
    const offA = renderFrame(cfgFor({ ...S, uTime: t0, ptr: ptrAt(S.depth0, { on: false }) }));
    const offB = renderFrame(cfgFor({ ...S, uTime: t1, ptr: ptrAt(S.depth0, { on: false }) }));
    const onA = renderFrame(cfgFor({ ...S, uTime: t0, ptr: ptrAt(S.depth0, { px: 0.5, A: 0.16, speed: 0.299 }) }));
    const onB = renderFrame(cfgFor({ ...S, uTime: t1, ptr: ptrAt(S.depth0, { px: 0.5 + dxFrame, A: 0.16, speed: 0.299 }) }));
    const mask = (x, y) => radiusOf(x, y) <= 0.085;
    const st = (a, b) => {
      let mx = 0, s = 0, n = 0;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        if (!mask(x, y)) continue;
        const d = chanDelta(a, b, (y * W + x) * 3); mx = Math.max(mx, d); s += d; n++;
      }
      return { mx, mean: s / n };
    };
    const amb = st(offA, offB), lens = st(onA, onB);
    console.log(`  d=${S.depth0.toFixed(2)}  ambient frame: max ${amb.mx.toFixed(1)} mean ${amb.mean.toFixed(3)}  |  MOVING LENS frame: max ${lens.mx.toFixed(1)} mean ${lens.mean.toFixed(3)}  -> x${(lens.mean / amb.mean).toFixed(2)} mean, +${(lens.mx - amb.mx).toFixed(1)} peak`);
  }
}

console.log('\n### C. R vs A trade — SAME peak displacement, SMALLER footprint? ###\n');
{
  // peak displacement px = R*0.378*A*0.6297*1440
  const pd = (R, A) => R * 0.378 * A * 0.6297 * 1440;
  const combos = [[0.085, 0.16], [0.065, 0.209], [0.050, 0.272], [0.040, 0.340], [0.030, 0.453]];
  const off = renderFrame(cfgFor({ ...IL, uTime: 8.0, ptr: ptrAt(IL.depth0, { on: false }) }));
  const offM = renderFrame(cfgFor({ ...MT, uTime: 8.0, ptr: ptrAt(MT.depth0, { on: false }) }));
  for (const [R, A] of combos) {
    const on = renderFrame(cfgFor({ ...IL, uTime: 8.0, ptr: ptrAt(IL.depth0, { R, A }) }));
    const onM = renderFrame(cfgFor({ ...MT, uTime: 8.0, ptr: ptrAt(MT.depth0, { R, A }) }));
    const st = (a, b, Rm) => {
      let mx = 0, s = 0, n = 0;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        if (radiusOf(x, y) > Rm) continue;
        const d = chanDelta(a, b, (y * W + x) * 3); mx = Math.max(mx, d); s += d; n++;
      }
      return { mx, mean: s / n, area: n / (W * H) * 100 };
    };
    const i = st(off, on, R), m = st(offM, onM, R);
    console.log(`  R=${R.toFixed(3)} (${Math.round(R * 1440)}px, ${i.area.toFixed(1)}% vp) A=${A.toFixed(3)}  peakDisp ${pd(R, A).toFixed(2)}px  | interlude pk ${i.mx.toFixed(1)} mn ${i.mean.toFixed(2)} | mountains pk ${m.mx.toFixed(1)} mn ${m.mean.toFixed(2)}`);
  }
}

console.log('\n### D. READING page: is A saturated by the min(y,depth) guard? ###\n');
{
  const S = { variant: 'reading', depth0: 0.30 };
  const off = renderFrame(cfgFor({ ...S, uTime: 8.0, ptr: ptrAt(S.depth0, { on: false }) }));
  for (const A of [0.05, 0.12, 0.16, 0.20, 0.40, 0.80]) {
    const on = renderFrame(cfgFor({ ...S, uTime: 8.0, ptr: ptrAt(S.depth0, { A }) }));
    let mx = 0, s = 0, n = 0;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (radiusOf(x, y) > 0.085 * 0.62) continue;
      const d = chanDelta(off, on, (y * W + x) * 3); mx = Math.max(mx, d); s += d; n++;
    }
    console.log(`  A=${A.toFixed(2)}  in-disc peak ${mx.toFixed(1)} mean ${s / n < 0.005 ? '0.00' : (s / n).toFixed(3)}`);
  }
}

console.log('\n### E. SCROLL DETACHMENT: lens anchored in sample space, rawY only set on pointermove ###\n');
{
  // scroll 400px with a stationary mouse -> lens sits 400px above the cursor on screen
  const off = renderFrame(cfgFor({ ...IL, uTime: 8.0, ptr: ptrAt(IL.depth0, { on: false }) }));
  for (const scrollPx of [0, 200, 400]) {
    const dy = -scrollPx / VW;  // ptr.y stale => appears offset in sample y
    const on = renderFrame(cfgFor({ ...IL, uTime: 8.0, ptr: ptrAt(IL.depth0, { dy }) }));
    let mx = 0;
    for (let i = 0; i < off.length; i += 3) mx = Math.max(mx, chanDelta(off, on, i));
    console.log(`  scrolled ${scrollPx}px with stationary mouse: lens centre is ${scrollPx}px (${(scrollPx / 122).toFixed(2)}R) from the cursor; still visible peak ${mx.toFixed(1)}`);
  }
}
