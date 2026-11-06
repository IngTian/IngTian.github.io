import { describe, it, expect } from 'vitest';
import { EQUATIONS, BELLMAN_EQUATIONS } from '../src/lib/equations';

const tex = (mathml: string) => /<annotation encoding="application\/x-tex">([\s\S]*?)<\/annotation>/.exec(mathml)?.[1] ?? '';

describe('baked equations', () => {
  // MathML only: KaTeX's HTML tree would need its CSS and fonts. Chrome's MathML Core draws
  // mathvariant="double-struck"/"script" as a plain italic letter, so those are Unicode letters.
  it('are MathML with no KaTeX HTML, no error, and no script or blackboard mathvariant', () => {
    const all = Object.entries({ ...EQUATIONS, ...BELLMAN_EQUATIONS });
    expect(all.length).toBeGreaterThanOrEqual(4);
    for (const [k, v] of all) {
      expect(v, k).toContain('<math');
      expect(v, k).not.toMatch(/katex-html|katex-error|mathvariant="(?:script|double-struck)"/);
    }
    expect(BELLMAN_EQUATIONS.recursion).toContain('𝔼');
    expect(BELLMAN_EQUATIONS.curse).toContain('𝒳');
  });

  // On a quant's own portfolio a misstated equation is worse than none. The recursion is the real one only with its
  // max over controls, its reward and its expectation over the next state; |X| = m^N is the STATE-SPACE size.
  it('state the Bellman recursion with its max, reward and expectation, and the state space as m to the N', () => {
    expect(tex(BELLMAN_EQUATIONS.recursion)).toMatch(/\\max_[\s\S]*r\(x,u\)[\s\S]*\\mathbb\{E\}/);
    expect(tex(BELLMAN_EQUATIONS.curse)).toContain('m^{N}');
  });
});
