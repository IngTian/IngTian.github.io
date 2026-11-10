// src/lib/writingSearch.ts
// The /writing search's pure half: how text is folded for matching, and whether a card shows. The page's script is
// the plumbing (pages/writing.astro); a card's folded text, its data-q, is built once with the pieces
// (data/writing.ts), by the same fold the script applies to the query.

/** Lower case, accents dropped and curly quotes made straight, so "isn't" finds "isn’t" and "teiletche" finds
 *  "Teïletche". */
export function fold(s: string): string {
  return s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[‘’]/g, "'").replace(/[“”]/g, '"');
}

/** Whether a card shows: of the chosen kind (any, for 'all'), and holding every word of the query as a substring
 *  of its folded text `q`, so "risk par" finds "Risk parity". An empty query holds every card. */
export function shows(q: string, kind: string, query: string, chosen: string): boolean {
  return (chosen === 'all' || kind === chosen) && fold(query).split(/\s+/).filter(Boolean).every((t) => q.includes(t));
}
