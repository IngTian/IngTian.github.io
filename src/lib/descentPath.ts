// src/lib/descentPath.ts
// THE CAREER AS A DESCENT — geometry for the part-1 graph, in 2D plan and 3D oblique.
//
// Pure: no canvas, no DOM. `project()` has two projections over one path, flat (a survey map, where the
// barrier's contours are legible) and in relief; the page renders plan only, the owner's choice
// (DescentPath.astro).
//
// THE GLOBAL MINIMUM IS NOT LABELLED AND THE PATH STOPS SHORT OF IT: placing the PhD at the deepest point
// would assert arrival at the optimum. The owner: "I have no idea where the global min is. Maybe a future
// quant researcher." So it is a soft, unlabelled attractor the trail heads toward. The bounds come from the
// waypoints plus the two basins, so the path fills the frame by construction.
//
// Same field() as the hero, different subject: the hero shows an anonymous field with anonymous walkers,
// this shows ONE named trajectory with its barrier called out — a career, not a surface.
//
// This module reads the field's HEIGHT and never its slope: the descending is trajectory.ts's settle().
import { field, RANGE } from './terrain';
import { isoRuns, isoLevels } from './marchingSquares';
import { WAYPOINTS, trajectoryFacts, type Waypoint } from './trajectory';

export type Projection = '2d' | '3d';

export interface View {
  w: number;
  h: number;
  projection: Projection;
  /** Screen padding, so labels have somewhere to live. */
  pad: { l: number; r: number; t: number; b: number };
}

/** World bounds that contain the whole story: every waypoint plus both basins, with margin.
 *  Deriving this rather than using RANGE is what fixes the corner-cram.
 *
 *  MEMOISED, and this is the fix for a 0.6fps animation rather than a micro-optimisation.
 *  storyBounds() calls trajectoryFacts(), which runs FOUR 3000-step gradient descents. project()
 *  calls storyBounds() once per point, and the renderer projects ~3000 contour points per frame —
 *  about 36 MILLION gradient steps per frame. A CPU profile put 89% of all time in settle(); five
 *  earlier fixes missed it because the call was buried two levels down inside project(). The bounds
 *  depend only on module constants, so they are computed once. */
let boundsCache: { margin: number; v: ReturnType<typeof computeBounds> } | null = null;

export function storyBounds(margin = 0.55) {
  if (boundsCache && boundsCache.margin === margin) return boundsCache.v;
  const v = computeBounds(margin);
  boundsCache = { margin, v };
  return v;
}

function computeBounds(margin: number) {
  const f = trajectoryFacts();
  const xs = [...WAYPOINTS.map((w) => w.x), f.localBasin.x, f.globalBasin.x];
  const ys = [...WAYPOINTS.map((w) => w.y), f.localBasin.y, f.globalBasin.y];
  return {
    x0: Math.max(-RANGE, Math.min(...xs) - margin),
    x1: Math.min(RANGE, Math.max(...xs) + margin),
    y0: Math.max(-RANGE, Math.min(...ys) - margin),
    y1: Math.min(RANGE, Math.max(...ys) + margin),
  };
}

/** Project a world point to screen. In '2d' this is an axis-aligned map; in '3d' an oblique view
 *  with the field's height raising the point, so the barrier becomes a ridge you can see over. */
export function project(x: number, y: number, view: View): [number, number] {
  const b = storyBounds();
  const iw = view.w - view.pad.l - view.pad.r;
  const ih = view.h - view.pad.t - view.pad.b;
  const u = (x - b.x0) / (b.x1 - b.x0);
  const v = (y - b.y0) / (b.y1 - b.y0);

  if (view.projection === '2d') {
    return [view.pad.l + u * iw, view.pad.t + (1 - v) * ih];
  }
  // Oblique: y recedes up-and-right, z lifts. Chosen over a true perspective camera because the
  // whole point is COMPARING two encodings of the same path — a parallel projection keeps
  // distances comparable between the flat and raised views.
  const z = field(x, y);
  const SHEAR = 0.42;      // how much depth pushes right
  const ZLIFT = 0.34;      // how much height lifts
  const sx = view.pad.l + (u + v * SHEAR * 0.5) * iw * 0.86;
  const sy = view.pad.t + (1 - v * 0.55) * ih - z * ZLIFT * ih;
  return [sx, sy];
}

