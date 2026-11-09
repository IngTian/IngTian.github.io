// PROTOTYPE (throwaway) data for /proto-writing: the framework the owner asked for ("i want to get the framework and
// structural right"), with SAMPLE pieces so a direction can be judged at 0, 3 and 24 pieces. None of these pieces
// exists; every title is a plausible future topic from the research, the explainers or the trading system's method.
import { inlineMath } from '../lib/equations';

export type Kind = 'notes' | 'explainers' | 'methods';

/** What /writing is for, in one line, and what each kind holds. Trade calls go to TradingView and announcements to
 *  LinkedIn; this is the evergreen thinking: still worth reading in three years, and showing how, not what, he bets. */
export const CHARTER = 'Notes, explainers and methods — the thinking that should still be worth reading in three years. Trade ideas live on TradingView; this is how they are made.';
export const KINDS: Record<Kind, { label: string; gloss: string }> = {
  notes: { label: 'Notes', gloss: 'Working notes from the PhD reading: derivations, dead ends, what turned out to matter.' },
  explainers: { label: 'Explainers', gloss: 'One idea made legible, with the mathematics left in.' },
  methods: { label: 'Methods', gloss: 'How the trading system is built and tested: the method, never the call.' },
};

/** The subjects, the second axis (the research: kind x topic, both closed, as Tao's and AQR's archives), each with
 *  the arXiv area it maps to. The chips filter by these, and a piece's cover is drawn from its first one. */
export type Topic = 'portfolio' | 'optimization' | 'estimation' | 'execution' | 'risk' | 'backtesting' | 'systems';
export const TOPICS: Record<Topic, { label: string; arxiv?: string; gloss: string }> = {
  portfolio: { label: 'Portfolio', arxiv: 'q-fin.PM', gloss: 'Allocation: how much of what, and when to change it.' },
  optimization: { label: 'Optimization', arxiv: 'math.OC', gloss: 'The convex and dynamic machinery under the allocation.' },
  estimation: { label: 'Estimation', arxiv: 'q-fin.ST', gloss: 'Means, covariances, regimes — and how wrong they are.' },
  execution: { label: 'Execution', arxiv: 'q-fin.TR', gloss: 'What a trade costs, and how it is placed.' },
  risk: { label: 'Risk', arxiv: 'q-fin.RM', gloss: 'Volatility, drawdowns, tails, and spending a risk budget.' },
  backtesting: { label: 'Backtesting', gloss: 'Testing a strategy without fooling yourself.' },
  systems: { label: 'Systems', gloss: 'The software a strategy runs on.' },
};

export interface Piece {
  slug: string; title: string; kind: Kind; topics: Topic[]; date: string; blurb: string; minutes: number;
  /** A short note, read in full where it is listed (a stream may show it whole); no page of its own needed. */
  short?: string;
}

const p = (slug: string, kind: Kind, date: string, minutes: number, title: string, blurb: string, short?: string) =>
  ({ slug, kind, date, minutes, title, blurb, short });

