// src/lib/gateVariants/descentTrunc.ts
//
// TRUNCATED DESCENT — the shipped gate's picture, cut before it converges.
//
// The owner's verdict on the shipped version was "ur lines are horrible", and the three measured causes were:
// a 173.8-degree hairpin (fixed in gatePaths.ts by going centripetal), a knot in the middle of the screen
// where all 36 descents pile into the field's 3 basins, and no rhythm at all — a 22x spread between the
// longest and the shortest trail, with 19 of 36 trails leaving the viewBox and re-entering from nowhere.
//
// This variant keeps the metaphor completely intact — every stroke is still a real gradient-descent
// trajectory on the same loss field, through the same camera — and removes the knot by the cheapest honest
// means available: STOP EACH TRAIL LONG BEFORE ITS BASIN. A descent only tangles because it is drawn all the
// way to the attractor it shares with its neighbours; the first third of the same curve is a clean, coherent
// downhill stroke. So the picture becomes a streamline plot of the gradient flow rather than a convergence
// diagram, which is what gets the reference's combed sweep out of real math instead of out of magic Béziers.
//
// WHY THIS WALKS `grad` ITSELF INSTEAD OF CALLING `runDescent`. runDescent is the right function for the hero
// and the wrong one here, for a specific reason: it returns exactly 10 points, downsampled BY INDEX from up
// to 141 iterates. Index downsampling is the very defect this variant is cutting away — within one shipped
// trail the segment lengths varied by 412.8x — and worse, it has already thrown away the information needed
// to cut by arc length. The first of those 10 points is often further along the curve than the whole target
// length of a truncated stroke, so there is nothing left to truncate. Walking the gradient directly costs
// about 15 lines and gives the resolution the cut needs. The curve traced is the same curve: see
// tests/gateVariantDescentTrunc.test.ts, which checks a truncated trail against runDescent's own iterates on
// the same spawn and against a half-step walk.
//
// THE PARAMETERISATION IS THE WHOLE TRICK. runDescent integrates x -= lr * grad, so it moves FAST on a steep
// slope and CRAWLS near a minimum — step count is not distance. This walks the same streamline with the
// gradient NORMALISED, so every step covers the same world distance. The path through space is identical (a
// streamline is a set of points, not a schedule); only the clock changes. That single change buys three
// things at once: a defined cut point ("stop at length L"), evenly spaced knots for the spline, and no
// crawling tail of near-coincident samples near a stationary point.
import { RANGE, field, grad, project } from '../terrain';
import { TERRAIN_CONFIG_DEFAULTS } from '../terrainRender';
import { GATE_VIEW_H, GATE_VIEW_W, type Pt, type Trail, catmullRomPath, hash01 } from '../gatePaths';

export const LABEL = 'Truncated descent';

export const NOTE = 'Each stroke is a genuine gradient-descent streamline on the hero’s loss field, walked '
  + 'with the gradient normalised so every step covers the same distance, and cut at a fixed on-screen length '
  + 'while the slope under it is still steep — so the flow reads as flow, and the three basins every descent '
  + 'would otherwise end in never get to tie the picture into a knot.';

/** Same camera as the hero and the shipped gate. Hardcoding 0.85 here is how the trails drift off the surface. */
const ZOOM = TERRAIN_CONFIG_DEFAULTS.zoom;

/**
 * 30 x 30 = 900 candidate starts, of which 35 survive.
 *
 * The 26x surplus is the point, not waste: the pass below is a REJECTION sampler, and four independent filters
 * eat candidates (the walk stalls on flat ground, the stroke leaves the viewBox, the projection turns it back on
 * itself, or it comes too close to a stroke already kept). The shipped version drew one trail per cell of a 6x6
 * lattice, so it had nothing to reject and its spacing was whatever the projection happened to hand it — which
 * is half of why the middle of the screen was a knot.
 */
const CANDIDATES = 30;

/**
 * World distance per Euler step along the normalised gradient.
 *
 * 0.005, AND THE OBVIOUS 0.02 WAS MEASURABLY WRONG. Explicit Euler's error is first order in the step, so the
 * number has to be checked rather than eyeballed: at 0.02 the traced path sat up to 7.1px off the converged
 * streamline (worst of 35 starts, measured against a 0.0025 walk), which is a visible error on a 300px stroke.
 * At 0.005 the worst knot on the shipped strokes sits 0.82px from where a 4x finer walk puts it — half a stroke
 * width — and the cost is 4x the steps, which at build time is ~10^5 extra gradient evaluations and a few
 * milliseconds. tests/gateVariantDescentTrunc.test.ts pins the 0.82px rather than trusting this paragraph.
 */
const WALK_STEP = 0.005;

