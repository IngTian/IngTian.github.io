// src/lib/words.ts
// The one word counter, for reading times, and where a title's hyphenated words are. A word is a
// whitespace-separated token with a Latin letter or a digit in it, so "$2.20" counts and a dash or a lone "=" does not.

export function countWords(text: string): number {
  return text.split(/\s+/).filter((t) => /[A-Za-z0-9]/.test(t)).length;
}

const WPM = 230;

/** Minutes to read `words` at WPM words a minute, rounded, never under one. */
export function readingMinutes(words: number): number {
  return Math.max(1, Math.round(words / WPM));
}

/** `text` split so that its odd parts are its hyphenated words ("RNN-based", "(RL-BHRP)"), for a renderer to keep
 *  whole: a browser may break a line after any hyphen, and a title then splits a paper's own name in two. */
export function hyphenatedParts(text: string): string[] {
  return text.split(/(\S*-\S*)/);
}
