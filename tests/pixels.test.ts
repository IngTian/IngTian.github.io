import { describe, it, expect } from 'vitest';
import { compileGlyph, coverage, inBounds } from '../src/lib/pixels';
// The glyph set moved from generic asset classes to the concrete instruments the slide actually shows
// (AAPL, NVDA, META, BAC, gold, crude), so these assertions follow it.
import { TICKER_GLYPHS as ASSET_GLYPHS } from '../src/data/tickerGlyphs';

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

  it('there is a mark for every instrument category the slide shows', () => {
    expect(entries.map(([k]) => k).sort()).toEqual(['bank', 'chip', 'gold', 'oil', 'tech']);
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

  // The marks are diagrams of a CATEGORY, so a few structural properties are worth pinning against a
  // careless edit: the chip has pins on both sides, the bank stands on columns, the gold bar is a solid
  // trapezoid.
  it('the chip mark has pins reaching both edges', () => {
    const g = ASSET_GLYPHS.chip;
    const xs = g.cells.map((c) => c.x);
    expect(Math.min(...xs)).toBe(0);
    expect(Math.max(...xs)).toBe(g.w - 1);
  });

  it('the bank mark is wider at the base than at the apex', () => {
    const g = ASSET_GLYPHS.bank;
    const widthAt = (y: number) => g.cells.filter((c) => c.y === y).length;
    expect(widthAt(0)).toBeLessThan(widthAt(3));
  });

  it('the gold mark is solid through its middle', () => {
    const g = ASSET_GLYPHS.gold;
    const mid = Math.floor(g.h / 2);
    expect(g.cells.filter((c) => c.y === mid).length).toBe(g.w);
  });
});
