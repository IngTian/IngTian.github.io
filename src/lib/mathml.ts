// src/lib/mathml.ts
// KaTeX writes \mathcal, \mathscr and \mathbb as <mi mathvariant="script"> and "double-struck", and Chrome's
// MathML Core honours no mathvariant but "normal": 𝒳 draws as a plain italic X, ℝ as R. Unicode has each of these
// letters as a character of its own, so they are written as the character, which every engine draws.

const LATIN = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

// The Mathematical Alphanumeric Symbols run A-Z then a-z from one code point per alphabet, except where Unicode
// had already encoded a letter in Letterlike Symbols: that slot is left empty and the letter lives there instead.
const ALPHABETS: Record<string, { from: number; holes: Record<string, number>; digits?: number }> = {
  script: {
    from: 0x1d49c,
    holes: { B: 0x212c, E: 0x2130, F: 0x2131, H: 0x210b, I: 0x2110, L: 0x2112, M: 0x2133, R: 0x211b, e: 0x212f, g: 0x210a, o: 0x2134 },
  },
  'double-struck': {
    from: 0x1d538,
    digits: 0x1d7d8,
    holes: { C: 0x2102, H: 0x210d, N: 0x2115, P: 0x2119, Q: 0x211a, R: 0x211d, Z: 0x2124 },
  },
};

function letter(variant: string, c: string): string {
  const a = ALPHABETS[variant], i = LATIN.indexOf(c);
  if (c.length === 1 && i >= 0) return String.fromCodePoint(a.holes[c] ?? a.from + i);
  if (a.digits !== undefined && /^[0-9]$/.test(c)) return String.fromCodePoint(a.digits + Number(c));
  throw new Error(`Unicode has no ${variant} "${c}"`);
}

// One element's text, letter by letter: KaTeX puts adjacent digits in one <mn> (\mathbb{12} is <mn>12</mn>).
const letters = (variant: string, text: string) => [...text].map((c) => letter(variant, c)).join('');

// ALPHABETS' keys are the one statement of which variants are rewritten, for the string and the tree alike: an
// alphabet added there is drawn by lib/equations.ts and by every markdown file at once.
const VARIANT = Object.keys(ALPHABETS).join('|');
const ON_LETTER = new RegExp(`<(mi|mn) mathvariant="(${VARIANT})">([^<]*)</\\1>`, 'g');
// Whatever is left after the rewrite but "normal", the one mathvariant Chrome's MathML Core honours.
const LEFT = /mathvariant="((?!normal")[^"]*)"/;
/** Why a mathvariant left in would be drawn plain: one this rewrites, not on a letter, or one it has no rewrite for. */
const unrewritten = (variant: string) => (Object.hasOwn(ALPHABETS, variant)
  ? `a mathvariant="${variant}" not on a single <mi> or <mn> letter`
  : `mathvariant="${variant}" has no rewrite (Chrome draws it plain): add its alphabet to lib/mathml.ts, or write the letter`);

/** Rewrites KaTeX's script and double-struck letters as Unicode math letters. Throws on a letter with no Unicode
 *  form (a script Greek letter, a script digit) and on any mathvariant but "normal" it leaves (one it could not
 *  rewrite, or bold, fraktur and the others it has no alphabet for), so a glyph is never silently drawn plain. */
export function fixMathVariants(mathml: string): string {
  try {
    const out = mathml.replace(ON_LETTER, (_, tag: string, variant: string, c: string) => `<${tag}>${letters(variant, c)}</${tag}>`);
    const left = LEFT.exec(out);
    if (left) throw new Error(unrewritten(left[1]));
    return out;
  } catch (e) {
    throw new Error(`fixMathVariants: ${(e as Error).message}`);
  }
}

type HNode = { type: string; tagName?: string; properties?: Record<string, unknown>; children?: HNode[]; value?: string };

/** The same rewrite as a rehype step over every markdown file's MathML (after rehype-katex), so a \mathbb in
 *  /writing draws as it does on the homepage. Throws where fixMathVariants does, naming the TeX it was in. */
export function rehypeMathVariants() {
  return (tree: unknown) => fixTree(tree as HNode, '');
}

function fixTree(n: HNode, tex: string): void {
  if (n.tagName === 'math') tex = annotation(n) ?? tex;
  const variant = n.properties?.mathvariant;
  if (typeof variant === 'string' && variant !== 'normal') {
    const t = n.children?.[0];
    try {
      if (!Object.hasOwn(ALPHABETS, variant) || (n.tagName !== 'mi' && n.tagName !== 'mn') || n.children?.length !== 1 || t?.type !== 'text') {
        throw new Error(unrewritten(variant));
      }
      t.value = letters(variant, t.value ?? '');
    } catch (e) {
      throw new Error(`rehypeMathVariants: ${(e as Error).message}, in $${tex}$`);
    }
    delete n.properties!.mathvariant;
  }
  n.children?.forEach((c) => fixTree(c, tex));
}

function annotation(n: HNode): string | undefined {
  if (n.tagName === 'annotation') return n.children?.[0]?.value;
  for (const c of n.children ?? []) {
    const a = annotation(c);
    if (a !== undefined) return a;
  }
  return undefined;
}
