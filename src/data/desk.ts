// src/data/desk.ts
// THE CONCRETE EXAMPLE — real tickers, invented year.
//
// The owner: "let's say you have AAPL, NVDA, META, BOA, XAUUSD, WTIOIL, etc. imagine that you have news now
// and then, and you pick initial portfolio weights, during news, during the 1 year horizon, you shifted
// positions (just like every trader), you probably resulted in a turbulent portfolio pnl."
//
// HONESTY, AND IT MATTERS MORE HERE THAN ANYWHERE ELSE ON THE SITE. The ticker names are real; the prices,
// the news headlines and every path are INVENTED. Real names make invented numbers look authoritative, so
// the slide states this in its own copy — not only in a source comment — and the headlines are written as
// plainly generic events rather than as things that actually happened on a date.
//
// The drifts and vols are rounded, textbook-plausible figures for each asset class, chosen so the example
// behaves recognisably (NVDA swings more than BOA; gold moves against equities on risk-off news). They are
// characteristics of a made-up world, not estimates anyone should trade on.

import type { Instrument, NewsEvent } from '../lib/scenario';

export const INSTRUMENTS: Instrument[] = [
  { ticker: 'AAPL',   name: 'Apple',            glyph: 'tech',   drift: 0.11, vol: 0.26 },
  { ticker: 'NVDA',   name: 'NVIDIA',           glyph: 'chip',   drift: 0.24, vol: 0.52 },
  { ticker: 'META',   name: 'Meta',             glyph: 'tech',   drift: 0.13, vol: 0.36 },
  { ticker: 'BAC',    name: 'Bank of America',  glyph: 'bank',   drift: 0.07, vol: 0.24 },
  { ticker: 'XAUUSD', name: 'Gold',             glyph: 'gold',   drift: 0.05, vol: 0.14 },
  { ticker: 'WTI',    name: 'Crude oil',        glyph: 'oil',    drift: 0.03, vol: 0.34 },
];

/**
 * Six headlines across the year, each with a one-week shock per instrument.
 *
 * Written generically on purpose: "a chipmaker beats expectations" rather than a real dated event, so the
 * example cannot be mistaken for a claim about what happened. The shocks are internally consistent — a
 * risk-off week lifts gold and hurts equities — because an inconsistent world would teach the wrong
 * reflexes.
 */
export const NEWS: NewsEvent[] = [
  {
    week: 6,
    headline: 'Chipmaker beats expectations; AI capex guidance raised',
    shock: { NVDA: 0.14, AAPL: 0.03, META: 0.05, BAC: 0.00, XAUUSD: -0.01, WTI: 0.01 },
  },
  {
    week: 13,
    headline: 'Inflation print comes in hot; rate-cut hopes pushed out',
    shock: { NVDA: -0.09, AAPL: -0.04, META: -0.05, BAC: 0.03, XAUUSD: -0.03, WTI: 0.02 },
  },
  {
    week: 21,
    headline: 'Regional bank stress resurfaces; flight to safety',
    shock: { NVDA: -0.06, AAPL: -0.03, META: -0.04, BAC: -0.11, XAUUSD: 0.06, WTI: -0.04 },
  },
  {
    week: 30,
    headline: 'Supply disruption lifts crude; energy costs jump',
    shock: { NVDA: -0.02, AAPL: -0.02, META: -0.02, BAC: 0.00, XAUUSD: 0.02, WTI: 0.17 },
  },
  {
    week: 38,
    headline: 'Antitrust ruling lands against a large platform',
    shock: { NVDA: 0.01, AAPL: -0.02, META: -0.13, BAC: 0.00, XAUUSD: 0.01, WTI: 0.00 },
  },
  {
    week: 45,
    headline: 'Soft landing narrative returns; risk appetite recovers',
    shock: { NVDA: 0.10, AAPL: 0.05, META: 0.07, BAC: 0.04, XAUUSD: -0.03, WTI: 0.02 },
  },
];

/** Stated on the slide, in the slide's own words. */
export const DESK_DISCLAIMER =
  'Real tickers, invented year: the prices, the headlines and every path below are made up. A worked example, not a backtest.';

/** How many discretionary paths to draw. Enough to read as a population, few enough to stay legible. */
export const TRADER_COUNT = 48;

// ── FUND SCALE, AND THE CONSTRAINTS THAT COME WITH IT ────────────────────────────────────────────────
//
// The owner: "we didnt include constraints right? most traders dont care about constraints, but imagine we
// run the funds at 1B scale and we have strict drawdown, and regulatory constraints (you can name a few),
// then, you can have that realistic number thousands of tickers and countless constraints."
//
// That observation is the hinge of the whole sequence: the reason the job is not "trade well" is that at
// scale you are not allowed to trade freely. Each constraint below is a real category with a real reason.

