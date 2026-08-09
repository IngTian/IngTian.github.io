// src/lib/trajectory.ts
// A CAREER AS A DESCENT WITH ONE ESCAPE — the honest version of the owner's own framing.
//
// His words: "I've spent a very large portion of my career working as a fullstack SDE. Most who
// choose that path stay on it and never think about going into quant. I'm almost running a
// gradient descent on my own while finding that we are at a LOCAL MIN in the SDE — that's why we
// adapted and intended to find the GLOBAL MIN." And then the part that makes it a thesis rather
// than a metaphor: "as we wander we also learn more about OUR SENSITIVITY TO THE WORLD — what we
// really like vs. what we don't."
//
// WHY THIS IS NOT DECORATION. Three things make it literal rather than a simile:
//
// 1. The hero's field ALREADY contains the story. Measured against lib/terrain.ts's own BUMPS:
//        global min    (-1.46, -0.64)  depth -0.9019
//        second basin  ( 1.76,  0.79)  depth -0.4774
//        barrier on the direct path  +0.2646, a 0.7421 climb to escape
//        a plain descent from the second basin PROVABLY stays stuck
//    Two real minima, a real barrier, real entrapment. Nothing relabelled.
//
// 2. It is the paper's own thesis. profile.ts describes RL-BHRP as "learning how to allocate,
//    rather than assuming". The career story is the same structure: not descending a known
//    landscape, but learning the objective while descending.
//
// 3. It explains the SDE-to-quant move WITHOUT self-congratulation. The field looked flat in one
//    direction until he learned he was sensitive to it — a statement about preference discovery,
//    not about being better than other engineers.
//
// HONESTY RULE for this module: every position below is DECLARED, and the file says so. This is
// not a fitted trajectory recovered from data — there is no career loss function to fit. It is a
// stated reading of his own path, laid on a field whose shape is real. The distinction goes on
// the page, because "we fitted your career" would be a lie a quant reader would catch.

import { field, grad } from './terrain';

/** One stop on the path: a real role, placed at a declared position in the loss field. */
export interface Waypoint {
  /** Matches a timeline entry's period in profile.ts, so the two cannot drift apart. */
  period: string;
  label: string;
  /** Declared position in terrain world coordinates (RANGE = 2.6 half-extent). */
  x: number;
  y: number;
  /** Which phase of the story this belongs to. */
  phase: 'approach' | 'basin' | 'escape' | 'descent';
  /** One line, in his voice, about what this stop taught. The SENSITIVITY, not the job. */
  learned: string;
}

/**
 * The declared path.
 *
 * Positions are chosen so the shape is true to the field's real geometry: the engineering years
 * sit inside the SECOND basin (1.76, 0.79) — a genuine local minimum, comfortable and shallow —
 * and the research years head for the GLOBAL basin (-1.46, -0.64). Between them is the measured
 * barrier, which is why the path must climb before it can fall again.
 */
export const WAYPOINTS: Waypoint[] = [
  {
    period: '2019 — 23', label: 'B.Eng · McGill', x: 2.3, y: 1.9, phase: 'approach',
    learned: 'Engineering first, because it was the visible path.',
  },
  {
    period: '2021', label: 'SDE Intern · TikTok', x: 2.05, y: 1.45, phase: 'approach',
    learned: 'Shipping is a skill of its own, and I was good at it.',
  },
  {
    period: '2022', label: 'SDE Intern · Amazon', x: 1.95, y: 1.15, phase: 'approach',
    learned: 'Pipelines move data; they do not ask what the data means.',
  },
  {
    period: '2022 — 23', label: 'Ericsson AI Lab', x: 1.88, y: 0.98, phase: 'basin',
    learned: 'The modelling half held my attention far longer than the plumbing.',
  },
  {
    period: '2023 — 25', label: 'Senior SWE · TikTok', x: 1.76, y: 0.79, phase: 'basin',
    learned: 'A comfortable minimum: 50k QPS, real scale, and still not the question I wanted.',
  },
  {
    period: '2023 —', label: 'Independent quant', x: 0.95, y: 0.42, phase: 'escape',
    learned: 'Built the trading system to test whether the interest was real. It was.',
  },
  {
    period: '2026 —', label: 'Electronic Arts', x: 0.15, y: -0.05, phase: 'escape',
    learned: 'A bridge, chosen deliberately: enough room to keep the research moving.',
  },
  {
    period: 'Fall 2027 —', label: 'PhD · Operations Research', x: -1.46, y: -0.64, phase: 'descent',
    learned: 'Portfolio optimization under Kwon — the objective I was actually looking for.',
  },
];

