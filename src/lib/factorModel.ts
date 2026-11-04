// src/lib/factorModel.ts
// ONE ASSET, MANY SIGNALS — the pod's replacement, as a factor model.
//
// WHY A FACTOR MODEL AND NOT A CORRELATION MATRIX:
// The previous candidate (seriation / quasi-diagonalisation) reorders an n×n similarity
// matrix over n COMPARABLE ASSETS. This site is one asset, so clustering it against itself
// is a category error — the object would assert a shape the data cannot have. A factor
// model is the correct dimensionality for one dependent variable explained by many signals:
//
//     r_TIAN = α + Σ_k β_k f_k + ε
//
// Six panels stop being an arbitrary cut at k = 6 and become six FACTORS, which is the
// conventional form (Fama–French uses five; Barra uses industry + style blocks). Nothing
// has to be invented to justify six.
//
// HONESTY RULE, and it is the whole reason this module exists rather than a literal array:
// a factor model implies a FIT. Every number this module exposes is derived from declared
// data in profile.ts by arithmetic you can read here — there are no fabricated betas, no
// t-stats, no R². `beta` is defined exactly once, below, and the caption on screen states
// that definition verbatim. If a number cannot be derived, it is not shown.

import { timeline, publications, projects, awards, researchInterests } from '../data/profile';

/** The six factors. `key` is stable (used in ids and tests); `href` is the destination the
 *  factor's beam navigates to, or null for the two that are not built yet. */
export interface Factor {
  key: string;
  /** Short symbol, rendered as the subscript on β in the expression. */
  symbol: string;
  label: string;
  href: string | null;
  /** Shown when there is no page yet. */
  announce?: string;
  /** One line: what this exposure actually is. */
  gloss: string;
}

export const FACTORS: Factor[] = [
  {
    key: 'research', symbol: 'res', label: 'Research', href: '/research',
    gloss: 'Portfolio optimization, risk parity, RL for allocation — the OR core.',
  },
  {
    key: 'projects', symbol: 'proj', label: 'Projects', href: '/projects',
    gloss: 'Shipped systems, built end to end.',
  },
  {
    key: 'experience', symbol: 'exp', label: 'Experience', href: '/experience',
    gloss: 'Roles and degrees — where the work happened.',
  },
  {
    key: 'writing', symbol: 'wri', label: 'Writing', href: null,
    announce: 'Writing · coming',
    gloss: 'Notes and papers in progress.',
  },
  {
    key: 'markets', symbol: 'mkt', label: 'Market reports', href: null,
    announce: 'Market reports · coming',
    gloss: 'Commentary on what the tape is doing.',
  },
  {
    key: 'craft', symbol: 'crf', label: 'Craft', href: '/art',
    gloss: 'Calligraphy and guqin — the hand behind the maths.',
  },
];

/**
 * EVERY SIGNAL IN THE MODEL, drawn from profile.ts, with stable ids.
 *
 * Membership is DECLARED, not inferred: a timeline entry loads on `experience`, a publication on
 * `research`, and so on. That is the honest mapping — pretending an algorithm discovered which of a
 * person's jobs is "research" would be the same overclaiming that sank the seriation concept.
 *
 * The id is '<collection>:<index>' — '<collection>:<slug>' for publications and projects, so adding one
 * does not reshuffle the committed scores — and the label is carried alongside, so an edited item is
 * DETECTED (label mismatch) rather than silently keeping a stale score.
 *
 * EVERY SIGNAL WEIGHS 1 BY DEFAULT — one declared artefact, one unit — AND THAT IS A MEASURED DECISION,
 * not a simplification. This note used to live on a `Signal` interface that has since been deleted along
 * with the rest of the fan; it is kept here because it is the only record of the result. An earlier
 * version weighted timeline entries by DURATION while everything else counted as one artefact, which put
 * two different units in one denominator: nine roles summing 16 job-years swamped six research items
 * summing 6, and the model reported **Experience 0.59 / Research 0.22**. That is not a fact about the
 * record, it is an artefact of mixing years with counts. One unit, no mixing, and the ratio means
 * something. `evidenceWeights` below is where a real weighting scheme belongs if one ever lands.
 *
 * WRITING AND MARKETS CARRY NO SIGNALS YET, and the model must show that truthfully rather than invent a
 * loading for work that does not exist — `tests/factorModel.test.ts` asserts it.
 */
