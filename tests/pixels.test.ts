import { describe, it, expect } from 'vitest';
import { compileGlyph, coverage, inBounds } from '../src/lib/pixels';
import { ASSET_GLYPHS } from '../src/data/assetGlyphs';

describe('compileGlyph', () => {
  it('fills every non-empty cell', () => {
    const g = compileGlyph(['#.', '.#']);
    expect(g.w).toBe(2);
    expect(g.h).toBe(2);
    expect(g.cells).toEqual([{ x: 0, y: 0 }, { x: 1, y: 1 }]);
  });

  it('treats any non-empty character as ink', () => {
    expect(compileGlyph(['ab.']).cells).toHaveLength(2);
  });

  it('honours a custom empty marker', () => {
    expect(compileGlyph([' # '], ' ').cells).toEqual([{ x: 1, y: 0 }]);
  });

  // A ragged glyph would render as a subtly wrong shape, which is far harder to spot than a build error.
  it('throws on a ragged matrix rather than clipping silently', () => {
    expect(() => compileGlyph(['##', '#'])).toThrow(/row 1/);
  });

  it('handles an empty input', () => {
    expect(compileGlyph([])).toEqual({ w: 0, h: 0, cells: [] });
  });

  it('handles an all-empty glyph', () => {
    expect(compileGlyph(['..', '..']).cells).toEqual([]);
  });
});

describe('the shipped asset glyphs', () => {
  const entries = Object.entries(ASSET_GLYPHS);

  it('there is one per asset class the slide shows', () => {
    expect(entries.map(([k]) => k).sort()).toEqual(['bonds', 'cash', 'commodities', 'equities']);
  });

  it('all share one grid size, so they align in a column', () => {
    const sizes = new Set(entries.map(([, g]) => `${g.w}x${g.h}`));
    expect(sizes.size).toBe(1);
  });

  it('every cell is inside its grid', () => {
    for (const [k, g] of entries) expect(inBounds(g), k).toBe(true);
  });

  // Ink coverage is the project's own measure of "reads empty" vs "reads as a block" — the showpiece notes
  // recorded 1.2-2.6% as reading empty. A glyph needs enough ink to be a shape and little enough to be a
  // mark rather than a filled square.
  it('each glyph has legible ink coverage', () => {
    for (const [k, g] of entries) {
      const c = coverage(g);
      expect(c, `${k} too sparse`).toBeGreaterThan(0.08);
      expect(c, `${k} too solid`).toBeLessThan(0.62);
    }
  });

  it('each glyph is distinguishable from the others', () => {
    const sigs = entries.map(([, g]) => g.cells.map((c) => `${c.x},${c.y}`).sort().join('|'));
    expect(new Set(sigs).size).toBe(entries.length);
  });

  // The marks are diagrams of what each asset IS, so a few structural properties are worth pinning:
  // equities should rise, cash should be flat, bonds should be regular.
  it('the equities mark rises left to right', () => {
    const g = ASSET_GLYPHS.equities;
    const topOf = (x: number) => Math.min(...g.cells.filter((c) => c.x === x).map((c) => c.y), Infinity);
    const left = topOf(1);
    const right = topOf(9);
    expect(right).toBeLessThan(left);   // smaller y = taller
  });

  it('the cash mark is a flat line', () => {
    const g = ASSET_GLYPHS.cash;
    const rows = new Set(g.cells.map((c) => c.y));
    expect(rows.size).toBeLessThanOrEqual(3);
  });
});
