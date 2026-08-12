// src/data/cowGlyph.ts
// THE COW — transcribed from the grid the owner supplied, after five failed attempts of my own.
//
// WHAT WENT WRONG, FIVE TIMES, and the lesson: I was hand-drawing silhouettes in a text file and judging them in
// a terminal. The owner's verdicts, in order — "looks like a dragon", then a robot, then "doesn't read like a
// cow", then "horribly wrong ... they are monsters not cows". Two errors underneath all of it:
//
//   1. THE POSE. I drew a full profile (one eye, muzzle pointing sideways). The reference is a CHIBI
//      FRONT-FACING cow: it looks straight at you, and the muzzle is a large block in the middle of the face.
//      That silhouette is most of what makes it read as a cow rather than as some quadruped.
//   2. THE PALETTE. I had two tones. The reference needs four — black markings, white body, PINK muzzle, and
//      TAN horns — and the horns and muzzle are exactly the features that say "cow" rather than "dog".
//
// So this is a transcription, not a design. Structure, proportion and colour roles all come from the grid the
// owner sent: horns at the top corners, black patches over the ears and around the eyes, a wide pink muzzle with
// two nostrils, a white body with a black patch each side, a tail with a dark tuft, and hooves.
//
// The art is still DATA, like every other pixel mark here, so it stays inspectable and testable.

import { compileGlyph, type Glyph } from '../lib/pixels';

/**
 * The cow, facing the viewer.
 *
 * `#` black markings · `+` white body · `o` pink muzzle · `t` tan horn · `.` transparent.
 */
const MATRIX = [
  '....t..........t....',
  '...tt..........tt...',
  '...tt...++++...tt...',
  '..#tt..++++++..tt#..',
  '..##t.++++++++.t##..',
  '.####+++++++++++###.',
  '.####+++++++++++###.',
  '..##+++++++++++++##.',
  '..+++##+++++##+++++.',
  '..+++##+++++##+++++.',
  '..++oooooooooooo++..',
  '..+oooooooooooooo+..',
  '..+oo##oooo##ooooo..',
  '..+oooooooooooooo+..',
  '..++oooooooooooo++..',
  '...++++++++++++++...',
  '....++++++++++++....',
  '...+####++++####+..#',
  '...+####++++####+.##',
  '...++++++++++++++.#.',
  '...++++++++++++++...',
  '...##++##..##++##...',
  '...##++##..##++##...',
  '...######..######...',
] as const;

/**
 * One transparent cell of margin on every side, so the derived outline has somewhere to live.
 * Without it the horns lose their tops and the hooves their bottoms.
 */
const PADDED: readonly string[] = (() => {
  const blank = '.'.repeat(MATRIX[0].length + 2);
  return [blank, ...MATRIX.map((r) => `.${r}.`), blank];
})();

/** Keep only the wanted characters, blanking the rest — one matrix, one glyph per colour role. */
function layer(...keep: string[]): Glyph {
  const want = new Set(keep);
  return compileGlyph(
    PADDED.map((row) => row.split('').map((c) => (want.has(c) ? '#' : '.')).join('')),
  );
}

/**
 * THE OUTLINE, DERIVED — every transparent cell orthogonally touching the cow becomes ink.
 *
 * Computed rather than drawn because two hand-drawn attempts produced diagonal wedges and a shape worse than no
 * outline at all. Correct by construction, cannot drift when the matrix is edited, and testable. Diagonals are
 * excluded deliberately: including them thickens every corner into a blob.
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

/**
 * The white of the cow — and the muzzle cells too.
 *
 * The muzzle is painted ON TOP of this at partial opacity, so it needs white underneath or the seal red mixes
 * with the page instead of with paper and comes out brick rather than pink. Measured on the 404: without this the
 * nose read as dark red.
 */
export const COW_BODY = layer('+', 'o');

