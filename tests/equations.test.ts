import { describe, it, expect } from 'vitest';
import { EQUATIONS } from '../src/lib/equations';

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
