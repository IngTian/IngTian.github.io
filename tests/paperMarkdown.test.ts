import { readFileSync } from 'node:fs';
import rehypeKatex from 'rehype-katex';
import rehypeStringify from 'rehype-stringify';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import { unified, type PluggableList } from 'unified';
import { describe, expect, it } from 'vitest';
import { markdownPlugins, type PaperReport } from '../src/lib/paperMarkdown';

// The site's markdown plugins, inside the chain Astro runs them in (node_modules/@astrojs/markdown-remark/dist/index.js):
// parse and GFM before them, remark-rehype with raw HTML allowed and stringify after. Astro's smartypants, shiki,
// heading-id and image passes and its final rehype-raw are left out; the plugins do not depend on any of them.
const PAPERS = {
  simple: { values: { 'usd.rl': '$2.20' }, figures: { pipe: '<svg class="pipe" aria-hidden="true"><text>Policy</text></svg>' } },
};
const REFERENCES = [{
  key: 'maillard2008', authors: ['Maillard, Sébastien', 'Roncalli, Thierry', 'Teïletche, Jérôme'], year: 2008,
  title: 'On the properties of equally-weighted risk contributions portfolios', venue: 'SSRN',
}];
const PAPER_PATH = '/site/src/content/papers/simple.md';
const WRITING_PATH = '/site/src/content/writing/piece.md';
const fixture = (name: string) => readFileSync(new URL(`./fixtures/papers/${name}.md`, import.meta.url), 'utf8');

async function render(md: string, path: string, plugins = true) {
  const site = markdownPlugins(PAPERS);
  const file = await unified()
    .use(remarkParse).use(remarkGfm)
    .use(plugins ? (site.remarkPlugins as PluggableList) : [remarkMath])
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(plugins ? (site.rehypePlugins as PluggableList) : [[rehypeKatex, { output: 'mathml' }]])
    .use(rehypeStringify, { allowDangerousHtml: true })
    .process({ value: md, path, data: { astro: { frontmatter: { publication: 'simple', references: REFERENCES } } } });
  return { html: String(file), report: (file.data as { astro: { frontmatter: PaperReport } }).astro.frontmatter };
}

describe('a paper file', async () => {
  const { html, report } = await render(fixture('simple'), PAPER_PATH);

  it('renders every section with its id and a numbered h2, and reports them for the rail', () => {
    expect(html).toContain('<section class="sec" id="brief"><h2 id="brief-title">In brief</h2>');
    expect(html).toContain('<section class="sec" id="notation"><h2 id="notation-title">Notation</h2>');
    expect(html).toContain('<section class="sec" id="method"><h2 id="method-title"><span class="n">1</span>The method</h2>');
    expect(report.sections).toEqual([
      { id: 'brief', title: 'In brief', rail: 'In brief' },
      { id: 'notation', title: 'Notation', rail: 'Notation' },
      { id: 'method', n: '1', title: 'The method', rail: 'Method' },
    ]);
  });

  it('puts a note in one host with the block before it, the term inside', () => {
    expect(html).toContain('<div class="an"><p>A paper about <i class="t" data-n="rp">risk parity</i>, in brief.</p>'
      + '<aside class="mn def" data-at="rp"><dfn>Risk parity.</dfn> Every holding carries the same share of the risk (');
  });

  it('resolves a citation against the references, and a value from the paper data, as text and not as math', () => {
    expect(html).toContain('(<a class="cite" href="#ref-maillard2008">Maillard et al., 2008</a>).</aside></div>');
    expect(html).toContain('<mark class="hl">One dollar grew to $2.20.</mark> The rest is detail.');
  });

  it('numbers an equation outside its MathML, with its wide and narrow forms, its where and its notes', () => {
    const eq = html.slice(html.indexOf('<div class="eq an" id="eq-1">'), html.indexOf('<svg class="pipe"'));
    expect(eq).toMatch(/^<div class="eq an" id="eq-1"><div class="eq-row"><div class="eq-math"><div class="eq-wide"><span class="katex"><math[^>]*display="block"/);
    expect(eq).toContain('</div><div class="eq-narrow"><span class="katex"><math');
    expect(eq).toContain('</math></span></div></div><span class="eq-no">(1)</span></div>');
    expect(eq).toMatch(/<p class="where">where <span class="katex"><math[^]*?<\/math><\/span> is the <i class="t" data-n="sw">sector weight<\/i>\.<\/p>/);
    // the eq is the notes' host, so a term in its where anchors a note of the eq
    expect(eq).toContain('</p><aside class="mn def" data-at="sw"><dfn>Sector weight.</dfn> The share of the money in a sector.</aside>'
      + '<aside class="mn why"><span class="mk">Why it matters.</span> It keeps the weights adding up to one.</aside></div>');
    expect(eq).not.toContain('\\tag');
  });

  it('builds the notation table: a row header per symbol, the row keyed unless it is marked text-only', () => {
    expect(html).toContain('<div class="tbl-scroll"><table class="notation">');
    expect(html).toContain('<th scope="col">Symbol</th>');
    expect(html).toMatch(/<tr data-sym="1">\s*<th scope="row"><span class="katex"><math/);
    expect(html).toMatch(/<tr>\s*<th scope="row"><span class="katex"><math[^]*?θ[^]*?<\/math><\/span><\/th>/);
    expect(html).not.toContain('text-only');
  });

  it('tags W_g in each display that contains it, and not a bare W there', () => {
    const tagged = html.match(/<msub class="sym" data-sym="1"><mi>W<\/mi><mi>g<\/mi><\/msub>/g) ?? [];
    expect(tagged).toHaveLength(2);
    expect(html).not.toMatch(/<mi class="sym"[^>]*>W<\/mi>/);
  });

  it('tags a symbol that is several siblings as one, and a row matches when any of its symbols does', () => {
    // RC_g(w) is four siblings in the MathML (msub, "(", w, ")"); G is in no display, and the row still counts
    const rc = html.match(/<mrow class="sym" data-sym="2"><msub><mrow><mi[^>]*>R<\/mi><mi[^>]*>C<\/mi><\/mrow><mi>g<\/mi><\/msub><mo[^>]*>\(<\/mo><mi>w<\/mi><mo[^>]*>\)<\/mo><\/mrow>/g) ?? [];
    expect(rc).toHaveLength(2);
    // two displays, two symbols each; the inline W_g in the where is prose, not a display
    expect(html.match(/class="sym"/g)).toHaveLength(4);
  });

  it('inlines a figure from the paper data as it is', () => {
    expect(html).toContain(PAPERS.simple.figures.pipe);
  });

  it('reports no problem, and the words a reader reads', () => {
    expect(report.paperProblems).toEqual([]);
    // Counted by hand, every element boundary a word boundary and maths, tables and code left out:
    // brief 33 (title 2, paragraph 7, the def 15 with its citation, the highlight's line 9), notation 1 (its
    // title), method 35 (title 3 with its number, paragraph 5, "(1)" 1, the where 5, the def 10, the why 11).
    expect(report.bodyWords).toBe(69);
  });
});

