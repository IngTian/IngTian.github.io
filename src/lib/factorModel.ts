// src/lib/factorModel.ts
// ONE ASSET, MANY SIGNALS — the pod's replacement, as a factor model.
//
// WHY A FACTOR MODEL AND NOT A CORRELATION MATRIX:
// The previous candidate (seriation / quasi-diagonalisation) reorders an n×n similarity
// matrix over n COMPARABLE ASSETS. This site is one asset, so clustering it against itself
// is a category error — the object would assert a shape the data cannot have. A factor
// model is the correct dimensionality for one dependent variable explained by many signals:
//
//     r_TIAN = α + Σ_k β_k f_k + ε
//
// Six panels stop being an arbitrary cut at k = 6 and become six FACTORS, which is the
// conventional form (Fama–French uses five; Barra uses industry + style blocks). Nothing
// has to be invented to justify six.
//
// HONESTY RULE, and it is the whole reason this module exists rather than a literal array:
// a factor model implies a FIT. Every number this module exposes is derived from declared
// data in profile.ts by arithmetic you can read here — there are no fabricated betas, no
// t-stats, no R². `beta` is defined exactly once, below, and the caption on screen states
// that definition verbatim. If a number cannot be derived, it is not shown.

import { timeline, publications, projects, awards, researchInterests } from '../data/profile';

/** The six factors. `key` is stable (used in ids and tests); `href` is the destination the
 *  factor's beam navigates to, or null for the two that are not built yet. */
export interface Factor {
  key: string;
  /** Short symbol, rendered as the subscript on β in the expression. */
  symbol: string;
  label: string;
  href: string | null;
  /** Shown when there is no page yet. */
  announce?: string;
  /** One line: what this exposure actually is. */
  gloss: string;
}

export const FACTORS: Factor[] = [
  {
    key: 'research', symbol: 'res', label: 'Research', href: '/research',
    gloss: 'Portfolio optimization, risk parity, RL for allocation — the OR core.',
  },
  {
    key: 'projects', symbol: 'proj', label: 'Projects', href: '/projects',
    gloss: 'Shipped systems, built end to end.',
  },
  {
    key: 'experience', symbol: 'exp', label: 'Experience', href: '/experience',
    gloss: 'Roles and degrees — where the work happened.',
  },
  {
    key: 'writing', symbol: 'wri', label: 'Writing', href: null,
    announce: 'Writing · coming',
    gloss: 'Notes and papers in progress.',
  },
  {
    key: 'markets', symbol: 'mkt', label: 'Market reports', href: null,
    announce: 'Market reports · coming',
    gloss: 'Commentary on what the tape is doing.',
  },
  {
    key: 'craft', symbol: 'crf', label: 'Craft', href: '/art',
    gloss: 'Calligraphy and guqin — the hand behind the maths.',
  },
];

/** A single observable that loads onto a factor.
 *
 *  EVERY SIGNAL WEIGHS 1 — one declared artefact, one unit. An earlier version weighted
 *  timeline entries by DURATION while everything else counted as one artefact, which put two
 *  different units in one denominator: nine roles summing 16 job-years swamped six research
 *  items summing 6, and the model reported Experience 0.59 / Research 0.22. That is not a
 *  fact about the record, it is an artefact of mixing years with counts. One unit, no
 *  mixing, and the ratio means something. */
export interface Signal {
  factor: string;
  label: string;
  /** Always 1. Kept as a field so the arithmetic in `loadings` stays explicit and so a
   *  future weighting scheme has somewhere honest to live. */
  weight: 1;
}

/** Parse a period string from profile.ts into a span in years.
 *
 *  Handles every real shape in the file: '2023 — 25', '2026 —' (open), 'Fall 2027 —',
 *  '2021', "'21–'22". An open range is measured to NOW_YEAR rather than to infinity, so a
 *  current role does not dominate the model. */
export function periodYears(period: string, nowYear = 2026): number {
  const years = [...period.matchAll(/(\d{2,4})/g)].map((m) => {
    const raw = m[1];
    const n = Number(raw);
    if (raw.length === 4) return n;
    // Two-digit years in this data are all 2000s ('21 -> 2021, 25 -> 2025).
    return 2000 + n;
  });
  if (years.length === 0) return 1;
  const start = years[0];
  const open = /—\s*$|–\s*$|-\s*$/.test(period.trim());
  const end = open ? Math.max(nowYear, start) : (years[1] ?? start);
  // A single year (e.g. '2021', an internship) counts as one year, not zero.
  return Math.max(1, end - start);
}

