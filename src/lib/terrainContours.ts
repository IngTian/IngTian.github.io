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
 * memoised so it is paid once per page rather than once per frame. Raising `res` is the easiest way to
 * make the intro's first frame janky; `tests/terrainContours.test.ts` fails above 40ms.
 */
export const INTRO_CONTOUR_LEVELS = 9;
export const INTRO_CONTOUR_RES = 74;

/** The terrain's full footprint — the same square the dot grid covers. */
const TERRAIN_BOUNDS: IsoBounds = { x0: -RANGE, y0: -RANGE, x1: RANGE, y1: RANGE };

/** Coarse lattice used only to measure the field's range. 51×51 is plenty for a min/max. */
const PROBE = 50;

let levelsCache: { n: number; v: number[] } | null = null;

/**
 * Elevation levels spanning the field's own measured range, evenly spaced.
 *
 * Placed at `(k + 0.5) / n` through [min, max] — the same scheme `descentPath.contourLevels` uses, and
 * for the same reason: a level at exactly the min or max produces no isoline, so the half-step inset
 * guarantees every level draws something. `tests/terrainContours.test.ts` asserts each one is strictly
 * inside the range, which is what makes "no pass is silently blank" a test rather than a hope.
 */
export function terrainLevels(n: number = INTRO_CONTOUR_LEVELS): number[] {
  if (levelsCache && levelsCache.n === n) return levelsCache.v;
  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i <= PROBE; i++) {
    for (let j = 0; j <= PROBE; j++) {
      const z = field(-RANGE + (2 * RANGE * i) / PROBE, -RANGE + (2 * RANGE * j) / PROBE);
      if (z < lo) lo = z;
      if (z > hi) hi = z;
    }
  }
  const v = Array.from({ length: n }, (_, k) => lo + ((hi - lo) * (k + 0.5)) / n);
  levelsCache = { n, v };
  return v;
}

const runsCache = new Map<string, [number, number][][]>();

/**
 * Memoised isolines for one level.
 *
 * Keyed on the level AND the resolution. A key that ignores an argument is a cache that returns the
 * wrong answer the moment a second call site appears with different parameters — the same reasoning as
 * `contoursFor` in descentPath.ts and `buildGrid` in terrainRender.ts, both of which have specs saying so.
 * `toFixed(4)` rather than the raw float so two levels differing below drawing resolution share an entry.
 *
 * **THE RETURNED ARRAY IS SHARED AND READ-ONLY BY CONTRACT.** The intro strokes from it ~108 times per
 * second for 3.6 seconds; nothing may mutate it.
 */
export function terrainContoursFor(
  level: number,
  res: number = INTRO_CONTOUR_RES,
): [number, number][][] {
  const key = `${level.toFixed(4)}|${res}`;
  let hit = runsCache.get(key);
  if (!hit) {
    hit = isoRuns(field, TERRAIN_BOUNDS, level, res);
    runsCache.set(key, hit);
  }
  return hit;
}

/**
 * Every level's runs, in level order — what the intro's survey pass strokes.
 *
 * Memoised through `terrainContoursFor`, so calling this on each frame is free after the first. The outer
 * array is rebuilt per call (cheap: 9 map lookups) while the inner arrays are the shared cached ones.
 */
export function introContours(): [number, number][][][] {
  return terrainLevels().map((l) => terrainContoursFor(l, INTRO_CONTOUR_RES));
}
