import katex from 'katex';

// Pre-rendered at build/import time to MathML only (output:'mathml'), so the
// client ships NO KaTeX runtime, CSS, or fonts — just the static <math> markup.
// ∇f = 0 is the honest stationarity condition for this unconstrained surface;
// the KKT line is the general constrained form (a rarer Easter egg).
const opts = { output: 'mathml' as const, throwOnError: false, displayMode: false };

export const EQUATIONS = {
  gradZero: katex.renderToString('\\nabla f = 0', opts),
  kkt: katex.renderToString('\\nabla f + J_h^{\\top}\\lambda + J_g^{\\top}\\mu = 0', opts),
};

// Display-mode (centered, larger) for the /research showcase panel.
const display = { ...opts, displayMode: true };

// Key equations from RL-BHRP (arXiv:2508.11856), transcribed VERBATIM from the
// paper — used in the /research right-column showcase. Each pairs with a plain
// gloss in research.astro. Do NOT alter the math to "look nicer": these are the
// paper's actual definitions (honesty rule).
export const PAPER_EQUATIONS = {
  // Two-level composition: final asset weight = sector weight × within-sector weight.
  weightMap: katex.renderToString('w_i = W_{g(i)}\\,\\eta_{i\\mid g(i)}', display),
  // Average-reward MDP reward: gross return − transaction cost − risk-dispersion
  // penalty. Even in the wide left column this is too long for one line at full
  // body size, so it breaks across two aligned lines at the second minus.
  reward: katex.renderToString(
    '\\begin{aligned} U_{t+1} = {}& w_t^{\\top} R_{t+1} - c\\lVert w_t - w_{t-1}\\rVert_1 \\\\ &{} - \\lambda\\big[\\alpha V_{\\text{within}} + (1-\\alpha) V_{\\text{across}}\\big] \\end{aligned}',
    display,
  ),
  // Risk-contribution conservation: contributions sum to portfolio variance.
  riskConservation: katex.renderToString('\\sum_{i=1}^{N} \\mathrm{RC}_i(w) = \\sigma_p^2(w)', display),
  // Sector-level composite covariance from within-sector weights.
  sectorCov: katex.renderToString('\\tilde{\\Sigma}_{gh} = (\\eta^{(g)})^{\\top}\\Sigma_{gh}\\,\\eta^{(h)}', display),
};

// ── The factor model, for the exposure fan ──────────────────────────────────
// Baked through the SAME KaTeX -> MathML path as everything else, which is the point: a first
// pass hand-built this from SVG <tspan> elements and it read as monospace text pretending to
// be maths — wrong subscript sizing, wrong italic/upright distinction, no proper spacing
// around operators. Real typesetting is not optional for the one element whose whole job is
// to say "this is a model".

/** The general form: one asset, many signals. */
export const FACTOR_EQUATIONS = {
  general: katex.renderToString(
    'r_{\\mathrm{TIAN}} = \\alpha + \\sum_{k=1}^{6} \\beta_k f_k + \\varepsilon',
    display,
  ),
  /** How beta is defined — the caption's claim, typeset rather than described in prose. */
  betaDef: katex.renderToString(
    '\\beta_k = \\frac{\\sum_{i \\in k} s_i}{\\sum_{j} s_j}',
    display,
  ),
};

/**
 * The expanded form, with each term's fitted loading substituted in.
 *
 * Built from the live loadings so the displayed equation and the drawn fan can never
 * disagree — the numbers come from one source. Zero-loading terms are rendered in a muted
 * colour via \\textcolor so an honest absence reads as deliberate rather than as a typo.
 */
export function factorExpansion(
  terms: readonly { symbol: string; beta: number }[],
): string {
  const body = terms
    .map(({ symbol, beta }) => {
      const coef = beta.toFixed(2);
      const term = `${coef}\\,f_{\\mathrm{${symbol}}}`;
      return beta === 0 ? `\\textcolor{#8c8576}{${term}}` : term;
    })
    .join(' + ');
  return katex.renderToString(
    `r_{\\mathrm{TIAN}} = \\alpha + ${body} + \\varepsilon`,
    { ...display, trust: true },
  );
}

// ── THE CURSE OF DIMENSIONALITY, for the difficulty slide's fourth beat ──────────────────────────────────
//
// The owner: "it's time to use math equations to show that how bellman blowup for such horribly complex
// problems. the curse of dimensionality and the dimension scales exponentially."
//
// Right, and this is the one place on the site where an equation IS the argument rather than an ornament: the
// recursion says precisely where the blowup comes from, which no amount of prose does as compactly.
//
// THE MATHS HAS TO BE EXACTLY TRUE — the project's rule, and doubly so on a quant's own portfolio. What is
// stated below is the finite-horizon Bellman recursion for this problem and the size of the state space it has
// to be solved over. Two things people conflate and these keep apart:
//   * |X| = m^N is the STATE-SPACE size — Bellman's own curse (1957), exponential in the number of assets.
//   * the per-state max runs over the reachable controls, so a naive backward pass is worse still, T·m^(2N).
// The slide quotes the first, because it is the honest headline and the second needs a caveat about reachability.
//
// Baked to MathML at build time like everything else here, so the client ships no KaTeX runtime.
export const BELLMAN_EQUATIONS = {
  /** The recursion itself. Finite-horizon, expectation over next state — the standard form. */
  recursion: katex.renderToString(
    String.raw`V_t(x) \;=\; \max_{u \in U(x)} \Big\{\, r(x,u) \;+\; \mathbb{E}\big[\,V_{t+1}(x')\,\big] \Big\}`,
    display,
  ),
  /** Where it breaks: the state space is exponential in the number of assets. */
  curse: katex.renderToString(String.raw`\lvert \mathcal{X} \rvert \;=\; m^{N}`, display),
  /** The number, with the slide's own m and N substituted — inline, so it can sit in a sentence. */
  atScale: katex.renderToString(String.raw`10^{3000}`, opts),
};

