// Terrain dot-painter — the single source of truth for how the pointillist
// terrain is drawn.
//
// Walkers/bubbles stay in the hero (they're a hero-only flourish); this module
// owns the static-per-camera terrain: the grid, its precomputed normals + EDL,
// and the per-frame dot paint (elevation color → directional light →
// Eye-Dome Lighting + elevation emphasis → bottom fade).

import {
  field, project, normal, computeEDL, litColor,
  colormap, RANGE, STEP, edlSpend,
  type TerrainRamp, EDL_DEFAULTS, LIGHT_DEFAULTS, lightDir,
} from './terrain';

/** What the painter takes per theme; TerrainHero's themePalette() supplies it. */
export interface TerrainTheme {
  ramp: TerrainRamp;
  darkness: number;          // 0=light theme, 1=dark — blends the lighting value/gain; above 0.5 the dots are stars
  dotScale: number;          // overall dot-radius multiplier (1 = base; per-theme knob)
}

/** The camera's uniform pull-back (<1 shows more footprint). The hero's walkers project with it too,
 *  or they leave the surface. */
export const TERRAIN_ZOOM = 0.85;
const EDL_FLOOR = 0.20;        // darkest an EDL-shadowed dot's opacity goes
const EDL_SIZE_RANGE = 0.75;   // dot-area spread (lit dots grow, shadowed shrink)
const ELEV_EMPHASIS = 0.20;    // extra emphasis on the high ground (valley recedes)

export interface GridPoint { x: number; y: number; nx: number; ny: number; nz: number; edl: number }

/**
 * Per-dot stellar character, for the dark theme's "terminal galaxy".
 *
 * The dark theme already reads the terrain's dots as a star field, so this
 * makes that literal: each dot gets a stable pseudo-random
 * identity derived from its lattice position — a twinkle phase, a twinkle rate,
 * and a stellar-temperature tint (blue-white O/B → white A → violet → amber
 * K/M). Deterministic in (x, y), so a dot's identity never changes between
 * frames or across a re-init.
 *
 * Pure and exported so it can be unit-tested like the rest of lib/.
 */
export function starIdentity(x: number, y: number): { phase: number; rate: number; tint: [number, number, number] } {
  // Two independent hashes from the same lattice point.
  //
  // NOT the classic sin(dot(p, k)) * big form: a unit test caught it producing
  // only 85 distinct phases across 169 lattice points. The terrain grid is a
  // REGULAR lattice, and that hash aliases badly on regular input — many (x, y)
  // pairs land on the same argument, so neighbouring dots shared a twinkle phase
  // and blinked together, which is exactly the strobe this is meant to avoid.
  //
  // This is a fract/dot integer-mixing hash (no trig), which decorrelates
  // adjacent lattice points properly. Same construction as the shader's hash.
  const mix = (px: number, py: number, s: number): number => {
    let ax = (px + s) * 0.3183099 + 0.1;
    let ay = (py + s * 1.618) * 0.3678794 + 0.7;
    ax = ax - Math.floor(ax);
    ay = ay - Math.floor(ay);
    const d = ax * (ay + 19.19) + ay * (ax + 7.77);
    const v = (ax + d) * (ay + d) * 43758.5453;
    return v - Math.floor(v);
  };
  const h1 = mix(x, y, 0);
  const h2 = mix(x, y, 37.13);

  // Stellar colour by "temperature". Real stars run blue-white → white → amber;
  // a little violet is included because that is what reads as deep space.
  let tint: [number, number, number];
  if (h2 < 0.34) {
    const t = h2 / 0.34;
    tint = [0.62 + 0.24 * t, 0.74 + 0.18 * t, 1.0];                    // blue-white
  } else if (h2 < 0.72) {
    tint = [0.97, 0.97, 1.0];                                          // white
  } else {
    const t = (h2 - 0.72) / 0.28;
    tint = [0.80 + 0.20 * t, 0.72 + 0.14 * t, 1.0 - 0.28 * t];         // violet → amber
  }

  return { phase: h1 * Math.PI * 2, rate: 0.55 + h1 * 1.5, tint };
}