export interface Constraint {
  group: string;
  rule: string;
  why: string;
}

export const CONSTRAINTS: Constraint[] = [
  {
    group: 'Mandate',
    rule: 'Max drawdown 8%, measured peak-to-trough on a rolling basis',
    why: 'Breach it and investors redeem, which forces selling at exactly the wrong moment.',
  },
  {
    group: 'Mandate',
    rule: 'No single name above 5% of NAV; no sector above 25%',
    why: 'One bad position must not be able to end the fund.',
  },
  {
    group: 'Regulatory',
    rule: 'Position disclosure above 5% of a company’s shares outstanding',
    why: 'Crossing it publishes your hand and constrains how you can exit.',
  },
  {
    group: 'Regulatory',
    rule: 'Leverage and margin limits under the fund’s prospectus and Reg T',
    why: 'Gross exposure is capped whatever the opportunity looks like.',
  },
  {
    group: 'Liquidity',
    rule: 'No more than 10% of a name’s 20-day average volume per day',
    why: 'At $1B, your own order moves the price against you — the cost of trading grows with size.',
  },
  {
    group: 'Operational',
    rule: 'Turnover budget, and settlement and borrow availability for shorts',
    why: 'A trade you cannot settle or borrow is not a trade, however good the idea.',
  },
];

/** Fund-scale figures, declared. */
export const FUND = {
  aum: '$1B',
  tickers: 3000,
  constraints: 2000,
  periods: 24,
  drawdownLimit: 0.08,
};

/** WHAT THE JOB IS, in the owner's own framing: find a good strategy to optimise a SEQUENCE of decisions. */
export const JOB_STATEMENT =
  'Find a strategy that optimises a sequence of decisions — consistent return, controlled drawdown, every constraint respected, at a scale where your own trading moves the price.';

export const JOB_NOTE =
  'Sharpe is how that consistency gets measured: return per unit of swing, not return alone. A path that doubles and halves is worth less than one that climbs steadily, because only the second one survives contact with a mandate.';

/** The toolkit, named as instruments with the job each does. */


// ── THE METHOD SLIDE: WHAT IS OPEN, AND WHERE IT WOULD BE ATTACKED ───────────────────────────────────────
//
// THIS REPLACED A WRONG SLIDE, and the correction is worth keeping in the file. An earlier version typeset the
// Bellman recursion as this slide's spine and walked four "moves" over it — "That is the whole method", "Our
// reward is gross return minus...". The owner stopped it:
//
//   "well, now you are being too precise. we dont know how to solve this problem yet. it's an open problem. so
//    dont write out that equation as if it's known. it's not. i only have some ideas how to attack this, from
//    RL, with math, or, stochastic process, probability, as the backbone."
//
// He is right, and the error was structural rather than a matter of wording. Writing the recursion as an
// equality, on the slide labelled "the method", asserts a formulation AND a solution. Neither is in hand. It
// was redundant besides: the difficulty slide already shows that recursion as the thing that blows up.
//
// So the slide now says what is true — large pieces are solved exactly, the whole of it at this size is not —
// and names where the attack would go. The owner's own four words map onto the four moves below: probability
// and stochastic processes are the BACKBONE, mathematics (convexity, duality, certificates) and reinforcement
// learning are the two attacks standing on it, and the fourth is his own preprint, located as one attempt.
//
// HONESTY RULES THIS COPY IS HELD TO, and a test asserts each:
//   * nothing may claim the problem is solved, or that a working method exists
//   * every move carries its own LIMIT, on the slide, not hidden in a footnote
//   * the PhD is incoming — never present tense
//   * arXiv:2508.11856 is a PREPRINT, never "published"
//   * every named result and date is real and checkable; every figure about the paper is corroborated by
//     profile.ts, which transcribes its Table 2 (67 periods, 2020-02-29 -> 2025-08-31)
//   * under-claiming is also a failure. "It is hard and I have ideas" would be worthless — each direction
//     carries specific, checkable content or it does not belong on the slide.
export interface AttackMove {
  key: 'backbone' | 'structure' | 'learning' | 'attempt';
  /** The discipline, in the owner's own terms — the small tag above the name on the selector. */
  tag: string;
  /** The selector label. */
  name: string;
  /** One line: the move's claim. */
  lede: string;
  /** The substance. Specific and checkable, or it does not belong here. */
  detail: string;
  /** What this direction does NOT give you. Shown on the slide, which is the whole point. */
  limit: string;
  /** What the lattice is evidence of while this move is live. Never the word "solved". */
  read: string;
}

