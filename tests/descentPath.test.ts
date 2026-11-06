// tests/descentPath.test.ts
// THE STORY GRAPH'S CONTOURS — the memo that is the homepage's largest single perf fix, and the geometry
// the Story slide's basin wash depends on.
//
// The full set is 17 polylines / 2838 points and costs 53–67ms of synchronous main thread, and
// `DescentPath.astro` re-inits on every `astro:page-load` and every `theme:change`. No test reads that
// component's source, so a cache there could move back inside `init()` with every test green — the same
// hole `passWithNoTests: false` exists to close, one level up. So the memo lives in `lib/descentPath.ts`
// and this is its spec.
import { describe, expect, it } from 'vitest';
import { storyContours, storyBounds } from '../src/lib/descentPath';
import { field } from '../src/lib/terrain';
import { isoRuns } from '../src/lib/marchingSquares';

/** The levels as the graph placed them before `isoLevels` held the rule, written out longhand and frozen:
 *  (k + ½)/11 through the field's range, measured on a 61² lattice over the story bounds. */
function frozenStoryLevels(): number[] {
  const b = storyBounds();
  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i <= 60; i++) {
    for (let j = 0; j <= 60; j++) {
      const z = field(b.x0 + ((b.x1 - b.x0) * i) / 60, b.y0 + ((b.y1 - b.y0) * j) / 60);
      if (z < lo) lo = z;
      if (z > hi) hi = z;
    }
  }
  return Array.from({ length: 11 }, (_, k) => lo + ((hi - lo) * (k + 0.5)) / 11);
}

describe('storyContours', () => {
  it('returns the IDENTICAL arrays every call, not equal ones', () => {
    // The whole fix in one assertion. `toBe`, not `toEqual`: an equal-but-fresh array means the marching
    // squares ran again and the 53–67ms is back. Deleting the memo, or moving it inside a function, fails here.
    const a = storyContours();
    const b = storyContours();
    expect(a).toBe(b);
    for (let i = 0; i < a.length; i++) expect(a[i]).toBe(b[i]);
  });

  it('draws exactly the contours the graph drew before: the frozen levels, each traced at res 150', () => {
    expect(storyContours()).toEqual(frozenStoryLevels().map((l) => isoRuns(field, storyBounds(), l, 150)));
  });

  it('has eleven levels and every one draws something — a level outside the field\'s range would not', () => {
    const all = storyContours();
    expect(all).toHaveLength(11);
    for (const runs of all) expect(runs.length).toBeGreaterThan(0);
  });

  it('produces continuous runs inside the story bounds it sampled, not 1px stubs', () => {
    // The original bug in this geometry: segments were emitted per cell and never stitched, so the
    // contours were invisible. Every run must be a real polyline, inside the bounds it was sampled over.
    const b = storyBounds();
    for (const runs of storyContours()) {
      for (const run of runs) {
        expect(run.length).toBeGreaterThan(3);
        for (const [x, y] of run) {
          expect(x).toBeGreaterThanOrEqual(b.x0 - 1e-6);
          expect(x).toBeLessThanOrEqual(b.x1 + 1e-6);
          expect(y).toBeGreaterThanOrEqual(b.y0 - 1e-6);
          expect(y).toBeLessThanOrEqual(b.y1 + 1e-6);
        }
      }
    }
  });
});

describe('the basin wash\'s eligible loops — an invariant between two files', () => {
  // `DescentPath.astro`'s basin wash is RUN-STRUCTURE sensitive: it fills only runs of ≥12 points whose
  // endpoints are within 0.08, at a per-level opacity of `0.034 - i*0.005`. A change to the kernel's stitch
  // (first-match → nearest, 190 runs → 17) kept the fill count at 3 but moved the fills to other levels,
  // which the specs above (memo, length, bounds) could not see. So this asserts the renderer's exact
  // predicate on the geometry: an invariant between two files.
  const MIN_PTS = 12;       // `run.length < 12` → skip
  const CLOSE_TOL = 0.08;   // endpoints within 0.08 → a closed loop

  /** The renderer's own eligibility test, applied to one level's runs. */
  const eligible = (runs: [number, number][][]): number => runs.filter((run) => {
    if (run.length < MIN_PTS) return false;
    const a = run[0], z = run[run.length - 1];
    return Math.hypot(a[0] - z[0], a[1] - z[1]) < CLOSE_TOL;
  }).length;

  it('fills a stable set of closed loops across the five washed levels', () => {
    // `storyContours().slice(0, 5)` is what the wash iterates.
    const perLevel = storyContours().slice(0, 5).map(eligible);
    // Pinned as a whole so a change anywhere in the stitch, the levels or the bounds shows up here
    // rather than as a differently-shaded Story slide nobody diffed.
    expect(perLevel).toEqual([1, 0, 0, 1, 1]);
  });

  it('keeps the wash to a handful of loops, never a slab', () => {
    // The guard exists because an OPEN run clipped by the frame, closed with closePath(), draws a chord
    // across the frame and fills a rectangular slab — the bug the `closed` test was added for. If a
    // future stitch starts emitting long open runs that happen to begin and end near each other, this
    // catches the count explosion before anyone sees the slab.
    const total = storyContours().slice(0, 5).reduce((n, runs) => n + eligible(runs), 0);
    expect(total).toBeGreaterThan(0);
    expect(total).toBeLessThan(8);
  });

  it('every eligible loop really is a loop, not a near-miss', () => {
    storyContours().slice(0, 5).forEach((runs, i) => {
      for (const run of runs) {
        if (run.length < MIN_PTS) continue;
        const a = run[0], z = run[run.length - 1];
        const gap = Math.hypot(a[0] - z[0], a[1] - z[1]);
        if (gap >= CLOSE_TOL) continue;
        // a closed loop of ≥12 points should enclose real area, not be a hairpin
        let area = 0;
        for (let k = 0; k < run.length; k++) {
          const p = run[k], q = run[(k + 1) % run.length];
          area += p[0] * q[1] - q[0] * p[1];
        }
        expect(Math.abs(area) / 2, `a filled loop at level ${i} encloses no area`)
          .toBeGreaterThan(0.001);
      }
    });
  });
});