/**
 * MEMOISED, in one slot with no key. The EDL precompute is a brute-force all-pairs scan: 1089 points,
 * 1,185,921 pair checks, measured in node at **cold 8.1 ms, warm median 2.4 ms**. TerrainHero calls this from
 * `initTerrain()`, which runs on every `astro:page-load` and every `theme:change`, so without the memo every
 * return to `/` and every theme flip paid 2–8 ms of blocked main thread, more on a phone. The result is a pure
 * function of module constants (`RANGE`, `STEP`, `EDL_DEFAULTS` and the `field`/`normal` geometry), so there is
 * nothing to key on — the same reason lib/terrainContours.ts's memo has none.
 *
 * THE RETURNED ARRAY IS SHARED, which is the one thing a caller has to respect: treat it as read-only.
 * `paintTerrain` only reads it, and nothing else writes it today. If you ever want to hand the painter
 * per-frame-transformed positions (a legitimate trick — it re-reads `g.x`/`g.y` every frame), map to a COPY
 * rather than mutating these objects, or every other consumer inherits the transform.
 */
let gridCache: GridPoint[] | null = null;

export function buildGrid(): GridPoint[] {
  if (gridCache) return gridCache;
  const raw: Array<{ x: number; y: number }> = [];
  for (let x = -RANGE; x <= RANGE; x += STEP) for (let y = -RANGE; y <= RANGE; y += STEP) raw.push({ x, y });
  const edl = computeEDL(raw, EDL_DEFAULTS);
  gridCache = raw.map((d, i) => {
    const [nx, ny, nz] = normal(d.x, d.y);
    return { x: d.x, y: d.y, nx, ny, nz, edl: edl[i] };
  });
  return gridCache;
}

// The painter's `darkness` is SET per theme in TerrainHero.astro, never derived from a sky colour: dark mode
// is a chosen look, not a luminance calculation (a derivation from the top sky colour was deleted unused).

const ZR = 1.55; // elevation → [0,1] normalization half-range (matches the hero)

/** Paint one frame of terrain dots into a Y-down 2D context. `breathAmp` is the
 *  breathing amplitude for this frame (0 = still). Returns nothing; walkers are
 *  drawn by the caller afterward.
 *
 *  `zoom` is TERRAIN_ZOOM for every production frame. It is a parameter because
 *  tests/paintTerrain.test.ts's lift-linearity spec pulls the camera back until no
 *  dot is culled, which the shipped zoom cannot do at any canvas shape. */
