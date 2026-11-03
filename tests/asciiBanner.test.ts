// tests/asciiBanner.test.ts
// The /projects banner is drawn, not typeset: the site's mono subset has no block or box-drawing glyphs, so as text
// each would fall back to the system mono at its own width (spec §11). These pin what the drawing promises —
// every row the same width, one rect per block, the box strokes where the boot will not mistake them for blocks,
// and no <text> anywhere.
import { describe, expect, it } from 'vitest';
import { ANSI_SHADOW, bannerRows, bannerSvg } from '../src/lib/asciiBanner';

const ROWS = bannerRows('PROJECTS');
const count = (s: string, re: RegExp): number => (s.match(re) ?? []).length;
/** The SVG with every shade group cut out, so what is left is the blocks. A shade group holds only rects. */
const blocksOnly = (svg: string): string => svg.replace(/<g class="shade"[^>]*>[\s\S]*?<\/g>/g, '');
const shadeOnly = (svg: string): string => [...svg.matchAll(/<g class="shade"[^>]*>([\s\S]*?)<\/g>/g)].map((m) => m[1]).join('');
/** Every rect as [x, y, width, height]. */
const rects = (svg: string): number[][] =>
  [...svg.matchAll(/<rect x="([-\d.]+)" y="([-\d.]+)" width="([\d.]+)" height="([\d.]+)"\/>/g)]
    .map((m) => m.slice(1).map(Number));

describe('ANSI_SHADOW', () => {
  it('gives every letter six rows of one width', () => {
    for (const [ch, rows] of Object.entries(ANSI_SHADOW)) {
      expect(rows, ch).toHaveLength(6);
      expect(new Set(rows.map((r) => r.length)).size, `${ch} is ragged`).toBe(1);
    }
  });

  it('is drawn only from blocks, the six box strokes and spaces', () => {
    for (const [ch, rows] of Object.entries(ANSI_SHADOW)) {
      expect(rows.join(''), ch).toMatch(/^[█═║╔╗╚╝ ]+$/);
    }
  });
});

describe('bannerRows', () => {
  it('sets PROJECTS as six rows of 73 cells — eight letters (O and T are 9 wide, the rest 8) and seven gaps', () => {
    expect(ROWS).toHaveLength(6);
    expect(ROWS.map((r) => r.length)).toEqual([73, 73, 73, 73, 73, 73]);
  });

  it('joins the letters with exactly one space', () => {
    expect(bannerRows('PR')[0]).toBe(`${ANSI_SHADOW.P[0]} ${ANSI_SHADOW.R[0]}`);
  });

  it('refuses a letter it has no matrix for, rather than drawing a hole', () => {
    expect(() => bannerRows('PX')).toThrow(/X/);
  });
});

describe('bannerSvg', () => {
  const svg = bannerSvg(ROWS, 6, 10.4);

  it('draws one rect per block, outside the shade groups', () => {
    const blocks = count(ROWS.join(''), /█/g);
    expect(blocks).toBeGreaterThan(0);
    expect(count(blocksOnly(svg), /<rect\b/g)).toBe(blocks);
  });

  it('draws the box characters as strokes in shade groups: two per straight, four per corner', () => {
    const all = ROWS.join('');
    const want = 2 * count(all, /[═║]/g) + 4 * count(all, /[╔╗╚╝]/g);
    expect(count(shadeOnly(svg), /<rect\b/g)).toBe(want);
  });

  it('has no <text> anywhere', () => {
    expect(svg).not.toMatch(/<text\b/);
  });

  it('puts every row in its own group, numbered 0-5, so the boot can light them one by one', () => {
    const rowGroups = [...svg.matchAll(/<g class="row" data-row="(\d+)">/g)].map((m) => Number(m[1]));
    expect(rowGroups).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it('places a block on its cell exactly', () => {
    expect(rects(bannerSvg([' █'], 6, 10.4))).toEqual([[6, 0, 6, 10.4]]);
  });

  // On a 10 x 10 cell: strokes 0.16 cell thick, the two lines of a double stroke 0.18 cell either side of the
  // centre, and every stroke running half a stroke (0.8) past each of its ends — past the cell edge into the
  // neighbour, so anti-aliased neighbours overlap rather than abut.
  it('draws ═ and ║ as two strokes 0.16 cell thick, 0.18 cell either side of the centre line', () => {
    expect(rects(bannerSvg(['═'], 10, 10))).toEqual([[-0.8, 2.4, 11.6, 1.6], [-0.8, 6, 11.6, 1.6]]);
    expect(rects(bannerSvg(['║'], 10, 10))).toEqual([[2.4, -0.8, 1.6, 11.6], [6, -0.8, 1.6, 11.6]]);
  });

  it('closes a corner: each pair of strokes meets at the corner and runs out past the edges it points at', () => {
    // ╔ points right and down. Outer pair meets at (2.4, 2.4), inner pair at (6, 6); both run on to 10.8.
    expect(rects(bannerSvg(['╔'], 10, 10))).toEqual([
      [2.4, 2.4, 8.4, 1.6], [2.4, 2.4, 1.6, 8.4],
      [6, 6, 4.8, 1.6], [6, 6, 1.6, 4.8],
    ]);
    // ╝ points left and up — the mirror image, so its strokes run on to x = -0.8 and y = -0.8.
    expect(rects(bannerSvg(['╝'], 10, 10))).toEqual([
      [-0.8, 6, 8.4, 1.6], [6, -0.8, 1.6, 8.4],
      [-0.8, 2.4, 4.8, 1.6], [2.4, -0.8, 1.6, 4.8],
    ]);
  });

  // The strokes are anti-aliased, because under crispEdges a 0.86px stroke rounds to 0, 1 or 2 device px by where
  // it starts. The blocks are left to the caller, which keeps them crisp: AA blocks seam.
  it('anti-aliases every shade group', () => {
    const groups = [...svg.matchAll(/<g class="shade"([^>]*)>/g)].map((m) => m[1]);
    expect(groups).toHaveLength(6);
    expect(groups.every((a) => a === ' shape-rendering="geometricPrecision"')).toBe(true);
  });

  // What makes the overshoot safe: a stroke that runs out of its cell always lands on ink — a block, or a box
  // character whose strokes run back into this cell on the same lines — never on blank or across another stroke.
  it('runs every stroke out of its cell into a block or a stroke that joins it, never into blank', () => {
    const EXITS: Record<string, string> = { '═': 'LR', '║': 'UD', '╔': 'RD', '╗': 'LD', '╚': 'RU', '╝': 'LU' };
    const STEP: Record<string, [number, number, string]> = { L: [-1, 0, 'R'], R: [1, 0, 'L'], U: [0, -1, 'D'], D: [0, 1, 'U'] };
    const loose: string[] = [];
    ROWS.forEach((row, r) => [...row].forEach((ch, c) => {
      for (const e of EXITS[ch] ?? '') {
        const [dc, dr, back] = STEP[e];
        const n = ROWS[r + dr]?.[c + dc];
        if (n !== '█' && !(EXITS[n ?? ''] ?? '').includes(back)) loose.push(`${ch} at row ${r} col ${c} exits ${e} onto "${n}"`);
      }
    }));
    expect(loose).toEqual([]);
  });

  it('refuses a character it cannot draw', () => {
    expect(() => bannerSvg(['█#'], 6, 10.4)).toThrow(/#/);
  });
});
