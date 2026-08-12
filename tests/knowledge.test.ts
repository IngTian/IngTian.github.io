// tests/knowledge.test.ts
// The claim: "the left global basin is not visible at first." That is the most interesting thing the
// picture says, so it is the thing most worth locking down. These tests assert the DISCOVERY
// STRUCTURE — invisible early, discovered late, and by a genuinely narrow margin — so that if
// anyone retunes the radii or moves a waypoint and the story stops being true, it fails here rather
// than becoming a quiet lie on the page.

import { describe, it, expect } from 'vitest';
import {
  knowledgeRadius, knownAfter, isKnown, knownness, discoveredAt, discoveryOf,
  perceivedField, knownMean,
} from '../src/lib/knowledge';
import { WAYPOINTS, trajectoryFacts } from '../src/lib/trajectory';
import { field } from '../src/lib/terrain';

const facts = trajectoryFacts();

describe('knowledgeRadius', () => {
  it('grows with experience', () => {
    expect(knowledgeRadius(0)).toBeLessThan(knowledgeRadius(1));
    expect(knowledgeRadius(1)).toBeLessThan(knowledgeRadius(7));
  });

  it('is positive from the very first stop', () => {
    expect(knowledgeRadius(0)).toBeGreaterThan(0);
  });
});

describe('knownAfter', () => {
  it('knows nothing before the first stop', () => {
    expect(knownAfter(0)).toHaveLength(0);
  });

  it('accumulates one disc per stop walked', () => {
    expect(knownAfter(1)).toHaveLength(1);
    expect(knownAfter(5)).toHaveLength(5);
    expect(knownAfter(WAYPOINTS.length)).toHaveLength(WAYPOINTS.length);
  });

  it('never forgets an earlier disc', () => {
    const five = knownAfter(5).map((d) => d.index);
    expect(five).toEqual([0, 1, 2, 3, 4]);
  });
});

describe('THE STORY: the deep basin is invisible at first', () => {
  const g = facts.globalBasin;

  it('is not visible from the first stop', () => {
    expect(isKnown(g.x, g.y, 1)).toBe(false);
  });

  it('stays invisible through the whole engineering stretch', () => {
    // Every stop up to and including Electronic Arts. The better optimum existed the entire time.
    for (let k = 1; k <= 7; k++) {
      expect(isKnown(g.x, g.y, k), `after ${k} stops`).toBe(false);
    }
  });

  it('is discovered only at the last stop', () => {
    expect(discoveredAt(g.x, g.y)).toBe(WAYPOINTS.length);
    expect(isKnown(g.x, g.y, WAYPOINTS.length)).toBe(true);
  });

  it('reports seven blind stops before the discovery', () => {
    const d = discoveryOf(g.x, g.y)!;
    expect(d.blindStops).toBe(7);
    expect(d.label).toContain('PhD');
  });

  it('misses it by a hair at the stop before — measured, not arranged', () => {
    // At Electronic Arts the distance to the deep basin is 1.72 against a radius of 1.71: it is 0.01
    // out of reach. That falls out of the declared waypoint positions; it was not tuned.
    const d = discoveryOf(g.x, g.y)!;
    expect(d.nearMiss).toBeGreaterThan(0);
    expect(d.nearMiss).toBeLessThan(0.1);
  });
});

describe('the LOCAL basin is known early, which is the contrast', () => {
  const l = facts.localBasin;

  it('comes into view within the first few stops', () => {
    // You learn the comfortable minimum quickly — that is why it holds you.
    expect(discoveredAt(l.x, l.y)).toBeLessThanOrEqual(2);
  });

  it('is known long before the deep basin', () => {
    expect(discoveredAt(l.x, l.y)).toBeLessThan(discoveredAt(facts.globalBasin.x, facts.globalBasin.y));
  });
});

describe('knownness — a soft edge, so knowledge fades rather than ending on a circle', () => {
  it('is 0 well outside everything known', () => {
    expect(knownness(-2.5, -2.5, 1)).toBe(0);
  });

  it('rises toward 1 at a disc centre', () => {
    const w = WAYPOINTS[0];
    expect(knownness(w.x, w.y, 1)).toBeCloseTo(1, 6);
  });

  it('decreases with distance from what is known', () => {
    const w = WAYPOINTS[0];
    const near = knownness(w.x + 0.2, w.y, 1);
    const far = knownness(w.x + 0.6, w.y, 1);
    expect(near).toBeGreaterThan(far);
  });

  it('stays within [0,1] everywhere sampled', () => {
    for (let i = 0; i < 40; i++) {
      const x = -2.6 + (5.2 * i) / 39;
      for (let j = 0; j < 12; j++) {
        const y = -2.6 + (5.2 * j) / 11;
        const v = knownness(x, y, 4);
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      }
    }
  });

  it('only ever grows as more is walked', () => {
    const x = 0.6, y = 0.1;
    let prev = -1;
    for (let k = 1; k <= WAYPOINTS.length; k++) {
      const v = knownness(x, y, k);
      expect(v).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
  });
});

describe('perceivedField — the surface as currently understood', () => {
  it('equals the true field where knowledge is complete', () => {
    const w = WAYPOINTS[0];
    expect(perceivedField(w.x, w.y, 1)).toBeCloseTo(field(w.x, w.y), 6);
  });

  it('hides the deep basin early — perceived depth is far shallower than the truth', () => {
    // The point of the whole device: early on, the deepest place on the field does not look deep.
    const g = facts.globalBasin;
    const perceivedEarly = perceivedField(g.x, g.y, 3);
    expect(perceivedEarly).toBeGreaterThan(field(g.x, g.y) + 0.5);
  });

  it('reveals the deep basin once it is known', () => {
    const g = facts.globalBasin;
    const perceivedLate = perceivedField(g.x, g.y, WAYPOINTS.length);
    expect(perceivedLate).toBeLessThan(perceivedField(g.x, g.y, 3));
  });

  it('is deterministic', () => {
    expect(perceivedField(0.3, 0.3, 4)).toBe(perceivedField(0.3, 0.3, 4));
  });
});

describe('knownMean — the prior is derived, not chosen', () => {
  it('is 0 when nothing is known', () => {
    expect(knownMean(0)).toBe(0);
  });

  it('sits inside the field\'s real range', () => {
    const m = knownMean(5);
    expect(m).toBeGreaterThan(-2);
    expect(m).toBeLessThan(2);
  });
});
