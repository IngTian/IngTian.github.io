// src/lib/pathspace.ts
// THE MULTI-PERIOD FEASIBLE SET — a set of SEQUENCES, not a set of points.
//
// The owner's correction, and it is the right one: "triangle might not be enough actually. for single period
// might be yes. for multi period we are shrinking many potential paths right?"
//
// Exactly. lib/feasible.ts draws the feasible set of ONE weight vector: a convex polygon on the 2-simplex.
// That is the whole story for a single decision. But the field is multi-PERIOD, and the object being
// constrained is a whole sequence (w_0, w_1, ..., w_T). Constraints do two different things to it:
//
//   1. THEY COMPOUND. A per-period rule that leaves a fraction f of splits legal leaves f^T of sequences legal.
//      At the site's own fund figure (24 periods, 20% legal per period) that is 1.7e-17 — one in sixty
//      quadrillion. No discretisation is needed for that number; it is just arithmetic.
//
//   2. THEY COUPLE PERIODS, which is the deeper point and the one no single-period picture can show. A turnover
//      band says where you may go NEXT depends on where you ARE. So two books holding the same thing today have
//      different futures if they arrived differently, the problem stops being separable, and choosing period by
//      period is no longer valid. That is precisely why the next slide needs dynamic programming.
//
// MEASURED, and it corrected my own first guess: at equal per-step severity a coupled rule and an uncoupled one
// survive within a factor of ~1.4 of each other, so "coupling shrinks it more" is NOT the claim. The claim is
// structural — the surviving set depends on where you stand. countFuturesFrom() below is the function that
// makes that visible, and the test pins it.
//
// DISCRETISATION IS A MODELLING CHOICE, and the slide says so. Exposure is cut into LEVELS bands and the horizon
// into PERIODS steps, because a continuum of paths cannot be drawn or counted. The COMPOUNDING figure is exact;
// the path counts are exact given this grid. Both are honest as long as the grid is stated, which it is.
//
// Deliberately a different grid and a different drawing from lib/bellman.ts, which the Method slide uses: that
// one is a value lattice with an optimal route traced through it, and this one is a thicket of candidate paths
// being combed away. Same family of object, opposite question — "what is allowed" versus "what is best".
//
// Pure: no DOM. Unit-tested in tests/pathspace.test.ts.

/** Exposure bands. Five is the largest grid whose free path count (625) a reader can still accept as countable. */
export const PATH_LEVELS = 5;

/** Decision points in the illustrated horizon. */
export const PATH_PERIODS = 4;

/** A path is one level index per period — a sequence of decisions. */
export type Path = number[];

/**
 * A rule on a whole SEQUENCE.
 *
 * `kind` records what sort of rule it is, because the distinction is the slide's argument:
 *   - 'step'   couples adjacent periods (a turnover band). It is why the problem is not separable.
 *   - 'level'  applies to every period independently (a floor or a cap). It compounds but does not couple.
 *   - 'window' looks across several periods at once (no long run at full risk). Coupling, over a longer span.
 */
export interface PathRule {
  label: string;
  why: string;
  kind: 'step' | 'level' | 'window';
  test: (p: Path) => boolean;
}

/**
 * THE RULES, in the order the slide applies them, and each one is a real category of mandate term.
 *
 * They are ordered so that the two COUPLING rules bracket the two per-period ones: the reader meets the idea
 * that periods constrain each other first, since that is the part a single-period picture cannot express.
 */
export const PATH_RULES: PathRule[] = [
  {
    label: 'Move one band a month at most',
    why: 'Turnover costs money and moves the price, so a mandate caps how far you may travel in one step. Where you can go next now depends on where you are.',
    kind: 'step',
    test: (p) => p.every((v, i) => i === 0 || Math.abs(v - p[i - 1]) <= 1),
  },
  {
    label: 'Never below the insurance floor',
    why: 'A floor on the defensive holding, every single month, so one bad week cannot take everything.',
    kind: 'level',
    test: (p) => p.every((v) => v >= 1),
  },
  {
    label: 'Never above the leverage cap',
    why: 'Borrowed money is capped by the prospectus, whatever the opportunity looks like.',
    kind: 'level',
    test: (p) => p.every((v) => v <= PATH_LEVELS - 2),
  },
  {
    label: 'No two months in a row at full risk',
    why: 'A drawdown limit measured over a window: after a run at the top you must take risk off, whether you want to or not.',
    kind: 'window',
    test: (p) => p.every((v, i) => !(i > 0 && v === PATH_LEVELS - 2 && p[i - 1] === PATH_LEVELS - 2)),
  },
];

