import { expect, it } from 'vitest';
import { labelLine, sentenceProblems, type SentencePart } from '../src/lib/artPage';

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
