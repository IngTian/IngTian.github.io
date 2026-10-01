// src/lib/gateVariants/comb.ts
//
// COMBED CONTOURS — the gate's background as iso-cost lines of the hero's own loss field, tilted.
//
// WHAT WAS WRONG WITH THE DESCENT TRAILS (the version this replaced, now deleted from lib/gatePaths.ts): it
// every run ends in one of the field's three basins, so 36 lines pile into 3 points. Measured with the same
// metric this module's spec asserts — a 20x20 grid of 60x40px viewBox cells — ONE cell at (6,6) holds points
// from 20 of the 36 trails, 55.6%. That knot in the middle of the screen is the thing the owner was looking
// at, and nothing about the spline fixes it: centripetal Catmull-Rom cured the 173.8-degree hairpins (see
// catmullRomPath) and left the convergence untouched, because convergence is what gradient descent IS. The
// same set measures a 21.0x longest/shortest length ratio and puts 35.6% of its points outside the viewBox.
//
// THE REPLACEMENT, AND WHY IT CANNOT KNOT. Take the same field and add a linear term:
//
//     g(p) = field(p) + TILT * (n . p)      with |n| = 1
//
// so grad g = grad field + TILT * n. Pick TILT above max|grad field| and grad g can never be zero, so g has
// NO stationary point anywhere — and a function with no critical points has no closed level sets and no level
// sets that meet. The lines drawn here are level sets of g, one per seed. They cannot converge to a point,
// cannot cross, and cannot close into a loop: that is a theorem about g, not a tuning of constants.
// tests/gateVariantComb.test.ts asserts both halves of it — the hypothesis (min |grad g| > 0 over the whole
// footprint) and the conclusion (no two of the 30 drawn strokes intersect).
//
// Each level set is walked as an integral curve of perp(grad g) = perp(grad field) + TILT * axis, at UNIT
// speed (fixed world distance per step) rather than by `lr * grad`. That is deliberate: `runDescent`'s
// lr-scaled step sprints down a steep slope and crawls near a minimum, which is what produced the 412.8x
// spacing ratio inside a single trail. Unit speed cannot do that.
//
// WHY THE LINES SIT ON THE GROUND PLANE (z = 0) INSTEAD OF ON THE SURFACE. This is the one place the comb
// steps away from the hero's dots, and it was measured, not assumed. project() moves a point 184px down the
// screen per unit of elevation at the shipped viewBox, and `field` spans 2.47 units, so riding the surface
// bows every stroke by up to 200px — all of them the same way, which reads as nested ripples rather than a
// comb — and worse, the camera FOLDS: strokes on the far side of the hill project across strokes on the near
// side, and the raster showed exactly that band of crossings at mid-left. On the ground plane the camera is
// an affine map, so "no two level sets meet" survives projection intact. Same field, same camera, same zoom;
// the hero draws the terrain and the gate draws its map. (Which is also why `field` itself is never called
// here — only its gradient, through `grad`. The elevation is the one thing a plan view does not need.)
//
// ONE HONEST LIMIT, measured. The band is sized to the frame, and the frame is wider than the hero's drawn
// footprint, so 17.3% of the in-frame ink lies outside |x|,|y| <= RANGE, where the Gaussians have decayed and
// a level set is all but straight. The mean |grad field| under the in-frame ink is 0.684, so the field really
// is shaping the other 83% — but the strokes that bow only 8px are the ones out at the edge, and that is why
// the bow runs 8-77px across the set rather than evenly.
import { grad, project } from './terrain';
import { TERRAIN_CONFIG_DEFAULTS } from './terrainRender';
import { GATE_VIEW_H, GATE_VIEW_W, catmullRomPath } from './gatePaths';
import type { Pt, Trail } from './gatePaths';

export const LABEL = 'Combed contours';
export const NOTE =
  'Iso-cost contours of the hero loss field under a linear tilt steep enough (2.6 against a measured max '
  + 'gradient of 1.87) that no basin is left to trap them: walked at unit speed, cut at one shared screen '
  + 'length, and read in plan through the hero camera.';

/**
 * The hero's camera, imported rather than retyped — the same reason gatePaths.ts gives: TerrainHero.astro's
 * own comment is "walkers must use the SAME zoom to stay on the surface".
 */
const ZOOM = TERRAIN_CONFIG_DEFAULTS.zoom;

