import { readdirSync, readFileSync } from 'node:fs';
import { join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { stripComments, verifyStrip } from '../src/integrations/stripHtmlComments';

/* ================================================================================================
   NO HTML COMMENT REACHES A VISITOR — AND THE SCANNER THAT ENFORCES THAT DOES NOTHING ELSE.

   Two halves, in the order of how much each can hurt:

     1. THE SCANNER, on the inputs that break the one-line version of this feature. Deleting HTML
        comments with `html.replace(/<!--[\s\S]*?-->/g, '')` is a page-corrupting bug in waiting,
        because `<!--` and `-->` are ordinary characters inside <script>, <style> and attribute
        values — and when the regex misreads one of those as a comment start, it deletes everything
        up to the next `-->` in the file, which is real markup. Every case below is that class.

     2. THE BUILT SITE, which is the actual claim: every .html file under dist/ carries no comments.
        It reads dist/, so it needs a build, and a missing build is a LOUD failure rather than a skip
        — same rule and same reason as tests/distSmoke.test.ts.

   The two halves check different things on purpose. Half 1 can pass on a scanner that is never
   called; half 2 can pass on a build that happened to emit no comments. Together they say the
   transform is wired in AND correct.
   ================================================================================================ */

describe('stripComments — deletes comments, and only comments', () => {
  /** The whole contract in one helper: what came out, and what it cost. */
  const strip = (html: string) => {
    const r = stripComments(html);
    // Every case in this file is expected to be a legal rewrite, so run the build's own safety net
    // over each of them too. It is free and it means a scanner bug shows up here as the specific
    // thing that changed rather than as a puzzling string mismatch.
    verifyStrip('(test input)', html, r);
    return r;
  };

  it('removes a comment and leaves the whitespace around it exactly as it was', () => {
    // The indentation and the newlines are NOT collapsed. That is what makes the visible text
    // provably unchanged: a browser reads `foo<!--x-->bar` as one word, so touching the whitespace
    // is the one way this transform could alter a text run.
    const out = strip('<p>a</p>\n  <!-- note -->\n  <p>b</p>');
    expect(out.html).toBe('<p>a</p>\n  \n  <p>b</p>');
    expect(out.removed).toBe(1);
    expect(out.chars).toBe('<!-- note -->'.length);
  });

  it('removes a multi-line comment without disturbing the lines around it', () => {
    const out = strip('<main>\n  <!-- one\n       two\n       three -->\n  <p>x</p>\n</main>');
    expect(out.html).toBe('<main>\n  \n  <p>x</p>\n</main>');
  });

  it('leaves a <script> alone even when its JavaScript contains BOTH delimiters', () => {
    // `-->` is legal JavaScript at the start of a line (HTML-like comment syntax, kept in the spec
    // for web compatibility), and `a-->b` is `a-- > b`. `<!--` is legal there for the same reason.
    // A naive regex starting at the `<!--` in the string literal would delete forward to the `-->`
    // and take `</script><p>kept</p>` with it.
    const html = '<script>const s = "<!--"; let a = 5; if (a-->0) {}\n</script>\n<p>kept</p>';
    expect(strip(html).html).toBe(html);
    expect(strip(html).removed).toBe(0);
  });

  it('leaves a <style> alone when a CSS string contains the delimiters', () => {
    const html = '<style>.a::after{content:"<!-- x -->"}</style><p>kept</p>';
    expect(strip(html).html).toBe(html);
  });

  it('strips markup comments while leaving a script that sits between them untouched', () => {
    // The interesting ordering: a real comment, then a script whose body holds a lone `-->`. Get the
    // zones wrong and the first comment's deletion runs into the script.
    const out = strip('<!-- a -->\n<script>x-->y\n</script>\n<!-- b -->\n<p>p</p>');
    expect(out.html).toBe('\n<script>x-->y\n</script>\n\n<p>p</p>');
    expect(out.removed).toBe(2);
  });

  it('does not read a `<!--` inside an attribute value as a comment', () => {
    // Astro does not escape `<` in attribute values, and this site puts structured data in them
    // (the cow's lines travel as JSON on `data-lines`). The naive regex turns this page into
    // `<div data-x=""><p>gone` — an attribute emptied and a paragraph destroyed.
    const html = '<div data-x="<!-- not a comment">\n  <p>kept</p>\n</div>\n<!-- real -->';
    const out = strip(html);
    expect(out.html).toBe('<div data-x="<!-- not a comment">\n  <p>kept</p>\n</div>\n');
    expect(out.removed).toBe(1);
  });

  it('finds the end of a tag whose attribute value contains `>`', () => {
    const out = strip('<a title="a>b" href="/x">t</a><!-- c -->');
    expect(out.html).toBe('<a title="a>b" href="/x">t</a>');
  });

  it('keeps the doctype, which is not a comment', () => {
    const out = strip('<!DOCTYPE html>\n<html><head><!-- h --></head></html>');
    expect(out.html).toBe('<!DOCTYPE html>\n<html><head></head></html>');
  });

  it('keeps conditional comments, which are markup to old IE rather than notes', () => {
    const html = '<!--[if lt IE 9]><script src="/s.js"></script><![endif]-->\n<!-- note -->';
    const out = strip(html);
    expect(out.html).toBe('<!--[if lt IE 9]><script src="/s.js"></script><![endif]-->\n');
    expect(out.kept).toBe(1);
    expect(out.removed).toBe(1);
  });

  it('keeps the downlevel-revealed halves of a conditional comment too', () => {
    // `<!--[if !IE]>-->` … `<!--<![endif]-->` — the second half opens with `<!--<![endif]`, which is
    // not the `[if` shape, so it needs its own clause or the pair ships half-closed.
    const html = '<!--[if !IE]>--><p>x</p><!--<![endif]-->';
    expect(strip(html).html).toBe(html);
  });

  it('honours `--!>` as a comment terminator', () => {
    // "Incorrectly closed comment": a parse error, and it still ends the comment. Searching only for
    // `-->` would sail past it to the next real one and delete the markup in between.
    const out = strip('<p>a</p><!-- x --!><p>b</p><!-- y -->');
    expect(out.html).toBe('<p>a</p><p>b</p>');
    expect(out.removed).toBe(2);
  });

  it('honours the abrupt-closing empty comments `<!-->` and `<!--->`', () => {
    // Neither contains `-->`, so a scan for one runs off the end of the comment.
    expect(strip('<p>a</p><!--><p>b</p>').html).toBe('<p>a</p><p>b</p>');
    expect(strip('<p>a</p><!---><p>b</p>').html).toBe('<p>a</p><p>b</p>');
  });

  it('ends a comment at the FIRST terminator, the way the parser does', () => {
    // `<!--` inside a comment does not nest. Everything after the first `-->` is markup again.
    const out = strip('<!-- a <!-- b --><p>markup</p>');
    expect(out.html).toBe('<p>markup</p>');
    expect(out.removed).toBe(1);
  });

  it('leaves an unterminated comment in place rather than guessing where it ends', () => {
    // The parser would call the rest of the file one comment. The document is already broken; the
    // build should not compound it by deleting an unknown quantity of it.
    const html = '<p>a</p><!-- runs off the end';
    expect(strip(html).html).toBe(html);
    expect(strip(html).removed).toBe(0);
  });

  it('treats <textarea> and <title> as raw text as well', () => {
    // Escapable raw text: a `<!--` there is literal text a reader can see, not a comment.
    const html = '<title>a <!-- b --> c</title><textarea><!-- d --></textarea><!-- e -->';
    const out = strip(html);
    expect(out.html).toBe('<title>a <!-- b --> c</title><textarea><!-- d --></textarea>');
    expect(out.removed).toBe(1);
  });

  it('does not mistake `</scriptfoo>` for the close of a <script>', () => {
    const html = '<script>a</scriptfoo>b</script><!-- x -->';
    expect(strip(html).html).toBe('<script>a</scriptfoo>b</script>');
  });

  it('handles a self-closing <style/> in inline SVG without swallowing the document', () => {
    // Foreign content permits `<style/>`; treating it as opening a raw-text run would skip forward
    // to the next `</style>` — i.e. to the end of the file — and strip nothing after it.
    const out = strip('<svg><style/></svg><!-- x --><p>kept</p>');
    expect(out.html).toBe('<svg><style/></svg><p>kept</p>');
    expect(out.removed).toBe(1);
  });

  it('leaves an unescaped `<` in text alone', () => {
    const html = '<p>a < b</p><!-- x -->';
    expect(strip(html).html).toBe('<p>a < b</p>');
  });

  it('is a no-op on a document with no comments', () => {
    const html = '<!DOCTYPE html>\n<html><body><p>hello</p></body></html>\n';
    const out = strip(html);
    expect(out.html).toBe(html);
    expect(out.removed).toBe(0);
    expect(out.chars).toBe(0);
  });
});

describe('the whitespace-eating comment idiom, which is safe and is worth pinning', () => {
  it('takes the eaten whitespace with it, so the rendering does not change', () => {
    /* The obvious worry about deleting comments, and it turns out not to be one. In

           <span>a</span><!--
           --><span>b</span>

       the comment exists to stop the newline becoming a space between two inline boxes; the page
       renders "ab". You would break that by deleting the DELIMITERS and keeping what is between
       them. The newline is inside the span, so deleting the span deletes it too — and the output
       still renders "ab". Pinned as a test because it is the argument the whole "deletion only, no
       whitespace collapsing" rule rests on: the moment somebody "tidies up" the blank line a comment
       leaves behind, this is what breaks. */
    const out = stripComments('<span>a</span><!--\n--><span>b</span>');
    expect(out.html).toBe('<span>a</span><span>b</span>');
    verifyStrip('(test input)', '<span>a</span><!--\n--><span>b</span>', out);
  });
});

describe('verifyStrip — the build-time net', () => {
  /** A StripResult that did not come from the scanner, for testing the net itself. */
  const claim = (html: string, chars: number, spans: string[]) => ({
    html,
    removed: spans.length,
    chars,
    kept: 0,
    spans,
    delimitersOutsideMarkup: 0,
  });

  it('rejects a deletion that ran past the end of a comment', () => {
    // THE failure this exists for: a `<!--` that is not a comment start (here, in an attribute), a
    // deletion that runs to the next `-->` further down the file, and real markup destroyed on the
    // way. The visible text survives, so a text-only check calls it clean — but the deleted span has
    // a terminator in its middle, which no comment does.
    const before = '<div data-x="<!--x-->" class="c">text</div>';
    const eaten = '<!--x-->" class="c">text</div>';
    expect(() =>
      verifyStrip('page.html', before, claim('<div data-x="', eaten.length, [eaten])),
    ).toThrow(/not a single well-formed comment/);
  });

  it('rejects a rewrite that ate markup while leaving the words alone', () => {
    // Same corruption, but reported as a well-formed span so check 2 passes and check 3 has to be
    // the one that fires. This is what the tag comparison is for: every visible word is intact.
    const before = '<div data-x="<!--a-->" class="c">text</div>';
    const after = '<div class="c">text</div>';
    expect(() =>
      verifyStrip('page.html', before, claim(after, before.length - after.length, ['<!--a-->'])),
    ).toThrow(/the markup changed/);
  });

  it('rejects a rewrite that dropped visible text', () => {
    const before = '<p>keep</p><!-- x -->';
    const after = '<p></p>';
    expect(() =>
      verifyStrip('page.html', before, claim(after, before.length - after.length, ['<!-- x -->'])),
    ).toThrow(/the visible text changed/);
  });

  it('rejects a rewrite whose byte accounting does not add up', () => {
    const before = '<p>a</p><!-- x -->';
    expect(() => verifyStrip('page.html', before, claim('<p>a</p>', 3, ['<!-- x -->']))).toThrow(
      /byte accounting/,
    );
  });

  it('stands the naive cross-check down on a page the naive model gets wrong', () => {
    /* The precondition, stated as a test, because it is the one place this file trades coverage for
       safety. On a page holding a delimiter inside an attribute value, the naive one-regex model is
       the thing that is wrong — so using it as the reference would fail the build for a CORRECT
       rewrite. Below, the scanner's own (correct) output is rejected when the cross-check is forced
       on, and accepted when the precondition is respected. Checks 1 and 2 have no precondition and
       still cover the page; it is check 2 that catches the real corruption anyway. */
    const before = '<div data-x="<!--"></div><p>a</p><!-- c -->';
    const result = stripComments(before);
    expect(result.html).toBe('<div data-x="<!--"></div><p>a</p>');
    expect(result.delimitersOutsideMarkup).toBe(1);

    // Forced on, the naive model reads the attribute's `<!--` as a comment start, deletes forward to
    // the real comment's `-->`, and "before" comes out as a page with no words on it.
    expect(() =>
      verifyStrip('page.html', before, { ...result, delimitersOutsideMarkup: 0 }),
    ).toThrow(/the visible text changed/);

    expect(() => verifyStrip('page.html', before, result)).not.toThrow();
  });

  it('stands down when a deleted comment mentions a <script> tag', () => {
    // The other way the naive model breaks: withoutRawText sees `<script` inside the comment, pairs
    // it with the real `</script>` further down, and deletes the markup in between. A comment that
    // talks about a script tag is an ordinary thing to write, so this must not fail a build.
    const before = '<!-- see the <script> tag --><p>a</p><script>x</script>';
    const result = stripComments(before);
    expect(result.html).toBe('<p>a</p><script>x</script>');
    expect(() => verifyStrip('page.html', before, result)).not.toThrow();
  });
});

/* ── THE BUILT SITE ─────────────────────────────────────────────────────────────────────────────── */

const DIST = fileURLToPath(new URL('../dist/', import.meta.url));

const NEEDS_BUILD =
  'tests/htmlComments.test.ts found no HTML in dist/. It inspects the BUILT site, so `npm run ' +
  'build` has to run before `npm test`. ci.yml already orders it that way; see the same note in ' +
  'tests/distSmoke.test.ts.';

const NOT_WIRED =
  'If dist/ has comments in it at all, the most likely cause is that the integration is not wired ' +
  'in: astro.config.mjs needs `import stripHtmlComments from \'./src/integrations/' +
  "stripHtmlComments.ts';` and `stripHtmlComments()` in its `integrations` array.";

const htmlFiles = (dir: string, out: string[] = []): string[] => {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out; // dist/ absent entirely — the guard below turns that into a readable failure.
  }
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) htmlFiles(p, out);
    else if (e.name.endsWith('.html')) out.push(p);
  }
  return out;
};

