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
  '.+.+++++++++++##++++++++..',
  '++++++++++++++##++++++++..',
  'oo++++++++++++++++++++++..',
  'oo+++++++####+++++++++++..',
  '.++++++#####+++++++++++++.',
  '..+++++++++++++++++++++++.',
  '...+++++++++++++++++++++..',
  '....++++++oo++++++++++++..',
  '.....++...++.....++...++..',
  '.....++...++.....++...++..',
  '.....++...++.....++...++..',
  '.....++...++.....++...++..',
] as const;

/**
 * The matrix with a one-cell transparent border on every side.
 *
 * The outline is derived by growing one cell outward from the animal, so the animal cannot touch the edge of the
 * grid or its outline gets clipped — measured: without this the legs had no bottom edge, the ear had no top, and
 * the muzzle ran off the left. Padding here rather than in the matrix keeps the drawing above readable as a
 * drawing, with no border of dots to count.
 */
const PADDED: readonly string[] = (() => {
  const w = MATRIX[0].length;
  const blank = '.'.repeat(w + 2);
  return [blank, ...MATRIX.map((r) => `.${r}.`), blank];
})();

/** Keep only the wanted characters, blanking the rest — one matrix, one glyph per role. */
function layer(...keep: string[]): Glyph {
  const want = new Set(keep);
  return compileGlyph(
    PADDED.map((row) => row.split('').map((c) => (want.has(c) ? '#' : '.')).join('')),
  );
}

/**
 * THE OUTLINE, DERIVED — not drawn.
 *
 * The owner's reference is a classic 8-bit Holstein: white FILL inside dark INK, and that outline is most of why
 * it reads as a drawing of a cow rather than a silhouette with legs. Two hand-drawn attempts at one produced
 * diagonal wedges and a shape worse than no outline at all, so it is computed: every transparent cell
 * orthogonally adjacent to the animal becomes ink. Correct by construction, cannot drift when the silhouette is
 * edited, and trivially testable.
 *
 * Diagonal neighbours are excluded deliberately — including them thickens every corner into a blob.
 */
function derivedOutline(): Glyph {
  const filled = new Set<string>();
  PADDED.forEach((row, y) => {
    row.split('').forEach((c, x) => {
      if (c !== '.') filled.add(`${x},${y}`);
    });
  });
  const w = PADDED[0].length;
  const rows: string[] = [];
  for (let y = 0; y < PADDED.length; y++) {
    let row = '';
    for (let x = 0; x < w; x++) {
      const empty = !filled.has(`${x},${y}`);
      const touches =
        filled.has(`${x - 1},${y}`) || filled.has(`${x + 1},${y}`) ||
        filled.has(`${x},${y - 1}`) || filled.has(`${x},${y + 1}`);
      row += empty && touches ? '#' : '.';
    }
    rows.push(row);
  }
  return compileGlyph(rows);
}

/** The fill — the white of the cow: everything it occupies that is not a marking or the muzzle. */
export const COW_BODY = layer('+');

/** The markings: two body patches and the udder. Same ink as the outline, as in the reference. */
export const COW_PATCH = layer('#');

/** The muzzle, its own role so it can carry the one warm colour the palette allows. */
export const COW_MUZZLE = layer('o');

/** One cell of ink outside the animal on every side. Computed, never hand-drawn. */
export const COW_OUTLINE = derivedOutline();

/** Grid size, shared by both layers — they come from one matrix, so they cannot disagree. */
export const COW_W = PADDED[0].length;
export const COW_H = PADDED.length;

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
