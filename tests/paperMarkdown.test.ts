import { readFileSync } from 'node:fs';
import katex from 'katex';
import { describe, expect, it } from 'vitest';
import { fixMathVariants } from '../src/lib/mathml';
import { PAPERS_DIR, checkedReport } from '../src/lib/paperMarkdown';
import { renderMarkdown } from './helpers/paperChain';

// The site's markdown plugins, inside the chain Astro runs them in (tests/helpers/paperChain.ts). Astro's other
// passes are left out, and the format is written so that none of them reaches what is checked here:
// - smartypants runs before the plugins and curls the text of a directive's label, so a title is curled. What a
//   plugin reads from a label as a key cannot hold what it rewrites (a reference key has no "--"), a rail=
//   attribute, which it never sees, is refused if it would need curling, and the one quote it gets wrong, the
//   one right after inline maths, the plugin closes. Otherwise the build's quotes are curly where these are straight.
// - shiki colours code blocks and the heading-id pass names unnamed headings; a paper may hold neither.
// - rehype-raw parses what is still raw HTML, which in a paper is only a figure's drawing: the build
//   re-serialises it through parse5 where this chain prints it as it is.
const PAPERS = {
  simple: {
    values: { 'usd.rl': '$2.20', 'wealth.rl': '2.1996' },
    figures: {
      pipe: '<svg class="pipe" aria-hidden="true"><marker id="ah"></marker><text>Policy</text></svg>',
      table: '<table class="bt"><tbody><tr><th scope="row">Rows</th><td>1</td></tr></tbody></table>',
    },
  },
};
const PUBLICATIONS = [
  { slug: 'simple', abstract: 'We propose & test.', href: 'https://example.org/abs' },
  { slug: 'bare', href: 'https://example.org/bare' },
  { slug: 'named', abstract: 'A portfolio method (RL-BHRP) that spreads risk.', href: 'https://example.org/named' },
];
const REFERENCES = [{
  key: 'maillard2008', authors: ['Maillard, Sébastien', 'Roncalli, Thierry', 'Teïletche, Jérôme'], year: 2008,
  title: 'On the properties of equally-weighted risk contributions portfolios', venue: 'SSRN',
}];
const FRONTMATTER = {
  publication: 'simple', references: REFERENCES,
  errata: [{ date: '2026-11-03', text: 'It printed :v[usd.rl] as $2.21.' }],
};
const PAPER_PATH = `/site/${PAPERS_DIR}/simple.md`;
const WRITING_PATH = '/site/src/content/writing/piece.md';
const fixture = (name: string) => readFileSync(new URL(`./fixtures/papers/${name}.md`, import.meta.url), 'utf8');

const render = (md: string, path: string, plugins = true, frontmatter: Record<string, unknown> = FRONTMATTER) =>
  renderMarkdown(md, path, { papers: PAPERS, publications: PUBLICATIONS, frontmatter, plugins });