/**
 * Tilt strength. The bound that matters is max|grad field| over the footprint, measured on a 401x401 grid of
 * [-RANGE, RANGE]^2 as **1.8668** at (-0.82, 0.14); above it, grad g cannot vanish. 2.6 is a 1.39x margin,
 * which leaves |grad g| >= 0.73 — the divisor in the walk below, so the margin is also what keeps that
 * normalisation far from 0/0.
 *
 * It is a straight expressiveness dial and both ends were looked at. Higher is calmer: at 4.5 the worst turn
 * falls to 5.6 degrees and the strokes bow by at most 43px over ~1130px, which is ruled paper. Lower bends
 * more: 2.1 bows up to 98px but sits only 1.13x above the bound, where a stroke starts to wander far off the
 * comb's axis (27.2 degrees of turn). 2.6 measures 12.7 degrees of turn and an 8-77px bow — the bow is the
 * terrain showing through, and the strokes that barely bend are the ones passing where the Gaussians decayed.
 *
 * THE DEFAULT IS A JUDGEMENT CALL MADE WITHOUT EYES. This module was written by an agent that could measure
 * the picture but never see it, and it said so: "2.6 is my judgement call and I cannot see the result." So the
 * dial is a PARAMETER with a default, not a constant — /proto-gate sweeps it with everything else held fixed,
 * which is the only honest way to pick it. The measured bound below is the floor any sweep must respect.
 */
const DEFAULT_TILT = 2.6;

/**
 * Max |grad field| over the footprint, measured on a 401x401 grid of [-RANGE, RANGE]^2 at (-0.82, 0.14).
 *
 * This is the no-knot bound and it is the one number in this file that must not be edited casually: a tilt at
 * or below it reintroduces critical points, and with them closed level sets and crossings. Exported so a test
 * can assert the default clears it and so a sweep cannot offer an unsafe value by accident.
 */
export const MAX_FIELD_GRAD = 1.8668;

/**
 * The comb's axis as a SCREEN direction: 7 degrees below horizontal, descending left to right.
 *
 * Screen rather than world because the whole point is an even sweep *on screen*, and because the band
 * geometry below only closes in screen units. 7 degrees is small on purpose — the covering band for an axis
 * at angle t needs (w cos t + h sin t) by (w sin t + h cos t), so tilting costs frame. Untrimmed, the share
 * of drawn points that land outside the viewBox measures 8.3% at 0 degrees (just the strokes' own wander),
 * 31% at 7 and 47% at 20. Those points still cost markup and are then clipped by preserveAspectRatio, so
 * the tilt is bought in small change.
 *
 * First quadrant, so nothing below needs Math.abs().
 */
const DEFAULT_AXIS_DEG = 7;

/**
 * How much of that covering band to keep. At 1.0 the band covers the frame exactly and 31% of the drawn
 * points land outside the viewBox (a rotated rectangle covering a rectangle has its corners outside it);
 * 0.88 still measures 100% x 100% coverage of the viewBox and puts only 7.8% of the points out of frame.
 * Below that the coverage does start to go: 0.80 measures 92% of the width.
 */
const COVER = 0.88;

/** 30 strokes, spaced 28.5px apart on screen at the shipped viewBox. The reference's comb is this dense. */
const DEFAULT_SEEDS = 30;

/** The three dials that change how the comb LOOKS. Everything else in this file is mechanism. */
export interface CombOpts {
  /** Tilt strength. Must exceed MAX_FIELD_GRAD or the no-knot guarantee is void. */
  tilt?: number;
  /** Stroke count. */
  seeds?: number;
  /** The comb's axis, in degrees below horizontal on screen. */
  axisDeg?: number;
  w?: number;
  h?: number;
}

/** What ships, in one place, so a sweep can say what it is varying FROM. */
export const COMB_DEFAULTS = {
  tilt: DEFAULT_TILT,
  seeds: DEFAULT_SEEDS,
  axisDeg: DEFAULT_AXIS_DEG,
} as const;

/**
 * Knots per stroke handed to the spline. The worst turning angle is a direct function of this, because fewer
 * knots means longer chords across the same bend: 10 knots measures 16.3 degrees, 12 measures 12.7, 14
 * measures 12.2, 16 measures 11.3. It is diminishing from 12 on, and every knot is another cubic in the
 * markup — the whole set ships 11.8KB of path data at 12.
 */
const KNOTS = 12;

