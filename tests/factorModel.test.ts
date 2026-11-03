// tests/factorModel.test.ts
// The betas are CLAIMS ABOUT A REAL PERSON'S RECORD, rendered on a page a quant researcher
// will read. So these tests are not shape checks — they are honesty guards. Every number the
// object displays must be derivable from profile.ts by the arithmetic in factorModel.ts, and
// a violation should be a red test rather than something spotted on screen.

import { describe, it, expect } from 'vitest';
import { FACTORS, identifiedSignals, loadings } from '../src/lib/factorModel';
import { timeline, publications, projects, awards, researchInterests } from '../src/data/profile';

describe('identifiedSignals — declared membership, drawn from real data', () => {
  // RE-POINTED, NOT DELETED. These assertions were written against a `signals()` that has been removed
  // with the rest of the fan — but what they actually guard is live: that the model sees every artefact
  // in profile.ts, that none lands on an undeclared factor, and that the two empty factors stay empty.
  // `identifiedSignals()` is the list production uses (loadings() calls it), and it carries the same
  // three fields, so the invariants transfer wholesale. CLAUDE.md's rule for a spec whose subject moved
  // is "point it at a function production actually calls" rather than delete it.
  //   The one assertion NOT carried over checked `weight > 0` on a field declared `weight: 1`. That is a
  // tautology the type already proved, and it is the shape this repo keeps sweeping out.
  const sig = identifiedSignals();

  it('includes every timeline entry, publication, project, award and interest', () => {
    const expected =
      timeline.length + publications.length + researchInterests.length +
      projects.length + awards.length;
    expect(sig.length).toBe(expected);
  });

  it('assigns every signal to a declared factor', () => {
    const keys = new Set(FACTORS.map((f) => f.key));
    for (const s of sig) expect(keys.has(s.factor), `${s.label} -> ${s.factor}`).toBe(true);
  });

  it('gives every signal a stable, unique id', () => {
    // The id is what matches a committed LLM score to a live item, so a duplicate would silently give
    // two artefacts one score. Worth asserting now that this list is the model's only membership source.
    const ids = sig.map((s) => s.id);
    expect(new Set(ids).size, 'duplicate signal id').toBe(ids.length);
    // Indexes for most collections, slugs for projects (so a new project cannot reshuffle the scores).
    for (const id of ids) expect(id).toMatch(/^[a-z]+:[a-z0-9-]+$/);
  });

  it('leaves Writing and Market reports with NO signals', () => {
    // The honest state today: there is no market-reports work to show. The model must report a zero
    // rather than invent a loading for work that has not been done.
    expect(sig.filter((s) => s.factor === 'writing')).toHaveLength(0);
    expect(sig.filter((s) => s.factor === 'markets')).toHaveLength(0);
  });
});

describe('loadings — beta is a share, and the definition is the caption', () => {
  const ls = loadings();

  it('returns one loading per factor, in declared order', () => {
    expect(ls.map((l) => l.factor.key)).toEqual(FACTORS.map((f) => f.key));
  });

  it('sums to 1', () => {
    const total = ls.reduce((s, l) => s + l.beta, 0);
    expect(total).toBeCloseTo(1, 10);
  });

  it('keeps every beta in [0,1]', () => {
    for (const l of ls) {
      expect(l.beta, l.factor.key).toBeGreaterThanOrEqual(0);
      expect(l.beta, l.factor.key).toBeLessThanOrEqual(1);
    }
  });

  it('gives exactly zero to the two factors with no signals', () => {
    const zero = ls.filter((l) => l.beta === 0).map((l) => l.factor.key).sort();
    expect(zero).toEqual(['markets', 'writing']);
  });

  it('matches raw/total by construction — the arithmetic the caption claims', () => {
    // This is the test that makes the on-screen definition true. If someone later tweaks a beta "to look
    // better", this fails.
    //
    // It used to build its own total from `signals()` and each entry's `weight` field. Both are deleted
    // with the fan, so it now counts `identifiedSignals()` — which is the list `loadings()` itself reads,
    // at the default `count` basis where every artefact weighs exactly 1.
    //
    // THE POINT IS STILL AN INDEPENDENT CONSTRUCTION, and that is worth stating because re-pointing a
    // test at the function under test is how one quietly becomes a tautology. What is checked here is the
    // DEFINITION — raw is a sum over the factor's own members, beta is that over the grand total —
    // computed from the membership list with different arithmetic than `loadings` uses internally. A
    // change to how loadings aggregates still fails this; only a change to the membership list moves both.
    const sig = identifiedSignals();
    const total = sig.length;
    for (const l of ls) {
      const mine = sig.filter((s) => s.factor === l.factor.key).length;
      expect(l.raw, l.factor.key).toBe(mine);
      expect(l.count, l.factor.key).toBe(mine);
      expect(l.beta, l.factor.key).toBeCloseTo(mine / total, 12);
    }
    // And the shares really are shares: a sanity check the old version did not make.
    expect(ls.reduce((s, l) => s + l.beta, 0)).toBeCloseTo(1, 12);
  });

  it('counts signals per factor consistently with its raw weight', () => {
    for (const l of ls) {
      if (l.count === 0) expect(l.raw).toBe(0);
      else expect(l.raw).toBeGreaterThanOrEqual(l.count);   // every weight is >= 1
    }
  });

  it('ranks experience highest today, because it is duration-weighted', () => {
    // Not a preference — a consequence of the declared weighting, asserted so that a change
    // in the weighting scheme is visible in the diff rather than silent on screen.
    const top = [...ls].sort((a, b) => b.beta - a.beta)[0];
    expect(top.factor.key).toBe('experience');
  });

  it('is deterministic across calls', () => {
    expect(JSON.stringify(loadings())).toBe(JSON.stringify(loadings()));
  });
});

describe('FACTORS — the six, and what they promise', () => {
  it('has exactly six', () => {
    // Six is the conventional factor count (Fama–French uses five), so it needs no
    // invented justification — but it must stay six or the fan layout claim changes.
    expect(FACTORS).toHaveLength(6);
  });

  it('uses unique keys and symbols', () => {
    expect(new Set(FACTORS.map((f) => f.key)).size).toBe(6);
    expect(new Set(FACTORS.map((f) => f.symbol)).size).toBe(6);
  });

  it('gives every factor without an href an announcement instead', () => {
    // Otherwise a beam would be a dead click with no explanation.
    for (const f of FACTORS) {
      if (!f.href) expect(f.announce, f.key).toBeTruthy();
    }
  });

  it('points every href at a route that exists', () => {
    const built = new Set(['/research', '/projects', '/experience', '/art']);
    for (const f of FACTORS) {
      if (f.href) expect(built.has(f.href), f.href).toBe(true);
    }
  });

  it('gives every factor a gloss', () => {
    for (const f of FACTORS) expect(f.gloss.length, f.key).toBeGreaterThan(10);
  });
});
