// Shared terrain dot-painter — the single source of truth for how the
// pointillist terrain is drawn, used by BOTH the hero (TerrainHero.astro) and
// the tuning lab (/terrain-lab). Because they paint from the same code, any
// value dialed in the lab transfers to the hero verbatim.
//
// Walkers/bubbles stay in the hero (they're a hero-only flourish); this module
// owns the static-per-camera terrain: the grid, its precomputed normals + EDL,
// and the per-frame dot paint (elevation color → optional directional light →
// optional Eye-Dome Lighting + elevation emphasis → bottom fade).

import {
  field, project, projectRaw, normal, computeEDL, litColor, luminance01,
  colormap, RANGE, STEP, edlSpend,
  type TerrainRamp, type EDLParams, type LightParams, EDL_DEFAULTS, LIGHT_DEFAULTS, lightDir,
} from './terrain';

/** All the knobs the lab exposes; the hero passes the baked defaults. */
export interface TerrainConfig {
  ramp: TerrainRamp;
  lighting: boolean;         // directional half-Lambert relief + warm/cool tint
  edl: boolean;              // Eye-Dome Lighting shape cue
  edlParams: EDLParams;
  light: LightParams;
  edlFloor: number;          // darkest an EDL-shadowed dot's opacity goes
  edlSizeRange: number;      // dot-area spread (lit dots grow, shadowed shrink)
  elevEmphasis: number;      // extra emphasis on the high ground (valley recedes)
  zoom: number;              // uniform camera pull-back (<1 shows more footprint)
  dotScale: number;          // overall dot-radius multiplier (1 = base; per-theme knob)
  darkness: number;          // 0=light theme, 1=dark — blends the lighting value/gain
  /** Dark-theme only: paint the dots as twinkling, temperature-tinted stars. */
  starfield?: boolean;
}

export const TERRAIN_CONFIG_DEFAULTS: Omit<TerrainConfig, 'ramp' | 'darkness'> = {
  lighting: true,
  edl: true,
  edlParams: EDL_DEFAULTS,
  light: LIGHT_DEFAULTS,
  edlFloor: 0.20,
  edlSizeRange: 0.75,
  elevEmphasis: 0.20,
  zoom: 0.85,
  dotScale: 1,
};

export interface GridPoint { x: number; y: number; nx: number; ny: number; nz: number; edl: number }

/**
 * Per-dot stellar character, for the dark theme's "terminal galaxy".
 *
 * The dark theme already reads the terrain's dots as a star field (see
 * CLAUDE.md), so this makes that literal: each dot gets a stable pseudo-random
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

/** Build the dot grid with per-point normals + precomputed EDL shade. The EDL
 *  precompute is O(n²) over ~1089 pts (~1.2M ops) — run ONCE, never per frame. */
export function buildGrid(edlParams: EDLParams = EDL_DEFAULTS): GridPoint[] {
  const raw: Array<{ x: number; y: number }> = [];
  for (let x = -RANGE; x <= RANGE; x += STEP) for (let y = -RANGE; y <= RANGE; y += STEP) raw.push({ x, y });
  const edl = computeEDL(raw, edlParams);
  return raw.map((d, i) => {
    const [nx, ny, nz] = normal(d.x, d.y);
    return { x: d.x, y: d.y, nx, ny, nz, edl: edl[i] };
  });
}

/** Derive a palette's "darkness" (0..1) from its top sky color's luminance —
 *  drives the lighting value/gain blend so it adapts across the theme. */
export function paletteDarkness(topSky: [number, number, number]): number {
  return Math.max(0, Math.min(1, 1 - luminance01(topSky)));
}

const ZR = 1.55; // elevation → [0,1] normalization half-range (matches the hero)

/** Paint one frame of terrain dots into a Y-down 2D context. `breathAmp` is the
 *  breathing amplitude for this frame (0 = still). Returns nothing; walkers are
 *  drawn by the caller afterward. */