/** Newest first. */
const RAW = [
  p('risk-parity-is-not-equal-weights', 'explainers', '2028-10-02', 9, 'Why risk parity isn’t “equal weights”', 'Equal weights spend most of the risk budget on the most volatile asset. Risk parity spends it evenly, and the difference is one line of algebra.'),
  p('lookahead-three-ways', 'methods', '2028-09-14', 12, 'Where my backtest lied: three kinds of lookahead', 'A close used before it closed, a universe chosen with hindsight, and a parameter tuned on the test set.'),
  p('covariance-has-more-parameters', 'notes', '2028-08-30', 1, 'More parameters than data', 'A sample covariance of 500 stocks over 60 months.',
    'A covariance matrix of 500 stocks estimated on 60 months has more free parameters than data points. Every portfolio built on it is a bet on the estimator, not on the stocks.'),
  p('multi-period-is-not-repeated', 'notes', '2028-08-11', 14, 'Multi-period is not a repeated one-period solve', 'Rebalancing costs couple the periods, so the greedy answer is not the optimal one — a two-period example.'),
  p('duality-in-one-picture', 'explainers', '2028-07-20', 7, 'Duality in one picture', 'The dual of a portfolio problem prices its constraints. A budget constraint’s multiplier is the marginal value of a dollar.'),
  p('slippage-on-my-fills', 'methods', '2028-06-28', 10, 'Slippage, measured on my own fills', 'Two years of OANDA fills against the mid at decision time: what the square-root law predicts, and what it missed.'),
  p('kwon-robust-models', 'notes', '2028-06-02', 16, 'Reading notes: robust portfolio models', 'Uncertainty sets for the mean and the covariance, and why the robust answer is often a shrunk one.'),
  p('walk-forward-honestly', 'methods', '2028-05-09', 11, 'Walk-forward without fooling yourself', 'The test window moves; the tuning budget must not. A protocol, and the two times I broke it.'),
  p('the-curse-counted', 'explainers', '2028-04-18', 8, 'The curse of dimensionality, counted', 'Ten assets, ten weight levels, twelve months: how many policies is that, and how long would it take to try them.'),
  p('transaction-costs-couple-time', 'notes', '2028-03-25', 1, 'Costs couple time', 'Why the periods stop being separable.',
    'Without costs, each period’s problem stands alone. Add a cost on turnover and today’s trade changes tomorrow’s starting point: the problem stops being separable in time.'),
  p('reproducing-rl-bhrp', 'methods', '2028-03-01', 18, 'Reproducing RL-BHRP: what the paper left out', 'Thirty runs, a median and a band. The seeds, the window and the rebalancing rule the paper did not state.'),
  p('mpc-as-a-policy', 'notes', '2028-02-07', 13, 'Model predictive control as a portfolio policy', 'Plan over a horizon, act on the first step, re-plan: what MPC buys over a myopic rule, and what it costs.'),
  p('what-regime-means', 'explainers', '2028-01-15', 9, 'What “regime” means, mathematically', 'A hidden state that switches the distribution of returns — and why a regime you can only see afterwards is no regime at all.'),
  p('go-execution-engine', 'methods', '2027-12-12', 15, 'An execution engine in Go: the order book I didn’t need', 'What the engine actually has to do for a few trades a day, and the matching engine I wrote and deleted.'),
  p('bellman-lattice-limits', 'notes', '2027-11-20', 10, 'What a Bellman lattice can and cannot tell you', 'Exact on a small world, silent on a big one: the lattice as a check on approximations, not a solver.'),
  p('square-root-impact', 'explainers', '2027-10-30', 11, 'Square-root impact, from the data up', 'Why the cost of a trade grows with the square root of its size, and the published anchor the homepage uses.'),
  p('first-regime-model-overfit', 'methods', '2027-10-04', 9, 'Why my first regime model overfit', 'Six states for nine years of data. What the information criteria said, and what the out-of-sample said louder.'),
  p('fixed-point-three-ways', 'notes', '2027-09-12', 12, 'Risk parity’s fixed point, three ways', 'Newton, cyclical coordinate descent and a convex reformulation, on the same covariance.'),
  p('estimator-not-stocks', 'notes', '2027-08-21', 1, 'The estimator is the position', 'On shrinkage.',
    'Shrinking the covariance toward a constant correlation is not a technicality. It is a view, and it should be sized like one.'),
  p('convexity-why-easy', 'explainers', '2027-07-30', 8, 'Convexity, or why some problems are easy', 'A bowl has one bottom. Why that single property decides whether an optimiser can be trusted.'),
  p('audit-trail', 'methods', '2027-07-02', 7, 'Logging every decision', 'The trading system’s audit trail: every signal, every order and why, replayable to the second.'),
  p('notebook-to-service', 'methods', '2027-06-10', 10, 'From notebook to service: shipping a signal', 'The same function in research and in production, and the three bugs that lived in the gap.'),
  p('boyd-chapter-five', 'notes', '2027-05-18', 15, 'Reading Boyd & Vandenberghe, chapter 5', 'Where duality earns its keep: weak and strong duality, Slater’s condition, and the portfolio problems that meet it.'),
  p('randomness-of-a-strategy', 'methods', '2027-04-26', 9, 'Testing a strategy against its own randomness', 'Shuffle the signal, keep the costs: if the shuffled runs do as well, the edge was the costs’ shape.'),
];