let storyCache: [number, number][][][] | null = null;

/**
 * THE STORY GRAPH'S CONTOURS: every level's runs, deepest first — 11 levels through the story's own height
 * range (measured on a 61² lattice, so no level is wasted off-frame), each traced at res 150 over
 * `storyBounds()` by the shared kernel in lib/marchingSquares.ts. Runs are continuous polylines, not the
 * disconnected 1px stubs an earlier sketch drew.
 *
 * MEMOISED, and the reason it lives in `lib/` rather than in the component. The set is 17 polylines / 2838
 * points and costs **53-67 ms of synchronous main thread**, measured over 8 runs on node 24, and
 * `DescentPath.astro` re-inits on every `astro:page-load` and every `theme:change`. No test reads
 * `DescentPath.astro`, so a cache there could move back inside `init()` with every test green; here
 * `tests/descentPath.test.ts` pins it. One slot and no key, like `introContours()`: there is one call site
 * and its inputs (`storyBounds()`, itself memoised, and the pure `field()`) never vary.
 *
 * THE RETURNED ARRAYS ARE SHARED AND READ-ONLY BY CONTRACT. Callers draw from them; nothing may mutate them.
 */
export function storyContours(): [number, number][][][] {
  if (!storyCache) {
    const b = storyBounds();
    storyCache = isoLevels(field, b, 11, 60).map((l) => isoRuns(field, b, l, 150));
  }
  return storyCache;
}

// ── The trail ───────────────────────────────────────────────────────────────

export interface TrailPoint {
  x: number;
  y: number;
  /** Field height here — used to colour the trail and to detect the climb. */
  z: number;
  /** 0..1 along the whole trail, for animating the reveal. */
  t: number;
  /** True where the trail is going UP. This is the escape, and it is the whole point. */
  climbing: boolean;
  /** Index of the waypoint this segment is heading toward. */
  toward: number;
}

/**
 * The trail, as a CATMULL-ROM SPLINE through the waypoints.
 *
 * The previous version interpolated each pair of waypoints LINEARLY and bent the middle downhill.
 * That produces a path whose direction changes discontinuously at every stop, and the eye reads
 * those corners as discrete steps — the owner's "the curve is like going one step at a time, HARD".
 *
 * A Catmull-Rom spline is C1 continuous by construction: position and velocity both carry through
 * each waypoint, so the walk CURVES rather than turning. Catmull-Rom specifically (rather than a
 * Bezier) because it passes THROUGH its control points — the waypoints are real declared positions
 * and the curve has to actually visit them, not merely be influenced by them.
 */
