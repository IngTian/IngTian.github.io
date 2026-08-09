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
//   1. a portfolio IS this — £100 split across four things you have heard of
//   2. optimising it is choosing the split, and the split has consequences
//   3. multi-period is that you must choose again, and the last choice constrains the next
// Each beat is one short line, because a definition that runs to a paragraph has failed at being a
// definition.
//
// The money is £100 rather than a percentage: a share of an unnamed total is an abstraction, and £100 split
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
    say: 'A hundred pounds, split across things you could own. That is all. The split IS the portfolio.',
    showing: 'one bar, divided four ways',
  },
  {
    ask: 'So what is optimising it?',
    say: 'Choosing the split — and the choice matters, because each thing behaves differently when the news lands.',
    showing: 'the same hundred pounds, split three other ways',
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
  /** Weight in the opening split, as a percentage of £100. */
  weight: number;
}

export const HOLDINGS: Holding[] = [
  { ticker: 'NVDA',   plain: 'a chipmaker',  glyph: 'chip', weight: 40 },
  { ticker: 'AAPL',   plain: 'a phone maker', glyph: 'tech', weight: 25 },
  { ticker: 'BAC',    plain: 'a bank',       glyph: 'bank', weight: 20 },
  { ticker: 'XAUUSD', plain: 'gold',         glyph: 'gold', weight: 15 },
];

/** Three alternative splits of the same £100, to make "the choice matters" visible rather than asserted.
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
