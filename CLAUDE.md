# ingtian.github.io — engineering & design guide

A personal portfolio for **Ing Tian (Zeying Tian)**, live at **https://ingtian.github.io**. This file is the
working agreement for anyone, human or AI, building on the site: how it is put together, the taste it holds
to, and the rules that keep it coherent.

**It has to be true.** Stale guides have caused live defects here: an agent edits the files a guide names, not
the ones that exist. Change this file in the commit that changes what it describes. Where it contradicts the
code, the code wins: fix the line and say what is true. `ls` every path a paragraph names; a script over the
backticked paths finds the dead ones in seconds, and a count this file states is re-derived with the command
beside it, never adjusted by hand.

## The concept — "The Descent"

A vertical scroll *down* through one continuous "Monet sky" (luminous dawn paper → warm ochre → lavender →
indigo dusk → grey ink → near-black ground). You don't navigate between sections — you descend through the sky.
Swiss-minimal structure carries the weight; the sky, the math-generative terrain hero, and one editorial
tagline carry the soul.

The homepage is the descent. Around it are the **reading pages** — /writing, /writing/&lt;slug&gt;, /experience
— the **research routes** (/research and /research/&lt;slug&gt;), **/projects**, and **/art**, a quiet museum
room for calligraphy and photography. Every route except /projects, the two research routes and /art rides the
same sky, and the reading pages share one margin, one measure and one back-link treatment: pages that each
guessed their own layout would read as several sites. Borrow composition from the neighbouring page rather than
inventing it.

**A page may have a register of its own, and two do.** The rule, in the owner's words, for each page's own
pass: **research serious, academic; art imaginative, romantic; writing imaginative, fun, casual, stylish** —
and /projects *"techy… pure tech and engineering."* /projects, the research routes and /art have had their
passes; /writing has not, and until a page gets its pass it keeps the current look.
- **/projects, the drafting register** (`page="drafting"`). A drafting sheet instead of the sky — isolines of
  a drifting Gaussian-mixture field, ticks and probe readouts, seal red the only colour
  (`components/projects/DraftingField.astro`) — with its own measure (a 1500px main, the rail's column on the
  left and, from 1180px, the cow's on the right).
- **The research routes, the paper register** (`page="paper"`), **and /art, which borrows it.** A still sheet
  with no sky and no SkyWash — warm paper in light, near-black in dark, seal red the only colour in both — set
  like a paper on the research routes: a Georgia body (18px, growing to 19px by 1780px) on a ~77-character
  line, numbered section heads, margin notes, booktabs tables, hairline rules, ink for structure. Their measure
  is `styles/paper.css`'s, which both routes import: a reading column (`--M`, 604 → 664px between 1100 and
  1780px) and a notes column (`--N`) a gap (`--G`) apart, centred in the space right of the rail; an index card
  spans both. /art borrows the sheet and not the measure: no token of its own differs, so there is no `art`
  register, and it sets its own 1240px column (`pages/art.astro`). No page-load veil on any of the three: on the
  research routes it would replay on every card click and every "← all research", and on /art it is motion that
  runs on its own.

**What keeps them one site is shared components, not a shared background.** Which kind a component is
decides how a page may change it:
- **Shared, as is: the corner nav, the rail and the back link.** `CornerNav` and `SideRail` are components;
  the back link is a treatment each page writes the same way (`<a class="back">`, 12px mono in `--ink-3`). A
  page does not restyle any of them. A register reskins them without an edit: its `html[data-page='drafting']`
  or `html[data-page='paper']` block in `tokens.css` overrides the *role* tokens (`--paper`, the ink ramp,
  `--ochre` → the seal), so the nav's dot, pill and focus ring turn seal red there by reading the same
  variable they read everywhere. The homepage is no register, but its `html[data-page='deck']` block sets the
  two tokens the rail needs there, `--rail-ink` and `--rail-focus` (*Navigation*). A change to one of these is
  a change to every page.
- **Page-own: buttons.** One anatomy, a skin per page. `components/Button.astro` owns the size, label, arrow,
  press, focus ring and the `<a>`/`<button>` behaviour; a page's look is a `skin` value plus one
  `.btn--<skin>` block. The skins today are /projects' **sticker** (a slight tilt, a 1.5px ink edge, a hard
  4px offset plate in the accent) and the research routes' **paper** (a hairline box in the sheet's own
  ground, the paper page's Copy BibTeX). A new page **adds a skin, not a new button.** /art's dark-room
  controls are icon squares, and its works open from the image itself. Neither has a label or an arrow, so
  neither is `Button.astro`. A skin obeys the motion rule: the sticker's plate moves by `transform`, not
  `box-shadow` (`Button.astro` says how).

**Restraint is the aesthetic.** Text is English, and Chinese where it is the right word: the literati feel
comes from composition and negative space, not from which script is set. Chinese is set in the reader's
system faces, never a downloaded one (*Stack*). Math glyphs (∇/λ/μ) are build-time MathML. A capture of a
work keeps what it shows: the calligraphy on /art, and the two-character motto in manifold's screensaver on
/projects, which `tools/vendor-projects.mjs` vendors whole. (An English-only rule stood here until
2026-11-05; the owner lifted it, "we can have chinese as well". Do not re-add it.) When in doubt, remove
rather than add.

## Stack

- **Astro 6** (static output) + **Tailwind v4** (`@tailwindcss/vite`; tokens via `@theme` in
  `src/styles/global.css`) + TypeScript (strict). Sitemap via `@astrojs/sitemap`.
  - **Tailwind scans source text without parsing it, this file and `README.md` included**, so a bare utility
    name in prose or a comment ships that utility's CSS on every page (BaseLayout's note; two names in this
    file's prose once shipped 73 B nothing used). Describe a utility rather than naming it bare.
- **NO REACT, NO CLIENT FRAMEWORK, NO ISLAND.** Everything interactive is a plain `.astro` file with a bundled
  vanilla `<script>` (*Interactivity*). `find src tests -name '*.tsx'` → 0, `grep -rn 'client:' src` → 0, and
  `astro.config.mjs` has no UI-framework integration. If an island ever becomes necessary, it is
  `npm i -D @astrojs/react …` (a static build's tooling is a devDependency) plus a decision recorded here.
- **Four runtime dependencies:** `astro`, `@astrojs/sitemap`, `@tailwindcss/vite` and `tailwindcss`.
  Everything else — `katex`, `remark-math`, `rehype-katex`, `remark-directive`, `unified`, `remark-parse`,
  `remark-gfm`, `remark-rehype`, `rehype-stringify`, `@astrojs/check`, `typescript`, `vitest` — is a
  devDependency, and only its output ships.
  - **`remark-directive`** is the paper format's syntax (`:t[…]`, `:::def`, `::::eq` — *Papers are files*):
    one package plus 9 small ones under it. Raw HTML would have needed nothing, but it stays an opaque `raw`
    node until Astro's rehype-raw, after every check; MDX (`@astrojs/mdx`) brings an integration, a JSX parser
    over the prose and, at its latest, Astro 7.
  - **`unified`, `remark-parse`, `remark-gfm`, `remark-rehype`, `rehype-stringify`** are declared so
    `tests/paperMarkdown.test.ts` can run the site's plugins inside Astro's chain, and `unified` also because
    `remarkPaperSyntax` imports it at build time. Astro already installs all five at these versions.
- **NO 3D LIBRARY** (`grep -c three package.json` → 0). The site's answer to wanting 3D is hand-rolled
  projection: the hero's landscape is longhand in `lib/terrain.ts` (`project`/`projectRaw` the camera,
  `normal` and `computeEDL` the shading), painted to a 2D canvas by `lib/terrainRender.ts`; the Solve slide's
  lattice is `lib/bellman.ts`. **The gate for a library is a still frame first, in SVG, judged in one look —
  three.js only after a frame survives being looked at.** Four of the five rejected showpieces were only
  judgeable once finished, which is what the cheap gate prevents.
