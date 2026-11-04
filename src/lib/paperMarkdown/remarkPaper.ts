// src/lib/paperMarkdown/remarkPaper.ts
// The remark half of the paper format: it turns a paper's directives (CLAUDE.md, "Papers are files") into the
// page's markup and reports every mistake it finds into the file's frontmatter, for the page to throw on.
// Astro runs one markdown processor for every .md, so on a file that is not in the papers collection it only puts
// back the text remark-directive took for a directive: a ":word" in /writing stays the text it was.

/** A markdown (mdast) or HTML (hast) node, as loosely as both plugins need. */
export interface Node {
  type: string;
  name?: string;
  attributes?: Record<string, string | undefined>;   // a directive's {…}: the parser writes every value as a string
  children?: Node[];
  value?: string;
  meta?: string | null;
  data?: { hName?: string; hProperties?: Record<string, unknown>; directiveLabel?: boolean };
  position?: { start: { offset?: number }; end: { offset?: number } };
  tagName?: string;
  properties?: Record<string, unknown>;
}

export interface PaperData { values: Record<string, string>; figures: Record<string, string> }

/** What a paper's render reports on `render(entry).remarkPluginFrontmatter`. A plugin cannot fail the build
 *  (Astro logs a plugin's throw and stores the entry unrendered), so the paper page throws on any problem. */
export interface PaperReport {
  paperProblems: string[];
  sections: { id: string; n?: string; title: string; rail: string }[];
  bodyWords: number;
}

interface File { path?: string; value: unknown; data: { astro?: { frontmatter?: Record<string, unknown> } } }
interface Reference { key: string; authors: string[]; year: number }

export const isPaper = (file: unknown) => ((file as File).path ?? '').includes('/src/content/papers/');

export function report(file: unknown): PaperReport & Record<string, unknown> {
  const astro = ((file as File).data.astro ??= {});
  return (astro.frontmatter ??= {}) as PaperReport & Record<string, unknown>;
}

/** The anchor a citation links to; the page's reference list renders the same id. */
export const refId = (key: string) => `ref-${key}`;

export const walk = (n: Node, fn: (n: Node) => void): void => { fn(n); n.children?.forEach((c) => walk(c, fn)); };
export const plain = (n: Node): string => n.value ?? (n.children ?? []).map(plain).join('');
const text = (value: string): Node => ({ type: 'text', value });
const el = (tag: string, props: Record<string, unknown>, children: Node[] = []): Node =>
  ({ type: 'paperElement', data: { hName: tag, hProperties: props }, children });
const set = (n: Node, tag: string, props: Record<string, unknown> = {}) => { n.data = { hName: tag, hProperties: props }; return n; };
const COLONS: Record<string, string> = { textDirective: ':', leafDirective: '::', containerDirective: ':::' };
const isDirective = (n: Node) => n.type in COLONS;
const isNote = (n: Node) => n.type === 'containerDirective' && (n.name === 'def' || n.name === 'why');
const FENCE = /^:{3,}\s*$/m;

// "Maillard, Sébastien" is family, given: one author gives "Markowitz, 1952", two "Feng and He, 2022", more "Maillard et al., 2008".
function citeLabel(r: Reference): string {
  const family = r.authors.map((a) => a.split(',')[0].trim());
  return `${family.length > 2 ? `${family[0]} et al.` : family.join(' and ')}, ${r.year}`;
}

// A directive written in a file that is not a paper, back as the text it was. A text directive keeps its
// label's children, which remark has already parsed as the markdown they would have been anyway.
// ponytail: a leaf or container line comes back as one paragraph of its source, which equals the plain
// rendering only while it is a line on its own; walk its children instead if /writing ever needs more.
function literal(n: Node, src: string, labelEnd?: number): Node[] {
  const start = n.position?.start.offset ?? 0, s = src.slice(start, n.position?.end.offset);
  if (n.type !== 'textDirective') return [{ type: 'paragraph', children: [text(s)] }];
  const head = `:${n.name}`;
  if (s[head.length] !== '[') return [text(s)];
  const close = labelEnd === undefined ? head.length + 1 : labelEnd - start;
  return [text(`${head}[`), ...(n.children ?? []), text(s.slice(close))];
}

function restore(parent: Node, src: string): void {
  if (!parent.children) return;
  parent.children = parent.children.flatMap((c) => {
    const labelEnd = c.children?.at(-1)?.position?.end.offset;
    restore(c, src);
    return isDirective(c) ? literal(c, src, labelEnd) : [c];
  });
}

