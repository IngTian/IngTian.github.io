import { readFileSync } from 'node:fs';
import katex from 'katex';
import rehypeKatex from 'rehype-katex';
import rehypeStringify from 'rehype-stringify';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import { unified, type PluggableList } from 'unified';
import { describe, expect, it } from 'vitest';
import { fixMathVariants } from '../src/lib/mathml';
import { markdownPlugins, type PaperReport } from '../src/lib/paperMarkdown';

// The site's markdown plugins, inside the chain Astro runs them in (node_modules/@astrojs/markdown-remark/dist/index.js):
// parse and GFM before them, remark-rehype with raw HTML allowed and stringify after. Astro's other passes are
// left out, and the format is written so that none of them reaches what is checked here:
// - smartypants runs before the plugins and curls the text of a directive's label, so a title is curled. What a
//   plugin reads from a label as a key cannot hold what it rewrites (a reference key has no "--"), a rail=
//   attribute, which it never sees, is refused if it would need curling, and the one quote it gets wrong, the
//   one right after inline maths, the plugin closes. Otherwise the build's quotes are curly where these are straight.
// - shiki colours code blocks and the heading-id pass names unnamed headings; a paper may hold neither.
// - rehype-raw parses what is still raw HTML, which in a paper is only a ::figure: the build re-serialises the
//   figure's markup through parse5 where this chain prints it as it is.
const PAPERS = {
  simple: {
    values: { 'usd.rl': '$2.20', 'wealth.rl': '2.1996' },
    figures: { pipe: '<svg class="pipe" aria-hidden="true"><text>Policy</text></svg>' },
  },
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

  it('expands a :v inside maths too, as TeX, where remark-math had already taken it as text', () => {
    expect(html).toContain('<annotation encoding="application/x-tex">2.1996^{12/67}-1</annotation>');
    expect(html).toContain('<mn>2.1996</mn>');
    // the value's $ is escaped, so it is a dollar sign and not the end of the maths
    expect(html).toContain('<annotation encoding="application/x-tex">\\$2.20</annotation>');
    expect(html).not.toContain(':v[');
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

  it('closes a quote right after inline maths, which smartypants (before the plugins in the build) would open', () => {
    // "Sector $g$'s risk": smartypants never sees the g, reads a quote after a space and writes ‘
    expect(html).toMatch(/Sector <span class="katex"><math[^]*?<\/math><\/span>’s risk/);
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

  it('inlines a figure from the paper data', () => {
    expect(html).toContain(PAPERS.simple.figures.pipe);
  });

  it('reports no problem, and the words a reader reads', () => {
    expect(report.paperProblems).toEqual([]);
    // Counted by hand, every element boundary a word boundary and maths and tables left out: brief 40 (title 2,
    // paragraph 7, the def 15 with its citation, the highlight's line 9, the line with two maths 7), notation 1
    // (its title), method 35 (title 3 with its number, paragraph 5, "(1)" 1, the where 5, the def 10, the why 11).
    expect(report.bodyWords).toBe(76);
  });
});

describe('a malformed paper', async () => {
  const { report } = await render(fixture('malformed'), PAPER_PATH);
  const problems = report.paperProblems;

  it('names every problem, so the page can fail the build with all of them', () => {
    const want = [
      'unknown :cite key "nobody1999"',
      'unknown :v key "usd.nobody"',
      'unknown :v key "in.maths"',
      ':cite[…] in $:cite[nobody1999]$ — only :v works in maths',
      'rail="Don\'t" keeps straight quotes and dashes the title would not',
      'a markdown heading in a paper: "A heading of its own"',
      'a code block in a paper: "a code block"',
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
  it('is parsed without the directive syntax, so text that reads like one stays as it was written', async () => {
    const md = 'A ratio of 3:x, a word:break, a :name[with **bold**]{a="1"} and :::fence\n\n::leaf\n\n'
      + 'Write to mailto:me@example.com.\n\n:::note\n\n## Heading\n\nA *quote*.\n\n- item\n';
    const { html } = await render(md, WRITING_PATH);
    expect(html).toBe((await render(md, WRITING_PATH, false)).html);
    expect(html).toContain('<a href="mailto:me@example.com">');
    expect(html).toContain('<h2>Heading</h2>');
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
    await expect(render('A $\\mathcal{\\lambda}$ here.', WRITING_PATH)).rejects.toThrow(/^rehypeMathVariants: .*λ.*\\mathcal\{\\lambda\}/);
  });

  // lib/equations.ts fixes a string and markdown fixes a tree. Both take the variants they rewrite from one table,
  // so they draw every alphabet KaTeX writes the same way, the ones neither rewrites yet included.
  it('draws every alphabet as lib/equations.ts does', async () => {
    for (const tex of ['\\mathcal{X}', '\\mathscr{G}', '\\mathbb{R}', '\\mathbb{12}', '\\mathbf{x}', '\\boldsymbol{\\beta}', '\\mathfrak{g}', '\\mathrm{RC}']) {
      const md = (await render(`$${tex}$`, WRITING_PATH)).html.match(/<math[^]*<\/math>/)?.[0];
      expect(md, tex).toBe(fixMathVariants(katex.renderToString(tex, { output: 'mathml' })).match(/<math[^]*<\/math>/)?.[0]);
    }
  });
});
