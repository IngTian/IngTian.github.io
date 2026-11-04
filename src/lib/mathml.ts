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
  throw new Error(`fixMathVariants: Unicode has no ${variant} "${c}"`);
}

// One element's text, letter by letter: KaTeX puts adjacent digits in one <mn> (\mathbb{12} is <mn>12</mn>).
const letters = (variant: string, text: string) => [...text].map((c) => letter(variant, c)).join('');

/** Rewrites KaTeX's script and double-struck letters as Unicode math letters. Throws on a letter with no Unicode
 *  form (a script Greek letter, a script digit) and on any such mathvariant it could not rewrite, so a glyph is
 *  never silently drawn plain. */
export function fixMathVariants(mathml: string): string {
  const out = mathml.replace(/<(mi|mn) mathvariant="(script|double-struck)">([^<]*)<\/\1>/g,
    (_, tag: string, variant: string, c: string) => `<${tag}>${letters(variant, c)}</${tag}>`);
  const left = out.match(/mathvariant="(?:script|double-struck)"/);
  if (left) throw new Error(`fixMathVariants: a ${left[0]} not on a single <mi> or <mn> letter`);
  return out;
}

type HNode = { type: string; tagName?: string; properties?: Record<string, unknown>; children?: HNode[]; value?: string };

/** The same rewrite as a rehype step over every markdown file's MathML (after rehype-katex), so a \mathbb in
 *  /writing draws as it does on the homepage. Throws as fixMathVariants does, naming the TeX it was in. */
export function rehypeMathVariants() {
  return (tree: unknown) => fixTree(tree as HNode, '');
}

function fixTree(n: HNode, tex: string): void {
  if (n.tagName === 'math') tex = annotation(n) ?? tex;
  const variant = n.properties?.mathvariant;
  if (typeof variant === 'string' && variant in ALPHABETS) {
    const t = n.children?.[0];
    if ((n.tagName !== 'mi' && n.tagName !== 'mn') || n.children?.length !== 1 || t?.type !== 'text') {
      throw new Error(`fixMathVariants: a mathvariant="${variant}" not on a single <mi> or <mn> letter, in $${tex}$`);
    }
    try {
      t.value = letters(variant, t.value ?? '');
    } catch (e) {
      throw new Error(`${(e as Error).message}, in $${tex}$`);
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
