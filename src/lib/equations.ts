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
  // penalty. Broken across two aligned lines — it's too wide for the narrow
  // showcase column on one line.
  reward: katex.renderToString(
    '\\begin{aligned} U_{t+1} = {}& w_t^{\\top} R_{t+1} - c\\lVert w_t - w_{t-1}\\rVert_1 \\\\ &{} - \\lambda\\big[\\alpha V_{\\text{within}} + (1-\\alpha) V_{\\text{across}}\\big] \\end{aligned}',
    display,
  ),
  // Risk-contribution conservation: contributions sum to portfolio variance.
  riskConservation: katex.renderToString('\\sum_{i=1}^{N} \\mathrm{RC}_i(w) = \\sigma_p^2(w)', display),
  // Sector-level composite covariance from within-sector weights.
  sectorCov: katex.renderToString('\\tilde{\\Sigma}_{gh} = (\\eta^{(g)})^{\\top}\\Sigma_{gh}\\,\\eta^{(h)}', display),
};
