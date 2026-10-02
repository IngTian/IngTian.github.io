// src/lib/gatePaths.ts
//
// THE GATE'S SHARED DRAWING TOOLKIT: the viewBox it draws into, the shape of a stroke, and the spline that
// turns a polyline into a smooth path. That is all this file is now, and the shrinking is the point.
//
// IT USED TO GENERATE THE LINES TOO, from gradient descent run to convergence on a 6x6 lattice of starts —
// gateTrails/gateSpawns/gateDescent/hasRealExtent/hash01 and the lattice constants. The owner looked at the
// result: "ur lines are horrible." The measurements agreed, and in a way that no tuning could fix: every
// descent run ends in one of the field's three minima, so 36 strokes piled into 3 points (71% of the set
// inside one cell of a 20x20 grid, 271 pair crossings) with a 22x spread in length. Three replacements were
// built and compared in /proto-gate; combed contours won, and they live in lib/gateLines.ts.
//
// So that generator has no caller left anywhere in src. `noUnusedLocals` cannot see that — an export is a
// public API as far as the compiler is concerned — which is precisely the case CLAUDE.md says "still needs a
// grep". The grep was run; this deletion is its result.
//
// WHAT SURVIVES IS THE PART THAT EARNED IT. catmullRomPath is centripetal, and that was the one real bug
// behind the owner's verdict rather than a matter of composition: gradient descent sprints down a steep slope
// and crawls near a minimum, so a trail's points were up to 412.8x unevenly spaced, and uniform Catmull-Rom
// overshoots past about 5x — the rendered curve held a 173.8-degree hairpin. Centripetal cannot cusp at any
// spacing, and every candidate treatment was built on top of it.
// NO IMPORTS. Worth noticing rather than passing over: this file used to pull in RANGE, field, project and
// runDescent from terrain.ts plus the renderer's camera config, because it generated the geometry itself. With
// the generator gone it depends on nothing at all — it is pure 2D curve arithmetic, and the knowledge of the
// loss field and the camera now lives in exactly one place, lib/gateLines.ts. The typecheck gate is what
// pointed this out, by failing on the orphaned import the moment the generator was removed.

export interface Pt { x: number; y: number }
export interface Trail {
  /** SVG path data, rounded to 0.1px. */
  d: string;
  /** Index among the SURVIVING trails, which is what the CSS stagger and ramps key off. */
  i: number;
  opacity: number;
  width: number;
  /**
   * The curve's arc length in user units, when the producer knows it.
   *
   * Optional because only the ported reference geometry needs it. It exists because dashing a long path via
   * pathLength="1" and fractional dash values renders as a sub-unit stipple in Chrome — the scale factor is
   * ~2000x and the dash computation loses precision. Knowing the real length lets the dash and its offset be
   * plain user units, with nothing scaled.
   */
  len?: number;
}

/** viewBox of the gate's SVG. Fixed, so the paths are resolution-independent markup. */
export const GATE_VIEW_W = 1200;
export const GATE_VIEW_H = 800;

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
