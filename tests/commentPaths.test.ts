// tests/commentPaths.test.ts
//
// A COMMENT MAY NOT ASSERT THAT A FILE IS THERE WHEN IT IS NOT.
//
// This repo deliberately stores decisions, measurements and architecture in prose — CLAUDE.md makes that
// policy, and a comment recording a measured lesson is load-bearing by design. The consequence nobody priced
// is that such a comment is also a REFERENCE, and references rot on every delete. There is no compiler and no
// test on comment text, so a falsified comment is indistinguishable from a true one, and the next agent reads
// it as a spec. CLAUDE.md's own opening paragraph says three live defects came from exactly that.
//
// THE AUDIT THIS CAME FROM FOUND SIX LIVE INSTANCES, and the worst were not typos — they were promises.
// `sections/Rules.astro` and `lib/complexity.ts` both stated, in the present tense, that the two retired
// Rules drawings "stay in the tree, unreferenced and still fully tested, so nothing verified was thrown away
// and either can return if a later slide wants it." Both modules and both specs had been deleted. An agent
// asked to reconsider that slide would have gone looking for verified code that is not there — and CLAUDE.md
// lists those same drawings under "Rejected — do not rebuild", so the comment was pointing the next reader
// straight at the work the guide exists to prevent.
//
// WHY A TEST AND NOT A HABIT. This class was swept by hand twice before (CLAUDE.md records both passes) and
// came back both times, because the falsifying event is a DELETE in one file while the false sentence sits in
// another — nobody is looking at it. The build is happy, and neither `astro check` nor `tsc` reads a comment.
// Same reasoning as tests/cssVars.test.ts (a `var(--x)` nothing declares) and tests/nav.test.ts (a page with
// no nav href): an invariant between two files gets a spec.
//
// THE HARD PART IS THAT A CORRECT COMMENT ALSO NAMES MISSING FILES, and the first version of this test got
// that wrong. CLAUDE.md's rule is "say what is true rather than only deleting the false part", so deletions
// here are documented ON PURPOSE: pages/index.astro explains that the terminal's `data/script.ts` went with
// it. Such sentences are the opposite of rot and must not be flagged. So this does not ask "does every path exist" — it asks "does any path appear in a
// sentence claiming it is HERE". A deletion marker nearby means the prose already knows, and it passes.
//
// WHAT IT DELIBERATELY DOES NOT DO: it cannot judge a false claim about live code. The same audit found the
// homepage's old rail (`components/Toc.astro`, since deleted) asserting "the Solve slide is dark in both
// themes" — false since that design was rejected, and a live legibility defect — but it names no path, so no
// gate can see it. This covers the mechanical half, which is where the damage has actually come from.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');

/** Walk a directory for source files, skipping build output and the ad-hoc probes tsconfig also excludes. */
function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.') || e.name === 'node_modules' || e.name === 'dist') continue;
    if (e.name.startsWith('tmp_') || e.name.startsWith('.tmp-')) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...sourceFiles(p));
    else if (/\.(ts|astro|css)$/.test(e.name)) out.push(p);
  }
  return out;
}

/**
 * The comment text of a file, with code removed.
 *
 * Crude but ONE-SIDED: it may miss a comment, it must never mistake code for one. A false positive reads as
 * "your comment is wrong" when the code is fine, which is how a gate loses its credibility and starts getting
 * ignored. So a `//` preceded by a quote on the same line is treated as string content, since a real path in
 * a string literal (an `import`, a `querySelector`) is already the compiler's business, not prose.
 */