/**
 * World distance per Euler step: 2.4-2.8px on screen at the shipped viewBox.
 *
 * First-order Euler is enough here and that was checked rather than assumed: against an 8x finer step the
 * endpoint moves 2.7px, which is one step's worth and mostly just where the arc-length cut falls, on a stroke
 * 1134px long. A higher-order integrator would buy nothing a reader could see.
 */
const STEP = 0.012;

/**
 * Safety net, not the mechanism — the walk stops on screen arc length. A stroke measures 414-422 steps at the
 * shipped viewBox, so this is 9x headroom; it exists so a future change to TILT or STEP cannot spin here. If
 * it ever bites, strokes come back short and the length-rhythm assertion goes red rather than the build hanging.
 */
const MAX_STEPS = 4000;

interface Camera {
  /** world (x, y) on the ground plane -> viewBox px */
  screen(x: number, y: number): Pt;
  /** a screen DISPLACEMENT -> the world vector that produces it */
  dir(dsx: number, dsy: number): [number, number];
  /** a screen POINT -> the world point on the ground plane that projects to it */
  world(sx: number, sy: number): [number, number];
}

/**
 * The camera, and its exact inverse.
 *
 * Both are derived by probing project() at three points rather than by re-deriving its yaw and tilt, which
 * are module-private in terrain.ts and should stay that way. With z pinned to 0, project() is affine — a
 * rotation, a squash and a translate — so three probes determine it completely and the inverse is one 2x2
 * solve. `det` is a rotation times a scale, so it is never 0 (-32383 at the shipped viewBox).
 */
function camera(w: number, h: number): Camera {
  const at = (x: number, y: number): Pt => {
    const [sx, sy] = project(x, y, 0, w, h, ZOOM);
    return { x: sx, y: sy };
  };
  const o = at(0, 0), ex = at(1, 0), ey = at(0, 1);
  const ax = ex.x - o.x, ay = ex.y - o.y;
  const bx = ey.x - o.x, by = ey.y - o.y;
  const det = ax * by - ay * bx;
  const dir = (dsx: number, dsy: number): [number, number] => [
    (dsx * by - dsy * bx) / det,
    (ax * dsy - ay * dsx) / det,
  ];
  return { screen: at, dir, world: (sx, sy) => dir(sx - o.x, sy - o.y) };
}

/**
 * One level set of g, from one seed, as a screen polyline — stopped the moment it has drawn `arc` px.
 *
 * Terminating on SCREEN length rather than world length is what buys the length rhythm outright: the shipped
 * set measures a longest/shortest ratio of 1.003, against 21.0x for the descent trails. World length would
 * not have done it — the ground-plane camera draws 231.2px per world unit along one axis and 140.1 along the
 * other, a 1.65x spread, so the same world length becomes a different screen length depending on which way a
 * stroke happens to run.
 */
function streamline(
  cam: Camera, x0: number, y0: number, axisX: number, axisY: number, arc: number, tilt: number,
): Pt[] {
  let x = x0, y = y0;
  const poly: Pt[] = [cam.screen(x, y)];
  let drawn = 0;
  for (let k = 0; k < MAX_STEPS && drawn < arc; k++) {
    const [gx, gy] = grad(x, y);
    // perp(grad g) = perp(grad field) + TILT * axis, with perp(u) = (-u.y, u.x).
    const vx = -gy + tilt * axisX;
    const vy = gx + tilt * axisY;
    const m = Math.hypot(vx, vy);  // >= tilt - MAX_FIELD_GRAD; see DEFAULT_TILT for why that bound holds
    x += (vx / m) * STEP;
    y += (vy / m) * STEP;
    const p = cam.screen(x, y);
    const prev = poly[poly.length - 1];
    drawn += Math.hypot(p.x - prev.x, p.y - prev.y);
    poly.push(p);
  }
  return poly;
}

/**
 * `n` points spaced evenly along a screen polyline.
 *
 * Two things want this. The spline: centripetal Catmull-Rom is well behaved on uneven knots but it is
 * *smoothest* on even ones. The animation: Gate.astro draws each path in with a dash offset over
 * pathLength="1", which advances at a constant rate along the path, so unevenly spaced knots make the ink
 * speed up and slow down for no reason.
 */
