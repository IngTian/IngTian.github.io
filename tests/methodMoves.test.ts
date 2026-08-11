import { describe, it, expect } from 'vitest';
import { METHOD_MOVES, type MethodMove } from '../src/data/desk';
import { METHOD_EQUATIONS, METHOD_CHIPS } from '../src/lib/equations';

// THE POINT OF THIS FILE. The method slide's whole argument is that RL, the maths, the stochastic process and
// Bellman are not four subjects but four PARTS OF ONE EQUATION. That claim only holds if the moves and the
// typeset annotations stay in lockstep: a move whose key has no equation renders a blank panel, and an equation
// with no move is never reachable. These tests pin that correspondence, plus the honesty rules on the copy.

const keys = METHOD_MOVES.map((m) => m.key);

describe('the four moves', () => {
  it('has exactly four — one per part of the equation', () => {
    expect(METHOD_MOVES).toHaveLength(4);
  });

  it('uses each key once', () => {
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('has a typeset equation for every move', () => {
    for (const k of keys) {
      expect(METHOD_EQUATIONS[k], `no equation for ${k}`).toBeTruthy();
      expect(METHOD_EQUATIONS[k]).toContain('<math');
    }
  });

  it('has a selector chip for every move', () => {
    for (const k of keys) {
      expect(METHOD_CHIPS[k], `no chip for ${k}`).toBeTruthy();
      // HTML, not MathML, on purpose: eight MathML trees on this slide measurably cost layout time, and a 12px
      // chip does not need real typesetting the way the display equations do. Italic variable + subscript is
      // honest at that size. This asserts the decision stuck rather than silently reverting to KaTeX.
      expect(METHOD_CHIPS[k], `${k} should be plain HTML`).not.toContain('<math');
      expect(METHOD_CHIPS[k]).toMatch(/<i>/);
    }
  });

  // An equation with no move would be unreachable — the selector is built from METHOD_MOVES.
  it('leaves no equation unreachable', () => {
    for (const k of Object.keys(METHOD_EQUATIONS)) expect(keys).toContain(k as MethodMove['key']);
    for (const k of Object.keys(METHOD_CHIPS)) expect(keys).toContain(k as MethodMove['key']);
  });

  it('opens on the principle and closes on our own objective', () => {
    // The order is the argument: the frame first, then the three things it demands, ending on the contribution.
    expect(keys).toEqual(['principle', 'process', 'learned', 'objective']);
  });

  it('gives every move a name, a lede and substance', () => {
    for (const m of METHOD_MOVES) {
      expect(m.name.length, m.key).toBeGreaterThan(3);
      expect(m.lede.length, m.key).toBeGreaterThan(15);
      // The detail is the slide's teaching text; a one-liner here would leave the equation unexplained.
      expect(m.detail.length, m.key).toBeGreaterThan(140);
      expect(m.read.length, m.key).toBeGreaterThan(15);
    }
  });

  it('keeps selector names short enough for a four-across band', () => {
    for (const m of METHOD_MOVES) expect(m.name.length, m.name).toBeLessThanOrEqual(20);
  });
});

describe('the equation annotations', () => {
  it('braces exactly one part in three of the four moves', () => {
    // U+23DF is the under-brace glyph. The `principle` move deliberately has none: that move IS the whole
    // equation, so singling out a part of it would misrepresent what is being said.
    const braced = keys.filter((k) => METHOD_EQUATIONS[k].includes('⏟'));
    expect(braced).toEqual(['process', 'learned', 'objective']);
    expect(METHOD_EQUATIONS.principle).not.toContain('⏟');
  });

  it('carries no text label under the brace', () => {
    // The label was removed on purpose: it set the term's width (so the equation reflowed between moves) and
    // \mathclap's zero-width fix then overlapped neighbouring terms. The selector and the prose do the naming.
    for (const k of keys) {
      expect(METHOD_EQUATIONS[k]).not.toContain('risk-adjusted, net of cost');
      expect(METHOD_EQUATIONS[k]).not.toContain('a model of how the world moves');
    }
  });

  it('is the same equation in every move', () => {
    // Every variant must contain the same four terms; only the brace moves. If a term went missing, the reader
    // would be looking at a different equation and the slide's thesis would quietly break.
    for (const k of keys) {
      const tex = METHOD_EQUATIONS[k];
      for (const part of ['V', 'max', 'r', 'E']) {
        expect(tex, `${k} lost ${part}`).toMatch(new RegExp(part));
      }
    }
  });

  it('typesets without a KaTeX error', () => {
    for (const [k, v] of Object.entries({ ...METHOD_EQUATIONS })) {
      expect(v, k).not.toContain('katex-error');
      expect(v, k).not.toContain('ParseError');
    }
    for (const [k, v] of Object.entries({ ...METHOD_CHIPS })) {
      expect(v, k).not.toContain('katex-error');
      // A chip must name a real term of the equation, not invent notation.
      expect(v.replace(/<[^>]+>/g, ''), k).toMatch(/^[VEru(),.[\]tx+1\u2009\u00b7&;a-z]*$/i);
    }
  });
});

describe('the copy stays honest', () => {
  const all = METHOD_MOVES.map((m) => `${m.lede} ${m.detail}`).join(' ');

  // The site-wide rule: the PhD is incoming, never present tense.
  it('never claims present-tense doctoral work', () => {
    expect(all).not.toMatch(/\bmy PhD\b/i);
    expect(all).not.toMatch(/\bPhD student\b/i);
    expect(all).not.toMatch(/\bas a PhD\b/i);
  });

  it('does not overclaim the drawing as the published model', () => {
    // The lattice is a small honest DP. Saying it IS the paper's model would be a lie the caption contradicts.
    expect(all).not.toMatch(/this is (the|our) (paper|published)/i);
  });

  it('names reinforcement learning as a means, in the move that owns it', () => {
    const rl = METHOD_MOVES.find((m) => m.key === 'learned')!;
    expect(rl.detail.toLowerCase()).toContain('reinforcement learning');
  });

  it('states the objective is not raw return, which is the whole point of the last move', () => {
    const obj = METHOD_MOVES.find((m) => m.key === 'objective')!;
    expect(obj.lede.toLowerCase()).toContain('not maximising return');
    expect(obj.detail.toLowerCase()).toContain('risk');
  });

  it('ties the world model to a stochastic process rather than hand-waving', () => {
    const p = METHOD_MOVES.find((m) => m.key === 'process')!;
    expect(p.detail.toLowerCase()).toContain('stochastic process');
  });
});
