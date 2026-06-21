import { describe, it, expect } from 'vitest';
import { EQUATIONS, PAPER_EQUATIONS } from '../src/lib/equations';

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
