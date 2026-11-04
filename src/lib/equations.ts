import katex from 'katex';
import { fixMathVariants } from './mathml';

// Pre-rendered at build/import time to MathML only (output:'mathml'), so the
// client ships NO KaTeX runtime, CSS, or fonts — just the static <math> markup,
// with script and blackboard letters written as Unicode letters (lib/mathml.ts).
// ∇f = 0 is the honest stationarity condition for this unconstrained surface;
// the KKT line is the general constrained form (a rarer Easter egg).
const opts = { output: 'mathml' as const, throwOnError: false, displayMode: false };
const tex = (src: string, o: typeof opts) => fixMathVariants(katex.renderToString(src, o));

/** Inline maths for any other build-time markup (a figure's labels and caption), on the same terms. */
export const inlineMath = (src: string) => tex(src, opts);

export const EQUATIONS = {
  gradZero: tex('\\nabla f = 0', opts),
  kkt: tex('\\nabla f + J_h^{\\top}\\lambda + J_g^{\\top}\\mu = 0', opts),
};

// Display-mode (centred, larger), for the equations set on a line of their own.
const display = { ...opts, displayMode: true };

// ── THE FACTOR MODEL IS GONE, AND IT WAS REJECTED BEFORE IT WAS DEAD ────────────────────────────────────
//
// This section held FACTOR_EQUATIONS (a general form and a definition of beta) plus factorExpansion(), a
// function that baked the same equation with each fitted loading substituted in, muting zero-loading terms
// via \textcolor. It fed the exposure fan on /proto-showpiece, and that route has been retired, so nothing
// imports any of it.
//
// Two reasons it is deleted rather than parked. The obvious one is that a build-time KaTeX call with no
// consumer is pure cost — katex is a devDependency precisely so none of it ships, and unreachable bakes make
// the ledger of what the client receives harder to read.
//
// The one that actually settles it: all three rendered `r_{\mathrm{TIAN}}`, and the design note recorded
// that framing as rejected on a substantive point, not a visual one — "r_TIAN is a RETURN and implies a P&L
// that does not exist." The maths was mechanically correct and the betas were honest; the variable was a claim
// the site cannot make. A typeset equation is the most authoritative-looking thing on a page, so a rejected
// framing kept in perfectly baked form is exactly how it comes back — the next person needing a factor
// equation finds one ready, correct-looking, and wrong on the only point that mattered.

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
  recursion: tex(
    String.raw`V_t(x) \;=\; \max_{u \in U(x)} \Big\{\, r(x,u) \;+\; \mathbb{E}\big[\,V_{t+1}(x')\,\big] \Big\}`,
    display,
  ),
  /** Where it breaks: the state space is exponential in the number of assets. */
  curse: tex(String.raw`\lvert \mathcal{X} \rvert \;=\; m^{N}`, display),
  /** The number, with the slide's own m and N substituted — inline, so it can sit in a sentence. */
  atScale: tex(String.raw`10^{3000}`, opts),
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
