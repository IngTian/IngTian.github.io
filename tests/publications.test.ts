// tests/publications.test.ts
// The publication records: what every surface that lists a paper reads (the /research cards, the homepage
// appendix, the factor model's signal ids), so their shape and their honesty are pinned here once.
import { describe, it, expect } from 'vitest';
import { publications } from '../src/data/profile';

describe('publications', () => {
  it('keys every record by a unique, URL-safe slug', () => {
    const slugs = publications.map((p) => p.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const s of slugs) expect(s).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
  });

  it('lists them newest first', () => {
    const keys = publications.map((p) => p.submitted ?? p.year);
    expect(keys).toEqual([...keys].sort().reverse());
  });

  // A preprint is never "published" or "peer-reviewed" (CLAUDE.md, Identity & voice).
  it('claims publication or review for nothing', () => {
    for (const p of publications) {
      expect(`${p.title} ${p.finding}`, p.slug).not.toMatch(/published|peer/i);
    }
  });

  it('gives every arXiv record its PDF', () => {
    for (const p of publications.filter((x) => x.arxivId)) expect(p.pdfHref, p.slug).toBeTruthy();
  });

  // Copied from paper-pdf.txt, lines 1-3 joined. The paper sets the break as " - "; the record sets it as an em dash.
  it('spells the RL-BHRP title as the paper does', () => {
    const rl = publications.find((p) => p.slug === 'rl-bhrp')!;
    expect(rl.title.replace(' — ', ' - ')).toBe(
      'Optimal Portfolio Construction - A Reinforcement Learning Embedded Bayesian Hierarchical Risk Parity (RL-BHRP) Approach',
    );
  });

  // The old /research page's fields: retired, not left unrendered.
  it('carries none of the retired fields', () => {
    const retired = ['takeaway', 'results', 'metrics', 'featured', 'mathKey', 'shortTitle', 'idea'];
    for (const p of publications) expect(Object.keys(p).filter((k) => retired.includes(k)), p.slug).toEqual([]);
  });
});