/**
 * Every signal in the model, drawn from profile.ts.
 *
 * Membership is DECLARED, not inferred: a timeline entry loads on `experience`, a
 * publication on `research`, and so on. That is the honest mapping — pretending an
 * algorithm discovered which of a person's jobs is "research" would be the same
 * overclaiming that sank the seriation concept.
 */
export function signals(): Signal[] {
  const out: Signal[] = [];

  // One declared artefact, one unit — see the note on Signal.weight for why duration was
  // removed. `periodYears` is still exported and tested because the fan labels a role's span
  // on hover; it just no longer feeds the loadings.
  for (const t of timeline) out.push({ factor: 'experience', label: t.title, weight: 1 });
  // Research: the paper, plus the declared research interests.
  for (const p of publications) out.push({ factor: 'research', label: p.title, weight: 1 });
  for (const r of researchInterests) out.push({ factor: 'research', label: r.label, weight: 1 });
  // Projects: shipped artefacts.
  for (const p of projects) out.push({ factor: 'projects', label: p.name, weight: 1 });
  // Craft: recognition sits here as evidence of the wider record.
  for (const a of awards) out.push({ factor: 'craft', label: a.title, weight: 1 });

  // Writing and Market reports carry NO signals yet, and the model must show that
  // truthfully — a beam at zero, labelled "coming". Inventing a loading for work that does
  // not exist is exactly the dishonesty this module is built to prevent.
  return out;
}

export interface Loading {
  factor: Factor;
  /** Raw summed weight of the factor's signals. */
  raw: number;
  /** Share of total weight, in [0,1]. Sums to 1 across factors. THIS is beta. */
  beta: number;
  /** How many signals load on this factor. */
  count: number;
}

/**
 * The loadings.
 *
 * beta_k = (summed weight of signals declared on factor k) / (total summed weight).
 *
 * That single line is the model's entire claim, and it is what the on-screen caption says.
 * Betas are shares, so they are non-negative and sum to 1 — which is also why the fan can
 * use beam area to encode them without misleading anyone.
 */
export function loadings(): Loading[] {
  const sig = signals();
  const total = sig.reduce((s, x) => s + x.weight, 0) || 1;
  return FACTORS.map((factor) => {
    const mine = sig.filter((s) => s.factor === factor.key);
    const raw = mine.reduce((s, x) => s + x.weight, 0);
    return { factor, raw, beta: raw / total, count: mine.length };
  });
}

// ── The fan, in 3D ──────────────────────────────────────────────────────────
// Stage two of the owner's idea: the expression EXPANDS into a fan. Each `β_k f_k` term in
// the equation becomes one beam radiating from the asset at the origin, so the picture is
// the equation's terms laid out in space — the maths stays visible as the thing the object
// came from.

export interface Vec3 { x: number; y: number; z: number }

/** One beam: a tapered wedge from the origin out to its tip. */
export interface Beam {
  factor: Factor;
  beta: number;
  /** Azimuth around the vertical axis, radians. */
  azimuth: number;
  /** Elevation above the horizontal plane, radians. */
  elevation: number;
  /** Tip position in world space. */
  tip: Vec3;
  /** Half-width of the wedge at the tip; proportional to beta. */
  halfWidth: number;
  /** Length from origin to tip. */
  length: number;
}

/** Fan geometry constants. Kept here (not in the painter) so the layout is testable and so
 *  the DOM overlay and the renderer read the same numbers. */
export const FAN = {
  /** Beams spread across this arc, centred on straight-ahead. Not a full circle: a full ring
   *  reads as a pie chart and hides half the beams behind the origin.
   *
   *  150 is MEASURED, not chosen. A forward-facing fan needs every tip at z > 0, and
   *  z ∝ cos(azimuth), so |azimuth| must stay under 90°. Sweeping the value:
   *      120° → min z 0.449   150° → 0.233   160° → 0.156
   *      170° → 0.078 (edge-on)            232° → −0.394 (beams behind the viewer)
   *  An earlier 232° put two beams behind the camera where their labels could never be
   *  read. 150° leaves a real margin without collapsing the fan to a narrow cone. */
  spreadDeg: 150,
  /** Beams tilt up as they fan out, so the object is a shallow dome rather than a flat
   *  star — that is what makes it read as 3D from a single still frame. */
  liftDeg: 26,
  /** Length of a beam at beta = 0, and the extra length per unit beta. A zero-loading
   *  factor still gets a visible stub, because "no signal yet" is information. */
  minLength: 0.55,
  lengthGain: 2.6,
  /** Wedge half-width per unit beta, plus a floor so a stub is still a wedge. */
  minHalfWidth: 0.035,
  widthGain: 0.62,
} as const;

