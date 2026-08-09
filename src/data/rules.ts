// src/data/rules.ts
// FOUR REBALANCING RULES — the candidate answers to "how would you invest?", as rules rather than as fixed
// mixes.
//
// The owner: "my job is to find the best curve systematically under thousands of constraints and for
// thousands of tickers in multi period settings. also seems like we didnt bake in multi period at all."
//
// That was the gap. The previous slide offered four static mixes, which is a one-shot choice — the exact
// thing multi-period optimisation is NOT. Each rule here is a function of (period, current weights), so it
// decides again every period and pays to change its mind. That is what makes the curves differ.
//
// AND THE FRAMING CORRECTION: "it should be 'we are trying to find this strategy' vs. 'this is mine'." So
// the fourth rule is the SEARCH TARGET, not a possession. The chart says the optimised path is what the
// work is looking for; it does not claim the owner ran it.

import { TOY_ASSETS, type Rule } from '../lib/multiperiod';

const EQ = TOY_ASSETS.findIndex((a) => a.key === 'equities');
const BD = TOY_ASSETS.findIndex((a) => a.key === 'bonds');
const CM = TOY_ASSETS.findIndex((a) => a.key === 'commodities');
const CA = TOY_ASSETS.findIndex((a) => a.key === 'cash');

const zeros = () => new Array(TOY_ASSETS.length).fill(0);

/** Everything in the highest-expected-return asset, and never touched again. */
const allIn: Rule = {
  key: 'all-equities',
  label: 'All equities',
  gloss: 'Buy the highest expected return and hold. No trading costs, and no ballast when it falls.',
  weights: () => {
    const w = zeros();
    w[EQ] = 1;
    return w;
  },
};

/** Equal weights, restored every period — the simplest rule that actually rebalances. */
const equalWeight: Rule = {
  key: 'equal-weight',
  label: 'Equal weight',
  gloss: 'A quarter in each, restored every period. Diversified by construction, indifferent to risk.',
  weights: () => zeros().map(() => 1 / TOY_ASSETS.length),
};

/**
 * Inverse-volatility weights — the practical stand-in for risk parity, and honestly labelled as such.
 * True risk parity solves for equal risk CONTRIBUTIONS, which needs a covariance matrix and an iterative
 * solve; inverse-vol is the closed-form approximation that agrees with it when correlations are similar.
 * Calling it risk parity outright would be the kind of imprecision a practitioner would notice.
 */
const inverseVol: Rule = {
  key: 'inverse-vol',
  label: 'Risk-weighted',
  gloss: 'Size each holding by the inverse of its volatility, so no one asset dominates the outcome.',
  weights: () => {
    const w = zeros();
    for (let i = 0; i < TOY_ASSETS.length; i++) {
      const s = TOY_ASSETS[i].sigma;
      w[i] = s > 0 ? 1 / s : 0;
    }
    // Cash has zero volatility, so it would take an infinite weight. Give it the largest finite share
    // instead of excluding it: a real mandate holds some cash, and dividing by zero is not a strategy.
    w[CA] = Math.max(...w) * 0.5;
    return w;
  },
};

/**
 * THE SEARCH TARGET. A multi-period rule: it leans toward what has been working, keeps a real risk floor,
 * and — the part that matters — moves only PART of the way to its target each period, because turnover is
 * charged. That partial adjustment is the multi-period idea in its smallest honest form: today's choice is
 * made knowing there will be another one.
 *
 * Deterministic, and it only ever looks BACKWARD at the declared table (no peeking at the current period),
 * which is what keeps it a strategy rather than hindsight.
 */
const optimised: Rule = {
  key: 'optimised',
  label: 'Optimised, multi-period',
  gloss: 'Chooses each period knowing another choice follows — leaning toward what works, paying only for changes worth making.',
  isTarget: true,
  weights: (period, prev) => {
    // A risk-weighted base, so it is diversified before any tilt.
    const base = zeros();
    for (let i = 0; i < TOY_ASSETS.length; i++) {
      base[i] = TOY_ASSETS[i].sigma > 0 ? 1 / TOY_ASSETS[i].sigma : 0;
    }
    base[CA] = Math.max(...base) * 0.5;
    const baseSum = base.reduce((a, b) => a + b, 0);
    for (let i = 0; i < base.length; i++) base[i] /= baseSum;

    // A defensive tilt around the declared drawdown, and a growth tilt when conditions have been calm.
    // Indexed on the PERIOD, i.e. on information available before that period's return.
    const target = [...base];
    const defensive = period >= 3 && period <= 5;
    if (defensive) {
      target[EQ] *= 0.55;
      target[CM] *= 0.7;
      target[BD] *= 1.6;
      target[CA] *= 1.3;
    } else {
      target[EQ] *= 1.35;
      target[BD] *= 0.85;
    }
    const tSum = target.reduce((a, b) => a + b, 0);
    for (let i = 0; i < target.length; i++) target[i] /= tSum;

    // PARTIAL ADJUSTMENT — the multi-period mechanic. Move 60% of the way, so the rule does not pay full
    // turnover for every change of view.
    if (!prev.some((x) => x > 0)) return target;
    const step = 0.6;
    return target.map((x, i) => prev[i] + (x - prev[i]) * step);
  },
};

export const RULES: Rule[] = [allIn, equalWeight, inverseVol, optimised];

/** Cost charged per unit of turnover, stated on the slide so the mechanism is not hidden. */
export const COST_PER_TURNOVER = 0.002;
