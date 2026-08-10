// src/data/ruleGlyphs.ts
// PIXEL MARKS FOR THE FOUR KINDS OF RULE — 11x11, compiled from character matrices.
//
// The owner: "maybe you can now have some pixel arts with SEC, GOV, FED, etc. just to illustrate the ideas of
// regulations." The right half of the rules panel was empty, and four bare paragraphs is the one beat on the
// slide with nothing to look at.
//
// SAME DISCIPLINE AS data/tickerGlyphs.ts, and the same reason: a glyph IS a matrix of filled cells, so it is
// data rather than illustration. Hand-authored drawing has failed on this project three times; compiled
// matrices have not.
//
// ABSTRACT MARKS, NOT SEALS. The owner named SEC / GOV / FED as the IDEA to convey, and the idea is what these
// carry — an institution, a rulebook, a scale, a ledger. Reproducing an actual agency seal would be a
// trademark problem and a taste problem at once (the SEC's eagle is a registered mark, and a traced seal on a
// portfolio reads as costume). What a reader needs is "an authority wrote this down", which a classical
// facade and a set of scales say without borrowing anyone's identity.
//
// Each mark is paired with the rule category it belongs to, so the drawing labels the paragraph beside it
// rather than decorating it:
//   MANDATE      a document with a fold — the investment policy statement, signed by trustees
//   REGULATORY   a facade with columns — the agency, whoever it is in your jurisdiction
//   LIQUIDITY    a set of scales — the market weighing your order against the day's volume
//   OPERATIONAL  a ledger with rows — settlement, borrow, and the things that must clear

import { compileGlyph } from '../lib/pixels';

/** A signed document with a folded corner: the mandate itself, the thing a trustee puts their name to. */
export const MANDATE = compileGlyph([
  '.#######...',
  '.#.....##..',
  '.#.....#.#.',
  '.#.....####',
  '.#.###....#',
  '.#........#',
  '.#.#####..#',
  '.#........#',
  '.#.###....#',
  '.##########',
  '...........',
]);

/**
 * A classical facade: pediment over columns on a stepped base.
 *
 * Deliberately generic. Every jurisdiction has one of these buildings and none of them owns the shape, which
 * is exactly why it reads as "the regulator" without being any particular agency's seal.
 */
export const REGULATOR = compileGlyph([
  '.....#.....',
  '....###....',
  '..#######..',
  '.#########.',
  '.#.#.#.#.#.',
  '.#.#.#.#.#.',
  '.#.#.#.#.#.',
  '.#.#.#.#.#.',
  '.#########.',
  '###########',
  '...........',
]);

/** A balance: two pans on a beam. The market weighing your order against the day it has to trade in. */
export const SCALES = compileGlyph([
  '.....#.....',
  '.....#.....',
  '.#########.',
  '.#.......#.',
  '###.....###',
  '.#.......#.',
  '..#.....#..',
  '.....#.....',
  '...#####...',
  '..#######..',
  '...........',
]);

/** A ledger: bound on the left, ruled rows, the operational record that has to clear. */
export const LEDGER = compileGlyph([
  '..#######..',
  '.##.....##.',
  '.##.###..#.',
  '.##......#.',
  '.##.####.#.',
  '.##......#.',
  '.##.###..#.',
  '.##......#.',
  '.##.####.#.',
  '.#########.',
  '...........',
]);

/** Keyed by the `group` field in data/desk.ts, so the page cannot pair a mark with the wrong rule. */
export const RULE_GLYPHS = {
  Mandate: MANDATE,
  Regulatory: REGULATOR,
  Liquidity: SCALES,
  Operational: LEDGER,
} as const;

export type RuleGlyphKey = keyof typeof RULE_GLYPHS;

/** The three-letter tag drawn under each mark — the shorthand a reader will recognise. */
export const RULE_TAGS: Record<RuleGlyphKey, string> = {
  Mandate: 'IPS',
  Regulatory: 'SEC',
  Liquidity: 'ADV',
  Operational: 'OPS',
};
