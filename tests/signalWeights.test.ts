// tests/signalWeights.test.ts
// Guards on the COMMITTED scoring artefact.
//
// These are the tests that make "regenerate the weights automatically" safe. Without them, a
// content edit silently leaves a stale score behind and the page displays a beta computed
// from text that no longer exists — a wrong number with nothing on screen looking wrong.

import { describe, it, expect } from 'vitest';
import { SIGNAL_WEIGHTS } from '../src/data/signalWeights';
import { staleSignals, SCALE } from '../src/lib/signalRubric';
import { identifiedSignals, loadings, FACTORS } from '../src/lib/factorModel';

describe('the committed scores match the live content', () => {
  const live = identifiedSignals();
  const stale = staleSignals(live, SIGNAL_WEIGHTS.signals);

  it('scores every live signal', () => {
    // A new résumé item with no score would silently fall back to count weighting for the
    // whole model. Re-run the scorer.
    expect(stale.missing, `unscored items — re-run the scorer: ${stale.missing.join(', ')}`)
      .toEqual([]);
  });

  it('has no score describing text that has since changed', () => {
    // The dangerous case: id still matches, so only the stored label reveals the drift.
    expect(stale.changed, `text changed since scoring — re-run the scorer: ${stale.changed.join(', ')}`)
      .toEqual([]);
  });

  it('has no scores for items that no longer exist', () => {
    expect(stale.orphaned, `orphaned scores — re-run the scorer: ${stale.orphaned.join(', ')}`)
      .toEqual([]);
  });
});

describe('every score is well-formed', () => {
  it('sits on the published five-point scale', () => {
    const allowed = new Set(SCALE.map((s) => s.score));
    for (const s of SIGNAL_WEIGHTS.signals) {
      expect(allowed.has(s.score), `${s.id} = ${s.score}`).toBe(true);
    }
  });

  it('carries a justification naming the evidence', () => {
    // The clause is what makes a score arguable rather than mysterious, and it is shown to
    // the reader. An empty one would be an unexplained number.
    for (const s of SIGNAL_WEIGHTS.signals) {
      expect(s.because.trim().length, s.id).toBeGreaterThan(30);
    }
  });

  it('uses unique ids', () => {
    const ids = SIGNAL_WEIGHTS.signals.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('assigns every score to a declared factor', () => {
    const keys = new Set(FACTORS.map((f) => f.key));
    for (const s of SIGNAL_WEIGHTS.signals) expect(keys.has(s.factor), s.id).toBe(true);
  });

  it('records its provenance', () => {
    expect(SIGNAL_WEIGHTS.model.length).toBeGreaterThan(4);
    expect(SIGNAL_WEIGHTS.scoredAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('the honesty ceiling', () => {
  it('awards 5 to nothing without external validation', () => {
    // arXiv is verifiable (4), not peer-checked (5). Nothing in the record today has
    // documented third-party review or adoption, so a 5 would be an overclaim — and this is
    // exactly the kind of number a quant reader would probe.
    const fives = SIGNAL_WEIGHTS.signals.filter((s) => s.score === 5);
    expect(fives.map((s) => s.id)).toEqual([]);
  });

  it('keeps declared interests at 1', () => {
    // An interest is a statement of intent. Scoring it as evidence would inflate the
    // research loading with things that are not artefacts.
    for (const s of SIGNAL_WEIGHTS.signals.filter((x) => x.id.startsWith('interests:'))) {
      expect(s.score, s.id).toBe(1);
    }
  });

  it('scores the RL-BHRP paper as the strongest single artefact', () => {
    const paper = SIGNAL_WEIGHTS.signals.find((s) => s.id === 'publications:0')!;
    const max = Math.max(...SIGNAL_WEIGHTS.signals.map((s) => s.score));
    expect(paper.score).toBe(max);
  });
});

describe('the model, weighted by evidence', () => {
  const ls = loadings(SIGNAL_WEIGHTS.signals);

  it('still sums to 1', () => {
    expect(ls.reduce((s, l) => s + l.beta, 0)).toBeCloseTo(1, 10);
  });

  it('reports the evidence basis, since the scores are current', () => {
    for (const l of ls) expect(l.basis).toBe('evidence');
  });

  it('keeps the unbuilt factors at exactly zero', () => {
    const zero = ls.filter((l) => l.beta === 0).map((l) => l.factor.key).sort();
    expect(zero).toEqual(['markets', 'writing']);
  });

  it('moves the loadings away from pure counting', () => {
    // If evidence weighting produced the same answer as counting, the scoring would be
    // decoration. It must actually change something.
    const byCount = loadings(null);
    const same = FACTORS.every((f) => {
      const a = byCount.find((l) => l.factor.key === f.key)!.beta;
      const b = ls.find((l) => l.factor.key === f.key)!.beta;
      return Math.abs(a - b) < 1e-9;
    });
    expect(same).toBe(false);
  });
});
