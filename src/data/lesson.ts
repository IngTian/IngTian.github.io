// src/data/lesson.ts
// SLIDE 1 — WHAT PORTFOLIO OPTIMIZATION IS, taught rather than asserted.
//
// The owner's brief: "what is portfolio optimization. one slide. (we can have a cow easter egg here, cow
// is like a teacher here). imagine a portfolio of stocks, bonds, commodities, blablabla, each given their
// historic performance (you can draft one), how do you make the best decisions to form a portfolio given
// constraints (you can raise some). i would say as examples, you can show several."
//
// THE NUMBERS HERE ARE ILLUSTRATIVE AND SAY SO. This is the one place on the site where invented figures
// are legitimate, and the distinction matters: these are textbook-style asset-class characteristics used
// to TEACH a method, not results attributed to the owner. The table is captioned as illustrative, the
// figures are deliberately round, and no portfolio below is presented as anything he ran. Contrast
// data/track.ts, where every number is a published result and nothing is invented.
//
// THE COW IS A VOICE, NOT A DRAWING. It reuses the existing easter-egg idiom (TerrainHero's "Moo!" pill):
// a marginal voice that asks the naive question the reader is already thinking. The project notes are
// explicit that hand-authored illustration has failed three times; a drawn animal would be a fourth.

export interface AssetRow {
  label: string;
  /** Illustrative long-run annual return, as a percentage string. */
  ret: string;
  /** Illustrative annual volatility. */
  vol: string;
  /** One phrase on what the asset is FOR in a portfolio — the part a beginner actually needs. */
  role: string;
}

/** The teaching table. Round, generic, textbook-shaped numbers — the point is the trade-off, not the data. */
export const ASSETS: AssetRow[] = [
  { label: 'Equities',    ret: '8%',   vol: '16%', role: 'growth, and most of the risk' },
  { label: 'Bonds',       ret: '3%',   vol: '5%',  role: 'ballast when equities fall' },
  { label: 'Commodities', ret: '4%',   vol: '20%', role: 'moves out of step with both' },
  { label: 'Cash',        ret: '2%',   vol: '0%',  role: 'optionality, and a drag' },
];

export const ASSETS_CAPTION =
  'Illustrative long-run characteristics, rounded — the shape of the problem, not anyone’s results.';

/** THE QUESTION the slide exists to pose. */
export const LESSON_QUESTION =
  'Given a handful of assets like these, what fraction of your money goes into each — and why that split rather than any of the infinitely many others?';

export interface Candidate {
  name: string;
  /** The mix, as display copy. */
  mix: string;
  /** What it optimises for. */
  goal: string;
  /** The honest cost of choosing it. */
  cost: string;
}

/** SEVERAL example portfolios from the same table, so the trade-off is felt rather than asserted. Each is
 *  defensible and each is wrong for somebody — which is the actual lesson. */
export const CANDIDATES: Candidate[] = [
  {
    name: 'All equities',
    mix: '100% equities',
    goal: 'the highest expected return in the table',
    cost: 'and the full 16% swing, with nothing to cushion a bad decade',
  },
  {
    name: 'Equal weight',
    mix: '25% each',
    goal: 'simple, and diversified by construction',
    cost: 'but it treats cash and equities as equally important, which they are not',
  },
  {
    name: 'Risk parity',
    mix: 'weights set so each asset contributes the same risk',
    goal: 'no single holding can dominate the outcome',
    cost: 'which loads heavily into bonds and gives up return to get there',
  },
  {
    name: 'Optimised',
    mix: 'the mix a solver picks',
    goal: 'the best return available at a risk level you choose',
    cost: 'and it is only as good as the estimates you fed it',
  },
];

/** The constraints — the reason this is optimisation and not arithmetic. */
export const CONSTRAINTS: string[] = [
  'The weights must sum to one. You cannot invest money you do not have.',
  'No short selling, if the mandate forbids it — every weight stays at or above zero.',
  'No more than x% in any one sector, so a single bad call cannot sink the fund.',
  'Trading costs money, so a small improvement is not worth a large rebalance.',
  'Some positions cannot be sold quickly at a fair price, so size is limited by liquidity.',
];

/** The cow's lines. Short, naive, and the questions a reader is already asking. */
export const COW_LINES: string[] = [
  'Why not just buy the one with the highest return?',
  'So more diversification is always better?',
  'Who decides what the risk level should be?',
];

/** The turn at the end of the slide: why the answer is not obvious. */
export const LESSON_CLOSE =
  'Every one of those mixes is defensible, and every one is wrong for somebody. Choosing between them is the job.';
