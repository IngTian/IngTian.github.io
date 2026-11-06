// src/lib/terrainContours.ts
//
// ISOLINES OF THE HERO'S TERRAIN, for the homepage intro's survey pass.
//
// The intro strokes a contour map onto a flat plane, and the surface then rises out of it carrying these
// lines. That only reads as ONE surface drawn twice if they are the real isolines of the same `field()` the
// dots are painted from: a decorative line field is what the site's rejected entrances and showpieces were.
//
// Separate from lib/descentPath.ts's `storyContours()`, which samples the same field over `storyBounds()`
// for the career graph. Both call the shared kernel and level placement in lib/marchingSquares.ts.

import { field, RANGE } from './terrain';
import { isoRuns, isoLevels, type IsoBounds } from './marchingSquares';

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
 * way to make the intro's first frame janky, which is why `tests/terrainContours.test.ts` pins these two
 * numbers and bounds levels × (res + 1)² — deterministically, with no stopwatch. EXPORTED FOR THAT TEST —
 * the only production consumers are the two functions below, in this file.
 */
export const INTRO_CONTOUR_LEVELS = 9;
export const INTRO_CONTOUR_RES = 74;

/** The terrain's full footprint — the same square the dot grid covers. */
const TERRAIN_BOUNDS: IsoBounds = { x0: -RANGE, y0: -RANGE, x1: RANGE, y1: RANGE };

/** Coarse lattice used only to measure the field's range. 51x51 is plenty for a min/max. */
const PROBE = 50;

let levelsCache: number[] | null = null;

/**
 * The elevation of each contour level, ascending — spanning the field's own measured range, placed by
 * `isoLevels` (lib/marchingSquares.ts) as the Story graph's are. `tests/terrainContours.test.ts` asserts
 * each one is strictly inside the range, which is what makes "no pass is silently blank" a test rather
 * than a hope.
 *
 * THE RETURNED ARRAY IS SHARED AND READ-ONLY BY CONTRACT, like `introContours()`'s and `buildGrid`'s.
 * It is cached, and the intro reads it once per level per frame.
 */
export function terrainLevels(): number[] {
  if (!levelsCache) levelsCache = isoLevels(field, TERRAIN_BOUNDS, INTRO_CONTOUR_LEVELS, PROBE);
  return levelsCache;
}

let runsCache: [number, number][][][] | null = null;

/**
 * Every level's runs, in level order — what the intro's survey pass strokes.
 *
 * MEMOISED: the intro builds this once at ~10ms and strokes from it every frame for 5.2 seconds.
 * `tests/terrainContours.test.ts` asserts the identity (`toBe`, not `toEqual`) and bounds what a build
 * costs by its pinned parameters, not by a stopwatch.
 *
 * **THE RETURNED ARRAYS ARE SHARED AND READ-ONLY BY CONTRACT.** Nothing may mutate them.
 *
 * ONE CACHE, NO KEY: there is one call site, with the constants above. Add a key with a second one.
 */
export function introContours(): [number, number][][][] {
  if (!runsCache) {
    runsCache = terrainLevels().map((l) => isoRuns(field, TERRAIN_BOUNDS, l, INTRO_CONTOUR_RES));
  }
  return runsCache;
}
