import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AstroIntegration, AstroIntegrationLogger } from 'astro';

/* ================================================================================================
   HTML COMMENTS STAY IN SOURCE AND DO NOT SHIP.

   This repo's comments are its best documentation, and the ones in .astro markup are the most
   valuable of the lot: they are where a design decision is written down next to the thing it
   decided, usually quoting the owner verbatim from the review that settled it. Astro's compiler
   preserves them, so all of that reached the browser. Measured on the build this was written
   against: 79 comments, 30,677 bytes of them, across 6 of the 9 pages — 56 comments and 22,880 bytes
   on the homepage alone, 9.6% of that page's 237KB. (It was 91 comments across 12 pages before the
   prototype routes were retired in the same batch as this; /proto-paper took twelve of them with it,
   /proto-ladder had none.)

   Two reasons that agree, and the second is the one that matters:

     1. Weight. 22KB of prose in the critical-path document of a site held to Lighthouse Perf >= 99,
        for content no visitor reads and no crawler wants.

     2. It is internal material. The comments quote design review: "seems crowded now and as the
        tagline gets smaller I bet people don't read it", "you may delete everything from below",
        "you can delete the terminal at the bottom, it's already useless" — plus rejected options,
        measurement numbers and the reasoning behind each cut. astro.config.mjs already keeps the
        /proto-* routes out of the sitemap on exactly this ground ("their rendered bodies quote
        internal review notes"), while the homepage shipped the same class of material to everyone.
        Filtering the prototypes and not the homepage was an inconsistency, not a policy.

   SO: keep every comment in source, delete it from the emitted HTML. Nothing about how the repo is
   written changes; only View Source does.

   ── WHY A HAND-WRITTEN SCANNER AND NOT ONE REGEX ────────────────────────────────────────────────
   `html.replace(/<!--[\s\S]*?-->/g, '')` is the obvious implementation and it is dangerous, because
   `<!--` is only the start of a comment in ONE of the places it can appear in a built document:

     · Inside <script>, `<!--` and `-->` are ordinary JavaScript. `-->` in particular is legal JS at
       the start of a line (HTML-like comment syntax, still in the spec for web compatibility) and
       `a-->b` is just `a-- > b`. Inside <style> either sequence can sit in a string or a url().
     · Inside an attribute value. Astro does not escape `<` in attributes, and this site does put
       structured data there (the cow's lines travel as JSON on `data-lines`).

   In every one of those cases the naive regex deletes from a `<!--` that is not a comment to the
   next `-->` ANYWHERE later in the file, which silently eats real markup. That is not a hypothetical
   class of bug — it is the standard way this optimisation corrupts a page.

   The scanner below walks the document once and only ever deletes a span that the HTML parser would
   also have called a comment. It knows three things a `.replace()` cannot: where a tag ends (quoted
   attribute values may contain `>`), that raw-text elements' contents are not markup, and that a
   comment's terminator is not always `-->`.

   Deliberately NOT done: whitespace collapsing, attribute minification, anything else. One job. A
   removed comment leaves its surrounding whitespace exactly as it was, which is what makes the
   reader-visible output provably identical (see verifyStrip) — trimming the blank line a comment leaves
   behind would start changing text runs, and `foo<!--x-->bar` is one word to a browser.
   ================================================================================================ */

/**
 * Elements whose content the HTML parser does not read as markup, so a comment cannot begin inside
 * one and any comment-looking sequence in one must be left alone.
 *
 * `script`/`style` are *raw text*: their contents reach a JS or CSS parser untouched, and both of
 * those languages use `<!--` / `-->` for their own purposes. `textarea`/`title` are *escapable* raw
 * text — a `<!--` there is literal text a reader can see, not a comment. Including the latter two
 * costs one word each and closes the whole category; there is nothing in this site's output that
 * needs it today.
 */
const RAW_TEXT = new Set(['script', 'style', 'textarea', 'title']);

