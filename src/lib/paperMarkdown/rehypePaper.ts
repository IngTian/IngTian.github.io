// src/lib/paperMarkdown/rehypePaper.ts
// The rehype half of the paper format, after rehype-katex and the MathML letter fix, when the maths is real
// MathML: KaTeX's errors are reported, the Notation table's symbols are found in the displays and tagged with
// their row, and the words a reader reads are counted. Papers only.
import { countWords, wholeParts } from '../words';
import { isPaper, plain, report, walk, type Node } from './remarkPaper';

const has = (n: Node, cls: string) => (n.properties?.className as string[] | undefined)?.includes(cls) ?? false;
const isEl = (n: Node | undefined, tag?: string): n is Node => n?.type === 'element' && (!tag || n.tagName === tag);

function same(a: Node, b: Node): boolean {
  if (a.type !== b.type) return false;
  if (a.type === 'text') return a.value === b.value;
  const ka = a.children ?? [], kb = b.children ?? [];
  return a.tagName === b.tagName && JSON.stringify(a.properties) === JSON.stringify(b.properties)
    && ka.length === kb.length && ka.every((c, i) => same(c, kb[i]));
}

/** A row's symbols: every maths in its Symbol cell (`$N$, $G$` is two), each split at the commas between symbols
 *  (`N,\ G` is two as well), spaces dropped. A membership introduces its subject and its set's index, a subscript:
 *  `i ∈ 𝓘_g`, stock i of sector g, is i and g. Not the set, which is where the subject lives, nor a superscript of
 *  it: in `w ∈ ℝ^N` only w, as N is a dimension, a symbol only through a row of its own. An index yields to a row
 *  that has it as its own symbol (`index`). `tex` is the cell as written, for a problem to name. */
function symbolsOf(row: Node): { tex: string; parts: { nodes: Node[]; index: boolean }[] } {
  const cell = row.children?.find((c) => isEl(c, 'th')) ?? row, maths: Node[] = [];
  walk(cell, (n) => { if (isEl(n, 'math')) maths.push(n); });
  const parts = maths.flatMap((math) => {
    const semantics = math.children?.find((c) => isEl(c, 'semantics'));
    const body = semantics?.children?.filter((c) => isEl(c) && c.tagName !== 'annotation') ?? [];
    const seq = body.length === 1 && body[0].tagName === 'mrow' ? body[0].children ?? [] : body;
    const own: Node[][] = [[]], sets: Node[][] = [];
    for (const c of seq) {
      const member = isEl(c, 'mo') && plain(c) === '∈';
      if (member || (isEl(c, 'mo') && c.properties?.separator === 'true')) own.push([]);
      else if (!(isEl(c, 'mspace') || (isEl(c, 'mtext') && !plain(c).trim()))) own.at(-1)!.push(c);
      if (member) sets.push(own.at(-1)!);
    }
    const index = sets.flatMap(([s, ...more]) => {
      const sub = !more.length && (isEl(s, 'msub') || isEl(s, 'msubsup')) ? s.children!.filter((c) => isEl(c))[1] : undefined;
      return sub ? [sub] : [];
    });
    return [...own.filter((p) => !sets.includes(p)).map((nodes) => ({ nodes, index: false })),
      ...index.map((sub) => ({ nodes: [sub], index: true }))];
  });
  return { tex: written(cell).trim(), parts: parts.filter((p) => p.nodes.length) };
}

/** A cell as its author wrote it, each maths as its TeX: "$N$, $G$". */
function written(n: Node): string {
  if (n.tagName === 'math') {
    const tex = n.children?.find((c) => isEl(c, 'semantics'))?.children?.find((c) => isEl(c, 'annotation'));
    return `$${plain(tex ?? n)}$`;
  }
  return n.type === 'text' ? n.value ?? '' : (n.children ?? []).map(written).join('');
}

const mark = (n: Node, key: string) => {
  n.properties = { ...n.properties, className: [...((n.properties?.className as string[]) ?? []), 'sym'], dataSym: key };
};

const SCRIPTS = new Set(['msub', 'msup', 'msubsup']);
const base = (n: Node) => (isEl(n) && SCRIPTS.has(n.tagName!) ? n.children?.find((c) => isEl(c)) : undefined);
/** A row's scripted symbol names its family: `W_{g}` is the sector weight for every g, so it also stands for W with
 *  any other script (W_{g(i)}, W^⊤) and for W alone, the vector of them. */
const ofFamily = (n: Node, symbol: Node) => {
  const b = base(symbol);
  return b !== undefined && (same(n, b) || (base(n) !== undefined && same(base(n)!, b)));
};

/** An element whose first child is the letter it scripts or accents: the w of w_i, the Σ of Σ̃. */
const LETTERED = new Set([...SCRIPTS, 'mover', 'munder', 'munderover']);
type Symbols = { key: string; nodes: Node[] }[];

