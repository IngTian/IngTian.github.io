// src/lib/artPage.ts
// /art's pure half: the rules the page's one sentence keeps (5-7 phrases in seal red, each naming a different work
// that exists, 30-40% of its words red, counted by countWords), a work's label line, the three `sizes` hints and the
// constants under them, and the dark room's zoom arithmetic (zoomAbout, wheelScale, isDoubleTap). The page throws on
// any problem, so a sentence that breaks a rule fails the build by name. Pure.
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
  if (pct < RED_PCT.min || pct > RED_PCT.max) {
    problems.push(`the sentence is ${red} of ${all} words red (${pct.toFixed(1)}%), not ${RED_PCT.min}-${RED_PCT.max}%`);
  }
  return problems;
}

/** What a work's label may print. A field is given only when it is known. */
interface LabelFields { title?: string; place?: string; year?: string; script?: string; medium: string }

/** The known fields, in label order, joined by a middle dot: never a dash or a placeholder for one unknown. */
export function labelLine(f: LabelFields): string {
  return [f.title, f.place, f.year, f.script, f.medium].filter(Boolean).join(' · ');
}

// ── /art's `sizes` hints, from the CSS in pages/art.astro, as functions of a work's ratio. Each hint is a maximum,
// so it never under-declares; tests/artSizes.test.ts holds every constant to the rule it mirrors and sweeps each
// hint over the layout.
//
// THE MAT. .art-wrap is at most 1240px wide with clamp(22px, 5vw, 72px) sides, so its column peaks at 1116px at
// vw 1240 (side 62), not at the cap's far side (1096 at 1440). .opening's columns are 1fr / 1.15fr with a 64px gap,
// so the mat's column is at most (1116 - 64) * 1.15 / 2.15 = 562.7px; less 2 x 24px of padding, the image is at most
// 514.7px wide (MAT_W) and, under the mat's min(62vh, 560px), 560 - 48 = 512px tall (MAT_H).
export const MAT_H = 512;
export const MAT_W = 515;
// Stacked (900px and under) the mat is min(45vh, 380px) with 16px of padding: 380 - 32 = 348px for the image
// (MAT_H_STACKED), and at most 810 - 32 = 778px wide, the column at 900px (MAT_W_STACKED).
export const MAT_H_STACKED = 348;
export const MAT_W_STACKED = 778;
// On a phone (640px and under) the mat is min(40vh, 320px) with 16px of padding: 320 - 32 = 288px (MAT_H_PHONE),
// and at most 576 - 32 = 544px wide, the column at 640px (MAT_W_PHONE).
export const MAT_H_PHONE = 288;
export const MAT_W_PHONE = 544;
// THE ROWS. ROW_H and ROW_H_PHONE are .rows' --row-h, synced by hand: the rows script lays the rows out with
// justifyRows at that target, which closes a full row at or under it and caps the last row at it (lib/justify.ts),
// so a photograph is at most ar * --row-h wide, and at most the 1116px column less its 2 x 10px of mat (ROW_W).
export const ROW_H = 280;
export const ROW_H_PHONE = 150;
export const ROW_W = 1096;
// THE CALLIGRAPHY. A block is its work's width at the height cap, min(82vh, 820px), whose px arm is 820 (CAL_MAX_H),
// and never wider than its mat, so a work is at most 820 * ar px wide at any window height: 414 for the 1727x3422
// stele, whose 900w (142,128 B) covers the 828 device px DPR 2 asks for, where a `40vw` hint once fetched the 1200w
// (396,030 B). On a phone it is the column less the block's mat, at most 100vw less 2 x 22px of side and 2 x 16px of
// padding. That width comes from the work's ratio (--ar), as a tile's does, so the box exists before the image
// decodes: sized by the image instead, inside its shrink-to-fit button, each work was 0px wide until it arrived, both
// blocks were 2px tall at first layout, the photographs sat ~1,400px higher than at rest, and Chrome's lazy-load
// margin fetched the first seven of them with the page: 988,428 B of images transferred at 1440x900 DPR 2, against
// 399,198 B with the box reserved (the mat's photograph, the couplet's 900w and the poem's 1080w; headless Chrome 157).
export const CAL_MAX_H = 820;
// THE WIDTHS, never a native one (the stele's 1727w was a 1342 KB webp on the LCP image). The calligraphy keeps
// 1200 because a DPR-3 phone at ~346 CSS px asks for ~1038 device px of the stele. The mat reuses both, so it adds
// no variant to dist: photo-23 on the mat at arrival is the tiles' 900w (a 384px hint, 768 device px at DPR 2).
export const PHOTO_WIDTHS = [300, 600, 900];
export const CAL_WIDTHS = [480, 900, 1200];

export const matSizes = (ar: number): string =>
  `(max-width: 640px) ${Math.min(Math.ceil(ar * MAT_H_PHONE), MAT_W_PHONE)}px, `
  + `(max-width: 900px) ${Math.min(Math.ceil(ar * MAT_H_STACKED), MAT_W_STACKED)}px, ${Math.min(Math.ceil(ar * MAT_H), MAT_W)}px`;
export const rowSizes = (ar: number): string =>
  `(max-width: 640px) ${Math.ceil(ar * ROW_H_PHONE)}px, ${Math.min(Math.ceil(ar * ROW_H), ROW_W)}px`;
export const calSizes = (ar: number): string => `(max-width: 640px) calc(100vw - 76px), ${Math.ceil(ar * CAL_MAX_H)}px`;

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
