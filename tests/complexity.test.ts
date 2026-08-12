import { describe, it, expect } from 'vitest';
import {
  SPREAD_BPS, SIGMA_DAILY, IMPACT_K, DAILY_VOLUME, TRAJ_COUNT, TRAJ_WEEKS,
  slippageBps, slippageCost, sizeLadder, trajectories, trajBounds, trajPoints,
  decisionVariables, scenarioLeaves, magnitude, rulePairs, conflictWeb, rulePoint,
} from '../src/lib/complexity';
import { FUND } from '../src/data/desk';

// THE POINT OF THIS FILE. The slide's job is to state a SCALE, and every number it states has to be either
// cited or computed — an invented number that looks authoritative is the one thing that would discredit the
// whole sequence. So the impact model is pinned to its published anchor, the ladder is pinned to the arithmetic,
// and the trajectories are pinned to being byte-identical on every build.

describe('the impact model is calibrated, not tuned', () => {
  // THE ANCHOR: trading one full day's volume moves the price about one daily standard deviation. That single
  // published fact fixes k, which is why IMPACT_K is 1 and not a number chosen to make the slide look good.
  it('reproduces the anchor exactly at 100% participation', () => {
    const impactOnly = IMPACT_K * SIGMA_DAILY * Math.sqrt(1);
    expect(impactOnly).toBeCloseTo(SIGMA_DAILY, 12);
  });

  it('agrees with the 10%-of-volume rule of thumb desks actually use', () => {
    const bps = slippageBps(DAILY_VOLUME * 0.10);
    // ~79bp: small enough to tolerate, large enough to budget for — which is why the convention sits there.
    expect(bps).toBeGreaterThan(60);
    expect(bps).toBeLessThan(100);
  });

  it('grows with the square root of participation, not linearly', () => {
    const a = slippageBps(DAILY_VOLUME * 0.01) - SPREAD_BPS / 2;
    const b = slippageBps(DAILY_VOLUME * 0.04) - SPREAD_BPS / 2;
    // 4x the participation is 2x the impact.
    expect(b / a).toBeCloseTo(2, 6);
  });

  it('charges at least the half-spread on any trade, however small', () => {
    expect(slippageBps(1)).toBeGreaterThanOrEqual(SPREAD_BPS / 2);
  });

  it('is free only when nothing is traded', () => {
    expect(slippageBps(0)).toBe(0);
    expect(slippageCost(0)).toBe(0);
  });

  it('costs more in a thinner market', () => {
    const deep = slippageBps(100e6, 30e9);
    const thin = slippageBps(100e6, 300e6);
    expect(thin).toBeGreaterThan(deep * 5);
  });
});

describe('the size ladder — beat one', () => {
  const rungs = sizeLadder();

  it('climbs in book size', () => {
    for (let i = 1; i < rungs.length; i++) expect(rungs[i].aum).toBeGreaterThan(rungs[i - 1].aum);
  });

  // THE READER'S OWN POSITION. If the smallest rung had a visible cost, the slide's opening claim — that a
  // person with their own savings may do whatever they like — would be false.
  it('costs the reader essentially nothing, which is why they have never met a constraint', () => {
    expect(rungs[0].cost).toBeLessThan(1);
    expect(rungs[0].participation).toBeLessThan(1e-6);
  });

  it('costs the biggest book millions for the same decision', () => {
    expect(rungs[rungs.length - 1].cost).toBeGreaterThan(1_000_000);
  });

  // The whole beat rests on this spread being enormous, so it is asserted rather than admired.
  it('spans at least six orders of magnitude in cost', () => {
    const lo = Math.max(rungs[0].cost, 1e-9);
    const hi = rungs[rungs.length - 1].cost;
    expect(magnitude(hi) - magnitude(lo)).toBeGreaterThanOrEqual(6);
  });

  it('reports participation, bps and cost consistently with each other', () => {
    for (const r of rungs) {
      expect(r.participation).toBeCloseTo(r.order / DAILY_VOLUME, 12);
      expect(r.bps).toBeCloseTo(slippageBps(r.order), 12);
      expect(r.cost).toBeCloseTo((r.order * r.bps) / 1e4, 6);
    }
  });

  it('scales the order with the fraction moved', () => {
    expect(sizeLadder(0.5)[2].order).toBeCloseTo(sizeLadder(0.25)[2].order * 2, 6);
  });
});

