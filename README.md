# ingtian.github.io

Personal site for **Ing Tian (Zeying Tian)** — quant researcher in portfolio
optimization, incoming Operations Research PhD at the University of Toronto,
full-stack SDE/MLE. Live at **https://ingtian.github.io**.

The homepage is a vertical scroll *down* one continuous "Monet sky" — *"The
Descent"* — paged one slide per gesture like a deck. Around it are reading pages
(**/research**, **/writing**, **/projects**, **/experience**) and **/art**, a
quiet museum room for calligraphy and photography.

> **[CLAUDE.md](./CLAUDE.md) is the guide.** It is the working agreement for this
> repo — the design rules, the traps that have each shipped a bug here, and what
> has already been built and rejected. Read it before changing anything. This
> README is only the front door and deliberately does not repeat it.

## Stack

- **[Astro 6](https://astro.build)** (static output) + **[Tailwind
  v4](https://tailwindcss.com)** (`@theme` tokens in `src/styles/global.css`) +
  TypeScript (strict). Sitemap via `@astrojs/sitemap`.
- **No client framework, and no islands.** Everything interactive — the deck, the
  terrain hero, the WebGL sky, the rails, the gallery — is a plain `.astro`
  component with a bundled vanilla `<script>`. There is no React here and no
  `client:*` directive anywhere; don't add one.
- `astro:fonts` self-hosts two variable webfonts from local files: **JetBrains
  Mono** (`--font-mono`) and **Fraunces** (`--font-accent`). The two *role* faces
  download nothing — `--font-display` is Georgia and `--font-body` is the system
  UI stack, both on purpose.
- Math is typeset at **build** time to MathML (`remark-math` + `rehype-katex`
  with `output: 'mathml'`, plus `lib/equations.ts` for `.astro`), so no KaTeX CSS,
  fonts or JS ship. `katex` is a devDependency and stays one.
- `astro:assets` optimizes the gallery images (webp, responsive `widths`).
- Deploys to GitHub Pages on push to `main` via `.github/workflows/deploy.yml`.
  Both workflows read the Node version from `.nvmrc`.

## Local development

> **Node:** Astro 6 rejects Node 20. Run `nvm use` first — `.nvmrc` pins 24, and
> CI reads the same file.

```sh
nvm use            # Node 24 (see .nvmrc)
npm install
npm run dev        # dev server at http://localhost:4321
```

| Command                | Action                                              |
| :--------------------- | :-------------------------------------------------- |
| `npm run dev`          | Dev server with HMR                                 |
| `npm run build`        | Production build to `./dist/` — **not** type-checked |
| `npm run typecheck`    | `astro check` + `tsc --noEmit` — the only type gate  |
| `npm test`             | The Vitest suite (needs a build first — it reads `dist/`) |
| `npm run test:watch`   | Vitest in watch mode                                |
| `npm run preview`      | Serve the built `./dist/` locally                   |

**Before committing, all three: `npm run build` → `npm run typecheck` → `npm
test`.** In that order, and the middle one is not optional. `npm run build` says
nothing about types: Astro hands `.ts` to esbuild, which strips annotations
without asking the compiler. And `npm test` includes a smoke test that reads the
built HTML, so it needs `dist/` to exist and be current. Anything visual also
gets looked at in a browser — see CLAUDE.md for how.

## Layout

```
src/
  pages/            9 routes: / · /research · /writing · /writing/<slug>
                    /projects · /experience · /art · /404 · /proto-sketches
  layouts/          BaseLayout.astro — <head>, fonts, meta/OG/JSON-LD, the veil, nav
  sections/         Heights · Interlude · Choice · Rules · Solve · Story · Work
                    — the homepage in scroll order (Signature renders inside Work)
  components/       Deck · Toc · SideRail · CornerNav · TerrainHero · DescentPath
                    proto/FluidSky.astro (the WebGL sky, on every page)
  content/writing/  the writing pieces, as markdown (a new one is a FILE)
  content.config.ts the `writing` collection + its frontmatter schema
  data/             typed content: profile, nav, artworks, the slides' copy/numbers
  lib/              pure, unit-tested logic: deck stops, terrain math, the sky's
                    GLSL and contrast policy, the slides' real math, the gates
  styles/           tokens.css (palette) · global.css (the sky + slide metrics)
tests/              Vitest — every pure lib module, plus the invariants between files
public/             static passthrough — cv.pdf, favicons, robots.txt
```

## Updating content

Two kinds, and they do not converge (the reasoning is in CLAUDE.md):

| What | Where |
| :--- | :---- |
| A new **writing piece** | drop a `.md` in `src/content/writing/` with frontmatter. No code change; it appears on `/writing` and gets its own page. |
| Résumé, bio, timeline, publications, projects, links | `src/data/profile.ts` — typed, cross-referenced by id, and some numbers are computed from it. |
| The page set (nav + footer doors) | `src/data/nav.ts` (`PAGES` is canonical). |
| Calligraphy | `src/data/artworks.ts` + images in `src/assets/art/`. |
| Photographs | drop files in `src/assets/art/photos/` (auto-globbed); per-photo copy in `src/data/photoNotes.ts`. |
| Palette | `src/styles/tokens.css` — the only colors on the site. |

## Conventions

The short version; CLAUDE.md has the reasons and the measurements.

- **Palette discipline** — only the tokens in `tokens.css`. In the light theme the
  vermilion seal is the one saturated accent; never pure `#fff`/`#f00`. The dark
  theme's emerald is a deliberate exception, not a bug.
- **Motion** — animate only `transform`/`opacity`, never `filter: blur` (bake it).
  All motion is gated on `prefers-reduced-motion: no-preference` via
  `lib/motion.ts`, and the no-motion state must look *finished*.
- **Pure logic is tested** — anything non-trivial in `lib/` has a spec, and so
  does every invariant between two files that must agree.
- **Branch hygiene** — never commit to `main`. Cut `claude/<topic>`, open a PR,
  wait for CI to go green, squash-merge.

## License

Source code is available for reference. Written content, the résumé, the
calligraphy, and the photographs are © Zeying Tian — not licensed for reuse.
