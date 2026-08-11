import { describe, it, expect } from 'vitest';
import { ATTACK_MOVES, OPEN_HEADING, OPEN_STATEMENT, OPEN_CLOSE } from '../src/data/desk';
import * as equations from '../src/lib/equations';
import { LEVELS, PERIODS, solve, candidates } from '../src/lib/bellman';

// THE POINT OF THIS FILE. It replaces tests/methodMoves.test.ts, which pinned a thesis that has been retracted:
// that RL, the maths, the stochastic process and Bellman are four parts of one equation, walked over a typeset
// recursion. The owner stopped that —
//
//   "we dont know how to solve this problem yet. it's an open problem. so dont write out that equation as if
//    it's known. it's not. i only have some ideas how to attack this, from RL, with math, or, stochastic
//    process, probability, as the backbone."
//
// — so the old assertions were actively harmful: they would have failed the honest version and passed the
// overclaiming one. What is pinned now is the openness itself, in both directions. OVERCLAIM is the failure the
// owner caught; UNDERCLAIM is the failure that would come from fixing it badly, and a slide reading "it's hard
// and I have ideas" would be worthless. Both are asserted.

const keys = ATTACK_MOVES.map((m) => m.key);
const allCopy = [
  OPEN_HEADING,
  OPEN_STATEMENT,
  OPEN_CLOSE,
  ...ATTACK_MOVES.flatMap((m) => [m.lede, m.detail, m.limit, m.read]),
].join('  ');

describe('the four directions', () => {
  it('has four, in the order the argument needs', () => {
    // Backbone first because the other two stand on it; the owner's own attempt last, so the slide ends on
    // what he did rather than on what the field lacks.
    expect(keys).toEqual(['backbone', 'structure', 'learning', 'attempt']);
  });

  it('gives every direction a discipline tag, a name, a lede, substance, a limit and a figure read-out', () => {
    for (const m of ATTACK_MOVES) {
      expect(m.tag.length, m.key).toBeGreaterThan(3);
      expect(m.name.length, m.key).toBeGreaterThan(3);
      expect(m.lede.length, m.key).toBeGreaterThan(30);
      expect(m.detail.length, m.key).toBeGreaterThan(180);
      expect(m.read.length, m.key).toBeGreaterThan(20);
    }
  });

  // THE HONESTY MECHANISM. Every direction states what it does NOT give you, on the slide. A limit that shrank
  // to a token phrase would quietly turn the slide back into a list of things the author likes.
  it('makes every direction carry a substantial limit', () => {
    for (const m of ATTACK_MOVES) {
      expect(m.limit.length, `${m.key}'s limit is too thin to be honest`).toBeGreaterThan(140);
    }
  });

  it('covers the four things the owner named', () => {
    const tags = ATTACK_MOVES.map((m) => m.tag.toLowerCase()).join(' ');
    for (const named of ['stochastic process', 'probability', 'reinforcement learning']) {
      expect(tags, `no direction tagged ${named}`).toContain(named);
    }
    // "math" as the owner said it — convex optimisation and duality are the concrete form on this slide.
    expect(tags).toMatch(/convex|optimis|duality/);
  });

  it('keeps selector names and tags short enough for a four-across band', () => {
    for (const m of ATTACK_MOVES) {
      expect(m.name.length, m.name).toBeLessThanOrEqual(22);
      expect(m.tag.length, m.tag).toBeLessThanOrEqual(34);
    }
  });
});

describe('the slide does not claim the problem is solved', () => {
  it('never says the problem is solved, or that a method exists', () => {
    expect(allCopy).not.toMatch(/solves? the problem/i);
    expect(allCopy).not.toMatch(/we (have )?solved/i);
    expect(allCopy).not.toMatch(/\bthe (whole )?method\b/i);
    expect(allCopy).not.toMatch(/our (approach|method) solves/i);
  });

  it('says outright that it is not a method yet', () => {
    // Matched loosely on purpose: the line reads "None of this is a method yet", so a literal substring test for
    // "not a method yet" fails on copy that is doing exactly the right thing.
    expect(OPEN_CLOSE.toLowerCase()).toMatch(/is (not a method|a method yet)/);
  });

  // The word "Solved." used to be the terminal figure read-out, written into an aria-live region — so a screen
  // reader heard this slide end on it. It is not true of the real problem and it was not even true of the toy,
  // where backward induction fills a table rather than finishing a search.
  it('never puts the word "solved" in a figure read-out', () => {
    for (const m of ATTACK_MOVES) {
      expect(m.read.toLowerCase(), m.key).not.toContain('solved');
    }
  });

  it('carries no typeset method equation any more', () => {
    // The four annotated Bellman variants are gone. BELLMAN_EQUATIONS stays: on the difficulty slide the same
    // recursion is TRUE, because there it is the thing that blows up.
    expect(equations).not.toHaveProperty('METHOD_EQUATIONS');
    expect(equations).not.toHaveProperty('METHOD_CHIPS');
    expect(equations).toHaveProperty('BELLMAN_EQUATIONS');
  });
});

