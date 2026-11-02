// tests/knowledge.test.ts
// The claim: "the left global basin is not visible at first." That is the most interesting thing the
// picture says, so it is the thing most worth locking down. These tests assert the DISCOVERY STRUCTURE —
// invisible at every stop the readout prints until the last stretch, known late, and the local basin
// known early — so that if anyone retunes the radii or moves a waypoint and the story stops being true,
// it fails here rather than becoming a quiet lie on the page.
//
// AGAINST THE MODEL THE PAGE RUNS, which is the whole change to this file. It used to assert the story
// against `knownAfter`/`isKnown`/`discoveredAt` — a per-stop model the page had stopped calling. So the
// sentence the page actually prints ("a deeper basin is now visible — it was there the whole time",
// DescentPath.astro's readout) was guarded by tests of a function nothing rendered, and the two models do
// NOT agree: the old one found the basin at the last stop, the live one finds it just past the seventh.
// Everything below uses `knownnessFn` over `trail()` through `trailSampler` — the exact three calls the
// component makes — and the readout's own 0.02 threshold.

import { describe, it, expect } from 'vitest';
import { knowledgeRadius, knownnessFn } from '../src/lib/knowledge';
import { trail, trailSampler, unknownAttractor } from '../src/lib/descentPath';
import { WAYPOINTS, trajectoryFacts } from '../src/lib/trajectory';

const pathAt = trailSampler(trail());
/** The readout's threshold, DescentPath.astro: `const found = known(att.x, att.y) > 0.02`. */
const FOUND = 0.02;
/** The trail parameter at which the walker stands on stop k (1-based) — the inverse of experience(). */
const atStop = (k: number) => (k - 1) / (WAYPOINTS.length - 1);
const knownAt = (u: number, p: { x: number; y: number }) => knownnessFn(u, pathAt)(p.x, p.y);

/** The first u at which a point is known, sampled finely enough to place it between two stops. */
function firstSeen(p: { x: number; y: number }): number {
  for (let i = 0; i <= 1000; i++) if (knownAt(i / 1000, p) > FOUND) return i / 1000;
  return -1;
}

const deep = unknownAttractor();          // what the readout tests — the global basin
const local = trajectoryFacts().localBasin;

describe('knowledgeRadius', () => {
  it('grows with experience', () => {
    expect(knowledgeRadius(0)).toBeLessThan(knowledgeRadius(1));
    expect(knowledgeRadius(1)).toBeLessThan(knowledgeRadius(7));
  });

  it('is positive from the very first stop', () => {
    expect(knowledgeRadius(0)).toBeGreaterThan(0);
  });
});

describe('THE STORY: the deep basin is invisible at first', () => {
  it('is the basin the readout asks about', () => {
    // The readout tests `unknownAttractor()`. If that ever stopped being the global basin, every assertion
    // below would be guarding the wrong point.
    expect(deep.x).toBe(trajectoryFacts().globalBasin.x);
    expect(deep.y).toBe(trajectoryFacts().globalBasin.y);
  });

  it('is invisible at EVERY stop through Independent quant', () => {
    // Stops 1..7 — the whole engineering stretch and the independent work. The better optimum existed the
    // entire time; the readout must say "nothing deeper is visible" at each.
    for (let k = 1; k <= WAYPOINTS.length - 1; k++) {
      expect(knownAt(atStop(k), deep), `at stop ${k} (${WAYPOINTS[k - 1].label})`).toBeLessThanOrEqual(FOUND);
    }
  });

  it('is visible by the last stop', () => {
    expect(knownAt(1, deep)).toBeGreaterThan(FOUND);
  });

  it('is discovered only in the final stretch, after the seventh stop', () => {
    // Measured at u = 0.865 against stop 7 at 0.857. The assertion is the structure, not that number: it
    // appears strictly between the last two stops, so "it was there the whole time" stays true.
    const u = firstSeen(deep);
    expect(u).toBeGreaterThan(atStop(WAYPOINTS.length - 1));
    expect(u).toBeLessThanOrEqual(1);
  });
});

describe('the LOCAL basin is known early, which is the contrast', () => {
  it('comes into view before the second stop', () => {
    // You learn the comfortable minimum quickly — that is why it holds you. Measured at u = 0.115.
    const u = firstSeen(local);
    expect(u).toBeGreaterThanOrEqual(0);
    expect(u).toBeLessThan(atStop(2));
  });

  it('is known long before the deep basin', () => {
    expect(firstSeen(local)).toBeLessThan(firstSeen(deep));
  });
});

describe('knownnessFn — a soft edge, so knowledge fades rather than ending on a circle', () => {
  it('is 0 well outside everything known', () => {
    expect(knownAt(0.1, { x: -2.5, y: -2.5 })).toBe(0);
  });

  it('is ~1 where the walker is standing', () => {
    expect(knownAt(0.5, pathAt(0.5))).toBeCloseTo(1, 6);
  });

  it('decreases with distance from what is known', () => {
    const p = pathAt(0);
    const near = knownAt(0, { x: p.x + 0.2, y: p.y });
    const far = knownAt(0, { x: p.x + 0.6, y: p.y });
    expect(near).toBeGreaterThan(far);
    expect(far).toBeGreaterThan(0);   // still inside the first disc, so this compares two real values
  });

  it('stays within [0,1] everywhere sampled', () => {
    const k = knownnessFn(0.6, pathAt);
    for (let i = 0; i < 40; i++) {
      for (let j = 0; j < 12; j++) {
        const v = k(-2.6 + (5.2 * i) / 39, -2.6 + (5.2 * j) / 11);
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      }
    }
  });

  it('only ever grows as more is walked — nothing is forgotten', () => {
    for (const p of [deep, local, { x: 0.6, y: 0.1 }]) {
      let prev = -1;
      for (let i = 0; i <= 200; i++) {
        const v = knownAt(i / 200, p);
        expect(v).toBeGreaterThanOrEqual(prev);
        prev = v;
      }
    }
  });
});