function commentsOf(text: string): string {
  const blocks = text.match(/\/\*[\s\S]*?\*\//g) ?? [];
  const braced = text.match(/\{\/\*[\s\S]*?\*\/\}/g) ?? [];
  const lines = text
    .split('\n')
    .map((l) => {
      const i = l.indexOf('//');
      if (i < 0) return '';
      if (/['"`]/.test(l.slice(0, i)) && !/^\s*\/\//.test(l)) return '';
      return l.slice(i);
    })
    .filter(Boolean);
  return [...blocks, ...braced, ...lines].join('\n');
}

/**
 * Repo-relative paths mentioned in prose.
 *
 * THE EXTENSION IS OPTIONAL, and that detail is what makes this work at all. The audit's first grep used
 * a pattern requiring `.ts` and found nothing, wrongly clearing the file: the comments name the module bare,
 * without an extension, because that is how a person writes it. Requiring one misses half the real instances.
 */
const PATH_RE = /\b(?:src|tests|lib|data|components|sections|pages|scripts|layouts|styles|public|docs)\/[A-Za-z0-9_[\].-]+(?:\/[A-Za-z0-9_[\].-]+)*/g;

/** Where a bare directory-qualified name could live, since comments routinely omit the `src/` prefix. */
const PREFIXES = ['', 'src/', 'src/lib/', 'src/components/', 'src/sections/', 'src/pages/', 'src/data/',
  'src/scripts/', 'src/styles/', 'src/layouts/', 'tests/'];
const EXTS = ['', '.ts', '.astro', '.css', '.md'];

/** Does `cand` name something on disk, allowing an omitted `src/` prefix and an omitted extension? */
function resolves(cand: string): boolean {
  for (const pre of PREFIXES) {
    for (const ext of EXTS) if (existsSync(join(ROOT, pre + cand + ext))) return true;
  }
  return false;
}

/**
 * Prose that says the thing is NOT here any more, so naming it is a record rather than a claim.
 *
 * Narrow on purpose. Plain past tense is NOT enough: the worst real instance read "nothing verified **was**
 * thrown away … either can return", which is past-tense and still asserts the files are present. Every
 * phrase here has to mean the path itself is absent.
 */
const GONE = /\b(delet|remov|retir|no longer|used to|gitignored|never existed|does not exist|doesn't exist|is gone|are gone|went with|replaced by|superseded)/i;

/**
 * How far either side of the mention to look for that marker — roughly one clause, not one paragraph.
 *
 * TUNED DOWN FROM 200, which produced a false NEGATIVE on a real defect. sections/Story.astro reads "The
 * figure row is deleted … so the measurement imports go with it — [three functions] were only ever called
 * here to fill those three numbers. The modules stay: lib/sensitivity and lib/knowledge are what the GRAPH is
 * drawn from, and they keep their own specs." The "deleted" belongs to the figure row, 200 characters
 * upstream, and it masked a sentence that explicitly asserts a module which does not exist. A marker has to
 * be near enough to plausibly govern the mention.
 */
const WINDOW = 110;

/**
 * Paths that cannot be files here, so `existsSync` could never find them.
 *
 * Kept SHORT, with a reason each. A growing allowlist is how this gate would stop being one — CLAUDE.md
 * documents the dead-export scan as needing an allowlist and therefore being a tool you run rather than a
 * test that exists. The deletion-marker rule above is what keeps this list from growing: a future delete that
 * gets documented passes on its own wording, without an entry here.
 */
const NOT_FILES = [
  /^dist\//,        // build output: absent on a clean checkout, present after `npm run build`
  /^docs\//,        // gitignored per CLAUDE.md, so design docs are real locally and never in the repo
  /[*]/,            // a glob, i.e. a pattern rather than a reference
  /-$/,             // a truncated glob stem, e.g. `pages/proto-` from `pages/proto-*.astro`
  /\.py$/,          // another repo's code: this one has no Python, so lib/positioning.ts citing offchart's is a source
  /^(src|tests|src\/lib|src\/data|src\/pages|src\/components)$/,   // a directory named as a shape
];

describe('comments never claim a file that is not there', () => {
  const files = sourceFiles(join(ROOT, 'src')).concat(sourceFiles(join(ROOT, 'tests')));

  it('has files to scan at all', () => {
    // Without this the assertion below passes vacuously over an empty list — the first failure mode a
    // glob-driven test has to rule out, and the same reason vitest runs with passWithNoTests: false.
    expect(files.length, 'no source files found — has the layout changed?').toBeGreaterThan(50);
  });

  it('finds no live claim on a missing path', () => {
    const dead: string[] = [];
    for (const f of files) {
      const rel = f.slice(ROOT.length).split(sep).join('/').replace(/^\//, '');
      const prose = commentsOf(readFileSync(f, 'utf8'));
      const seen = new Set<string>();
      for (const m of prose.matchAll(PATH_RE)) {
        const cand = m[0].replace(/[.,;:)]+$/, '');
        if (NOT_FILES.some((r) => r.test(cand))) continue;
        if (resolves(cand)) continue;
        const near = prose.slice(Math.max(0, m.index - WINDOW), m.index + cand.length + WINDOW);
        if (GONE.test(near)) continue;   // the prose already says it went
        if (seen.has(cand)) continue;    // one report per path per file
        seen.add(cand);
        dead.push(`${rel} → ${cand}`);
      }
    }
    expect(dead, `${dead.length} comment(s) name a path that does not exist, without saying it went:\n  ${dead.join('\n  ')}`)
      .toEqual([]);
  });

  it('can actually fail, and does not fire on a documented deletion', () => {
    // A gate is only worth having if it can go red, and this one has two halves that must both work.
    // Shaped like the real instances: a bare directory/name, no extension.
    expect(resolves('lib/feasible')).toBe(false);
    expect(resolves('lib/pathspace')).toBe(false);
    // ...while live modules resolve, including by the spellings comments actually use.
    expect(resolves('lib/terrain')).toBe(true);
    expect(resolves('src/lib/terrain.ts')).toBe(true);
    expect(resolves('components/TerrainHero.astro')).toBe(true);
    expect(resolves('data/profile')).toBe(true);
    // And the marker half: an assertion is caught, a record is not.
    expect(GONE.test('both modules stay in the tree, unreferenced and still fully tested')).toBe(false);
    expect(GONE.test('its data (data/script.ts) and engine are deleted with it')).toBe(true);
    expect(GONE.test('the printer that used to sit beside it')).toBe(true);
  });
});