describe('the trajectories — beat three', () => {
  const paths = trajectories();

  it('draws the measured count over the full year', () => {
    expect(paths).toHaveLength(TRAJ_COUNT);
    for (const p of paths) expect(p).toHaveLength(TRAJ_WEEKS + 1);
  });

  // 120 is a MEASURED choice: rasterised into the real 560x300 box, 120 paths ink about 20% of it — plural
  // enough that the eye stops counting, sparse enough that single paths stay followable. 240 inks 28% and
  // individual paths are lost.
  it('uses a count in the legible band', () => {
    expect(TRAJ_COUNT).toBeGreaterThanOrEqual(60);
    expect(TRAJ_COUNT).toBeLessThanOrEqual(160);
  });

  it('starts every future at the same place, so the fan is comparable', () => {
    for (const p of paths) expect(p[0]).toBe(100);
  });

  it('keeps every value finite and positive', () => {
    for (const p of paths) for (const v of p) {
      expect(Number.isFinite(v)).toBe(true);
      expect(v).toBeGreaterThan(0);
    }
  });

  // DETERMINISM. The project bans Math.random() at paint time, and a fan that redrew itself differently on
  // every build would undercut a slide whose whole claim is that these specific numbers are real.
  it('is byte-identical on every call', () => {
    expect(trajectories()).toEqual(paths);
  });

  it('gives different seeds different fans', () => {
    expect(trajectories(TRAJ_COUNT, TRAJ_WEEKS, 999)).not.toEqual(paths);
  });

  // The fan must genuinely SPREAD, or "the future is uncertain" is asserted rather than shown.
  it('spreads widely by the end of the year', () => {
    const ends = paths.map((p) => p[p.length - 1]);
    expect(Math.min(...ends)).toBeLessThan(80);
    expect(Math.max(...ends)).toBeGreaterThan(200);
  });

  it('has both winners and losers, so the fan is not a rising bundle', () => {
    const ends = paths.map((p) => p[p.length - 1]);
    expect(ends.filter((e) => e < 100).length).toBeGreaterThan(5);
    expect(ends.filter((e) => e > 100).length).toBeGreaterThan(5);
  });
});

describe('trajBounds and trajPoints', () => {
  const paths = trajectories(8, 12, 7);
  const bounds = trajBounds(paths);
  const box = { x: 0, y: 0, w: 200, h: 100 };

  // NOT "brackets everything" any more — that assertion was written before the scale was clipped, and clipping
  // means a few outliers deliberately fall outside the box. What has to be true is that the scale holds the
  // BULK: one lucky path was taking 58% of the vertical space and flattening the other 119 into a band.
  it('brackets the great majority of points, and is exact with no trim', () => {
    const all = paths.flatMap((p) => p);
    const inside = all.filter((v) => v >= bounds.lo - 1e-9 && v <= bounds.hi + 1e-9).length;
    expect(inside / all.length).toBeGreaterThan(0.9);

    const exact = trajBounds(paths, 0);
    for (const v of all) {
      expect(v).toBeGreaterThanOrEqual(exact.lo - 1e-9);
      expect(v).toBeLessThanOrEqual(exact.hi + 1e-9);
    }
  });

  // The reason clipping exists, asserted on the real fan rather than on this small one.
  it('keeps the drawn range far tighter than the extremes, so the fan is not squashed', () => {
    const real = trajectories();
    const clipped = trajBounds(real);
    const full = trajBounds(real, 0);
    expect(clipped.hi - clipped.lo).toBeLessThan((full.hi - full.lo) * 0.75);
  });

  it('degrades to the extremes when a trim would collapse the range', () => {
    const flat = [[100, 100, 100]];
    const b = trajBounds(flat, 0.4);
    expect(b.hi).toBeGreaterThan(b.lo);
  });

  it('maps the first week to the left edge and the last to the right', () => {
    const pts = trajPoints(paths[0], bounds, box).split(' ');
    expect(Number(pts[0].split(',')[0])).toBeCloseTo(0, 6);
    expect(Number(pts[pts.length - 1].split(',')[0])).toBeCloseTo(200, 6);
  });

  it('puts higher values higher on screen', () => {
    const up = trajPoints([bounds.lo, bounds.hi], bounds, box).split(' ');
    expect(Number(up[1].split(',')[1])).toBeLessThan(Number(up[0].split(',')[1]));
  });

  it('emits one point per period', () => {
    expect(trajPoints(paths[0], bounds, box).split(' ')).toHaveLength(13);
  });

  it('degrades safely on empty input or a flat scale', () => {
    expect(trajBounds([]).hi).toBeGreaterThan(trajBounds([]).lo);
    const flat = trajPoints([100, 100], { lo: 100, hi: 100 }, box);
    for (const pt of flat.split(' ')) for (const n of pt.split(',')) expect(Number.isFinite(Number(n))).toBe(true);
  });
});

describe('the size of the question — beat four', () => {
  it('counts one weight per name per rebalance', () => {
    expect(decisionVariables(3000, 24)).toBe(72_000);
    expect(decisionVariables(FUND.tickers, FUND.periods)).toBeGreaterThan(50_000);
  });

  it('explodes the scenario tree, which is the number that makes the beat land', () => {
    expect(scenarioLeaves(3, 24)).toBeGreaterThan(1e11);
    expect(magnitude(scenarioLeaves(3, FUND.periods))).toBeGreaterThanOrEqual(11);
  });

  it('grows in the exponent, not the base — the definition of the problem being hard', () => {
    expect(scenarioLeaves(2, 24) * 1e3).toBeLessThan(scenarioLeaves(3, 24));
  });

  it('degrades safely rather than overflowing silently', () => {
    expect(scenarioLeaves(0, 5)).toBe(0);
    expect(scenarioLeaves(3, 0)).toBe(1);
    expect(scenarioLeaves(10, 400)).toBe(Infinity);
  });

  it('reads magnitudes the way the copy states them', () => {
    expect(magnitude(1)).toBe(0);
    expect(magnitude(999)).toBe(2);
    expect(magnitude(1000)).toBe(3);
    expect(magnitude(0)).toBe(0);
    expect(magnitude(-5)).toBe(0);
  });
});