- **Type: four roles, TWO downloaded faces.** `--font-display` is **Georgia** and `--font-body` the **system
  UI stack** — neither downloads anything, and both are deliberate: no webfont rendered for a long time, so the
  design was always judged in them, and when Fraunces finally appeared the owner rejected it on sight ("prod's
  font is better, the current font is kind of weird"). Keep Georgia for structure. `--font-mono` is
  **JetBrains Mono** and `--font-accent` **Fraunces**, only on sub-headlines and italic editorial lines.
  - **No CJK webfont** (a CJK face is megabytes): Chinese renders in the reader's system faces, and no stack
    names one. The fallback already keeps the register on a Mac (measured in Chrome): after Georgia it is
    Songti, a serif; after the system UI stack and JetBrains Mono, PingFang, a sans. Naming `Songti SC` would
    force Simplified forms on Traditional text. **New Chinese text carries `lang`** (`zh-Hant` or `zh-Hans`, by
    its script): it picks the glyph forms (Songti TC or SC) and the screen-reader voice, and lets a stack's
    closing generic find the browser's CJK default. /art's 春聯, 隸書 and 行草 carry `zh-Hant`. Not in the
    accent role: Han has no italic, and Fraunces falls back to PingFang, a sans, unless a `zh` `lang` sends it
    on to Songti.
    /projects' listing and computed pictures stay inside JetBrains Mono's latin subset
    (`tests/projectsListing.test.ts`, `tools/vendor-projects.mjs`' `DRAWABLE`), a font-coverage rule, not a
    language rule.
  - **LOCAL files** in `src/assets/fonts/` through `fontProviders.local()`, never `fontProviders.google()`: a
    build that fetches from Google failed CI with a 404 when a file hash rotated mid-run, and the same failure
    on `main` would leave the site stale. Variable fonts, one file per style, `weight` a range (JetBrains
    Mono's reaches the 600 of the nav's current link), provider config under `options.variants` (the schema is
    strict). In `src/`, not `public/`, which would ship them twice.
  - **Their own `--ff-*` variables.** Never point `cssVariable` at `--font-display`/`-body`/`-mono`: those are
    the role tokens, and that collision is what stopped every webfont from loading.
  - **Fraunces' preload is per page and per style** (`preloadAccent`: `/` the normal, `/writing/<slug>` the
    italic). Do not delete it: without it FCP measured 1956 → 2333ms. The reasoning, and the cost of
    preloading it everywhere, sit at BaseLayout's `<Font>`.
- **Math is typeset at build time as MathML.** The markdown chain (spelled once, in
  `lib/paperMarkdown/index.ts`, which `astro.config.mjs` calls) runs `remark-math` + `rehype-katex` with
  **`output: 'mathml'`**, the load-bearing option: KaTeX's default HTML needs `katex.min.css` and ~half a
  megabyte of `KaTeX_*` webfonts, a third downloaded family. MathML ships static `<math>` with zero client JS,
  CSS or fonts. `katex` stays a devDependency. `lib/equations.ts` holds the same guarantee for `.astro`, and
  `tests/equations.test.ts` asserts it.
  - **The MathML letter fix runs on every markdown file**, as `rehypeMathVariants` in `lib/mathml.ts` right
    after rehype-katex: Chrome honours no `mathvariant` but "normal", so `\mathcal`/`\mathbb` letters become
    Unicode letters, by the same table `fixMathVariants` uses for `lib/equations.ts`. The table's keys
    (`ALPHABETS`) are the one statement of what is rewritten, and the spec compares the two paths on each. It
    throws, naming the TeX, on a letter Unicode has no form for and on any other `mathvariant` it leaves
    (bold, fraktur…), so no letter is drawn plain in silence. A markdown plugin's throw does not fail the build
    (Astro logs it and stores the entry unrendered), so `/writing/<slug>` throws on an unrendered entry.
- `astro:assets` optimizes gallery images (responsive `widths`, **webp, not avif**: nothing in
  `astro.config.mjs` asks for avif, and `dist` holds none). /art's rules follow, each measured; the arithmetic
  is beside the code it sets: above `matSizes()`, `rowSizes()` and `calSizes()` in `lib/artPage.ts`, and above
  `zoomOf()` in `pages/art.astro`.
  - **Never a native width in `widths`.** The stele's 1727w was a 1342 KB webp on the `fetchpriority="high"`
    LCP image. Calligraphy is `[480, 900, 1200]` (`CAL_WIDTHS`), photos `[300, 600, 900]` (`PHOTO_WIDTHS`),
    and the mat reuses the tiles' and blocks' `widths`, so it adds no variant to `dist`.
  - **`sizes` matters as much as `widths`, and it comes from the CSS that sizes the element, not from the
    viewport.** A height-capped work renders at most `820 * ar` CSS px (414 for the stele), so DPR 2 takes the
    900w variant (142,128 B), where a `40vw` hint took 1200w (396,030 B). `tests/artSizes.test.ts` holds
    every constant behind the three hints to the rule it mirrors and sweeps each hint the page ships over the
    layout; `tests/distSmoke.test.ts` weighs the file a browser would choose, reading the device px from the
    shipped `sizes`.
  - **Only the first mat image is eager**, with `fetchpriority="high"`; every other image is lazy.
    `tests/distSmoke.test.ts` sums the eager images a DPR-2 browser picks, at most 300 KB, the first-load goal as
    the spec measures it. A real first load also fetches what the lazy-load margin reaches, both calligraphy works
    and none of the rows' photographs, which start ~3,070px down. Its goal is 400 KB, which the same file holds as
    a model (the eager work and every calligraphy work a DPR-2 browser picks) and a browser measured once (the pass
    is above `CAL_MAX_H` in `lib/artPage.ts`). The first phrase of the sentence picks the eager work, so a heavier
    one there is what fails it.
  - **A lazy work reserves its box before it decodes**, or everything under it starts higher and the lazy-load
    margin fetches it: a calligraphy block's width comes from its work's ratio (`--ar`) at the height cap, as a
    tile's does, and the dark room's image takes the same ratio. The bug it fixed is above `CAL_MAX_H`;
    `tests/artSizes.test.ts` holds the rule and `tests/distSmoke.test.ts` each block's ratio.
  - **Read an image's size from `getImage()`, never off its `ImageMetadata`.** The import is a Proxy, and
    reading any property of it but `clone` or `fsPath` keeps the original in `dist`. /art's `.width` and
    `.height` reads kept all 44 JPEGs there (40,525,788 B, 55% of a 74.3 MB artifact, referenced by nothing;
    issue #60). Nothing reads one now, so Astro drops every original and `dist` is 33.8 MB;
    `tests/distSmoke.test.ts` fails if any image under `src/assets` ships anything but webp variants. Every
    work carries its native-pixel webp from that same `getImage()` call, as `data-zoom`: the dark room's source,
    which zooms 6×, so the pixels stay.
- `site: 'https://ingtian.github.io'`, no `base` (user site at root).

## Layout

The load-bearing files and what each owns. **Not exhaustive** — `src/lib` holds a module per piece of real
math, and those come and go with the slides they serve; `ls` beats this list.

```
src/
  styles/{tokens.css, global.css}   # palette + type roles; the .descent gradient, atmosphere washes and the .is-slides slide metrics live in global.css
  styles/paper.css                  # what the two research routes share: the measure (--M --G --N --L --tk) and the wealth figure's series marks
  styles/slides.css                 # the homepage's paper panel, imported by pages/index.astro alone: .slide-paper (the five slides' ground and inks, --panel-*, per theme) and .slide-gutter (the rail's gutter, given back at 1100px)
  layouts/BaseLayout.astro          # head, astro:fonts, meta/OG/JSON-LD, favicons, the page-load veil, CornerNav, ClientRouter
  content.config.ts                 # the two content collections, `writing` and `papers`, their frontmatter schemas and the one isoDate helper
  content/writing/*.md              # the pieces themselves — a new one is a FILE, not a code change
  content/papers/*.md               # one paper's explainer each (rl-bhrp.md) — see Papers are files
  pages/research/index.astro        # /research: the papers as cards, newest first (a card opens its paper's page when a file explains it), then the interests
  pages/research/[slug].astro       # the one paper page: the record's head, the file's body, references, BibTeX; its script places the notes and runs the motion
  lib/paperMarkdown/{index,remarkPaper,rehypePaper}.ts # the markdown chain (spelled once) + the paper format's compiler and checks
  lib/paperMarkdown/names.ts        # imports nothing: PAPERS_DIR (content.config.ts reads it from here) and FIGURE_NAME, where a drawing names its own figure
  lib/paperFigures/{wealthFigure,pipelineFigure,metricsTable}.ts # a paper's drawings and Table 1, as HTML strings from its data; a :::figure places and numbers each
  lib/paperPage.ts                  # the paper page's pure half: the prose its frontmatter writes (authorRole, givenFirst, listed, referenceNote, Line + lineText), note stacking, the readout's month, step, point names, spoken line and instructions (readoutLabel)
  components/research/PaperLine.astro # one line of a paper page's own prose: names kept whole (wholeParts), dates as <time>
  lib/wealth.ts                     # the one wealth module: growth of $1, CAGR, drawdown, the band of runs, WealthSeries (the prepared series every picture of a run reads; REPRO is RL-BHRP's), scales and ticks — the paper page's figures and /projects' rl-bhrp picture
  lib/words.ts                      # the one word counter (countWords, readingMinutes) + wholeParts, the one rule for what never breaks across a line ("RL-BHRP")
  lib/dates.ts                      # the one date helper: longDate, monthYear (UTC)
  lib/motionTiming.ts               # the motion module's pure half: every curve (EASE, DRAW, SWEEP, FADE, WITHDRAW) and duration (REVEAL, RAIL, PAPER_PAGE, CARD, ART, MOVE_MAX) the rail, the research routes and /art move by, stagger and the paper page's batches (highlightDelay, arrowDelay), sweepDurations, mergeLines
  scripts/motion.ts                 # THE ONE MOTION MODULE, its DOM half: play, onceSeen, riseOnceSeen, sweepLines — the rail and both research routes; the reduced-motion gate is inside it
  scripts/pageView.ts               # onPageView(selector, init): starts ten scripts right after parse, not at window `load` (see Interactivity)
  scripts/beats.ts, lib/beats.ts    # walkBeats: the beat walk the three explainer slides share (timer, freeze on a click or an arrow, the observer at 0.3, the reduced-motion rest, the teardown); arrowBeat, its key map, is the pure half
  data/papers/{index,rl-bhrp}.ts    # PAPER_DATA (values, figures, the homepage line, thumb); RL-BHRP's Table 2, window, reproduction series, and VALUES — every figure its prose prints, as the string it prints
  lib/mathml.ts                     # the one MathML letter fix: fixMathVariants for lib/equations.ts, rehypeMathVariants for every .md
  data/profile.ts                   # ALL résumé content: name, roles, rolesSub, phd, bio, researchInterests, timeline, publications, projects + inProgress, awards, contact
  data/nav.ts                       # PAGES — the canonical page set (see Navigation)
  data/writing.ts                   # the writing TAXONOMY (KINDS) + buildKinds(), the one seam to the markdown
  data/artworks.ts                  # /art's works, keyed (photo-NN from the file; couplet, poem), + SENTENCE, the page's one sentence; photoNotes.ts holds each photograph's alt, title?, place?{name, confirmed} and year?
  lib/artPage.ts                    # /art's pure half: the sentence's rules (sentenceProblems over phrasesOf: PHRASES phrases, each a different work that exists, RED_PCT of its words red), a work's label line (labelLine), the three sizes hints (matSizes, rowSizes, calSizes) and their constants, and the dark room's zoom: zoomAbout (to 6x, about a point), wheelScale (by distance, not per event), isDoubleTap
  data/{define,desk,making,story}.ts # the homepage explainer's copy + numbers, per slide
  data/{cowGlyph,ruleGlyphs,tickerGlyphs}.ts # pixel-art matrices: the cow's and the slides'
  lib/deck.ts                       # pure deck stops: WHERE the homepage scroll may rest, what's next, and what one wheel event does (wheelAction)
  lib/pageStops.ts                  # pure Stop trees: one tree per page drives BOTH its rail and its section ids; + fragmentId, the one decode of a URL fragment
  lib/viewport.ts                   # PHONE_MAX_WIDTH = 640, its PHONE_QUERY + isPhone() — the one phone gate; WIDE_QUERY, the wide layout past 1100px
  lib/motion.ts                     # prefersReducedMotion() — the one motion gate; MOTION_LIMIT_MS, WCAG 2.2.2's five seconds
  lib/skyShader.ts, skyPalette.ts, skyLegibility.ts   # the fluid sky: GLSL, ramps, and the text-contrast policy
  lib/terrain.ts, terrainRender.ts  # pure terrain math (field/grad/runDescent/colormap/project) + its painter AND the memoised grid cache
  lib/marchingSquares.ts            # isoRuns — the ONE stitched kernel — and isoLevels, the one level placement (descentPath's storyContours and terrainContours call both); isoSegments, unstitched over a pre-sampled grid, for DraftingField (redrawn per frame, so the O(n²) stitch is unaffordable)
  lib/terrainContours.ts            # the hero field's isolines + levels, memoised — the intro's survey pass
  lib/introTimeline.ts              # the homepage intro's SCHEDULE only — pure. The decision and the ?dur= clamp live in pages/index.astro's is:inline script; lib/introSession.ts reads what that publishes
  lib/descentPath.ts, trajectory.ts # the career descent graph's field and route
  lib/{bellman,problemSize,complexity,policyPnl,scenario,split}.ts   # the explainer slides' real math
  lib/scrollspy.ts                  # activeStopIndex (railMarks' fallback) + railMarks, SideRail's marking rule
  lib/{justify,pixels,cowSpeech,knowledge,equations}.ts
  sections/{Heights,Interlude,Choice,Rules,Solve,Story,Work}.astro   # the homepage, in scroll order — all of sections/
  components/Deck.astro             # the deck's event plumbing (homepage only)
  components/FluidSky.astro         # the WebGL sky canvas — on 5 routes (/projects, the two research routes and /art omit it)
  components/SkyWash.astro          # woven warm/cold broken-color wash over the sky — CSS + a small script
  components/TerrainHero.astro      # the hero's terrain canvas (Heights only)
  components/DescentPath.astro      # the career descent graph (inside Story)
  components/SideRail.astro         # the one marginal rail (/, /research, /research/<slug>, /writing, /experience, /projects), driven by a Stop tree
  components/CornerNav.astro        # the always-visible glass nav: the pages, the contact marks (the only links to CV and Email), the theme toggle
  components/PlushCow.astro         # the cow, at three scales, with a pixel speech bubble; `talk` is /projects' cow, driven by that page's script
  components/Button.astro           # the shared button ANATOMY + a per-page skin ('sticker', /projects'; 'paper', the research routes')
  components/Grain.astro            # the paper grain: a baked SVG noise tile, a static full-viewport overlay
  components/projects/*.astro       # /projects only: DraftingField (the background), TerminalHeader (banner, listing, the boot), Gallery (the fan), SelectedRows, WorkshopCards, ProjectAsk (the "open on GitHub?" pop-up), ProjectPicture (no script)
  lib/draftingField.ts              # the drafting field: drift, the ping schedule, probe readouts — pure; DraftingField.astro strokes its isolines through isoSegments over the grid sampleGrid() lays out
  lib/asciiBanner.ts                # the PROJECTS banner as SVG rects from letter matrices (the mono subset has no block glyphs)
  lib/projectsListing.ts            # the header's `ls -l` lines and the summary counts, computed from the records
  lib/projectsBoot.ts               # the boot: shouldBoot (WHETHER — shipped as source by projects.astro's is:inline decider) + bootSteps/bootState (WHAT, at each ms)
  lib/{cowTalk,galleryLayout}.ts    # when the /projects cow talks and which line; the fan's poses + the one click rule every project surface shares
  lib/{positioning,projectVisuals}.ts # offchart's percentile, ported; the four COMPUTED pictures as SVG strings, coloured only by CSS variables
  data/{cowLines,projectVisuals}.ts # the /projects cow's lines (stored as PAIRS); which picture each project shows
  data/vendor/*.ts                  # GENERATED — the computed pictures' inputs and the paper page's reproduction series, with provenance in each header. Do not edit; re-run the tool
tests/*.test.ts                     # vitest — every pure lib module, the data/route invariants, the content seam
tools/vendor-projects.mjs           # the ONLY thing that touches the network, run by hand: writes data/vendor/*, src/assets/projects/* and public/projects/*; name parts (`… binaries`) to re-vendor only those
```

### Routes

`npm run build` prints `9 page(s) built`; check this table against that, and `ls src/pages` beats both.

| Route | What it is |
| --- | --- |
| `/` | the descent — the homepage deck |
| `/research` | the papers as cards, newest first, each opening its page here or its publisher's; then the research interests |
| `/research/<slug>` | one paper explained, rendered from `src/content/papers/<file>.md` (today `/research/rl-bhrp`) |
| `/writing` | the writing shelf — kinds, each listing its markdown pieces |
| `/writing/<slug>` | one piece, rendered from `src/content/writing/<slug>.md` |
| `/projects` | every notable project, on its own drafting register: the terminal header and its boot, the gallery, selected work, the workshop |
| `/experience` | the timeline — education and roles |
| `/art` | one sentence whose seal-red phrases bring a work onto a mat; the calligraphy as object blocks; every photograph in justified rows; on the paper sheet |
| `/404` | the not-found page (noindex, no canonical) |

**Prototype routes: none today** (git holds the retired ones). A `src/pages/proto-<name>.astro` page exists to
make a visual choice by looking at the real thing in the real page, options as a switcher. It is kept out of
the index **by construction**: `BaseLayout` gives every `/proto-` path `noindex` whatever the page passes (no
noindex means a self-referential canonical, an explicit request to index the page, and two proto routes once
shipped that by forgetting the prop), and `astro.config.mjs` filters `/proto-` from the sitemap. Add its
route to the census in `tests/distSmoke.test.ts` (`want`, which fails by name on a route it does not list)
and to the page count above; retiring one deletes the page and both.

### Interactivity — vanilla scripts, and the contract they keep

Every interactive thing is a plain Astro component or page with a bundled `<script>`, **not** an island.
`grep -rln '<script' src/{components,sections,pages,layouts}` lists them: 23 files today (`ProjectPicture.astro`
and `Button.astro` have none; unfiltered, the grep also hits three `lib/` files that say `<script>` in
comments). `scripts/{beats,motion,pageView}.ts` are modules those scripts import.

**Three files break the contract below on purpose, with `is:inline` scripts that must run before first
paint** (`grep -rn '<script is:inline' src` → 4 in 3 files). A bundled script runs after parse, which is after
first paint:
- `index.astro`'s intro decider and `BaseLayout`'s theme resolver and veil: without them the page paints one
  state and then flips to another (the finished sky, the wrong theme).
- `projects.astro`'s boot decider: sets `html.projects-boot` before the banner and gallery parse. It ships
  `shouldBoot`'s own source and owns the boot clock (`data-boot-at`) plus a `BOOT_DEADLINE_MS` failsafe. Every
  rule that hides something under the class says `transition: none`, or a ClientRouter arrival animates the
  finished page *into* the boot (`tests/distSmoke.test.ts` checks the built CSS).

The research routes need none: nothing on them is hidden by markup. What waits for a reveal carries
`data-pending`, set by a bundled script and only on what is still below the screen the reader lands on
(`onceSeen` in `scripts/motion.ts`), so nothing a reader can see flips; a wide margin note is held by CSS
alone, `@media (scripting: enabled)`, until the script places it (*Papers are files*). /art needs none
either: a photograph whose image has not loaded when its script starts carries `data-pending` for its one fade,
until the image loads or errors (one partly painted by then blinks out once and fades back). Every hold-back rule,
/art's too, is inside `@media screen`: a printout is laid out where no observer sees it and no backstop runs, so
it gets the finished page (`tests/distSmoke.test.ts` fails on a hold-back outside one).

- **Re-init on `astro:page-load`, with a teardown**, because `ClientRouter` replaces the DOM without a fresh
  page load: a script that only runs at parse time is dead after the first navigation.
  - **On a FULL load `astro:page-load` is window `load`**, which waits for every font and eager subresource,
    and never comes if one never arrives (in headless Chrome 156 a held lazy picture did not hold `load`; held
    fonts did). So ten scripts start through `scripts/pageView.ts`'s `onPageView()`: at module evaluation
    right after parse, then once per new DOM on `astro:page-load`, with the element its selector found (a page
    without one gets only the last teardown). Six are /projects': `TerminalHeader`, `ProjectAsk`, `Gallery`
    (a slow card shimmers, and a picture fades in, even before `load`), `DraftingField` (the field draws while
    the banner lights), and `pages/projects.astro`'s ask dispatcher and cow (it hears a `cow:say` sent before
    `load`, and does not greet a reader whose pop-up is already open). The other four: `SideRail`, whose first
    marks land while its rows are still entering; the paper page, whose notes are placed and reveals armed
    before the reader sees it; the /research index, whose cards answer the first pointer or Tab; and /art,
    whose rows are justified and photographs held for their fade as soon as it parses. Only `SelectedRows`'
    preview and `WorkshopCards`' spotlight start at `load`: both are hover-only, and the first pointer move
    after it finds them.
  - **The teardown is returned.** An `onPageView` init returns it and `onPageView` runs it before the next
    init: one `AbortController`'s `abort()` for the `window`/`document` listeners, plus the timers, rAF loops,
    observers and video. Listeners on elements in the swapped `<body>` leave with it (nothing here is
    `transition:persist`).
- **Pure logic goes in `lib/`, plumbing stays in the component.** That split is why `deck.ts`,
  `pageStops.ts`, `terrain.ts`, `justify.ts` and `scrollspy.ts` have specs at all.
- **Both gates are asked, not re-derived**: `prefersReducedMotion()` from `lib/motion.ts`, `isPhone()` from
  `lib/viewport.ts`.
- **The rail and the research routes animate through one module**, `scripts/motion.ts` (its pure half, the
  curves and the arithmetic, is `lib/motionTiming.ts`): `play` runs a Web Animation and hands back to the
  element's own CSS, `onceSeen`/`riseOnceSeen` reveal what is first seen, `sweepLines` draws a highlight line
  by line. The reduced-motion gate is inside it, not in the callers: under it `play` lands on its last frame
  at once and `onceSeen` holds nothing back. A teardown finishes every live animation.
  - **Every curve and duration they move by is stated once, in `lib/motionTiming.ts`**, and a script imports
    it; it states /art's two too (`ART`: the mat's swap and a photograph's one fade), though /art moves by CSS
    transitions and not through `scripts/motion.ts`. CSS cannot import them, so `tests/motionTiming.test.ts`
    reads each transition and animation declaration, shorthand or longhand, in `SideRail.astro`'s, the two
    research pages' and `art.astro`'s `<style>` blocks and `styles/paper.css`, and holds it to its constant, in
    order: a literal added there without one fails by name. In those scripts and `scripts/motion.ts` it fails
    a curve written out (`cubic-bezier(`, or a keyword such as `'ease-out'`; `'linear'` is no curve), and a
    number of ms of two digits or more after `duration:`/`delay:`/`step:`/`max:`/`total:` or as a
    `later()`/`setTimeout()` delay. It does not see a literal in any other stylesheet, or a duration a script
    builds some other way. The rail's entrance duration reaches the CSS as `--row` on the nav, beside `--gap`,
    as the frontmatter's stagger is computed from it.

## The homepage — the deck

Section order (= the descent), all seven top-level `<section>`s of `main.is-slides`: **Heights** (the hero —
de-centered: name bottom-left with the role line and the tagline under it, bio top-right, terrain canvas
full-bleed behind) → **Interlude** (the field as a headline, "An OR quant in multi-period portfolio
optimization", and the hierarchy line, in the warm sky) → **Choice** → **Rules** → **Solve** (the three-slide
explainer) → **Story** (the editorial, with the descent graph in a sticky column beside it) → **Work** (the
appendix: papers, writing, projects, and the cow at its foot). The page ends on Work's panel: there is no
footer (deleted with its seal on the owner's word, "Delete it, CV+Email in menu"), and CV and Email are in the
corner nav.

**What I do comes before how I got here**, on the owner's observation: "the descent answered my trajectory,
but didn't answer what I do. Normally people think about what do I do first, then my trajectory." The
explainer earns the graph.

The three explainer slides are **real math, not drawings** — the rule five rejected showpieces left, every one
of which "looked like it meant something without meaning anything":

1. **Choice** — what the words mean, defined by one object: a hundred dollars in a bar. A portfolio is this
   (the bar divided four ways); optimising is choosing (three other splits, each re-priced after one piece of
   news); multi-period is choosing again (re-divided month after month, paying to change); and a fourth beat
   shows the consequence, different decisions in time as PnL curves. The object never changes, only what is
   said about it, which keeps it one slide. It has to *define*, not assume: nothing else on the site says what
   a portfolio is.
2. **Rules** — how hard it actually is, in four beats: you run $1bn+ and your slippage is now measurable;
   here are the constraints; here are the thousands of futures they have to hold in; now do all of it at
   once. Impact is square-root, calibrated to a published anchor; the trajectory fan is a *seeded* walk,
   because a fan that shimmered between builds would undercut a slide whose claim is that the scale is real.
   **Its register is "bigger", not "smaller"**: the problem gets bigger the closer you look, so nothing on it
   may shrink something (the two drawings that did are in *Rejected*).
3. **Solve** — where to start: "Still an open problem.", a few general directions of attack, and beside them
   what *can* be solved exactly: a real finite-horizon Bellman lattice filled in backward from the horizon,
   then the optimal route traced forward past the candidates it beat. It is evidence of how small a solvable
   world is, not the method running. **No equation:** the Bellman recursion as its spine would assert a
   formulation and a solution for a problem that has neither (the owner's correction is verbatim in
   `data/desk.ts`); Rules owns the recursion, where it is the thing that blows up.

The numbers in the prose are **computed at build time from the same data the picture draws**, so the words
and the drawing cannot drift — and a sentence quoting a figure quotes the row the chart highlights (a draft
said "a billion dollars" while quoting the $10bn row). Don't hand-type a number a module can compute.

**The résumé is not on the homepage**, on the owner's instruction ("you may delete everything from below. The
record, the experience, everything"). Every block has its own route, and the corner nav carries the doors.
`sections/Mountains.astro`, the old résumé section, is deleted; git is the archive.

### THE DECK — one gesture, one slide

`components/Deck.astro` (plumbing) + `lib/deck.ts` (pure stops, unit-tested). The brief: *"like a PPT, one
scroll guides you to the next slide. It's not a free scroll."*

- **It is not CSS scroll-snap, and that was measured.** Slide gaps are 581–2346px while one wheel gesture is
  ~320px, so `scroll-snap-type: y mandatory` re-snapped to the slide it started from: the scroll sat at y=84
  through eight consecutive gestures and a 12-event trackpad flick. `proximity`, `scroll-snap-stop: always`
  and a hero of exactly 100vh measured identically stuck; only gestures of 640px+ advanced. The arithmetic is
  gesture size against slide spacing, so no snap flag can fix it (`lib/deck.ts`'s header has the measurement).
- **Tall slides get interior stops**, one viewport apart, so the deck pages *through* them; a slide only
  barely taller than the viewport is treated as fitting (`slack`), because an 84px "advance" is exactly the
  free-scroll feel being replaced.
- **What it deliberately does not break**: keyboard (Home/End/PageUp/PageDown/space/arrows), find-in-page (it
  picks up wherever the browser lands), resize/zoom (re-measured), trackpad momentum (one flick is coalesced
  into one slide), and `#anchor` jumps, the rail's included.
  - **A jump the deck did not start wins.** On `popstate` or `hashchange` it cancels its own tween and swallows
    the wheel until 300ms after the jump's last scroll event. Not on `scrollend`: each of the tween's instant
    steps fires one, which ended the hold a frame after the click. Measured without this: a rail click 250ms
    into a PageDown rested on the deck's target with the hash set to the link's (4 of 4), and a wheel during
    the jump started a slide from mid-flight. `wheelAction` in `lib/deck.ts` is the decision, specified; the
    wiring shows only in a browser.
  - **A small wheel event is swallowed, not passed**, while a stop lies that way: Chrome lets a gesture's
    events be cancelled only if its first one was, and a trackpad gesture opens at 5–6px, under the 18px
    `WHEEL_THRESHOLD`. Passing the opener left the rest of the gesture, momentum included, scrolling natively
    under the tween. A gesture starts a slide once its travel reaches the threshold.
- **It does not engage under reduced motion, and it does not engage on a phone.** Both fall back to an
  ordinary free scroll, which is a *finished* state.

## Phones

`lib/viewport.ts` is the one phone gate: **`PHONE_MAX_WIDTH = 640`** and `isPhone()`, which asks `matchMedia`
rather than measuring `innerWidth`, so it agrees with CSS exactly (the two differ by a scrollbar's width, enough
to engage the deck on a viewport whose styles think it's a phone). The query string is built once, as
`PHONE_QUERY`: `isPhone()`, the deck's change listener, /projects' inline boot decider and the dist smoke
test's stand-in all read it.

**The number lives in two places, synced BY HAND** (`@media (max-width: var(--x))` is not CSS). If you change
`PHONE_MAX_WIDTH`, change every hit of `grep -rn 'max-width: *640px' src` — the `*` matters, as a hit written
without the space has been missed before. Classify each hit rather than subtracting a remembered number: a rule;
prose (comments in `lib/viewport.ts` and `global.css`); `projects/Gallery`'s
`sizes="(max-width: 640px) 240px, 330px"`, the phone strip's card width, which moves with the strip's block; or /art's
three `sizes` hints (`matSizes()`, `rowSizes()`, `calSizes()` in `lib/artPage.ts`), which move with its 640px block.
**The wide side is always the negation, `not all and (max-width: 640px)`, never `min-width: 641px`**: a second
bound leaves a zoomed window 640.5 CSS px wide to neither side, and this grep would miss it.
`tests/viewport.test.ts` pins the value and fails on any such pair, at any breakpoint in `src`. A prototype
route is not part of the phone treatment and need not use this breakpoint.

**The phone gets the same CONTENT as the desktop.** A phone-specific content design was built **three times
and reverted every time** — do not rebuild it. The phone treatment is *bug fixes only*, and the whole of it is:

- the corner nav collapses to a **menu mark** that swaps for the list when opened (mutually exclusive, so the
  capsule never grows a second row). The list is the pages, then GitHub, Email, CV and LinkedIn as
  icon-and-word rows, then the theme toggle, each group past a hairline, every row at least 44px tall; it
  scrolls inside itself on a screen shorter than it (~510px, computed: 415px measured with two contact rows);
- the **deck disengages** — measured in real WebKit, 5 of the 7 slides are taller than the viewport (rules
  1.84 screens, story 3.07 on an iPhone 14; 2.5 and 4.2 on an SE), so "every slide owns the screen" is false
  there. All four reported symptoms — text resting under the fixed nav at 7 of 15 stops, one swipe scrolling
  twice, a light flick going nowhere, one swipe skipping a screen — came from the deck resting *inside*
  slides, and turning it off removes all four by deleting behaviour rather than adding compensation;
- the **homepage's rail hides**: it is `SideRail`, which every rail page hides at 1100px and below, where the
  slides take its gutter back;
- the **descent graph** drops its in-frame labels and becomes a block with its own height, with the sentence
  that explains it read *after* it rather than across it;
- the **fluid sky canvas is skipped** entirely under 640px;
- on the **research routes**, from 1100px down (where `SideRail` hides) the page is one column: a paper page
  opens with a **Contents** list that replaces the rail, listing exactly the rail's stops (`paperSections()`),
  and its margin notes fall in under the block they explain (so they do with no script, at any width). At
  640px the type steps down, an equation or figure that has a narrow drawing shows it (an equation's
  `$$ narrow`, Figure 2's `svg.narrow`, Figure 1's `.pp-art.narrow`) — the same equation or figure, broken for
  the width — Table 1's dates take their short form, its row heads stick as it scrolls in its own box, and an
  index card sets its picture beside its title with a short tag for a caption. Figure 2's readout works by tap;
  a term's link to its note and a symbol's to its Notation row are a mouse's or a pen's, never a tap's, so
  nothing stays marked;
- on **/projects**, the gallery's fan becomes a horizontal strip, the drafting field is painted once as a still
  frame, and the rows' floating preview and the cards' glow are gated on `(hover: hover)` rather than on
  width, so they stay off on a tablet's touch too. Two more, both *deleting* behaviour:
  - **No boot.** `shouldBoot` takes a `phone` flag (the inline decider asks `lib/viewport.ts`'s
    `PHONE_QUERY`, passed in, never typed) and a phone gets the finished page, even with `?boot=1`. On a phone
    the largest element is a listing line the boot prints late: observed mobile LCP was 2,294ms with the boot
    and 61ms without. With the gate, Lighthouse mobile observed 71ms (simulated 1,955ms; Perf 99), the LCP
    element the summary line.
  - **The cow sits beside the listing's last line, as from 641px, and says only what it is asked** — no
    greeting and no idle lines, so the idle timer is never set. A 343px column has no room for the bubble on
    the prompt's row or above it, so on a phone it opens below the prompt, tail turned up, into a fixed strip
    sized for its tallest line (four rows at 320px); `tests/cowTalk.test.ts` word-wraps every line at 320px
    from the stylesheets' own literals and fails on a fifth row (Latin advances only: it refuses a Han line until
    it is taught Han's widths). Across 0–1179px the cow is top-aligned in its row and set 12px under the
    summary, so a wrapping line does not move it and its hop does not cover the summary; the measurements are
    in `projects.astro`'s comment on the 1179px block. A probe that watches the gallery and not the cow
    reports "nothing moves when it speaks" while the cow moves: assert the cow's rect for every line.
- on **/art**, at 900px and under the sentence comes first with the mat directly under it, so a tap swaps the
  work just below the line being read, and a block's work sits above its words. At 640px the sentence is 21px,
  the mat is `min(40vh, 320px)` (so its top is on the first screen at 390×844; computed, not measured), and rows
  are 150px; the dark room's bar takes two rows, the line (up to two lines) and the count, then the squares; the
  work is centred in the band between the close strip and the bar.

## Navigation & structure

- **`src/data/nav.ts` `PAGES` is the canonical page set** — "where can you go from here", in the site's own
  hierarchy (research first, art last; /writing directly after /research, the same subject at a different
  formality). It is data because the page set is a *fact* about the site (the site once shipped a link to
  `/experience` before that page existed). `tests/distSmoke.test.ts` resolves every href the nav renders, on
  every built page, and `tests/nav.test.ts` asserts no duplicate hrefs or labels and the converse: every page
  in `src/pages` but `/`, the 404 and a `/proto-` route is in `PAGES`, since the corner nav is the only link to
  `/experience` anywhere. `CornerNav` renders it.
- **The page you are on is marked by a lit DOT before its label**, on every page: `aria-current="page"` on the
  link, a 6px dot plus a glow, and the label at weight 600. A page under a door (`/research/<slug>`,
  `/writing/<slug>`) marks its section's link the same way with `aria-current="true"` — it is in that section,
  not on that page; `tests/distSmoke.test.ts` checks every built route. It replaced a 1px hairline the owner
  found unclear; the dot is shape plus colour, and the **bloom pill stays hover's and focus's**, so "here" and
  "you could go here" never look alike.
  - **The dot reserves its space; it does not take any.** It sits in the link's left padding, and every page
    link carries the same 20px of it, so no label moves between pages (measured on the five pages in both
    themes: within 0.02px; a classic 15px scrollbar still moves the right-anchored capsule between a page that
    scrolls and one that does not). A dot inside the label made the current item 14px wider and moved every
    label left of it. The 600 moves nothing: a monospace face keeps its advances.
  - Its colour is the accent **role token** `--ochre`, never a literal (ochre in light, emerald in dark, seal
    red on the registers); the pill and the focus ring read it too.
  - The 600 is real, not synthesised: the local JetBrains Mono face declares its range up to it, and
    `tests/distSmoke.test.ts` compares the built rule's weight with the declared face — a weight past the
    range gets a fake bold that no computed style can reveal.
- **The contact links are one typed record, `contact` in `profile.ts`** (`github`, `email`, `cv`, `linkedin`,
  each an href, a label and a new-tab flag), read by `CornerNav` and by BaseLayout's JSON-LD `sameAs`; `PAGES`
  is the only page list.
  - **The corner nav is the only place CV and Email are linked**, so it links them at every width: from 1200px
    all four marks, as icons (with their words from 2200px); from 641 to 1199px Email and CV only, in a
    capsule whose paddings tighten to fit one row at 641px (`CornerNav.astro` has the arithmetic, classic
    scrollbar included); on a phone, all four as rows in the opened list (*Phones*), the one place a phone
    reaches GitHub and LinkedIn. From 641 to 1199px no page links those two. `tests/distSmoke.test.ts` checks
    every built page's nav for the CV and Email links, that no rule hides them, and that the profiles' hide
    sits inside the wide side's negation, never on a phone.
- **`src/lib/pageStops.ts` is one tree per page, and it drives BOTH the rail and the page's section ids**, so
  **a stop cannot point at an id the page didn't emit**: the function that names a stop's anchor hands the
  page the id to render. (An old /research built its rail from one paper's anchors while rendering the ids once
  per paper, and every "Method" link jumped to paper 1.) Add a section → add it to the page's `*Stops()` and
  render the id from the same helper. A paper page's sections are its file's, as the plugin reports them, then
  the page's own (`paperSections()`, `PAPER_END`); its rail and its phone Contents both list exactly that.
  `SideRail` is dumb markup over these trees, on every rail page (the homepage's is `homeStops()`).
  - Rail labels are **bookmarks, not sentences**: on `/` the rail must end left of the slides' 168px gutter,
    and `tests/pageStops.test.ts` holds the label lengths that keep it there (the arithmetic is beside
    `homeStops()`).
  - `flattenStops()` is *tree* order, which need not be visual order. `SideRail` numbers its rows by it for
    their entrance and nothing else; `railMarks` sorts by measured top where order matters.
- **`SideRail` is the one rail**, on /, /research, /research/&lt;slug&gt;, /writing, /experience and /projects.
  It hides at 1100px and below, where a paper page shows its Contents list instead.
  - **On `/` it stays off the hero**, through its one page-facing prop, `hideOver="heights"`: `display: none`
    (so its links leave the tab order too) until the script finds the hero's bottom above mid-screen, as it is
    when the deck rests on the Interlude. With no script it stays hidden, since over the hero it would print
    across the name on a short window. A rail click is a plain `#anchor` jump, which the deck leaves to the
    browser; at every deck rest one slide fills the reading band, so one stop leads (an explainer slide with
    "The field" lit as its ancestor).
  - **That breakpoint is one query, `(max-width: 1100px)`, and the wide side is always its exact negation**,
    `not all and (max-width: 1100px)` (`WIDE_QUERY` in `lib/viewport.ts`, for the one script that asks: the
    paper page's note placement), never a second bound at 1101px. A zoomed or OS-scaled window can be 1100.83
    CSS px wide (1321px at 120%), which a pair of bounds leaves to neither: measured there, the rail showed
    while the paper's 24 notes went unplaced, 8 of them overlapping, /projects' content sat under the rail,
    and the homepage's Choice slide stacked. The homepage's five paper slides give the rail's gutter back on
    this same query, once (`.slide-gutter` in `styles/slides.css`). `tests/viewport.test.ts` holds `WIDE_QUERY`
    to the exact negation of SideRail's hide query, the paper page's one-column query and the gutter's, and
    fails on any breakpoint in `src` written as two bounds a pixel apart (/projects' cow column is
    `(max-width: 1179px)` and its negation for the same reason).
  - **Under forced colours** (Windows High Contrast) every ink becomes one system colour and the dash, a
    background, is painted as Canvas; there the dash is `Highlight` and the current label is underlined.
  - **Its marking rule is `railMarks()` in `lib/scrollspy.ts`**, pure and specified (its doc comment is the
    rule). Two stops are lit at a section boundary **on purpose** — the reader is looking at both — and one of
    them leads; links carry `aria-current="true"`, which is valid on more than one.
  - **Every label clears 4.5:1 at rest, on every rail page's ground** (on `/`, the sky as its CSS gradient;
    see below). A label is three layers of one text, so a mark is a cross-fade of opacities and every state is
    a solid ink (`SideRail.astro`'s header says how, and why the two inks over the label are `aria-hidden`
    generated text). The sheets' numbers are held by `tests/paperPalette.test.ts` and
    `tests/draftingPalette.test.ts`; over the reading sky they were measured on screen (inactive labels 5.53 /
    5.74 on /writing and 5.54 / 5.63 on /experience, light / dark; the dash at least 3.74:1). On `/` a resting
    label is `--rail-ink` (light `#494339`: 4.96:1 on the tan panels, where `--ink-3` is 3.80, and 4.69:1 on
    the sky at its deepest under the rail; dark `--ink-3`) and the focus ring `--rail-focus` (light `--ink-1`,
    9.32:1 on the tan, where `--ochre` is 1.19; dark `--ochre`), held with the marks and the dash by
    `tests/deckPalette.test.ts` on the panels and on the sky's CSS gradient, its no-WebGL state, down to the
    Interlude's foot with the hero at 1.6 screens (a short window; computed, not measured), the label inks
    also under the static Grain overlay; the last screen is Work's panel. Not held: the live sky a desktop with WebGL draws over that gradient (FluidSky, SkyWash, the
    `.descent` washes). The descent variant's policy guards against a lighter sky under its paper-coloured text
    and lets it darken nearly freely, and a darker sky is the danger to the light theme's dark labels.
  - **Its motion is the rule's: each piece runs once per showing** (the timings are `lib/motionTiming.ts`'s
    `RAIL`; the entrance's duration reaches the CSS as `--row`). The entrance is CSS because a bundled script
    runs after first paint, and a from-state it set could land on a rail already drawn at rest. On `/` the
    entrance plays as the reader leaves the hero, and again each time they come back down past it (a CSS
    animation restarts when its element renders). Hover is `.is-hover`, not `:hover`, set for a mouse or a pen
    and never for `pointerType === 'touch'`. Reduced motion: the same marks, at once.
  - **A page reskins it through four role tokens and nothing else**: `--knockout` and `--rail-dash-halo`, each
    read with a `none` fallback (the drafting register's), and `--rail-ink` and `--rail-focus`, read with
    `--ink-3` and `--ochre` (the homepage's). No page styles the rail; `tests/draftingPalette.test.ts` checks.

## The content model rule

Policy, not preference:

- **Records rendered in more than one shape stay TypeScript data.** Publications, the timeline, projects and
  artworks are cross-referenced by id and rendered in 3+ shapes each (a rail label, a homepage line, a full
  panel, JSON-LD, a computed number). They live in `src/data/*.ts`, where a type error catches a mistake and a
  test can assert the invariant.
- **Unbounded prose with exactly one renderer becomes a content collection.** Writing is that: one route
  renders it, there is no upper bound on how much there will be, and its author should never open a `.ts`
  file to add a piece. So is a paper's explainer (*Papers are files*), beside its record, which stays data.

**Do not converge them.** Turning `profile.ts` into markdown would break every cross-reference and computed
number; turning writing back into a TS array would make a new post a code change. Each collection meets the
data at exactly one seam: for writing, one function (`buildKinds`); for a paper, its frontmatter's
`publication` (the slug of its record), with the records and `PAPER_DATA` handed to the plugins as options by
`markdownPlugins()`.

## Writing is markdown

The owner: *"i want the writing to be flexible. so essentially writing.ts displays some markdown notes i
have. My favorite quotes is just a markdown file."*

**A new piece is a FILE, not a code change**: drop a `.md` into `src/content/writing/`, give it frontmatter,
and it appears on `/writing` under its kind and gets its own page at `/writing/<slug>`. Nothing else is edited.

- **`src/content.config.ts`** defines the collection (`glob` loader) and validates frontmatter at **build**
  time, which is why it's a collection rather than `import.meta.glob`: a typo in `kind:` fails `npm run build`
  naming the file, where a glob would render a broken row and ship it.
- **The frontmatter contract:**

  | field | required | notes |
  | --- | --- | --- |
  | `title` | yes | |
  | `date` | yes | `YYYY-MM-DD`. Unquoted YAML dates are fine — YAML parses `2026-08-15` into a Date object, so the schema accepts a string *or* a `Date` and normalises. |
  | `kind` | yes | enum: `notes` \| `essays` \| `explainers` \| `misc`. An enum so a misspelling is a build error, not a piece that silently belongs to no section. |
  | `blurb` | yes | one or two sentences; shown on the index, not on the piece. |
  | `updated` | no | when the piece last **gained** something. |
  | `minutes` | no | omit rather than guess — the index only prints it when it's real. |
  | `featured` | no | leads its kind. |
  | `draft` | no | committed but unpublished: no index row, no page. |

- **`updated` is SET BY HAND, and only when a piece gains content.** Not from git: a reformat, a typo fix or a
  rebase would each register as an edit, CI's shallow clones make the git date unreliable, and a date that
  moves on its own teaches a reader to distrust every date on the site. It renders only when it *differs* from
  `date`, and may not precede it (the schema refuses).
- **`data/writing.ts` keeps only the taxonomy** — what each kind IS, its rail label, its gloss, and the copy
  shown while it's empty. That is site *voice*, so it stays in TypeScript. **`buildKinds()` is the single
  seam** between taxonomy and files, returning the `WritingKind` shape the page and `pageStops` consume. The
  schema's enum and `KINDS`' keys must agree; `tests/writingContent.test.ts` asserts it (reading
  `content.config.ts` as *text*, since `astro:content` is a virtual module vitest cannot import).
- **Empty kinds are shown**, with copy that names what is coming rather than "coming soon" — it states intent,
  where a silently-missing section would not. A test enforces that the empty copy is specific.

## Papers are files

**A new paper page is a FILE, not a code change.** A paper's explainer is one `.md` in the `papers` collection
(`src/content/papers/`), in a small directive syntax that `remark-directive` parses and `lib/paperMarkdown/`
compiles and checks at build time. The file holds the prose; everything else has one home of its own:

- **The record** (title, authors, abstract, BibTeX, links, the owner's `reproduction`, tags) is the paper's
  entry in `profile.ts` `publications`, never repeated in the file. The page is `/research/<record slug>`, and
  it says which author wrote it from `profile.ts` `authorName`. A status is called what `STATUS_LABEL` beside
  its type says, on every surface that prints one (a card as written, the homepage line and the paper's head in
  lower case, a preprint's head adding ", not peer reviewed"). The prose the page writes round the file from
  these (the owner's place among the authors, the note on the references, for any count of them) is
  `lib/paperPage.ts`'s, specified.
- **The frontmatter** (zod, `content.config.ts`): `publication` (a slug in `publications`), `pageDate`,
  `references` (`{ key, authors, year, title, journal?, venue?, doi?, url?, addedHere? }[]`, an author written
  `Family, Given` so a citation can read "López de Prado, 2016"; `journal` is set in italics and `venue` plain
  after it; `addedHere` is where the paper names a work its bibliography leaves out), `bibliographyOmits` (the
  bibliography's works the page does not draw on, each described, for the note above the references),
  `leftOut` (what the page leaves out of the paper, for "Read the full paper") and `errata`
  (`{ date, text }[]`, a `:v` in the text filled in).
- **The numbers and pictures** are `PAPER_DATA[slug]` (`src/data/papers/`): `values`, strings computed from
  the paper's data; `figures`, the drawings and tables made from it by `lib/paperFigures/` (HTML strings, their
  maths build-time MathML; a figure's caption is the file's); `line`, the homepage appendix's line, for a paper
  whose line quotes its numbers; and `thumb`, the index card's picture. TypeScript that quotes a value
  (`profile.ts`'s finding, the line) reads it through `paperValue`, whose key is typed as `VALUES`' keys and
  which also throws on an unknown key (the build strips types unchecked, and a bare `values[key]` would print
  "undefined" with every gate green). They reach the plugins as **options** from `astro.config.mjs`, with the
  records (for `::abstract`), so they are in Astro's config digest and a moved number re-renders the paper.
  Plugin *code* is not in the digest: after editing a plugin, delete `node_modules/.astro/data-store.json`
  before building or the old render is served.

**The syntax** — every construct has a case in `tests/fixtures/papers/simple.md`:

| write | renders |
| --- | --- |
| `::::section[The question]{#question n=1 rail="Question"}` … `::::` | `<section class="sec" id="question">` with `<h2><span class="n">1</span>The question</h2>`. `n` is optional (In brief has none), `rail` defaults to the title, an `aside="…"` follows the title in the heading only. The rail and the phone Contents come from these; the ids are the file's as written, and the page refuses one it writes itself (below). A numbered section opens with its lead, set in full ink. |
| `::abstract` | the record's abstract, verbatim, as `<blockquote class="abstract" cite="<record href>">`; the paragraph after it is the page's note on it. Built as nodes, so it is counted in `bodyWords` and kept whole like the file's text |
| `**The problem.** …` | a run-in head: `<strong>`, set italic in full ink at the body's weight |
| `:t[risk parity]{#rp}` | `<i class="t" data-n="rp">` — a term at first use, the anchor of its note |
| `:::def{for=rp}` `**Risk parity.** …` `:::` | `<aside class="mn def" data-at="rp"><dfn>Risk parity.</dfn> …` — joins the block before it in one `<div class="an">` host, which must hold the term |
| `:::why{for=…}` … `:::` | `<aside class="mn why"><span class="mk">Why it matters.</span> …`; `for` optional on both kinds |
| `:hl[…]` | `<mark class="hl">` — Underline, the one highlight style |
| `::::eq{#eq-4 n=4}` `$$` … `$$` `:::where` … `:::` notes `::::` | `<div class="eq an" id="eq-4">`: the display, its number `(4)` as HTML outside `<math>` (never `\tag`), `<p class="where">`, then its notes. One `$$`, or a `$$ wide` and a `$$ narrow` |
| `:::::thm{#thm-3-1-11}` … `:::::` | `<div class="thm">`, a theorem's frame, its displays inside it; the paragraphs that open it and introduce a display are its heads |
| `:::notation` with a GFM table `\| Symbol \| Meaning \|` `:::` | `<div class="tbl-scroll"><table class="notation">`, each row `<tr data-sym><th scope="row">`. Each row's symbols are found **structurally** in every display's MathML and tagged `class="sym" data-sym` (the matching rules — memberships, families, largest first, never a symbol's own letter — are `rehypePaper.ts`'s doc comments). A row that is only in the prose ends its Symbol cell with `{text-only}`. Rows are keyed by position, so a paper has one `:::notation`, and a second is refused. |
| `:cite[markowitz1952]` | `<a class="cite" href="#ref-markowitz1952">Markowitz, 1952</a>` — one author, two (`Feng and He`), more (`Maillard et al.`) |
| `:v[usd.rl]` | the text of `PAPER_DATA[slug].values['usd.rl']`. **Every quantity the prose prints that comes from data is a `:v`** — a return, a ratio, a count, a date or year of the window, a cost, a turnover. Typed by hand, and only these: a reference to the paper, into it or to the page's own figures (arXiv:2508.11856v1, §4.1, eq. (4), Figure 2); a year that names an event ("the 2020 crash"); a constant of a method or convention (the \$1 a growth figure starts from, the 15 of a "top 15" share, 1.96, 12 months to a year, a basis point); and the paper's own misprint, quoted to correct it (as a `:v` it would print the correction in place of the error). A word that glosses a value beside it ("about a quarter as much") is not a second quantity; where the value is computed, a spec holds the word to it (`tests/paperNumbers.test.ts`). A `$` amount is always `:v` or `\$` — a bare `$` starts maths |
| `$:v[wealth.rl]^{12/67}-1$` | the same value written into the TeX, with `$ % # &` escaped — the one directive that works inside maths. A `:cite`, `:t` or `:hl` there is refused |
| `:::figure{name=wealth n=2}` caption `:::` | `<figure class="fig" id="figure-2">`: `PAPER_DATA[slug].figures.wealth`, then the container's prose as its `<figcaption>`, "Figure 2." before it, and any notes beside it. A drawing that is a `<table>` is a table: `<figure class="tbl" id="table-1">`, its first paragraph the caption above it, "Table 1.", the table in its own scroll box, its other paragraphs `<p class="src">` under it. A drawing that names its own figure writes `FIGURE_NAME` (`lib/paperMarkdown/names.ts`), and the plugin puts the name `n` gives it in its place. Astro's rehype-raw re-serialises the drawing's markup |
| `:::inpaper` `**In the paper:** …` `:::` | `<p class="inpaper">`, the pointer to what the page leaves to the paper |
| `:sup[a]` | `<sup>a</sup>`, a table note's mark |

- **Nesting takes colons.** A container holding another needs more colons than the one inside it: `:::` for a
  note or a where, `::::` for an eq or a section of notes, `:::::` for a section that holds an eq (or a theorem
  that holds one, whose section then takes `::::::`). With as many, the inner fence closes both, silently — so
  the build refuses the traces that leaves (a stray `:::`, a container never closed, content outside a section).
- **Raw HTML is refused**: it stays an opaque `raw` node until Astro's rehype-raw, after every check, and an
  HTML comment would ship.
- **So are a code block and a markdown heading.** Shiki writes a fence's colours as inline styles (a `#24292e`
  slab), and seal red is the only colour on the research routes; a heading without an id gets one slugged by
  Astro after every check, which can repeat a section's. A section's title is its `[label]`.
- **Smartypants runs before the plugins**, so a title from a `[label]` is curled. An attribute is not, so a
  `rail="…"` holding a straight quote, `--` or `...` is refused (write the character), and a reference key is
  joined by single hyphens, since `--` in the `:cite[…]` naming it would become a dash. Smartypants never sees
  maths, so it opens a quote that follows inline maths (`$g$'s` drew as g‘s); `remarkPaper` closes it.
- **Every mistake is reported, by name, and fails the build.** A plugin's throw does not fail it (Astro logs
  it and stores the entry unrendered), so the plugins collect problems into
  `remarkPluginFrontmatter.paperProblems`, and the paper page throws on an entry with no `rendered`, then
  through `checkedReport` (`lib/paperMarkdown/`) on any problem, on an id it writes itself (below) and on a
  render with no report (a file outside `PAPERS_DIR`, the one spelling of the directory, which
  `content.config.ts` loads too). `tests/fixtures/papers/malformed.md` holds one of each mistake a file can
  make, and `tests/paperMarkdown.test.ts` names each. An unknown directive is reported, so a literal colon is
  written `\:`, as in `arXiv\:2508.11856`.
- **A file id the page writes itself fails the build too.** The plugin reports every id the file carries
  (`ids`), and the page refuses any that `paperPageOwns()` (`lib/pageStops.ts`) claims: PAPER_END's `read`,
  `references` and `cite`, `bibtex`, the corner nav's `cnav-list` and every `ref-…`. A `#fragment` and
  `getElementById` find the first element with an id, so `{#bibtex}` would have Copy BibTeX copy a section.
  `tests/distSmoke.test.ts` holds the list to the built page: each id there is the file's or the page's, never
  both and never neither, so an id the layout gains fails by name.
- **The render also reports** `sections` (`{ id, n?, title, rail }`, for the rail and Contents), `errataText`
  (the errata with their `:v` filled in) and `bodyWords` (`countWords` over the body's text, the abstract in
  it, with `math`, `table` and the figures' drawings left out). The reading time counts every word a reader
  reads: `bodyWords` plus the prose the page writes round the file. Each of those strings is built once in
  `pages/research/[slug].astro`'s frontmatter, printed as built and counted from the same value (the page's
  comment there lists them); a new line in the template still has to be added to the count.
  `tests/distSmoke.test.ts` recounts the built page's minutes by that rule, and the plugin's `bodyWords` to
  the word.
- **A line never breaks inside a hyphenated word led by an acronym (RL-BHRP, RNN-based), two capitalised words
  joined (Black-Litterman), a span of years, an ISO date or an arXiv category (q-fin.PM)**: one rule,
  `wholeParts` in `lib/words.ts`. The body's last pass wraps each in `<span class="nw">`, after the words are
  counted; the page's own prose goes through `PaperLine`, and the /research cards' and the homepage's titles
  through the same function. A compound in lower case (risk-parity) may break at its hyphen.
- **The margin notes are placed by the page's script, and held until placed.** Wider than 1100px a note sits
  in the notes column beside its anchor, stacked 16px apart so none overlap (`stackNotes` in
  `lib/paperPage.ts`), re-placed by a ResizeObserver when a webfont lands or the window changes. It is
  `visibility: hidden` until `place()` marks it `.is-placed`, so it first paints where it rests: CLS 0 (the
  viewports measured are in the page's script). The hold is CSS alone, `@media (scripting: enabled)` inside
  the wide layout's query, with a backstop animation that shows every note after `MOTION_LIMIT_MS` if the
  script never runs; without a script every note falls into the column. `tests/motionLimit.test.ts` reads the
  hold, its delay and `place()`'s mark.
- **Inert everywhere else, by construction.** `remarkPaperSyntax` adds remark-directive's syntax only while a
  paper is parsed, so a `:word` or a `:::` line in /writing is never a directive (`remarkPaper.ts`'s header;
  the spec compares a writing file and a file of directive-like text both ways). The one plugin that is not
  paper-only is the MathML letter fix (*Stack*).
- The chain is spelled once, in `lib/paperMarkdown/index.ts`; the spec runs it inside Astro's own order, and
  its header says which rule above keeps each pass it leaves out (smartypants, shiki, heading ids, rehype-raw)
  from reaching what the plugins check.

## Identity & voice (a design constraint)

The hierarchy is deliberate and load-bearing for how the site reads. Keep it:

- **Quant / mathematician first.** Hero headline: **"Quant Researcher · Portfolio Optimization"**, with a
  small mono subline (incoming PhD · University of Toronto · the engineering role) beneath. Software
  engineering is the *second* hat — when it's named, it's a **full-stack SDE/MLE** (more than "a developer"),
  but it never gets promoted above the quant identity.
- **The PhD is incoming** (Operations Research, University of Toronto). State it as incoming — never
  present-tense "PhD student." Honesty over flourish, everywhere on the site.
- **Tagline** (in the hero, under the role line): *"A researcher by day, an artist by night, and a
  mathematician at heart."* Its links to /research and /art are an **easter egg** — real navigation must never
  require a discovery, which is why the corner nav carries the page set at all times.
- The art avocation (guqin + Chinese/English calligraphy) is real and shown on /art, but stays an avocation in
  the framing.
- **/research is papers-only.** A paper is co-authored, dated, citable and has results; a post is one person
  thinking out loud. Filed together, the informal writing borrows the paper's authority. That's why /writing
  is its own route.
- **The appendix is not a résumé.** A résumé lists credentials and claims authorization; the Work slide lists
  **artefacts** and where to read them. Every row is something a reader can go and check.

All résumé content lives in `src/data/profile.ts` — editing the site's facts means editing data, never
components.

## The hero — math-generative terrain

A 3D dotted optimization landscape (Gaussian-mixture loss field) rendered to a full-bleed hero `<canvas>` in
**Heights**, colored by height (ochre valleys → indigo peaks), breathing gently, with occasional
gradient-descent "walkers" flowing downhill into local minima as fading comet trails — "The Descent" made
literal. A rare Easter-egg pill at a settled optimum shows typeset math (∇f = 0, the stationarity condition)
or "Moo!".

- Code: `components/TerrainHero.astro` + pure, unit-tested math in `lib/terrain.ts` (gradient verified against
  finite differences; descent converges to true minima), painted via `lib/terrainRender.ts`, with
  `lib/equations.ts` for build-time KaTeX→MathML.
- **The math must stay honest.** Don't claim quadratic convergence for plain gradient descent; ∇f=0 is the
  unconstrained stationarity condition. The same rule governs the explainer slides and the descent graph.
- Perf: rAF loop paused offscreen (IntersectionObserver) + ~30fps throttle + a **160ms debounced** resize
  (reassigning `cvs.width`/`height` reallocates a full-bleed backing store at DPR 2, and the pending timer is
  cleared in teardown or it fires against a replaced canvas) + DPR≤2; a finished static frame is painted
  first (instant LCP) and is the reduced-motion / no-JS state.

### The first-open intro — "the map becomes the territory"

On a **first open of `/`**, isolines of the same `field()` stroke onto a flat plane, the surface rises out of
the map carrying them into the terrain, and the dots resolve as the lines fade: **5200ms**, landing byte-exact
on the hero's rest frame. No click, no overlay. Design doc:
`docs/superpowers/specs/2026-11-01-intro-animation-design.md` (local; `docs/` is gitignored).

**Four beats in order, the owner's correction of a fused version** (*"give it a clear phase to draw the
background. then we draw the line, and so on"*): ground 0–0.20 (the sky resolves from one flat tone to its
gradient, alone), lines 0.17–0.62, relief 0.52–0.90, dots 0.62–0.96, the lines leaving 0.74–0.97. They
overlap so there is no dead air. `INTRO_PHASES` in `lib/introTimeline.ts` holds the fractions and its header
the why; `tests/introTimeline.test.ts` fails on a quiet 150ms window or a beat out of order.

- **Beat 1 is the sky**: `introFrame(t).sky` scales FluidSky's `uFlatten`; at 1 the shader resolves to one
  colour from its own ramp, the same as the no-WebGL `--descent-grad` state.
- **THE CAMERA NEVER MOVES.** Only `z = field(x, y) * lift` animates, with one global `lift` per frame; an
  animated `YAW`/`TILT` would invalidate the EDL shade and the depth sort. The EDL shade is not camera-only:
  `computeEDL` uses the finished geometry, so it is exact only at `lift === 1`, and the rising plane wears the
  finished relief's shade (accepted: it reads as a shaded-relief map, and the landing frame is byte-exact).
- **Decided in an `is:inline` script at the top of `pages/index.astro`, before first paint.** A bundled
  script runs after paint, and the sky went warm → flat → warm (*"renders to our normal stuff and suddenly
  goes blank"*); `is:inline` is Astro's answer to that, not a limitation. `define:vars` passes lib/'s
  constants, so only the decision expression is duplicated, and `lib/introSession.ts` reads what the script
  publishes on `<html>`: one decider, and no race with FluidSky's synchronous first draw.
  `tests/distSmoke.test.ts` asserts the shipped constants and that the script precedes the canvas. **Assert
  the policy where it ships**: a parallel implementation kept alive to host assertions is a green suite over
  code nothing runs, worse than no test.
- `paintTerrain` takes an optional `lift` (default 1); the dot fade-in rides on `ctx.globalAlpha`, and the
  survey is its own stroke pass. The `t=1` landing is an assertion: the live breath ramp is only the right
  continuation if the intro finished where the static frame is.
- **Contours are a perf decision:** 9 levels at res 74 is 10.0ms median (21.0ms at res 110, 47.1ms at res
  150), memoised in one unkeyed slot. **There is no time budget**: a stopwatch read 57.1ms on a 2-vCPU runner
  against ~11ms locally. `tests/terrainContours.test.ts` pins 9 and 74 and bounds `levels × (res+1)²` under
  55,000 (res 150 gives 205,209), deterministically; the arc behind that is in the spec.
- **Do not "optimise" the stitch in `marchingSquares.ts`**: hashed bucketing measured slower (10.9 vs 10.0ms)
  and split 13 polylines into 32. It must take the NEAREST segment (a circle at res 60 is one run of 124
  points, not `[50, 7, 63, 3, 2, 2, 2, 3]`).
- **The hero text is NOT part of it**: it keeps its own arrival (`.hero-rise` 1400/0, `.hero-bio` 1400/250,
  `.hero-doors-line` 1100/620; the tagline has its own beat, and `Heights.astro` says why). The H1 is `/`'s
  measured LCP element. The survey pass is guarded on `survey > 0` and the dots on `dots > 0.004`, so the
  first frame skips 10.6ms of contour work (it cost LCP +12ms unguarded). If the text is ever folded in, the
  duration comes down with it (*Rejected*, `?seq=1`).
- **Walkers wait until it lands** (`animate: false`, `nextSpawnAt` re-seeded 600ms after): they are projected
  at full elevation and know nothing about `lift`. **An unseen intro is consumed, not deferred** (a restored
  scroll or the deck carrying the reader off): it never plays later in front of someone reading. **It runs
  unthrottled**, unlike the live loop's 33ms (*The fluid sky*: smoothness is cadence).
- **Session key** `descent.intro.seen.v1`, **set at START**, so reloads do not replay it; bump the suffix to
  re-show a changed animation mid-session. A storage throw (private mode) means *play it*, never *break the
  hero*.
- **Tuning is a URL parameter**: `?intro=1` replays past the flag; `?dur=3000` overrides the duration, clamped
  to 400–20000, and an unparseable value gives the default (`elapsed / 0` would paint a blank hero). Phase
  boundaries are fractions, so retuning is one number. Neither is in any link or the sitemap
  (`tests/distSmoke.test.ts`). Judge timing on the real page: the mockups predicted ~3000ms, and the page said
  5200.
- `tests/distSmoke.test.ts` pins `data-intro` to `/` and nowhere else; moving this component, or BaseLayout
  growing its own copy, would hand the animation to every route.

## The fluid sky

`components/FluidSky.astro` is the sky on five routes: `/`, `/writing`, `/writing/<slug>`, `/experience` and the
404. The register pages (`/projects`, both research routes and /art) render neither it nor `SkyWash`: each
register's ink is sized for its own ground (light drafting `--ink-3` over `--reading-grad` measured 3.89:1), and
the paper register is a still sheet by design. A WebGL canvas: a two-level domain warp over the descent/reading
ramps, sampled from scroll position, with viscous luminance banding and a warm bloom. `lib/skyShader.ts` holds the
GLSL, `lib/skyPalette.ts` the ramps, `lib/skyLegibility.ts` the **contrast policy** that keeps text readable over
it. Two archetypes: `descent` (paper text; the dangerous direction is lighter) and `reading` (dark ink on a
luminous field; dangerous is darker). Every page starts at the top of the pattern: the shader samples it from
`scrollY / vw` alone, and the component takes `variant`, nothing else (its warp amplitude follows it).

Two invariants, both about the compositor:

1. **The canvas is OPAQUE, with no `mix-blend-mode`.** A blended full-screen layer makes the compositor
   re-read the page backdrop every frame, which defeats layer caching for the whole document.
2. **`.fluid-live` must never outlive a visible canvas.** CSS hides the canvas under 640px, and the class is
   also dropped on resize-to-hidden and on GL context loss.

Perf: viewport-sized (scroll is a uniform), half internal resolution, ~30fps idle and **every rAF tick while
scrolling**, paused on tab-hide, skipped on phones. The CSS `--descent-grad` gradient stays underneath as the
base and the no-WebGL state.

**THE SCROLLING BUDGET IS 0. DO NOT "OPTIMISE" IT.** A 16ms cap halved the draws and made `/` and `/art`
*"stucky as hell"*: a half-rate background under full-rate content reads as the background dragging, worst on
the 120 Hz panels it was meant to help. Headless Chrome caps at 60 Hz, so only real hardware shows it (a
synthesized 2400px scroll on the capped build traced 60.2 fps and 2 dropped frames, like the good one). If it
must cost less, spend on internal resolution or shader work per draw, never on cadence.

## Themes (light ⇄ dark)

Two themes, driven by `html[data-theme]` (absent = light, `'dark'` = terminal galaxy). The whole system is
**token override**, not per-component branching:

- **How it flips:** `tokens.css` defines the palette in `:root` (light) and re-declares it under
  `html[data-theme='dark']`. `global.css` `@theme` maps `--color-*` → those tokens, so **every Tailwind utility
  and hand-written `var(--ink-*)` re-themes for free**. Only redefine a surface explicitly when it hardcodes a
  color a token can't reach.
- **Role tokens that must NOT flip with the ink ramp:** `--bg` (the page base behind the sky — always dark,
  never flashes bright, **except under a page register**, whose `--bg` is its sheet), `--on-accent` (dark ink
  for text ON the accent chip — the accent is a light color in both themes) and `--descent-grad` (the whole
  sky, redefined wholesale per theme).
- **A page can override the ROLE tokens, per theme, from `html[data-page]`** (BaseLayout's `page` prop). Two
  registers do: `page="drafting"` (/projects) and `page="paper"` (both research routes, and /art, which borrows
  it). Each has two blocks in `tokens.css`, `html[data-page='…']` and `…[data-theme='dark']`, that re-declare
  `--paper`, the ink ramp, `--ochre` (→ the seal), `--on-accent`, `--hairline-rgb` and `--bg` (= the sheet, so
  the body and overscroll show paper), plus the register's own tokens. That is how the shared nav, rail,
  button anatomy and cow reskin with no edit. **Both theme blocks declare every token**: `[data-page]` and
  `[data-theme='dark']` tie on specificity, so a light-only value would win in dark. The role tokens a register
  must declare are one list, `ROLE_TOKENS` in `tests/helpers/palette.ts`, which both palette specs read. The
  homepage's `page="deck"` is not a register: its two blocks declare only `--rail-ink` and `--rail-focus`
  (`tests/deckPalette.test.ts`; *Navigation*).
  - **drafting** adds `--knockout` (the label knockout, one 1px ring of the bare sheet that `<main>`'s text
    and `SideRail`'s labels both read — the rail with a `none` fallback, so the page never styles the rail),
    `--rail-dash-halo` (the rail dash's 2px ring) and eight `--draft-*` tokens.
    `tests/draftingPalette.test.ts` checks that the two sets match and the inks clear AA.
  - **paper** adds eight `--sheet-*` tokens, each glossed in `tokens.css`'s paper header. The ground is
    `--sheet-ground`, never `--paper`, which in the dark convention is the light text colour; the band of runs
    and the grid are **exempt from 3:1 by name**, every value they help read being text. It needs no knockout:
    nothing strokes under its text, so the rail reads its `none` fallbacks. `tests/paperPalette.test.ts` holds
    the numbers, exemptions included, and that the research pages' own CSS and /art's never paint a ground
    with `--paper`.
- **Surfaces that can't inherit CSS tokens** (handled per theme by hand): the **terrain canvas**
  (`TerrainHero.astro` picks a `TerrainRamp` + walker palette off `data-theme`; dark is the cyan-blue
  **"Glacier"** ramp, `TERRAIN_TERMINAL` in `lib/terrain.ts` — not green, which is the sky's and the accent's),
  the **fluid sky** (`skyPalette`/`skyShader` switch to a phosphor nebula with stars behind the line), the
  **SkyWash** + `.descent::before/::after` washes (raw rgba; dark hides SkyWash outright, as its light strokes
  are a lift on the night ground that 8 bits band into rings — the dark intro's "two big bubbles" — and hides
  `::before`, whose green haze read as a glow round the nav, keeping only `::after`'s fog), the **hero
  legibility halo** (a paper lift in light; in dark a band on a phone and nothing on a desktop, where its `--bg`
  oval drew a ringed blob behind the name on the intro's near-flat first beat, and the light text clears AA
  without it once the identity line drops its `/90` there; `Heights.astro` has the numbers), the **homepage
  panels' paper ground** (`styles/slides.css`, per theme) and the **corner-nav glass** (forced dark-frost in
  dark). The research routes' figures are not among them: their SVG is drawn from CSS classes that read the
  paper tokens. `tests/distSmoke.test.ts` holds the three dark hides.
- **A theme override never beats an animation of the same property.** Animation declarations outrank normal
  (non-`!important`) ones, so a dark `opacity` on an element whose keyframes animate `opacity` is dead while
  motion is on: SkyWash's dark per-stroke opacities never applied with motion on, from the dark theme's first
  commit; the intro's flat first beat made the result visible. Hide the layer (`display: none`), never override
  the animated value (`tests/distSmoke.test.ts` holds SkyWash to it).
- **Default + persistence:** an inline no-FOUC head script in `BaseLayout` resolves the theme *before first
  paint* — explicit `localStorage.theme` first, else `prefers-color-scheme`. The toggle (a real `<button>` in
  `CornerNav`, sun/moon by action) writes `localStorage`, flips the attribute live, and dispatches
  **`theme:change`** on `document` so the scripts that paint from JS repaint: `TerrainHero`, `DescentPath`,
  `FluidSky`, and on /projects `DraftingField` and `Gallery` (manifold's still and video are per theme).
  **Never re-fire `astro:page-load` for a repaint** — it re-runs every page script's init (a 357ms long task
  on `/`). A new JS-painted surface listens for `theme:change`, with its teardown. It is the only path: no
  surface observes `data-theme` or re-reads it per frame, as the flip and the event are one task.
- **Additive rule (load-bearing):** the dark theme must NEVER degrade the shipped light Descent. Light is the
  base; dark is an override layer. When touching themes, verify BOTH — build breaks and contrast regressions
  hide in the theme you didn't look at.
- All five paper slides share one palette, `.slide-paper` in `styles/slides.css`, and follow the theme (a
  panel dark in both themes read as a bug; *Rejected*).

## Three Astro traps that have each shipped a bug here

1. **Astro scoped styles rewrite selectors with `[data-astro-cid-…]`,** which changes specificity **and what
   the selector can reach.** A scoped rule **cannot** reach markdown rendered by `<Content />`, slotted
   content, nodes a script created at runtime, **or an element declared in a different component** —
   `.prose blockquote` becomes `.prose[cid] blockquote[cid]` and matches nothing, silently. That is why
   `/writing/<slug>`'s prose styles are an `is:global` block nested under `.prose`, and why several component
   rules use `:global(...)`. When a rule "does nothing" and the markup is clearly right, check this first (one
   that shipped: `Heights` dimmed `.terrain-canvas`, which `TerrainHero.astro` declares, and the rule matched
   zero elements on every route).
   - **The cheap check is in `dist`, not in review.** Parse every `X[data-astro-cid-N]` fragment out of
     `dist/_astro/*.css` and assert some element in `dist` carries that hash *and* that tag/class (an attribute
     value may hold a `>`: the terrain canvas's `data-bubbles` and Grain's data-URI style do). It is a tool to
     run, not a test: `Work.astro`'s empty-writing branch never renders while a piece is published, and its
     dead fragments look exactly like a bug.
2. **At equal specificity, SOURCE ORDER decides.** Put an override **after** the rule it overrides. A phone
   override placed above the desktop rule it was meant to beat has shipped here more than once.
3. **`{/* … */}` IS A JSX EXPRESSION, SO WHERE IT GOES IS LOAD-BEARING.** It is legal **between elements** and
   in the frontmatter, **illegal between a component's attributes**, and **not accepted inside a `.map()` arrow
   body** (Astro parses that position as template). The parse error points at the element, not the comment. A
   note about an attribute goes above the element or in the frontmatter. In a template `<!-- … -->` ships and
   `{/* … */}` does not (`tests/distSmoke.test.ts` fails on an HTML comment in any built page).
   - Read typecheck's `Result (N files): - N errors` line, never a grep for "error ts": Astro colourises its
     output, ANSI escapes sit between the words, and the grep reads 0 forever.

Related: `scroll-margin-top` is only honoured by `scrollIntoView()`. The deck moves with `window.scrollTo()`,
so the rule did nothing and panel titles rested hard against the browser chrome. The air above a panel title
is the panel's own `padding-top` (`global.css`), not a deck stop lifted above the slide, which shows a strip
of sky over a full-bleed panel.

## Conventions

- **Node:** Astro 6 rejects Node 20. Use `nvm use` (`.nvmrc` pins 24) before any npm/npx. CI and the deploy
  workflow's test job read `.nvmrc`; `withastro/action` takes only `node-version`, hardcoded to 24 in
  `deploy.yml`: **edit that line and `.nvmrc` together.**
- **Branch hygiene:** never commit to `main`. Cut `claude/<topic>`, open a PR, squash-merge. Commit messages
  end with the Co-Authored-By trailer.
- **CI is the merge gate.** `.github/workflows/ci.yml` runs **build → typecheck → test** on every PR. **Wait
  for it to go green before merging**, even when local gates passed. It has `workflow_dispatch`
  (`gh workflow run ci.yml --ref <branch>`) for when pushes produce no runs, as in the 2026-08-06 Actions
  incident.
- **Local gates before commit: `npm run build`, `npm run typecheck`, `npm test`.** All three:
  - **`npm run build` is NOT type-checked.** Astro and vitest hand `.ts` to esbuild, which strips annotations
    without asking the compiler; a green build says nothing about types.
  - **`npm run typecheck` is the only type gate**, and it runs **two** checkers because neither covers the
    other: `astro check` is the only thing that reads the `<script>` bodies in `.astro` files,
    and `tsc --noEmit` the only thing that covers `tests/` and `src/lib`. Run it after a build, so the
    content-collection types in `.astro/` exist. `tsconfig.json` excludes `tmp_*` and `.tmp-*`, the ad-hoc
    probes.
  - **The gate is at ZERO, so a red typecheck is yours.** The class that comes back: `ts(18047)/(18049)`
    "possibly null" in `.astro` scripts where the guard is already correct, because TypeScript does not carry
    a `const`'s narrowing into a **hoisted `function` declaration**, only into arrow functions. Alias after
    the guard (`const nav = maybeNav;`), not `!` or a cast.
  - **Types gate the MERGE, tests gate the DEPLOY**: `deploy.yml` runs tests but not typecheck, because a type
    error cannot change the shipped bytes, and blocking a deploy on it would leave the live site stale.
- **`vitest` runs with `passWithNoTests: false`**: a mistake in the `include` glob would otherwise collect zero
  files and exit 0, every required check green with the net switched off.
- **Verify visually, not just by build.** Art/layout/animation must be SEEN, and small-detail screenshots are
  unjudgeable — put the options *in the live page* as a switcher and look (a `/proto-*` route; *Routes*). When
  a browser is needed: `npm run build` → `npm run preview` → drive **one** headless Chrome over CDP →
  screenshot at scroll positions → look → refine. For faint issues, contrast-stretch the screenshot or toggle
  layers off and diff — single-column pixel math misleads. Helper scripts are ad-hoc; recreate as needed.
  - **One browser at a time, never a fleet**: a parallel fleet took the owner's machine down. If a task
    forbids browsers, `npm run build` plus reading `dist/` with grep is the verification path.
  - **rAF and screencast cannot measure fps**, and extent probes must skip `position: fixed` elements (the
    descent veil lies about page height).
- **Lighthouse bar:** Perf ≥99 / A11y 100 / Best-practices 100 / SEO 100. Don't regress a11y: there's a
  `<main>` landmark; nav is real `<button>`/`<a>`; decorative canvases, rails and the cow bubble are
  `aria-hidden` or labeled.
  - **A11y 100 does not test WCAG 1.4.13** (content on hover or focus), and neither does axe. A tip that covers
    text must be dismissible and hoverable: the paper page's two (Figure 2's readout, a symbol's Notation row)
    go on Escape, without the pointer or the focus moving, and stay while the pointer crosses onto them (a
    shown tip takes the pointer, and a bridge spans its gap; `tests/distSmoke.test.ts` reads both in the
    built CSS).
- **Pure logic is tested.** Anything non-trivial in `lib/` gets a vitest spec, and so does every *invariant
  between two files* (`nav.test.ts`: every page is a nav href; `writingContent.test.ts`: the schema enum
  matches `KINDS`; `pageStops.test.ts`: no stop points at an id the page won't emit; `viewport.test.ts`: the
  breakpoint still says 640; `artSizes.test.ts`: the three `sizes` hints still describe the layout that
  decides them). They are where "two places must agree" is actually enforced.
  - **`commentPaths.test.ts` holds comments to it**: a comment may not claim a path is HERE when it is not.
    `astro check` and `tsc` do not read comments, and comments here are load-bearing by policy, so they rot
    silently on every delete. A deletion marker near the mention passes, because deletions are written down on
    purpose. No gate catches a false claim about LIVE code; that half is careful reading.
- **A TEST IS NOT A CONSUMER.** `noUnusedLocals` cannot see a dead export, so `lib/` grows functions whose only
  caller is their own spec, and the spec makes them look alive (two sweeps removed ~1,070 lines). Delete an
  export only when nothing in `src` calls it.
  - **Trace the call graph from what `src` imports**, not from each export's name: a `\bname\b` grep over
    comment-stripped `src/**/*.{ts,astro}` (counting `src` and `tests` separately; `tsc` is blind to this)
    misses an export whose only caller is a dead sibling in its own file. An import is not a read either: a
    field handed to a page that never reads it keeps its module alive.
  - **Read each hit** (a test's local `const phases` is not `trajectory.phases()`), and match a function body
    from the brace last on its line (a multi-line signature holding an inline object type balances to zero
    inside the signature).
  - **Re-point a spec before deleting what it tests, if it is the only guard on something live.** The Story
    slide's *"a deeper basin is now visible — it was there the whole time"* was asserted against a dead model
    (which found the basin at a different stop); it now walks the page's own path via `trailSampler()` in
    `lib/descentPath.ts`.
  - **The exception: a function written so a test can assert an invariant on live data** stays, and says so
    in its doc comment (`sumsToWhole`, `bellmanResidual`, `contrastRatio`, `luminance01`, `inBounds`, and
    `trajectoryFacts`' measured fields). Deleting one removes a check, not dead code. **If you add one,
    document why in the declaration.** A test that console-logs a table for a human, a "printer", is not an
    exception: if a cost is worth watching, assert a budget on a function production calls.

## Taste rules (these define the look — hold the line)

- **Palette discipline:** the shared palette is the tokens in `tokens.css` (paper, ink-1..5, ochre, indigo,
  seal, plus the derived `--hairline-rgb` and `--rule`); under a page register, its own tokens and its overrides
  of the role tokens (/projects' eight `--draft-*` and two knockouts, the research routes' eight `--sheet-*`;
  *Themes*); and on `/`, which is not a register, `--rail-ink` and `--rail-focus` (*Navigation*), the six
  `--panel-*` of `styles/slides.css` (the five paper panels' ground and inks per theme), Choice's chart colours
  `--c-h*` and `--c-p*`, and Story's two graph-line tones, `--story-line` and `--story-line-soft`. /art's dark
  room, dark in both themes, holds its own inks (`--room*` on `.dark`), held by `tests/paperPalette.test.ts`. Beyond
  those, a component may hold a literal for a drawing of its own (the cow's coat, /experience's timeline dots).
  - **An undeclared `var()` voids the whole shorthand** (every longhand falls back to its initial, and
    `border-style`'s is `none`): /experience's dividers never drew against an undefined `--rule`, which is now
    `rgba(var(--hairline-rgb), 0.32)`. `tests/cssVars.test.ts` fails on any `var(--x)` without a fallback that
    nothing declares, reading stylesheets, inline `style="--l:0"` attributes and runtime
    `el.style.setProperty()` (`sections/Rules.astro` sets `--len` and `--i`). Nothing else catches it: the
    build accepts it, `astro check` and `tsc` do not read CSS, and a missing border looks like a design choice.
  - In the **light** theme the vermilion **seal** (`--seal #b23a2e`) is the ONLY saturated color. Never pure
    `#fff` / `#f00`. **Deliberate exception — the dark theme**, the "terminal galaxy", swaps the ochre accent
    for a phosphor **emerald** (`--ochre: #66c28c`) on purpose, because the terminal/coder identity is the point
    of dark mode (the owner chose it seeing both this and a "night descent" variant live). Do NOT "fix" it back
    to ochre. Seal red stays the brand colour in both themes (`--seal`, brightened to `#e0574a` on the dark
    ground). The IT seal itself is drawn on no page; it is the favicon and the OG card.
  - **The registers have no emerald**: /projects' palette and the paper one (the research routes and /art) set
    `--ochre` to the seal in both themes, so seal red is the only saturated colour on them in dark too.
- **Motion:** animate only `transform` / `opacity`; NEVER animate `filter: blur` (bake it). ALL motion is gated
  behind `@media (prefers-reduced-motion: no-preference)` via `lib/motion.ts`. The no-motion state must look
  *finished* — it's also the Firefox fallback (`animation-timeline` isn't in Firefox yet), and what a
  reduced-motion reader gets instead of the deck.
  - **Nothing new that moves on its own runs past five seconds** — WCAG 2.2.2 (Level A), which neither
    Lighthouse nor axe tests. The limit is `MOTION_LIMIT_MS` in `lib/motion.ts`. On /projects the idle
    prompt's cursor blinks four times (4.2s from when it appears) and rests solid
    (`tests/motionLimit.test.ts` reads its CSS literals against the limit); manifold's MP4 plays for the first
    five seconds after the fan opens, then rests on its frame and plays again while its card is hovered or
    keyboard-focused (`videoPlays()` in `lib/galleryLayout.ts`); and the cow says the greeting and at most
    `idleLines()` unprompted lines per page view (`lib/cowTalk.ts`: two, none on a phone or under reduced
    motion), the rest a press away. `tests/cowTalk.test.ts` adds up what it does unasked from PlushCow's
    transition and hop literals and `TYPE_MS`, ~3.4s, and holds it under the limit.
  - **The research routes and the rail are held to it, and to 2s per animation.** What moves there unasked
    moves once per showing (on `/` the rail's entrance replays each time the rail reappears below the hero),
    by `transform` and `opacity` (the rail's entrance in CSS, the rest through `scripts/motion.ts`), and ends
    within 2s (`MOVE_MAX`). `tests/motionTiming.test.ts` holds each single duration to it, and each staggered
    batch as it is computed: the rail's entrance (`stagger` over `RAIL`, every row in by `RAIL.enter`), the
    paper page's highlights and a figure's arrows (`highlightDelay`, `arrowDelay`: the last ends within
    `MOVE_MAX` of the first's start, however many), and the reveal, whose `REVEAL.max` caps any one delay. Not
    held: the /research cards' title underlines, `--k` lines × `CARD.underlineStep` in CSS, within 2s up to a
    title of sixteen lines (the titles have two or three), and the time a highlight waits for its block to
    rise. Nothing on the screen the reader lands on is held back, nor anything above it (a deep link, a
    restored scroll), and what waits runs at the latest after `MOTION_LIMIT_MS` on screen. Under reduced
    motion each is its finished state at once.
  - **Everything older is not held to it yet, and this is the list known, not a guarantee**: the hero
    terrain, the fluid sky, the drafting field, SkyWash's three breathe loops (light theme only) and the
    `.descent::before/::after` drifts (`::before`'s light only) run for as long as they are on screen; `/`'s `.scroll-cue` bobs forever in the foreground
    (`Heights.astro`); and the three explainer slides (Choice, Rules, Solve) cycle their beats for as long as
    the slide is on screen, until a beat is clicked (`scripts/beats.ts`). That is the site's older pattern and
    a known gap against 2.2.2, not a precedent for new motion in the reading area.
- **Loading states are designed, not default.** No bare grey rectangles — a slow card in /projects' `Gallery`
  uses a palette-tone placeholder with a transform-only shimmer, gone the instant the image decodes. /art's
  placeholder is the mat itself.
- **Pixel art has no curves.** The cow's speech bubble is built from one number (a 10px cell, the owner's pick
  of two mocks): border thickness, the MOO glyph and the tail's steps all measure exactly one cell. That is
  what makes it read as pixel art rather than as a rounded chat bubble with a blocky font. `MOO!` is *type*,
  drawn from a matrix in `data/cowGlyph.ts`.
- **Favicons:** the browser tab uses the SVG seal; Google Search renders a *raster* favicon, so PNG fallbacks
  (48/32/180/192/512) + a webmanifest + `og:image` ship from `public/`. Regenerate them from `favicon.svg` if
  the seal changes (sharp rasterizes SVG→PNG).
- **`public/`** (`ls public` is the inventory) holds two files that surprise: `google39d8e886995c3420.html`, a
  Search Console verification file — not junk — and `sitemap.xml`, a static `<sitemapindex>` whose one `<loc>`
  is the generated `sitemap-0.xml`, so the conventional name resolves too. `@astrojs/sitemap` emits
  `sitemap-index.xml` + `sitemap-0.xml`, and `sitemap-0.xml` lists every route but `/404` and the `/proto-`
  ones, so a route change never touches the static file; what would break it is the child's name changing,
  and `tests/distSmoke.test.ts` reads both. `public/projects/` holds manifold's two screensaver MP4s, written
  by `tools/vendor-projects.mjs` (a video is served by URL, not through `astro:assets`).
  - `og-card.png` is **2400×1260**, while `BaseLayout` declares `og:image:width` 1200 and `height` 630.
    Tracked in issue #67.

## Rejected — do not rebuild

Each of these was built, looked at, and turned down:

- **Pointer/mouse interaction on the hero** — built and rejected 2026-08-06.
- **A phone-specific content design** — built three times, reverted every time. Phone content stays in sync
  with desktop; see *Phones*.
- **CSS scroll-snap for the deck** — measured stuck; see *The deck*.
- **Five showpieces** for the explainer slides, three of them hand-drawn props — each "looked like it meant
  something without meaning anything". The replacement rule: the surface has to be real math, computed.
- **The feasible polygon and the decision lattice** in the Rules slide — exact, unit-tested, and *still wrong
  for the slide*: both answer "what is the feasible set", a question a reader who has never been told no does
  not yet have, and both shrink something on a slide whose job is that the problem grows.
- **A dark panel for emphasis** in the light theme — read as a bug, not emphasis.
- **A first-visit gate** before the hero — built twice, rejected twice (as a design, then as "still boring"),
  for blocking the page behind a button and for being decorative. The first-open intro replaced it.
- **The other first-beat sky levers** — ramping the warp amplitude (`uAmp`: imperceptible, as it moves the
  warp's texture, not the sky's colours), drifting the pattern into place, and fading the `SkyWash` layer.
  Compared live against `uFlatten` and deleted, not left behind a flag.
- **The `?seq=1` spike, holding the hero text until the intro lands** — from the owner's note that text and terrain
  compete for attention. It paused the H1, `/`'s LCP element, and moved LCP from ~450ms to the intro's end,
  against the Perf ≥99 bar. If the sequencing is wanted, shorten the intro; do not pause the LCP.
- **The scripted terminal** — the site's only React island, deleted on the owner's instruction ("you can delete
  the terminal at the bottom, it's already useless"). Its data, engine and spec went with it; git holds them.
- **A factor model of the person** — `r_TIAN = α + Σ β_k f_k + ε`, its betas from LLM-scored evidence for
  every `profile.ts` item, then breadth statistics (HHI, effective dimensions) over the same scores. The framing
  was rejected (a return implies a P&L a person does not have), no page showed a number, and every
  `profile.ts` title edit forced a re-scoring. Deleted on the owner's instruction ("delete them"):
  `lib/factorModel.ts`, `lib/capability.ts`, `lib/signalRubric.ts`, `data/signalWeights.ts` and their specs;
  git holds them.
- **The /proto-sketches gallery** — five still SVG candidates for the bottom of the homepage, a slot the
  explainer slides and Story filled. DescentPath and Story's type came out of it; the route and its harness
  were retired ("Retire it"). Its still-frame gate stays, in *Stack*.

**From the /projects redesign.** Built in its design mockups rather than in the repo, so git does not hold
them; the design doc (`docs/superpowers/specs/2026-11-02-projects-page-design.md`, local) is the record:

- **A sweeping light across the background** — a moving horizontal band; it competes with the reading. After
  the boot's two pings the field does nothing but drift, "so that readers can read quietly".
- **The "blueprint" (blue) and "phosphor" (green) backgrounds** — colour variants of the drafting field. Seal
  red is the only colour on the page, in both themes.
- **The cursor-dent field** — isolines that dented around the pointer. It lagged on the owner's machine, and a
  cursor-driven background competes with the reading.
- **The liquid-metal button** — a WebGL shader; its swirls echoed the contour background, so the button read as
  part of the field.
- **Brushed steel as a site-wide button** — liked, but "not applicable to other pages", and weak on paper.
  Buttons are page-own instead (*The concept*), so a page that wants steel can have it as its own skin.
- **Boot A** — the first approved boot, which held the gallery and the listing invisible until ~3.2s. Measured
  in the mockup at Lighthouse's desktop size: **LCP 3,192ms**, because Chrome does not count the banner or the
  gallery fading in, so the listing's last line became the largest element. Boot B paints the banner and the
  gallery on the first frame and measured **108ms** there. The rule it leaves: nothing the reader came for
  starts invisible — the same arithmetic as `?seq=1` above.

**From the /art redesign** (2026-11-07; the record is `docs/superpowers/specs/2026-11-07-art-page-design.md`,
local):

- **A globe of photo stacks pinned to places** — the first prototype's index: "the globe might be an
  overkill." The Met's site became the model, and one sentence the index.
- **A "best photos" carousel, hover descriptions and a contact sheet** — app-like, where the page is a quiet
  room: a work is seen whole, and its words are in its label.
- **The sky on /art** — FluidSky, SkyWash and the page-load veil, each motion that runs on its own: the works
  "should be seen silently".