/** The black markings: head patches, eyes, nostrils, body patches, tail tuft, hooves. */
export const COW_PATCH = layer('#');

/** The muzzle — the large pink block in the middle of the face, and the single strongest cow signal. */
export const COW_MUZZLE = layer('o');

/** The horns. Their own role so they can take a warm tan rather than the muzzle's pink. */
export const COW_HORN = layer('t');

/** One cell of ink outside the animal on every side. Computed, never hand-drawn. */
export const COW_OUTLINE = derivedOutline();

/**
 * "MOO!" as pixel type — the bubble's headline.
 *
 * The owner asked for the cow's words in a dialogue bubble, in a "more pixel like" font, "way bigger", and
 * picked 10px cells from the two sizes I showed. At 10px this word is 190x50 on screen against the 11.5px mono
 * line it replaces, which is the "way bigger" he asked for.
 *
 * Drawn rather than set in a font because the site ships no pixel typeface and adding one for a single word
 * would be a font download for four glyphs. Five-cell letters with one cell of tracking; the '!' keeps its gap
 * above the point, which the first pass lost — it drew as a solid bar.
 */
export const COW_MOO = compileGlyph([
  '#...#..###...###..#',
  '##.##.#...#.#...#.#',
  '#.#.#.#...#.#...#.#',
  '#...#.#...#.#...#..',
  '#...#..###...###..#',
]);

/**
 * THE BUBBLE'S TAIL — two layers, because one colour cannot work on both grounds.
 *
 * A first pass drew it as six solid ink cells via box-shadow and it was INVISIBLE on the homepage: the footer
 * is the near-black end of the descent, and ink on near-black is nothing. Paper alone fails the opposite way,
 * on the light /404 and /writing grounds. So the tail is built like the cow itself — a paper interior inside an
 * ink edge — which reads against anything.
 *
 * The top row is all paper and is painted OVER the bubble's one-cell bottom border, which is what opens the
 * mouth. Without that overlap the tail reads as a detached blob sitting below a closed box.
 *
 * `+` paper · `#` ink · `.` transparent. Tapers down and to the right, where the cow is.
 */
const TAIL: readonly string[] = [
  '++++',
  '#++#',
  '.#+#',
  '..##',
];

/** The tail's paper interior, including the row that opens the bubble's border. */
export const COW_TAIL_FILL = compileGlyph(TAIL.map((r) => r.replace(/[#]/g, '.')), '.');
/** The tail's ink edge — the stepped hypotenuse on the left, and the straight edge on the right. */
export const COW_TAIL_INK = compileGlyph(TAIL.map((r) => r.replace(/\+/g, '.')), '.');
/** Tail grid, in cells. Shared by both layers, so they cannot disagree. */
export const COW_TAIL_W = TAIL[0].length;
export const COW_TAIL_H = TAIL.length;

/** Grid size, shared by every layer — they come from one matrix, so they cannot disagree. */
export const COW_W = PADDED[0].length;
export const COW_H = PADDED.length;

/**
 * What the cow says on the homepage, in order, one line per press.
 *
 * Dry and short: the site's register does not survive whimsy, and an easter egg is not licence to break it.
 * The last line is a callback to the method slide, the one place the site admits to not knowing something —
 * the cow gets to agree with it.
 *
 * NO BARE "Moo." IN ANY SET ANY MORE. The bubble now says MOO! in pixel type above whichever line is showing,
 * so a line that was only "Moo." rendered as the word twice, once large and once small. Each set still moos
 * somewhere — it is a cow — but inside a sentence that earns its place.
 */
export const COW_LINES: readonly string[] = [
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
  'A moo into an empty field.',
];

/** What it says on /writing, which has nothing on it yet and says so. */
export const COW_LINES_WRITING: readonly string[] = [
  'Nothing written yet. I am holding the space.',
  'Writing is slower than backtesting.',
  'Ask me again after the thesis.',
  'A moo is shorter than an essay.',
];
