// src/lib/cowSpeech.ts
// SPLITTING WHAT THE COW SAYS INTO EXACTLY TWO LINES.
//
// The owner: "try to let the bubble grow horizontally instead of vertically, still two lines. as such, we dont
// trigger a vertical rerender. the current rendering has no animation and thus it abruptly pushes the content up
// and down."
//
// He is describing a bug I introduced. The bubble reserved two lines of height at one font size, but the lines
// differ hugely in length — "I hold no view on rates." is 24 characters and "Past performance is not indicative
// of future grass." is 51 — so at the small size the long one wrapped to four lines, the bubble grew, and every
// press shoved the panel's layout. Reserving MORE height would only mean a taller bubble with dead space in it.
//
// The fix is to stop letting the browser choose where to wrap. Each line is pre-split into two halves here, each
// half is rendered `white-space: nowrap`, and the bubble is sized by its content. Then:
//   - the HEIGHT is exactly two lines for every message, by construction, so nothing above or below ever moves;
//   - the WIDTH is the wider half, so a longer message grows sideways — which is what he asked for.
//
// Balanced rather than greedy: splitting at the point that most nearly halves the character count gives the
// narrowest possible bubble for two lines. A greedy fill would leave one long line and one short one, making the
// bubble as wide as a single-line layout and defeating the point.
//
// Pure and deterministic, so it runs at build time and the client ships only the finished pairs.

/** A message, pre-broken into the two lines it will render as. */
export type SpokenLine = readonly [string, string];

/**
 * Split `text` into two lines at the word boundary that most nearly halves its length.
 *
 * Never breaks a word. A single-word message returns that word plus an empty second line — the empty line still
 * occupies its row, so the bubble keeps its two-line height.
 */
export function splitTwoLines(text: string): SpokenLine {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return ['', ''];
  if (words.length === 1) return [words[0], ''];

  let bestAt = 1;
  let bestDiff = Number.POSITIVE_INFINITY;
  for (let i = 1; i < words.length; i++) {
    const head = words.slice(0, i).join(' ').length;
    const tail = words.slice(i).join(' ').length;
    const diff = Math.abs(head - tail);
    // Strictly less, so ties keep the EARLIER split — the first line is never the longer of the two, which
    // matters for a bubble whose tail hangs off the bottom.
    if (diff < bestDiff) {
      bestDiff = diff;
      bestAt = i;
    }
  }
  return [words.slice(0, bestAt).join(' '), words.slice(bestAt).join(' ')];
}

/** Every message pre-split, ready to be handed to the client as data. */
export function splitAll(lines: readonly string[]): SpokenLine[] {
  return lines.map(splitTwoLines);
}

/**
 * Characters in the wider half — the measure the bubble has to accommodate.
 *
 * Used to set the bubble's width in `ch` units, so the box is sized from the copy at build time instead of being
 * measured in the browser. A JS measurement would work too, but it would run after first paint and the bubble
 * would visibly resize on load.
 */
export function widestHalf(lines: readonly string[]): number {
  return splitAll(lines).reduce((w, [a, b]) => Math.max(w, a.length, b.length), 0);
}
