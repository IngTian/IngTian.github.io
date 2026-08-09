import { describe, it, expect } from 'vitest';
import { afterEvent, changePct, sumsToWhole, segments } from '../src/lib/split';
import { HOLDINGS, SPLITS, EVENT, BEATS } from '../src/data/define';

const OPENING = HOLDINGS.map((h) => h.weight);

describe('the declared splits', () => {
  // A split that does not sum to 100 would silently make one alternative look better than another, and the
  // slide's whole claim is that these are the SAME hundred pounds arranged differently.
  it('the opening split allocates the whole hundred', () => {
    expect(sumsToWhole(OPENING)).toBe(true);
  });

  it('every alternative split allocates the whole hundred', () => {
    for (const s of SPLITS) {
      expect(sumsToWhole(s.weights), s.label).toBe(true);
    }
  });

  it('there is one weight per holding in every split', () => {
    for (const s of SPLITS) expect(s.weights, s.label).toHaveLength(HOLDINGS.length);
    expect(EVENT.moves).toHaveLength(HOLDINGS.length);
  });

  it('no split holds a negative amount — you cannot own less than nothing here', () => {
    for (const s of SPLITS) for (const w of s.weights) expect(w).toBeGreaterThanOrEqual(0);
  });
});

describe('afterEvent', () => {
  it('leaves the money unchanged when nothing moves', () => {
    expect(afterEvent(OPENING, [0, 0, 0, 0])).toBeCloseTo(100, 9);
  });

  it('applies each move to its own share', () => {
    // Half in something that halves, half in something flat -> 75.
    expect(afterEvent([50, 50], [-0.5, 0])).toBeCloseTo(75, 9);
  });

  it('scales with the total', () => {
    expect(afterEvent([100], [0.1], 1000)).toBeCloseTo(1100, 9);
  });

  it('handles a ragged input rather than producing NaN', () => {
    expect(Number.isFinite(afterEvent([50, 50], [0.1]))).toBe(true);
  });
});

describe('changePct', () => {
  it('is zero for a flat event', () => {
    expect(changePct(OPENING, [0, 0, 0, 0])).toBeCloseTo(0, 9);
  });

  it('is negative when the biggest holding falls', () => {
    expect(changePct(OPENING, EVENT.moves)).toBeLessThan(0);
  });
});

describe('THE SLIDE\'S ARGUMENT: the split changes the outcome', () => {
  // This is the assertion the whole slide rests on. If every split gave the same result, "optimising it is
  // choosing the split" would be an empty claim and the picture would argue against its own caption.
  it('the three alternatives give three different outcomes', () => {
    const results = SPLITS.map((s) => changePct(s.weights, EVENT.moves));
    expect(new Set(results.map((r) => r.toFixed(4))).size).toBe(SPLITS.length);
  });

  it('all-in on the falling name is the worst of them', () => {
    const allIn = SPLITS.find((s) => s.label === 'All in on one')!;
    const others = SPLITS.filter((s) => s !== allIn);
    for (const o of others) {
      expect(changePct(allIn.weights, EVENT.moves)).toBeLessThan(changePct(o.weights, EVENT.moves));
    }
  });

  it('the defensive split loses least, which is what "mostly safe" has to mean', () => {
    const safe = SPLITS.find((s) => s.label === 'Mostly safe')!;
    for (const o of SPLITS.filter((s) => s !== safe)) {
      expect(changePct(safe.weights, EVENT.moves)).toBeGreaterThan(changePct(o.weights, EVENT.moves));
    }
  });

  it('the spread between best and worst is large enough to SEE', () => {
    const results = SPLITS.map((s) => changePct(s.weights, EVENT.moves));
    expect(Math.max(...results) - Math.min(...results)).toBeGreaterThan(8);
  });
});

describe('segments', () => {
  it('lays a split out end to end with no gaps or overlaps', () => {
    const segs = segments([40, 25, 20, 15]);
    expect(segs[0]).toEqual({ start: 0, width: 40 });
    for (let i = 1; i < segs.length; i++) {
      expect(segs[i].start).toBeCloseTo(segs[i - 1].start + segs[i - 1].width, 9);
    }
    const last = segs[segs.length - 1];
    expect(last.start + last.width).toBeCloseTo(100, 9);
  });

  it('handles a zero-width share without breaking the run', () => {
    const segs = segments([100, 0, 0, 0]);
    expect(segs[1].width).toBe(0);
    expect(segs[1].start).toBe(100);
  });

  it('handles an empty split', () => {
    expect(segments([])).toEqual([]);
  });
});

describe('the three beats — the definition itself', () => {
  // The slide defines the term in three beats, and the order is the point: what a portfolio IS, then what
  // optimising it means, then what multi-period adds. A missing or reordered beat breaks the explanation.
  it('there are exactly three, in the defining order', () => {
    expect(BEATS).toHaveLength(3);
    expect(BEATS[0].ask.toLowerCase()).toContain('portfolio');
    expect(BEATS[1].ask.toLowerCase()).toContain('optimis');
    expect(BEATS[2].ask.toLowerCase()).toContain('multi-period');
  });

  it('each beat asks a question and answers it', () => {
    for (const b of BEATS) {
      expect(b.ask.endsWith('?'), b.ask).toBe(true);
      expect(b.say.length).toBeGreaterThan(20);
    }
  });

  // A definition that runs to a paragraph has failed at being a definition.
  it('no answer runs longer than a breath', () => {
    for (const b of BEATS) {
      expect(b.say.split(/\s+/).length, b.ask).toBeLessThan(35);
    }
  });
});