describe('a paper file', async () => {
  const { html, report } = await render(fixture('simple'), PAPER_PATH);

  it('renders every section with its id and a numbered h2, and reports them for the rail', () => {
    expect(html).toContain('<section class="sec" id="brief"><h2 id="brief-title">In brief</h2>');
    expect(html).toContain('<section class="sec" id="notation"><h2 id="notation-title">Notation</h2>');
    expect(html).toContain('<section class="sec" id="method"><h2 id="method-title"><span class="n">1</span>The method</h2>');
    expect(report.sections).toEqual([
      { id: 'brief', title: 'In brief', rail: 'In brief' },
      { id: 'abstract', title: 'Abstract', rail: 'Abstract' },
      { id: 'notation', title: 'Notation', rail: 'Notation' },
      { id: 'method', n: '1', title: 'The method', rail: 'Method' },
    ]);
  });

  // Every id the file's markup carries, for the page to refuse one it writes itself (pages/research/[slug].astro):
  // a section's and its heading's, an equation's, a theorem's, a figure's, and those inside a figure's drawing.
  it('reports every id it writes, and no other', () => {
    const written = [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
    expect([...report.ids].sort()).toEqual(written.sort());
    expect(report.ids).toEqual(expect.arrayContaining(['brief', 'brief-title', 'eq-1', 'thm-1', 'figure-1', 'table-1', 'ah']));
  });

  // The aside is the heading's, not the title's: the rail and the phone's Contents name the section "Abstract".
  it("sets a section's aside after its title, in the heading only", () => {
    expect(html).toContain('<section class="sec" id="abstract"><h2 id="abstract-title">Abstract <span class="aside">· in the paper’s own words</span></h2>');
  });

  // The record's abstract, verbatim, as the page's own nodes: counted with the words a reader reads, and kept whole
  // where a name would break (below) as the file's prose is.
  it("quotes the record's abstract where ::abstract stands, citing the record's page", () => {
    expect(html).toContain('<blockquote class="abstract" cite="https://example.org/abs"><p>We propose &#x26; test.</p></blockquote>'
      + '<p>What the abstract leaves out.</p>');
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
    const eq = html.slice(html.indexOf('<div class="eq an" id="eq-1">'), html.indexOf('<div class="thm"'));
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

  // A row's scripted symbol names the family: W_g is the sector weight for every g, and the vector W of them.
  it('tags W_g in each display that contains it, and W with any other script or none, as one row', () => {
    expect(html.match(/<msub class="sym" data-sym="1"><mi>W<\/mi><mi>g<\/mi><\/msub>/g)).toHaveLength(2);
    expect(html.match(/<mi class="sym" data-sym="1">W<\/mi>/g)).toHaveLength(3);   // eq (1) wide and narrow, eq (2)
    expect(html.match(/<msup class="sym" data-sym="1"><mi>W<\/mi>/g)).toHaveLength(1);   // eq (2)'s W^T
  });

  it('tags a symbol that is several siblings as one, and a row matches when any of its symbols does', () => {
    // RC_g(w) is four siblings in the MathML (msub, "(", w, ")"); G is in no display, and the row still counts
    const rc = html.match(/<mrow class="sym" data-sym="2"><msub><mrow><mi[^>]*>R<\/mi><mi[^>]*>C<\/mi><\/mrow><mi>g<\/mi><\/msub><mo[^>]*>\(<\/mo><mi>w<\/mi><mo[^>]*>\)<\/mo><\/mrow>/g) ?? [];
    expect(rc).toHaveLength(2);
    // eq (1)'s two displays three symbols each, eq (2)'s two; the inline W_g in the where is prose, not a display
    expect(html.match(/class="sym"/g)).toHaveLength(8);
  });

  // A figure's caption is the container's prose; its number and its kind are the plugin's, from n and the drawing.
  it('wraps a figure in <figure>, numbered, its caption after the drawing', () => {
    expect(html).toContain(`<figure class="fig" id="figure-1">${PAPERS.simple.figures.pipe}<figcaption><span class="fig-no">Figure 1.</span> `
      + '<strong>How it runs.</strong> The pieces, $2.20 in all.</figcaption></figure>');
  });

  // A table is captioned above, its notes below; it scrolls in its own box, and its notes sit beside it.
  it('captions a table above it, its other paragraphs and its notes below', () => {
    expect(html).toContain(`<figure class="tbl an" id="table-1"><figcaption class="cap"><span class="fig-no">Table 1.</span> The table, every row.</figcaption>`
      + `<div class="tbl-scroll">${PAPERS.simple.figures.table}</div><p class="src">Source: the paper.</p><p class="src"><sup>a</sup> A note on one cell.</p>`
      + '<aside class="mn def"><dfn>Reading the table.</dfn> One row a measure.</aside></figure>');
  });

  it('frames a theorem, its displays inside it', () => {
    expect(html).toMatch(/<div class="thm" id="thm-1"><p><strong>Theorem 1<\/strong> <em>\(weights\)\.<\/em> In words first:<\/p><p>The weights add up\.<\/p><p>In symbols,<\/p><div class="eq an" id="eq-2">/);
  });

  it('sets a pointer to the paper as its own paragraph', () => {
    expect(html).toContain('<p class="inpaper"><strong>In the paper:</strong> Alg. 1.</p>');
  });

  // The errata are frontmatter, so they reach the page unrendered; their :v is expanded here, by the same lookup.
  it("reports the errata's text with its values filled in", () => {
    expect(report.errataText).toEqual(['It printed $2.20 as $2.21.']);
  });

  it('reports no problem, and the words a reader reads', () => {
    expect(report.paperProblems).toEqual([]);
    // Counted by hand, every element boundary a word boundary and maths, tables and the figures' drawings (raw
    // HTML) left out: brief 40 (title 2, paragraph 7, the def 15 with its citation, the highlight's line 9, the line
    // with two maths 7), abstract 14 (title 1, aside 5, the record's abstract 3, paragraph 5), notation 1 (its
    // title), method 85 (title 3 with its number, paragraph 5, "(1)" 1, the where 5, the def 10, the why 11; the
    // theorem 13 with "(2)"; Figure 1's caption 10 with its number; Table 1's 22: caption 6, its two notes 3 and 6,
    // the def 7; the pointer 5).
    expect(report.bodyWords).toBe(140);
  });
});

describe('the words a reader reads', () => {
  // A :v is a text node of its own, but no word boundary: the title, then From, mid-$2.20, to and $2.20–$2.20.
  it('counts a value as part of the word it is written into', async () => {
    const md = '::::section[S]{#s}\nFrom mid-:v[usd.rl] to :v[usd.rl]–:v[usd.rl].\n::::\n';
    expect((await render(md, PAPER_PATH)).report.bodyWords).toBe(5);
  });
});

describe('a line break', () => {
  // A :v is a text node of its own, so "2012–2019" written as two values is joined before it is kept whole.
  it('never falls inside a hyphenated name, a span of years or an ISO date', async () => {
    const md = '::::section[S]{#s}\nRL-BHRP’s test, :v[usd.rl] on 2025-08-13, and Ledoit–Wolf, over 2012–2019.\n::::\n';
    const { html } = await render(md, PAPER_PATH);
    expect(html).toContain('<p><span class="nw">RL-BHRP</span>’s test, $2.20 on <span class="nw">2025-08-13</span>, and Ledoit–Wolf, over <span class="nw">2012–2019</span>.</p>');
  });

  it("never falls inside one in the record's abstract either", async () => {
    const md = ':::section[Abstract]{#abstract}\n::abstract\n:::\n';
    const { html } = await render(md, PAPER_PATH, true, { publication: 'named' });
    expect(html).toContain('<p>A portfolio method (<span class="nw">RL-BHRP</span>) that spreads risk.</p>');
  });
});

describe('a notation row', async () => {
  const md = '::::section[Notation]{#notation}\n:::notation\n| Symbol | Meaning |\n| --- | --- |\n'
    + '| $i\\in\\mathcal{I}_{g}$ | A stock of sector $g$. |\n| $\\eta_{i\\mid g}$ | Its weight in the sector. |\n:::\n::::\n\n'
    + '::::section[Eq]{#eq}\n:::eq{#e}\n$$\nw_{i}=W_{g(i)}\\,\\eta_{i\\mid g(i)}\n$$\n:::\n::::\n';
  const { html, report } = await render(md, PAPER_PATH);

  // i ∈ 𝓘_g introduces i, and g, the index of its set: the row is its symbols split at the relation as well as at
  // commas, the set's index among them.
  it('splits at a relation, so i ∈ I_g tags every i and every g', () => {
    expect(html.match(/<mi class="sym" data-sym="1">i<\/mi>/g)).toHaveLength(4);   // in w_i, W_g(i) and η's twice
    expect(html.match(/<mi class="sym" data-sym="1">g<\/mi>/g)).toHaveLength(2);   // in W_g(i) and η's
  });

  it('matches a scripted symbol written with other indices: η_{i|g} is η_{i|g(i)} as well', () => {
    expect(html).toMatch(/<msub class="sym" data-sym="2"><mi>η<\/mi>/);
    expect(report.paperProblems).toEqual([]);
  });

  // A symbol's scripts are symbols of their own, so hovering the i ∈ I_g row lights the i inside η_{i|g(i)}; its
  // letter is not tagged again, as η is the symbol and not a second one inside it.
  it('tags what a tagged symbol holds, never its own letter', () => {
    expect(html).toMatch(/<msub class="sym" data-sym="2"><mi>η<\/mi><mrow><mi class="sym" data-sym="1">i<\/mi>/);
    expect(html.match(/<mi class="sym" data-sym="2">η<\/mi>/g)).toBeNull();
  });

  // A Symbol cell may set each symbol as maths of its own, `$N$, $G$`: every one of them is the row's, and the row is
  // matched by any of them, as by any symbol of `N,\ G`.
  it('reads every maths in its Symbol cell, and names the cell as written when none is in a display', async () => {
    const two = '::::section[Notation]{#notation}\n:::notation\n| Symbol | Meaning |\n| --- | --- |\n'
      + '| $N$, $G$ | The stocks, and the sectors. |\n:::\n::::\n\n::::section[Eq]{#eq}\n:::eq{#e}\n$$\nN + G\n$$\n:::\n::::\n';
    const { html: both, report: ok } = await render(two, PAPER_PATH);
    expect(both).toContain('<mi class="sym" data-sym="1">N</mi>');
    expect(both).toContain('<mi class="sym" data-sym="1">G</mi>');
    expect(ok.paperProblems).toEqual([]);
    const { report: none } = await render(two.replace('N + G', 'M + H'), PAPER_PATH);
    expect(none.paperProblems).toEqual(['notation row $N$, $G$ matches no display — mark it {text-only} if it is only in the prose']);
  });
});

describe('a malformed paper', async () => {
  const errata = [{ date: '2026-11-03', text: 'A slip, :v[usd.typo].' }];
  const { report } = await render(fixture('malformed'), PAPER_PATH, true, { ...FRONTMATTER, errata });
  const problems = report.paperProblems;

  it("names a ::abstract whose record has none", async () => {
    const md = ':::section[Abstract]{#abstract}\n::abstract\n:::\n';
    const bare = await render(md, PAPER_PATH, true, { publication: 'bare' });
    expect(bare.report.paperProblems).toEqual(['::abstract, and the record "bare" has no abstract']);
  });

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
      'unknown directive ::figure',
      'unknown :::figure name "nothing"',
      ':::figure pipe has no n=',
      ':::figure pipe has no caption',
      'aside="it\'s" keeps straight quotes and dashes the title would not',
      'unknown :v key "usd.typo"',
      '\\tag in $$x = 1 \\tag{9}$$ — number it with ::::eq{n=…}',
      '::::eq #eq-9 needs one $$ display, or a $$ wide and a $$ narrow',
      ':::where outside an ::::eq',
      ':::section #checked has no [title]',
      'id #checked is used twice',
      ':::section [No id] has no #id',
      // the section [Misplaced] holds one of each block holding what it may not
      ':::section #inner is inside another block — sections are top level',
      'a term without an #id: "nameless"',
      '::::eq #eq-8 holds a paragraph — an eq holds its display, its :::where and its notes',
      ':::figure pipe holds a list — a figure holds its caption and its notes',
      ':::inpaper holds a list — it is a paragraph pointing into the paper',
      ':::notation holds one table, | Symbol | Meaning |, and nothing else',
      'a second :::notation — a paper has one Notation table, and its rows key the symbols',
      // a heading's id is the section's and "-title", and a figure's drawing carries ids of its own (pipe's marker)
      'id #eqs-title is used twice',
      'id #ah is used twice',
      // a note first in its section (after only the heading) or first in a theorem has no block to join
      ':::why must follow the block it explains',
      ':::def must follow the block it explains',
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

// What the paper page does with a render's report (pages/research/[slug].astro): the plugins cannot fail the build, so
// it fails there, on every problem, on an id the page writes itself, and on a file the plugins never compiled.
describe("the paper page's check of a render", () => {
  const owns = (id: string) => id === 'cite';

  it('hands back the report of a paper with no problem', async () => {
    const { report } = await render(fixture('simple'), PAPER_PATH);
    expect(checkedReport('simple.md', report, owns)).toBe(report);
  });

  it('fails on every problem, naming the file and each', async () => {
    const { report } = await render(fixture('malformed'), PAPER_PATH);
    expect(() => checkedReport('malformed.md', report, owns))
      .toThrow(`malformed.md has ${report.paperProblems.length} problem(s):\n  ${report.paperProblems.join('\n  ')}`);
  });

  it('fails on an id the page writes itself', async () => {
    const { report } = await render(':::section[Cite]{#cite}\nText.\n:::\n', PAPER_PATH);
    expect(() => checkedReport('cite.md', report, owns)).toThrow('cite.md has 1 problem(s):\n  id #cite is one this page writes itself');
  });

  // A file outside the papers directory is not compiled as a paper, so its render reports nothing at all.
  it('fails on a render with no report, rather than on a TypeError later', async () => {
    const { report } = await render(fixture('simple'), WRITING_PATH);
    expect(() => checkedReport('piece.md', report, owns)).toThrow(`piece.md has no paper report: only a file under ${PAPERS_DIR}/ is compiled as a paper`);
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
  // so they draw every alphabet they rewrite the same way, and refuse the same others.
  it('draws every alphabet as lib/equations.ts does', async () => {
    for (const tex of ['\\mathcal{X}', '\\mathscr{G}', '\\mathbb{R}', '\\mathbb{12}', '\\mathrm{RC}']) {
      const md = (await render(`$${tex}$`, WRITING_PATH)).html.match(/<math[^]*<\/math>/)?.[0];
      expect(md, tex).toBe(fixMathVariants(katex.renderToString(tex, { output: 'mathml' })).match(/<math[^]*<\/math>/)?.[0]);
    }
  });

  it('refuses, as lib/equations.ts does, an alphabet it has no rewrite for, which Chrome would draw plain', async () => {
    for (const [tex, variant] of [['\\mathbf{x}', 'bold'], ['\\boldsymbol{\\beta}', 'bold-italic'], ['\\mathfrak{g}', 'fraktur']]) {
      const escaped = tex.replace(/[\\{}]/g, '\\$&');
      await expect(render(`A $${tex}$ here.`, WRITING_PATH), tex).rejects.toThrow(new RegExp(`^rehypeMathVariants: mathvariant="${variant}" has no rewrite.*, in \\$${escaped}\\$`));
    }
  });
});
