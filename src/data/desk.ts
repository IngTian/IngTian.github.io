// src/data/desk.ts
// THE DESK AS THE SITE DESCRIBES IT: what a real mandate forbids, how big the problem is, and what an
// attempt on it would be assembled from.
//
// WHAT LEFT THIS FILE, so nobody rebuilds it. It opened with a "concrete example" dataset — six real tickers
// (AAPL, NVDA, META, BAC, XAUUSD, WTI) with invented drifts and vols, six invented news headlines with a
// per-ticker shock each, a 48-path trader count, and a disclaimer sentence about the whole thing being made
// up. All of it fed one consumer: the 48-trader Monte Carlo in lib/scenario.ts, which no page renders. The
// slide that argues "same year, different decisions, different outcome" is src/sections/Choice.astro, and it
// reads data/define.ts — five NAMED policies over four holdings — because a reader can say out loud what
// separates five curves and cannot say anything at all about forty-eight.
//
// The disclaimer went with the data and that is the right direction, not a loss of honesty: the invented
// figures it disclaimed no longer exist. data/define.ts carries its own statement about its own numbers,
// next to the numbers, which is where such a sentence belongs.
//
// What remains is all live: CONSTRAINTS and FUND feed src/sections/Rules.astro, METHODOLOGIES and the OPEN_*
// copy feed src/sections/Solve.astro.

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

/**
 * Fund-scale figures, declared — and ONLY the ones something reads.
 *
 * `tickers` and `constraints` reach the page: Rules.astro prints both through lib/problemSize.ts's humanCount
 * and derives its DP state-count exponent from `tickers`.
 *
 * `periods` NO LONGER REACHES ANY PAGE, and this comment used to say it did. It fed lib/complexity.ts's
 * decisionVariables and scenarioLeaves in Rules.astro until that slide's tally draft was replaced by the
 * conflict web (the reason is at the beat-four comment in Rules.astro); the two calls went when noUnusedLocals
 * surfaced them. Its only remaining reader is tests/complexity.test.ts, which asserts those helpers against
 * real fund scale rather than toy numbers — a reader worth having, but a TEST, not a rendered fact. It is kept
 * deliberately on that basis and not by oversight: dropping it is a live option that costs that assertion its
 * real-scale input and needs edits in two test files, so it is the owner's call rather than a side effect of a
 * typecheck fix. By the rule this comment opens with, it is the one field here on probation.
 *
 * Two more fields used to sit here — `aum: '$1B'` and `drawdownLimit: 0.08` — with no reader anywhere. Both
 * facts DO reach the page, as prose inside the CONSTRAINTS entries above ("Max drawdown 8%…", "At $1B, your
 * own order moves the price…"), so the unread copies bought nothing and risked something: the day one is
 * edited and the other is not, the same slide states two different numbers for the same fact. Adding a field
 * back means adding its reader in the same change — tests/problemSize.test.ts asserts the key set for that
 * reason.
 */
export const FUND = {
  tickers: 3000,
  constraints: 2000,
  periods: 24,
};

// TWO COPY BLOCKS LEFT HERE TOO: JOB_STATEMENT ("Find a strategy that optimises a sequence of decisions…")
// and JOB_NOTE (the Sharpe gloss). Neither had appeared on the site in any build — `grep -c 'optimises a
// sequence of decisions' dist/index.html` returned 0 — because the sections that once framed the job were
// rewritten around their own inline copy. Unrendered prose in a data file is the worst kind of stale: it
// reads like the site's current voice on a claim the site may no longer make, and an editor fixing the page's
// wording never sees it. If the framing is wanted again it should be written next to the markup that shows it.

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
 * An earlier version listed three — probability, convex optimisation, reinforcement learning — and the owner
 * pushed back: "probability + convex optimization + rl might just be tools to do this. but there are more
 * right? i dont think only these 3 actually."
 *
 * He is right, and there were two separate faults. The list was short of things that genuinely matter (nothing
 * about ESTIMATION, which is where most real damage happens; nothing about the integer side of optimisation,
 * which is what a rule book actually forces), and it was FRAMED as though it were complete, which is the worse
 * of the two. The fix does both: a fourth family, and a thesis that says outright this is not a full toolbox.
 *
 * Reinforcement learning now sits inside "stochastic control" rather than standing alone, which is also more
 * truthful about it: for this problem RL is approximate dynamic programming, not a separate idea.
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
 * WHAT IS MISSING, and nothing about what is realistic.
 *
 * An earlier version said "The realistic ambition is a chunk: solve a small part properly, then widen." The
 * owner asked for evidence for it and there is none — it was my editorialising dressed as a finding, and a
 * confident sentence about what is achievable is exactly the kind of thing this slide exists to avoid. Dropped.
 *
 * What replaces it is the honest disclaimer the list needs: these are a few of the families, not all of them.
 */
export const OPEN_STATEMENT =
  'No one has a method for the whole of it at this size — one that runs at three thousand names and still tells you how far from optimal it is. What follows is not a plan and not a full toolbox: a few of the general families any attempt would be assembled from.';

/** The closing line. Points at where the actual work is, since the paper is not a tab here. */
export const OPEN_CLOSE =
  'Directions, not results, and not a complete list. What has actually been built is further down, under the work.';
