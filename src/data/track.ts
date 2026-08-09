// src/data/track.ts
// THE THREE STRATEGIES THE PAPER COMPARES — real published figures, nothing invented.
//
// The owner's brief: "just show the pnl graph of several strategies, pick the highest one to be mine and
// highlight it with the highest pnl and the highest sharpe/sortino. that's it."
//
// The honest version of that is not a drawn chart with a flattering line labelled "mine" — it is THIS,
// because the comparison already exists as published results. Every figure below is transcribed from the
// metrics table of RL-BHRP (arXiv:2508.11856), the same table /research renders verbatim, which is also
// the single source these numbers can be checked against.
//
// Transcribed from profile.ts's `publications[0].metrics`, which is the site's existing source of truth:
//   metric               RL-BHRP   BHRP    Benchmark
//   Cumulative return    1.20      1.01    0.91
//   CAGR                 15.2%     13.4%   12.3%
//   Annual volatility    17.4%     16.5%   17.3%
//   Sharpe               0.90      0.85    0.76
//   Sortino              1.65      1.53    1.37
//   Max drawdown        -20.3%    -19.1%  -18.3%
//
// NOTE ON WHAT IS NOT HERE: no return series. The paper publishes endpoints and rates, not a path, so
// lib/growth.ts draws smooth compounding at the published CAGR and the caption says exactly that. A
// bumpy "equity curve" would look more convincing and would be fiction.

import type { Strategy } from '../lib/growth';

/** Out-of-sample window from the paper: 2020-02 to 2025-08. */
export const WINDOW_LABEL = 'out-of-sample · 2020-02 to 2025-08';
export const WINDOW_YEARS = 5.5;

export const STRATEGIES: Strategy[] = [
  {
    key: 'rl-bhrp',
    label: 'RL-BHRP',
    cumulative: 1.20,
    cagr: 0.152,
    vol: 0.174,
    sharpe: 0.90,
    sortino: 1.65,
    maxDrawdown: -0.203,
    isMine: true,
  },
  {
    key: 'bhrp',
    label: 'BHRP, static',
    cumulative: 1.01,
    cagr: 0.134,
    vol: 0.165,
    sharpe: 0.85,
    sortino: 1.53,
    maxDrawdown: -0.191,
  },
  {
    key: 'benchmark',
    label: 'Sector benchmark',
    cumulative: 0.91,
    cagr: 0.123,
    vol: 0.173,
    sharpe: 0.76,
    sortino: 1.37,
    maxDrawdown: -0.183,
  },
];

/** What the chart is, stated on the chart. "Compounded at the published CAGR" rather than "equity curve",
 *  because the second would imply a simulated path the paper does not publish. */
export const TRACK_CAPTION =
  'Growth of one unit, compounded at each strategy’s published CAGR. From the paper’s out-of-sample results — not a simulated path.';

/** The claim, made only where the data supports it. Drawdown is deliberately absent: RL-BHRP does NOT
 *  lead on it (−20.3% against −18.3%), and tests/growth.test.ts asserts that, so the copy can never
 *  quietly drift into claiming risk superiority it does not have. */
export const TRACK_CLAIM = 'Highest cumulative return, highest Sharpe, highest Sortino of the three.';
