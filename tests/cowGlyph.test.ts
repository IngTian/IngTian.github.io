import { describe, it, expect } from 'vitest';
import { COW, COW_LINES } from '../src/data/cowGlyph';
import { coverage, inBounds } from '../src/lib/pixels';

// The site's one joke, so it gets the same treatment as everything else: the glyph is data, and data can be
// wrong in ways nobody notices in a 30px mark.

describe('the plush cow', () => {
  it('is a rectangular matrix that compiled', () => {
    expect(COW.w).toBe(15);
    expect(COW.h).toBe(13);
    expect(COW.cells.length).toBeGreaterThan(0);
  });

  it('keeps every cell inside its grid', () => {
    expect(inBounds(COW)).toBe(true);
  });

  // A plush toy is a solid shape, so it sits far higher than the 15-60% band the rule marks use — but not
  // solid, or the eyes and nostrils would be gone and it would read as a blob.
  it('is solid like a plush toy, without losing its holes', () => {
    const c = coverage(COW);
    expect(c).toBeGreaterThan(0.55);
    expect(c).toBeLessThan(0.82);
  });

  it('has two eyes, symmetric about the centre', () => {
    // Eyes are HOLES in the plush. Row 5 is the eye row; the holes must mirror each other, or the cow squints.
    const filled = new Set(COW.cells.filter((c) => c.y === 5).map((c) => c.x));
    const holes = [...Array(COW.w).keys()].filter((x) => !filled.has(x));
    expect(holes).toHaveLength(2);
    expect(holes[0] + holes[1]).toBe(COW.w - 1);
  });

  it('has a snout narrower than its head', () => {
    const widthAt = (y: number) => COW.cells.filter((c) => c.y === y).length;
    expect(widthAt(12)).toBeLessThan(widthAt(5));
  });

  it('has ears that do not touch across the top', () => {
    // Row 0 is the two ear tips; if they merged the cow would read as a bear.
    const xs = COW.cells.filter((c) => c.y === 0).map((c) => c.x).sort((a, b) => a - b);
    expect(xs.length).toBeGreaterThan(1);
    const gaps = xs.slice(1).map((x, i) => x - xs[i]);
    expect(Math.max(...gaps), 'the ears are joined').toBeGreaterThan(1);
  });
});

describe('what the cow says', () => {
  it('has something to say', () => {
    expect(COW_LINES.length).toBeGreaterThanOrEqual(3);
  });

  it('keeps every line short enough for one line of mono at 11.5px', () => {
    for (const l of COW_LINES) {
      expect(l.length, l).toBeLessThanOrEqual(56);
      expect(l).toBe(l.trim());
    }
  });

  it('says nothing twice', () => {
    expect(new Set(COW_LINES).size).toBe(COW_LINES.length);
  });

  it('moos at least once — it is a cow', () => {
    expect(COW_LINES.some((l) => /moo/i.test(l))).toBe(true);
  });

  // The site's register does not survive whimsy, and an easter egg is not licence to break it. No exclamation
  // marks, no emoji, no all-caps shouting.
  it('stays in the site’s dry register', () => {
    for (const l of COW_LINES) {
      expect(l, l).not.toMatch(/!/);
      expect(l, l).not.toMatch(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u);
      expect(l, l).not.toMatch(/\b[A-Z]{4,}\b/);
    }
  });

  it('makes no claim about performance that could be read as real', () => {
    // It is a joke on a quant's portfolio site; it must not look like a disclaimer or a result.
    const all = COW_LINES.join(' ').toLowerCase();
    expect(all).not.toMatch(/sharpe of|returned|outperform/);
  });
});
