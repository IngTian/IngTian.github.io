// src/lib/paperMarkdown/remarkPaper.ts
// The remark half of the paper format: it turns a paper's directives (CLAUDE.md, "Papers are files") into the
// page's markup and reports every mistake it finds into the file's frontmatter, for the page to throw on.
// Astro runs one markdown processor for every .md, so the directive syntax itself is switched on only while a
// paper is parsed (remarkPaperSyntax): any other file is parsed as if remark-directive were not installed.
import remarkDirective from 'remark-directive';
import { unified, type Processor } from 'unified';
import type { Publication } from '../../data/profile';

/** A markdown (mdast) or HTML (hast) node, as loosely as both plugins need. */
export interface Node {
  type: string;
  name?: string;
  attributes?: Record<string, string | undefined>;   // a directive's {…}: the parser writes every value as a string
  children?: Node[];
  value?: string;
  meta?: string | null;
  data?: { hName?: string; hProperties?: Record<string, unknown>; hChildren?: Node[]; directiveLabel?: boolean };
  position?: { start: { offset?: number }; end: { offset?: number } };
  tagName?: string;
  properties?: Record<string, unknown>;
}

export interface PaperData { values: Record<string, string>; figures: Record<string, string> }
/** What the format reads from a paper's record (profile.ts `publications`): the abstract `::abstract` quotes, and
 *  the page it quotes it from. */
export type PaperRecord = Pick<Publication, 'slug' | 'abstract' | 'href'>;

/** What a paper's render reports on `render(entry).remarkPluginFrontmatter`. A plugin cannot fail the build
 *  (Astro logs a plugin's throw and stores the entry unrendered), so the paper page throws on any problem.
 *  `ids` is every id the rendered file carries (its sections', their headings', its equations', theorems' and
 *  figures', and those inside a figure's drawing), for the page to refuse one it writes itself.
 *  `errataText` is the frontmatter's errata, in order, each with its `:v` filled in. */
export interface PaperReport {
  paperProblems: string[];
  sections: { id: string; n?: string; title: string; rail: string }[];
  ids: string[];
  bodyWords: number;
  errataText: string[];
}

interface File { path?: string; value: unknown; data: { astro?: { frontmatter?: Record<string, unknown> } } }
interface Reference { key: string; authors: string[]; year: number }

export const isPaper = (file: unknown) => ((file as File).path ?? '').includes('/src/content/papers/');

type Extensions = { micromarkExtensions?: unknown[]; fromMarkdownExtensions?: unknown[] };
// remark-directive's syntax, taken from a processor of its own rather than from the packages under it.
const DIRECTIVES = unified().use(remarkDirective).freeze().data() as Extensions;

/** remark-directive, for papers only. remark-parse reads its extensions on every call, so the directive syntax
 *  is added for the length of a paper's parse and taken away after: every other file is parsed exactly as it is
 *  without it, and a ":word", a ":::" line or a "mailto:me@…" in /writing never becomes a directive at all.
 *  Goes after remark-parse, whose parser it wraps. */
export function remarkPaperSyntax(this: Processor) {
  const self = this, parse = self.parser!;
  self.parser = (doc, file) => {
    if (!isPaper(file)) return parse(doc, file);
    const data = self.data() as Extensions;
    const mm = (data.micromarkExtensions ??= []), fm = (data.fromMarkdownExtensions ??= []);
    mm.push(...DIRECTIVES.micromarkExtensions!);
    fm.push(...DIRECTIVES.fromMarkdownExtensions!);
    try {
      return parse(doc, file);
    } finally {
      mm.length -= DIRECTIVES.micromarkExtensions!.length;
      fm.length -= DIRECTIVES.fromMarkdownExtensions!.length;
    }
  };
}

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

