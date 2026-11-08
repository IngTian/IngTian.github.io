import { expect, it } from 'vitest';
import {
  DOUBLE_TAP, ZOOM, isDoubleTap, labelLine, sentenceProblems, wheelScale, zoomAbout, type SentencePart,
} from '../src/lib/artPage';

const works = new Set(['photo-01', 'photo-02', 'photo-03', 'photo-04', 'couplet', 'poem']);
const p = (text: string, work: string) => ({ text, work });
// 6 phrases, 11 of 32 words red (34%)
const ok: SentencePart[] = ['I keep ', p('a canoe', 'photo-01'), ' on a still lake, ', p('a tower', 'photo-02'),
  ' lit at night, ', p('a heron', 'photo-03'), ' on a stone, ', p('blossoms', 'photo-04'),
  ' in the sky, and I write ', p('a couplet', 'couplet'), ' and ', p('a poem', 'poem'), ' in ink.'];
const msg = (parts: SentencePart[]) => sentenceProblems(parts, works).join('; ');

it('accepts six phrases at a third red', () => expect(sentenceProblems(ok, works)).toEqual([]));
it('refuses fewer than five phrases', () => expect(msg([...ok.slice(0, 9), ' in ink.'])).toMatch(/\b4 phrases, not 5-7\b/));
it('refuses more than seven', () => expect(sentenceProblems([...ok, ' and ', p('a fan', 'photo-01x'), ' and ', p('a seal', 'photo-02x')],
  new Set([...works, 'photo-01x', 'photo-02x'])).join()).toMatch(/\b8 phrases, not 5-7\b/));
it('names a phrase whose work does not exist', () => expect(msg(ok.map((x) => typeof x !== 'string' && x.work === 'photo-04' ? p(x.text, 'photo-99') : x))).toMatch(/no such work: photo-99/));
it('names a work the sentence names twice', () => expect(msg(ok.map((x) => typeof x !== 'string' && x.work === 'photo-04' ? p(x.text, 'photo-03') : x))).toMatch(/names photo-03 twice/));
it('refuses too little red', () => expect(msg([...ok.slice(0, -1), ' in ink, slowly, over many quiet winter evenings.'])).toMatch(/\b29% red, not 30-40%/));
it('refuses too much red', () => expect(msg(ok.map((x) => typeof x !== 'string' && x.work === 'photo-04' ? p('blossoms of a cherry tree in spring', 'photo-04') : x))).toMatch(/\b45% red, not 30-40%/));
it('prints the known fields only, in label order', () => {
  expect(labelLine({ title: 'Heron on a rock', medium: 'Photograph' })).toBe('Heron on a rock · Photograph');
  expect(labelLine({ medium: 'Photograph' })).toBe('Photograph');
  expect(labelLine({ title: '', place: 'A', year: '2019', medium: 'Photograph' })).toBe('A · 2019 · Photograph');
  expect(labelLine({ title: 'Spring Couplet', script: 'Clerical script', medium: 'Ink on paper, set as stele' }))
    .toBe('Spring Couplet · Clerical script · Ink on paper, set as stele');
});

const z0 = { x: 10, y: 20, s: 2 };
it('keeps the point under the cursor where it was', () => {
  const b = zoomAbout(z0, 3, 40, 60);
  expect(b.s).toBe(3); expect(b.x + 3 * (40 / 2)).toBeCloseTo(10 + 40); expect(b.y + 3 * (60 / 2)).toBeCloseTo(20 + 60);
});
it('stops at 6x, still about the point', () => {
  const b = zoomAbout(z0, 10, 40, 60);
  expect(b.s).toBe(ZOOM.max); expect(b.x + 6 * (40 / 2)).toBeCloseTo(50);
});
it('returns to the fitted work at 1x and under', () => {
  expect(zoomAbout(z0, 1, 40, 60)).toEqual({ x: 0, y: 0, s: 1 });
  expect(zoomAbout(z0, 0.5, 40, 60)).toEqual({ x: 0, y: 0, s: 1 });
});
it('knows a double-tap by time and distance', () => {
  const a = { t: 1000, x: 100, y: 100 };
  expect(isDoubleTap(null, a)).toBe(false);
  expect(isDoubleTap(a, { t: 1000 + DOUBLE_TAP.ms, x: 110, y: 100 })).toBe(true);
  expect(isDoubleTap(a, { t: 1001 + DOUBLE_TAP.ms, x: 100, y: 100 })).toBe(false);
  expect(isDoubleTap(a, { t: 1100, x: 100 + DOUBLE_TAP.px + 1, y: 100 })).toBe(false);
});
const times = (n: number, f: number) => f ** n;
it('zooms the wheel by distance, so a trackpad adds up slowly and a mouse notch is a step', () => {
  expect(wheelScale(-100, 0)).toBeCloseTo(Math.exp(100 * ZOOM.perPx));
  expect(wheelScale(-3, 1)).toBeCloseTo(wheelScale(-48, 0));
  expect(wheelScale(-1, 2)).toBeCloseTo(wheelScale(-800, 0));
  expect(wheelScale(120, 0) * wheelScale(-120, 0)).toBeCloseTo(1);
  const pad = times(40, wheelScale(-4, 0));        // a light two-finger scroll on a Mac trackpad
  expect(pad).toBeGreaterThan(1.2); expect(pad).toBeLessThan(2);
  expect(times(30, wheelScale(-100, 0))).toBeGreaterThan(ZOOM.max); // 30 mouse notches reach the cap
});
