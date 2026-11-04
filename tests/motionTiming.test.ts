import { describe, expect, it } from 'vitest';
import { DRAW, EASE, mergeLines, stagger, sweepDurations } from '../src/lib/motionTiming';

describe('the two curves', () => {
  it('are the prototype’s: EASE for every move, DRAW for a figure drawing itself', () => {
    expect(EASE).toBe('cubic-bezier(.2,.7,.2,1)');
    expect(DRAW).toBe('cubic-bezier(.33,.08,.24,1)');
  });
});

describe('stagger', () => {
  it('starts the first item at once', () => {
    expect(stagger(0, 10, { step: 40, total: 320 })).toBe(0);
    expect(stagger(0, 1, { step: 40 })).toBe(0);
  });

  it('spaces items by step while they fit', () => {
    expect([0, 1, 2, 3].map((i) => stagger(i, 4, { step: 40, total: 320 }))).toEqual([0, 40, 80, 120]);
  });

  it('closes the gaps so the last item starts by total, however many there are', () => {
    // the rail's entrance: 180ms each, all within 500ms, so the last may start no later than 320ms
    for (const n of [2, 9, 10, 23, 60]) {
      const last = stagger(n - 1, n, { step: 40, total: 500 - 180 });
      expect(last + 180, `n=${n}`).toBeLessThanOrEqual(500);
    }
    expect(stagger(9, 10, { step: 40, total: 500, max: 40 })).toBeLessThanOrEqual(500 - 180);
  });

  it('caps any one delay at max', () => {
    // the prototype's reveal: 60ms apart, never more than 120ms late
    expect([0, 1, 2, 3, 4].map((i) => stagger(i, 5, { step: 60, max: 120 }))).toEqual([0, 60, 120, 120, 120]);
  });

  it('is plain step × i with neither bound', () => {
    expect(stagger(5, 6, { step: 120 })).toBe(600);
  });
});

describe('sweepDurations', () => {
  it('shares the total in proportion to each line’s width', () => {
    expect(sweepDurations([100, 300], 640)).toEqual([160, 480]);
  });

  it('sums to the total exactly', () => {
    const d = sweepDurations([137.3, 412.9, 61.04], 640);
    expect(d.reduce((s, x) => s + x, 0)).toBe(640);
  });

  it('splits evenly when no line has width, and gives nothing for no lines', () => {
    expect(sweepDurations([0, 0], 640)).toEqual([320, 320]);
    expect(sweepDurations([], 640)).toEqual([]);
  });
});

describe('mergeLines', () => {
  const r = (left: number, right: number, top: number, bottom: number) => ({ left, right, top, bottom });

  it('merges the rects one line breaks into (around an inline child) into one box', () => {
    expect(mergeLines([r(10, 80, 100, 124), r(80, 140, 98, 124)]))
      .toEqual([{ left: 10, top: 98, width: 130, height: 26 }]);
  });

  it('keeps lines apart, top to bottom, and drops slivers', () => {
    expect(mergeLines([r(10, 300, 100, 124), r(300, 300.4, 100, 124), r(0, 120, 130, 154)]))
      .toEqual([{ left: 10, top: 100, width: 290, height: 24 }, { left: 0, top: 130, width: 120, height: 24 }]);
  });
});
