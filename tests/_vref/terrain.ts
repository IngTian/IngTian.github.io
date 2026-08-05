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
// zero-arg signature intact for existing callers.
//
// The DARK ramp is a hand-tuned palette carried over from the manifold
// screensaver (the same terrain math, dialed against the real field + EDL):
//   • LIGHT = "Classic" — the shipped warm ochre valleys → cool indigo heights.
//   • DARK  = "Glacier" — cool cyan-blue ice, slate valleys → bright rime peaks,
//     on the charcoal night sky.
export interface TerrainRamp { valley: [number, number, number]; mid: [number, number, number]; peak: [number, number, number] }
export const TERRAIN_LIGHT: TerrainRamp = { valley: [150, 110, 58], mid: [120, 112, 96], peak: [109, 118, 137] };       // Classic: warm ochre valleys → cool indigo heights
export const TERRAIN_TERMINAL: TerrainRamp = { valley: [47, 90, 110], mid: [91, 147, 168], peak: [198, 227, 237] };     // Glacier: cyan-blue ice valleys → bright rime peaks

export function colormap(hn: number, ramp: TerrainRamp = TERRAIN_LIGHT): [number, number, number] {
  return hn < 0.5
    ? lp(ramp.valley, ramp.mid, hn / 0.5)
    : lp(ramp.mid, ramp.peak, (hn - 0.5) / 0.5);
}

// 3D projection (fixed yaw + tilt isometric). z is height (up).
const YAW = Math.PI * 0.18, TILT = 0.92;
const cosY = Math.cos(YAW), sinY = Math.sin(YAW), cosT = Math.cos(TILT), sinT = Math.sin(TILT);

// `zoom` (default 1) pulls the camera back a touch (<1 shows more of the terrain
// footprint) or in (>1). It's a UNIFORM scale, so it never distorts the field;
// the same factor flows into the dot radius so the pointillist texture stays
// consistent. The screensaver port dialed 0.85 as the "shows the whole ridge"
// default. Kept optional so existing callers (and the unit test) are unchanged.
export function project(x: number, y: number, z: number, W: number, Hh: number, zoom = 1): [number, number, number] {
  const rx = x * cosY - y * sinY;
  const ry = x * sinY + y * cosY;
  const sy = ry * cosT - z * sinT;
  const depth = ry * sinT + z * cosT;
  const sc = Math.min(W, Hh) * 0.34 * zoom;
  return [W * 0.5 + rx * sc, Hh * 0.46 - sy * sc, depth];
}

// Resolution-independent projected coords (pre scale+offset): screen X-axis,
// screen Y-axis (uy; larger = higher on screen), and depth (larger = nearer).
// project() is just a uniform scale+translate of (rx, sy), so screen-space
// NEIGHBOR relationships are identical at every resolution and every zoom —
// which lets Eye-Dome Lighting be precomputed ONCE here and reused at any
// viewport size. (Mirrors the screensaver port's `Projector.raw`.)
export function projectRaw(x: number, y: number, z: number): { ix: number; uy: number; depth: number } {
  const rx = x * cosY - y * sinY;
  const ry = x * sinY + y * cosY;
  return { ix: rx, uy: ry * cosT - z * sinT, depth: ry * sinT + z * cosT };
}

// Unit surface normal of the height field z = field(x,y): N = normalize(-fx,-fy,1)
// in world (x, y, elevation / z-up) space. `grad` already returns d(field)/d{x,y}
// (ZSCALE folded in), so this is the true normal of the rendered surface.
// Precomputed per grid point so per-frame directional shading is one dot product.
export function normal(x: number, y: number): [number, number, number] {
  const [gx, gy] = grad(x, y);
  const inv = 1 / Math.hypot(gx, gy, 1);
  return [-gx * inv, -gy * inv, inv];
}

// ── Eye-Dome Lighting ──────────────────────────────────────────────────────
// A sparse dot cloud has no silhouette or ridge edges, so it reads as a flat
// scatter rather than a 3-D mountain. EDL manufactures those edges: for each
// dot, gather its SCREEN-space neighbors and measure how much they RECEDE from
// it in depth; a dot sitting behind nearer terrain gets a large response → a
// darker/smaller shade. It's orientation-independent (works where facing-based
// Lambert shading fails on a scatter) and — since our camera is fixed and the
// base terrain static — the whole shade is PRECOMPUTED once, for zero per-frame
// cost. (This is the Potree / CloudCompare technique. Ported from the manifold
// screensaver, whose terrain math is a verbatim copy of this file.)
export interface EDLParams { neighborRadius: number; strength: number; percentile: number }
export const EDL_DEFAULTS: EDLParams = { neighborRadius: 0.53, strength: 2.0, percentile: 0.80 };

