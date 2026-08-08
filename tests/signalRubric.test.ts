// tests/signalRubric.test.ts
// The staleness guard, and the fallback that keeps the site honest without a scorer.
//
// THE FAILURE THIS PREVENTS: someone edits a role in profile.ts, the committed LLM scores
// still carry the OLD text's score, and the page shows a beta computed from content that no
// longer exists. Nothing on screen would look wrong. So staleness is a red test.

import { describe, it, expect } from 'vitest';
import { hashContent, staleSignals, SCALE, RUBRIC_PROMPT } from '../src/lib/signalRubric';
import { identifiedSignals, evidenceWeights, loadings, FACTORS } from '../src/lib/factorModel';

describe('hashContent', () => {
  it('is stable for the same input', () => {
    expect(hashContent(['a', 'b'])).toBe(hashContent(['a', 'b']));
  });

  it('changes when any part changes', () => {
    expect(hashContent(['a', 'b'])).not.toBe(hashContent(['a', 'c']));
  });

  it('is order-sensitive, so a reordered résumé re-scores', () => {
    expect(hashContent(['a', 'b'])).not.toBe(hashContent(['b', 'a']));
  });

  it('separates parts, so concatenation cannot collide', () => {
    // Without a separator, ['ab','c'] and ['a','bc'] would hash identically and an edit
    // that moved a word across items would be invisible.
    expect(hashContent(['ab', 'c'])).not.toBe(hashContent(['a', 'bc']));
  });

  it('returns a fixed-width hex string', () => {
    expect(hashContent(['x'])).toMatch(/^[0-9a-f]{16}$/);
  });
});

describe('staleSignals', () => {
  const live = [{ id: 'a:0', label: 'Alpha' }, { id: 'a:1', label: 'Beta' }];

  it('reports nothing stale when everything matches', () => {
    const r = staleSignals(live, [
      { id: 'a:0', label: 'Alpha', factor: 'f', score: 3, because: '' },
      { id: 'a:1', label: 'Beta', factor: 'f', score: 4, because: '' },
    ]);
    expect(r).toEqual({ missing: [], changed: [], orphaned: [] });
  });

  it('flags an item whose TEXT changed under a stable id', () => {
    // The important case: the id still matches, so a naive check would pass while the score
    // describes text that no longer exists.
    const r = staleSignals(live, [
      { id: 'a:0', label: 'Alpha, rewritten', factor: 'f', score: 3, because: '' },
      { id: 'a:1', label: 'Beta', factor: 'f', score: 4, because: '' },
    ]);
    expect(r.changed).toEqual(['a:0']);
  });

  it('flags a newly added item as missing', () => {
    const r = staleSignals(live, [{ id: 'a:0', label: 'Alpha', factor: 'f', score: 3, because: '' }]);
    expect(r.missing).toEqual(['a:1']);
  });

  it('flags a removed item as orphaned', () => {
    const r = staleSignals(live, [
      { id: 'a:0', label: 'Alpha', factor: 'f', score: 3, because: '' },
      { id: 'a:1', label: 'Beta', factor: 'f', score: 4, because: '' },
      { id: 'a:2', label: 'Gone', factor: 'f', score: 2, because: '' },
    ]);
    expect(r.orphaned).toEqual(['a:2']);
  });
});

describe('the rubric itself', () => {
  it('is a five-point scale with named anchors', () => {
    // Coarse on purpose: a 1-100 scale invents precision an LLM does not have, and two runs
    // would disagree constantly.
    expect(SCALE).toHaveLength(5);
    expect(SCALE.map((s) => s.score)).toEqual([1, 2, 3, 4, 5]);
    for (const s of SCALE) {
      expect(s.name.length).toBeGreaterThan(3);
      expect(s.gloss.length).toBeGreaterThan(15);
    }
  });

  it('publishes the exact prompt, so the page can show the rule', () => {
    // A judgement with a published rule is defensible; an unexplained number is not.
    expect(RUBRIC_PROMPT).toContain('peer-checked');
    expect(RUBRIC_PROMPT).toContain('Score the EVIDENCE, not the prestige');
    expect(RUBRIC_PROMPT).toContain('cannot exceed 3');
  });
});

describe('evidenceWeights — the fallback is the honesty mechanism', () => {
  it('falls back to counting when there are no scores', () => {
    const w = evidenceWeights(null);
    expect(w.basis).toBe('count');
    expect(w.weightFor('anything')).toBe(1);
  });

  it('falls back to counting when the scores are EMPTY', () => {
    expect(evidenceWeights([]).basis).toBe('count');
  });

  it('falls back to counting when ANY scored label is out of date', () => {
    // Partial staleness must not produce a half-scored model — that would be a number
    // nobody could reproduce. Degrade wholesale to arithmetic instead.
    const live = identifiedSignals();
    const scored = live.map((l, i) => ({
      id: l.id, label: i === 0 ? 'edited since scoring' : l.label, score: 4,
    }));
    expect(evidenceWeights(scored).basis).toBe('count');
  });

  it('uses evidence weights when every label is current', () => {
    const scored = identifiedSignals().map((l) => ({ id: l.id, label: l.label, score: 3 }));
    const w = evidenceWeights(scored);
    expect(w.basis).toBe('evidence');
    expect(w.weightFor(scored[0].id)).toBe(3);
  });
});

describe('loadings under evidence weighting', () => {
  const scored = identifiedSignals().map((l) => ({
    id: l.id, label: l.label,
    // deliberately lopsided: research items score high, everything else low
    score: l.factor === 'research' ? 5 : 1,
  }));

  it('still sums to 1', () => {
    const total = loadings(scored).reduce((s, l) => s + l.beta, 0);
    expect(total).toBeCloseTo(1, 10);
  });

  it('reports the basis, so the caption cannot lie about it', () => {
    for (const l of loadings(scored)) expect(l.basis).toBe('evidence');
    for (const l of loadings(null)) expect(l.basis).toBe('count');
  });

  it('lets evidence strength change the ranking', () => {
    // The whole reason to score: with counts, experience leads on volume alone. With
    // evidence, a strongly-evidenced factor can overtake a merely numerous one.
    const byCount = loadings(null);
    const byEvidence = loadings(scored);
    const topCount = [...byCount].sort((a, b) => b.beta - a.beta)[0].factor.key;
    const topEvidence = [...byEvidence].sort((a, b) => b.beta - a.beta)[0].factor.key;
    expect(topCount).toBe('experience');
    expect(topEvidence).toBe('research');
  });

  it('keeps the unbuilt factors at exactly zero under BOTH bases', () => {
    // No weighting scheme may invent a loading for work that does not exist.
    for (const basis of [null, scored]) {
      const zero = loadings(basis).filter((l) => l.beta === 0).map((l) => l.factor.key).sort();
      expect(zero).toEqual(['markets', 'writing']);
    }
  });
});

describe('identifiedSignals', () => {
  const live = identifiedSignals();

  it('gives every signal a unique id', () => {
    expect(new Set(live.map((l) => l.id)).size).toBe(live.length);
  });

  it('namespaces ids by collection, so two collections cannot collide', () => {
    for (const l of live) expect(l.id).toMatch(/^[a-z]+:\d+$/);
  });

  it('carries a non-empty label for every signal', () => {
    for (const l of live) expect(l.label.trim().length, l.id).toBeGreaterThan(0);
  });

  it('assigns every signal to a declared factor', () => {
    const keys = new Set(FACTORS.map((f) => f.key));
    for (const l of live) expect(keys.has(l.factor), l.id).toBe(true);
  });
});
