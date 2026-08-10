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

import type { Policy } from '../lib/policyPnl';

const flat = (w: number[], n = 12) => new Array(n).fill(0).map(() => [...w]);

export const POLICIES: Policy[] = [
  {
    key: 'never',
    label: 'Never touches it',
    gloss: 'Picks a split in January and leaves it alone. Pays nothing to trade, and rides the fall all the way down.',
    weights: flat([40, 25, 20, 15]),
  },
  {
    key: 'panics',
    label: 'Panics after the fall',
    gloss: 'Sells the chipmaker into gold once it has already dropped — locking in the loss and missing the recovery.',
    weights: [
      [40, 25, 20, 15], [40, 25, 20, 15], [40, 25, 20, 15], [40, 25, 20, 15],
      [12, 14, 24, 50], [12, 14, 24, 50], [14, 16, 24, 46], [16, 18, 24, 42],
      [16, 18, 24, 42], [18, 20, 24, 38], [20, 20, 24, 36], [20, 20, 24, 36],
    ],
  },
  {
    key: 'chases',
    label: 'Chases the winner',
    gloss: 'Piles into whatever moved up last month, and pays the toll every single time.',
    weights: [
      [40, 25, 20, 15], [62, 20, 12,  6], [70, 18,  8,  4], [72, 16,  8,  4],
      [18, 16, 16, 50], [16, 14, 14, 56], [58, 20, 14,  8], [66, 18, 12,  4],
      [64, 18, 14,  4], [20, 18, 18, 44], [68, 18, 10,  4], [66, 18, 12,  4],
    ],
  },
  {
    key: 'measured',
    label: 'Trims and adds',
    gloss: 'Cuts risk before the year turns rough, buys it back when nobody wants it, and moves rarely.',
    weights: [
      [40, 25, 20, 15], [36, 24, 20, 20], [30, 22, 20, 28], [26, 20, 20, 34],
      [30, 22, 20, 28], [38, 24, 20, 18], [42, 24, 18, 16], [40, 24, 18, 18],
      [36, 22, 20, 22], [44, 24, 16, 16], [44, 24, 16, 16], [42, 24, 18, 16],
    ],
  },
];

/** The fourth beat's copy. */
export const BEAT4 = {
  ask: 'So does the sequence matter?',
  say: 'Four people, the same four holdings, the same year — and different decisions along the way. They do not just end at different numbers. They take different punishment getting there.',
  head: 'Same year, four ways of deciding',
};
