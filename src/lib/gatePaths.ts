// src/lib/gatePaths.ts
//
// THE GATE'S GEOMETRY, COMPUTED AT BUILD TIME. The first-visit gate draws gradient-descent trails on the
// SAME loss field the hero paints, through the SAME camera, so the moment it dissolves the shapes on screen
// already rhyme with the shapes behind them. Nothing here runs in the browser: Gate.astro calls gateTrails()
// during the build and ships the result as static SVG, so the visual costs zero runtime JS.
//
// WHY NOT THE REFERENCE'S 36 HARDCODED BEZIERS. The design this replaces (21st.dev's BackgroundPaths) builds
// its curves from magic-number control points. That is the exact thing this site's own rule rejects — five
// showpieces were binned for "looking like they meant something without meaning anything", and the
// replacement rule is that the surface has to be real math, computed. These curves ARE descent runs, so they
// converge into the field's three basins instead of running parallel. That is a visible difference from the
// reference and it was accepted deliberately: convergence downward is the site's whole metaphor.
//
// `grad` is deliberately NOT imported here — noUnusedLocals is on, and this module never needs the gradient
// directly (runDescent already walks it). tests/gatePaths.test.ts imports grad from ./terrain itself to
// assert convergence.
import { RANGE, field, project, runDescent } from './terrain';
import { TERRAIN_CONFIG_DEFAULTS } from './terrainRender';

export interface Pt { x: number; y: number }
export interface Trail {
  /** SVG path data, rounded to 0.1px. */
  d: string;
  /** Index among the SURVIVING trails, which is what the CSS stagger and ramps key off. */
  i: number;
  opacity: number;
  width: number;
}

/** viewBox of the gate's SVG. Fixed, so the paths are resolution-independent markup. */
export const GATE_VIEW_W = 1200;
export const GATE_VIEW_H = 800;

/** 6 x 6 = 36, matching the reference's density. */
export const LATTICE = 6;
export const SPAWN_COUNT = LATTICE * LATTICE;

/** Minimum projected extent, in viewBox px, for a trail to be worth drawing. See gateTrails. */
export const MIN_SPAN = 24;

/**
 * The hero's camera, imported rather than retyped. TerrainHero.astro's own comment is the reason:
 * "walkers must use the SAME zoom to stay on the surface". The gate is in the same position — if this
 * number drifts from the renderer's, the trails stop lining up with the terrain they dissolve into.
 */
const ZOOM = TERRAIN_CONFIG_DEFAULTS.zoom;

/**
 * Deterministic [0,1) from an integer. This exists because the reference seeded its per-path timing with
 * `Math.random()`, and this site has a standing determinism rule — the Rules slide's fan is a seeded walk
 * precisely because "a fan that shimmered between builds would undercut a slide whose whole claim is that
 * the scale is real". The same reasoning applies to a picture rebuilt on every deploy.
 */