export function remarkPaper({ papers }: { papers: Record<string, PaperData> }) {
  return (tree: unknown, file: unknown) => {
    const root = tree as Node, src = String((file as File).value);
    if (!isPaper(file)) return restore(root, src);

    const fm = report(file);
    const data = papers[String(fm.publication)] ?? { values: {}, figures: {} };
    const refs = new Map((Array.isArray(fm.references) ? (fm.references as Reference[]) : []).map((r) => [r.key, r]));
    const problems: string[] = [], sections: PaperReport['sections'] = [];
    const ids = new Set<string>(), terms = new Map<string, Node>(), hosts = new WeakSet<Node>();
    const notes: { note: Node; host: Node }[] = [];
    const problem = (p: string) => problems.push(p);
    const claim = (id: string) => { if (ids.has(id)) problem(`id #${id} is used twice`); ids.add(id); };

    // What is wrong wherever it is. A container that closes too early leaves its fence behind as text, and one
    // that never closes swallows the rest of the file, so both are looked for here rather than trusted.
    walk(root, (n) => {
      if (n.type === 'text' && FENCE.test(n.value ?? '')) problem('a stray ":::" — a container holding another needs more colons than the one inside it');
      if (n.type === 'containerDirective' && !/\n\s*:{3,}\s*$/.test(src.slice(n.position?.start.offset, n.position?.end.offset))) problem(`:::${n.name} is never closed`);
      if (n.type === 'html') problem(`raw HTML in a paper: ${n.value} — write it with the directives`);
      if ((n.type === 'math' || n.type === 'inlineMath') && /\\tag\b/.test(n.value ?? '')) problem(`\\tag in $$${n.value}$$ — number it with ::::eq{n=…}`);
    });
    for (const n of root.children ?? []) {
      if (!(n.type === 'containerDirective' && n.name === 'section')) problem(`content outside a section: "${plain(n).replace(/\s+/g, ' ').trim().slice(0, 40)}"`);
    }

    // A block list: notes join the block before them, everything else is built in place.
    function blocks(parent: Node, inHl: boolean): void {
      const out: Node[] = [];
      for (const n of parent.children ?? []) {
        if (isNote(n)) attach(note(n), out);
        else out.push(...one(n, parent === root, inHl));
      }
      parent.children = out;
    }

    function one(n: Node, atRoot: boolean, inHl: boolean): Node[] {
      const labelEnd = n.children?.at(-1)?.position?.end.offset;
      const known = `${n.type}:${n.name}`;
      switch (known) {
        case 'containerDirective:section':
          if (!atRoot) problem(`:::section #${n.attributes?.id} is inside another block — sections are top level`);
          return [section(n)];
        case 'containerDirective:eq': return [eq(n)];
        case 'containerDirective:notation': return [notation(n)];
        case 'containerDirective:where': problem(':::where outside an ::::eq'); break;
        case 'leafDirective:figure': {
          const name = n.attributes?.name ?? '', figure = data.figures[name];
          if (figure === undefined) { problem(`unknown ::figure name "${name}"`); return []; }
          return [{ type: 'html', value: figure }];
        }
        case 'textDirective:t': {
          const id = n.attributes?.id;
          if (!id) problem(`a term without an #id: "${plain(n)}"`);
          else if (terms.has(id)) problem(`term #${id} is marked twice`);
          else terms.set(id, n);
          // Seal over the seal underline band is under 3:1 at any strength that still reads as a band (tokens.css,
          // --sheet-mark), so the term's linked rule would vanish there.
          if (inHl) problem(`linked term inside a highlight: ${id}`);
          blocks(n, inHl);
          return [set(n, 'i', { className: ['t'], dataN: id })];
        }
        case 'textDirective:hl': blocks(n, true); return [set(n, 'mark', { className: ['hl'] })];
        case 'textDirective:cite': {
          const key = plain(n).trim(), r = refs.get(key);
          if (!r) problem(`unknown :cite key "${key}"`);
          n.children = [text(r ? citeLabel(r) : key)];
          return [set(n, 'a', { className: ['cite'], href: `#${refId(key)}` })];
        }
        case 'textDirective:v': {
          const key = plain(n).trim(), value = data.values[key];
          if (value === undefined) problem(`unknown :v key "${key}"`);
          return [text(value ?? key)];
        }
        default:
          if (isDirective(n)) { problem(`unknown directive ${COLONS[n.type]}${n.name}`); return literal(n, src, labelEnd); }
      }
      if (n.children) blocks(n, inHl);
      return [n];
    }

    function section(n: Node): Node {
      const { id = '', n: num, rail } = n.attributes ?? {};
      const [first, ...body] = n.children ?? [];
      const label = first?.data?.directiveLabel ? first : undefined;
      if (!id) problem(`:::section${label ? ` [${plain(label)}]` : ''} has no #id`);
      else claim(id);
      if (!label) problem(`:::section #${id} has no [title]`);
      const title = label ? plain(label).trim() : '';
      sections.push({ id, ...(num ? { n: num } : {}), title, rail: rail ?? title });
      // The h2 takes an id of its own: left without one, Astro's heading pass would slug "Notation" into a
      // second id="notation".
      const h2 = el('h2', { id: `${id}-title` }, [...(num ? [el('span', { className: ['n'] }, [text(num)])] : []), ...(label?.children ?? [])]);
      n.children = label ? [h2, ...body] : [h2, first, ...body].filter(Boolean);
      blocks(n, false);
      return set(n, 'section', { className: ['sec'], id });
    }

    // An equation is its own host: its where and its notes sit inside it, a note beside the display it explains.
    function eq(n: Node): Node {
      const { id, n: num } = n.attributes ?? {};
      const name = `::::eq${id ? ` #${id}` : ''}`;
      if (id) claim(id);
      const displays = new Map<string, Node>(), rest: Node[] = [];
      let shape = true;
      for (const c of n.children ?? []) {
        if (c.type === 'math') {
          const form = c.meta?.trim() || 'one';
          shape &&= ['one', 'wide', 'narrow'].includes(form) && !displays.has(form);
          displays.set(form, c);
        } else if (c.type === 'containerDirective' && c.name === 'where') {
          for (const p of c.children ?? []) if (p.type === 'paragraph') set(p, 'p', { className: ['where'] });
          blocks(c, false);
          rest.push(...(c.children ?? []));
        } else if (isNote(c)) {
          rest.push(note(c));
          notes.push({ note: c, host: n });
        } else problem(`${name} holds a ${c.type} — an eq holds its display, its :::where and its notes`);
      }
      const keys = [...displays.keys()].sort().join();
      if (!shape || (keys !== 'one' && keys !== 'narrow,wide')) problem(`${name} needs one $$ display, or a $$ wide and a $$ narrow`);
      const single = displays.get('one');
      const math = single ? [single] : [el('div', { className: ['eq-wide'] }, [displays.get('wide')].filter(Boolean) as Node[]),
        el('div', { className: ['eq-narrow'] }, [displays.get('narrow')].filter(Boolean) as Node[])];
      n.children = [el('div', { className: ['eq-row'] }, [el('div', { className: ['eq-math'] }, math),
        el('span', { className: ['eq-no'] }, num ? [text(`(${num})`)] : [])]), ...rest];
      hosts.add(n);
      return set(n, 'div', { className: ['eq', 'an'], ...(id ? { id } : {}) });
    }

    function notation(n: Node): Node {
      const [table, ...extra] = n.children ?? [];
      if (table?.type !== 'table' || extra.length) problem(':::notation holds one table, | Symbol | Meaning |, and nothing else');
      (table?.children ?? []).forEach((row, k) => {
        const [symbol] = row.children ?? [];
        if (k === 0) { for (const c of row.children ?? []) set(c, 'th', { scope: 'col' }); return; }
        const last = symbol?.children?.at(-1);
        const textOnly = last?.type === 'text' && /\s*\{text-only\}\s*$/.test(last.value ?? '');
        if (textOnly) last.value = last.value!.replace(/\s*\{text-only\}\s*$/, '');
        // The row's key is its position: rehypePaper finds the row's symbols in the displays and tags them with it.
        set(row, 'tr', textOnly ? {} : { dataSym: String(k) });
        if (symbol) set(symbol, 'th', { scope: 'row' });
      });
      if (table) { blocks(table, false); set(table, 'table', { className: ['notation'] }); }
      return set(n, 'div', { className: ['tbl-scroll'] });
    }

    // A note: def opens with its **Name.**, which becomes the dfn; why gets its label. One paragraph is
    // unwrapped, as the page's notes are inline content in their aside.
    const noteLabel = (n: Node) => `:::${n.name}${n.attributes?.for ? ` for=${n.attributes.for}` : ''}`;
    function note(n: Node): Node {
      const kind = n.name!, at = n.attributes?.for;
      blocks(n, false);
      const first = n.children?.[0];
      if (kind === 'def') {
        const lead = first?.type === 'paragraph' ? first.children?.[0] : undefined;
        if (lead?.type === 'strong') set(lead, 'dfn');
        else problem(`${noteLabel(n)} opens without its **Name.**`);
      } else if (first?.type === 'paragraph') {
        first.children?.unshift(el('span', { className: ['mk'] }, [text('Why it matters.')]), text(' '));
      }
      if (n.children?.length === 1 && first?.type === 'paragraph') n.children = first.children;
      return set(n, 'aside', { className: ['mn', kind], ...(at ? { dataAt: at } : {}) });
    }

    function attach(aside: Node, out: Node[]): void {
      const prev = out.at(-1);
      if (!prev) { out.push(aside); return; }
      const host = hosts.has(prev) ? prev : el('div', { className: ['an'] }, [prev]);
      hosts.add(host);
      out[out.length - 1] = host;
      host.children!.push(aside);
      notes.push({ note: aside, host });
    }

    blocks(root, false);

    // A note finds its term inside its own host (the page looks there), so the term must be in the block it follows.
    for (const { note: n, host } of notes) {
      const at = n.attributes?.for;
      if (!at) continue;
      const term = terms.get(at);
      let inside = false;
      if (term) walk(host, (x) => { inside ||= x === term; });
      if (!term) problem(`${noteLabel(n)} names no term`);
      else if (!inside) problem(`${noteLabel(n)}: term #${at} is not in the block the note follows`);
    }
    fm.paperProblems = problems;
    fm.sections = sections;
  };
}