/** Hard stop on the walk, so a pathological streamline cannot spin. 1200 steps is 6 world units, more than the
 *  field's full 5.2-unit width — a trail that has not reached its target length by then is a stall, not a path. */
const MAX_STEPS = 1200;

/** |grad| below which the field is flat enough that "downhill" has no meaningful direction. A candidate that
 *  hits this before reaching its target length is DROPPED rather than shipped short: a stub is exactly the
 *  22x length lottery this variant exists to remove. */
const FLAT = 5e-3;

/** Knots handed to the spline. 9 evenly spaced points over ~300px is a knot every ~37px — enough to carry the
 *  flow's curvature, few enough that the path data stays small. */
const SAMPLES = 9;

/** Safety cap only — the geometry settles at 35, so this is not what sets the count. It is here so that
 *  loosening MIN_SEP_PX cannot silently blow past the density the picture was judged at. */
const MAX_TRAILS = 40;

/**
 * Tuning expressed against the shipped 1200x800 viewBox. `trails(w, h)` scales all three by
 * min(w,h) / GATE_VIEW_H, so at the default size these ARE the measured pixel numbers and at any other size
 * the comb keeps its proportions.
 *
 * - LENGTH_PX: on-screen arc length every stroke is cut to. ~0.21 of the viewBox diagonal — long enough to read
 *   as a sweep, short enough that no stroke settles. Measured on the 35 that ship: every one ends with
 *   |grad| >= 0.150, which is 3x the 0.05 that gatePaths' own spec calls "converged", and with between 0.14 and
 *   1.34 world units of descent still to run. The closest call is that 0.14 — "long before the basin" would be
 *   an overclaim for that one stroke, "still on a real slope" is true for all of them.
 * - MIN_SEP_PX: the dart-throwing radius, and it is measured BETWEEN WHOLE STROKES, not between their starts.
 *   Separating only the starts was tried first and left a visible pinch: 8 strokes fanned out from
 *   well-separated heads and then ran together into a bundle around (700, 380), because they were all heading
 *   for the same basin. Separating the whole stroke is what actually removes the knot. The number is small
 *   (20px, vs 163px mean spacing for 36 well-spread points) because the constraint is now 9 knots deep — at
 *   45px only 12 strokes fit, and 24 is the floor the picture has to clear.
 * - INSET_PX: a stroke must lie entirely inside the viewBox with this margin. The shipped version had 19 of 36
 *   trails outside it, and because the SVG uses preserveAspectRatio="xMidYMid slice" those strokes walk off an
 *   edge and reappear elsewhere, which is the "lines from nowhere" half of the complaint.
 */
const LENGTH_PX = 300;
const MIN_SEP_PX = 20;
const INSET_PX = 18;

/**
 * Worst turning angle, in degrees, tolerated on a trail's own 9-knot polyline.
 *
 * This is the one filter that is a filter and not a guarantee. Gradient flow is smooth almost everywhere, but
 * a streamline passing close to a SADDLE of the field swings hard — it is nearly stationary there, so the
 * direction rotates a lot per unit distance. One such stroke in an otherwise calm comb reads as a kink.
 *
 * 34 is BINDING, not decorative: the worst turn among the strokes it keeps is 29.5 degrees, so the filter is
 * sitting just above what it admits and really is rejecting candidates. It is also well inside the 60-degree
 * bar the metrics ask for, and the measured slack is in the safe direction — the drawn Bézier's own control
 * polygon turns LESS than the knot polyline does (18.8 degrees worst, against the knots' 29.5), because
 * centripetal Catmull-Rom subdivides a turn across two control points instead of cornering at the knot.
 */
const MAX_TURN_DEG = 34;

// A NOTE ON WHY A DRAWN STROKE CAN COME OUT SHORTER THAN LENGTH_PX, since it looks like a bug and is not.
// The camera can run a descent BACKWARDS on screen: screen y = H*0.46 - (ry*cosT - z*sinT)*sc, and descending
// makes z fall, which pushes the stroke UP the screen while ry pushes it down. Where those cancel, the stroke's
// projected speed passes through zero and the path turns back on itself. At an earlier WALK_STEP of 0.02 one
// trail spent its last 75px of streamline arc moving 11px on screen, and the drawn stroke came out 236px
// instead of 300 — the excursion is finer than the knot spacing, so the curve stayed smooth and only the
// rhythm suffered (1.27x). An explicit "tautness" filter for this was written, measured, and DELETED: at the
// current step and separation it rejected nothing, because the strokes it would have caught were already
// losing to the whole-stroke separation. The length-rhythm assertion in the spec is the real guard, and it is
// a guard on the thing that matters (the drawn length) rather than on one cause of it.

