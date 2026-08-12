// src/data/tickerGlyphs.ts
// PIXEL MARKS FOR THE CONCRETE INSTRUMENTS — 11x11, compiled from character matrices.
//
// Same discipline as data/assetGlyphs.ts: a glyph IS a matrix of filled cells, so it is data, and turning
// data into geometry is the thing this codebase does well. Nothing traced, nothing freehand — three
// attempts at hand-authored illustration were rejected on this project, and a drawn Apple logo would be a
// fourth (and a trademark problem besides).
//
// The marks are abstract categories, not company logos: a chip, a screen, a bank column, a bar of metal, a
// barrel. AAPL and META share the "screen" mark because they are the same KIND of thing for this example's
// purpose, which is honest about what the diagram is showing.

import { compileGlyph } from '../lib/pixels';

/** A screen — consumer technology. */
export const TECH = compileGlyph([
  '...........',
  '.#########.',
  '.#.......#.',
  '.#.......#.',
  '.#.......#.',
  '.#.......#.',
  '.#########.',
  '.....#.....',
  '...#####...',
  '...........',
  '...........',
]);

/** A chip: a die with pins on all four sides. */
export const CHIP = compileGlyph([
  '..#..#..#..',
  '..#..#..#..',
  '.#########.',
  '##.......##',
  '.#.#####.#.',
  '.#.#####.#.',
  '.#.#####.#.',
  '##.......##',
  '.#########.',
  '..#..#..#..',
  '..#..#..#..',
]);

/** A bank: pediment over columns. */
export const BANK = compileGlyph([
  '.....#.....',
  '...#####...',
  '.#########.',
  '###########',
  '.#.#.#.#.#.',
  '.#.#.#.#.#.',
  '.#.#.#.#.#.',
  '.#.#.#.#.#.',
  '.#.#.#.#.#.',
  '###########',
  '...........',
]);

/** A bar of metal, drawn in trapezoid profile. */
export const GOLD = compileGlyph([
  '...........',
  '...........',
  '...#####...',
  '..#######..',
  '.#########.',
  '###########',
  '###########',
  '###########',
  '.#########.',
  '...........',
  '...........',
]);

/** A barrel: staves and hoops. */
export const OIL = compileGlyph([
  '...........',
  '..#######..',
  '.#.#.#.#.#.',
  '###########',
  '.#.#.#.#.#.',
  '.#.#.#.#.#.',
  '###########',
  '.#.#.#.#.#.',
  '.#.#.#.#.#.',
  '..#######..',
  '...........',
]);

export const TICKER_GLYPHS = {
  tech: TECH,
  chip: CHIP,
  bank: BANK,
  gold: GOLD,
  oil: OIL,
} as const;

export type TickerGlyphKey = keyof typeof TICKER_GLYPHS;
