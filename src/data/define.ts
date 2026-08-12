// src/data/define.ts
// DEFINING THE TERM, in the order a stranger needs it.
//
// The owner: "I prefer saying it out loud with 'What is multi-period blablabla?' … I think it's best
// illustrated with an example. Very concrete example. Maybe we can't even state this in one slide. Maybe we
// can first explain what is portfolio optimization?"
//
// The audit that made this necessary: the slide opened with "Every month, decide how much of each to own",
// which ASSUMES the concept. Nowhere on the page did anything say what a portfolio is, what optimising one
// means, or what "multi-period" adds to it. A reader with no finance background had no way in.
//
// ONE SLIDE CAN CARRY BOTH TERMS, but only if the EXAMPLE does the defining and the prose only labels what is
// already visible. So the structure is three beats over one object:
//   1. a portfolio IS this — $100 split across four things you have heard of
//   2. optimising it is choosing the split, and the split has consequences
//   3. multi-period is that you must choose again, and the last choice constrains the next
// Each beat is one short line, because a definition that runs to a paragraph has failed at being a
// definition.
//
// The money is $100 rather than a percentage: a share of an unnamed total is an abstraction, and $100 split
// four ways is something anyone can hold in their head.

export interface Beat {
  /** The term being defined, in the reader's words rather than the field's. */
  ask: string;
  /** The answer, in one sentence. */
  say: string;
  /** What the drawing is doing while this beat is on screen. */
  showing: string;
}

export const BEATS: Beat[] = [
  {
    ask: 'What is a portfolio?',
    say: 'A hundred dollars, split across things you could own. That is all. The split IS the portfolio.',
    showing: 'one bar, divided four ways',
  },
  {
    ask: 'So what is optimising it?',
    say: 'Choosing the split — and the choice matters, because each thing behaves differently when the news lands.',
    showing: 'the same hundred dollars, split three other ways',
  },
  {
    ask: 'And multi-period?',
    say: 'You do not choose once. A month later the world has moved and you choose again — from where the last choice left you, paying to change your mind.',
    showing: 'the split re-chosen, month after month',
  },
];

/** The four things the money is split across. Deliberately recognisable rather than representative: a reader
 *  who knows nothing about markets still knows what a bank and a bar of gold are. */
export interface Holding {
  ticker: string;
  plain: string;
  glyph: string;
  /** Weight in the opening split, as a percentage of $100. */
  weight: number;
}

export const HOLDINGS: Holding[] = [
  { ticker: 'NVDA',   plain: 'a chipmaker',  glyph: 'chip', weight: 40 },
  { ticker: 'AAPL',   plain: 'a phone maker', glyph: 'tech', weight: 25 },
  { ticker: 'BAC',    plain: 'a bank',       glyph: 'bank', weight: 20 },
  { ticker: 'XAUUSD', plain: 'gold',         glyph: 'gold', weight: 15 },
];

/** Three alternative splits of the same $100, to make "the choice matters" visible rather than asserted.
 *  Weights only — what each one is FOR is the label. */
export interface Split {
  label: string;
  note: string;
  weights: number[];
}

export const SPLITS: Split[] = [
  { label: 'All in on one', note: 'the most upside, and the most to lose', weights: [100, 0, 0, 0] },
  { label: 'Even quarters', note: 'simple, and it ignores that they differ', weights: [25, 25, 25, 25] },
  { label: 'Mostly safe',   note: 'sleeps at night, gives up the upside',   weights: [10, 15, 25, 50] },
];

/** The headline the second beat reacts to — one event, so the consequence of a split is legible. */
export const EVENT = {
  when: 'Then one Tuesday',
  what: 'the chipmaker misses. Its shares fall a fifth; gold ticks up.',
  /** Per-holding move, in the order of HOLDINGS. */
  moves: [-0.20, -0.04, 0.01, 0.03],
};

/** Stated plainly, because invented numbers next to real tickers look authoritative. */
export const DEFINE_DISCLAIMER =
  'Illustrative: the names are real, the numbers are invented to show how the choice works.';

// ── BEAT 4: DIFFERENT DECISIONS IN TIME ──────────────────────────────────────────────────────────────
//
// The owner: "in the last you might want to add one more, different portfolio, different decisions in time,
// yield completely different returns and risks (now you may show pnl graphs)."
//
// This is the beat that closes the definition. Beats 1-3 say what a portfolio is, that the split matters, and
// that you choose repeatedly. What is still missing is the consequence of the SEQUENCE: two people holding the
// same four things over the same year do not merely end at different numbers, they take different punishment
// getting there. Return and risk are two separate outcomes of one decision process, and this is where a reader
// meets that — which is also the vocabulary the later slides need.
//
// Four RECOGNISABLE WAYS OF BEHAVING rather than four strategy names: someone who never touches it, someone
// who panics after the fall, someone who chases whatever just went up, and someone who trims into strength and
// adds into weakness. A reader should be able to find themselves in one of them.
//
// Each is a full SCHEDULE of splits rather than a rule, because this slide defines the idea rather than solving
// it. The optimising is slide 3.

