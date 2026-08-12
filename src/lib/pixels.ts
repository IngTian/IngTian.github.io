// src/lib/pixels.ts
// PIXEL ART FROM DATA, not from drawing.
//
// The owner asked for "a handful of assets, each with pixel art images". The project notes are blunt that
// hand-authored illustration has failed three times here — but pixel art is not freehand illustration: a
// glyph IS a matrix of filled cells, so it is data, and turning data into geometry is the one thing this
// codebase has repeatedly done well. Each glyph below is authored as rows of characters and compiled to
// rectangles; nothing is traced, and every cell is inspectable in a test.
//
// Pure: no DOM, no SVG strings. The caller decides how to render the cells.

/** A filled cell in glyph space. */
export interface Cell {
  x: number;
  y: number;
}

export interface Glyph {
  /** Grid width in cells. */
  w: number;
  /** Grid height in cells. */
  h: number;
  cells: Cell[];
}

/**
 * Compile a character-matrix glyph into filled cells.
 *
 * Any character other than the `empty` marker counts as filled, so a glyph can be authored with '#' for
 * clarity and read back exactly. Throws on a ragged matrix rather than silently clipping: a glyph whose
 * rows disagree would render as a subtly wrong shape, which is much harder to notice than a build error.
 */
export function compileGlyph(rows: readonly string[], empty = '.'): Glyph {
  if (!rows.length) return { w: 0, h: 0, cells: [] };
  const w = rows[0].length;
  for (const [i, r] of rows.entries()) {
    if (r.length !== w) {
      throw new Error(`compileGlyph: row ${i} has length ${r.length}, expected ${w}`);
    }
  }
  const cells: Cell[] = [];
  for (let y = 0; y < rows.length; y++) {
    for (let x = 0; x < w; x++) {
      if (rows[y][x] !== empty) cells.push({ x, y });
    }
  }
  return { w, h: rows.length, cells };
}

/** Ink coverage, 0..1 — a cheap guard against a glyph that is nearly empty (reads as noise) or nearly
 *  solid (reads as a block). Used in tests rather than at runtime. */
export function coverage(g: Glyph): number {
  const total = g.w * g.h;
  return total > 0 ? g.cells.length / total : 0;
}

/** Is every filled cell inside the declared grid? A glyph that overflows would paint outside its box. */
export function inBounds(g: Glyph): boolean {
  return g.cells.every((c) => c.x >= 0 && c.y >= 0 && c.x < g.w && c.y < g.h);
}
