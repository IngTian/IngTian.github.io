// src/lib/paperMarkdown/rehypePaper.ts
// The rehype half of the paper format, after rehype-katex and the MathML letter fix, when the maths is real
// MathML: KaTeX's errors are reported, the Notation table's symbols are found in the displays and tagged with
// their row, and the words a reader reads are counted. Papers only.
import { countWords } from '../words';
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

/** A row's symbols: its maths split at the commas between them (`N,\ G` is two) and at a membership, which
 *  introduces its element and the index of its set (`i ∈ 𝓘_g`, stock i of sector g: i, g and 𝓘_g), spaces dropped. */
function symbolsOf(row: Node): { tex: string; parts: Node[][] } {
  let math: Node | undefined;
  walk(row.children?.find((c) => isEl(c, 'th')) ?? row, (n) => { math ??= isEl(n, 'math') ? n : undefined; });
  const semantics = math?.children?.find((c) => isEl(c, 'semantics'));
  const body = semantics?.children?.filter((c) => isEl(c) && c.tagName !== 'annotation') ?? [];
  const seq = body.length === 1 && body[0].tagName === 'mrow' ? body[0].children ?? [] : body;
  const parts: Node[][] = [[]];
  let set: Node[] | undefined;
  for (const c of seq) {
    const member = isEl(c, 'mo') && plain(c) === '∈';
    if (member || (isEl(c, 'mo') && c.properties?.separator === 'true')) parts.push([]);
    else if (!(isEl(c, 'mspace') || (isEl(c, 'mtext') && !plain(c).trim()))) parts.at(-1)!.push(c);
    if (member) set = parts.at(-1);
  }
  const index = set?.length === 1 && base(set[0]) ? set[0].children!.filter((c) => isEl(c)).slice(1).map((c) => [c]) : [];
  const tex = semantics?.children?.find((c) => isEl(c, 'annotation'));
  return { tex: tex ? plain(tex) : plain(row), parts: [...parts, ...index].filter((p) => p.length) };
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

// A hyphenated name in capitals (RL-BHRP), a span of years and an ISO date each read as one word, so a line never
// breaks inside one: "RL-" at the end of a line and "BHRP" at the start of the next is two words to a reader.
const WHOLE = /[A-Z]{2,}-[A-Z]{2,}|\d{4}–\d{4}|\d{4}-\d{2}-\d{2}/g;
function keepWhole(n: Node): void {
  if (!n.children || (isEl(n) && n.tagName === 'math')) return;
  const out: Node[] = [];
  for (const c of n.children) {
    const prev = out.at(-1);
    if (c.type === 'text' && prev?.type === 'text') prev.value += c.value ?? '';   // a :v is a text node of its own
    else out.push(c.type === 'text' ? { ...c } : c);
  }
  n.children = out.flatMap((c) => {
    if (c.type !== 'text' || !c.value!.match(WHOLE)) { keepWhole(c); return [c]; }
    const parts: Node[] = [];
    let at = 0;
    for (const m of c.value!.matchAll(WHOLE)) {
      if (m.index > at) parts.push({ type: 'text', value: c.value!.slice(at, m.index) });
      parts.push({ type: 'element', tagName: 'span', properties: { className: ['nw'] }, children: [{ type: 'text', value: m[0] }] });
      at = m.index + m[0].length;
    }
    if (at < c.value!.length) parts.push({ type: 'text', value: c.value!.slice(at) });
    return parts;
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
    const symbols = keyed.flatMap(({ key, parts }) => parts.map((nodes) => ({ key, nodes })))
      .sort((a, b) => b.nodes.length - a.nodes.length);
    const seen = new Set<string>();
    for (const d of displays) tag(d, symbols, seen);
    for (const { key, tex } of keyed) {
      if (!seen.has(key)) problems.push(`notation row $${tex}$ matches no display — mark it {text-only} if it is only in the prose`);
    }

    // One word per space-separated token, as the page reads: maths and tables are not read as prose. A figure's
    // drawing is still a raw node here, so it is not counted either, and a paper holds no other HTML and no code
    // (remarkPaper refuses both).
    fm.bodyWords = countWords(words(root));
    keepWhole(root);
  };
}
