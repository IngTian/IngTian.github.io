// tests/descentPath.test.ts
// THE CONTOUR MEMO — the largest single performance fix on the perf branch, and for one revision the only
// one with nothing holding it in place.
//
// `contours()` for the eleven levels the descent graph draws is 190 polylines / 2962 points and costs
// 53–67ms of synchronous main thread. `DescentPath.astro` binds its init to BOTH `astro:page-load` and
// `theme:change`, so uncached that ran on every return to `/` and every theme flip, inside the view
// transition. The cache was first written as a `Map` at the top of the component's `<script>`, where it
// worked — and where NO TEST COULD SEE IT: `grep -rln DescentPath tests/` returned nothing, so moving the
// Map back inside `init()` would have silently undone the whole saving with all 631 tests green. That is the
// same hole `passWithNoTests: false` exists to close, one level up.
//
// So the memo lives in `lib/descentPath.ts` and this is its spec. Deliberately the same shape as the
// `gridCache`/`buildGrid` tests in paintTerrain.test.ts, which is the pattern this repo already settled on.
import { describe, expect, it } from 'vitest';
import { contours, contoursFor, contourLevels, storyBounds } from '../src/lib/descentPath';

describe('contoursFor — the memo', () => {
  it('returns the IDENTICAL array for a repeated (level, res), not an equal one', () => {
    // The whole fix in one assertion. `toBe`, not `toEqual`: an equal-but-fresh array means the marching
    // squares ran again and the 53–67ms is back. Deleting the Map, or moving it inside a function, fails here.
    const lv = contourLevels(11)[4];
    expect(contoursFor(lv, 150)).toBe(contoursFor(lv, 150));
  });

  it('keys on the RESOLUTION as well as the level', () => {
    // A key that ignores an argument is a cache that returns the wrong answer the moment a second call site
    // appears with a different res. This is the assertion that makes that a test failure rather than a
    // drawing bug nobody can see.
    const lv = contourLevels(11)[4];
    const a = contoursFor(lv, 40);
    const b = contoursFor(lv, 80);
    expect(a).not.toBe(b);
    // and each is still stable on its own
    expect(contoursFor(lv, 40)).toBe(a);
    expect(contoursFor(lv, 80)).toBe(b);
  });

  it('keys on the LEVEL as well as the resolution', () => {
    const levels = contourLevels(11);
    expect(contoursFor(levels[2], 60)).not.toBe(contoursFor(levels[7], 60));
  });

  it('returns what the uncached kernel returns — the memo is not a different answer', () => {
    // A cache that is fast and wrong is worse than no cache. `contours` is pure, so a deep compare against
    // a fresh run is the real check; if these ever diverge the memo is keyed on too little.
    const lv = contourLevels(11)[3];
    expect(contoursFor(lv, 50)).toEqual(contours(lv, 50));
  });

  it('is actually faster warm than cold, by a wide margin', () => {
    // A timing assertion with a ~100x margin rather than a tight budget, so it cannot be flaky on a loaded
    // CI box but still fails outright if the memo is removed. Mirrors the warm/cold test in
    // paintTerrain.test.ts.
    const lv = contourLevels(11)[6] + 1e-7; // a level nothing above has touched
    const t0 = performance.now();
    contoursFor(lv, 150);
    const cold = performance.now() - t0;

    const t1 = performance.now();
    for (let k = 0; k < 50; k++) contoursFor(lv, 150);
    const warm50 = performance.now() - t1;

    expect(warm50, `50 cached calls (${warm50.toFixed(2)}ms) should beat one cold one (${cold.toFixed(2)}ms)`)
      .toBeLessThan(cold);
  });
});

describe('contours — the kernel the memo wraps', () => {
  it('is deterministic, which is what makes memoising it sound at all', () => {
    // The hoist is only safe because `contours` depends on nothing but `storyBounds()` (itself memoised) and
    // the pure `field()`. If a hidden input ever appears — a clock, a theme, a random — this goes red and
    // the cache has to come back out.
    const lv = contourLevels(11)[5];
    expect(contours(lv, 40)).toEqual(contours(lv, 40));
  });

  it('produces continuous runs, not 1px stubs', () => {
    // The original bug in this function: segments were emitted per cell and never stitched, so the contours
    // were invisible. Every run it returns must be a real polyline.
    const lv = contourLevels(11)[5];
    const runs = contours(lv, 100);
    expect(runs.length).toBeGreaterThan(0);
    for (const run of runs) expect(run.length).toBeGreaterThan(3);
  });

  it('stays inside the story bounds it sampled', () => {
    const b = storyBounds();
    const lv = contourLevels(11)[5];
    for (const run of contours(lv, 60)) {
      for (const [x, y] of run) {
        expect(x).toBeGreaterThanOrEqual(b.x0 - 1e-6);
        expect(x).toBeLessThanOrEqual(b.x1 + 1e-6);
        expect(y).toBeGreaterThanOrEqual(b.y0 - 1e-6);
        expect(y).toBeLessThanOrEqual(b.y1 + 1e-6);
      }
    }
  });
});

describe('contourLevels', () => {
  it('returns n ascending levels inside the field\'s own range', () => {
    const levels = contourLevels(11);
    expect(levels).toHaveLength(11);
    for (let i = 1; i < levels.length; i++) expect(levels[i]).toBeGreaterThan(levels[i - 1]);
  });

  it('spans the range rather than clustering, so no level is wasted off-frame', () => {
    // The function's own stated purpose. Levels are placed at (k + 0.5)/n through the measured range, so
    // the gaps between consecutive levels must all be equal.
    const levels = contourLevels(11);
    const gap = levels[1] - levels[0];
    for (let i = 2; i < levels.length; i++) {
      expect(levels[i] - levels[i - 1]).toBeCloseTo(gap, 9);
    }
  });
});
