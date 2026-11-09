import { describe, it, expect } from 'vitest';
import { KINDS, KIND_KEYS } from '../src/data/writing';
import { PAGES } from '../src/data/nav';

// The taxonomy and voice of /writing (data/writing.ts). The seam to the markdown is writingContent.test.ts's.

describe('the kinds as shipped', () => {
  it('each have a label and a gloss that says what belongs in it, and no two share a label', () => {
    for (const k of KIND_KEYS) {
      expect(KINDS[k].label.length, k).toBeGreaterThan(0);
      expect(KINDS[k].gloss.length, k).toBeGreaterThan(30);
    }
    expect(new Set(KIND_KEYS.map((k) => KINDS[k].label)).size).toBe(KIND_KEYS.length);
  });
});

// That /writing is built is distSmoke's route census; that the nav carries it is the test below.
describe('the route is wired up', () => {
  // The split only makes sense if the two are adjacent and in this order: the papers, then the thinking around
  // them. If someone reorders the nav, that should be a decision rather than an accident.
  it('sits directly after /research', () => {
    const i = PAGES.findIndex((p) => p.href === '/research');
    expect(PAGES[i + 1]?.href).toBe('/writing');
  });
});
