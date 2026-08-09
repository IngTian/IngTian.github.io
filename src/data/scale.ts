// src/data/scale.ts
// WHY IT IS HARD — the size of the real problem, computed rather than asserted.
//
// The owner: "my job is to find the best curve systematically under thousands of constraints and for
// thousands of tickers in multi period settings." And on the purpose of these slides: "our job is to
// illustrate 1. what this topic is 2. why is it important and hard 3. what's my job."
//
// The hardness is the part a reader with no finance background cannot guess, and it is not a matter of
// opinion — it is arithmetic. The teaching example on the previous slide chooses 4 weights, once. The real
// problem chooses a weight for every ticker in every period, subject to thousands of constraints, and every
// choice changes what the next one costs. So this file states both sizes and lets the ratio do the work.
//
// Every number below is either a declared problem size or derived from one by arithmetic that
// lib/problemSize.ts performs and tests verify. Nothing here is a claim about results.

/** The toy problem the previous slide teaches with. */
export const TOY = {
  assets: 4,
  periods: 12,
  label: 'The example on the last slide',
};

/** A realistic institutional problem. Round, conservative figures — the point is the order of magnitude. */
export const REAL = {
  tickers: 3000,
  periods: 24,
  constraints: 2000,
  label: 'A real mandate',
};

/** What makes it hard, in three sentences a non-specialist can follow. */
export const HARD_POINTS: { head: string; body: string }[] = [
  {
    head: 'The choices multiply',
    body:
      'One weight per holding is a list. One weight per holding per period is a schedule, and the number of ' +
      'possible schedules grows faster than anyone can search by hand — there is no list of candidates to ' +
      'rank, only a continuous space to move through.',
  },
  {
    head: 'The rules bite',
    body:
      'Sum to one. Nothing negative. No more than x% in one sector, or one issuer, or one country. Enough ' +
      'liquidity to exit. Thousands of such rules, each cutting the space of legal answers — and a rule you ' +
      'satisfy today can be violated by tomorrow\'s price move.',
  },
  {
    head: 'Today prices tomorrow',
    body:
      'Every trade costs money, so a decision is only worth making if it is still right after the cost of ' +
      'making it. That couples the periods together: you cannot solve each one and staple the answers ' +
      'together, because the best move now depends on what you expect to do next.',
  },
];

/** WHAT THE JOB IS, once the difficulty is on the table. */
export const JOB_HEAD = 'My job is to find the best schedule in that space, systematically.';

export const JOB_BODY: string[] = [
  'Not to guess a portfolio and defend it afterwards. To state the objective and every constraint as ' +
  'mathematics, then find the allocation that provably satisfies them — and to be able to show why that ' +
  'answer, and not another.',

  'Operations research supplies the structure: convexity, duality, the conditions that make a solution ' +
  'certifiable rather than merely plausible. Machine learning is a tool inside it, for the part classical ' +
  'methods assume away — how the exposures should adapt as conditions change.',
];

/** The instruments, named as instruments. */
export const JOB_TOOLS: { name: string; role: string }[] = [
  { name: 'Convex optimization', role: 'the objective, the constraints, and a solution you can certify' },
  { name: 'Multi-period formulation', role: 'the schedule, not a sequence of unrelated snapshots' },
  { name: 'Risk decomposition', role: 'where the risk actually sits before deciding what to change' },
  { name: 'Reinforcement learning', role: 'how exposures adapt, once the structure is fixed' },
];
