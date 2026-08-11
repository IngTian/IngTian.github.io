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

// ── THE METHOD SLIDE HAS NO EQUATION, and that is the correction ─────────────────────────────────────────
//
// There were four annotated variants of the Bellman recursion here (METHOD_EQUATIONS) plus term chips
// (METHOD_CHIPS), built so a reader could walk the equation part by part. The owner removed the premise:
//
//   "we dont know how to solve this problem yet. it's an open problem. so dont write out that equation as if
//    it's known. it's not."
//
// Correct on both counts. Writing the recursion as an equality on a slide titled "the method" asserts a
// formulation and a solution, and neither is in hand. It was also redundant — BELLMAN_EQUATIONS above is the
// same recursion, and on the difficulty slide it is TRUE, because there it is the thing that blows up
// (|X| = m^N, 10^3000 states). One slide earlier it earns its place; one slide later it overclaims.
//
// Deliberately not replaced with a smaller mark. Two candidates were considered and rejected: a suboptimality
// bound V* - V^pi <= ? presumes a well-defined true optimum, which is exactly what the backbone move says is
// not handed to you; and a conditional expectation E[· | F_t] would fail to describe the figure beneath it,
// since the toy lattice's transition is deterministic and takes no expectation anywhere. The slide's two
// numerical callbacks (m^1.5 and 10^3000) are set as plain HTML in the sections that own them.
