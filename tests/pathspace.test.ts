import { describe, it, expect } from 'vitest';
import {
  PATH_LEVELS, PATH_PERIODS, PATH_RULES, ALL_PATHS,
  allPaths, survivors, countAfter, survivalSeries, killedBy, countFuturesFrom,
  compoundedFraction, projectNode, pathPoints,
} from '../src/lib/pathspace';

// THE POINT OF THIS FILE. The slide's multi-period claim rests on these counts, and the counts are the kind of
// thing that can be quietly wrong forever — nobody can check "95 paths survive" by looking at a drawing. So the
// arithmetic is pinned here: the partition must balance exactly, every rule must actually remove something, and
// the structural claim (futures depend on where you stand) must be TRUE rather than asserted in prose.

describe('the grid', () => {
  it('is a stated, modest discretisation — the honesty condition for drawing paths at all', () => {
    expect(PATH_LEVELS).toBe(5);
    expect(PATH_PERIODS).toBe(4);
  });

  it('enumerates every sequence exactly once', () => {
    expect(ALL_PATHS).toHaveLength(PATH_LEVELS ** PATH_PERIODS);
    const seen = new Set(ALL_PATHS.map((p) => p.join(',')));
    expect(seen.size).toBe(ALL_PATHS.length);
  });

  it('gives every path one decision per period, each a real band', () => {
    for (const p of ALL_PATHS) {
      expect(p).toHaveLength(PATH_PERIODS);
      for (const v of p) {
        expect(Number.isInteger(v)).toBe(true);
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThan(PATH_LEVELS);
      }
    }
  });

  it('is deterministic', () => {
    expect(allPaths()).toEqual(ALL_PATHS);
  });

  it('scales as levels^periods on other grids too', () => {
    expect(allPaths(3, 3)).toHaveLength(27);
    expect(allPaths(2, 5)).toHaveLength(32);
    expect(allPaths(4, 1)).toHaveLength(4);
  });
});

describe('the rules', () => {
  it('names every rule, says why it exists, and classifies it', () => {
    for (const r of PATH_RULES) {
      expect(r.label.length).toBeGreaterThan(8);
      // The "why" is what turns a line into a rule — the slide's whole complaint was that constraints arrive
      // unexplained, so an unexplained rule must not be shippable.
      expect(r.why.length, r.label).toBeGreaterThan(40);
      expect(['step', 'level', 'window']).toContain(r.kind);
    }
  });

  // The argument the triangle CANNOT make needs at least one rule that couples periods. Without one, the whole
  // multi-period addition would be decoration on top of a single-period picture.
  it('includes at least one rule that couples adjacent periods', () => {
    expect(PATH_RULES.some((r) => r.kind === 'step' || r.kind === 'window')).toBe(true);
  });

  it('EVERY rule removes something — a rule that cuts nothing is decoration', () => {
    for (let n = 1; n <= PATH_RULES.length; n++) {
      expect(killedBy(n).length, PATH_RULES[n - 1].label).toBeGreaterThan(0);
    }
  });

  it('leaves a survivor set that is still countable by eye, which is why the grid is small', () => {
    const left = countAfter(PATH_RULES.length);
    expect(left).toBeGreaterThan(10);
    expect(left).toBeLessThan(80);
  });
});

describe('survivors and killedBy partition exactly', () => {
  it('kept + killed = the set that went in, at every step', () => {
    for (let n = 1; n <= PATH_RULES.length; n++) {
      expect(countAfter(n) + killedBy(n).length, `rule ${n}`).toBe(countAfter(n - 1));
    }
  });

  it('every killed path really fails the rule that killed it', () => {
    for (let n = 1; n <= PATH_RULES.length; n++) {
      const rule = PATH_RULES[n - 1];
      for (const p of killedBy(n)) expect(rule.test(p), `${rule.label} / ${p.join('')}`).toBe(false);
    }
  });

  it('every killed path satisfied all the EARLIER rules — it was alive until this one', () => {
    for (let n = 2; n <= PATH_RULES.length; n++) {
      for (const p of killedBy(n)) {
        for (const earlier of PATH_RULES.slice(0, n - 1)) {
          expect(earlier.test(p), `${earlier.label} / ${p.join('')}`).toBe(true);
        }
      }
    }
  });

  it('every survivor satisfies every rule applied so far', () => {
    for (let n = 0; n <= PATH_RULES.length; n++) {
      for (const p of survivors(n)) {
        for (const r of PATH_RULES.slice(0, n)) expect(r.test(p), `${r.label} / ${p.join('')}`).toBe(true);
      }
    }
  });

  it('is monotone — no rule can add paths back', () => {
    for (let n = 1; n <= PATH_RULES.length; n++) {
      expect(countAfter(n)).toBeLessThanOrEqual(countAfter(n - 1));
    }
  });

  it('degrades safely outside the rule range', () => {
    expect(killedBy(0)).toEqual([]);
    expect(killedBy(PATH_RULES.length + 1)).toEqual([]);
    expect(survivors(0)).toHaveLength(ALL_PATHS.length);
    expect(survivors(99)).toHaveLength(countAfter(PATH_RULES.length));
  });
});