/** Every sequence the grid allows before any rule is applied: LEVELS^PERIODS of them. */
export function allPaths(levels = PATH_LEVELS, periods = PATH_PERIODS): Path[] {
  const out: Path[] = [];
  const walk = (acc: number[]) => {
    if (acc.length === periods) { out.push([...acc]); return; }
    for (let l = 0; l < levels; l++) { acc.push(l); walk(acc); acc.pop(); }
  };
  walk([]);
  return out;
}

/** The sequences that survive the first `n` rules. n = 0 is the unconstrained set. */
export function survivors(n: number, paths: readonly Path[] = ALL_PATHS): Path[] {
  const rules = PATH_RULES.slice(0, Math.max(0, Math.min(n, PATH_RULES.length)));
  return paths.filter((p) => rules.every((r) => r.test(p)));
}

/** Precomputed once at module load: the grid is fixed, so there is no reason to walk it repeatedly. */
export const ALL_PATHS: Path[] = allPaths();

/** How many sequences survive the first `n` rules. */
export function countAfter(n: number): number {
  return survivors(n).length;
}

/** Surviving fraction after each rule, starting at 1 for the unconstrained set — the numbers the slide quotes. */
export function survivalSeries(): number[] {
  const total = ALL_PATHS.length;
  const out: number[] = [1];
  for (let n = 1; n <= PATH_RULES.length; n++) out.push(countAfter(n) / total);
  return out;
}

/**
 * THE PATHS ONE RULE KILLS — those that survived the previous rules and fail this one.
 *
 * Drawn as the deleted set, the same way lib/feasible's removedBy() draws the slab a constraint removes: the
 * slide's claim is about what is TAKEN AWAY, so the drawing has to be able to show it rather than only showing
 * the remainder.
 */
export function killedBy(n: number): Path[] {
  if (n < 1 || n > PATH_RULES.length) return [];
  const before = survivors(n - 1);
  const rule = PATH_RULES[n - 1];
  return before.filter((p) => !rule.test(p));
}

/**
 * HOW MANY LEGAL FUTURES EXIST FROM A GIVEN STARTING BAND, under the first `n` rules.
 *
 * This is the function that carries the structural argument. If the answer depends on the starting level, the
 * problem is not separable — you cannot pick each period's split on its own, because your options tomorrow are
 * a consequence of your choice today. Measured on the real grid the answers differ by 3x between the middle
 * and the edge, which is the whole reason the Method slide exists.
 */
export function countFuturesFrom(start: number, n: number = PATH_RULES.length): number {
  return survivors(n).filter((p) => p[0] === start).length;
}

/**
 * COMPOUNDING over a horizon, in closed form — no grid, no discretisation, exact.
 *
 * `perPeriod` is the fraction of splits a mandate leaves legal in ONE period (the Rules slide already measures
 * this for its own constraint set), and the result is the fraction of SEQUENCES left legal over `periods`.
 */
export function compoundedFraction(perPeriod: number, periods: number): number {
  return perPeriod ** periods;
}

/** Screen position of one decision point. Separated from the drawing so it can be tested. */
export function projectNode(
  period: number,
  level: number,
  box: { x: number; y: number; w: number; h: number },
  levels = PATH_LEVELS,
  periods = PATH_PERIODS,
): [number, number] {
  const u = periods > 1 ? period / (periods - 1) : 0.5;
  const v = levels > 1 ? level / (levels - 1) : 0.5;
  // Level 0 is the LEAST exposure, so it sits at the bottom of the box — up means more risk, as every other
  // chart on the site reads.
  return [box.x + u * box.w, box.y + (1 - v) * box.h];
}

/** A path as an SVG polyline `points` string. */
export function pathPoints(
  p: Path,
  box: { x: number; y: number; w: number; h: number },
  levels = PATH_LEVELS,
  periods = PATH_PERIODS,
): string {
  return p
    .map((lvl, t) => projectNode(t, lvl, box, levels, periods).map((n) => n.toFixed(1)).join(','))
    .join(' ');
}