export function trail(samples = 360): TrailPoint[] {
  const pts = WAYPOINTS.map((w) => [w.x, w.y] as [number, number]);
  const n = pts.length;
  const at = (i: number) => pts[Math.max(0, Math.min(n - 1, i))];

  const out: TrailPoint[] = [];
  for (let s = 0; s <= samples; s++) {
    const u = (s / samples) * (n - 1);          // 0 .. n-1 across the whole path
    const i = Math.min(n - 2, Math.floor(u));
    const t = u - i;
    const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
    const t2 = t * t, t3 = t2 * t;
    const x = 0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t +
      (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 +
      (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3);
    const y = 0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t +
      (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 +
      (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3);

    const z = field(x, y);
    const prev = out[out.length - 1];
    // Climbing is decided against the PREVIOUS SAMPLE, not against a leg's endpoints, so the red
    // stretch marks exactly where the path actually rises — a shorter and truer span than "the whole
    // leg between two jobs".
    const climbing = prev ? z > prev.z + 1e-6 : false;
    out.push({ x, y, z, t: s / samples, climbing, toward: Math.min(n - 1, i + 1) });
  }
  return out;
}

// `waypointT(i)` lived here — the trail parameter at which the walk reaches waypoint i, which is exactly
// i / (WAYPOINTS.length - 1) because the waypoints are evenly spaced in the spline's parameter. It was never
// imported. The one place that needs the number, components/DescentPath.astro's waypoint loop, writes that
// same division inline against its local `reveal`, and has since it was written.
//
// So this is a duplicate with no callers, not a shared helper: exporting it from here made the module look
// like the owner of a rule the drawing code had already decided for itself. Deleted in that direction rather
// than the other, because a one-expression identity is cheaper to state where it is used than to import — but
// if a second consumer ever appears, put the helper back and change DescentPath.astro at the same time. One
// place or the other, never both.

/**
 * Position on the trail at parameter t in [0, 1] — the walker's own location, which advances the knowledge
 * frontier in lib/knowledge.ts.
 *
 * NEAREST SAMPLE, not interpolated: the trail is already 361 points, so the step is ~0.3% of the path and
 * the frontier cannot see it. Lives here rather than inside DescentPath's `<script>` for one reason: the
 * discovery story ("the deeper basin is invisible at every stop until the last stretch") is a claim the page
 * PRINTS, and tests/knowledge.test.ts can only hold it to that if it walks the exact path the page walks. A
 * copy of this in the test would be a hand-synced pair, which is the failure this repo keeps documenting.
 */
export function trailSampler(pts: readonly { x: number; y: number }[]): (t: number) => { x: number; y: number } {
  return (t) => {
    const p = pts[Math.min(pts.length - 1, Math.max(0, Math.round(t * (pts.length - 1))))];
    return { x: p.x, y: p.y };
  };
}

/** Where the trail turns upward, as a t-range — for calling out the escape. */
export function climbSpan(pts: readonly TrailPoint[]): { t0: number; t1: number } | null {
  const climbing = pts.filter((p) => p.climbing);
  if (!climbing.length) return null;
  return { t0: climbing[0].t, t1: climbing[climbing.length - 1].t };
}

/** The unknown attractor: the field's deepest point, drawn WITHOUT a label. It is where the trail
 *  is heading, not where it has arrived. Memoised for the same reason as storyBounds. */
let attractorCache: { x: number; y: number; depth: number } | null = null;
export function unknownAttractor(): { x: number; y: number; depth: number } {
  return (attractorCache ??= trajectoryFacts().globalBasin);
}

export type { Waypoint };

/**
 * WHEN A WAYPOINT'S NAME IS DRAWN, AND AT WHAT OPACITY.
 *
 * Pure, and in `lib/` for a specific reason: this rule has now produced two separate bugs in the
 * component, both invisible to the test suite because the arithmetic lived inside a canvas draw loop.
 *
 *   1. The owner reported the last tag — "PhD · Operations Research" — appearing a few hundred ms after
 *      the path finished. Cause: arrivals are `i / (n - 1)`, so the last one is exactly 1, and the fade
 *      was `(reveal - arrival) / WP_FADE`. That is negative for every `reveal < 1`, so the label was
 *      invisible until a `reveal >= 1` short-circuit flipped it to full opacity in ONE frame. Compounded
 *      by the easing: smootherstep has zero end-velocity, so `reveal` is already ≥ 0.99 at 85% of the
 *      walk and the path looks finished ~941ms before it is.
 *   2. The first fix clamped the window's start — and put the clamp BELOW an early return that bailed on
 *      `arrival > reveal`. For the one waypoint the fix existed for, the function returned before the
 *      fade was ever evaluated. It shipped as dead code and the label went on popping.
 *
 * Both are arithmetic, and arithmetic belongs where a spec can reach it. `tests/descentFade.test.ts`
 * pins the window, the monotonicity, and that no other waypoint's timing moved.
 *
 * @param i       waypoint index
 * @param n       total waypoints
 * @param reveal  0..1, how much of the trail is drawn (already eased)
 * @param width   fade length in REVEAL units, not ms, so it stays in step however the walk is paced
 * @returns 0 = do not draw at all, otherwise the alpha to draw the dot and its name at
 */
export function waypointFade(i: number, n: number, reveal: number, width: number): number {
  const arrival = n > 1 ? i / (n - 1) : 0;
  // THE WINDOW'S START, CLAMPED SO IT ALWAYS LEAVES ROOM TO FADE. For every waypoint but the last this is
  // just `arrival` (the last-but-one arrives at (n-2)/(n-1), comfortably below 1 - width for any sane
  // width), so their timing is untouched. For the last it pulls the window back so the fade COMPLETES at
  // reveal 1 instead of starting there — it lands with the trail rather than after it.
  const start = Math.min(arrival, 1 - width);
  // Gate on START, not arrival. Gating on arrival is bug (2): it hides the very waypoint the clamp exists
  // for, for the entire walk.
  if (start > reveal + 1e-6) return 0;
  if (reveal >= 1) return 1;
  return Math.min(1, Math.max(0, (reveal - start) / width));
}