/**
 * Lay the beams out.
 *
 * Ordering is by DESCENDING beta, so the largest exposure sits at the fan's centre and the
 * eye reads magnitude by position as well as by size. Ties break on the declared factor
 * order, which keeps the layout deterministic (a Map/Set iteration leak here would produce
 * a different picture per build).
 */
export function fanBeams(): Beam[] {
  const ls = [...loadings()].sort((a, b) => {
    if (b.beta !== a.beta) return b.beta - a.beta;
    return FACTORS.indexOf(a.factor) - FACTORS.indexOf(b.factor);
  });

  const n = ls.length;
  const spread = (FAN.spreadDeg * Math.PI) / 180;
  const lift = (FAN.liftDeg * Math.PI) / 180;

  // Assign the sorted betas to slots alternating outward from the middle, so the largest
  // exposure lands centrally and the smallest at the edges.
  //
  // Done by PERMUTING the real slot indices 0..n-1 rather than by arithmetic around the
  // midpoint: `mid ± k` with a half-integer midpoint produced slots outside the range,
  // which pushed a beam past the declared spread and swung another behind the viewer
  // (negative z, where its label could never be read). Caught by the spread and
  // positive-z tests.
  const centreOut: number[] = [];
  {
    let lo = Math.floor((n - 1) / 2);
    let hi = lo + 1;
    let takeLow = true;
    while (centreOut.length < n) {
      if (takeLow && lo >= 0) centreOut.push(lo--);
      else if (hi < n) centreOut.push(hi++);
      else if (lo >= 0) centreOut.push(lo--);
      takeLow = !takeLow;
    }
  }
  const slotOrder = centreOut;

  return ls.map((l, i) => {
    const slot = slotOrder[i];
    const t = n === 1 ? 0.5 : slot / (n - 1);          // 0..1 across the fan
    const azimuth = -spread / 2 + t * spread;
    // Beams further from centre lift more, so the fan is a dome and the outer beams do not
    // collide with the inner ones on screen.
    const elevation = lift * Math.abs((t - 0.5) * 2) ** 1.4;
    const length = FAN.minLength + l.beta * FAN.lengthGain;
    const halfWidth = FAN.minHalfWidth + l.beta * FAN.widthGain;

    return {
      factor: l.factor,
      beta: l.beta,
      azimuth,
      elevation,
      length,
      halfWidth,
      tip: {
        x: Math.sin(azimuth) * Math.cos(elevation) * length,
        y: Math.sin(elevation) * length,
        z: Math.cos(azimuth) * Math.cos(elevation) * length,
      },
    };
  });
}

/** The four world-space corners of a beam's wedge: two at the origin (narrow), two at the
 *  tip (wide). The wedge lies in the plane containing the beam axis and the world up, so
 *  every beam presents its face to a viewer in front of the fan. */
export function beamQuad(b: Beam): [Vec3, Vec3, Vec3, Vec3] {
  // A horizontal vector perpendicular to the beam's azimuth.
  const px = Math.cos(b.azimuth);
  const pz = -Math.sin(b.azimuth);
  const root = FAN.minHalfWidth * 0.5;
  return [
    { x: -px * root, y: 0, z: -pz * root },
    { x: b.tip.x - px * b.halfWidth, y: b.tip.y, z: b.tip.z - pz * b.halfWidth },
    { x: b.tip.x + px * b.halfWidth, y: b.tip.y, z: b.tip.z + pz * b.halfWidth },
    { x: px * root, y: 0, z: pz * root },
  ];
}

/** The expression's terms, in the fan's own order, for rendering the equation so its terms
 *  line up left-to-right with the beams. */
export function expressionTerms(): { symbol: string; beta: number; label: string }[] {
  return fanBeams()
    .slice()
    .sort((a, b) => a.azimuth - b.azimuth)
    .map((b) => ({ symbol: b.factor.symbol, beta: b.beta, label: b.factor.label }));
}