function resample(poly: readonly Pt[], n: number): Pt[] {
  const cum = [0];
  for (let i = 1; i < poly.length; i++) {
    cum.push(cum[i - 1] + Math.hypot(poly[i].x - poly[i - 1].x, poly[i].y - poly[i - 1].y));
  }
  const total = cum[cum.length - 1];
  const out: Pt[] = [];
  let seg = 1;
  for (let k = 0; k < n; k++) {
    const want = (total * k) / Math.max(1, n - 1);
    while (seg < poly.length - 1 && cum[seg] < want) seg++;
    const a = poly[seg - 1], b = poly[seg];
    const span = cum[seg] - cum[seg - 1];
    const f = span > 0 ? (want - cum[seg - 1]) / span : 0;
    out.push({ x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f });
  }
  return out;
}

/**
 * The shipped comb. Deterministic by construction — there is no jitter here at all, and no call to hash01:
 * the variation between strokes is the field's, which is the whole claim. Index 0 is the top stroke, so the
 * opacity/width ramp weights the comb toward the bottom of the frame, and
 * Gate.astro's per-index stagger draws it in downward.
 */
export function trails(opts: CombOpts = {}): Trail[] {
  const w = opts.w ?? GATE_VIEW_W;
  const h = opts.h ?? GATE_VIEW_H;
  const seeds = Math.max(2, Math.round(opts.seeds ?? DEFAULT_SEEDS));
  const axisDeg = opts.axisDeg ?? DEFAULT_AXIS_DEG;
  // CLAMPED, NOT TRUSTED. A tilt at or below MAX_FIELD_GRAD puts a critical point back into g, and with it
  // closed level sets and crossings — the knot this whole module exists to remove. A caller sweeping the dial
  // should not be able to void the guarantee by typing a smaller number, so the floor is enforced here rather
  // than documented and hoped for. The 1.05 margin keeps |grad g| away from 0/0 in the walk's normalisation.
  const tilt = Math.max(MAX_FIELD_GRAD * 1.05, opts.tilt ?? DEFAULT_TILT);
  const AXIS_COS = Math.cos((axisDeg * Math.PI) / 180);
  const AXIS_SIN = Math.sin((axisDeg * Math.PI) / 180);

  const cam = camera(w, h);
  const [avx, avy] = cam.dir(AXIS_COS, AXIS_SIN);
  const al = Math.hypot(avx, avy);
  const axisX = avx / al, axisY = avy / al;

  // The band: long enough and wide enough to cover the frame when laid along the axis, trimmed by COVER.
  const arc = (w * AXIS_COS + h * AXIS_SIN) * COVER;
  const wid = (w * AXIS_SIN + h * AXIS_COS) * COVER;
  // Seed line: perpendicular to the axis, through the band's upstream end. Even spacing along this world
  // segment IS even spacing on screen, exactly — the ground-plane camera is affine, so it maps the segment to
  // a straight line and preserves ratios along it. The seeds land 28.53px apart, and the closest two strokes
  // ever come inside the frame is 20.0px.
  //
  // Riding the surface makes even screen spacing genuinely hard, which is the other half of the ground-plane
  // decision. Elevation moves a point up to 184px up or down the screen, so the naive inverse put two seeds
  // meant to sit 23px apart 5.5px apart; and a Newton solve that hits the screen target exactly then jumps in
  // WORLD space wherever the camera folds — two adjacent seeds measured (-1.68, 1.26) and (-2.21, 0.37), so
  // two strokes side by side on screen would start from unrelated places in the field.
  const midX = w / 2 - AXIS_COS * arc * 0.5;
  const midY = h / 2 - AXIS_SIN * arc * 0.5;
  const head = cam.world(midX + AXIS_SIN * wid * 0.5, midY - AXIS_COS * wid * 0.5);
  const foot = cam.world(midX - AXIS_SIN * wid * 0.5, midY + AXIS_COS * wid * 0.5);

  const last = seeds - 1;
  return Array.from({ length: seeds }, (_, i) => {
    const t = i / last;
    const pts = resample(
      streamline(
        cam, head[0] + (foot[0] - head[0]) * t, head[1] + (foot[1] - head[1]) * t, axisX, axisY, arc, tilt,
      ),
      KNOTS,
    );
    return {
      d: catmullRomPath(pts),
      i,
      // The ramp the descent trails used, kept identical so the replacement reads as the same drawing done
      // two ways: opacity 0.10 -> 0.55, width 0.5 -> 1.6.
      opacity: Math.round((0.1 + t * 0.45) * 1000) / 1000,
      width: Math.round((0.5 + t * 1.1) * 100) / 100,
    };
  });
}
