// tests/helpers/paperChain.ts
// The site's markdown plugins inside the chain Astro runs them in (node_modules/@astrojs/markdown-remark/dist/index.js):
// parse and GFM before them, remark-rehype with raw HTML allowed and stringify after. What Astro's other passes do,
// and why none of them reaches what the plugins check, is in tests/paperMarkdown.test.ts's header.
// Not a spec itself — vitest collects only tests/**/*.test.ts.
import rehypeKatex from 'rehype-katex';
import rehypeStringify from 'rehype-stringify';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import { unified, type PluggableList } from 'unified';
import { markdownPlugins, type PaperData, type PaperRecord, type PaperReport } from '../../src/lib/paperMarkdown';

export interface Chain {
  papers: Record<string, PaperData>;
  publications: readonly PaperRecord[];
  frontmatter: Record<string, unknown>;
  /** false: the chain with remark-math and rehype-katex alone, as a file renders without the site's plugins. */
  plugins?: boolean;
}

/** Render `md` as the file at `path`; the report is what the plugins wrote into its frontmatter. */
export async function renderMarkdown(md: string, path: string, c: Chain): Promise<{ html: string; report: PaperReport }> {
  const site = markdownPlugins(c.papers, c.publications);
  const on = c.plugins ?? true;
  const file = await unified()
    .use(remarkParse).use(remarkGfm)
    .use(on ? (site.remarkPlugins as PluggableList) : [remarkMath])
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(on ? (site.rehypePlugins as PluggableList) : [[rehypeKatex, { output: 'mathml' }]])
    .use(rehypeStringify, { allowDangerousHtml: true })
    .process({ value: md, path, data: { astro: { frontmatter: structuredClone(c.frontmatter) } } });
  return { html: String(file), report: (file.data as { astro: { frontmatter: PaperReport } }).astro.frontmatter };
}
