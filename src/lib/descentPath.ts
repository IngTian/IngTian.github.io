// src/lib/descentPath.ts
// THE CAREER AS A DESCENT — geometry for the part-1 graph, in 2D plan and 3D oblique.
//
// Pure: no canvas, no DOM. Two projections over one path, so the same waypoints can be compared
// flat (a survey map, where the barrier's contours are legible) and in relief (where the climb is
// physically obvious). The owner asked for both so he can judge which reads better.
//
// WHAT CHANGED AND WHY, because two of these are honesty fixes rather than polish:
//
// 1. THE GLOBAL MINIMUM IS NOT LABELLED AND THE PATH STOPS SHORT OF IT. An earlier draft put the
//    PhD exactly at the field's deepest point, which asserts arrival at the optimum. His own
//    correction: "I have no idea where the global min is. Maybe a future quant researcher." So the
//    deepest point is drawn as an unknown — a soft, unlabelled attractor the trail is heading
//    toward and has not reached.
// 2. FIT THE PATH TO THE FRAME. The first render crammed everything into the top-right corner
//    because the projection was centred on the field, not on the path. The bounds now come from
//    the waypoints themselves plus the two basins, so the composition is filled by construction.
//
// A reviewer also caught that contours of terrain.ts's own field() are the hero's object with
// different hatching. That criticism is right for a REPLACEMENT of the hero. It is not right for
// this: the hero shows an anonymous field with anonymous walkers, and this shows ONE named
// trajectory with its barrier called out. Same field, different subject — a career, not a surface.
// The section header should say so plainly rather than pretend the field is new.

import { field, grad, RANGE } from './terrain';
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

/** Contour polylines of the field, as world-space point runs. Marching squares proper, so the
 *  result is連 continuous lines rather than the disconnected 1px stubs an earlier sketch drew —
 *  which is why its contours were invisible. */
export function contours(level: number, res = 150): [number, number][][] {
  const b = storyBounds();
  const runs: [number, number][][] = [];
  const dx = (b.x1 - b.x0) / res;
  const dy = (b.y1 - b.y0) / res;

  // Collect line segments per cell, then stitch them into runs by matching endpoints.
  const segs: [[number, number], [number, number]][] = [];
  const interp = (
    xa: number, ya: number, va: number, xb: number, yb: number, vb: number,
  ): [number, number] => {
    const t = (level - va) / (vb - va);
    return [xa + (xb - xa) * t, ya + (yb - ya) * t];
  };

  for (let i = 0; i < res; i++) {
    for (let j = 0; j < res; j++) {
      const x0 = b.x0 + i * dx, y0 = b.y0 + j * dy;
      const x1 = x0 + dx, y1 = y0 + dy;
      const v00 = field(x0, y0), v10 = field(x1, y0), v11 = field(x1, y1), v01 = field(x0, y1);
      // Which corners are above the level: standard marching-squares case index.
      const code = (v00 > level ? 1 : 0) | (v10 > level ? 2 : 0) | (v11 > level ? 4 : 0) | (v01 > level ? 8 : 0);
      if (code === 0 || code === 15) continue;
      const bottom = () => interp(x0, y0, v00, x1, y0, v10);
      const right = () => interp(x1, y0, v10, x1, y1, v11);
      const top = () => interp(x1, y1, v11, x0, y1, v01);
      const left = () => interp(x0, y1, v01, x0, y0, v00);
      const push = (a: [number, number], c: [number, number]) => segs.push([a, c]);
      switch (code) {
        case 1: case 14: push(left(), bottom()); break;
        case 2: case 13: push(bottom(), right()); break;
        case 3: case 12: push(left(), right()); break;
        case 4: case 11: push(right(), top()); break;
        case 5: push(left(), top()); push(bottom(), right()); break;
        case 6: case 9: push(bottom(), top()); break;
        case 7: case 8: push(left(), top()); break;
        case 10: push(left(), bottom()); push(right(), top()); break;
      }
    }
  }

  // Stitch: greedily extend a run while some segment starts near its end.
  const used = new Array(segs.length).fill(false);
  const near = (a: [number, number], c: [number, number]) => Math.hypot(a[0] - c[0], a[1] - c[1]) < dx * 1.2;
  for (let s = 0; s < segs.length; s++) {
    if (used[s]) continue;
    used[s] = true;
    const run: [number, number][] = [segs[s][0], segs[s][1]];
    let extended = true;
    while (extended) {
      extended = false;
      for (let k = 0; k < segs.length; k++) {
        if (used[k]) continue;
        const [a, c] = segs[k];
        if (near(run[run.length - 1], a)) { run.push(c); used[k] = true; extended = true; }
        else if (near(run[run.length - 1], c)) { run.push(a); used[k] = true; extended = true; }
        else if (near(run[0], c)) { run.unshift(a); used[k] = true; extended = true; }
        else if (near(run[0], a)) { run.unshift(c); used[k] = true; extended = true; }
      }
    }
    if (run.length > 3) runs.push(run);
  }
  return runs;
}

/** Contour levels spanning the story's actual height range, so no level is wasted off-frame. */
export function contourLevels(n = 11): number[] {
  const b = storyBounds();
  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i <= 60; i++) {
    for (let j = 0; j <= 60; j++) {
      const z = field(b.x0 + ((b.x1 - b.x0) * i) / 60, b.y0 + ((b.y1 - b.y0) * j) / 60);
      if (z < lo) lo = z;
      if (z > hi) hi = z;
    }
  }
  return Array.from({ length: n }, (_, k) => lo + ((hi - lo) * (k + 0.5)) / n);
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
