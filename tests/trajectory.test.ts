// tests/trajectory.test.ts
// The career-as-descent reading is only worth shipping if the FIELD ACTUALLY SUPPORTS IT. These
// tests are the honesty gate: they assert the two basins, the barrier and the entrapment are real
// properties of lib/terrain.ts, measured, not asserted. If someone retunes BUMPS and the story
// stops being true, that must be a red test rather than a metaphor quietly becoming a lie.

import { describe, it, expect } from 'vitest';
import {
  WAYPOINTS, settle, distinctBasins, barrier, trajectoryFacts, phases,
} from '../src/lib/trajectory';
import { field, RANGE } from '../src/lib/terrain';
import { timeline } from '../src/data/profile';

describe('the field supports the story', () => {
  const f = trajectoryFacts();

  it('has two DISTINCT basins', () => {
    // Dedupe is load-bearing: two of terrain.ts's three valley centres descend into the same
    // basin, and a naive sort-and-take-two reports a gap of 0.0000. That bug happened.
    const basins = distinctBasins([[-1.4, -0.5], [1.5, 0.7], [0.3, -1.3]]);
    expect(basins).toHaveLength(2);
    expect(Math.hypot(basins[0].x - basins[1].x, basins[0].y - basins[1].y)).toBeGreaterThan(1);
  });

  it('makes the global basin meaningfully deeper than the local one', () => {
    // If the gap were tiny the story would be dishonest — leaving would not be worth it.
    expect(f.globalBasin.depth).toBeLessThan(f.localBasin.depth);
    expect(f.gap).toBeGreaterThan(0.2);
  });

  it('puts a real barrier between them', () => {
    // The barrier is what makes the escape meaningful. Without it the path is just a walk.
    expect(f.barrierHeight).toBeGreaterThan(f.localBasin.depth);
    expect(f.climbRequired).toBeGreaterThan(0.3);
  });

  it('proves a plain descent CANNOT escape the local basin', () => {
    // The whole point: gradient descent is a local method. Escaping is not something the
    // algorithm does for you, which is exactly why the career story is interesting.
    expect(f.staysStuck).toBe(true);
  });

  it('settles deterministically from the same seed', () => {
    const a = settle(1.5, 0.7);
    const b = settle(1.5, 0.7);
    expect(a.x).toBe(b.x);
    expect(a.depth).toBe(b.depth);
  });

  it('finds a genuine minimum — the gradient vanishes there', () => {
    const b = settle(1.5, 0.7);
    const h = 1e-4;
    const gx = (field(b.x + h, b.y) - field(b.x - h, b.y)) / (2 * h);
    const gy = (field(b.x, b.y + h) - field(b.x, b.y - h)) / (2 * h);
    expect(Math.hypot(gx, gy)).toBeLessThan(1e-3);
  });
});

describe('barrier', () => {
  it('reports the peak strictly between the endpoints, not at them', () => {
    const f = trajectoryFacts();
    const b = barrier(f.localBasin, f.globalBasin);
    expect(b.t).toBeGreaterThan(0.05);
    expect(b.t).toBeLessThan(0.95);
  });
});

describe('the declared waypoints', () => {
  it('places every stop inside the field', () => {
    for (const w of WAYPOINTS) {
      expect(Math.abs(w.x), w.label).toBeLessThanOrEqual(RANGE);
      expect(Math.abs(w.y), w.label).toBeLessThanOrEqual(RANGE);
    }
  });

  it('matches every waypoint period to a real timeline entry', () => {
    // The path must not invent a job. If profile.ts changes, this fails rather than the page
    // quietly showing a role he never had.
    const periods = new Set(timeline.map((t) => t.period));
    for (const w of WAYPOINTS) {
      expect(periods.has(w.period), `${w.label} (${w.period}) not in timeline`).toBe(true);
    }
  });

  it('lands the engineering years in the LOCAL basin and the PhD in the GLOBAL one', () => {
    // The shape of the claim, asserted. The senior-SWE stop must genuinely sit in the shallower
    // minimum, and the PhD in the deeper one — otherwise the picture argues the opposite.
    const f = trajectoryFacts();
    const swe = WAYPOINTS.find((w) => w.label.includes('Senior SWE'))!;
    const phd = WAYPOINTS.find((w) => w.label.includes('PhD'))!;
    expect(settle(swe.x, swe.y).depth).toBeCloseTo(f.localBasin.depth, 3);
    expect(settle(phd.x, phd.y).depth).toBeCloseTo(f.globalBasin.depth, 3);
  });

  it('descends overall — later stops are lower than the first', () => {
    const first = field(WAYPOINTS[0].x, WAYPOINTS[0].y);
    const last = field(WAYPOINTS[WAYPOINTS.length - 1].x, WAYPOINTS[WAYPOINTS.length - 1].y);
    expect(last).toBeLessThan(first);
  });

  it('gives every stop a sensitivity line, not a job description', () => {
    // "What I learned about what I like" is the honest content; a duties list is not.
    for (const w of WAYPOINTS) {
      expect(w.learned.length, w.label).toBeGreaterThan(25);
    }
  });

  it('covers all four phases in order', () => {
    const p = phases();
    expect(p.map((x) => x.phase)).toEqual(['approach', 'basin', 'escape', 'descent']);
    for (const g of p) expect(g.stops.length, g.phase).toBeGreaterThan(0);
  });

  it('uses each timeline period at most once', () => {
    const seen = WAYPOINTS.map((w) => w.period);
    expect(new Set(seen).size).toBe(seen.length);
  });
});
