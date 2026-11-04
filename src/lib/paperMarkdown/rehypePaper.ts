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

/** A row's symbols: its maths split at the commas between them (`N,\ G` is two), spaces dropped. */
function symbolsOf(row: Node): { tex: string; parts: Node[][] } {
  let math: Node | undefined;
  walk(row.children?.find((c) => isEl(c, 'th')) ?? row, (n) => { math ??= isEl(n, 'math') ? n : undefined; });
  const semantics = math?.children?.find((c) => isEl(c, 'semantics'));
  const body = semantics?.children?.filter((c) => isEl(c) && c.tagName !== 'annotation') ?? [];
  const seq = body.length === 1 && body[0].tagName === 'mrow' ? body[0].children ?? [] : body;
  const parts: Node[][] = [[]];
  for (const c of seq) {
    if (isEl(c, 'mo') && c.properties?.separator === 'true') parts.push([]);
    else if (!(isEl(c, 'mspace') || (isEl(c, 'mtext') && !plain(c).trim()))) parts.at(-1)!.push(c);
  }
  const tex = semantics?.children?.find((c) => isEl(c, 'annotation'));
  return { tex: tex ? plain(tex) : plain(row), parts: parts.filter((p) => p.length) };
}

const mark = (n: Node, key: string) => {
  n.properties = { ...n.properties, className: [...((n.properties?.className as string[]) ?? []), 'sym'], dataSym: key };
};

// Top down, so the largest match wins and nothing inside a tagged symbol is tagged again: a row `W_{g}` tags the
// whole msub, and a bare W elsewhere is not W_g. A symbol that is several siblings (`RC_i(w)`) gets an mrow round it.
function tag(n: Node, symbols: { key: string; nodes: Node[] }[], seen: Set<string>): void {
  const whole = symbols.find((s) => s.nodes.length === 1 && same(n, s.nodes[0]));
  if (whole) { mark(n, whole.key); seen.add(whole.key); return; }
  const kids = n.children ?? [], out: Node[] = [];
  for (let i = 0; i < kids.length;) {
    const run = symbols.find((s) => s.nodes.length > 1 && s.nodes.every((x, j) => kids[i + j] && same(kids[i + j], x)));
    if (run) {
      const mrow: Node = { type: 'element', tagName: 'mrow', properties: {}, children: kids.slice(i, i + run.nodes.length) };
      mark(mrow, run.key); seen.add(run.key); out.push(mrow); i += run.nodes.length;
    } else {
      if (isEl(kids[i])) tag(kids[i], symbols, seen);
      out.push(kids[i++]);
    }
  }
  n.children = out;
}

const UNREAD = new Set(['math', 'table']);
function words(n: Node, out: string[] = []): string[] {
  if (n.type === 'text') out.push(n.value ?? '');
  else if (!(isEl(n) && UNREAD.has(n.tagName!))) n.children?.forEach((c) => words(c, out));
  return out;
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

    // One word per space-separated token, every element boundary a space, as the page reads: maths and tables
    // are not read as prose. A figure is still a raw node here, so it is not counted either, and a paper holds
    // no other HTML and no code (remarkPaper refuses both).
    fm.bodyWords = countWords(words(root).join(' '));
  };
}