export function identifiedSignals(): { id: string; label: string; factor: string }[] {
  const out: { id: string; label: string; factor: string }[] = [];
  timeline.forEach((t, i) => out.push({ id: `timeline:${i}`, label: t.title, factor: 'experience' }));
  publications.forEach((p) => out.push({ id: `publications:${p.slug}`, label: p.title, factor: 'research' }));
  researchInterests.forEach((r, i) => out.push({ id: `interests:${i}`, label: r.label, factor: 'research' }));
  projects.forEach((p) => out.push({ id: `projects:${p.slug}`, label: p.name, factor: 'projects' }));
  awards.forEach((a, i) => out.push({ id: `awards:${i}`, label: a.title, factor: 'craft' }));
  return out;
}

/** How the loadings were computed, for the on-screen caption. The page states which of these
 *  is live, so the reader always knows whether a beta is a count or a judgement. */
export type WeightBasis = 'count' | 'evidence';

/**
 * Weight per signal id, from committed LLM scores when they are present AND current.
 *
 * Falls back to counting whenever the artefact is absent or stale. That fallback is not a
 * convenience — it is what keeps the site honest without a working scorer: a missing or
 * outdated score file degrades the model to verifiable arithmetic rather than to a wrong
 * number. Staleness is also asserted by a test, so it surfaces as a red build.
 */
export function evidenceWeights(
  scored: readonly { id: string; label: string; score: number }[] | null,
): { basis: WeightBasis; weightFor: (id: string) => number } {
  const live = identifiedSignals();
  if (!scored || scored.length === 0) {
    return { basis: 'count', weightFor: () => 1 };
  }
  const byId = new Map(scored.map((s) => [s.id, s]));
  const allCurrent = live.every((l) => byId.get(l.id)?.label === l.label);
  if (!allCurrent) return { basis: 'count', weightFor: () => 1 };
  return {
    basis: 'evidence',
    weightFor: (id) => byId.get(id)?.score ?? 1,
  };
}

export interface Loading {
  factor: Factor;
  /** Raw summed weight of the factor's signals. */
  raw: number;
  /** Share of total weight, in [0,1]. Sums to 1 across factors. THIS is beta. */
  beta: number;
  /** How many signals load on this factor. */
  count: number;
  /** Whether these weights are artefact counts or LLM-scored evidence strength. The page
   *  MUST state this, so the reader always knows if a beta is arithmetic or judgement. */
  basis: WeightBasis;
}

/**
 * The loadings.
 *
 * beta_k = (summed weight of signals declared on factor k) / (total summed weight).
 *
 * That single line is the model's entire claim, and it is what the on-screen caption says.
 * Betas are shares, so they are non-negative and sum to 1 — which is what lets any renderer encode one
 * as a length, an area or a share of a bar without misleading anyone. (This clause used to say "which is
 * also why the fan can use beam area"; that fan is deleted, but the property is the reason, not the fan.)
 */
export function loadings(
  scored: readonly { id: string; label: string; score: number }[] | null = null,
): Loading[] {
  const { basis, weightFor } = evidenceWeights(scored);
  const live = identifiedSignals();
  const total = live.reduce((s, l) => s + weightFor(l.id), 0) || 1;
  return FACTORS.map((factor) => {
    const mine = live.filter((l) => l.factor === factor.key);
    const raw = mine.reduce((s, l) => s + weightFor(l.id), 0);
    return { factor, raw, beta: raw / total, count: mine.length, basis };
  });
}
