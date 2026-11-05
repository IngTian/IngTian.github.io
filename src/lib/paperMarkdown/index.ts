// src/lib/paperMarkdown/index.ts
// The site's markdown chain, spelled once: astro.config.mjs builds with it and tests/paperMarkdown.test.ts runs
// it, so the spec checks what the build does. The paper format itself is documented in CLAUDE.md, "Papers are files".
import type { RehypePlugins, RemarkPlugins } from 'astro';
import rehypeKatex from 'rehype-katex';
import remarkMath from 'remark-math';
import { rehypeMathVariants } from '../mathml';
import { rehypePaper } from './rehypePaper';
import { PAPERS_DIR } from './names';
import { remarkPaper, remarkPaperSyntax, type PaperData, type PaperRecord, type PaperReport } from './remarkPaper';

export { FIGURE_NAME, PAPERS_DIR } from './names';
export { refId, type PaperData, type PaperRecord, type PaperReport } from './remarkPaper';

/** A paper's render report (`render(entry).remarkPluginFrontmatter`), checked: the plugins cannot fail the build (a
 *  plugin's throw leaves the entry unrendered), so the paper page fails it here, naming `file`, on every problem they
 *  found, on an id the page writes itself (`pageOwns`, lib/pageStops' paperPageOwns), and on a file they never
 *  compiled, whose render reports nothing. */
export function checkedReport(file: string, frontmatter: unknown, pageOwns: (id: string) => boolean): PaperReport {
  const report = frontmatter as Partial<PaperReport>;
  if (!Array.isArray(report.paperProblems) || !Array.isArray(report.ids)) {
    throw new Error(`${file} has no paper report: only a file under ${PAPERS_DIR}/ is compiled as a paper`);
  }
  const problems = [...report.paperProblems, ...report.ids.filter(pageOwns).map((id) => `id #${id} is one this page writes itself`)];
  if (problems.length) throw new Error(`${file} has ${problems.length} problem(s):\n  ${problems.join('\n  ')}`);
  return report as PaperReport;
}

/** `papers` is each paper's computed values and figures, by publication slug, and `publications` the records
 *  (profile.ts) a paper quotes its abstract from. Both are passed as options, not imported by the plugin, so they
 *  are part of Astro's config digest and a changed number or record re-renders the paper. */
export function markdownPlugins(papers: Record<string, PaperData>, publications: readonly PaperRecord[]): {
  remarkPlugins: RemarkPlugins; rehypePlugins: RehypePlugins;
} {
  return {
    remarkPlugins: [remarkPaperSyntax, remarkMath, [remarkPaper, { papers, publications }]],
    // output: 'mathml' is the load-bearing option (astro.config.mjs says why); the letter fix runs on every file.
    rehypePlugins: [[rehypeKatex, { output: 'mathml' }], rehypeMathVariants, rehypePaper],
  };
}
