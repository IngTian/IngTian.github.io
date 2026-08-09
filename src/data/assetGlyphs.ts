// src/data/assetGlyphs.ts
// THE ASSET GLYPHS — 11x11 pixel marks, one per asset class.
//
// The owner asked for "pixel art images" beside each asset. These are authored as character matrices and
// compiled by lib/pixels.ts, which keeps them DATA rather than illustration — the distinction that matters
// here, because freehand drawing has failed on this project three times.
//
// Each mark is a diagram of what the asset IS, not a picture of an object:
//   equities    — a rising bar series (the thing that grows, unevenly)
//   bonds       — a coupon ladder (fixed, regular, flat)
//   commodities — a barrel/stack profile (physical, lumpy)
//   cash        — a flat line with a tick (no growth, always there)
// Abstract on purpose: a tiny drawn oil barrel would be exactly the kind of prop that got rejected before.

import { compileGlyph } from '../lib/pixels';

/** Rising bars of unequal height — growth, and the variance that comes with it. */
export const EQUITIES = compileGlyph([
  '...........',
  '.........#.',
  '.........#.',
  '.......#.#.',
  '.......#.#.',
  '.#.....#.#.',
  '.#...#.#.#.',
  '.#.#.#.#.#.',
  '.#.#.#.#.#.',
  '.#.#.#.#.#.',
  '...........',
]);

/** A coupon ladder: even rungs, level top — regular income, no growth. */
export const BONDS = compileGlyph([
  '...........',
  '.#########.',
  '.#.......#.',
  '.#########.',
  '.#.......#.',
  '.#########.',
  '.#.......#.',
  '.#########.',
  '.#.......#.',
  '.#########.',
  '...........',
]);

/** A stacked physical pile — lumpy, tangible, uneven. */
export const COMMODITIES = compileGlyph([
  '...........',
  '....###....',
  '...#####...',
  '...#####...',
  '..#######..',
  '..#######..',
  '.#########.',
  '.#########.',
  '..#######..',
  '...#####...',
  '...........',
]);

/** A flat line with a single tick — no growth, always available. */
export const CASH = compileGlyph([
  '...........',
  '...........',
  '...........',
  '...........',
  '.....#.....',
  '.#########.',
  '.....#.....',
  '...........',
  '...........',
  '...........',
  '...........',
]);

/** Keyed for lookup from the asset data. */
export const ASSET_GLYPHS = {
  equities: EQUITIES,
  bonds: BONDS,
  commodities: COMMODITIES,
  cash: CASH,
} as const;

export type AssetGlyphKey = keyof typeof ASSET_GLYPHS;