// ── THE METHOD SLIDE: ONE EQUATION, WALKED IN FOUR MOVES ─────────────────────────────────────────────────
//
// The owner: "our main emphasis is our approach to solve the problem, with RL, math, stochastic process, and
// bellman. i dont know how to merge all these into one slide, you might want to think about it."
//
// THE MERGE: those four are not four topics. They are the PARTS OF ONE EQUATION — the same Bellman recursion
// the difficulty slide ends on. Read it again and each of the owner's four words is a different piece of it:
//
//   V_t(x) = max_{u in U(x)} { r(x,u) + E[ V_{t+1}(x') ] }
//              ^^^              ^^^^^^      ^^^^^^^^  ^
//              |                |           |         └── E[.] cannot be taken without a model of how the
//              |                |           |             world moves          -> THE STOCHASTIC PROCESS
//              |                |           └── V_{t+1} is the table with 10^3000 entries, so you fit it
//              |                |               instead of storing it           -> REINFORCEMENT LEARNING
//              |                └── r(x,u) is what you actually maximise: risk-adjusted, net of cost, over a
//              |                    hierarchy rather than 3,000 loose names     -> THE MATHS
//              └── and the equation itself is the frame that demands all three  -> BELLMAN
//
// So the slide is one equation read four ways, not four subjects crammed together. Each move annotates a
// different part and pairs it with what the approach supplies there.
//
// WHY \underbrace RATHER THAN COLOUR. A first attempt used \htmlClass so CSS could light parts of a single
// baked equation; the classes do not survive MathML output (they land only in the <annotation> LaTeX echo).
// \textcolor does survive, but a baked hex cannot follow a panel whose accent flips between #c8a36a and
// #7fc9a0. \underbrace is better than either: it is the classical way to annotate a sub-expression, it NAMES
// the part instead of merely tinting it, and being colour-free it themes for free.
const BELLMAN_BODY = String.raw`\max_{u \in U(x)} \Big\{ r(x,u) + \mathbb{E}\big[V_{t+1}(x'\,)\big] \Big\}`;

// THE BRACE CARRIES NO TEXT, and that took two passes to arrive at.
//
// First attempt put the name under the brace — \underbrace{r(x,u)}_{\text{risk-adjusted, net of cost}}. Two
// problems, both visible on screen and both measured:
//   1. the LABEL then sets the term's width, so the equation reflowed between moves. It has to read as one
//      equation being annotated, not four different layouts. \mathclap fixed that (width held at 487px across
//      all four moves, left edge pinned at 169) —
//   2. but a zero-width label overlaps its neighbours, and "a model of how the world moves" centred under a
//      single E ran straight through the brackets beside it.
//
// The labels were redundant regardless: the term selector already names each part ("THE WORLD MODEL") and the
// prose beside the equation says what it does. So the brace points, and the words live where words belong.
// Restraint is the house style, and here it is also just correct.
export const METHOD_EQUATIONS = {
  /** Move 1 — the frame. Nothing braced: this move IS the whole equation, so singling out a part would lie. */
  principle: katex.renderToString(
    String.raw`V_t(x) = ${BELLMAN_BODY}`,
    { ...display, strict: false },
  ),
  /** Move 2 — the expectation, which is where a world model is required. */
  process: katex.renderToString(
    String.raw`V_t(x) = \max_{u \in U(x)} \Big\{ r(x,u) + \underbrace{\mathbb{E}\big[V_{t+1}(x'\,)\big]} \Big\}`,
    { ...display, strict: false },
  ),
  /** Move 3 — the value function, which is fitted rather than tabulated. */
  learned: katex.renderToString(
    String.raw`V_t(x) = \max_{u \in U(x)} \Big\{ r(x,u) + \mathbb{E}\big[\underbrace{V_{t+1}(x'\,)}\big] \Big\}`,
    { ...display, strict: false },
  ),
  /** Move 4 — the reward, which is where the risk maths lives. */
  objective: katex.renderToString(
    String.raw`V_t(x) = \max_{u \in U(x)} \Big\{ \underbrace{r(x,u)} + \mathbb{E}\big[V_{t+1}(x'\,)\big] \Big\}`,
    { ...display, strict: false },
  ),
};

/**
 * The little term marks on the selector — HTML, not MathML, and that is a measured decision.
 *
 * Eight MathML blocks on this slide cost real layout time: LCP went 2559ms -> 2709ms and Lighthouse 96 -> 95,
 * consistent across three runs each way. The four display equations are worth their cost (they are the slide's
 * argument), but a 12px chip reading "V_t(x)" is not: italic variable plus a subscript is honest typography in
 * plain HTML at that size, and it drops four MathML trees from the document.
 *
 * Kept in this module rather than inlined in the page so the marks and the equations stay in one place.
 */
export const METHOD_CHIPS: Record<'principle' | 'process' | 'learned' | 'objective', string> = {
  principle: '<i>V</i><sub>t</sub>(<i>x</i>)',
  process: '<i>E</i>[&thinsp;&middot;&thinsp;]',
  learned: '<i>V</i><sub>t+1</sub>',
  objective: '<i>r</i>(<i>x</i>,&thinsp;<i>u</i>)',
};
