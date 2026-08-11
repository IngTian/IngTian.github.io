// src/data/cowGlyph.ts
// THE PLUSH COW — the site's one joke, in pixels.
//
// The owner: "for the work, for the writing. let's leave an easter egg there. have a pixel art plush cow says
// something."
//
// The cow is already a motif here: the terrain hero's rare Easter-egg pill can read "Moo!" instead of the KKT
// condition, and the original quant-pod brief put a plush cow on the desk. This gives it a body.
//
// Same discipline as the other glyphs in this folder (tickerGlyphs, ruleGlyphs): a matrix of characters compiled
// to cells, so it is data and every pixel is inspectable in a test. Hand-drawn illustration has failed on this
// project repeatedly; a compiled matrix has not.
//
// It is a FACE rather than a whole animal on purpose — at this size a full cow reads as a grey smudge, while a
// face with horns, eyes and a snout is legible at 2px per cell.

import { compileGlyph } from '../lib/pixels';

/**
 * A plush cow's face, 15x13.
 *
 * `#` is the plush body, `.` is a hole — the eyes, nostrils and the gap between the horns are all holes, so the
 * page background shows through and the mark works on either theme without a second colour.
 */
export const COW = compileGlyph([
  '..##.......##..',
  '.####.....####.',
  '..###########..',
  '.#############.',
  '###############',
  '####.#####.####',
  '###############',
  '##..###########',
  '.#..##########.',
  '..###########..',
  '...#########...',
  '...##.###.##...',
  '....#######....',
]);

/**
 * What the cow says, in order, one line per click.
 *
 * Dry, short, and each one a real joke rather than a cute noise — the site's register does not survive whimsy.
 * The last one is a callback to the method slide, which is the only place the site admits to not knowing
 * something; the cow gets to agree with it.
 */
export const COW_LINES: readonly string[] = [
  'Moo.',
  'I am not a source of alpha.',
  'Past performance is not indicative of future grass.',
  'I hold no view on rates.',
  'Still an open problem. Moo.',
];