describe('a malformed paper', async () => {
  const { report } = await render(fixture('malformed'), PAPER_PATH);
  const problems = report.paperProblems;

  it('names every problem, so the page can fail the build with all of them', () => {
    const want = [
      'unknown :cite key "nobody1999"',
      'unknown :v key "usd.nobody"',
      'notation row $Q_{t}$ matches no display — mark it {text-only} if it is only in the prose',
      'TeX error in $\\frac{1$: KaTeX parse error',
      ':::def for=ghost names no term',
      'linked term inside a highlight: inner',
      ':::def for=rp: term #rp is not in the block the note follows',
      'term #rp is marked twice',
      ':::def opens without its **Name.**',
      'unknown directive :hlx',
      'raw HTML in a paper: <b> — write it with the directives',
      'raw HTML in a paper: </b> — write it with the directives',
      'unknown ::figure name "nothing"',
      '\\tag in $$x = 1 \\tag{9}$$ — number it with ::::eq{n=…}',
      '::::eq #eq-9 needs one $$ display, or a $$ wide and a $$ narrow',
      ':::where outside an ::::eq',
      ':::section #checked has no [title]',
      'id #checked is used twice',
      // the section [Short] holds a :::def with as many colons: the def's fence closes the section, so the def
      // never closes, the rest of the section falls outside it and its own fence is left over as text
      'a stray ":::" — a container holding another needs more colons than the one inside it',
      ':::def is never closed',
      'content outside a section: "Stray paragraph. :::"',
      ':::why is never closed',
      'content outside a section: "Never closed."',
    ];
    for (const w of want) expect(problems.some((p) => p.startsWith(w)), w).toBe(true);
    expect(problems.filter((p) => !want.some((w) => p.startsWith(w)))).toEqual([]);
  });
});

describe('any other markdown file', () => {
  it('keeps text that reads like a directive as it was written', async () => {
    const md = 'A ratio of 3:x, a word:break, a :name[with **bold**]{a=1} and :::fence\n\n::leaf\n';
    expect((await render(md, WRITING_PATH)).html).toBe((await render(md, WRITING_PATH, false)).html);
  });

  it('renders the writing pieces byte for byte as before', async () => {
    const md = readFileSync(new URL('../src/content/writing/favourite-quotes.md', import.meta.url), 'utf8').replace(/^---\n[^]*?\n---\n/, '');
    expect((await render(md, WRITING_PATH)).html).toBe((await render(md, WRITING_PATH, false)).html);
  });

  it('gets the MathML letter fix too, so \\mathbb{R} is ℝ in every engine', async () => {
    const md = 'Over $\\mathbb{R}^N$.';
    expect((await render(md, WRITING_PATH, false)).html).toContain('mathvariant="double-struck"');
    const { html } = await render(md, WRITING_PATH);
    expect(html).toContain('<mi>ℝ</mi>');
    expect(html).not.toContain('mathvariant');
  });

  it('fails on a letter Unicode has no form for, naming the TeX it was in', async () => {
    await expect(render('A $\\mathcal{\\lambda}$ here.', WRITING_PATH)).rejects.toThrow(/λ.*\\mathcal\{\\lambda\}/);
  });
});
