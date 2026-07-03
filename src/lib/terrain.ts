// Pure math/geometry for the terrain hero. Verified against brute force in the
// spike: runDescent converges to genuine local minima of `field`.

export interface Bump { a: number; cx: number; cy: number; s: number }

// A real non-convex loss landscape: sum of Gaussian bumps.
// Negative a = valley/bowl, positive a = hill.
export const BUMPS: Bump[] = [
  { a: -1.0,  cx: -1.4, cy: -0.5, s: 0.9 }, // deep valley (global-ish min)
  { a: -0.65, cx:  1.5, cy:  0.7, s: 0.8 }, // secondary bowl
  { a: -0.5,  cx:  0.3, cy: -1.3, s: 0.7 }, // small basin
  { a:  0.7,  cx: -0.2, cy:  0.9, s: 1.0 }, // hill
  { a:  0.45, cx:  1.0, cy: -0.6, s: 0.7 }, // ridge bump
];

export const ZSCALE = 1.7;   // amplify relief so hills/valleys read in 3D
export const RANGE = 2.6;    // world half-extent in x,y
export const STEP = 0.16;    // dot-grid spacing (tuned up from 0.13 for perf)

// deterministic-ish descent spawn points (varied), cycled by the renderer
export const SPAWNS: [number, number][] = [
  [-2.0, 1.6], [1.8, -1.8], [0.4, 2.0], [-1.6, -1.9], [2.1, 1.2], [-0.6, -0.4],
];

export function field(x: number, y: number): number {
  let z = 0;
  for (const b of BUMPS) {
    const dx = x - b.cx, dy = y - b.cy;
    z += b.a * Math.exp(-(dx * dx + dy * dy) / (2 * b.s * b.s));
  }
  return z * ZSCALE;
}

export function grad(x: number, y: number): [number, number] {
  let gx = 0, gy = 0;
  for (const b of BUMPS) {
    const dx = x - b.cx, dy = y - b.cy;
    const e = b.a * Math.exp(-(dx * dx + dy * dy) / (2 * b.s * b.s));
    gx += e * (-dx / (b.s * b.s));
    gy += e * (-dy / (b.s * b.s));
  }
  return [gx * ZSCALE, gy * ZSCALE];
}

// honest gradient descent; subsample to 10 visible iterates, keep the last.
export function runDescent(x0: number, y0: number): Array<{ x: number; y: number }> {
  let x = x0, y = y0;
  const pts: Array<{ x: number; y: number }> = [{ x, y }];
  const lr = 0.16;
  for (let k = 0; k < 140; k++) {
    const [gx, gy] = grad(x, y);
    x -= lr * gx; y -= lr * gy;
    pts.push({ x, y });
    if (Math.hypot(gx, gy) < 0.01) break;
  }
  const want = 10, out: Array<{ x: number; y: number }> = [];
  const st = (pts.length - 1) / (want - 1);
  for (let i = 0; i < want - 1; i++) out.push(pts[Math.round(i * st)]);
  out.push(pts[pts.length - 1]);
  return out;
}

// ochre-indigo ramp: warm low ground -> cool indigo heights (palette only).
function lp(a: number[], b: number[], t: number): [number, number, number] {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

// A terrain palette = three ramp stops (valley → mid → hilltop) as RGB triples.
// The canvas is JS-painted, so it can't inherit CSS tokens; each theme passes
// its own ramp here. Default is the shipped LIGHT ramp — keeping colormap()'s
// zero-arg signature intact for the unit test and existing callers.
export interface TerrainRamp { valley: [number, number, number]; mid: [number, number, number]; peak: [number, number, number] }
export const TERRAIN_LIGHT: TerrainRamp = { valley: [150, 110, 58], mid: [120, 112, 96], peak: [109, 118, 137] };       // warm ochre valleys → cool indigo heights
export const TERRAIN_TERMINAL: TerrainRamp = { valley: [70, 120, 92], mid: [78, 150, 150], peak: [95, 190, 170] };      // phosphor-green low → cyan heights (the "star field")

export function colormap(hn: number, ramp: TerrainRamp = TERRAIN_LIGHT): [number, number, number] {
  return hn < 0.5
    ? lp(ramp.valley, ramp.mid, hn / 0.5)
    : lp(ramp.mid, ramp.peak, (hn - 0.5) / 0.5);
}

// 3D projection (fixed yaw + tilt isometric). z is height (up).
const YAW = Math.PI * 0.18, TILT = 0.92;
const cosY = Math.cos(YAW), sinY = Math.sin(YAW), cosT = Math.cos(TILT), sinT = Math.sin(TILT);
export function project(x: number, y: number, z: number, W: number, Hh: number): [number, number, number] {
  const rx = x * cosY - y * sinY;
  const ry = x * sinY + y * cosY;
  const sy = ry * cosT - z * sinT;
  const depth = ry * sinT + z * cosT;
  const sc = Math.min(W, Hh) * 0.34;
  return [W * 0.5 + rx * sc, Hh * 0.46 - sy * sc, depth];
}
