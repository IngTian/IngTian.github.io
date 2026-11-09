# ingtian.github.io

Personal site for **Ing Tian (Zeying Tian)** — quant researcher in portfolio optimization, incoming
Operations Research PhD at the University of Toronto, full-stack SDE/MLE. Live at
**https://ingtian.github.io**.

The homepage is a vertical scroll *down* one continuous "Monet sky" — *"The Descent"* — paged one slide per
gesture like a deck. Around it are **/research** (the papers, each opening its page here or its publisher's),
**/writing**, **/projects**, **/experience** and **/art**, a quiet museum room for calligraphy and photography.

> **[CLAUDE.md](./CLAUDE.md) is the guide**: the stack, the layout, the design rules, the traps that have each
> shipped a bug here, and what has already been built and rejected. Read it before changing anything. This
> README is only the front door.

## Local development

Astro 6 rejects Node 20: run `nvm use` first (`.nvmrc` pins 24).

```sh
nvm use            # Node 24 (see .nvmrc)
npm install
npm run dev        # dev server at http://localhost:4321
```

| Command                | Action                                                     |
| :--------------------- | :--------------------------------------------------------- |
| `npm run dev`          | Dev server with HMR                                        |
| `npm run build`        | Production build to `./dist/` — **not** type-checked      |
| `npm run typecheck`    | `astro check` + `tsc --noEmit` — the only type gate        |
| `npm test`             | The Vitest suite (needs a current build: it reads `dist/`) |
| `npm run test:watch`   | Vitest in watch mode                                       |
| `npm run preview`      | Serve the built `./dist/` locally                          |

Before committing, all three, in this order: `npm run build` → `npm run typecheck` → `npm test`. Pushing to
`main` deploys to GitHub Pages (`.github/workflows/deploy.yml`).

## Updating content

| What | Where |
| :--- | :---- |
| A new **writing piece** | a `.md` in `src/content/writing/` with frontmatter. No code change; it appears on `/writing` and gets its own page. |
| A paper's **explainer page** | a `.md` in `src/content/papers/` (its record stays in `profile.ts`, its numbers and figures in `src/data/papers/`); it becomes `/research/<slug>`. The syntax is in CLAUDE.md, *Papers are files*. |
| Résumé, bio, timeline, publications, projects, contact links | `src/data/profile.ts` — typed, cross-referenced by id, and some numbers are computed from it. |
| The page set (the corner nav) | `src/data/nav.ts` (`PAGES`). |
| Calligraphy | `src/data/artworks.ts` (works + the sentences) + images in `src/assets/art/`. |
| Photographs | two edits: the file in `src/assets/art/photos/`, named `photo-…` (`.jpg`, `.jpeg`, `.JPG` or `.JPEG`), and its entry in `src/data/photoNotes.ts`, keyed by the file's name, with an `alt` at least (`title`, `place` and `year` optional; a place prints only once `confirmed`). The build fails, naming the file, on a photograph without an entry, an entry without a photograph, or a file not named `photo-…`. |
| Palette | `src/styles/tokens.css`. The rule and its exceptions are in CLAUDE.md, *Taste rules* and *Themes*. |

## License

Source code is available for reference. Written content, the résumé, the calligraphy, and the photographs are
© Zeying Tian — not licensed for reuse.
