// src/lib/terrainContours.ts
//
// ISOLINES OF THE HERO'S TERRAIN, for the homepage intro's survey pass.
//
// The intro's first act strokes a contour map onto a flat plane; the surface then rises out of it,
// carrying these lines up with it. That only reads as ONE surface drawn twice if the lines are the real
// isolines of the same `field()` the dots are painted from — which is what this module is for. The whole
// design rests on it: a decorative line field is what got the previous entrance rejected as "boring", and
// what got five showpieces before it rejected as looking like they meant something without meaning
// anything.
//
// Separate from lib/descentPath.ts's contours, which sample the same field over `storyBounds()` for the
// career graph. Both call the shared kernel in lib/marchingSquares.ts.

import { field, RANGE } from './terrain';
import { isoRuns, type IsoBounds } from './marchingSquares';

/**
 * THE SHIPPED PARAMETERS, AND THEY ARE A MEASURED PERF DECISION — not a taste one.
 *
 * Timed on node 24, 5 reps, median, for the full level set:
 *
 *   7 levels @ res  60  →   4.9ms   (9 runs /  795 pts)
 *   9 levels @ res  74  →  10.0ms   (13 runs / 1245 pts)   ← shipped
 *   9 levels @ res 110  →  21.0ms
 *  11 levels @ res 150  →  47.1ms   (what descentPath uses for the career graph)
 *
 * 10ms is cheap enough to run inline on the intro's first animation frame, and `introContours()` is
 * memoised so it is paid once per page rather than once per frame. Raising the resolution is the easiest
 * way to make the intro's first frame janky, which is why `tests/terrainContours.test.ts` both pins these
 * two numbers and measures a cold build against a 40ms ceiling. EXPORTED FOR THAT TEST — the only
 * production consumers are the two functions below, in this file.
 */
export const INTRO_CONTOUR_LEVELS = 9;
export const INTRO_CONTOUR_RES = 74;

/** The terrain's full footprint — the same square the dot grid covers. */
const TERRAIN_BOUNDS: IsoBounds = { x0: -RANGE, y0: -RANGE, x1: RANGE, y1: RANGE };

/** Coarse lattice used only to measure the field's range. 51x51 is plenty for a min/max. */
const PROBE = 50;

let levelsCache: number[] | null = null;

/**
 * The elevation of each contour level, ascending — spanning the field's own measured range.
 *
 * Placed at `(k + 0.5) / n` through [min, max] — the same scheme `descentPath.contourLevels` uses, and
 * for the same reason: a level at exactly the min or max produces no isoline, so the half-step inset
 * guarantees every level draws something. `tests/terrainContours.test.ts` asserts each one is strictly
 * inside the range, which is what makes "no pass is silently blank" a test rather than a hope.
 *
 * THE RETURNED ARRAY IS SHARED AND READ-ONLY BY CONTRACT, like `introContours()`'s and `buildGrid`'s.
 * It is cached, and the intro reads it once per level per frame.
 */
export function terrainLevels(): number[] {
  if (levelsCache) return levelsCache;
  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i <= PROBE; i++) {
    for (let j = 0; j <= PROBE; j++) {
      const z = field(-RANGE + (2 * RANGE * i) / PROBE, -RANGE + (2 * RANGE * j) / PROBE);
      if (z < lo) lo = z;
      if (z > hi) hi = z;
    }
  }
  const n = INTRO_CONTOUR_LEVELS;
  levelsCache = Array.from({ length: n }, (_, k) => lo + ((hi - lo) * (k + 0.5)) / n);
  return levelsCache;
}

let runsCache: [number, number][][][] | null = null;

/**
 * Every level's runs, in level order — what the intro's survey pass strokes.
 *
 * MEMOISED, AND THE MEMO IS THE PERF STORY: the intro builds this once at ~10ms and then strokes from it
 * every frame for 5.2 seconds. Without it that is 10ms per frame, which is the single easiest way to make
 * the intro's opening janky. `tests/terrainContours.test.ts` asserts the identity (`toBe`, not `toEqual`)
 * and separately measures a genuinely cold build against a 40ms ceiling.
 *
 * **THE RETURNED ARRAYS ARE SHARED AND READ-ONLY BY CONTRACT.** Nothing may mutate them.
 *
 * ONE CACHE, NO KEY — AND THAT IS A DELIBERATE SIMPLIFICATION. `terrainLevels(n)` and
 * `terrainContoursFor(level, res)` used to be parameterised, with a `${level}|${res}` cache key and four
 * tests exercising it. Production never passed either argument: there was one call site, right here,
 * using the constants declared above it. The parameters' only callers were the tests that tested the
 * parameters — this project's documented "a test is not a consumer" trap — and the key arithmetic came
 * with a real defect (see that test file's note on the `toFixed(4)` collision). If a second call site
 * with different parameters ever appears, re-introduce the key with it.
 */
export function introContours(): [number, number][][][] {
  if (!runsCache) {
    runsCache = terrainLevels().map((l) => isoRuns(field, TERRAIN_BOUNDS, l, INTRO_CONTOUR_RES));
  }
  return runsCache;
}
