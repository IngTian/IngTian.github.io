// src/lib/paperMarkdown/index.ts
// The site's markdown chain, spelled once: astro.config.mjs builds with it and tests/paperMarkdown.test.ts runs
// it, so the spec checks what the build does. The paper format itself is documented in CLAUDE.md, "Papers are files".
import type { RehypePlugins, RemarkPlugins } from 'astro';
import rehypeKatex from 'rehype-katex';
import remarkMath from 'remark-math';
import { rehypeMathVariants } from '../mathml';
import { rehypePaper } from './rehypePaper';
import { remarkPaper, remarkPaperSyntax, type PaperData, type PaperRecord } from './remarkPaper';

export { refId, type PaperData, type PaperRecord, type PaperReport } from './remarkPaper';

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