export function hash01(n: number): number {
  let h = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** A lattice over the field, each point nudged off its cell centre so the fans do not read as a grid. */
export function gateSpawns(): Array<[number, number]> {
  const cell = (2 * RANGE) / LATTICE;
  const out: Array<[number, number]> = [];
  for (let row = 0; row < LATTICE; row++) {
    for (let col = 0; col < LATTICE; col++) {
      const i = row * LATTICE + col;
      // 0.9 of a half-cell keeps a jittered point inside its own cell, so coverage stays even.
      const jx = (hash01(i * 2) - 0.5) * cell * 0.9;
      const jy = (hash01(i * 2 + 1) - 0.5) * cell * 0.9;
      out.push([
        -RANGE + cell * (col + 0.5) + jx,
        -RANGE + cell * (row + 0.5) + jy,
      ]);
    }
  }
  return out;
}

/** The world-space descent from one spawn. Exported so a test can assert convergence before projection. */
export function gateDescent(x0: number, y0: number): Array<Pt> {
  return runDescent(x0, y0);
}

const r1 = (n: number): number => Math.round(n * 10) / 10;

/** Centripetal exponent. 0 would be uniform (the version that cusped), 1 would be chordal. */
const ALPHA = 0.5;

/** Knot spacing between two points, centripetally weighted. Floored so coincident samples cannot divide by 0. */
const knot = (a: Pt, b: Pt): number => Math.max(1e-6, Math.hypot(b.x - a.x, b.y - a.y) ** ALPHA);

/**
 * Tangent at `cur`, as a weighted average of the two one-sided slopes.
 *
 * The weights are the OPPOSITE intervals, which is the whole trick: it stops a long segment from dominating
 * the short one next to it. With equal spacing this collapses to (next - prev) / 2, i.e. the uniform case.
 * A clamped endpoint (prev === cur, or next === cur) falls back to the one-sided slope rather than averaging
 * against a zero-length interval, which would otherwise flatten the ends to a near-zero tangent.
 */
function tangent(prev: Pt, cur: Pt, next: Pt): Pt {
  const d0 = knot(prev, cur);
  const d1 = knot(cur, next);
  const s0 = { x: (cur.x - prev.x) / d0, y: (cur.y - prev.y) / d0 };
  const s1 = { x: (next.x - cur.x) / d1, y: (next.y - cur.y) / d1 };
  if (d0 <= 1e-5) return s1;
  if (d1 <= 1e-5) return s0;
  return {
    x: (s0.x * d1 + s1.x * d0) / (d0 + d1),
    y: (s0.y * d1 + s1.y * d0) / (d0 + d1),
  };
}

/**
 * CENTRIPETAL Catmull-Rom through the points, emitted as cubic Béziers.
 *
 * IT WAS UNIFORM FIRST AND THAT WAS A REAL BUG, visible on screen as spikes and a tangle where the trails
 * converge. Measured on the shipped set: within a single trail the segment-length ratio reaches **412.8x**,
 * because gradient descent sprints down a steep slope and crawls near a minimum while runDescent downsamples
 * by INDEX rather than by arc length. Uniform Catmull-Rom overshoots once that ratio passes roughly 5 — the
 * control point for a short segment gets thrown out past its neighbours — and the rendered curve contained a
 * **173.8-degree** turn, which is a hairpin, not a curve.
 *
 * Centripetal parameterisation (alpha = 0.5) is the textbook answer and it is a guarantee, not a tuning: the
 * curve provably cannot cusp or self-intersect regardless of how uneven the input spacing is. The cost is one
 * sqrt per knot at build time.
 *
 * runDescent's 10 iterates are still plenty for a smooth stroke, so this converts them rather than asking
 * that tested function for a new resolution parameter.
 */
export function catmullRomPath(pts: readonly Pt[]): string {
  if (pts.length === 0) return '';
  const first = pts[0];
  if (pts.length === 1) return `M${r1(first.x)},${r1(first.y)}`;
  const at = (i: number): Pt => pts[Math.min(pts.length - 1, Math.max(0, i))];
  let d = `M${r1(first.x)},${r1(first.y)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p1 = at(i), p2 = at(i + 1);
    const m1 = tangent(at(i - 1), p1, p2);
    const m2 = tangent(p1, p2, at(i + 2));
    const h = knot(p1, p2) / 3;
    d += `C${r1(p1.x + m1.x * h)},${r1(p1.y + m1.y * h)}`
      + ` ${r1(p2.x - m2.x * h)},${r1(p2.y - m2.y * h)}`
      + ` ${r1(p2.x)},${r1(p2.y)}`;
  }
  return d;
}

/**
 * Does a projected path go anywhere?
 *
 * A Gaussian's centre is a stationary point, so a spawn landing on one makes runDescent break on its first
 * iteration and return ten copies of a single coordinate — which draws as nothing, or as a dot. This is the
 * guard against shipping such a path.
 *
 * MEASURED, SO THE COMMENT CAN BE HONEST: today it drops NOTHING. All 36 spawns produce real trails. The
 * un-jittered 6x6 lattice does put a point at (-1.3, -0.433), about 0.1 from the BUMPS centre (-1.4, -0.5) —
 * which is what made this look urgent while planning — but the jitter moves that point clear, and even the
 * flattest spawn in the set (|grad| = 0.0497, out in the corner where every Gaussian has decayed) still
 * travels 1.9 world units over 140 iterations. So this is a guard, not a filter that currently does work.
 * It is kept because the spawn set is tuning-sensitive: change LATTICE, RANGE, the jitter factor or BUMPS and
 * the collision comes back silently. It is exported so a test can hand it a degenerate path directly —
 * asserting on gateTrails()'s output count proved nothing while nothing was being dropped.
 */
export function hasRealExtent(pts: readonly Pt[]): boolean {
  if (pts.length === 0) return false;
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const span = Math.max(
    Math.max(...xs) - Math.min(...xs),
    Math.max(...ys) - Math.min(...ys),
  );
  return span >= MIN_SPAN;
}

/**
 * The shipped trails. Degenerate paths are dropped by hasRealExtent (see the note there for why that
 * currently removes nothing and is kept anyway), so the count is allowed to come in under SPAWN_COUNT.
 */
export function gateTrails(): Trail[] {
  const projected = gateSpawns().map(([x0, y0]) =>
    // field() ALREADY folds in ZSCALE (`return z * ZSCALE`) — multiplying again here would double the
    // relief and lift the trails off the surface. terrainRender.ts passes field() straight through too.
    gateDescent(x0, y0).map(({ x, y }) => {
      const [sx, sy] = project(x, y, field(x, y), GATE_VIEW_W, GATE_VIEW_H, ZOOM);
      return { x: sx, y: sy };
    }),
  );

  const kept = projected.filter(hasRealExtent);

  const last = Math.max(1, kept.length - 1);
  return kept.map((pts, i) => {
    const t = i / last;
    return {
      d: catmullRomPath(pts),
      i,
      // The reference graded opacity and width together to fake depth; same idea, clamped and computed
      // here so the markup carries the numbers and the runtime does no work.
      opacity: Math.round((0.1 + t * 0.45) * 1000) / 1000,
      width: Math.round((0.5 + t * 1.1) * 100) / 100,
    };
  });
}