/** A comment we keep. `<!--[if …]>` and `<!--<![endif]-->` are markup to old IE, not a note. */
const IS_CONDITIONAL = /^<!--\s*(?:\[|<!\[endif)/i;

/**
 * Every comment-delimiter sequence, as a naive `.replace()` would look for them.
 *
 * Written once and shared by the two comparison helpers below, so the "what the careless version
 * would have done" model is one expression rather than two that drift. The specific branches come
 * first because neither `<!-->` nor `<!--->` contains `-->`: the general branch would run past the
 * end of them and take the next comment's terminator instead.
 */
const NAIVE_COMMENT = /<!--->|<!-->|<!--[\s\S]*?(?:-->|--!>)/g;

/** `<!--` / `-->` / `--!>` — the sequences that mean "comment" in markup and nothing anywhere else. */
const DELIMITER = /<!--|--!?>/g;

export interface StripResult {
  html: string;
  /** How many comments were deleted. */
  removed: number;
  /**
   * How many CHARACTERS those comments were — not bytes.
   *
   * The distinction is real here and it is not pedantry: the comments quote design review, so they
   * are full of em-dashes, smart quotes and box-drawing rules, and on the homepage the two figures
   * differ by 134 (22,746 characters, 22,880 bytes). This field is the one the deletion-only
   * accounting uses, because that compares JavaScript string lengths; the hook reports real bytes,
   * measured off the file.
   */
  chars: number;
  /** Comments deliberately left in place (conditional comments). */
  kept: number;
  /** The deleted comments, verbatim. verifyStrip re-reads them; the report only counts them. */
  spans: string[];
  /**
   * How many comment delimiters appeared somewhere a comment cannot start — inside a tag (an
   * attribute value) or inside a raw-text element's body.
   *
   * This is the number that says whether the naive one-regex implementation would have agreed with
   * this scanner on this document. Zero means the two are provably equivalent here, which is what
   * lets verifyStrip use the naive model as an independent second opinion (see there). Non-zero
   * means the page contains the exact material the scanner exists for, and the naive model is the
   * thing that is wrong — so it stops being usable as a reference.
   */
  delimitersOutsideMarkup: number;
}

/**
 * The index just past the end of the comment that starts at `from` — or null if it never closes.
 *
 * Three terminations, all of them from the tokenizer's comment states, because getting this wrong is
 * the same corruption as not splitting on <script>: miss a terminator and the deletion runs on to
 * the next one further down the file, taking real markup with it.
 *
 *   `-->`   the normal one.
 *   `--!>`  "incorrectly closed comment" — a parse error, and it still ends the comment.
 *   `<!-->` / `<!--->`  "abrupt closing of empty comment" — a complete, empty comment. Neither
 *           contains `-->`, so searching for one would sail straight past the end.
 */
const commentEnd = (html: string, from: number): number | null => {
  if (html.startsWith('<!--->', from)) return from + 6;
  if (html.startsWith('<!-->', from)) return from + 5;
  const normal = html.indexOf('-->', from + 4);
  const bang = html.indexOf('--!>', from + 4);
  if (normal === -1 && bang === -1) return null;
  if (normal === -1) return bang + 4;
  if (bang === -1) return normal + 3;
  return normal < bang ? normal + 3 : bang + 4;
};

/**
 * The index just past the `>` that closes the tag starting at `from`, respecting quoted attribute
 * values — `<a title="a>b">` is one tag, and a scan for the first `>` would cut it in half and then
 * read the remainder of the attribute as text.
 */
const tagEnd = (html: string, from: number): number | null => {
  let quote = '';
  for (let i = from; i < html.length; i++) {
    const c = html[i];
    if (quote) {
      if (c === quote) quote = '';
    } else if (c === '"' || c === "'") {
      quote = c;
    } else if (c === '>') {
      return i + 1;
    }
  }
  return null;
};

/** Just past the close tag for `name` at or after `from`, or null if the document ends first. */
const rawTextEnd = (html: string, name: string, from: number): number | null => {
  // `</script` counts as the close tag when followed by whitespace, `/` or `>` — so `</scriptfoo>`
  // is not one. Then the tag itself may carry junk before its `>` (`</script >`).
  const open = new RegExp(`</${name}(?=[\\s/>])`, 'i').exec(html.slice(from));
  if (!open) return null;
  return tagEnd(html, from + open.index);
};

/** How many comment delimiters a slice we are keeping verbatim contains. */
const countDelimiters = (slice: string): number => (slice.match(DELIMITER) ?? []).length;

/**
 * Delete every HTML comment from a document, and nothing else.
 *
 * Deletion-only by construction: the output is assembled from verbatim slices of the input, and the
 * only slices skipped are comment spans. verifyStrip re-checks that from the outside.
 */
export const stripComments = (html: string): StripResult => {
  const out: string[] = [];
  let i = 0;
  let chars = 0;
  let kept = 0;
  let delimitersOutsideMarkup = 0;
  const spans: string[] = [];

  while (i < html.length) {
    const lt = html.indexOf('<', i);
    if (lt === -1) {
      out.push(html.slice(i));
      break;
    }
    out.push(html.slice(i, lt)); // text run before the markup — untouched, whitespace and all

    // ── A comment.
    if (html.startsWith('<!--', lt)) {
      const end = commentEnd(html, lt);
      if (end === null) {
        // Unterminated. The parser would call the rest of the file one comment; we are not going to
        // act on a document that is already broken, so it ships as-is and the build says nothing
        // it cannot back up.
        out.push(html.slice(lt));
        break;
      }
      const raw = html.slice(lt, end);
      if (IS_CONDITIONAL.test(raw)) {
        out.push(raw);
        kept++;
      } else {
        spans.push(raw);
        chars += raw.length;
      }
      i = end;
      continue;
    }

    // ── `<!doctype html>`, and the tokenizer's "bogus comment" forms (`<!x`, `<?x`). Kept verbatim:
    //    the doctype is required, and a bogus comment is a symptom to leave visible, not to tidy.
    if (html[lt + 1] === '!' || html[lt + 1] === '?') {
      const end = tagEnd(html, lt);
      if (end === null) {
        out.push(html.slice(lt));
        break;
      }
      out.push(html.slice(lt, end));
      delimitersOutsideMarkup += countDelimiters(html.slice(lt, end));
      i = end;
      continue;
    }

    // ── A tag, maybe. `<` in text (an unescaped `a < b`) is not one, and gets emitted as the single
    //    character it is.
    const name = /^<(\/?)([a-zA-Z][^\s/>]*)/.exec(html.slice(lt, lt + 64));
    if (!name) {
      out.push('<');
      i = lt + 1;
      continue;
    }
    const end = tagEnd(html, lt);
    if (end === null) {
      out.push(html.slice(lt));
      break;
    }
    out.push(html.slice(lt, end));
    delimitersOutsideMarkup += countDelimiters(html.slice(lt, end));
    i = end;

    // ── If that opened a raw-text element, skip its whole content and its close tag. This is the
    //    "never touch anything inside <script> or <style>" rule, enforced by never looking inside.
    const isClose = name[1] === '/';
    const selfClosing = html[end - 2] === '/'; // `<style/>` happens in inline SVG
    const tag = name[2].toLowerCase();
    if (!isClose && !selfClosing && RAW_TEXT.has(tag)) {
      const close = rawTextEnd(html, tag, i);
      if (close === null) {
        out.push(html.slice(i));
        break;
      }
      out.push(html.slice(i, close));
      delimitersOutsideMarkup += countDelimiters(html.slice(i, close));
      i = close;
    }
  }

  return {
    html: out.join(''),
    removed: spans.length,
    chars,
    kept,
    spans,
    delimitersOutsideMarkup,
  };
};

/* ── PROVING IT DID NOT CHANGE THE PAGE ───────────────────────────────────────────────────────────
   Run on every page, on every build, and a mismatch FAILS the build. A transform that quietly
   corrupts one page out of twelve is worse than no transform, and "I read the diff once" does not
   survive the next person adding a slide.

   FIRST, THE THING THAT MAKES THIS TRACTABLE: deleting a comment SPAN cannot change how a page
   renders. It is worth writing down because the obvious worry is false. The famous case is the
   whitespace-eating idiom —

       <span>a</span><!--
       --><span>b</span>

   — where the comment exists precisely to stop a newline from becoming a space between two inline
   boxes. Deleting the comment "reintroduces" that space only if you delete the delimiters and keep
   what was between them. The newline lives INSIDE the span, so removing the span removes it too:
   `<span>a</span><span>b</span>`, still "ab". Every other candidate goes the same way — a comment is
   not an element, so it is invisible to `:empty`, to `:first-child` and to `+`; it produces no box,
   so it cannot affect white-space processing; inside `<pre>` the same span-deletion argument holds.
   That is why the rule at the top ("do not collapse whitespace, do not optimise anything else") is
   not squeamishness: deletion-only is exactly the property that makes the output provably identical.

   SO THE ONLY THING TO CHECK IS THAT THE SCANNER REALLY DID DELETE ONLY COMMENT SPANS. Three checks:

     1. Deletion only, by byte accounting. Output length == input length − comment bytes. Catches
        anything inserted, duplicated, or dropped without being counted.

     2. Every deleted span, read on its own, is a well-formed comment: it opens with `<!--`, closes
        with a terminator, and contains no EARLIER terminator. The last clause is the one that
        matters — an over-long deletion (the classic failure, running from a `<!--` in a JS string to
        a `-->` further down the file) shows up as a span with a terminator in its middle.

     3. An independent second opinion: the naive one-regex implementation. Where the two agree, the
        careless version's answer is a genuine outside check on the scanner's arithmetic — it would
        catch an off-by-one that ate a `<` or a whole tag. This is the "compare the visible text and
        the markup before and after" check, and it is run in exactly that form.

        BUT IT IS ONLY VALID WHERE THE NAIVE MODEL IS. On a page that contains a delimiter inside a
        script, a style or an attribute value the naive regex is WRONG — that is the entire reason
        the scanner exists — so using it as the reference there would fail the build for a correct
        rewrite. `delimitersOutsideMarkup` decides: zero means the two models are provably looking at
        the same spans and the comparison is meaningful; non-zero means it is not applicable, and
        checks 1 and 2 (which have no such precondition) carry the page. Today that count is 0 on all
        twelve pages, so the comparison runs everywhere.
   ─────────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * A single well-formed comment and nothing else: opens `<!--`, closes with a terminator, and has no
 * terminator before the end. The negative lookahead is the load-bearing part — without it
 * `<!-- a --> …markup… -->` would validate, and that string is precisely what an over-long deletion
 * looks like.
 */
const WELL_FORMED = /^(?:<!--->|<!-->|<!--(?:(?!-->|--!>)[\s\S])*(?:-->|--!>))$/;

/** Drop the bodies of raw-text elements, keeping both tags. Their contents are code, not page. */
const withoutRawText = (html: string): string =>
  html.replace(/(<(script|style)\b[^>]*>)[\s\S]*?(<\/\2\s*>)/gi, '$1$3');

/** What a reader sees: no comments, no tags, one space between words. */
const readerText = (html: string): string =>
  withoutRawText(html)
    .replace(NAIVE_COMMENT, '')
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Every tag, verbatim and in order — the page's structure with the prose taken out.
 *
 * Compared as well as the text because the text alone is blind to a deletion that ate a tag or the
 * inside of an attribute value: `<div data-x="<!--a-->" class="c">t</div>` can lose an attribute
 * with every visible word intact, and that is the exact failure this file is built to avoid.
 */
const skeleton = (html: string): string[] =>
  withoutRawText(html).replace(NAIVE_COMMENT, '').match(/<[^>]*>/g) ?? [];

/**
 * Throw unless `after` is `before` with comments deleted and nothing else touched.
 *
 * Exported so tests/htmlComments.test.ts can assert the net actually catches things — a safety check
 * nobody has ever seen fail is indistinguishable from one that cannot.
 */
export const verifyStrip = (file: string, before: string, after: StripResult): void => {
  const fail = (what: string, extra = ''): never => {
    // Fail the BUILD, rather than skip the file and warn. A page this check disagrees with is a page
    // the scanner has a bug on, and the next build would ship it silently the moment somebody reads
    // past the warning. Nothing here is worth a corrupted page: removing the two lines in
    // astro.config.mjs restores the previous shipping behaviour in full.
    throw new Error(
      `strip-html-comments will not rewrite ${file}: ${what}. ${extra}\n` +
        'This is a bug in src/integrations/stripHtmlComments.ts, not in the page — the whole point ' +
        'of the transform is that it deletes comments and changes nothing else.',
    );
  };

  // ── 1. DELETION ONLY.
  if (after.html.length !== before.length - after.chars) {
    fail(
      'byte accounting does not add up',
      `expected ${before.length - after.chars} characters out (${before.length} in, ${after.chars} ` +
        `of comments removed) but produced ${after.html.length}.`,
    );
  }

  // ── 2. EVERY DELETED SPAN WAS A COMMENT.
  for (const span of after.spans) {
    if (!WELL_FORMED.test(span)) {
      fail(
        'it deleted something that is not a single well-formed comment',
        `the span was ${span.length} characters and began: ${JSON.stringify(span.slice(0, 160))}. ` +
          'A terminator inside the span means the deletion ran past the end of a comment and took ' +
          'markup with it.',
      );
    }
  }

  // ── 3. THE NAIVE MODEL AS AN OUTSIDE CHECK, where it is valid.
  //
  // Two ways this page could be one the naive model gets wrong, and on either of them the model
  // stands down rather than being trusted as the reference:
  //
  //   · a delimiter somewhere a comment cannot start (an attribute value, a script body) — the count
  //     the scanner keeps;
  //   · a `<script`/`<style` sequence inside a comment we deleted, which fools withoutRawText into
  //     treating a stretch of the comment as a raw-text element and swallowing the markup after it.
  //
  // Both are zero on every page of this site today. The check is deliberately conservative: standing
  // down costs coverage on one page, and a false build failure costs a deploy.
  if (
    after.delimitersOutsideMarkup > 0 ||
    after.spans.some((s) => /<(?:script|style)\b/i.test(s))
  ) {
    return;
  }

  const textBefore = readerText(before);
  const textAfter = readerText(after.html);
  if (textBefore !== textAfter) {
    // Name the first divergence: these files are hundreds of KB and "they differ" is not a lead.
    let at = 0;
    while (at < textBefore.length && textBefore[at] === textAfter[at]) at++;
    fail(
      'the visible text changed',
      `first difference at character ${at} of ${textBefore.length}:\n` +
        `  before: …${textBefore.slice(Math.max(0, at - 60), at + 60)}…\n` +
        `  after:  …${textAfter.slice(Math.max(0, at - 60), at + 60)}…`,
    );
  }

  const tagsBefore = skeleton(before);
  const tagsAfter = skeleton(after.html);
  if (tagsBefore.length !== tagsAfter.length || tagsBefore.some((t, k) => t !== tagsAfter[k])) {
    let at = 0;
    while (at < tagsBefore.length && tagsBefore[at] === tagsAfter[at]) at++;
    fail(
      'the markup changed',
      `${tagsBefore.length} tags before, ${tagsAfter.length} after; first difference at index ` +
        `${at}:\n  before: ${tagsBefore[at]}\n  after:  ${tagsAfter[at]}`,
    );
  }
};

const htmlFiles = (dir: string, out: string[] = []): string[] => {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) htmlFiles(p, out);
    else if (e.name.endsWith('.html')) out.push(p);
  }
  return out;
};

