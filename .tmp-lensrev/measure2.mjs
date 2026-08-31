import { renderFrame, lensOffset, lensOffsetOld } from './port.mjs';
import { gateFor, tintBudget, wcagLuminance, contrastRatio } from '../src/lib/skyLegibility.ts';

const W = 720, H = 450, VW = 1440, DOCH = 6000;
const uYSpan = 900 / 1440;

function cfgFor({ variant, depth0, uTime, ptr, lens, uDark = 0 }) {
  const g = gateFor(1, variant), b = tintBudget(variant);
  return {
    W, H, uTime,
    uYOffset: (depth0 * DOCH) / VW, uYSpan,
    uDepth0: depth0,
    uDepthSpan: variant === 'reading' ? 900 / 3000 : 900 / DOCH,
    uGateTop: variant === 'reading' ? 0.0 : 0.45,
    uGateDark: g.dark, uGateLight: g.light,
    uReading: variant === 'reading' ? 1 : 0,
    uAmp: 1.8, uTintCap: b.cap, uViscousFloor: b.viscousFloor, uDark,
    ptr, lens,
  };
}
function ptrAt(depth0, o = {}) {
  const uYOffset = (depth0 * DOCH) / VW;
  return { on: o.on ?? true, px: o.px ?? 0.5, py: uYOffset + 0.5 * uYSpan, presence: o.presence ?? 1, speed: o.speed ?? 0, R: o.R, A: o.A, fade: o.fade, sat: o.sat };
}
function discMask(Rs) {
  return (x, y) => {
    const dx = (x + 0.5) / W - 0.5;
    const dy = ((H - 0.5 - y) / H - 0.5) * uYSpan;
    return Math.hypot(dx, dy) <= Rs;
  };
}
function deltas(a, b, mask) {
  const arr = [];
  for (let i = 0; i < a.length; i += 3) {
    const p = i / 3;
    if (mask && !mask(p % W, Math.floor(p / W))) continue;
    let d = 0; for (let c = 0; c < 3; c++) d = Math.max(d, Math.abs(a[i + c] - b[i + c]));
    arr.push(d);
  }
  arr.sort((x, y) => x - y);
  const q = (p) => arr[Math.min(arr.length - 1, Math.floor(p * arr.length))];
  return { n: arr.length, mean: arr.reduce((s, v) => s + v, 0) / arr.length, p50: q(0.5), p90: q(0.9), p99: q(0.99), p999: q(0.999), max: arr[arr.length - 1] };
}
const fmt = (d) => `mean ${d.mean.toFixed(2)} p50 ${d.p50.toFixed(1)} p90 ${d.p90.toFixed(1)} p99 ${d.p99.toFixed(1)} p99.9 ${d.p999.toFixed(1)} max ${d.max.toFixed(1)}`;

const SCENES = [
  { name: 'hero      d=0.00', variant: 'descent', depth0: 0.00 },
  { name: 'interlude d=0.22', variant: 'descent', depth0: 0.22 },
  { name: 'mountains d=0.45', variant: 'descent', depth0: 0.45 },
  { name: 'ground    d=0.85', variant: 'descent', depth0: 0.85 },
  { name: 'reading   d=0.30', variant: 'reading', depth0: 0.30 },
];

console.log('### 1. IN-DISC distributions, matched R=0.085 mask ###\n');
for (const s of SCENES) {
  const off = ptrAt(s.depth0, { on: false });
  const f0 = renderFrame(cfgFor({ ...s, uTime: 8.0, ptr: off }));
  const f33 = renderFrame(cfgFor({ ...s, uTime: 8.033, ptr: off }));
  const f250 = renderFrame(cfgFor({ ...s, uTime: 8.25, ptr: off }));
  const on = renderFrame(cfgFor({ ...s, uTime: 8.0, ptr: ptrAt(s.depth0, {}) }));
  const m = discMask(0.085);
  console.log(s.name);
  console.log(`  ambient 33ms : ${fmt(deltas(f0, f33, m))}`);
  console.log(`  ambient 250ms: ${fmt(deltas(f0, f250, m))}`);
  console.log(`  LENS static  : ${fmt(deltas(f0, on, m))}`);
  // temporal: lens present at both frames, pointer still -> is there extra motion?
  const on33 = renderFrame(cfgFor({ ...s, uTime: 8.033, ptr: ptrAt(s.depth0, {}) }));
  console.log(`  lens-on 33ms : ${fmt(deltas(on, on33, m))}   (temporal churn WITH lens)`);
  console.log('');
}

console.log('### 2. DARK THEME (descent dark ramp + nebula) ###\n');
for (const s of [SCENES[0], SCENES[1], SCENES[2]]) {
  const off = ptrAt(s.depth0, { on: false });
  const f0 = renderFrame(cfgFor({ ...s, uTime: 8.0, ptr: off, uDark: 1 }));
  const f250 = renderFrame(cfgFor({ ...s, uTime: 8.25, ptr: off, uDark: 1 }));
  const on = renderFrame(cfgFor({ ...s, uTime: 8.0, ptr: ptrAt(s.depth0, {}), uDark: 1 }));
  const m = discMask(0.085);
  console.log(`${s.name} DARK  ambient250 ${fmt(deltas(f0, f250, m))}`);
  console.log(`${s.name} DARK  LENS      ${fmt(deltas(f0, on, m))}`);
}

