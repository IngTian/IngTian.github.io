import { describe, it, expect } from 'vitest';
import { CHARTER, KINDS, KIND_KEYS, SEARCH_FROM } from '../src/data/writing';
import { PAGES } from '../src/data/nav';

// The taxonomy and voice of /writing (data/writing.ts). The seam to the markdown is writingContent.test.ts's.

describe('the kinds as shipped', () => {
  it('are the four the owner set, each with a label and a gloss that says what belongs in it', () => {
    expect(KIND_KEYS).toEqual(['notes', 'explainers', 'methods', 'misc']);
    expect(Object.keys(KINDS).sort()).toEqual([...KIND_KEYS].sort());
    for (const k of KIND_KEYS) {
      expect(KINDS[k].label.length, k).toBeGreaterThan(0);
      expect(KINDS[k].gloss.length, k).toBeGreaterThan(30);
    }
    expect(new Set(KIND_KEYS.map((k) => KINDS[k].label)).size).toBe(KIND_KEYS.length);
  });
});

describe('the header and the controls', () => {
  // The index splits the CHARTER at its first spaced dash: the headline before it, the subtitle after.
  it('is one charter line, a headline and a subtitle', () => {
    const [headline, ...tail] = CHARTER.split(' — ');
    expect(headline.length).toBeGreaterThan(10);
    expect(tail.join(' — ').length).toBeGreaterThan(20);
  });

  it('shows the search once there are more pieces than a screen or two holds', () => {
    expect(SEARCH_FROM).toBe(12);
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