/** Deterministic lattice of candidate starts, jittered off their cell centres by up to 0.45 of a cell so the
 *  survivors cannot inherit a grid. hash01, never Math.random: two builds of the same content must agree. */
function candidates(): Array<[number, number]> {
  const cell = (2 * RANGE) / CANDIDATES;
  const out: Array<[number, number]> = [];
  for (let row = 0; row < CANDIDATES; row++) {
    for (let col = 0; col < CANDIDATES; col++) {
      const i = row * CANDIDATES + col;
      out.push([
        -RANGE + cell * (col + 0.5) + (hash01(i * 2) - 0.5) * cell * 0.9,
        -RANGE + cell * (row + 0.5) + (hash01(i * 2 + 1) - 0.5) * cell * 0.9,
      ]);
    }
  }
  return out;
}

export interface Walked {
  /** SAMPLES points, evenly spaced in SCREEN arc length, in viewBox px. */
  pts: Pt[];
  /** The same SAMPLES points in WORLD coordinates. Carried only so a test can ask the field about them —
   *  "is this actually descent?" is not answerable from screen coordinates, and it is the claim the whole
   *  variant rests on. Nothing in the render path reads it. */
  world: Pt[];
  /** Depth of the start, from project(). Larger = nearer the camera; drives the opacity/width ramp. */
  depth: number;
}

/**
 * One truncated streamline, or null if it is not worth drawing.
 *
 * The cut is measured in SCREEN arc length, not world arc length, and that choice is load-bearing rather than
 * a shortcut. The camera is isometric: a unit world step contributes sqrt(rx^2 + (ry*cosT + |grad|*sinT)^2)
 * screen units with cosT = 0.606 and sinT = 0.796, so the same world distance becomes anywhere from ~0.61 to
 * ~1.8 screen units depending on the local slope and which way the stroke runs.
 *
 * SO THE BRIEF'S "same world-space arc length" WAS TRIED AND MEASURED, AND IT DOES NOT MEET THE BAR. Cutting
 * 465 on-screen starts at an identical 1.3 world units produced screen lengths from 124.5px to 450.5px — a
 * 3.62x spread, 2.65x between the 5th and 95th percentiles. The metric is "longest / shortest < 3.0", so equal
 * world length fails it outright, and it deserves to: the thing a viewer sees — the thing the owner called
 * horrible — is the length on screen. So the walk accumulates PROJECTED distance and stops on that, which is
 * still a cut of the same curve, just at the place that makes the picture even.
 *
 * Resampling is linear between consecutive walk points. That is accurate because the walk points are dense:
 * one WALK_STEP is ~1.2px on screen, so a chord through two of them is far inside the 0.1px the path data is
 * rounded to anyway.
 */
export function streamline(
  x0: number, y0: number, step: number, lengthPx: number, w: number, h: number,
): Walked | null {
  const toScreen = (x: number, y: number): [Pt, number] => {
    const [sx, sy, depth] = project(x, y, field(x, y), w, h, ZOOM);
    return [{ x: sx, y: sy }, depth];
  };

  const [head, depth] = toScreen(x0, y0);
  const poly: Pt[] = [head];
  const wld: Pt[] = [{ x: x0, y: y0 }];
  // Cumulative screen arc length at each poly point; cum[0] = 0 by construction.
  const cum: number[] = [0];
  let x = x0, y = y0;

  for (let k = 0; k < MAX_STEPS && cum[cum.length - 1] < lengthPx; k++) {
    const [gx, gy] = grad(x, y);
    const m = Math.hypot(gx, gy);
    if (m < FLAT) return null;              // stalled: a stationary point, or a decayed far corner
    x -= (gx / m) * step;                   // unit-speed descent: direction from the field, distance fixed
    y -= (gy / m) * step;
    const [p] = toScreen(x, y);
    const prev = poly[poly.length - 1];
    poly.push(p);
    wld.push({ x, y });
    cum.push(cum[cum.length - 1] + Math.hypot(p.x - prev.x, p.y - prev.y));
  }

  if (cum[cum.length - 1] < lengthPx) return null;   // ran out of steps before the target length

  // Even resample in screen arc length. `seg` only ever moves forward, so this is one pass over `poly`.
  const lerp = (a: Pt, b: Pt, t: number): Pt => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
  const pts: Pt[] = [];
  const world: Pt[] = [];
  let seg = 0;
  for (let i = 0; i < SAMPLES; i++) {
    const want = (lengthPx * i) / (SAMPLES - 1);
    while (seg < cum.length - 2 && cum[seg + 1] < want) seg++;
    const span = cum[seg + 1] - cum[seg];
    const t = span > 1e-9 ? (want - cum[seg]) / span : 0;
    pts.push(lerp(poly[seg], poly[seg + 1], t));
    world.push(lerp(wld[seg], wld[seg + 1], t));
  }
  return { pts, world, depth };
}