console.log('\n### 3. HIGH-FREQUENCY ENERGY inside the disc (magnify should LOWER it) ###\n');
function hfEnergy(img, mask) {
  let s = 0, n = 0;
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    if (mask && !mask(x, y)) continue;
    const i = (y * W + x) * 3;
    const gx = img[i + 3] - img[i - 3], gy = img[i + W * 3] - img[i - W * 3];
    s += Math.hypot(gx, gy); n++;
  }
  return s / n;
}
for (const s of [SCENES[1], SCENES[2]]) {
  const m = discMask(0.06);
  const f0 = renderFrame(cfgFor({ ...s, uTime: 8.0, ptr: ptrAt(s.depth0, { on: false }) }));
  const mag = renderFrame(cfgFor({ ...s, uTime: 8.0, ptr: ptrAt(s.depth0, {}) }));
  const pinch = renderFrame(cfgFor({ ...s, uTime: 8.0, ptr: ptrAt(s.depth0, { A: -0.16 }) }));
  console.log(`${s.name}  |grad| off ${hfEnergy(f0, m).toFixed(2)}  magnify ${hfEnergy(mag, m).toFixed(2)} (${((hfEnergy(mag, m) / hfEnergy(f0, m) - 1) * 100).toFixed(1)}%)  pinch ${hfEnergy(pinch, m).toFixed(2)} (${((hfEnergy(pinch, m) / hfEnergy(f0, m) - 1) * 100).toFixed(1)}%)`);
}

console.log('\n### 4. FEATURE SCALE of f (autocorrelation half-width) ###\n');
{
  const s = SCENES[1];
  const cfg = cfgFor({ ...s, uTime: 8.0, ptr: ptrAt(s.depth0, { on: false }) });
  // sample f on a line
  const { fbm } = await import('./port.mjs');
  const fieldAt = (vux, sy) => {
    const px = vux * 6.2, py = sy * 12.7;
    const qx = fbm(px + 0.09 * 4.4, py + 0.09 * 4.4), qy = fbm(px + 5.2 - 0.07 * 4.4, py + 1.3 - 0.07 * 4.4);
    const rx = fbm(px + 3.4 * qx + 1.7 + 0.055 * 4.4, py + 3.4 * qy + 9.2 + 0.055 * 4.4);
    const ry = fbm(px + 3.4 * qx + 8.3 - 0.048 * 4.4, py + 3.4 * qy + 2.8 - 0.048 * 4.4);
    return fbm(px + 3.2 * rx, py + 3.2 * ry);
  };
  const N = 2000, sy0 = cfg.uYOffset + 0.3;
  const xs = [], ys = [];
  for (let i = 0; i < N; i++) { xs.push(fieldAt(i / N, sy0)); ys.push(fieldAt(0.37, sy0 + (i / N) * uYSpan)); }
  const ac = (a, lag) => {
    const n = a.length - lag, mu = a.reduce((s, v) => s + v, 0) / a.length;
    let num = 0, den = 0;
    for (let i = 0; i < n; i++) num += (a[i] - mu) * (a[i + lag] - mu);
    for (let i = 0; i < a.length; i++) den += (a[i] - mu) ** 2;
    return num / den * (a.length / n);
  };
  let hx = 0; for (let l = 1; l < 400; l++) if (ac(xs, l) < 0.5) { hx = l; break; }
  let hy = 0; for (let l = 1; l < 400; l++) if (ac(ys, l) < 0.5) { hy = l; break; }
  console.log(`  x: autocorr 0.5 at ${(hx / N * 1440).toFixed(0)}px   y: at ${(hy / N * uYSpan * 1440).toFixed(0)}px  (proposal claimed 58 / 50)`);
  // sensitivity: how much does f change for a 4.7px shift?
  let acc = 0, mx = 0;
  for (let k = 0; k < 400; k++) {
    const vx = 0.2 + 0.6 * (k / 400);
    const a = fieldAt(vx, sy0), b = fieldAt(vx + 4.66 / 1440, sy0);
    acc += Math.abs(a - b); mx = Math.max(mx, Math.abs(a - b));
  }
  console.log(`  |df| for a 4.66px x-shift: mean ${(acc / 400).toFixed(4)}  max ${mx.toFixed(4)}`);
}

console.log('\n### 5. WORST-CASE CONTRAST, paper text on descent sky, lens on vs off ###\n');
{
  const PAPER = [0xef, 0xe9, 0xdd], INK3D = [0x8b, 0x93, 0x8c];
  const Lp = wcagLuminance(PAPER);
  for (const s of [SCENES[1], SCENES[2], SCENES[3]]) {
    for (const [tag, dk] of [['light', 0], ['dark', 1]]) {
      const off = renderFrame(cfgFor({ ...s, uTime: 8.0, ptr: ptrAt(s.depth0, { on: false }), uDark: dk }));
      const on = renderFrame(cfgFor({ ...s, uTime: 8.0, ptr: ptrAt(s.depth0, {}), uDark: dk }));
      const worst = (img) => {
        let w = Infinity;
        const txt = dk ? wcagLuminance(INK3D) : Lp;
        for (let i = 0; i < img.length; i += 3) {
          const c = contrastRatio(txt, wcagLuminance([img[i], img[i + 1], img[i + 2]]));
          if (c < w) w = c;
        }
        return w;
      };
      console.log(`  ${s.name} ${tag}: worst contrast off ${worst(off).toFixed(2)} : on ${worst(on).toFixed(2)}`);
    }
  }
}
