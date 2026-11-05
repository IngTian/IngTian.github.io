// src/lib/paperMarkdown/names.ts
// What the paper format shares with the modules round it, in a module that imports nothing: where the papers live,
// and the mark a registered drawing names its own figure by.

/** Where the papers collection lives (content.config.ts loads it from here): a file under it is a paper. */
export const PAPERS_DIR = 'src/content/papers';

/** Written in a registered drawing wherever it names its own figure: remarkPaper puts in its place the name the
 *  explainer's :::figure gives it ("Figure 2", from n=2), so a drawing is numbered by the file that places it. */
export const FIGURE_NAME = '%figure-name%';