describe('survivalSeries', () => {
  const s = survivalSeries();

  it('starts at the unconstrained whole and has one entry per rule plus the start', () => {
    expect(s[0]).toBe(1);
    expect(s).toHaveLength(PATH_RULES.length + 1);
  });

  it('is non-increasing and stays a fraction', () => {
    for (let i = 1; i < s.length; i++) {
      expect(s[i]).toBeLessThanOrEqual(s[i - 1]);
      expect(s[i]).toBeGreaterThan(0);
      expect(s[i]).toBeLessThanOrEqual(1);
    }
  });

  it('agrees with the counts it summarises', () => {
    for (let n = 0; n <= PATH_RULES.length; n++) {
      expect(s[n]).toBeCloseTo(countAfter(n) / ALL_PATHS.length, 12);
    }
  });
});

// ── THE STRUCTURAL CLAIM ──────────────────────────────────────────────────────────────────────────────
// This is the assertion the whole multi-period addition exists to make, and the one I got wrong first: I had
// claimed coupling makes the surviving set MUCH SMALLER, and the measurement said otherwise (a coupled rule and
// an uncoupled one of equal per-step severity land within ~1.4x). The true claim is that coupling makes your
// options DEPEND ON WHERE YOU ARE, which is what breaks separability.
describe('non-separability: futures depend on where you stand', () => {
  it('gives different starting bands different numbers of legal futures', () => {
    const counts = Array.from({ length: PATH_LEVELS }, (_, s) => countFuturesFrom(s));
    expect(new Set(counts).size).toBeGreaterThan(1);
  });

  it('leaves at least one band with NO legal future at all — the floor and cap forbid starting there', () => {
    const counts = Array.from({ length: PATH_LEVELS }, (_, s) => countFuturesFrom(s));
    expect(counts.some((c) => c === 0)).toBe(true);
  });

  it('has the interior bands strictly better off than the reachable edge', () => {
    const counts = Array.from({ length: PATH_LEVELS }, (_, s) => countFuturesFrom(s));
    const live = counts.filter((c) => c > 0);
    expect(Math.max(...live)).toBeGreaterThan(Math.min(...live));
  });

  it('sums over starting bands to the total survivor count', () => {
    const sum = Array.from({ length: PATH_LEVELS }, (_, s) => countFuturesFrom(s)).reduce((a, b) => a + b, 0);
    expect(sum).toBe(countAfter(PATH_RULES.length));
  });

  it('with NO rules, every band has the same number of futures — the contrast that proves the point', () => {
    const counts = Array.from({ length: PATH_LEVELS }, (_, s) => countFuturesFrom(s, 0));
    expect(new Set(counts).size).toBe(1);
    expect(counts[0]).toBe(PATH_LEVELS ** (PATH_PERIODS - 1));
  });
});

describe('compoundedFraction — exact, and independent of the grid', () => {
  it('is the identity for a single period', () => {
    expect(compoundedFraction(0.2, 1)).toBeCloseTo(0.2, 12);
  });

  it('compounds multiplicatively', () => {
    expect(compoundedFraction(0.2, 2)).toBeCloseTo(0.04, 12);
    expect(compoundedFraction(0.5, 4)).toBeCloseTo(0.0625, 12);
  });

  // The number the slide quotes, from the site's own fund figures: 20% legal per period over 24 periods.
  it('reproduces the headline figure at the fund horizon', () => {
    const f = compoundedFraction(0.2, 24);
    expect(f).toBeGreaterThan(1e-18);
    expect(f).toBeLessThan(1e-16);
  });

  it('leaves everything legal when nothing is constrained', () => {
    expect(compoundedFraction(1, 24)).toBe(1);
  });
});

describe('projectNode and pathPoints', () => {
  const box = { x: 0, y: 0, w: 300, h: 100 };

  it('puts the first period at the left edge and the last at the right', () => {
    expect(projectNode(0, 0, box)[0]).toBe(0);
    expect(projectNode(PATH_PERIODS - 1, 0, box)[0]).toBe(300);
  });

  it('puts MORE exposure higher on screen, like every other chart on the site', () => {
    const low = projectNode(0, 0, box)[1];
    const high = projectNode(0, PATH_LEVELS - 1, box)[1];
    expect(high).toBeLessThan(low);
  });

  it('keeps every node inside the box', () => {
    for (let t = 0; t < PATH_PERIODS; t++) {
      for (let l = 0; l < PATH_LEVELS; l++) {
        const [x, y] = projectNode(t, l, box);
        expect(x).toBeGreaterThanOrEqual(box.x);
        expect(x).toBeLessThanOrEqual(box.x + box.w);
        expect(y).toBeGreaterThanOrEqual(box.y);
        expect(y).toBeLessThanOrEqual(box.y + box.h);
      }
    }
  });

  it('degrades safely on a single-level or single-period grid', () => {
    expect(Number.isFinite(projectNode(0, 0, box, 1, 1)[0])).toBe(true);
    expect(Number.isFinite(projectNode(0, 0, box, 1, 1)[1])).toBe(true);
  });

  it('renders a path as one point per period', () => {
    const pts = pathPoints([0, 1, 2, 3], box).split(' ');
    expect(pts).toHaveLength(4);
    for (const p of pts) expect(p).toMatch(/^-?\d+(\.\d)?,-?\d+(\.\d)?$/);
  });
});
