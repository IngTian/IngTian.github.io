import { describe, it, expect } from 'vitest';
import { METHODOLOGIES, OPEN_HEADING, OPEN_STATEMENT, OPEN_CLOSE } from '../src/data/desk';
import { publications } from '../src/data/profile';
import * as equations from '../src/lib/equations';
import { LEVELS, PERIODS, solve, candidates } from '../src/lib/bellman';

// THE POINT OF THIS FILE, and it is the third version of it. The last slide has been wrong twice in opposite
// directions, so what is pinned here is the narrow band between them.
//
//   1. It typeset the Bellman recursion as "the method" — asserting a formulation and a solution for a problem
//      that has neither. tests/methodMoves.test.ts pinned THAT thesis and had to be deleted, because it would
//      have failed the honest version and passed the overclaiming one.
//   2. The fix over-corrected into a dated literature survey with a labelled limit per direction. Accurate, but
//      it read as a map of a solved field. The owner: "we only name a few methodologies only general ones to
//      begin with. thats more truthful ... we dont need to go that deep."
//
// So the assertions below hold three things at once: the slide never claims a solution, it never claims anything
// is solved (the previous heading opened "Large pieces of this are solved", which he rejected outright), and it
// still says something — a general direction stated plainly is not the same as a vague one.

const keys = METHODOLOGIES.map((m) => m.key);
const allCopy = [
  OPEN_HEADING,
  OPEN_STATEMENT,
  OPEN_CLOSE,
  ...METHODOLOGIES.flatMap((m) => [m.tag, m.name, m.lede, m.detail, m.read]),
].join('  ');

describe('a few general methodologies', () => {
  it('runs from the ground up: describe, estimate, optimise, sequence', () => {
    // Order is the argument. You cannot estimate a model you have not chosen, cannot optimise inputs you have
    // not estimated, and the sequence is what the first three are eventually for.
    expect(keys).toEqual(['probability', 'estimation', 'optimisation', 'control']);
  });

  it('is a FEW, not a survey', () => {
    // Guard against drifting back into a literature review with a reading list per family. Four is the ceiling:
    // "we only name a few methodologies only general ones to begin with ... we dont need to go that deep."
    expect(METHODOLOGIES.length).toBeLessThanOrEqual(4);
  });

  // The owner: "probability + convex optimization + rl might just be tools to do this. but there are more right?
  // i dont think only these 3 actually." A short list is fine; a short list PRESENTED AS COMPLETE is not.
  it('says outright that the list is not complete', () => {
    expect(`${OPEN_STATEMENT} ${OPEN_CLOSE}`.toLowerCase()).toMatch(/not a full toolbox|not a complete list|a few of/);
  });

  it('still names each of the three families the owner said himself', () => {
    const all = METHODOLOGIES.map((m) => `${m.tag} ${m.name} ${m.detail}`).join(' ').toLowerCase();
    for (const named of ['stochastic process', 'probability', 'reinforcement learning']) {
      expect(all, `${named} went missing`).toContain(named);
    }
    expect(all).toMatch(/convex|optimis/);
  });

  it('gives each one a tag, a name, a lede, substance and a figure read-out', () => {
    for (const m of METHODOLOGIES) {
      expect(m.tag.length, m.key).toBeGreaterThan(3);
      expect(m.name.length, m.key).toBeGreaterThan(8);
      expect(m.lede.length, m.key).toBeGreaterThan(30);
      expect(m.detail.length, m.key).toBeGreaterThan(160);
      expect(m.read.length, m.key).toBeGreaterThan(20);
    }
  });

  // GENERAL, which is the whole instruction. A dated citation is the tell that this has drifted back into a
  // literature review — the previous version cited Mossin 1968, Gârleanu–Pedersen 2013, Michaud 1989 and more.
  it('stays general — no dated citations in the tab copy', () => {
    for (const m of METHODOLOGIES) {
      const text = `${m.lede} ${m.detail}`;
      expect(text, `${m.key} cites a dated result; keep the tabs general`).not.toMatch(/\b(19|20)\d{2}\b/);
      expect(text, `${m.key} cites a named author`).not.toMatch(/\bet al\b/i);
    }
  });

  it('keeps each direction to a couple of sentences rather than a lecture', () => {
    for (const m of METHODOLOGIES) {
      expect(m.detail.length, `${m.key} is going too deep`).toBeLessThan(420);
    }
  });

  it('keeps names and tags short enough for a three-across band', () => {
    for (const m of METHODOLOGIES) {
      expect(m.name.length, m.name).toBeLessThanOrEqual(34);
      expect(m.tag.length, m.tag).toBeLessThanOrEqual(24);
    }
  });
});