const bytes = (n: number): string => n.toLocaleString('en-US');
const plural = (n: number, one: string): string => `${n} ${one}${n === 1 ? '' : 's'}`;

/**
 * Strip HTML comments from the built output.
 *
 * `astro:build:done` is the right hook and the only one: it runs once, after every page is on disk,
 * so this is a single pass over the finished artifact rather than anything wired into rendering. It
 * cannot affect `astro dev` — the comments are all still there while you work, which is where you
 * want them.
 *
 * Every `.html` in the output directory is processed, including files copied verbatim from public/
 * (the Search Console verification file is one). The contract is about what a visitor can fetch, and
 * that is the whole set.
 */
export default function stripHtmlComments(): AstroIntegration {
  return {
    name: 'strip-html-comments',
    hooks: {
      'astro:build:done': ({ dir, logger }: { dir: URL; logger: AstroIntegrationLogger }) => {
        const root = fileURLToPath(dir);
        const files = htmlFiles(root).sort();

        let totalRemoved = 0;
        let totalBytes = 0;
        let totalKept = 0;
        const rows: string[] = [];
        const unverifiable: string[] = [];

        for (const file of files) {
          const rel = file.slice(root.length);
          const before = readFileSync(file, 'utf8');
          const result = stripComments(before);
          if (result.removed === 0) continue;

          verifyStrip(rel, before, result);
          writeFileSync(file, result.html);

          // Say so out loud when check 3 did not apply, so "the cross-check ran on every page" never
          // becomes an assumption. It is not a warning: the page is fine and checks 1 and 2 covered
          // it. It is a note that this page now contains a delimiter in a script, a style or an
          // attribute — which is worth knowing, because it is the situation the scanner is for.
          if (result.delimitersOutsideMarkup > 0) {
            unverifiable.push(`${rel} (${result.delimitersOutsideMarkup})`);
          }

          // MEASURED IN BYTES, not in characters, because bytes are what a visitor downloads and the
          // two are not the same number here: these comments quote design review, so they carry
          // em-dashes, smart quotes and `══` rules. On the homepage the gap is 134 (22,746 characters
          // of comment, 22,880 bytes off the file). Reporting the character count as "B" would have
          // understated the saving on every page and been quietly wrong on all of them.
          const wasSize = Buffer.byteLength(before, 'utf8');
          const saved = wasSize - Buffer.byteLength(result.html, 'utf8');
          totalRemoved += result.removed;
          totalBytes += saved;
          totalKept += result.kept;
          rows.push(
            `  ${rel.padEnd(38)} ${plural(result.removed, 'comment').padStart(12)}  ` +
              `${bytes(saved).padStart(7)} B  ` +
              `(${((100 * saved) / wasSize).toFixed(1)}% of the page)`,
          );
        }

        if (totalRemoved === 0) {
          // Not an error — but worth a line, because the expected number here is large and a silent
          // zero most likely means the emitted markup stopped carrying comments for some other
          // reason, which is a thing to know rather than to celebrate.
          logger.info('no HTML comments in the output; nothing to strip');
          return;
        }

        logger.info(
          `kept in source, stripped from ${plural(rows.length, 'page')}:\n${rows.join('\n')}\n` +
            `  ${'TOTAL'.padEnd(38)} ${plural(totalRemoved, 'comment').padStart(12)}  ` +
            `${bytes(totalBytes).padStart(7)} B` +
            (totalKept > 0 ? `  (${plural(totalKept, 'conditional comment')} kept)` : '') +
            (unverifiable.length > 0
              ? `\n  a comment delimiter appears outside markup on ${unverifiable.join(', ')}, so ` +
                'the naive-model cross-check does not apply there (see verifyStrip check 3)'
              : ''),
        );
      },
    },
  };
}