// Top down, so the largest match wins: a row `W_{g}` tags the whole msub. An exact match comes before a family one,
// and a symbol that is several siblings (`RC_i(w)`) gets an mrow round it. Inside a tagged symbol the search goes on
// through what it holds, so a Notation row lights every place its symbol stands: the i and g of W_{g(i)}, the w of
// RC_i(w), the η of Σ̃(η). Not through its letter: W is not tagged again inside W_{g(i)}, nor Σ inside Σ̃. The
// page takes a pointer on a nested symbol to mean the outermost.
function tag(n: Node, symbols: Symbols, seen: Set<string>): void {
  const whole = symbols.find((s) => s.nodes.length === 1 && same(n, s.nodes[0]))
    ?? symbols.find((s) => s.nodes.length === 1 && ofFamily(n, s.nodes[0]));
  if (whole) { mark(n, whole.key); seen.add(whole.key); inside(n, symbols, seen); return; }
  const kids = n.children ?? [], out: Node[] = [];
  for (let i = 0; i < kids.length;) {
    const run = symbols.find((s) => s.nodes.length > 1 && s.nodes.every((x, j) => kids[i + j] && same(kids[i + j], x)));
    if (run) {
      const parts = kids.slice(i, i + run.nodes.length);
      const mrow: Node = { type: 'element', tagName: 'mrow', properties: {}, children: parts };
      mark(mrow, run.key); seen.add(run.key); out.push(mrow); i += run.nodes.length;
      for (const p of parts) if (isEl(p)) (LETTERED.has(p.tagName!) ? inside : tag)(p, symbols, seen);
    } else {
      if (isEl(kids[i])) tag(kids[i], symbols, seen);
      out.push(kids[i++]);
    }
  }
  n.children = out;
}

/** What a tagged symbol holds past its letter: its scripts or its accent. A bare letter holds nothing more. */
function inside(n: Node, symbols: Symbols, seen: Set<string>): void {
  if (LETTERED.has(n.tagName!)) n.children?.slice(1).forEach((c) => { if (isEl(c)) tag(c, symbols, seen); });
}

// What reads as one word (lib/words wholeParts) is set in a span.nw, so a line never breaks inside it.
function keepWhole(n: Node): void {
  if (!n.children || (isEl(n) && n.tagName === 'math')) return;
  const out: Node[] = [];
  for (const c of n.children) {
    const prev = out.at(-1);
    if (c.type === 'text' && prev?.type === 'text') prev.value += c.value ?? '';   // a :v is a text node of its own
    else out.push(c.type === 'text' ? { ...c } : c);
  }
  n.children = out.flatMap((c) => {
    const parts = c.type === 'text' ? wholeParts(c.value ?? '') : [];
    if (parts.length < 2) { keepWhole(c); return [c]; }
    return parts.flatMap((value, i): Node[] => (!value ? [] : i % 2
      ? [{ type: 'element', tagName: 'span', properties: { className: ['nw'] }, children: [{ type: 'text', value }] }]
      : [{ type: 'text', value }]));
  });
}

const UNREAD = new Set(['math', 'table']);
/** The text a reader reads under `n`. An element's edges are word boundaries; two text nodes side by side are not,
 *  since a :v is a text node of its own and "mid-" before "August 2025" is two words, not three. */
function words(n: Node): string {
  if (n.type === 'text') return n.value ?? '';
  if (isEl(n) && UNREAD.has(n.tagName!)) return ' ';
  return (n.children ?? []).map((c) => (c.type === 'text' ? words(c) : ` ${words(c)} `)).join('');
}

export function rehypePaper() {
  return (tree: unknown, file: unknown) => {
    if (!isPaper(file)) return;
    const root = tree as Node, fm = report(file), problems = (fm.paperProblems ??= []);

    const rows: Node[] = [], displays: Node[] = [];
    walk(root, (n) => {
      // rehype-katex reports a TeX error only as a message Astro never shows, and draws the source in red.
      if (has(n, 'katex-error')) problems.push(`TeX error in $${plain(n)}$: ${String(n.properties?.title).replace(/^ParseError: /, '')}`);
      if (isEl(n, 'tr') && n.properties?.dataSym) rows.push(n);
      if (isEl(n, 'math') && n.properties?.display === 'block') displays.push(n);
    });

    const keyed = rows.map((row) => ({ key: String(row.properties!.dataSym), ...symbolsOf(row) }));
    // The longest first; at one length, a row's own symbol before another row's index (`find` takes the first).
    const symbols = keyed.flatMap(({ key, parts }) => parts.map((p) => ({ key, ...p })))
      .sort((a, b) => b.nodes.length - a.nodes.length || Number(a.index) - Number(b.index));
    const seen = new Set<string>();
    for (const d of displays) tag(d, symbols, seen);
    for (const { key, tex } of keyed) {
      if (!seen.has(key)) problems.push(`notation row ${tex} matches no display — mark it {text-only} if it is only in the prose`);
    }

    // One word per space-separated token, as the page reads: maths and tables are not read as prose. A figure's
    // drawing is still a raw node here, so it is not counted either, and a paper holds no other HTML and no code
    // (remarkPaper refuses both).
    fm.bodyWords = countWords(words(root));
    keepWhole(root);
  };
}
