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
// LIGHT ramp — "Classic": warm ochre valleys → cool indigo heights, at the token
// values. A deepened variant was tried and REVERTED: measured composited on screen
// (paper backdrop, EDL shade 0.5) the ridge still landed LIGHTER than the valley
// (L 0.680 vs 0.526), because terrainRender's base alpha ramp 0.30+(1-hn)*0.45 more
// than cancels any value ramp. It bought ~17% of the separation win while being the
// only part that altered the shipped hero's colour identity — edlSpend() delivers
// the other ~316%. Not worth the palette risk.
// Classic: warm ochre valleys → cool indigo heights.
//
// REAL VALUE RANGE, added after the light mountain still read as mush. Measured dot
// luminance across elevation, before vs after:
//     before  0.450 / 0.425 / 0.461  -> spread 0.036   (essentially FLAT)
//     dark    0.323 / 0.536 / 0.869  -> spread 0.546
// i.e. dark carried 15x more elevation→value information. Each light dot separated
// from the SKY perfectly well (~0.45), but the dots did not separate from EACH
// OTHER, so there was no value structure and therefore no readable mountain FORM.
// That is why raising contrast against the background never fixed it.
// Now: valley = deep ochre (dark), peak = pale indigo (light), so elevation reads as
// light on the ridge the way it does in dark theme. Hues stay --ochre → --indigo.
//
// (Earlier note, still true: the MID knot was also hue-identical to the sky —
// measured (r-b) sky +16..+32 vs mid +24 — so it needed cooling regardless.)
// MID cooled. Measured against the fluid sky the
// dots now sit on, using (r-b) as a cheap warm/cool axis:
//     sky   dawn +16 · haze +27 · taupe +32 · warm +22
//     dots  valley +92 · MID +24 · peak −28
// The mid band was hue-IDENTICAL to the sky (+24 inside the sky's +16..+32), so
// mid-elevation dots vanished into it while the valley and peak still read. Cooling
// the mid to −20 puts the whole ramp on the cool side of the warm sky except the
// valley, which separates by being much darker instead.
//
// Still --ochre → --indigo: the endpoints are the tokens, only the interior knot
// moved, so the palette identity holds and no new hue is introduced.
export const TERRAIN_LIGHT: TerrainRamp = { valley: [92, 64, 30], mid: [116, 118, 132], peak: [176, 186, 206] };
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

// ── How EDL shade is SPENT: opacity, or value? ──────────────────────────────
// computeEDL returns a shade in [0,1]; something has to turn that into pixels.
// The shipped renderer spent it on ALPHA (`alpha *= floor + (1-floor)*shade`),
// and on the dark theme that is exactly right: fading a dot toward a near-black
// sky DARKENS it, which is what an eye-dome shadow looks like.
//
// On the LIGHT theme the same line runs BACKWARDS. Measured against the real
// hero backdrop (mean luminance 0.875) and the mean light dot (0.445):
//
//     alpha  1.00 → 0.445   (the dot's own value)
//     alpha  0.30 → 0.746   ← LIGHTER than unshaded
//     alpha  0.08 → 0.841   ← almost exactly the sky
//
// So the dots EDL most wants to darken — the receding ridge, the silhouette,
// the shape cue itself — instead BLEACH OUT into the pale sky. That is the
// reported "the dots blend into the fluid background": not a palette problem
// (the marbled sky just makes an existing inversion obvious), but Eye-Dome
// Lighting subtracting contrast where it should be adding it. It also explains
// why dark theme reads as a mountain and light theme reads as mush from the
// SAME shade array.
//
// The fix is to spend the shade on VALUE in light theme — multiply the colour
// down instead of the opacity — so a shadowed dot goes to ink rather than to
// air. `darkness` (0 = light, 1 = dark) picks the split, so the crossover is
// continuous and the dark theme's alpha behaviour is preserved bit-for-bit at
// darkness = 1.
export interface EDLSpend {
  /** multiply the dot's RGB by this (1 = untouched) */
  value: number;
  /** multiply the dot's alpha by this (1 = untouched) */
  alpha: number;
}