/** The two basins the story turns on, found by descent rather than declared. */
export interface Basin { x: number; y: number; depth: number }

/** Descend from a point to its basin. Plain gradient descent, so it demonstrably cannot cross a
 *  barrier — which is the point being made, not a limitation to apologise for. */
export function settle(x0: number, y0: number, steps = 3000, lr = 0.02): Basin {
  let x = x0, y = y0;
  for (let i = 0; i < steps; i++) {
    const [gx, gy] = grad(x, y);
    x -= lr * gx;
    y -= lr * gy;
  }
  return { x, y, depth: field(x, y) };
}

/** Distinct minima of the field, deduped by position.
 *
 *  DEDUPE IS LOAD-BEARING: two of terrain.ts's three declared valley centres descend into the
 *  SAME basin, so a naive "sort and take the first two" reports a gap of 0.0000 and the story
 *  evaporates. That exact bug happened while measuring this. */
export function distinctBasins(seeds: readonly [number, number][], tol = 0.15): Basin[] {
  const out: Basin[] = [];
  for (const [sx, sy] of seeds) {
    const b = settle(sx, sy);
    if (!out.some((o) => Math.hypot(o.x - b.x, o.y - b.y) < tol)) out.push(b);
  }
  return out.sort((a, b) => a.depth - b.depth);
}

/** The highest point on the straight path between two basins — the barrier that makes escape
 *  require going uphill. */
export function barrier(a: Basin, b: Basin, samples = 200): { height: number; t: number } {
  let height = -Infinity;
  let t = 0;
  for (let i = 0; i <= samples; i++) {
    const s = i / samples;
    const z = field(a.x + (b.x - a.x) * s, a.y + (b.y - a.y) * s);
    if (z > height) { height = z; t = s; }
  }
  return { height, t };
}

/** The story's measured facts, for the page to state rather than assert. */
export interface TrajectoryFacts {
  globalBasin: Basin;
  localBasin: Basin;
  /** How much deeper the global basin is. */
  gap: number;
  /** Barrier height on the direct path, and the climb required to leave the local basin. */
  barrierHeight: number;
  climbRequired: number;
  /** Proof that a plain descent from the local basin stays put. */
  staysStuck: boolean;
}

export function trajectoryFacts(): TrajectoryFacts {
  const basins = distinctBasins([[-1.4, -0.5], [1.5, 0.7], [0.3, -1.3]]);
  const globalBasin = basins[0];
  const localBasin = basins[1] ?? basins[0];
  const b = barrier(localBasin, globalBasin);
  const nudged = settle(localBasin.x + 0.05, localBasin.y + 0.05);
  return {
    globalBasin,
    localBasin,
    gap: localBasin.depth - globalBasin.depth,
    barrierHeight: b.height,
    climbRequired: b.height - localBasin.depth,
    staysStuck: Math.hypot(nudged.x - localBasin.x, nudged.y - localBasin.y) < 0.1,
  };
}

/** Waypoints grouped by phase, in path order, for staged reveal. */
export function phases(): { phase: Waypoint['phase']; stops: Waypoint[] }[] {
  const order: Waypoint['phase'][] = ['approach', 'basin', 'escape', 'descent'];
  return order.map((phase) => ({ phase, stops: WAYPOINTS.filter((w) => w.phase === phase) }));
}