// Each sample's subjects, one to three, the first drawing its cover.
const TOPIC_OF: Record<string, Topic[]> = {
  'risk-parity-is-not-equal-weights': ['risk', 'portfolio'], 'lookahead-three-ways': ['backtesting'],
  'covariance-has-more-parameters': ['estimation'], 'multi-period-is-not-repeated': ['portfolio', 'optimization'],
  'duality-in-one-picture': ['optimization'], 'slippage-on-my-fills': ['execution'],
  'kwon-robust-models': ['portfolio', 'estimation'], 'walk-forward-honestly': ['backtesting'],
  'the-curse-counted': ['optimization'], 'transaction-costs-couple-time': ['execution', 'portfolio'],
  'reproducing-rl-bhrp': ['backtesting', 'portfolio'], 'mpc-as-a-policy': ['optimization', 'portfolio'],
  'what-regime-means': ['estimation'], 'go-execution-engine': ['systems', 'execution'],
  'bellman-lattice-limits': ['optimization'], 'square-root-impact': ['execution'],
  'first-regime-model-overfit': ['estimation', 'backtesting'], 'fixed-point-three-ways': ['risk', 'optimization'],
  'estimator-not-stocks': ['estimation', 'risk'], 'convexity-why-easy': ['optimization'], 'audit-trail': ['systems'],
  'notebook-to-service': ['systems'], 'boyd-chapter-five': ['optimization'], 'randomness-of-a-strategy': ['backtesting'],
};
export const PIECES: Piece[] = RAW.map((x) => {
  const topics = TOPIC_OF[x.slug];
  if (!topics) throw new Error(`protoWriting: no topics for ${x.slug}`);
  return { ...x, topics };
});

const eq = (tex: string): string => `<div class="w-eq">${inlineMath(tex)}</div>`;

/** The sample piece, in full, for each direction's piece view: an explainer with a standfirst, sections, two
 *  displays, a list, a margin note, a pull quote and a source. The maths is honest: risk contributions sum to the
 *  portfolio's volatility, and risk parity sets them equal. */
export const SAMPLE = {
  ...PIECES[0],
  standfirst: 'Equal weights spend most of the risk budget on the most volatile asset. Risk parity spends it evenly — and the difference is one line of algebra.',
  html: `
<p>Split a dollar evenly across a bond fund and an equity fund and you have a portfolio that looks balanced. It is
not. Equities move about three times as much as bonds, so nearly all of the portfolio’s day-to-day risk comes from
the equity half. <em>Equal weight</em> is a statement about dollars; it says nothing about risk.</p>
<h2>Where the risk actually comes from</h2>
<p>A portfolio’s volatility is ${inlineMath('\\sigma_p = \\sqrt{w^\\top \\Sigma w}')}. It can be split exactly into
one contribution per asset — each asset’s weight times its marginal effect on the total:</p>
${eq('\\mathrm{RC}_i = \\frac{w_i\\,(\\Sigma w)_i}{\\sqrt{w^\\top \\Sigma w}}, \\qquad \\sum_i \\mathrm{RC}_i = \\sigma_p')}
<aside class="w-note"><strong>Why they sum.</strong> The volatility is homogeneous of degree one in the weights,
so Euler’s theorem splits it into weight times partial derivative, asset by asset.</aside>
<p>For the 50/50 bond–equity portfolio above, the equity half contributes roughly nine tenths of ${inlineMath('\\sigma_p')}.</p>
<h2>Spending the budget evenly</h2>
<p>Risk parity asks for the weights at which every contribution is the same:</p>
${eq('\\mathrm{RC}_i = \\frac{\\sigma_p}{n} \\quad \\text{for every } i')}
<blockquote>Equal weight is a statement about dollars. Risk parity is a statement about risk.</blockquote>
<p>Three things follow:</p>
<ul>
<li>It needs no forecast of returns — only of risk, which is easier to estimate.</li>
<li>It holds more of the quiet assets, so it is usually levered to reach a target volatility.</li>
<li>With equal volatilities and equal correlations, it <em>is</em> equal weight — the one case the name suggests.</li>
</ul>
<h3>What it does not do</h3>
<p>It does not make a portfolio safe. It makes the risk evenly spent, which is a different and more modest claim.</p>
<p class="w-src">The decomposition is standard; see Maillard, Roncalli and Teïletche (2010).</p>`,
};
