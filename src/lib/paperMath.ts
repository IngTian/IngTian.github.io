// Which typeset equations does a paper own?
//
// This lives in lib/ (not inline in research.astro) so the RAIL and the PAGE ask
// the same question of the same table. When the table was page-local, pageStops
// could only test `!!p.mathKey` — so a paper whose mathKey wasn't in the table got
// a "Method" rail stop pointing at an id the page never rendered, defeating the
// very invariant pageStops exists to guarantee.
//
// MathML is baked at build time by lib/equations.ts; KaTeX is a devDependency and
// is never shipped to the client.

import { PAPER_EQUATIONS } from './equations';
import type { Publication } from '../data/profile';

export interface MathShowcase {
  /** Shown in the block's footnote, e.g. "arXiv:2508.11856". */
  source: string;
  equations: { html: string; gloss: string }[];
}

const MATH_BY_KEY: Record<string, MathShowcase> = {
  rlbhrp: {
    source: 'arXiv:2508.11856',
    equations: [
      { html: PAPER_EQUATIONS.weightMap, gloss: 'Two-level weights — each holding is its sector’s share times its share within that sector.' },
      { html: PAPER_EQUATIONS.reward, gloss: 'The learning signal: gross return, minus turnover cost, minus a risk-dispersion penalty.' },
      { html: PAPER_EQUATIONS.riskConservation, gloss: 'Risk contributions sum exactly to portfolio variance — the basis for parity.' },
      { html: PAPER_EQUATIONS.sectorCov, gloss: 'Within-sector weights aggregate asset covariance up to the sector level.' },
    ],
  },
};

/** The equations this paper owns, or undefined if it owns none. The ONE place that
 *  decides whether a Method block (and therefore a Method rail stop) exists. */
export function mathFor(p: Publication): MathShowcase | undefined {
  return p.mathKey ? MATH_BY_KEY[p.mathKey] : undefined;
}
