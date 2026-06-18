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
