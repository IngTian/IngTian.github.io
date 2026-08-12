import { describe, it, expect } from 'vitest';
import {
  buildTree, pathOf, countsByDepth, reweightCost, costCurve, breakEvenParticipation,
} from '../src/lib/decisionTree';

describe('buildTree', () => {
  it('has one root', () => {
    expect(buildTree(3, 4).byDepth[0]).toHaveLength(1);
  });

  // THE ARITHMETIC IS THE ARGUMENT: the drawing's width IS branch^depth, so the picture and the number the
  // copy quotes cannot disagree.
  it('each depth has branch^depth nodes', () => {
    const t = buildTree(3, 4);
    expect(countsByDepth(t)).toEqual([1, 3, 9, 27, 81]);
    expect(t.leaves).toBe(81);
  });

  it('leaves equal branch to the power of depths', () => {
    for (const [b, d] of [[2, 5], [3, 3], [4, 4], [5, 2]]) {
      expect(buildTree(b, d).leaves).toBe(Math.pow(b, d));
    }
  });

  it('every non-root node has a real parent in the previous depth', () => {
    const t = buildTree(3, 4);
    for (const n of t.nodes) {
      if (n.depth === 0) { expect(n.parent).toBe(-1); continue; }
      const prev = t.byDepth[n.depth - 1];
      expect(n.parent).toBeGreaterThanOrEqual(0);
      expect(n.parent).toBeLessThan(prev.length);
    }
  });

  it('produces one edge per non-root node', () => {
    const t = buildTree(3, 4);
    expect(t.edges).toHaveLength(t.nodes.length - 1);
  });

  it('positions every node inside the unit box', () => {
    const t = buildTree(4, 3);
    for (const n of t.nodes) {
      expect(n.x).toBeGreaterThan(0);
      expect(n.x).toBeLessThan(1);
      expect(n.y).toBeGreaterThanOrEqual(0);
      expect(n.y).toBeLessThanOrEqual(1);
    }
  });

  it('centres a single node and spreads a full row evenly', () => {
    const t = buildTree(3, 2);
    expect(t.byDepth[0][0].x).toBeCloseTo(0.5, 12);
    const row = t.byDepth[1].map((n) => n.x);
    expect(row).toEqual([1 / 6, 3 / 6, 5 / 6]);
  });

  it('puts depth 0 at y=0 and the last depth at y=1', () => {
    const t = buildTree(2, 3);
    expect(t.byDepth[0][0].y).toBe(0);
    expect(t.byDepth[3][0].y).toBe(1);
  });

  it('degrades safely on nonsense input', () => {
    expect(buildTree(0, 3).branch).toBe(1);
    expect(buildTree(3, -2).depths).toBe(0);
    const flat = buildTree(3, 0);
    expect(flat.nodes).toHaveLength(1);
    expect(flat.edges).toHaveLength(0);
    expect(flat.leaves).toBe(1);
  });
});

describe('pathOf', () => {
  const tree = buildTree(3, 4);

  it('walks the stated actions from the root', () => {
    const p = pathOf(tree, [0, 1, 2, 0]);
    expect(p).toHaveLength(5);
    expect(p[0].depth).toBe(0);
    expect(p[4].depth).toBe(4);
    for (let i = 1; i < p.length; i++) {
      expect(p[i].parent).toBe(p[i - 1].index);
    }
  });

  it('records the action taken at each step', () => {
    const actions = [2, 0, 1, 2];
    const p = pathOf(tree, actions);
    for (let i = 1; i < p.length; i++) expect(p[i].action).toBe(actions[i - 1]);
  });

  it('stops early when actions run out', () => {
    expect(pathOf(tree, [1, 1])).toHaveLength(3);
  });

  it('wraps out-of-range actions rather than throwing', () => {
    expect(() => pathOf(tree, [7, -3, 99, 0])).not.toThrow();
    expect(pathOf(tree, [7, -3, 99, 0])).toHaveLength(5);
  });

  it('handles a degenerate tree', () => {
    expect(pathOf(buildTree(3, 0), [1, 2])).toHaveLength(1);
  });
});

describe('reweightCost — spread plus square-root impact', () => {
  it('is zero when nothing is traded', () => {
    expect(reweightCost(0)).toBe(0);
  });

  it('grows with the fraction traded', () => {
    expect(reweightCost(0.5)).toBeGreaterThan(reweightCost(0.2));
  });

  // THE POINT OF THE MODEL: impact is sublinear in participation, so doubling your size does NOT double the
  // impact cost — it multiplies it by sqrt(2). That is why size is a distinct problem from quantity.
  it('impact scales with the square root of participation', () => {
    const a = reweightCost(1, 0, 100, 0.25);   // spread off, so this is impact alone
    const b = reweightCost(1, 0, 100, 1.00);
    expect(b / a).toBeCloseTo(2, 6);           // sqrt(1)/sqrt(0.25) = 2
  });

  it('charges the spread even at zero participation', () => {
    expect(reweightCost(1, 5, 35, 0)).toBeCloseTo(5 / 10000, 12);
  });

  it('is larger at larger participation, all else equal', () => {
    expect(reweightCost(1, 2, 35, 0.5)).toBeGreaterThan(reweightCost(1, 2, 35, 0.05));
  });

  it('never returns a negative cost', () => {
    expect(reweightCost(-1)).toBe(0);
    expect(reweightCost(1, 2, 35, -0.5)).toBeGreaterThanOrEqual(0);
  });
});

describe('costCurve', () => {
  it('starts at the spread and rises monotonically', () => {
    const c = costCurve(20, 1, 2, 35);
    expect(c[0].costBp).toBeCloseTo(2, 6);
    for (let i = 1; i < c.length; i++) {
      expect(c[i].costBp).toBeGreaterThan(c[i - 1].costBp);
    }
  });

  it('is concave — each step adds less than the one before', () => {
    // The visual signature of square-root impact, and the reason the curve is worth drawing at all.
    const c = costCurve(20, 1, 0, 35);
    const d1 = c[5].costBp - c[4].costBp;
    const d2 = c[19].costBp - c[18].costBp;
    expect(d2).toBeLessThan(d1);
  });

  it('returns the requested sample count', () => {
    expect(costCurve(12)).toHaveLength(13);
  });
});

describe('breakEvenParticipation', () => {
  it('finds where cost equals the edge', () => {
    const p = breakEvenParticipation(20, 2, 35)!;
    expect(reweightCost(1, 2, 35, p) * 10000).toBeCloseTo(20, 6);
  });

  it('is zero when the spread alone eats the edge', () => {
    expect(breakEvenParticipation(2, 2, 35)).toBe(0);
    expect(breakEvenParticipation(1, 2, 35)).toBe(0);
  });

  it('is null when the edge covers the cost at every level modelled', () => {
    expect(breakEvenParticipation(500, 2, 35)).toBeNull();
  });

  it('a bigger edge tolerates more participation', () => {
    const small = breakEvenParticipation(10, 2, 35)!;
    const big = breakEvenParticipation(25, 2, 35)!;
    expect(big).toBeGreaterThan(small);
  });
});