describe('nothing is claimed as solved', () => {
  it('has the heading the owner asked for', () => {
    expect(OPEN_HEADING.toLowerCase()).toContain('still an open problem');
  });

  // He rejected the previous heading in these words: "i wouldnt say this as solved."
  it('never says any part of it is solved, in the heading or the thesis', () => {
    expect(OPEN_HEADING.toLowerCase()).not.toMatch(/solved/);
    expect(OPEN_STATEMENT.toLowerCase()).not.toMatch(/\bsolved\b/);
    expect(allCopy).not.toMatch(/solves? the problem/i);
    expect(allCopy).not.toMatch(/we (have )?solved/i);
    expect(allCopy).not.toMatch(/\bthe (whole )?method\b/i);
  });

  // NO ASSERTION about what is achievable. An earlier thesis said "The realistic ambition is a chunk: solve a
  // small part properly, then widen" and the owner asked what evidence there was for it. There is none — it was
  // editorialising dressed as a finding. This test now forbids that class of claim instead of requiring it.
  it('makes no unevidenced claim about what is achievable', () => {
    expect(allCopy).not.toMatch(/realistic ambition/i);
    expect(allCopy).not.toMatch(/\bwill (eventually )?(be )?solv/i);
    expect(allCopy).not.toMatch(/in (the )?future,? (we|I) (can|will|could)/i);
  });

  it('says these are directions rather than results', () => {
    expect(OPEN_CLOSE.toLowerCase()).toMatch(/directions, not results/);
  });

  // "Solved." was once the terminal figure read-out, in an aria-live region, so a screen reader heard this slide
  // end on it. It was not true of the real problem and not even true of the toy.
  it('never puts the word "solved" in a figure read-out', () => {
    for (const m of METHODOLOGIES) {
      expect(m.read.toLowerCase(), m.key).not.toContain('solved');
    }
  });

  it('carries no typeset method equation', () => {
    // BELLMAN_EQUATIONS stays: on the difficulty slide the same recursion is TRUE, because there it is the thing
    // that blows up rather than the thing being offered.
    expect(equations).not.toHaveProperty('METHOD_EQUATIONS');
    expect(equations).not.toHaveProperty('METHOD_CHIPS');
    expect(equations).toHaveProperty('BELLMAN_EQUATIONS');
  });
});

describe('the paper is not on this slide', () => {
  // "you can also drop the first one attempt. that's what work is for." Naming a preprint on a slide about an
  // open problem implied the attempt had closed part of it; the work section is where work belongs.
  it('names no publication, arXiv id or co-author', () => {
    expect(allCopy).not.toMatch(/arXiv/i);
    expect(allCopy).not.toMatch(/RL-BHRP/i);
    expect(allCopy).not.toMatch(/preprint/i);
    expect(allCopy).not.toMatch(/S\. Kang/);
  });

  it('points at the work instead', () => {
    expect(OPEN_CLOSE.toLowerCase()).toMatch(/work/);
  });

  // ...and the paper is still reachable, so dropping the tab loses nothing.
  it('leaves the publication itself intact in the data', () => {
    expect(publications.some((p) => p.arxivId === '2508.11856')).toBe(true);
  });
});

describe('it does not underclaim either', () => {
  it('says precisely what is missing, not merely that it is hard', () => {
    expect(OPEN_STATEMENT.toLowerCase()).toMatch(/how far from optimal/);
    expect(OPEN_STATEMENT.length).toBeGreaterThan(160);
  });

  it('gives every direction real content, not a label', () => {
    // The failure mode of "keep it general" is saying nothing. Each direction must name what it brings AND what
    // it does not settle, even without citations.
    for (const m of METHODOLOGIES) {
      // Two substantial sentences is not a label; the length floor above is what rules out a one-liner. An
      // earlier version of this demanded three and flagged perfectly good copy.
      expect(m.detail.split(/[.!?]\s/).length, `${m.key} needs more than one sentence`).toBeGreaterThanOrEqual(2);
    }
  });

  it('never claims a learned policy adapts as conditions shift', () => {
    // The exact phrasing of the deleted TOOLKIT entry: it describes RL as a settled capability.
    expect(allCopy).not.toMatch(/adapts?[^.]{0,40}as (market )?conditions shift/i);
  });
});

describe('the PhD stays incoming', () => {
  it('never claims present-tense doctoral work', () => {
    expect(allCopy).not.toMatch(/\bmy PhD\b/i);
    expect(allCopy).not.toMatch(/\bPhD student\b/i);
    expect(allCopy).not.toMatch(/\bmy (research )?group\b|\bmy lab\b/i);
  });
});

describe('the figure is described in counts that hold up', () => {
  const sol = solve();

  it('has a horizon layer that is zero by construction', () => {
    expect(sol.value[PERIODS].every((v) => v === 0)).toBe(true);
  });

  it('agrees with the caption on decisions, comparisons and paths', () => {
    expect(PERIODS * LEVELS).toBe(108);
    expect(PERIODS * LEVELS * LEVELS).toBe(972);
    expect(Math.pow(LEVELS, PERIODS)).toBe(282_429_536_481);
  });

  it('agrees with the read-out on the number of rivals drawn', () => {
    expect(candidates().length).toBe(29);
    const opt = METHODOLOGIES.find((m) => m.key === 'optimisation')!;
    expect(opt.read).toContain('29');
    // And the figures quoted in the estimation family, which are the only hard numbers in the tabs.
    const est = METHODOLOGIES.find((m) => m.key === 'estimation')!;
    const N = 3000;
    expect(Math.round((N * (N + 1)) / 2 / 1e6)).toBe(5);       // 4.5m rounds to about four and a half million
    expect(est.detail).toMatch(/four and a half million/);
    expect(Math.round(N / 252)).toBe(12);                       // ~12 years of daily data to be invertible
    expect(est.detail).toMatch(/twelve years/);
  });
});