/** Darkest an EDL-shadowed dot's COLOUR goes on the light theme. Tuned against
 *  the real marbled backdrop: the EDL-shadowed (ridge) dots' mean separation
 *  from their local sky rose 0.020 → 0.135 (6.7x) at this floor. */
export const EDL_VALUE_FLOOR = 0.32;
/** Light theme's (gentle) EDL alpha floor — the far field still recedes, but the
 *  shape cue is carried by value now, so opacity no longer has to crush it. */
export const EDL_ALPHA_FLOOR_LIGHT = 0.82;

/**
 * Split an EDL shade into a value factor and an alpha factor.
 *
 * @param shade    per-dot EDL shade in [0,1] (1 = unshaded, →0 = occluded)
 * @param darkness 0 = light theme, 1 = dark theme
 * @param alphaFloor the shipped `edlFloor` — darkest an EDL-shadowed dot's
 *                   OPACITY goes. Used unchanged when darkness = 1.
 * @param valueFloor darkest an EDL-shadowed dot's COLOUR goes in light theme.
 *
 * At darkness = 1 this returns { value: 1, alpha: alphaFloor + (1-alphaFloor)*shade },
 * i.e. precisely the shipped expression, so the dark theme cannot regress.
 */
export function edlSpend(
  shade: number, darkness: number, alphaFloor: number, valueFloor = EDL_VALUE_FLOOR,
): EDLSpend {
  const s = Math.max(0, Math.min(1, shade));
  const d = Math.max(0, Math.min(1, darkness));
  // Dark theme keeps the shipped alpha ramp. Light theme leans on value, and
  // retains a much gentler alpha ramp (floor EDL_ALPHA_FLOOR_LIGHT) so the far
  // field still recedes into the sky instead of ending in a hard dot wall.
  //
  // Both blends use the `a*(1-d) + b*d` mix form rather than `a + (b-a)*d`.
  // That is deliberate and load-bearing: the mix form is EXACT at both endpoints
  // in floating point, so at darkness = 1 aFloor === alphaFloor and vFloor === 1
  // bit-for-bit. `0.82 + (0.20 - 0.82) * 1` evaluates to 0.19999999999999996,
  // which would make the dark theme's dot alphas differ in the last bits from the
  // shipped renderer — a regression this function exists to make impossible.
  const aFloor = EDL_ALPHA_FLOOR_LIGHT * (1 - d) + alphaFloor * d;
  // Value shading fades out as the theme darkens; at d = 1 it is exactly 1.
  const vFloor = valueFloor * (1 - d) + 1 * d;
  return { value: vFloor + (1 - vFloor) * s, alpha: aFloor + (1 - aFloor) * s };
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
  // Warm/cool directional tint. In LIGHT theme this is scaled back hard, because
  // it was silently CANCELLING the cooled TERRAIN_LIGHT ramp. Measured at a typical
  // sunlit normal (ndl +0.6) with warm=0.3, using (r-b) as the warm/cool axis:
  //     raw ramp   valley +62 · mid −16 · peak −30
  //     after lit  valley +79 · mid +26 · peak +37   <- all pushed WARM
  // The fluid sky sits at +16..+32, so the lit dots landed exactly on top of it and
  // the mountain read as mush no matter what the ramp said. That is why the hue
  // change "didn't update" on screen — it shipped, then the lighting undid it.
  // Light theme keeps a whisper (0.08) so the relief still has warm/cool direction;
  // dark theme is unchanged, where the tint is doing no harm.
  const warmEff = p.warm * (0.27 + 0.73 * darkness);
  const t = warmEff * (h - 0.5) * 2;                               // [-warm,+warm]
  const cl = (v: number) => Math.max(0, Math.min(255, v));
  return [cl(base[0] * value * gain * (1 + t)), cl(base[1] * value * gain), cl(base[2] * value * gain * (1 - t))];
}

/** Relative luminance (0..1) of an RGB[0..255] triple — used to derive a
 *  palette's "darkness" from its top sky color for the lighting blend. */
export function luminance01([r, g, b]: [number, number, number]): number {
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}
