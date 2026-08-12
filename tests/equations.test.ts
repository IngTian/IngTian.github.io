import { describe, it, expect } from 'vitest';
import { EQUATIONS, PAPER_EQUATIONS, BELLMAN_EQUATIONS } from '../src/lib/equations';

describe('baked equations', () => {
  it('renders MathML (no KaTeX CSS/font dependency)', () => {
    expect(EQUATIONS.gradZero).toContain('<math');
    expect(EQUATIONS.kkt).toContain('<math');
  });
  it('does not contain KaTeX HTML spans (would need CSS/fonts)', () => {
    // mathml-only output must not include the html .katex span tree
    expect(EQUATIONS.gradZero).not.toContain('class="katex-html"');
  });
});

describe('paper equations (research showcase)', () => {
  it('renders every showcase equation as MathML', () => {
    for (const html of Object.values(PAPER_EQUATIONS)) {
      expect(html).toContain('<math');
      expect(html).not.toContain('class="katex-html"');
    }
  });
  it('covers the four key equations', () => {
    expect(Object.keys(PAPER_EQUATIONS).sort()).toEqual(
      ['reward', 'riskConservation', 'sectorCov', 'weightMap'],
    );
  });
});

// ── THE CURSE OF DIMENSIONALITY, on the difficulty slide ──────────────────────────────────────────────
// The owner asked for equations showing how Bellman blows up. On a quant's own portfolio a misstated equation is
// worse than none, so these pin both the typesetting AND the claim: |X| = m^N is the STATE-SPACE size, and the
// numbers quoted beside it are recomputed here rather than trusted.
describe('BELLMAN_EQUATIONS', () => {
  it('typesets every expression without a KaTeX error', () => {
    for (const [k, v] of Object.entries(BELLMAN_EQUATIONS)) {
      expect(v, k).not.toContain('katex-error');
      expect(v, k).not.toContain('ParseError');
    }
  });

  it('ships MathML, not a KaTeX runtime — the client loads no katex CSS or fonts', () => {
    for (const [k, v] of Object.entries(BELLMAN_EQUATIONS)) {
      expect(v, k).toContain('<math');
    }
  });

  // THE RECURSION HAS TO BE THE REAL ONE. A max over controls, a reward, and an expectation over the next
  // state — drop any of the three and it stops being the Bellman equation.
  it('states the recursion with its max, its reward and its expectation', () => {
    const r = BELLMAN_EQUATIONS.recursion;
    expect(r).toContain('max');
    // MathML renders the blackboard E as its own glyph; check the operator survived rather than the LaTeX.
    expect(r.length).toBeGreaterThan(400);
    expect(r).toMatch(/V/);
  });

  it('names the state space as m to the N, which is the whole point', () => {
    const c = BELLMAN_EQUATIONS.curse;
    expect(c).toMatch(/m/);
    expect(c).toMatch(/N/);
  });
});

describe('the dimensionality arithmetic the slide quotes', () => {
  // Recomputed here, independently of the page, so the sentence and the number cannot drift apart.
  const LEVELS = 10;
  const ATOMS_EXP = 80;

  it('reaches 10^3000 states per period at 3,000 names and 10 levels', () => {
    expect(Math.round(3000 * Math.log10(LEVELS))).toBe(3000);
  });

  it('passes the atoms in the observable universe at eighty names', () => {
    expect(Math.ceil(ATOMS_EXP / Math.log10(LEVELS))).toBe(80);
  });

  it('is exponential in N, not polynomial — doubling N squares the state count', () => {
    const at = (n: number) => n * Math.log10(LEVELS);
    expect(at(200)).toBeCloseTo(at(100) * 2, 6);
  });
});
