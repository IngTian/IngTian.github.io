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
export const TOOLKIT: { name: string; role: string }[] = [
  { name: 'Convex optimization', role: 'the objective and thousands of constraints, with a solution you can certify rather than hope for' },
  { name: 'Multi-period / dynamic programming', role: 'the schedule of decisions, where today’s trade is priced against tomorrow’s options' },
  { name: 'Risk models & decomposition', role: 'where the risk actually sits — by factor, sector and name — before deciding what to change' },
  { name: 'Transaction-cost modelling', role: 'what your own size costs you, which is what makes $1B different from $1M' },
  { name: 'Reinforcement learning', role: 'how exposures adapt as conditions shift, once the structure around it is fixed' },
  { name: 'Out-of-sample testing', role: 'the part that decides whether any of it was real' },
];
