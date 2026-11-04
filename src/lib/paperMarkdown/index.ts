// src/lib/paperMarkdown/index.ts
// The site's markdown chain, spelled once: astro.config.mjs builds with it and tests/paperMarkdown.test.ts runs
// it, so the spec checks what the build does. The paper format itself is documented in CLAUDE.md, "Papers are files".
import type { RehypePlugins, RemarkPlugins } from 'astro';
import rehypeKatex from 'rehype-katex';
import remarkDirective from 'remark-directive';
import remarkMath from 'remark-math';
import { rehypeMathVariants } from '../mathml';
import { rehypePaper } from './rehypePaper';
import { remarkPaper, type PaperData } from './remarkPaper';

export { refId, type PaperData, type PaperReport } from './remarkPaper';

/** `papers` is each paper's computed values and figures, by publication slug. It is passed as an option, not
 *  imported by the plugin, so it is part of Astro's config digest and a changed number re-renders the paper. */
export function markdownPlugins(papers: Record<string, PaperData>): { remarkPlugins: RemarkPlugins; rehypePlugins: RehypePlugins } {
  return {
    remarkPlugins: [remarkDirective, remarkMath, [remarkPaper, { papers }]],
    // output: 'mathml' is the load-bearing option (astro.config.mjs says why); the letter fix runs on every file.
    rehypePlugins: [[rehypeKatex, { output: 'mathml' }], rehypeMathVariants, rehypePaper],
  };
}
