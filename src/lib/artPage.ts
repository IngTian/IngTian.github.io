// src/lib/artPage.ts
// /art's pure half: the rules the page's one sentence keeps (5-7 phrases in seal red, each naming a different work
// that exists, 30-40% of its words red, counted by countWords), and a work's label line. The page throws on any
// problem, so a sentence that breaks a rule fails the build by name. Pure.
import { countWords } from './words';

/** A phrase of the sentence, set in red: the words, and the key of the work they bring onto the mat. */
export interface Phrase<K extends string = string> { text: string; work: K }
/** The sentence, in order: plain text in ink, and phrases. */
export type SentencePart<K extends string = string> = string | Phrase<K>;

export const RED_SHARE = { min: 0.3, max: 0.4 } as const;
export const PHRASES = { min: 5, max: 7 } as const;

export function phrasesOf<K extends string>(parts: readonly SentencePart<K>[]): Phrase<K>[] {
  return parts.filter((x): x is Phrase<K> => typeof x !== 'string');
}

/** Every rule the sentence breaks, each named; [] when it keeps them all. */
export function sentenceProblems(parts: readonly SentencePart[], works: ReadonlySet<string>): string[] {
  const phrases = phrasesOf(parts);
  const problems: string[] = [];
  if (phrases.length < PHRASES.min || phrases.length > PHRASES.max)
    problems.push(`the sentence has ${phrases.length} phrases, not ${PHRASES.min}-${PHRASES.max}`);
  const named = new Map<string, number>();
  for (const { work } of phrases) {
    if (!works.has(work)) problems.push(`no such work: ${work}`);
    named.set(work, (named.get(work) ?? 0) + 1);
  }
  for (const [work, n] of named) if (n > 1) problems.push(`the sentence names ${work} ${n === 2 ? 'twice' : `${n} times`}`);
  const all = countWords(parts.map((x) => (typeof x === 'string' ? x : x.text)).join(''));
  const share = all ? countWords(phrases.map((x) => x.text).join(' ')) / all : 0;
  if (share < RED_SHARE.min || share > RED_SHARE.max)
    problems.push(`the sentence is ${Math.round(share * 100)}% red, not ${Math.round(RED_SHARE.min * 100)}-${Math.round(RED_SHARE.max * 100)}%`);
  return problems;
}

/** What a work's label may print. A field is given only when it is known. */
export interface LabelFields { title?: string; place?: string; year?: string; script?: string; medium: string }

/** The known fields, in label order, joined by a middle dot: never a dash or a placeholder for one unknown. */
export function labelLine(f: LabelFields): string {
  return [f.title, f.place, f.year, f.script, f.medium].filter(Boolean).join(' · ');
}