import type { Player, PlayerContext } from '../lib/policyPnl';
import { gross } from '../lib/policyPnl';

/** The policy weights the institutional players are mandated to hold — a plain 60/20/10/10 book. */
const MANDATE = [45, 22, 15, 18];

/** Normalise a weight vector to a target gross exposure, preserving its shape. */
const scaleTo = (w: readonly number[], target: number): number[] => {
  const g = gross(w);
  if (g <= 1e-9) return w.map(() => target / w.length);
  return w.map((x) => (x * target) / g);
};

/**
 * FIVE PLAYERS, drawn from how real books behave rather than from strategy names.
 *
 * The owner: "maybe even you can add a leveraged player into this as well. think about how real retail traders
 * and institutional traders portfolios do."
 *
 * So they are grouped by WHO holds them, because that is the real division: retail accounts are shaped by
 * attention and by leverage products sold to them, institutional books by mandates and risk limits. A reader
 * should be able to find themselves in one of the retail rows and see what the other side of the market is
 * doing in the institutional ones.
 *
 * Every player is a RULE evaluated weekly, never a typed schedule. At 52 weeks a schedule would be 208 numbers
 * per player — unverifiable by inspection, and dishonest about what a policy is.
 */
export const POLICIES: Player[] = [
  {
    key: 'buyhold',
    label: 'Buys once, never looks',
    kind: 'retail',
    gloss:
      'The most common real portfolio there is. Never rebalances, so the winner quietly grows into most of the book — the risk arrives by neglect rather than by decision.',
    // Sets the book in week 0 and never trades again. Drift does the rest, which is the whole point: by the
    // autumn this is a chipmaker bet whether or not that was ever the intention.
    target: (c: PlayerContext) => (c.week === 0 ? [40, 25, 20, 15] : null),
  },
  {
    key: 'panics',
    label: 'Sells after the fall',
    kind: 'retail',
    gloss:
      'Holds through the first bad week, capitulates near the bottom, and comes back only once it feels safe — paying twice for one decision.',
    target: (c: PlayerContext) => {
      if (c.week === 0) return [40, 25, 20, 15];
      // Week 19 is the second leg down, after the false rally at 17 — where real capitulation happens, not at
      // the first red week. Into gold and cash, which feels like safety and is priced like insurance.
      if (c.week === 19) return [10, 12, 18, 40];
      // Re-enters late, once the recovery is already obvious — in week 45, four weeks after it began.
      if (c.week === 45) return [34, 22, 18, 16];
      return null;
    },
  },
  {
    key: 'levered',
    label: 'Trades it at 2x',
    kind: 'retail',
    gloss:
      'The margin account. Twice the exposure, so twice the move — plus financing on the borrowed half, and a broker who closes the position for you if equity gets thin.',
    target: (c: PlayerContext) => {
      // Opens at 2x gross and tops back up monthly, which is what a levered retail account actually does: it
      // does NOT let the position drift down after a loss, it re-adds. That is the behaviour that turns a bad
      // quarter into a margin call.
      if (c.week === 0) return scaleTo([40, 25, 20, 15], 200);
      if (c.week % 4 === 0 && gross(c.held) > 1e-9) return scaleTo(c.held, 200);
      return null;
    },
  },
  {
    key: 'mandate',
    label: 'Rebalances on schedule',
    kind: 'institutional',
    gloss:
      'A mandate, not a view: every quarter it returns to policy weight, selling whatever rose and buying whatever fell because the document says so.',
    target: (c: PlayerContext) => (c.week % 13 === 0 ? [...MANDATE] : null),
  },
  {
    key: 'risktarget',
    label: 'Sizes to a risk budget',
    kind: 'institutional',
    gloss:
      'Targets a level of volatility rather than a level of return: leans in while markets are calm, cuts exposure hard when they are not, and never borrows much.',
    target: (c: PlayerContext) => {
      // Warm-up: hold the mandate until there is enough history to measure volatility against.
      if (c.week === 0) return [...MANDATE];
      if (c.week < 6 || c.week % 2 !== 0) return null;
      // Exposure = target vol / realised vol, capped well below the levered player's 2x. This is the one player
      // whose exposure is an OUTPUT of measured risk rather than an input, which is the idea the later slides
      // are about.
      const TARGET_VOL = 11;
      const measured = Math.max(4, c.vol);
      const want = Math.max(35, Math.min(130, (TARGET_VOL / measured) * 100));
      // Only trade when the gap is worth the toll — a risk model that rebalances on noise pays for the privilege.
      if (Math.abs(want - gross(c.held)) < 12) return null;
      return scaleTo(MANDATE, want);
    },
  },
];

/** The fourth beat's copy. */
export const BEAT4 = {
  ask: 'So does the sequence matter?',
  say: 'Five books, the same four holdings, the same fifty-two weeks — and different decisions along the way. They do not just end at different numbers. They take different punishment getting there, and one of them borrows to do it.',
  head: 'One year, five ways of running the same four things',
};
