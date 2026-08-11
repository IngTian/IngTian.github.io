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


// ── THE LAST SLIDE: STILL AN OPEN PROBLEM, AND A FEW GENERAL DIRECTIONS ──────────────────────────────────
//
// THIS FILE HAS BEEN WRONG TWICE, in opposite directions, and both corrections belong here.
//
// First it typeset the Bellman recursion as this slide's spine and walked four "moves" over it — "That is the
// whole method". The owner:
//
//   "we dont know how to solve this problem yet. it's an open problem. so dont write out that equation as if
//    it's known. it's not. i only have some ideas how to attack this, from RL, with math, or, stochastic
//    process, probability, as the backbone."
//
// The fix went too far the other way: four directions, each with a named-and-dated literature and a labelled
// limit block. Accurate, but it read as a survey of a field the slide had just called open. The owner again:
//
//   "i wouldnt say this as solved. probably at first we can only solve a small chunk of it. in the future maybe
//    we can do more. so my idea is that we only name a few methodologies only general ones to begin with.
//    thats more truthful. so the entire headline should be something like: Still an open problem. in the tabs,
//    we list a few viable methodologies. that's it. we dont need to go that deep. you can also drop the first
//    one attempt. that's what work is for."
//
// So: the heading states the openness outright, the tabs name THREE GENERAL methodologies — the three families
// he named himself — and each gets a couple of plain sentences rather than a reading list. The RL-BHRP tab is
// gone: the paper is work, and the work section is where work goes. Naming a published attempt on a slide about
// an open problem also quietly implied the attempt had closed part of it.
//
// The restraint is the honesty here. A general direction, plainly stated, cannot overclaim; a survey with dates
// on it starts to sound like a solution assembled from parts.
export interface Methodology {
  key: 'probability' | 'optimisation' | 'learning';
  /** The discipline, as the owner named it — the small tag above the name on the selector. */
  tag: string;
  /** The selector label. */
  name: string;
  /** One line: what this brings. */
  lede: string;
  /** Two or three plain sentences. The last one says what it does not settle — kept in the prose rather than a
   *  labelled block, because a labelled block is what made the previous version read as a survey. */
  detail: string;
  /** What the lattice is evidence of while this direction is live. Never the word "solved". */
  read: string;
}

export const METHODOLOGIES: Methodology[] = [
  {
    key: 'probability',
    tag: 'the backbone',
    name: 'probability, stochastic processes',
    lede: 'You cannot optimise against a future you have not described.',
    detail:
      'Before any solver there has to be a model of how prices and risk actually move: drift, volatility, how names move together, and how all of that changes. Everything else on this slide is built on top of whatever goes here. It is also where the deepest problem sits, because a model fitted on one short history is a statement about that history.',
    read: 'The surface exists because this world’s movement was written down in advance. A real book’s has to be estimated.',
  },
  {
    key: 'optimisation',
    tag: 'the mathematics',
    name: 'convex optimisation',
    lede: 'Where the problem is convex, the answer comes with a proof attached.',
    detail:
      'For a single date, thousands of names and thousands of rules, this is settled and industrial: a global optimum, exact feasibility, and a price for every constraint that binds. It is the part of the problem that is genuinely solved. What it does not do on its own is span the sequence of dates, which is where the difficulty was.',
    read: 'An answer for every state on the surface, exactly — and 29 stated rivals drawn behind it.',
  },
  {
    key: 'learning',
    tag: 'the adaptation',
    name: 'reinforcement learning',
    lede: 'Where the structure runs out, learn a policy instead of tabulating one.',
    detail:
      'Rather than filling a table that cannot exist, fit the decision rule from simulated experience and let it improve against the model. That is what makes a problem this size approachable at all. It buys scale and gives up the guarantee: there is no bound on how far the result sits from optimal, which is the one thing a mandate asks for.',
    read: 'One route, read off a surface filled exactly, node by node. Fit the surface instead and no node is checkable again.',
  },
];

/** The heading, in the owner's own words. */
export const OPEN_HEADING = 'Still an open problem.';

/**
 * The modest version of the ambition, which is the one he asked for: a chunk first, more later.
 *
 * Deliberately does NOT say anything is solved. An earlier heading opened "Large pieces of this are solved" and
 * he rejected exactly that: "i wouldnt say this as solved."
 */
export const OPEN_STATEMENT =
  'No one has a method for the whole of it at this size — one that runs at three thousand names and still tells you how far from optimal it is. The realistic ambition is a chunk: solve a small part properly, then widen. These are the general directions worth starting from.';

/** The closing line. Points at where the actual work is, since the paper is no longer a tab here. */
export const OPEN_CLOSE =
  'Directions, not results. What has actually been built is further down, under the work.';
