// src/lib/words.ts
// The one word counter, for reading times. A word is a whitespace-separated token with a Latin letter or a digit
// in it, so "$2.20" counts and a dash or a lone "=" does not.

export function countWords(text: string): number {
  return text.split(/\s+/).filter((t) => /[A-Za-z0-9]/.test(t)).length;
}

/** Minutes to read `words` at `wpm` words a minute, rounded, never under one. */
export function readingMinutes(words: number, wpm = 230): number {
  return Math.max(1, Math.round(words / wpm));
}
