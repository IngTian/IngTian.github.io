// src/data/cowGlyph.ts
// THE COW — the site's one joke, in pixels, and the owner loves cows so it had better look like one.
//
// THREE FAILURES ON THE WAY HERE, all worth recording so nobody re-treads them.
//
//   TAKE ONE — a single-tone front-facing head. The owner: "your pixel art cow doesn't quite look like a cow
//   btw. looks like a dragon." Right: the two pointed shapes on top read as horns or wings, the outline tapered
//   to a snout, and one flat tone cannot carry patches, which are the strongest "this is a cow" signal.
//
//   TAKE TWO — same view, with sideways ears, a patch and an outlined muzzle. It stopped looking like a dragon
//   and started looking like a ROBOT, because every feature was a rectangle: the muzzle outline became a grille,
//   the ears became bolts, the patch became a bar.
//
//   TAKE THREE — the SIDE silhouette, which is the one people recognise instantly: a long body on four legs, the
//   head carried low at the shoulder, a tail. That read as an animal at last, but the TONES came out inverted.
//   The site's ink is currentColor, which is LIGHT on the dark pages — so the layer meant to be "dark markings"
//   rendered brightest and the patches read as lit windows on a dark hull. The robot again, in miniature.
//
// SO THE TONES ARE NAMED BY ROLE, NOT BY DARKNESS. COW_BODY is the animal — silhouette, legs, ear, tail, muzzle
// — and is drawn at full ink. COW_PATCH is only the markings, drawn at reduced opacity so they RECEDE into the
// body. That works out correctly in both themes without a second colour, which the palette rules would not
// allow: on the dark pages a bright cow with dimmer patches, on light a dark cow with softer patches. The eye is
// a HOLE in the silhouette, so the page shows through it.
//
// Same discipline as every other pixel mark here (tickerGlyphs, ruleGlyphs): the art IS data, so it is
// inspectable and every claim about it is testable. Hand-drawn illustration has failed on this project
// repeatedly; compiled matrices have not.

import { compileGlyph, type Glyph } from '../lib/pixels';

/**
 * The cow, in profile, facing left.
 *
 * `+` the animal itself · `#` a patch · `.` transparent (including the eye, which is a hole).
 * The patches are deliberately different sizes and off-centre: real cows are irregular, and matched patches
 * read as a manufactured pattern rather than as an animal.
 */
const MATRIX = [
  '..++......................',
  '..++++....................',
  '..+++++.....++++++++++.+..',
  '.+++++++..++++++++++++++..',
  '.+.+++++++++++###+++++++..',
  '++++++++++++++###+++++++..',
  '++++++++++++++++++++++++..',
  '+++++++++####+++++++++++..',
  '.++++++#####+++++++++++++.',
  '..+++++++++++++++++++++++.',
  '...+++++++++++++++++++++..',
  '....++++++##++++++++++++..',
  '.....++...++.....++...++..',
  '.....++...++.....++...++..',
  '.....++...++.....++...++..',
  '.....++...++.....++...++..',
] as const;

/** Keep only `keep`, blanking everything else — one matrix, one glyph per role. */
function layer(keep: '+' | '#'): Glyph {
  return compileGlyph(
    MATRIX.map((row) => row.split('').map((c) => (c === keep ? '#' : '.')).join('')),
  );
}

/** The animal: silhouette, legs, ear, tail, head. Drawn at full ink. */
export const COW_BODY = layer('+');

/** The markings only. Drawn at reduced opacity so they recede into the body rather than sitting on it. */
export const COW_PATCH = layer('#');

/** Grid size, shared by both layers — they come from one matrix, so they cannot disagree. */
export const COW_W = MATRIX[0].length;
export const COW_H = MATRIX.length;

/**
 * What the cow says on the homepage, in order, one line per press.
 *
 * Dry and short: the site's register does not survive whimsy, and an easter egg is not licence to break it.
 * The last line is a callback to the method slide, the one place the site admits to not knowing something —
 * the cow gets to agree with it.
 */
export const COW_LINES: readonly string[] = [
  'Moo.',
  'I am not a source of alpha.',
  'Past performance is not indicative of future grass.',
  'I hold no view on rates.',
  'Still an open problem. Moo.',
];

/** What it says on the 404, where it is the only thing keeping a lost reader company. */
export const COW_LINES_404: readonly string[] = [
  'This page does not exist. I checked twice.',
  'Nothing here. Not even grass.',
  'You could try the descent instead.',
  'Moo.',
];

/** What it says on /writing, which has nothing on it yet and says so. */
export const COW_LINES_WRITING: readonly string[] = [
  'Nothing written yet. I am holding the space.',
  'Writing is slower than backtesting.',
  'Ask me again after the thesis.',
  'Moo.',
];