describe('the slide does not underclaim either', () => {
  // The opposite failure, and the likelier one when fixing an overclaim: hedging until nothing is said.
  it('states plainly that large parts ARE solved', () => {
    expect(OPEN_HEADING.toLowerCase()).toMatch(/solved/);
    expect(allCopy).not.toMatch(/nobody knows anything|no one knows anything/i);
  });

  it('names real, checkable results rather than gesturing at a literature', () => {
    // Every direction must cite something a reader can look up. Vague authority is the same failure as no
    // authority, and this is the assertion that stops the copy drifting back into hand-waving.
    for (const m of ATTACK_MOVES) {
      const text = `${m.detail} ${m.limit}`;
      // A parenthesised year for a cited result, OR an arXiv id — the owner's own attempt cites itself, which is
      // the most checkable reference on the slide and should not be forced into a fake parenthetical.
      const cited = /\(([^)]*\b(19|20)\d{2}\b[^)]*)\)/.test(text) || /arXiv:\d{4}\.\d{4,5}/.test(text)
        || /\bS\. Kang\b/.test(text);
      expect(cited, `${m.key} cites nothing checkable`).toBe(true);
    }
  });

  it('states precisely what is missing, not merely that it is hard', () => {
    expect(OPEN_STATEMENT).toMatch(/not the equation/i);
    expect(OPEN_STATEMENT.length).toBeGreaterThan(200);
  });
});

describe('the paper is described honestly', () => {
  const attempt = ATTACK_MOVES.find((m) => m.key === 'attempt')!;

  it('calls it a preprint and never published', () => {
    // arXiv:2508.11856 is not peer reviewed. profile.ts already says "arXiv preprint"; this keeps the slide
    // consistent with it.
    expect(attempt.lede.toLowerCase()).toContain('preprint');
    expect(`${attempt.lede} ${attempt.detail} ${attempt.limit}`).not.toMatch(/\bpublished\b/i);
  });

  it('calls it one attempt, not a solution', () => {
    expect(attempt.name.toLowerCase()).toContain('attempt');
    expect(attempt.lede.toLowerCase()).toContain('one attempt');
  });

  it('credits the co-author', () => {
    expect(attempt.detail).toContain('S. Kang');
  });

  // Corroborated by profile.ts, which transcribes the paper's Table 2: 67 periods, 2020-02-29 -> 2025-08-31.
  it('quotes the out-of-sample window that profile.ts transcribes', () => {
    expect(attempt.detail).toMatch(/sixty-seven|67/);
    expect(attempt.detail).toMatch(/February 2020/);
    expect(attempt.detail).toMatch(/August 2025/);
  });

  it('names the bar it has not cleared', () => {
    expect(attempt.limit.toLowerCase()).toMatch(/not measured against|have not cleared/);
  });

  it('does not claim the learned layer adapts as conditions shift', () => {
    // The exact phrase from the deleted TOOLKIT entry, and the trap the grounding flagged: it describes RL as a
    // settled capability of the approach rather than as an attempt.
    expect(allCopy).not.toMatch(/adapts?[^.]{0,40}as (market )?conditions shift/i);
  });
});

describe('the PhD stays incoming', () => {
  it('never claims present-tense doctoral work', () => {
    expect(allCopy).not.toMatch(/\bmy PhD\b/i);
    expect(allCopy).not.toMatch(/\bPhD student\b/i);
    expect(allCopy).not.toMatch(/\bmy (research )?group\b/i);
    expect(allCopy).not.toMatch(/\bmy lab\b/i);
  });
});

describe('the figure is described in counts that hold up', () => {
  // The caption states these, so the arithmetic is pinned here: a caption that drifts from lib/bellman.ts would
  // be a wrong number on a slide whose whole subject is not overstating things.
  const sol = solve();

  it('has a horizon layer that is zero by construction', () => {
    expect(sol.value[PERIODS].every((v) => v === 0)).toBe(true);
  });

  it('agrees with the caption on decisions and comparisons', () => {
    expect(PERIODS * LEVELS).toBe(108);
    expect(PERIODS * LEVELS * LEVELS).toBe(972);
  });

  it('agrees with the caption on the paths never visited', () => {
    expect(Math.pow(LEVELS, PERIODS)).toBe(282_429_536_481);
    // The caption rounds this to 2.8x10^11.
    expect(Math.pow(LEVELS, PERIODS) / 1e11).toBeCloseTo(2.8, 1);
  });

  it('agrees with the legend on the number of rivals drawn', () => {
    expect(candidates().length).toBe(29);
    const structure = ATTACK_MOVES.find((m) => m.key === 'structure')!;
    expect(structure.read).toContain('29');
  });
});