// ── THE CONFLICT WEB — beat four's new drawing ────────────────────────────────────────────────────────
// The owner asked how to convey the magnitude, and probing the alternatives first is what produced this: the
// scenario count is a TRAP (10^11 is fewer than grains of sand, and brute-forceable in 282 seconds at a billion
// checks a second), so the drawing shows COUPLING instead. These tests pin the arithmetic behind that claim.
describe('rulePairs', () => {
  it('counts distinct pairs, which is the number that actually grows', () => {
    expect(rulePairs(2)).toBe(1);
    expect(rulePairs(4)).toBe(6);
    expect(rulePairs(2000)).toBe(1_999_000);
  });

  it('grows quadratically — ten times the rules is a hundred times the pairs', () => {
    expect(rulePairs(2000) / rulePairs(200)).toBeCloseTo(100, 0);
  });

  it('degrades safely below two rules', () => {
    expect(rulePairs(1)).toBe(0);
    expect(rulePairs(0)).toBe(0);
    expect(rulePairs(-5)).toBe(0);
  });

  it('is enormous for the fund the slide describes, which is the point', () => {
    expect(rulePairs(FUND.constraints)).toBeGreaterThan(1e6);
  });
});

describe('conflictWeb', () => {
  const web = conflictWeb();

  it('is deterministic — the drawing must not shimmer between builds', () => {
    expect(conflictWeb()).toEqual(web);
  });

  it('emits each interaction once, as an upper-triangle edge', () => {
    for (const [a, b] of web) expect(a).toBeLessThan(b);
    const seen = new Set(web.map(([a, b]) => `${a},${b}`));
    expect(seen.size).toBe(web.length);
  });

  it('stays inside the node count', () => {
    for (const [a, b] of conflictWeb(28)) {
      expect(a).toBeGreaterThanOrEqual(0);
      expect(b).toBeLessThan(28);
    }
  });

  // SPARSE ON PURPOSE. A complete graph would overstate it — real mandates do not have every rule touching
  // every other — and it would also draw as a solid disc, which shows nothing.
  it('is sparse enough to read as a web rather than a filled disc', () => {
    const density = web.length / rulePairs(28);
    expect(density).toBeGreaterThan(0.05);
    expect(density).toBeLessThan(0.3);
  });

  it('is dense enough that the tangle is visible', () => {
    expect(web.length).toBeGreaterThan(20);
  });

  it('scales with the requested density', () => {
    expect(conflictWeb(28, 0.5).length).toBeGreaterThan(conflictWeb(28, 0.1).length);
  });

  it('degrades safely on a trivial web', () => {
    expect(conflictWeb(1)).toEqual([]);
    expect(conflictWeb(0)).toEqual([]);
  });
});

describe('rulePoint', () => {
  it('starts at the top of the circle', () => {
    const [x, y] = rulePoint(0, 12, 100, 100, 50);
    expect(x).toBeCloseTo(100, 6);
    expect(y).toBeCloseTo(50, 6);
  });

  it('keeps every node on the circle', () => {
    for (let i = 0; i < 28; i++) {
      const [x, y] = rulePoint(i, 28, 150, 150, 118);
      expect(Math.hypot(x - 150, y - 150)).toBeCloseTo(118, 6);
    }
  });

  it('runs clockwise, the way a reader reads a dial', () => {
    const [x] = rulePoint(1, 12, 100, 100, 50);
    expect(x).toBeGreaterThan(100);
  });

  it('degrades safely on a degenerate circle', () => {
    const [x, y] = rulePoint(0, 0, 10, 20, 5);
    expect(Number.isFinite(x)).toBe(true);
    expect(Number.isFinite(y)).toBe(true);
  });
});

// ── THE m^1.5 LAW, which the owner named from memory and the code already implemented ────────────────
describe('the dollar cost of trading grows as m^1.5', () => {
  it('has a local exponent converging to 1.5 as the order grows', () => {
    // cost = m x bps and bps ~ sqrt(m), so cost ~ m^1.5. Fitted numerically rather than asserted from the
    // formula, so a change to the impact model cannot silently break the claim the slide now makes on-screen.
    const a = 1e9, b = 1e10;
    const p = (Math.log(slippageCost(b)) - Math.log(slippageCost(a))) / (Math.log(b) - Math.log(a));
    expect(p).toBeGreaterThan(1.48);
    expect(p).toBeLessThan(1.52);
  });

  it('means ten times the size is about thirty times the cost', () => {
    const ratio = slippageCost(1e10) / slippageCost(1e9);
    expect(ratio).toBeGreaterThan(28);
    expect(ratio).toBeLessThan(34);
  });
});