export const ATTACK_MOVES: AttackMove[] = [
  {
    key: 'backbone',
    tag: 'stochastic process · probability',
    name: 'the backbone',
    lede: 'The expectation has to be taken over something, and that choice decides what is solvable.',
    detail:
      'It is the process together with the objective — never the solver — that decides whether a closed form exists. Independent returns, no costs, no constraints, and twenty-four dates collapse into twenty-four copies of one date (Mossin 1968, Samuelson 1969). Linear dynamics with quadratic costs, and the optimal policy is linear at any number of names (Gârleanu–Pedersen 2013).',
    limit:
      'It supplies no algorithm, and it cannot deliver the drift: finer sampling pins down variance and does almost nothing for the mean (Merton 1980). Variance does not add across time either, so one stated preference gives different portfolios depending on when you commit to it.',
    read: 'The surface fills backward from the horizon — and it exists because this world’s tilt was written down in advance.',
  },
  {
    key: 'structure',
    tag: 'convex optimisation · duality',
    name: 'the certificate',
    lede: 'Where the structure is convex, ask for a certificate and not just an answer.',
    detail:
      'One date, three thousand names, thousands of convex rules is a convex program: a global optimum, exact feasibility, and a shadow price saying what each rule cost. The m^1.5 impact from the last slide does not spoil it — that function is convex. Production rolls the solve forward: optimise a short path, trade only today, re-solve tomorrow (Boyd et al. 2017).',
    limit:
      'A tower of certified single-date solves is not a certified policy, and prices no value of waiting. Convexity ends at cardinality limits, minimum sizes and round lots — that selection problem is NP-hard. And a certificate is precision, not accuracy: an exact optimum of an estimated covariance loads where the estimate is most wrong (Michaud 1989).',
    read: 'An answer for every state, exactly: 108 decisions, 972 comparisons, 29 stated rivals drawn behind it.',
  },
  {
    key: 'learning',
    tag: 'reinforcement learning',
    name: 'learning, kept small',
    lede: 'Put the learning where the dimension is small enough for the data that exists.',
    detail:
      'Reinforcement learning has a real home here, narrower than the literature suggests: execution and hedging under frictions, where the horizon is minutes and the data is millions of decisions a day (Nevmyvaka et al. 2006; Buehler et al. 2019). Monthly whole-book allocation has none of that — a decade is about a hundred and twenty decisions along one path that never repeats.',
    limit:
      'So it relocates the curse of dimensionality rather than beating it. With function approximation there is no computable distance to the optimum, and constrained-MDP methods buy feasibility in expectation — for a compliance limit, “usually satisfied” is not satisfied.',
    read: 'One route, read off a surface filled exactly, node by node. Fit the surface instead and no node is checkable again.',
  },
  {
    key: 'attempt',
    tag: 'arXiv:2508.11856',
    name: 'one attempt',
    lede: 'RL-BHRP is one attempt at one piece of this — a preprint, so it can be checked.',
    detail:
      'Co-authored with S. Kang. The useful idea is structural: make the hierarchy the unit of decision, so the learned layer chooses in sector space instead of emitting three thousand weights, and risk parity needs a covariance and no expected returns at all. Evaluated out of sample over sixty-seven monthly rebalances, February 2020 to August 2025.',
    limit:
      'Risk parity over a hierarchy is a heuristic with no optimality property, so a learned layer inside it inherits no bound. And it was not measured against a tuned myopic-plus-turnover rule or a Gârleanu–Pedersen aim policy: naming the bar I have not cleared is the point of putting it here.',
    read: 'The optimum of a world handed to the solver complete. Nothing on this surface is evidence about a market.',
  },
];

/** The heading: precise about what is and is not settled. */
export const OPEN_HEADING = 'Large pieces of this are solved. The whole of it, at this size, is not.';

/**
 * The precise statement of what is missing — the sentence the whole slide rests on.
 *
 * Deliberately NOT "nobody knows anything": Merton 1969, Davis–Norman 1990, Almgren–Chriss 2000 and
 * Gârleanu–Pedersen 2013 are real closed forms and the dates are old. What is absent is the pairing.
 */
export const OPEN_STATEMENT =
  'What is missing is not the equation. It is an objective everyone agrees on across time, a law of motion you can identify from one short history that never repeats, and a policy that runs at three thousand names while carrying a bound on how far from optimal it sits. At one date you can have scale and a certificate. Across twenty-four, nobody has shown how.';

/** The closing line, under the selector. */
export const OPEN_CLOSE =
  'None of this is a method yet: three directions with known failure modes, one backbone they share, and one attempt on the record.';