// A value written into TeX: the characters TeX reads as syntax are escaped, so "$2.20" is not the end of the
// maths and "15%" does not comment out the rest of the line.
const inTeX = (value: string) => value.replace(/[$%#&]/g, '\\$&');
// What smartypants (Astro's, before these plugins) curls in text but never sees in an attribute.
const UNCURLED = /['"]|--|\.\.\./;
const VALUE = /:v\[\s*([^\]]*?)\s*\]/g;
const html = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function remarkPaper({ papers, publications }: { papers: Record<string, PaperData>; publications: readonly PaperRecord[] }) {
  return (tree: unknown, file: unknown) => {
    if (!isPaper(file)) return;
    const root = tree as Node, src = String((file as File).value);

    const fm = report(file);
    const data = papers[String(fm.publication)] ?? { values: {}, figures: {} };
    const record = publications.find((p) => p.slug === fm.publication);
    const refs = new Map((Array.isArray(fm.references) ? (fm.references as Reference[]) : []).map((r) => [r.key, r]));
    const problems: string[] = [], sections: PaperReport['sections'] = [];
    const ids = new Set<string>(), terms = new Map<string, Node>(), hosts = new WeakSet<Node>();
    const notes: { note: Node; host: Node }[] = [];
    const problem = (p: string) => problems.push(p);
    /** Every id the file's markup carries goes through here; false if it was already taken. */
    const claim = (id: string): boolean => {
      if (ids.has(id)) { problem(`id #${id} is used twice`); return false; }
      ids.add(id);
      return true;
    };
    // The one lookup of a :v, wherever it is written: in prose, in maths and in the errata.
    const value = (key: string): string => {
      const v = data.values[key];
      if (v === undefined) problem(`unknown :v key "${key}"`);
      return v ?? key;
    };

    // remark-math takes $…$ before any directive is parsed, so a :v in maths is still text here: it is expanded
    // in the TeX, and in the copy of it remark-math made for rehype-katex. No other directive works in maths.
    function maths(n: Node): void {
      const tex = (n.value ?? '').replace(VALUE, (_, key: string) => inTeX(value(key)));
      for (const [d] of tex.matchAll(/:(?:cite|t|hl)\[/g)) problem(`${d}…] in $${tex}$ — only :v works in maths`);
      if (/\\tag\b/.test(tex)) problem(`\\tag in $$${tex}$$ — number it with ::::eq{n=…}`);
      n.value = tex;
      walk({ type: 'root', children: n.data?.hChildren ?? [] }, (t) => { if (t.type === 'text') t.value = tex; });
    }

    // What is wrong wherever it is. A container that closes too early leaves its fence behind as text, and one
    // that never closes swallows the rest of the file, so both are looked for here rather than trusted.
    walk(root, (n) => {
      if (n.type === 'text' && FENCE.test(n.value ?? '')) problem('a stray ":::" — a container holding another needs more colons than the one inside it');
      if (n.type === 'containerDirective' && !/\n\s*:{3,}\s*$/.test(src.slice(n.position?.start.offset, n.position?.end.offset))) problem(`:::${n.name} is never closed`);
      if (n.type === 'html') problem(`raw HTML in a paper: ${n.value} — write it with the directives`);
      // A fenced block would be coloured by shiki's inline styles, and seal red is the only colour on these pages.
      if (n.type === 'code') problem(`a code block in a paper: "${(n.value ?? '').slice(0, 40)}"`);
      // Astro would slug an unnamed heading into an id no check here sees, and could repeat a section's.
      if (n.type === 'heading') problem(`a markdown heading in a paper: "${plain(n)}" — a title is a ::::section[label]`);
      if (n.type === 'math' || n.type === 'inlineMath') maths(n);
      // Smartypants never sees maths, so a quote right after it reads as one after a space and opens: "$g$'s"
      // drew as g‘s. The maths is the word the quote closes on.
      n.children?.forEach((c, i) => {
        if (c.type === 'text' && n.children![i - 1]?.type === 'inlineMath') c.value = c.value!.replace(/^['‘]/, '’').replace(/^["“]/, '”');
      });
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
      const known = `${n.type}:${n.name}`;
      switch (known) {
        case 'containerDirective:section':
          if (!atRoot) problem(`:::section #${n.attributes?.id} is inside another block — sections are top level`);
          return [section(n)];
        case 'containerDirective:eq': return [eq(n)];
        case 'containerDirective:notation': return [notation(n)];
        case 'containerDirective:figure': return [figure(n)];
        case 'containerDirective:where': problem(':::where outside an ::::eq'); break;
        case 'containerDirective:thm': {
          const id = n.attributes?.id;
          if (id) claim(id);
          blocks(n, inHl);
          return [set(n, 'div', { className: ['thm'], ...(id ? { id } : {}) })];
        }
        case 'containerDirective:inpaper': {
          blocks(n, inHl);
          for (const p of n.children ?? []) {
            if (p.type === 'paragraph') set(p, 'p', { className: ['inpaper'] });
            else problem(`:::inpaper holds a ${p.type} — it is a paragraph pointing into the paper`);
          }
          return n.children ?? [];
        }
        case 'leafDirective:abstract':
          if (!record?.abstract) { problem(`::abstract, and the record "${String(fm.publication)}" has no abstract`); return []; }
          return [{ type: 'html', value: `<blockquote class="abstract" cite="${html(record.href)}"><p>${html(record.abstract)}</p></blockquote>` }];
        case 'textDirective:sup': blocks(n, inHl); return [set(n, 'sup')];
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
        case 'textDirective:v': return [text(value(plain(n).trim()))];
        default:
          if (isDirective(n)) { problem(`unknown directive ${COLONS[n.type]}${n.name} — \\: is a literal colon`); return []; }
      }
      if (n.children) blocks(n, inHl);
      return [n];
    }

    function section(n: Node): Node {
      const { id = '', n: num, rail, aside } = n.attributes ?? {};
      const [first, ...body] = n.children ?? [];
      const label = first?.data?.directiveLabel ? first : undefined;
      if (!id) problem(`:::section${label ? ` [${plain(label)}]` : ''} has no #id`);
      else if (claim(id)) claim(`${id}-title`);
      if (!label) problem(`:::section #${id} has no [title]`);
      for (const [k, a] of [['rail', rail], ['aside', aside]]) {
        if (a && UNCURLED.test(a)) problem(`${k}="${a}" keeps straight quotes and dashes the title would not — write ’ “ ” – — …`);
      }
      const title = label ? plain(label).trim() : '';
      sections.push({ id, ...(num ? { n: num } : {}), title, rail: rail ?? title });
      // The h2 takes an id of its own: left without one, Astro's heading pass would slug "Notation" into a
      // second id="notation". An aside follows the title in the heading only, so the rail and Contents keep the title.
      const h2 = el('h2', { id: `${id}-title` }, [...(num ? [el('span', { className: ['n'] }, [text(num)])] : []), ...(label?.children ?? []),
        ...(aside ? [text(' '), el('span', { className: ['aside'] }, [text(`· ${aside}`)])] : [])]);
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

    // A figure: the drawing registered under `name`, numbered by `n`, the container's prose its caption and its
    // notes beside it. A table (a registered drawing that is a <table>) is captioned above and scrolls in its own
    // box, its other paragraphs set under it as its notes; anything else is a figure, its whole caption below.
    function figure(n: Node): Node {
      const { name = '', n: num } = n.attributes ?? {}, art = data.figures[name];
      if (art === undefined) problem(`unknown :::figure name "${name}"`);
      if (!num) problem(`:::figure ${name} has no n=`);
      const table = /^<table\b/.test(art ?? ''), id = `${table ? 'table' : 'figure'}-${num}`;
      if (num) claim(id);
      for (const [, inner] of (art ?? '').matchAll(/\sid="([^"]+)"/g)) claim(inner);
      const paras: Node[] = [], asides: Node[] = [];
      for (const c of n.children ?? []) {
        if (c.type === 'paragraph') { blocks(c, false); paras.push(c); }
        else if (isNote(c)) { asides.push(note(c)); notes.push({ note: c, host: n }); }
        else problem(`:::figure ${name} holds a ${c.type} — a figure holds its caption and its notes`);
      }
      if (!paras.length) problem(`:::figure ${name} has no caption`);
      paras[0]?.children?.unshift(el('span', { className: ['fig-no'] }, [text(`${table ? 'Table' : 'Figure'} ${num}.`)]), text(' '));
      const drawing: Node = { type: 'html', value: art ?? '' };
      n.children = table
        ? [el('figcaption', { className: ['cap'] }, paras[0]?.children ?? []), el('div', { className: ['tbl-scroll'] }, [drawing]),
          ...paras.slice(1).map((p) => set(p, 'p', { className: ['src'] })), ...asides]
        : [drawing, el('figcaption', {}, paras.length === 1 ? paras[0].children ?? [] : paras), ...asides];
      hosts.add(n);
      return set(n, 'figure', { className: [table ? 'tbl' : 'fig', ...(asides.length ? ['an'] : [])], ...(num ? { id } : {}) });
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
    // The errata are frontmatter, which the page prints as text: their :v is filled in here, by the same lookup.
    const errata = Array.isArray(fm.errata) ? (fm.errata as { text?: unknown }[]) : [];
    fm.errataText = errata.map((e) => String(e.text ?? '').replace(VALUE, (_, key: string) => value(key)));
    fm.paperProblems = problems;
    fm.sections = sections;
    fm.ids = [...ids];
  };
}