/**
 * Squared distance between the closest pair of knots on two strokes. Squared, so the dart-throwing test never
 * takes a square root — 900 candidates against up to 40 kept strokes is 81 pairs each, about 3M comparisons at
 * build time, which is nothing.
 *
 * KNOT-TO-KNOT, NOT POINT-TO-SEGMENT, AND THE DIFFERENCE IS VISIBLE, so it is stated rather than hidden. Knots
 * are ~37px apart, so two strokes crossing at right angles mid-segment have a nearest-knot distance of about
 * sqrt(18.5^2 + 18.5^2) = 26px while their true distance is zero. At MIN_SEP_PX = 20 such a crossing is
 * ACCEPTED, and a couple are visible in the rendered frame. That is deliberate: a crossing is not what the
 * owner objected to — a knot is, and a knot is many strokes running TOGETHER, which this does catch, because
 * strokes that bundle are near each other at knot after knot. Exact segment-to-segment distance is four times
 * the code to remove a feature of the picture rather than a defect in it.
 */
function nearest2(a: readonly Pt[], b: readonly Pt[]): number {
  let best = Infinity;
  for (const p of a) for (const q of b) best = Math.min(best, (p.x - q.x) ** 2 + (p.y - q.y) ** 2);
  return best;
}

/** Worst turn, in degrees, between consecutive chords of a polyline. Zero-length chords are skipped rather
 *  than feeding a 0/0 into the angle. */
export function worstTurnDeg(pts: readonly Pt[]): number {
  let worst = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const ax = pts[i].x - pts[i - 1].x, ay = pts[i].y - pts[i - 1].y;
    const bx = pts[i + 1].x - pts[i].x, by = pts[i + 1].y - pts[i].y;
    const la = Math.hypot(ax, ay), lb = Math.hypot(bx, by);
    if (la < 1e-9 || lb < 1e-9) continue;
    const cos = Math.max(-1, Math.min(1, (ax * bx + ay * by) / (la * lb)));
    worst = Math.max(worst, (Math.acos(cos) * 180) / Math.PI);
  }
  return worst;
}

/**
 * The strokes, as pure geometry. Exported separately from `trails` so the tests (and any future switcher that
 * wants to draw diagnostics) can measure the points instead of re-parsing path data.
 *
 * Candidates are visited in a hash-derived order, not lattice order, because dart-throwing in lattice order
 * would sweep row by row and bias every survivor to the top-left of its neighbourhood.
 */
export function combPoints(w = GATE_VIEW_W, h = GATE_VIEW_H): Walked[] {
  const s = Math.min(w, h) / GATE_VIEW_H;
  const lengthPx = LENGTH_PX * s;
  const minSep2 = (MIN_SEP_PX * s) ** 2;
  const inset = INSET_PX * s;

  const order = candidates()
    .map((c, i) => ({ c, k: hash01(i * 7 + 3) }))
    .sort((a, b) => a.k - b.k);

  const kept: Walked[] = [];
  for (const { c } of order) {
    if (kept.length >= MAX_TRAILS) break;
    const got = streamline(c[0], c[1], WALK_STEP, lengthPx, w, h);
    if (got === null) continue;
    // Whole stroke inside the viewBox: with "slice" an off-box stroke is a line entering from nowhere. Tested
    // on the KNOTS, while the spec tests the drawn curve — a Bézier may bulge a little past the knots it
    // interpolates, and INSET_PX is the slack that covers the difference.
    if (got.pts.some((p) => p.x < inset || p.x > w - inset || p.y < inset || p.y > h - inset)) continue;
    if (worstTurnDeg(got.pts) > MAX_TURN_DEG) continue;        // a saddle-grazing streamline kinks
    if (kept.some((o) => nearest2(o.pts, got.pts) < minSep2)) continue;
    kept.push(got);
  }
  // Near the camera = heavier. The shipped module ramped opacity and width together "to fake depth"; here the
  // depth is the real one project() returns, so sorting by it makes the ramp aerial perspective rather than
  // an accident of iteration order.
  return kept.sort((a, b) => a.depth - b.depth);
}

export function trails(w = GATE_VIEW_W, h = GATE_VIEW_H): Trail[] {
  const pts = combPoints(w, h);
  const last = Math.max(1, pts.length - 1);
  return pts.map((p, i) => {
    const t = i / last;
    return {
      d: catmullRomPath(p.pts),
      i,
      opacity: Math.round((0.1 + t * 0.45) * 1000) / 1000,
      width: Math.round((0.5 + t * 1.1) * 100) / 100,
    };
  });
}
