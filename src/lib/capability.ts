// src/lib/capability.ts
// BREADTH AND DEPTH OF A CAPABILITY PROFILE — the honest replacement for "predict r_TIAN".
//
// ── NO PAGE IMPORTS THIS, AND THAT IS DELIBERATE. DO NOT DELETE IT AS DEAD CODE. ──
// An import-graph closure from every entry point in src/pages/ does not reach this file, so a
// dead-code sweep flags it every single time. It survived one such sweep only because a human
// went and read a design note in notes/, and that folder is now deleted too — so this comment is the
// ONLY surviving record of why an unreferenced module is here. It is quoted rather than referenced
// for exactly that reason: a pointer outlives its target, a quotation does not.
//
// The decision, verbatim from that note ("What IS decided, and committed"):
//   "src/lib/capability.ts — breadth statistics (HHI, effective dimensions). Rejected as a
//    *subject* but kept: they are honest and may serve as substructure."
// The showpiece slot at the bottom of the homepage is intentionally empty after five rejected
// attempts; the maths that survived each attempt is kept, the visuals are not. Breadth-as-a-
// headline was rejected ("too direct… like advertising and branding yourself like a commodity"),
// but the statistics themselves are correct and reproducible, and a sixth attempt is expected to
// want them as substructure rather than as the subject.
//
// Its spec (tests/capability.test.ts) is therefore the only thing keeping it honest — keep that
// green. The design-time PRINTER that used to sit beside it (tests/capabilityInspect.test.ts) is
// gone: it asserted almost nothing and only existed to read the numbers off while the rejected
// slide was being drawn.
//
// WHY THIS EXISTS, and it is a correction worth stating:
// the factor model was written as r_TIAN = α + Σ β_k f_k + ε. That reads as a RETURN, and a
// return implies a P&L. There is no P&L for a person, so the equation was letting a metaphor
// write the maths — dishonest in exactly the way this site refuses to be. The owner also named
// the second problem: pricing a human like a security is off, and it flattens the one thing
// actually worth showing, which is BREADTH.
//
// So: keep every piece of real machinery — declared sources, mined signals, evidence scores
// against a published rubric, reproducible arithmetic — and drop the pricing. The output is not
// a predicted return. It is a measured profile: how much evidence supports each dimension, and
// how CONCENTRATED or BROAD that support is.
//
// Every statistic below is standard, and every one is computed from the same scores the profile
// already publishes. Nothing here needs a return series, a covariance, or a fitted regression.

import { loadings, type Loading } from './factorModel';

export interface Concentration {
  /** Herfindahl–Hirschman index of the loadings: Σ w_k². 1/n when perfectly even, 1 when all
   *  the evidence sits on one dimension. The standard concentration measure in portfolio
   *  construction, applied here to evidence shares rather than to capital. */
  hhi: number;
  /** 1 / HHI — the "effective number" of dimensions. Reads directly: with six dimensions and an
   *  effective number of 2.9, the profile is genuinely strong on about three, not six. This is
   *  the single most honest number on the page, because it refuses to flatter. */
  effectiveN: number;
  /** Shannon entropy of the shares, in bits. A second, independent read on breadth: it weighs
   *  small non-zero dimensions more than HHI does. */
  entropyBits: number;
  /** entropyBits / log2(n) — breadth on a 0..1 scale, so it can drive geometry directly. */
  breadth: number;
  /** How many dimensions carry any evidence at all. */
  covered: number;
  /** Total dimensions in the profile. */
  total: number;
}

/**
 * Concentration and breadth of an evidence profile.
 *
 * Zero-weight dimensions are INCLUDED in `total` and excluded from the entropy sum (0·log0 = 0
 * by convention). That is deliberate: a dimension with no evidence yet is information — it says
 * "nothing published here" — and hiding it would inflate the breadth figure.
 */
export function concentration(weights: readonly number[]): Concentration {
  const total = weights.length;
  const sum = weights.reduce((s, w) => s + w, 0);
  if (sum <= 0) {
    return { hhi: 1, effectiveN: 0, entropyBits: 0, breadth: 0, covered: 0, total };
  }
  const shares = weights.map((w) => w / sum);
  const hhi = shares.reduce((s, w) => s + w * w, 0);
  const entropyBits = -shares.reduce((s, w) => (w > 0 ? s + w * Math.log2(w) : s), 0);
  const covered = shares.filter((w) => w > 0).length;
  return {
    hhi,
    effectiveN: 1 / hhi,
    entropyBits,
    breadth: total > 1 ? entropyBits / Math.log2(total) : 0,
    covered,
    total,
  };
}

/** The site's own profile, from the live loadings. */
export function profileConcentration(
  scored: readonly { id: string; label: string; score: number }[] | null = null,
): Concentration & { loadings: Loading[] } {
  const ls = loadings(scored);
  return { ...concentration(ls.map((l) => l.beta)), loadings: ls };
}

// ── Depth per dimension ─────────────────────────────────────────────────────
// Breadth alone is not enough: a profile could be broad and uniformly shallow. Depth is the
// evidence QUALITY on a dimension, distinct from how many items it has.

export interface DimensionDepth {
  key: string;
  label: string;
  /** Number of signals declared on this dimension. */
  count: number;
  /** Mean evidence score of those signals, 0 when there are none. Depth, not volume. */
  meanScore: number;
  /** Best single score on the dimension — the strongest artefact it can point at. */
  peakScore: number;
  /** Share of total evidence. Same as beta. */
  share: number;
}

/**
 * Depth per dimension.
 *
 * The distinction this makes visible is the one the fan alone hid: Experience has the LARGEST
 * share (many items) but a LOW mean score (mostly 1s and 2s), while Research has fewer items at
 * a higher mean. Volume and quality are different axes, and a profile that only showed share
 * implied they were the same.
 */
export function dimensionDepth(
  scored: readonly { id: string; label: string; score: number; factor: string }[],
  ls: readonly Loading[],
): DimensionDepth[] {
  return ls.map((l) => {
    const mine = scored.filter((s) => s.factor === l.factor.key);
    const sum = mine.reduce((s, x) => s + x.score, 0);
    return {
      key: l.factor.key,
      label: l.factor.label,
      count: mine.length,
      meanScore: mine.length ? sum / mine.length : 0,
      peakScore: mine.length ? Math.max(...mine.map((s) => s.score)) : 0,
      share: l.beta,
    };
  });
}