export function paintTerrain(
  ctx: CanvasRenderingContext2D,
  grid: GridPoint[],
  theme: TerrainTheme,
  W: number, Hh: number, DPR: number, tsec: number, breathAmp: number,
  lift: number = 1,
  zoom: number = TERRAIN_ZOOM,
): void {
  const breathHz = 0.4;
  const [Lx, Ly, Lz] = lightDir(LIGHT_DEFAULTS);

  interface Dot { sx: number; sy: number; depth: number; z: number; ndl: number; edl: number; gx: number; gy: number }
  const rd: Dot[] = [];
  for (const g of grid) {
    // `lift` SCALES ELEVATION, the homepage intro's one animated quantity: 0 is a flat plane, 1 the hero.
    // Applied here, not written into the grid, which is the memoised array `buildGrid` shares (a test
    // asserts it is not mutated). Breath is NOT scaled by lift: it is ramped from zero by the hero's own
    // `breathIn`, and is 0 at the intro's last frame, so the handoff needs no blending.
    let z = field(g.x, g.y) * lift;
    z += breathAmp * Math.sin(tsec * breathHz + g.x * 0.7 + g.y * 0.6);
    const [sx, sy, depth] = project(g.x, g.y, z, W, Hh, zoom);
    const ndl = g.nx * Lx + g.ny * Ly + g.nz * Lz;
    rd.push({ sx, sy, depth, z, ndl, edl: g.edl, gx: g.x, gy: g.y });
  }
  rd.sort((p, q) => p.depth - q.depth); // painter's order: far first

  const fadeStart = Hh * 0.84;
  for (const p of rd) {
    if (p.sx < -20 || p.sx > W + 20 || p.sy < -20 || p.sy > Hh + 20) continue;
    const hn = Math.max(0, Math.min(1, (p.z + ZR) / (2 * ZR)));
    let r = (2.9 - hn * 1.6) * DPR * zoom * theme.dotScale;
    // Base opacity by elevation. Dark keeps a falloff that fades the ridge (alpha 0.27 at the peak against
    // 0.75 in the valley), where a fading dot recedes into a near-black sky. On pale paper that dissolves
    // the ridge into the backdrop, so LIGHT flattens and lifts the ramp to keep high ground present.
    const aBase = theme.darkness > 0.5 ? 0.30 + (1 - hn) * 0.45
                                       : 0.62 + (1 - hn) * 0.16;
    let alpha = aBase;
    if (p.sy > fadeStart) alpha *= Math.max(0, 1 - (p.sy - fadeStart) / (Hh - fadeStart));

    let color = colormap(hn, theme.ramp);
    color = litColor(color, p.ndl, theme.darkness, LIGHT_DEFAULTS);

    // Eye-Dome Lighting: a receding dot (edl→0) recedes AND shrinks; a
    // near/high ridge dot (edl→1) stays present and grows. Size coupling is
    // centered on 1× (sh=0.5 ⇒ unchanged) so mean size is kept.
    //
    // HOW the shade is spent (alpha in dark, value in light) is edlSpend()'s, in terrain.ts.
    const sh = p.edl;
    const spend = edlSpend(sh, theme.darkness, EDL_FLOOR);
    color = [color[0] * spend.value, color[1] * spend.value, color[2] * spend.value];
    alpha *= spend.alpha;
    r *= 1 + EDL_SIZE_RANGE * (sh - 0.5);
    // Elevation emphasis: the mountain IS the high ground — diminish the
    // valley (hn→0) toward (1−emphasis) and shrink it so the ridge carries form.
    const e = ELEV_EMPHASIS;
    alpha *= 1 - e * (1 - hn);
    r *= (1 - e * 0.5) + (e * 0.5) * hn;

    let [cr, cg, cb] = color;

    // ── STARS: the mountain's dots ARE the star field (dark theme only) ────
    // The dark theme's whole conceit is that these dots read as stars, so make it
    // literal — each dot twinkles on its own phase and carries a stellar
    // temperature tint. Gated on the dark theme so the shipped LIGHT terrain
    // (warm ochre→indigo relief) is bit-for-bit unchanged.
    if (theme.darkness > 0.5) {
      const { phase, rate, tint } = starIdentity(p.gx, p.gy);
      // two out-of-phase sines: no two dots blink together, and the field never
      // pulses in unison the way a single shared clock would.
      // Damped 0.6x to match the calmed sky warp — the terrain's twinkle and the
      // sky's motion should read as one tempo, not two.
      const tw2 = tsec * 0.6;
      const tw = 0.62 + 0.38 * Math.sin(tw2 * rate + phase)
                      * (0.6 + 0.4 * Math.sin(tw2 * rate * 0.37 + phase * 2.1));
      // Pull each dot toward its stellar colour, then modulate brightness. High
      // ground twinkles most (hn→1): the ridge is the near sky.
      const mixK = 0.55 + 0.30 * hn;
      cr = cr * (1 - mixK) + 255 * tint[0] * mixK;
      cg = cg * (1 - mixK) + 255 * tint[1] * mixK;
      cb = cb * (1 - mixK) + 255 * tint[2] * mixK;
      alpha *= tw;
      // a hair larger at peak brightness, so a twinkle reads as light not size
      r *= 0.92 + 0.16 * tw;
    }

    if (alpha <= 0.004) continue;
    ctx.beginPath();
    ctx.arc(p.sx, p.sy, Math.max(0.5, r), 0, 2 * Math.PI);
    ctx.fillStyle = `rgba(${cr | 0},${cg | 0},${cb | 0},${alpha.toFixed(3)})`;
    ctx.fill();
  }
}
