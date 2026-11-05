// src/lib/words.ts
// The one word counter, for reading times, and what must not break across a line. A word is a whitespace-separated
// token with a Latin letter or a digit in it, so "$2.20" counts and a dash or a lone "=" does not.

export function countWords(text: string): number {
  return text.split(/\s+/).filter((t) => /[A-Za-z0-9]/.test(t)).length;
}

const WPM = 230;

/** Minutes to read `words` at WPM words a minute, rounded, never under one. */
export function readingMinutes(words: number): number {
  return Math.max(1, Math.round(words / WPM));
}

// What reads as one word, so a line never breaks inside it: a browser may break after any hyphen, and "RL-" at the
// end of one line and "BHRP" at the start of the next is two words to a reader. A hyphenated word led by an acronym
// (RL-BHRP, RNN-based), two capitalised words joined (Black-Litterman, Self-Attention), a span of years (2012–2019),
// an ISO date and an arXiv category (q-fin.PM). A compound in lower case (risk-parity) may break at its hyphen, as in
// any prose.
const WHOLE = /([A-Z]{2,}-[A-Za-z]+|[A-Z][a-z]+-[A-Z][a-z]+|\d{4}–\d{4}|\d{4}-\d{2}-\d{2}|[a-z]+-[a-z]+\.[A-Z]{2}\b)/;

/** `text` split so that its odd parts are what must stay whole, for a renderer to keep on one line: the paper's
 *  body (lib/paperMarkdown/rehypePaper) and every title and line of prose the research routes and the homepage
 *  write round it. */
export function wholeParts(text: string): string[] {
  return text.split(WHOLE);
}