/**
 * Drop the bodies of <script> and <style> before looking for comments.
 *
 * Deliberately mirrors the one exclusion the integration makes, and it is stated here in the test's
 * own regex rather than imported so the two are not the same code agreeing with itself. The reason
 * for the exclusion is the reason the scanner exists: JS and CSS legitimately contain `<!--` and
 * `-->`, so a delimiter found in there is not a comment and its presence is not a leak.
 */
const markupOnly = (html: string): string =>
  html.replace(/(<(script|style)\b[^>]*>)[\s\S]*?(<\/\2\s*>)/gi, '$1$3');

/** Every comment in a page's markup, excluding the conditional comments the build keeps. */
const commentsIn = (html: string): string[] =>
  [...markupOnly(html).matchAll(/<!--[\s\S]*?(?:-->|--!>)/g)]
    .map((m) => m[0])
    .filter((c) => !/^<!--\s*(?:\[|<!\[endif)/i.test(c));

interface Built {
  /** dist-relative path with forward slashes, e.g. "writing/index.html". */
  file: string;
  html: string;
}

let cached: Built[] | null = null;

const built = (): Built[] => {
  if (cached) return cached;
  const files = htmlFiles(DIST).sort();
  if (files.length === 0) throw new Error(NEEDS_BUILD);
  cached = files.map((abs) => ({
    file: abs.slice(DIST.length).split(sep).join('/'),
    html: readFileSync(abs, 'utf8'),
  }));
  return cached;
};

describe('the built site ships no HTML comments', () => {
  it('has a build to inspect at all', () => {
    // First, so a missing dist/ reads as "you did not build" once rather than as several
    // unrelated-looking failures below.
    expect(built().length, NEEDS_BUILD).toBeGreaterThan(5);
  });

  it('carries zero HTML comments in the markup of any page', () => {
    const leaks: string[] = [];
    for (const p of built()) {
      for (const c of commentsIn(p.html)) {
        leaks.push(`${p.file}: ${c.replace(/\s+/g, ' ').slice(0, 120)}`);
      }
    }
    // One message listing every leak: a page regains its comments all at once, and reporting them
    // one run at a time throws away the information about which pages are affected.
    expect(
      leaks,
      `HTML comments reached the built site:\n  ${leaks.join('\n  ')}\n\n${NOT_WIRED}`,
    ).toEqual([]);
  });

  it('still has its doctype on every document', () => {
    // The doctype starts with `<!` too, and eating it would be invisible to the comment check above
    // while putting every page into quirks mode.
    for (const p of built()) {
      // dist also holds the Google Search Console verification file: a one-line text file that ends
      // in .html and is not a document. Anything without an <html> element is not being asked.
      if (!/<html[\s>]/i.test(p.html)) continue;
      expect(
        /^﻿?\s*<!DOCTYPE html>/i.test(p.html),
        `${p.file} does not begin with <!DOCTYPE html>`,
      ).toBe(true);
    }
  });

  it('does not ship the design-review idiom the source comments are written in', () => {
    /* AN INDEPENDENT CHECK, and the one that speaks to WHY this exists. The comment check above is
       structural: it would pass on a build that had simply been rewritten to hide review notes in
       visible copy. What must not ship is the material — and the material has a fingerprint, because
       nearly every design decision in this repo is written down as `The owner: "…"` quoting the
       review that settled it.

       Measured on the un-stripped build: `owner` occurs 26 times across the pages, every one of them
       inside a comment and zero outside one. So a hit here means internal review notes are in the
       output again, by whatever route.

       If a page ever legitimately prints the word in visible copy — "the portfolio's owner" — this
       assertion is the thing to narrow, not the copy. */
    const hits: string[] = [];
    for (const p of built()) {
      for (const m of p.html.matchAll(/\bowner\b/gi)) {
        hits.push(`${p.file}: …${p.html.slice(Math.max(0, m.index - 70), m.index + 70).replace(/\s+/g, ' ')}…`);
      }
    }
    expect(
      hits,
      'the built site contains the word "owner", which in this repo is the design-review idiom ' +
        `("The owner: \\"…\\"") used in source comments:\n  ${hits.join('\n  ')}\n\n${NOT_WIRED}`,
    ).toEqual([]);
  });
});
