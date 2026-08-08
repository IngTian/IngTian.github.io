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
