import katex from 'katex';
import { describe, expect, it } from 'vitest';
import { fixMathVariants } from '../src/lib/mathml';

const mathml = (tex: string) => katex.renderToString(tex, { output: 'mathml', throwOnError: true });
const LATIN = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const one = (variant: string, c: string, tag = 'mi') =>
  fixMathVariants(`<${tag} mathvariant="${variant}">${c}</${tag}>`).replace(/^<\w+>|<\/\w+>$/g, '');

describe('fixMathVariants', () => {
  it('writes a script letter as the Unicode letter, with no mathvariant left for Chrome to ignore', () => {
    const out = fixMathVariants('<mi mathvariant="script">G</mi>');
    expect(out).toContain('𝒢');
    expect(out).not.toContain('mathvariant="script"');
  });

  it('rewrites what KaTeX actually emits for \\mathcal, \\mathscr and \\mathbb', () => {
    for (const [tex, letter] of [['\\mathcal{X}', '𝒳'], ['\\mathscr{G}', '𝒢'], ['\\mathbb{E}', '𝔼'], ['\\mathbb{R}^N', 'ℝ'], ['\\mathbb{1}', '𝟙']]) {
      const out = fixMathVariants(mathml(tex));
      expect(out, tex).toContain(letter);
      expect(out, tex).not.toMatch(/mathvariant="(?:script|double-struck)"/);
    }
  });

  // Unicode's own decomposition is the oracle: NFKC folds every math letter back to its plain letter, and an
  // unassigned code point (the reserved gaps in the block, where a wrong offset would land) is not a letter at all.
  it('maps every Latin letter, in both alphabets, to that letter at an assigned code point', () => {
    for (const variant of ['script', 'double-struck']) {
      const out = [...LATIN].map((c) => one(variant, c));
      out.forEach((ch, i) => {
        expect(ch.normalize('NFKC'), `${variant} ${LATIN[i]}`).toBe(LATIN[i]);
        expect(ch, `${variant} ${LATIN[i]}`).toMatch(/^\p{L}$/u);
      });
      expect(new Set(out).size).toBe(LATIN.length);
    }
    for (const d of '0123456789') expect(one('double-struck', d, 'mn').normalize('NFKC')).toBe(d);
  });

  it('uses the Letterlike Symbols where the block has a gap, and the right alphabet elsewhere', () => {
    // code points from the Unicode charts (U+1D400 block, and Letterlike Symbols U+2100)
    expect(one('script', 'I').codePointAt(0)).toBe(0x2110);
    expect(one('script', 'G').codePointAt(0)).toBe(0x1d4a2);
    expect(one('script', 'e').codePointAt(0)).toBe(0x212f);
    expect(one('double-struck', 'R').codePointAt(0)).toBe(0x211d);
    expect(one('double-struck', 'E').codePointAt(0)).toBe(0x1d53c);
    expect(one('double-struck', '1', 'mn').codePointAt(0)).toBe(0x1d7d9);
  });

  it('throws on a letter it has no Unicode form for, naming it', () => {
    expect(() => fixMathVariants('<mi mathvariant="script">λ</mi>')).toThrow(/λ/);
    expect(() => fixMathVariants(mathml('\\mathcal{2}'))).toThrow(/2/);
  });

  it('leaves everything else as it was', () => {
    const plain = mathml('\\mathrm{RC}_i(w) = \\sigma_p^2');
    expect(fixMathVariants(plain)).toBe(plain);
  });
});