/** Per-dot EDL shade in [0,1] (1 = unshaded, →0 = occluded/receding), aligned to
 *  `dots` order. `dots` need only x,y (base elevation is taken from `field`). */
export function computeEDL(dots: Array<{ x: number; y: number }>, params: EDLParams = EDL_DEFAULTS): number[] {
  const n = dots.length;
  const ix = new Float64Array(n), uy = new Float64Array(n), dp = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const r = projectRaw(dots[i].x, dots[i].y, field(dots[i].x, dots[i].y));
    ix[i] = r.ix; uy[i] = r.uy; dp[i] = r.depth;
  }
  const r2 = params.neighborRadius * params.neighborRadius;
  const response = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    let sum = 0, cnt = 0;
    for (let j = 0; j < n; j++) {
      if (j === i) continue;
      const dx = ix[j] - ix[i], dy = uy[j] - uy[i];
      if (dx * dx + dy * dy > r2) continue;
      cnt++;
      // depth larger = NEARER. A dot RECEDES (→ darken) when its neighbors are
      // FARTHER (dp[j] < dp[i]); the opposite sign wrongly dims the ridge.
      const recede = dp[i] - dp[j];
      if (recede > 0) sum += recede;
    }
    response[i] = cnt > 0 ? sum / cnt : 0;
  }
  // Normalize by a high percentile: the raw response is very skewed (a few
  // silhouette dots dominate), so a fixed strength would either barely touch the
  // bulk or nuke the tail. Dividing by ~p80 spreads relief evenly across the field.
  const sorted = Array.from(response).sort((a, b) => a - b);
  const ref = Math.max(1e-6, sorted[Math.round(params.percentile * (n - 1))]);
  const out = new Array<number>(n);
  for (let i = 0; i < n; i++) out[i] = Math.exp(-(response[i] / ref) * params.strength);
  return out;
}

// ── Directional relief light ────────────────────────────────────────────────
// A single fixed, high-overhead sun shades each dot for extra form. N·L feeds a
// half-Lambert term (soft terminator, shadow side never goes to black) that
// drives a theme-adaptive brightness (darken shadows on the pale sky / brighten
// highlights on the dark sky) plus a warm-lit / cool-shadow temperature swing.
// On a sparse cloud this is a WEAKER cue than EDL, but it warms the palette and
// adds gentle relief. Ported verbatim from the screensaver.
export interface LightParams {
  az: number; alt: number;          // light direction (radians): azimuth, altitude
  ambient: number;                  // shadow-side floor (0..1); higher = flatter
  warm: number;                     // warm-lit / cool-shadow temperature swing
  valueLight: number;               // shadow-darkening weight, applied ∝ (1-darkness)
  gainDark: number;                 // highlight-brightening weight, applied ∝ darkness
}
export const LIGHT_DEFAULTS: LightParams = { az: -0.565, alt: 1.30, ambient: 0.50, warm: 0.30, valueLight: 0.62, gainDark: 0.95 };

/** Unit light direction (world x=n, y=e, z=up) from azimuth+altitude. */
export function lightDir(p: LightParams = LIGHT_DEFAULTS): [number, number, number] {
  const ca = Math.cos(p.alt);
  const v: [number, number, number] = [Math.cos(p.az) * ca, Math.sin(p.az) * ca, Math.sin(p.alt)];
  const inv = 1 / Math.hypot(v[0], v[1], v[2]);
  return [v[0] * inv, v[1] * inv, v[2] * inv];
}

/** Shade an elevation-resolved base color by the light. `ndl` = N·L in [-1,1];
 *  `darkness` in [0,1] (0 = light theme, 1 = dark) blends the value/gain split so
 *  it adapts across the theme cross-fade. Returns an RGB triple in [0,255]. */
export function litColor(
  base: [number, number, number], ndl: number, darkness: number, p: LightParams = LIGHT_DEFAULTS,
): [number, number, number] {
  const h = 0.5 + 0.5 * ndl;                               // half-Lambert, [0,1]
  const shade = p.ambient + (1 - p.ambient) * h;
  const value = 1 - (p.valueLight * (1 - darkness)) * (1 - shade);  // ≤1: darken shadows
  const gain = 1 + (p.gainDark * darkness) * h;                    // ≥1: brighten lit
  const t = p.warm * (h - 0.5) * 2;                                // [-warm,+warm]
  const cl = (v: number) => Math.max(0, Math.min(255, v));
  return [cl(base[0] * value * gain * (1 + t)), cl(base[1] * value * gain), cl(base[2] * value * gain * (1 - t))];
}

/** Relative luminance (0..1) of an RGB[0..255] triple — used to derive a
 *  palette's "darkness" from its top sky color for the lighting blend. */
export function luminance01([r, g, b]: [number, number, number]): number {
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}
