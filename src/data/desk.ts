// src/data/desk.ts
// THE DESK AS THE SITE DESCRIBES IT: what a real mandate forbids, how big the problem is, and what an
// attempt on it would be assembled from.
//
// CONSTRAINTS and FUND feed src/sections/Rules.astro; METHODOLOGIES and the OPEN_* copy feed
// src/sections/Solve.astro. (An invented six-ticker dataset and its 48-trader Monte Carlo were deleted: no page
// rendered them. Choice's five named policies are data/define.ts's, which states its own numbers' status.)

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

/** ONE RULE PER GROUP, and Rules.astro renders every entry: beat two names four KINDS of rule rather than
 *  examples of one kind — the owner asked for "a few", and four kinds is the more informative reading.
 *  tests/ruleGlyphs.test.ts holds the groups to one entry each. */
export const CONSTRAINTS: Constraint[] = [
  {
    group: 'Mandate',
    rule: 'Max drawdown 8%, measured peak-to-trough on a rolling basis',
    why: 'Breach it and investors redeem, which forces selling at exactly the wrong moment.',
  },
  {
    group: 'Regulatory',
    rule: 'Position disclosure above 5% of a company’s shares outstanding',
    why: 'Crossing it publishes your hand and constrains how you can exit.',
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

/**
 * Fund-scale figures, declared — and ONLY the ones something reads: Rules.astro prints `tickers` and
 * `constraints` through lib/problemSize.ts's humanCount and derives its DP state-count exponent from `tickers`.
 *
 * The $1B and the 8% drawdown reach the page as prose inside CONSTRAINTS above, not as fields here: a second,
 * unread copy is how one slide comes to state two numbers for the same fact. tests/problemSize.test.ts pins
 * the key set, so a field added here comes with its reader.
 */
export const FUND = {
  tickers: 3000,
  constraints: 2000,
};

// ── THE LAST SLIDE: STILL AN OPEN PROBLEM, AND A FEW GENERAL DIRECTIONS ──────────────────────────────────
//
// THE OWNER'S TWO CORRECTIONS, verbatim, because they are why the slide has no equation and no survey.
// The slide once typeset the Bellman recursion as its spine ("That is the whole method"). The owner:
//
//   "we dont know how to solve this problem yet. it's an open problem. so dont write out that equation as if
//    it's known. it's not. i only have some ideas how to attack this, from RL, with math, or, stochastic
//    process, probability, as the backbone."
//
// Then four directions, each with a dated literature and a limit block, read as a survey of a field the slide
// had just called open. The owner again:
//
//   "i wouldnt say this as solved. probably at first we can only solve a small chunk of it. in the future maybe
//    we can do more. so my idea is that we only name a few methodologies only general ones to begin with.
//    thats more truthful. so the entire headline should be something like: Still an open problem. in the tabs,
//    we list a few viable methodologies. that's it. we dont need to go that deep. you can also drop the first
//    one attempt. that's what work is for."
//
// So the heading states the openness outright, and the tabs name a few general methodologies (four; see
// METHODOLOGIES), each in a couple of plain sentences rather than a reading list. No RL-BHRP tab: the paper is
// work, the work section is where work goes, and naming an attempt here would imply it closed part of it.
//
// The restraint is the honesty here. A general direction, plainly stated, cannot overclaim; a survey with dates
// on it starts to sound like a solution assembled from parts.
export interface Methodology {
  key: 'probability' | 'estimation' | 'optimisation' | 'control';
  /** The role this family plays — the small tag above the name on the selector. */
  tag: string;
  /** The selector label. */
  name: string;
  /** One line: what this brings. */
  lede: string;
  /** Two or three plain sentences. The last one says what it does not settle — kept in the prose rather than a
   *  labelled block, because a labelled block is what made an earlier version read as a survey. */
  detail: string;
  /** What the lattice is evidence of while this direction is live. Never the word "solved". */
  read: string;
}

/**
 * FOUR GENERAL FAMILIES, and explicitly not the whole toolbox.
 *
 * The owner, on a list of three: "probability + convex optimization + rl might just be tools to do this. but
 * there are more right? i dont think only these 3 actually." So the list adds ESTIMATION (where most real damage
 * happens) and the integer side of optimisation (what a rule book forces), and the thesis says outright it is
 * not a full toolbox. Reinforcement learning sits inside "stochastic control": for this problem RL is
 * approximate dynamic programming, not a separate idea.
 *
 * Left out on purpose, and it is worth knowing what: robust and distributionally-robust optimisation,
 * simulation and scenario generation, filtering for regime estimation, time-series econometrics, multiple-
 * testing correction. Each is real. Naming them all would be the survey the owner already rejected — hence the
 * thesis saying "a few of", which is what makes the omission honest rather than a claim of completeness.
 */
export const METHODOLOGIES: Methodology[] = [
  {
    key: 'probability',
    tag: 'the backbone',
    name: 'probability, stochastic processes',
    lede: 'You cannot optimise against a future you have not described.',
    detail:
      'Before any solver there has to be a model of how prices and risk move: drift, volatility, how names move together, and how all of that changes through time. Everything else here is built on top of whatever goes in that slot. Choosing it is a modelling decision, not a technical one, and it is rarely the part that gets argued about.',
    read: 'The surface exists because this world’s movement was written down in advance. A real book’s has to be estimated.',
  },
  {
    key: 'estimation',
    tag: 'the inputs',
    name: 'statistics, estimation',
    lede: 'The model has to be fitted, and that is where most of the damage happens.',
    detail:
      'A full covariance over three thousand names carries about four and a half million free parameters, and needs more observations than there are names before it can even be inverted — roughly twelve years of daily data. Shrinkage, factor structure and Bayesian priors are how that is made usable at all. Expected returns are worse: they matter most and are estimated least well.',
    read: 'Every number behind this surface was chosen, not measured. That is the difference between a toy and a book.',
  },
  {
    key: 'optimisation',
    tag: 'the mathematics',
    name: 'convex and integer optimisation',
    lede: 'Where the problem is convex, the answer comes with a proof attached.',
    detail:
      'For a single date, thousands of names and thousands of convex rules, this part is settled and industrial: a global optimum, exact feasibility, and a price for every constraint that binds. Position counts, minimum sizes and round lots break convexity and turn it into an integer problem, which is where the guarantees stop and the search begins.',
    read: 'An answer for every state on the surface, exactly — and 29 stated rivals drawn behind it.',
  },
  {
    key: 'control',
    tag: 'the sequence',
    name: 'stochastic control, learning',
    lede: 'The decisions are a sequence, and the sequence is what makes it hard.',
    detail:
      'Dynamic programming is the frame for weighing a trade now against what it costs later. At this size it cannot be solved as written, so what is usable are its approximations: roll a short horizon forward and re-solve, or fit a policy from simulated experience rather than tabulating one, which is what reinforcement learning is doing here. Both buy scale and give up the bound on how far from optimal you are.',
    read: 'One route, read off a surface filled exactly, node by node. Fit the surface instead and no node is checkable again.',
  },
];

/** The heading, in the owner's own words. */
export const OPEN_HEADING = 'Still an open problem.';

/**
 * WHAT IS MISSING, and nothing about what is realistic: a sentence on what is achievable has no evidence behind
 * it (the owner asked), and is the kind of claim this slide exists to avoid. The disclaimer it carries instead:
 * these are a few of the families, not all of them.
 */
export const OPEN_STATEMENT =
  'No one has a method for the whole of it at this size — one that runs at three thousand names and still tells you how far from optimal it is. What follows is not a plan and not a full toolbox: a few of the general families any attempt would be assembled from.';

/** The closing line. Points at where the actual work is, since the paper is not a tab here. */
export const OPEN_CLOSE =
  'Directions, not results, and not a complete list. What has actually been built is further down, under the work.';
