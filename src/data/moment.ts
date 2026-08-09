// src/data/moment.ts
// ONE CONCRETE MOMENT — the setup the owner asked for, so the question stops being abstract.
//
// The owner: "the how would you invest is still lacking concreteness. what i want is more concrete. consider
// these tickers, we all know there will be news, consider a more concrete setting, like we have XXX news
// coming out next week, we have XXX coming out after that, in the long run i know this company is facing XXX
// pressure. at this moment, how do you decide the best positions given that you are allowed to reweight?
// also, you need to consider the reweight costs from slippage etc."
//
// So this file is a briefing, not a table. The reader is put at a specific desk on a specific morning, with
// three things a real analyst would actually hold in their head: what is scheduled, what is coming after it,
// and the slow structural pressure underneath. THEN the question lands, and it has a shape.
//
// EVERYTHING HERE IS INVENTED, and the slide says so. Real tickers, hypothetical calendar: no real earnings
// date, no real decision, no real guidance. The pressures are the sort of thing that is publicly discussed
// about each business, written generically enough that none of it is a claim about what will happen.

/** Where the book stands this morning. */
export interface Holding {
  ticker: string;
  name: string;
  glyph: string;
  /** Current weight, as a percentage of the book. */
  weight: number;
  /** The one line that matters about holding it right now. */
  stance: string;
}

export const BOOK: Holding[] = [
  { ticker: 'NVDA',   name: 'NVIDIA',          glyph: 'chip', weight: 24, stance: 'The biggest position, and the biggest single risk.' },
  { ticker: 'AAPL',   name: 'Apple',           glyph: 'tech', weight: 18, stance: 'Steadier, but exposed to the same demand cycle.' },
  { ticker: 'META',   name: 'Meta',            glyph: 'tech', weight: 14, stance: 'Cheap on earnings, with a legal tail.' },
  { ticker: 'BAC',    name: 'Bank of America', glyph: 'bank', weight: 16, stance: 'Gains if rates stay high, suffers if credit turns.' },
  { ticker: 'XAUUSD', name: 'Gold',            glyph: 'gold', weight: 16, stance: 'Insurance. Costs you when nothing goes wrong.' },
  { ticker: 'WTI',    name: 'Crude oil',       glyph: 'oil',  weight: 12, stance: 'Hedges an inflation surprise, adds its own swings.' },
];

/** What is on the calendar, in the order it arrives. */
export interface CalendarItem {
  when: string;
  what: string;
  /** Which tickers it lands on. */
  hits: string[];
  /** Why it is genuinely two-sided — the reason there is no obvious trade. */
  twoSided: string;
}

export const CALENDAR: CalendarItem[] = [
  {
    when: 'Next Tuesday',
    what: 'NVDA earnings, with datacentre guidance',
    hits: ['NVDA', 'AAPL', 'META'],
    twoSided: 'A beat lifts the whole complex; a soft guide takes 15% off your largest position in a morning.',
  },
  {
    when: 'Two weeks out',
    what: 'CPI print, then the rate decision eight days later',
    hits: ['BAC', 'XAUUSD', 'WTI'],
    twoSided: 'Hot print helps the bank and hurts gold. Cool print does the reverse. You hold both.',
  },
  {
    when: 'Next month',
    what: 'Antitrust ruling expected on a large platform',
    hits: ['META'],
    twoSided: 'Binary, unschedulable in practice, and it can slip by a quarter.',
  },
];

/** The slow thing underneath, which no single event resolves. */
export const STRUCTURAL = {
  head: 'And underneath all of it',
  body:
    'The AI capex cycle that carries your three largest holdings is funded by a handful of buyers. That ' +
    'concentration is not an event on a calendar — it is a pressure that builds for quarters and then ' +
    'resolves in a week, and it is correlated across everything you own except gold.',
};

/** THE QUESTION, now that the setting is concrete. */
export const MOMENT_QUESTION = 'So: what do you hold on Monday?';

export const MOMENT_LEDE =
  'You may reweight whenever you like. Every reweight costs you the spread, and — because the position is ' +
  'large — it costs you more the faster you move. You will face this question again after each event, from ' +
  'whatever book this decision leaves you holding.';

/** Stated plainly, because real tickers make invented specifics look authoritative. */
export const MOMENT_DISCLAIMER =
  'Real tickers, hypothetical calendar. The events, weights and figures below are invented to show how the decision is shaped — none of it is a forecast or a record.';

// ── THE SLIPPAGE PANEL ───────────────────────────────────────────────────────────────────────────────
//
// "You need to consider the reweight costs from slippage etc. might good to make a visual to explain this."
//
// Two figures make it concrete rather than theoretical: the size of the trade in dollars, and what it costs
// at different speeds. The model is spread + square-root impact (see lib/decisionTree.ts) — the standard
// empirical form, labelled as a model rather than a law.

export const SLIPPAGE = {
  /** The trade being priced: trimming the largest position by a third. */
  tradeLabel: 'Trim NVDA from 24% to 16% of a $1B book',
  notional: '$80M',
  /** Illustrative daily volume for the participation axis. */
  advLabel: '≈ $2.5B daily volume',
  spreadBp: 2,
  impactBp: 35,
  /** The edge you think the trade is worth, for the break-even line. */
  edgeBp: 18,
  note:
    'Move it in a morning and you pay for the hurry. Move it over a week and the event arrives before you ' +
    'are done. That trade-off is the decision, and it does not exist for someone trading a thousand shares.',
};

/** THE TREE: three plausible actions at each of four decision points. */
export const TREE = {
  branch: 3,
  depths: 4,
  actionLabels: ['trim risk', 'hold', 'add'],
  decisionLabels: ['today', 'after earnings', 'after CPI', 'after the ruling'],
  note:
    'Three plausible actions, four decision points — and the last row is every book you could be holding by ' +
    'the end. Now make it three thousand names, twenty-four periods, and rules that forbid most of the tree.',
};
