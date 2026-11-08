// src/lib/artPage.ts
// /art's pure half: the rules the page's one sentence keeps (5-7 phrases in seal red, each naming a different work
// that exists, 30-40% of its words red, counted by countWords), a work's label line, and the dark room's zoom
// arithmetic (zoomAbout, wheelScale, isDoubleTap). The page throws on any problem, so a sentence that breaks a rule
// fails the build by name. Pure.
import { countWords } from './words';

/** A phrase of the sentence, set in red: the words, and the key of the work they bring onto the mat. */
export interface Phrase { text: string; work: string }
/** The sentence, in order: plain text in ink, and phrases. */
export type SentencePart = string | Phrase;

const RED_PCT = { min: 30, max: 40 } as const;
const PHRASES = { min: 5, max: 7 } as const;

export function phrasesOf(parts: readonly SentencePart[]): Phrase[] {
  return parts.filter((x): x is Phrase => typeof x !== 'string');
}

/** Every rule the sentence breaks, each named; [] when it keeps them all. */
export function sentenceProblems(parts: readonly SentencePart[], works: ReadonlySet<string>): string[] {
  const phrases = phrasesOf(parts);
  const problems: string[] = [];
  if (phrases.length < PHRASES.min || phrases.length > PHRASES.max)
    problems.push(`the sentence has ${phrases.length} phrases, not ${PHRASES.min}-${PHRASES.max}`);
  const named = new Map<string, number>();
  for (const { work } of phrases) named.set(work, (named.get(work) ?? 0) + 1);
  for (const [work, n] of named) {
    if (!works.has(work)) problems.push(`no such work: ${work}`);
    if (n > 1) problems.push(`the sentence names ${work} ${n === 2 ? 'twice' : `${n} times`}`);
  }
  // The share is printed with its counts, to a tenth, so a share just outside the band never prints inside it.
  const all = countWords(parts.map((x) => (typeof x === 'string' ? x : x.text)).join(''));
  const red = countWords(phrases.map((x) => x.text).join(' '));
  const pct = all ? (100 * red) / all : 0;
  if (pct < RED_PCT.min || pct > RED_PCT.max)
    problems.push(`the sentence is ${red} of ${all} words red (${pct.toFixed(1)}%), not ${RED_PCT.min}-${RED_PCT.max}%`);
  return problems;
}

/** What a work's label may print. A field is given only when it is known. */
export interface LabelFields { title?: string; place?: string; year?: string; script?: string; medium: string }

/** The known fields, in label order, joined by a middle dot: never a dash or a placeholder for one unknown. */
export function labelLine(f: LabelFields): string {
  return [f.title, f.place, f.year, f.script, f.medium].filter(Boolean).join(' · ');
}

/** The dark room's zoom: translate(x, y) scale(s), transform-origin 0 0. */
export interface Zoom { x: number; y: number; s: number }
export const ZOOM = { max: 6, toggle: 3, key: 1.25, perPx: 0.002, linePx: 16, pagePx: 800 } as const;

/** Scale to `s`, clamped to [1, ZOOM.max], keeping fixed the screen point (px, py) — given relative to the image's
 *  current (transformed) top-left, i.e. clientX − rect.left. At 1 it returns the fitted work, {0, 0, 1}. */
export function zoomAbout(z: Zoom, s: number, px: number, py: number): Zoom {
  const n = Math.min(ZOOM.max, s);
  if (n <= 1) return { x: 0, y: 0, s: 1 };
  const k = n / z.s;
  return { x: z.x - (k - 1) * px, y: z.y - (k - 1) * py, s: n };
}

/** The factor one wheel event zooms by: exp(−deltaY in px · ZOOM.perPx), deltaMode 1 (lines) and 2 (pages)
 *  normalised by linePx and pagePx. By distance, not per event: a trackpad sends dozens of small deltas. */
export function wheelScale(deltaY: number, deltaMode: number): number {
  const px = deltaY * (deltaMode === 1 ? ZOOM.linePx : deltaMode === 2 ? ZOOM.pagePx : 1);
  return Math.exp(-px * ZOOM.perPx);
}

/** A tap: when (ms) and where (client px). */
export interface Tap { t: number; x: number; y: number }
export const DOUBLE_TAP = { ms: 300, px: 24 } as const;

/** `b` is the second tap of a double-tap after `a`: within DOUBLE_TAP.ms and DOUBLE_TAP.px of it. */
export function isDoubleTap(a: Tap | null, b: Tap): boolean {
  return !!a && b.t - a.t <= DOUBLE_TAP.ms && Math.hypot(b.x - a.x, b.y - a.y) <= DOUBLE_TAP.px;
}