export function paintTerrain(
  ctx: CanvasRenderingContext2D,
  grid: GridPoint[],
  cfg: TerrainConfig,
  W: number, Hh: number, DPR: number, tsec: number, breathAmp: number,
): void {
  const breathHz = 0.4;
  const lit = cfg.lighting;
  const [Lx, Ly, Lz] = lightDir(cfg.light);

  interface Dot { sx: number; sy: number; depth: number; z: number; ndl: number; edl: number; gx: number; gy: number }
  const rd: Dot[] = [];
  for (const g of grid) {
    let z = field(g.x, g.y);
    z += breathAmp * Math.sin(tsec * breathHz + g.x * 0.7 + g.y * 0.6);
    const [sx, sy, depth] = project(g.x, g.y, z, W, Hh, cfg.zoom);
    const ndl = lit ? g.nx * Lx + g.ny * Ly + g.nz * Lz : 0;
    rd.push({ sx, sy, depth, z, ndl, edl: g.edl, gx: g.x, gy: g.y });
  }
  rd.sort((p, q) => p.depth - q.depth); // painter's order: far first

  const fadeStart = Hh * 0.84;
  for (const p of rd) {
    if (p.sx < -20 || p.sx > W + 20 || p.sy < -20 || p.sy > Hh + 20) continue;
    const hn = Math.max(0, Math.min(1, (p.z + ZR) / (2 * ZR)));
    let r = (2.9 - hn * 1.6) * DPR * cfg.zoom * cfg.dotScale;
    // Base opacity by elevation. The shipped ramp fades the RIDGE OUT
    // (0.30+(1-hn)*0.45 → alpha 0.27 at the peak vs 0.75 in the valley), which on
    // pale paper is fatal: measured through the full pipeline the peak dots
    // composite to L=0.787 against paper at L=0.916 — barely 0.13 of separation, so
    // the ridge dissolves. That is the "still blends in" report, and it is why
    // fixing hue and value alone never worked: the ridge was being made transparent.
    //
    // In LIGHT theme the ramp is flattened and lifted so high ground stays present.
    // Dark theme keeps the shipped falloff, where a fading dot correctly recedes
    // into a near-black sky.
    const aBase = cfg.darkness > 0.5 ? 0.30 + (1 - hn) * 0.45
                                     : 0.62 + (1 - hn) * 0.16;
    let alpha = aBase;
    if (p.sy > fadeStart) alpha *= Math.max(0, 1 - (p.sy - fadeStart) / (Hh - fadeStart));

    let color = colormap(hn, cfg.ramp);
    if (lit) color = litColor(color, p.ndl, cfg.darkness, cfg.light);

    if (cfg.edl) {
      // Eye-Dome Lighting: a receding dot (edl→0) recedes AND shrinks; a
      // near/high ridge dot (edl→1) stays present and grows. Size coupling is
      // centered on 1× (sh=0.5 ⇒ unchanged) so mean size is kept.
      //
      // HOW the shade is spent is theme-dependent — see edlSpend() in terrain.ts.
      // Dark theme spends it on ALPHA (fading toward a near-black sky darkens the
      // dot, which is what an eye-dome shadow is). Light theme spends it mostly on
      // VALUE, because on the pale sky fading a dot LIGHTENS it — the shipped
      // alpha-only version ran the shape cue backwards and bleached the ridge into
      // the sky, which is what made the mountain read as mush over the fluid.
      const sh = p.edl;
      const spend = edlSpend(sh, cfg.darkness, cfg.edlFloor);
      color = [color[0] * spend.value, color[1] * spend.value, color[2] * spend.value];
      alpha *= spend.alpha;
      r *= 1 + cfg.edlSizeRange * (sh - 0.5);
      // Elevation emphasis: the mountain IS the high ground — diminish the
      // valley (hn→0) toward (1−emphasis) and shrink it so the ridge carries form.
      const e = cfg.elevEmphasis;
      alpha *= 1 - e * (1 - hn);
      r *= (1 - e * 0.5) + (e * 0.5) * hn;
    }

    let [cr, cg, cb] = color;

    // ── STARS: the mountain's dots ARE the star field (dark theme only) ────
    // The dark theme's whole conceit is that these dots read as stars, so make it
    // literal — each dot twinkles on its own phase and carries a stellar
    // temperature tint. Deliberately gated on cfg.starfield so the shipped LIGHT
    // terrain (warm ochre→indigo relief) is bit-for-bit unchanged.
    if (cfg.starfield) {
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

// Re-export a couple of helpers the callers want alongside this module.
export { projectRaw, field };
