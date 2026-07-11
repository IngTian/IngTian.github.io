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
  colormap, RANGE, STEP,
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

  interface Dot { sx: number; sy: number; depth: number; z: number; ndl: number; edl: number }
  const rd: Dot[] = [];
  for (const g of grid) {
    let z = field(g.x, g.y);
    z += breathAmp * Math.sin(tsec * breathHz + g.x * 0.7 + g.y * 0.6);
    const [sx, sy, depth] = project(g.x, g.y, z, W, Hh, cfg.zoom);
    const ndl = lit ? g.nx * Lx + g.ny * Ly + g.nz * Lz : 0;
    rd.push({ sx, sy, depth, z, ndl, edl: g.edl });
  }
  rd.sort((p, q) => p.depth - q.depth); // painter's order: far first

  const fadeStart = Hh * 0.84;
  for (const p of rd) {
    if (p.sx < -20 || p.sx > W + 20 || p.sy < -20 || p.sy > Hh + 20) continue;
    const hn = Math.max(0, Math.min(1, (p.z + ZR) / (2 * ZR)));
    let r = (2.9 - hn * 1.6) * DPR * cfg.zoom * cfg.dotScale;
    let alpha = 0.30 + (1 - hn) * 0.45;
    if (p.sy > fadeStart) alpha *= Math.max(0, 1 - (p.sy - fadeStart) / (Hh - fadeStart));

    let color = colormap(hn, cfg.ramp);
    if (lit) color = litColor(color, p.ndl, cfg.darkness, cfg.light);

    if (cfg.edl) {
      // Eye-Dome Lighting: a receding dot (edl→0) dims toward the floor AND
      // shrinks; a near/high ridge dot (edl→1) stays bright and grows. Size
      // coupling is centered on 1× (sh=0.5 ⇒ unchanged) so mean size is kept.
      const sh = p.edl;
      alpha *= cfg.edlFloor + (1 - cfg.edlFloor) * sh;
      r *= 1 + cfg.edlSizeRange * (sh - 0.5);
      // Elevation emphasis: the mountain IS the high ground — diminish the
      // valley (hn→0) toward (1−emphasis) and shrink it so the ridge carries form.
      const e = cfg.elevEmphasis;
      alpha *= 1 - e * (1 - hn);
      r *= (1 - e * 0.5) + (e * 0.5) * hn;
    }

    if (alpha <= 0.004) continue;
    const [cr, cg, cb] = color;
    ctx.beginPath();
    ctx.arc(p.sx, p.sy, Math.max(0.5, r), 0, 2 * Math.PI);
    ctx.fillStyle = `rgba(${cr | 0},${cg | 0},${cb | 0},${alpha.toFixed(3)})`;
    ctx.fill();
  }
}

// Re-export a couple of helpers the callers want alongside this module.
export { projectRaw, field };
