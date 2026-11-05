# ingtian.github.io — engineering & design guide

A personal portfolio for **Ing Tian (Zeying Tian)**. Live at
**https://ingtian.github.io**. This file is the working agreement for anyone —
human or AI — building on the site: how it's put together, the taste it holds
to, and the rules that keep it coherent.

**This file is load-bearing, so it has to be true.** It has gone stale twice, and
both times the same way. First it documented a React island, a terminal and a data
file that had all been deleted, and said nothing about the deck, the phone gate or
the writing collection — most of what a change now touches. Then a delete-heavy
refactor took out `three`, `lib/fanScene.ts`, `FactorFan.astro`,
`sections/Mountains.astro` and three of the four `/proto-*` routes, and this file
kept describing all of them — including an explicit **"keep it that way"** about a
dependency that no longer existed, and a route table listing twelve pages when the
build printed nine. An agent reading a stale guide edits the files the guide names
and not the ones that exist; three live defects this month came out of exactly that.

So: if you change something this file describes, change this file in the same commit.
If you find a claim here that the code contradicts, **the code is the truth** — fix
the line, and say what is true rather than only deleting the false part. And when a
paragraph names a file, `ls` it. A pass over every backticked path in this file takes
one script and finds the dead ones in seconds; doing it by eye is how they survive.

## The concept — "The Descent"

A vertical scroll *down* through one continuous "Monet sky" (luminous dawn paper
→ warm ochre → lavender → indigo dusk → grey ink → near-black ground). You don't
navigate between sections — you descend through the sky. Swiss-minimal structure
carries the weight; the sky, the math-generative terrain hero, and one editorial
tagline carry the soul.

The homepage is the descent. Around it are the **reading pages** — /writing,
/writing/&lt;slug&gt;, /experience — the **research routes** (/research and
/research/&lt;slug&gt;), **/projects**, and **/art**, a quiet museum room for calligraphy and
photography. Every route except /projects and the two research routes rides the same sky,
and the reading pages deliberately share one margin, one measure and one back-link
treatment: pages that each guessed their own layout would read as several sites.
Borrow composition from the neighbouring page rather than inventing it.

**A page may have a register of its own, and two do.** The rule, in the owner's words, for
each page's own pass: **research serious, academic; art imaginative, romantic; writing
imaginative, fun, casual, stylish** — and /projects *"techy… pure tech and engineering."*
/projects and the research routes have had their passes; /art and /writing have not, and
until a page gets its pass it keeps the current look.
- **/projects, the drafting register** (`page="drafting"`). It left the shared sky for a
  drafting sheet — isolines of a drifting Gaussian-mixture field, ticks and probe readouts,
  seal red the only colour (`components/projects/DraftingField.astro`) — and has its own
  measure (a 1500px main, the rail's column on the left and, from 1180px, the cow's on the
  right).
- **The research routes, the paper register** (`page="paper"`). A still sheet with no sky
  and no SkyWash — warm paper in light, near-black in dark, seal red the only colour in both
  — set like a paper: a Georgia body (18px, growing to 19px by 1780px) on a ~77-character line,
  numbered section heads, margin notes, booktabs tables, hairline rules, ink for structure.
  Its measure is `styles/paper.css`'s, which both routes import: a reading column (`--M`,
  604 → 664px between 1100 and 1780px) and a notes column (`--N`) a gap (`--G`) apart,
  centred in the space right of the rail; an index card spans both. No page-load veil on
  either route: it would replay on every card click and every "← all research".

**What keeps them one site is shared components, not a shared background.** Two kinds,
and which kind a component is decides how a page may change it:
- **Shared, as is: the corner nav, the rail and the back link.** `CornerNav` and
  `SideRail` are components; the back link is a treatment each page writes the same way
  (`<a class="back">`, 12px mono in `--ink-3`). A page does not restyle any of them.
  A register reskins them without an edit: its `html[data-page='drafting']` or
  `html[data-page='paper']` block in `tokens.css` overrides the *role* tokens (`--paper`,
  the ink ramp, `--ochre` → the seal), so the nav's dot, pill and focus ring turn seal red
  there by reading the same variable they read everywhere. The homepage is no register, but
  its `html[data-page='deck']` block sets the two tokens the rail needs there, `--rail-ink`
  and `--rail-focus` (see *Navigation*). A change to one of these is a change to every page.
- **Page-own: buttons.** One anatomy, a skin per page. `components/Button.astro` owns
  the size, label, arrow, press, focus ring and the `<a>`/`<button>` behaviour; a page's
  look is a `skin` value plus one `.btn--<skin>` block. The skins today are
  /projects' **sticker** (a slight tilt, a 1.5px ink edge, a hard 4px offset plate in
  the accent) and the research routes' **paper** (a hairline box in the sheet's own ground,
  the paper page's Copy BibTeX). A new page **adds a skin, not a new button.** A skin obeys the motion rule:
  the sticker's plate moves by `transform`, not `box-shadow` (`Button.astro` says how).

**Restraint is the aesthetic.** Text is English-only — the literati feel comes
from composition and negative space, never from displayed CJK glyphs. The lone
exceptions are deliberate math glyphs (∇/λ/μ), rendered as build-time MathML.
**The rule governs TEXT, not pictures of the owner's works:** a capture of a work keeps
what it shows — the calligraphy on /art, and the two-character motto recorded in
manifold's screensaver on /projects, which `tools/vendor-projects.mjs` once painted out
and now vendors whole. Words the site sets (copy, labels, the cow's lines, the computed
pictures' svg text) stay English, and the tests that hold them say "text".
When in doubt, remove rather than add.

## Stack

- **Astro 6** (static output) + **Tailwind v4** (`@tailwindcss/vite`; tokens via
  `@theme` in `src/styles/global.css`) + TypeScript (strict). Sitemap via
  `@astrojs/sitemap`.
- **NO REACT, AND NO CLIENT FRAMEWORK AT ALL.** This is the single most important
  correction to make to your instincts if you have read an older version of this
  file. The terminal was the site's one island and it is **deleted**; with it went
  `@astrojs/react`, `react`, `react-dom` and both `@types` packages (they had been
  sitting in `dependencies`, reinstalling ~8MB on every `npm ci` for a runtime no
  page loaded). Today: `find src tests -name '*.tsx'` → 0, `grep -rn 'client:' src`
  → 0, and `astro.config.mjs` has no `integrations` entry for a UI framework.
  **Do not add an island.** Everything interactive here is a plain `.astro`
  component with a bundled vanilla `<script>` — see *Interactivity* below. If an
  island ever becomes genuinely necessary, it is `npm i -D @astrojs/react …` (dev
  deps: it's a static build's tooling) plus a deliberate decision recorded here.
- **THERE IS NO 3D LIBRARY, AND THE RUNTIME DEPENDENCY LIST IS FOUR PACKAGES.**
  `dependencies` is `astro`, `@astrojs/sitemap`, `@tailwindcss/vite` and
  `tailwindcss`; everything else — `katex`, `remark-math`, `rehype-katex`,
  `remark-directive`, `unified`, `remark-parse`, `remark-gfm`, `remark-rehype`,
  `rehype-stringify`, `@astrojs/check`, `typescript`, `vitest` — is a devDependency, and only
  output ships. `grep -c three package.json` → 0.
  - **`remark-directive`** is the paper format's syntax (`:t[…]`, `:::def`, `::::eq` — see
    *Papers are files*): the one package it added, plus 9 small ones under it. Raw HTML in the
    `.md` would have needed nothing, but it is opaque to the build-time checks (it stays a `raw`
    node until Astro's rehype-raw runs, after every user plugin), and MDX's `@astrojs/mdx` brings
    an integration, a JSX parser over the prose and, at its latest, Astro 7.
  - **`unified`, `remark-parse`, `remark-gfm`, `remark-rehype`, `rehype-stringify`** are
    declared so `tests/paperMarkdown.test.ts` can run the site's plugins inside the chain
    Astro runs them in, and `unified` also so `remarkPaperSyntax` can take remark-directive's
    syntax from a processor of its own. Astro already installs all five at these versions, so
    declaring them downloads nothing.
  - This bullet used to say the opposite, at length: that `three` was "a real
    dependency", imported once in `lib/fanScene.ts` behind a dynamic `import()` in
    `FactorFan.astro`, code-split into a 483KB chunk for `/proto-showpiece`, and it
    ended with the standing instruction **"keep it that way."** The dependency, both
    files and that route are all deleted, so the line was telling the next agent to
    preserve something that does not exist — which is the exact failure the opening
    paragraph of this file is about.
  - **What is true instead is the site's own answer to wanting 3D: hand-rolled
    projection, and a still frame before a library.** The hero's dotted landscape is
    written out longhand in `lib/terrain.ts` — `project`/`projectRaw` are the camera,
    `normal` and `computeEDL` (eye-dome lighting) are the shading — and painted to an
    ordinary 2D canvas by `lib/terrainRender.ts`; the Solve slide's lattice is
    `lib/bellman.ts`. Both are pure, unit-tested, and cost the bundle nothing a
    library would have cost. And the gate is a rule of its own: *a still frame
    first, in SVG, judged in one look — three.js only after a frame survives being
    looked at.* Four of the five rejected showpieces were only judgeable once
    finished, which is what the cheap gate exists to prevent. So: no island, and no
    3D library either, until a still frame has earned one.
- **Type: four roles, TWO downloaded faces.** `--font-display` is **Georgia** and
  `--font-body` is the **system UI stack** — neither downloads anything.
  `--font-mono` is **JetBrains Mono** and `--font-accent` is **Fraunces**, used
  only on sub-headlines and italic editorial lines. No CJK fonts.
  - Georgia and system-ui are deliberate, not leftovers. A long-standing bug meant
    no webfont had EVER rendered, so the whole design was judged in Georgia + SF;
    when Fraunces finally appeared the owner rejected it on sight ("prod's font is
    better, the current font is kind of weird"). Both role faces are therefore what
    the site has always actually looked like. Keep Georgia for structure.
  - **The two webfonts are LOCAL files** in `src/assets/fonts/`, served through
    `fontProviders.local()`. Do not go back to `fontProviders.google()`: fetching at
    build time made every build depend on Google, and it failed a CI run with a 404
    when they rotated a file hash mid-run — the same failure on a push to `main`
    would silently leave the site stale. Variable fonts, one file per style, with
    `weight` declared as a range. Provider config goes under `options.variants`, not
    at the top level (the schema is strict).
  - They live under their own `--ff-*` variables. Never point `cssVariable` at
    `--font-display`/`-body`/`-mono`: those are the site's role tokens, and that
    collision is what stopped every webfont from loading. Fraunces keeps its
    preload — removing it measured a worse FCP (1956 → 2333ms, both styles preloaded against
    none; see BaseLayout) — but only on a page that shows it, and only the style it shows
    (`preloadAccent`: `/` the normal, `/writing/<slug>` the italic), as each file is a
    high-priority fetch of its own. The one-style preload has not been measured on its own.
- **Math in markdown is typeset at build time.** The markdown chain (spelled once, in
  `lib/paperMarkdown/index.ts`, which `astro.config.mjs` calls) runs
  `remark-math` + `rehype-katex` with **`output: 'mathml'`**, which is the
  load-bearing option: KaTeX's default HTML tree needs `katex.min.css` and ~half a
  megabyte of `KaTeX_*` webfonts, and a third downloaded family is against the font
  rules above. MathML ships as static `<math>` markup — zero client JS, zero CSS,
  zero fonts. `katex` is a **devDependency** and stays one; only its output ships.
  `lib/equations.ts` holds the same guarantee for build-time equations in `.astro`,
  and `tests/equations.test.ts` asserts it.
  - **The MathML letter fix runs on every markdown file**, as `rehypeMathVariants` in
    `lib/mathml.ts` right after rehype-katex: Chrome honours no `mathvariant` but
    "normal", so KaTeX's `\mathcal`/`\mathbb` letters are rewritten as Unicode letters, the
    same table `fixMathVariants` uses for `lib/equations.ts`. One fix, one module: the table's
    keys (`ALPHABETS`) are the only statement of which variants are rewritten, so a bold alphabet
    added there is drawn by both paths at once, and the spec compares the two on each alphabet
    they rewrite. It throws on a letter Unicode has no form for and on any `mathvariant` but
    "normal" it leaves (bold, fraktur and the others it has no alphabet for), naming the TeX, so
    a letter is never drawn plain in silence. A markdown plugin's throw does not fail the build
    by itself (Astro logs it and stores the entry unrendered), so `/writing/<slug>` throws on an
    unrendered entry rather than ship an empty piece.
- `astro:assets` optimizes gallery images (responsive `widths`, **webp, not avif**: nothing in
  `astro.config.mjs` asks for avif, and `dist` holds none). /art's rules follow, each measured; the arithmetic
  is beside the code it sets in `pages/art.astro`: above `photoSizes()`, `calSizes()` and `zoomOf()`, and at
  each gallery's `<Image>`.
  - **Never a native width in `widths`.** The stele's 1727w was a 1342 KB webp on the `fetchpriority="high"`
    LCP image. Calligraphy is `[480, 900, 1200]`, photos `[300, 600, 900]`.
  - **`sizes` matters as much as `widths`, and it comes from the CSS that sizes the element, not from the
    viewport.** A height-capped work renders at most `820 * ar` CSS px (414 for the stele), so DPR 2 takes the
    900w variant (142,128 B), where a `40vw` hint took 1200w (396,030 B). `tests/artSizes.test.ts` holds
    `CAL_MAX_H` to the stylesheet's cap and the photo constants to `artGallery.ts`'s `justifyRows` call and
    `justify.ts`'s final-row slack; `tests/distSmoke.test.ts` weighs the file a browser would choose, reading
    the device px from the shipped `sizes`.
  - **Nothing below the fold is eager.** The photo grid starts ~2,100px down, and its nine eager tiles were
    754,378 of the 896,506 B /art loaded first.
  - **Read an image's size from `getImage()`, never off its `ImageMetadata`.** The import is a Proxy, and
    reading any property of it but `clone` or `fsPath` keeps the original in `dist`. /art's `.width` and
    `.height` reads kept all 44 JPEGs there (40,525,788 B, 55% of a 74.3 MB artifact, referenced by nothing;
    issue #60). Nothing reads one now, so Astro drops every original and `dist` is 33.8 MB;
    `tests/distSmoke.test.ts` fails if any image under `src/assets` ships anything but webp variants. The
    lightbox's source is that same `getImage()` call, a native-pixel webp: it zooms 6×, so the pixels stay.
- `site: 'https://ingtian.github.io'`, no `base` (user site at root).

## Layout

The load-bearing files and what each owns. **Not exhaustive** — `src/lib` in
particular holds a module per piece of real math, and those come and go with the
slides they serve; `ls` beats this list for a full inventory. What is listed here
is what a change is likely to need, and what must not be confused for something
else.

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
  lib/paperMarkdown/{index,remarkPaper,rehypePaper}.ts # the markdown chain (spelled once) + the paper format's compiler and checks — see Papers are files
  lib/paperMarkdown/names.ts        # imports nothing: PAPERS_DIR (content.config.ts reads it from here) and FIGURE_NAME, where a drawing names its own figure
  lib/paperFigures/{wealthFigure,pipelineFigure,metricsTable}.ts # a paper's drawings and Table 1, as HTML strings from its data; a :::figure places and numbers each
  lib/paperPage.ts                  # the paper page's pure half: the prose its frontmatter writes (authorRole, givenFirst, listed, referenceNote, Line + lineText), note stacking, the readout's month, step, point names, spoken line and instructions (readoutLabel)
  components/research/PaperLine.astro # one line of a paper page's own prose: names kept whole (wholeParts), dates as <time>
  lib/wealth.ts                     # the one wealth module: growth of $1, CAGR, drawdown, the band of runs, WealthSeries (the prepared series every picture of a run reads; REPRO is RL-BHRP's), scales and ticks — the paper page's figures and /projects' rl-bhrp picture
  lib/words.ts                      # the one word counter (countWords, readingMinutes) + wholeParts, the one rule for what never breaks across a line ("RL-BHRP")
  lib/dates.ts                      # the one date helper: longDate, monthYear (UTC)
  lib/motionTiming.ts               # the motion module's pure half: every curve (EASE, DRAW, SWEEP, FADE, WITHDRAW) and duration (REVEAL, RAIL, PAPER_PAGE, CARD, MOVE_MAX) the rail and the research routes move by, stagger and the paper page's batches (highlightDelay, arrowDelay), sweepDurations, mergeLines; tests/motionTiming.test.ts holds their CSS literals to it
  scripts/motion.ts                 # THE ONE MOTION MODULE, its DOM half: play, onceSeen, riseOnceSeen, sweepLines — the rail and both research routes; the reduced-motion gate is inside it
  scripts/pageView.ts               # onPageView(selector, init): starts nine scripts right after parse, not at window `load`, handing init its element — /projects' (all but two), SideRail's and both research routes' (see Interactivity)
  scripts/beats.ts                  # walkBeats(selector, setup): the beat walk the three explainer slides share — the timer, freeze on a click or an arrow, the observer at 0.3, the reduced-motion rest, the teardown, astro:page-load; each slide brings its own show, dwells and options. Its pure half, arrowBeat (the key map), is lib/beats.ts
  data/papers/{index,rl-bhrp}.ts    # PAPER_DATA (values, figures, the homepage line, thumb); RL-BHRP's Table 2, window, reproduction series, and VALUES — every figure its prose prints, as the string it prints (a :v reads one; TypeScript reads one through paperValue, whose key is typed as VALUES' keys and which also throws on an unknown one)
  lib/mathml.ts                     # the one MathML letter fix: fixMathVariants for lib/equations.ts, rehypeMathVariants for every .md
  data/profile.ts                   # ALL résumé content: name, roles, rolesSub, phd, bio, researchInterests, timeline, publications, projects + inProgress, awards, contact
  data/nav.ts                       # PAGES — the canonical page set (see Navigation)
  data/writing.ts                   # the writing TAXONOMY (KINDS) + buildKinds(), the one seam to the markdown
  data/artworks.ts                  # gallery: calligraphy entries + globbed photos (+ photoNotes.ts for per-photo copy)
  data/{define,desk,making,story}.ts                       # the homepage explainer's copy + numbers, per slide
  data/{cowGlyph,ruleGlyphs,tickerGlyphs}.ts # pixel-art matrices: the cow's and the slides'
  lib/deck.ts                       # pure deck stops: WHERE the homepage scroll may rest, and what's next — unit-tested
  lib/pageStops.ts                  # pure Stop trees: one tree per page drives BOTH its rail and its section ids — unit-tested; + fragmentId, the one decode of a URL fragment
  lib/viewport.ts                   # PHONE_MAX_WIDTH = 640, its PHONE_QUERY + isPhone() — the one phone gate; WIDE_QUERY, the wide layout past 1100px
  lib/motion.ts                     # prefersReducedMotion() — the one motion gate; MOTION_LIMIT_MS, WCAG 2.2.2's five seconds
  lib/skyShader.ts, skyPalette.ts, skyLegibility.ts   # the fluid sky: GLSL, ramps, and the text-contrast policy
  lib/terrain.ts, terrainRender.ts  # pure terrain math (field/grad/runDescent/colormap/project) + its painter AND the memoised grid cache
  lib/marchingSquares.ts            # isoRuns(fn, bounds, level, res) — the ONE stitched kernel — and isoLevels, the one level placement; descentPath (storyContours) and terrainContours are both callers. Plus isoSegments: unstitched, over a pre-sampled grid, called by components/projects/DraftingField.astro (redrawn per frame, so the O(n²) stitch is unaffordable)
  lib/terrainContours.ts            # the hero field's isolines + levels, memoised — the intro's survey pass
  lib/introTimeline.ts              # the homepage intro's SCHEDULE only — pure. The decision and the ?dur= clamp live in pages/index.astro's is:inline script (it must run before first paint, so it cannot import); lib/introSession.ts reads what that publishes
  lib/descentPath.ts, trajectory.ts # the career descent graph's field and route
  lib/{bellman,problemSize,complexity,policyPnl,scenario,split}.ts   # the explainer slides' real math
  lib/scrollspy.ts                  # activeStopIndex (the /art rail, and railMarks' fallback) + railMarks, SideRail's marking rule — see Navigation
  lib/{justify,pixels,cowSpeech,knowledge,equations}.ts
  sections/{Heights,Interlude,Choice,Rules,Solve,Story,Work}.astro   # the homepage, in scroll order — ALL of sections/, there is nothing else in it (Signature.astro, the footer, is deleted)
  components/Deck.astro             # the deck's event plumbing (homepage only)
  components/FluidSky.astro         # the WebGL sky canvas — on 6 routes (/projects and the two research routes omit it)
  components/SkyWash.astro          # woven warm/cold broken-color wash over the sky — CSS + a small script (it is in the Interactivity list below; this line used to say "pure CSS")
  components/TerrainHero.astro      # the hero's terrain canvas (Heights only)
  components/DescentPath.astro      # the career descent graph (inside Story)
  components/SideRail.astro         # the one marginal rail (/, /research, /research/<slug>, /writing, /experience, /projects), driven by a Stop tree — see Navigation
  components/CornerNav.astro        # the always-visible glass nav: the pages, the contact marks (the only links to CV and Email), the theme toggle
  components/PlushCow.astro         # the cow, at three scales, with a pixel speech bubble; `talk` is /projects' cow, driven by that page's script
  components/Button.astro           # the shared button ANATOMY + a per-page skin ('sticker', /projects'; 'paper', the research routes') — see The concept
  components/Grain.astro            # (SealMark.astro, the footer's seal, was here; deleted with the footer. So was ProjectCard.astro, with the /projects redesign)
  components/projects/*.astro       # /projects only: DraftingField (the background), TerminalHeader (banner, listing, the boot), Gallery (the fan), SelectedRows, WorkshopCards, ProjectAsk (the "open on GitHub?" pop-up), ProjectPicture (no script)
  lib/draftingField.ts              # the drafting field: drift, the ping schedule, probe readouts — pure; DraftingField.astro strokes its isolines through marchingSquares' isoSegments over the grid sampleGrid() lays out
  lib/asciiBanner.ts                # the PROJECTS banner as SVG rects from letter matrices (the mono subset has no block glyphs)
  lib/projectsListing.ts            # the header's `ls -l` lines and the summary counts, computed from the records
  lib/projectsBoot.ts               # the boot: shouldBoot (WHETHER — shipped as source by projects.astro's is:inline decider) + bootSteps/bootState (WHAT, at each ms)
  lib/{cowTalk,galleryLayout}.ts    # when the /projects cow talks and which line; the fan's poses + the one click rule every project surface shares
  lib/{positioning,projectVisuals}.ts # offchart's percentile, ported; the four COMPUTED pictures as SVG strings, coloured only by CSS variables
  data/{cowLines,projectVisuals}.ts # the /projects cow's lines (stored as PAIRS); which picture each project shows
  data/vendor/*.ts                  # GENERATED — the computed pictures' inputs and the paper page's reproduction series, with provenance in each header. Do not edit; re-run the tool
  scripts/artGallery.ts             # the /art page behavior (justified rows, placard, scrollspy, lightbox)
tests/*.test.ts                     # vitest — every pure lib module, the data/route invariants, the content seam
tools/vendor-projects.mjs           # the ONLY thing that touches the network, run by hand: writes data/vendor/*, src/assets/projects/* and public/projects/*; name parts (`… binaries`) to re-vendor only those
```

### Routes

**Nine pages, not two**, and that is the number `npm run build` prints (`9 page(s)
built`) — check it against the build rather than against this table, and `ls
src/pages` beats both.

| Route | What it is |
| --- | --- |
| `/` | the descent — the homepage deck |
| `/research` | the papers as cards, newest first, each opening its page here or its publisher's; then the research interests |
| `/research/<slug>` | one paper explained, rendered from `src/content/papers/<file>.md` (today `/research/rl-bhrp`) |
| `/writing` | the writing shelf — kinds, each listing its markdown pieces |
| `/writing/<slug>` | one piece, rendered from `src/content/writing/<slug>.md` |
| `/projects` | every notable project, on its own drafting register: the terminal header and its boot, the gallery, selected work, the workshop |
| `/experience` | the timeline — education and roles |
| `/art` | calligraphy + photography |
| `/404` | the not-found page (noindex, no canonical) |

**Prototype routes are internal, and today there are none.** `/proto-showpiece`,
`/proto-ladder`, `/proto-paper` and `/proto-sketches` were each retired once they had
answered their question. Git holds them.

The convention stays: a `src/pages/proto-<name>.astro` page exists so a visual choice
can be made by looking at the real thing in the real page rather than at a screenshot
(the project's own habit: put the options in the page as a switcher). It is kept out of
the index **by construction, with no test to remember**: `BaseLayout` gives every path
starting with `/proto-` `noindex` itself, whatever the page passes, and `astro.config.mjs`
filters `/proto-` from the sitemap. That matters because the head is one either/or — no
noindex means a self-referential `<link rel="canonical">`, an explicit request to index
the page — and two proto routes once shipped exactly that by forgetting the prop. So a
new prototype needs no `noindex` prop. It is still a page like any other: add its route to
the census in `tests/distSmoke.test.ts` (`want`, which fails by name on a route it does not
list) and to the page count above, and retiring one is deleting its page and both of those.

### Interactivity — vanilla scripts, and the contract they keep

`Deck`, `SideRail`, `CornerNav`, `TerrainHero`, `FluidSky`, `SkyWash`,
`DescentPath`, `PlushCow`, the three explainer slides (`Choice`, `Rules`, `Solve`),
`BaseLayout`'s no-FOUC theme resolver and veil, `pages/index.astro`'s intro decider,
the `/art` page, both research routes (`pages/research/index.astro`, the cards' reveals,
hover and focus; `pages/research/[slug].astro`, the margin notes, the linking, Figure 2's
readout and the motion), and `/projects` — `pages/projects.astro` (the boot
decider, the ask dispatcher and the cow's talk) plus six of `components/projects/*`:
`DraftingField`, `Gallery`, `SelectedRows`, `WorkshopCards`, `ProjectAsk` and
`TerminalHeader` (the boot) — all need JS. That is the whole list, 23 files. Every one
is a plain Astro component or page with a `<script>`, **not** an island (see *Stack*).

**Counting it:** `grep -rln '<script' src` also hits three `lib/` files that say `<script>`
in comments. Filtered to `src/{components,sections,pages,layouts}` it returns the 23 above
(`ProjectPicture.astro` and `Button.astro` have none). `scripts/artGallery.ts`, `scripts/beats.ts`,
`scripts/motion.ts` and `scripts/pageView.ts` are modules those scripts import, not scripts of their own.

**Three files break the contract below on purpose, with `is:inline` scripts that must run
before first paint** (`grep -rn '<script is:inline' src` → 4 in 3 files). A bundled script
runs after parse, which is after first paint:
- `index.astro`'s intro decider and `BaseLayout`'s theme resolver and veil: without them the
  page paints one state and then flips to another (the finished sky, the wrong theme).
- `projects.astro`'s boot decider: sets `html.projects-boot` before the banner and gallery
  parse. It ships `shouldBoot`'s own source and owns the boot clock (`data-boot-at`) plus a
  `BOOT_DEADLINE_MS` failsafe. Every rule that hides something under the class says
  `transition: none`, or a ClientRouter arrival animates the finished page *into* the boot
  (`tests/distSmoke.test.ts` checks the built CSS).

The research routes need none: nothing on them is hidden by markup. What waits for a reveal
carries `data-pending`, set by a bundled script and only on what is still below the screen the
reader lands on (`onceSeen` in `scripts/motion.ts`), so nothing a reader can see flips; and a
wide margin note is held by CSS alone, `@media (scripting: enabled)`, until the script places
it (*Papers are files*). Every hold-back rule is inside `@media screen`: a printout is laid out
where no observer sees it and no backstop runs, so it gets the finished page
(`tests/distSmoke.test.ts` fails on a hold-back outside one).

Everything else here:

- **Re-init on `astro:page-load`, with a teardown**, because `ClientRouter` is on
  and a View Transition replaces the DOM without a fresh page load. A script that
  only runs at parse time works on first load and is dead after the first
  navigation.
  - **On a FULL load `astro:page-load` is window `load`**, which waits for every
    font and eager subresource — and never comes if one never arrives. (Every
    `/projects` picture is `loading="lazy"`; in headless Chrome 156 a held lazy
    picture did not hold `load`, held fonts did.) So nine scripts start
    through `scripts/pageView.ts`'s `onPageView()`, at module evaluation right after
    parse and then once per new DOM on `astro:page-load`, with the element its selector
    found (a page without one gets only the last teardown). Six are /projects': `TerminalHeader`,
    `ProjectAsk`, `Gallery`, `DraftingField`, and `pages/projects.astro`'s ask
    dispatcher and cow. The other three are `SideRail`, whose first marks must land while
    its rows are still entering; the paper page, whose notes must be placed and whose
    reveals armed before the reader sees it; and the /research index, whose cards answer
    the first pointer or Tab rather than the first after `load`. Of /projects' six, the
    last four once started at `load` and paid for it:
    until then a slow `Gallery` card was a bare tone with no shimmer, and a picture
    landing before `load` popped in unfaded; the field stayed blank while the banner
    lit; and the cow missed every `cow:say` sent before `load`, then greeted "Click
    one. I'll explain." to a reader whose pop-up was already open. Only
    `SelectedRows`' preview and `WorkshopCards`' spotlight still start at `load` —
    both are hover-only, and the first pointer move after it finds them.
  - **The teardown is returned.** An `onPageView` init returns it and `onPageView` runs
    it before the next init: one `AbortController`'s `abort()` for the `window`/`document`
    listeners, plus the timers, rAF loops, observers and video. Listeners on elements in
    the swapped `<body>` leave with it (nothing here is `transition:persist`).
- **Pure logic goes in `lib/`, plumbing stays in the component.** That split is
  why `deck.ts`, `pageStops.ts`, `terrain.ts`, `justify.ts` and `scrollspy.ts`
  have specs at all — the parts worth testing are not tangled in event handlers.
- **Both gates are asked, not re-derived**: `prefersReducedMotion()` from
  `lib/motion.ts`, `isPhone()` from `lib/viewport.ts`.
- **The rail and the research routes animate through one module**, `scripts/motion.ts`
  (its pure half, the curves and the arithmetic, is `lib/motionTiming.ts`): `play` runs a
  Web Animation and hands back to the element's own CSS, `onceSeen`/`riseOnceSeen` reveal
  what is first seen, `sweepLines` draws a highlight line by line. The reduced-motion gate
  is inside it, not in the callers: under it `play` lands on its last frame at once and
  `onceSeen` holds nothing back. A teardown finishes every live animation.
  - **Every curve and duration they move by is stated once, in `lib/motionTiming.ts`**, and a
    script imports it. CSS cannot, so `tests/motionTiming.test.ts` reads each transition and
    animation declaration, shorthand or longhand (`-duration`, `-delay`, `-timing-function`), in
    `SideRail.astro`'s, the two research pages' `<style>` blocks and `styles/paper.css`, and holds
    it to its constant, in order: a literal added there without one fails by name. In those scripts
    and `scripts/motion.ts` it fails a curve written out (`cubic-bezier(`, or a keyword such as
    `'ease-out'`; `'linear'` is no curve), and a number of ms of two digits or more after
    `duration:`/`delay:`/`step:`/`max:`/`total:` or as a `later()`/`setTimeout()` delay. A literal in
    a stylesheet other than those four, or a duration a script builds some other way, it does not
    see. The rail's entrance duration is passed in instead (`--row` on the nav, beside `--gap`), as
    the frontmatter's stagger is computed from it.

## The homepage — the deck

Section order (= the descent), all seven top-level `<section>`s of `main.is-slides`:

**Heights** (hero — de-centered: name bottom-left, bio top-right, terrain canvas
full-bleed behind) → **Interlude** (the tagline in the warm sky) → **Choice** →
**Rules** → **Solve** (the three-slide explainer) → **Story** (the editorial, with
the descent graph in a sticky column beside it) → **Work** (the appendix: papers,
writing, projects, and the cow at its foot). The page ends on Work's panel: there is
no footer (it and its seal were deleted on the owner's word, "Delete it, CV+Email in
menu"), and CV and Email are in the corner nav.

**What I do comes before how I got here**, on the owner's observation: "the
descent answered my trajectory, but didn't answer what I do. Normally people think
about what do I do first, then my trajectory." The explainer earns the graph.

The three explainer slides are **real math, not drawings** — that rule survived
five rejected showpieces, every one of which "looked like it meant something
without meaning anything":

1. **Choice** — what the decision *is*. One object, a hundred dollars in a bar,
   divided three ways and re-priced after one piece of news, then re-divided month
   after month. The object never changes; only what is being said about it does,
   which is what keeps it one slide. It also has to *define* the words: an earlier
   version opened with "every month, decide how much of each to own", which assumes
   the concept — grepping the built page confirmed nothing anywhere said what a
   portfolio was.
2. **Rules** — how hard it actually is, in four beats: you run $1bn+ and your
   slippage is now measurable; here are the constraints; here are the thousands of
   futures they have to hold in; now do all of it at once. Impact is square-root,
   calibrated to a published anchor; the trajectory fan is a *seeded* walk, because
   a fan that shimmered between builds would undercut a slide whose whole claim is
   that the scale is real.
3. **Solve** — the method as the algorithm running: a real finite-horizon Bellman
   lattice filled in backward from the horizon, then the optimal route traced
   forward past the candidates it beat.

**The register of the second slide is "bigger", not "smaller", and that is a
design rule.** Two earlier drawings lived in Rules — a convex feasible polygon and
a lattice of decision sequences, both exact and unit-tested — and both were pulled:
they answer "what is the feasible set", a question a reader who has never been told
no does not yet have, and both *shrink* something, which reads as tidying up. The
point is the opposite: the problem gets bigger the closer you look.

The numbers in the prose are **computed at build time from the same data the
picture draws**, so the words and the drawing cannot drift — including the detail
that a sentence quoting a figure must quote the same row the chart highlights (an
early draft said "a billion dollars" while quoting the $10bn row's numbers). Don't
hand-type a number a module can compute.

**The résumé is not on the homepage**, on the owner's instruction ("you may delete
everything from below. The record, the experience, everything"). Nothing was lost:
every block has its own route, and the corner nav carries the doors.

`sections/Mountains.astro` — the old résumé section — **is deleted**, and so is
/proto-paper, the last route that rendered it. This file used to say it was "kept on
purpose … so the markup is recoverable without git archaeology"; it isn't kept, and
git is the archive. What *does* still reference it is a handful of comments that
were written while it existed: `lib/skyShader.ts` and `components/FluidSky.astro`
each explain an amplitude decision in terms of where Mountains used to sit, which is
a historical note on a live decision and is fine to leave.

### THE DECK — one gesture, one slide

`components/Deck.astro` (plumbing) + `lib/deck.ts` (pure stops, unit-tested).
The brief: *"like a PPT, one scroll guides you to the next slide. It's not a free
scroll."*

- **It is not CSS scroll-snap, and that was measured, not assumed.** Slide gaps
  are 819–2346px while one wheel gesture is ~320px, so `scroll-snap-type: y
  mandatory` re-snapped to the slide it started from: the scroll sat at **y=84
  through eight consecutive gestures**, and through a 12-event trackpad flick.
  `proximity`, `scroll-snap-stop: always`, and a hero shrunk to exactly 100vh all
  measured identically stuck — the arithmetic is gesture size vs. slide spacing, so
  no snap flag can fix it. Only gestures of 640px+ advanced.
- **Tall slides get interior stops**, one viewport apart, so the deck pages
  *through* them; a slide only barely taller than the viewport is treated as
  fitting (`slack`), because an 84px "advance" is exactly the free-scroll feel
  being replaced.
- **What it deliberately does not break**: keyboard (Home/End/PageUp/PageDown/
  space/arrows), find-in-page and `#anchor` jumps (programmatic scrolls are
  ignored), resize/zoom (re-measured), trackpad momentum (one flick is coalesced
  into one slide).
- **It does not engage under reduced motion, and it does not engage on a phone.**
  Both fall back to an ordinary free scroll, which is a *finished* state.

## Phones

`lib/viewport.ts` is the one phone gate: **`PHONE_MAX_WIDTH = 640`** and
`isPhone()`, which asks `matchMedia` rather than measuring `innerWidth` so it
agrees with CSS exactly (the two disagree by a scrollbar's width, and that is
enough to engage the deck on a viewport whose styles think it's a phone). The query
string itself is built once, as `PHONE_QUERY`: `isPhone()`, the deck's change listener,
/projects' inline boot decider and the dist smoke test's stand-in all read it.

**The number lives in two places and they are synced BY HAND.** `@media
(max-width: var(--x))` is not valid CSS, so there is no way to feed one value to
both. **If you change `PHONE_MAX_WIDTH`, change every `@media (max-width: 640px)`
block with it.** `grep -rn 'max-width: *640px' src` returns **21 hits in 14 files**,
and **three of the 21 are prose, not rules** — `viewport.ts` ×2 (its own doc
comments) plus `global.css:171`, which describes the breakpoint in a comment
rather than declaring it — and **one is a `sizes` hint**:
`projects/Gallery`'s `sizes="(max-width: 640px) 240px, 330px"`, the phone strip's
card width, which must move with the strip's block. So there are **17 real CSS
blocks across 13 files**: `experience` ×2, `projects/Gallery` ×2, `global.css` ×2 and
`CornerNav` ×2 (one of each of the last three pairs is `@media not all and (max-width: 640px)`
— Gallery's desktop-only card lift, global.css's sky suppression and the corner nav's
tighter capsule from 641 to 1199px), and one each in
`DescentPath`, `FluidSky`, `Heights`, `projects.astro` (the phone's strip
for the cow's bubble), `projects/TerminalHeader`, `404`, `research/index`,
`research/[slug]` and `writing/[...slug]`. **The wide side is always written as that
negation, never as `min-width: 641px`**: a second bound leaves a zoomed window 640.5 CSS
px wide to neither side, and it is also what this grep would miss.
`tests/viewport.test.ts` fails on any such pair, at any breakpoint in `src`.
  Two notes on how this count has gone wrong before, because it keeps doing so.
It read "15 hits … 13 real blocks … `global.css` ×2" — overcounting `global.css`
because a prose mention there (since deleted) was `max-width:640px` with **no space**,
which the documented `grep -rn 'max-width: 640px' src` silently missed while a
careless re-count caught it as a rule. Use the pattern above, with the `*`, and
classify each hit rather than subtracting a remembered number of prose lines.
Earlier still it listed "the two proto sections": there are no proto *sections* —
`src/sections/` holds only the seven homepage slides. A prototype
route is not part of the phone treatment and need not use this breakpoint.
`tests/viewport.test.ts` pins the value so a silent drift shows up as a failure
rather than as a phone with half a treatment.

**The phone gets the same CONTENT as the desktop.** A phone-specific content
design was built **three times and reverted every time** — do not rebuild it. The
phone treatment is *bug fixes only*, and the whole of it is:

- the corner nav collapses to a **menu mark** that swaps for the list when opened
  (mutually exclusive, so the capsule can never grow a second row). The list is the
  pages, then Email and CV as icon-and-word rows, then the theme toggle, each group
  past a hairline, every row at least 44px tall; it scrolls inside itself on a
  screen shorter than its 415px;
- the **deck disengages** — measured in real WebKit, 5 of the 7 slides are taller
  than the viewport (rules 1.84 screens, story 3.07 on an iPhone 14; 2.5 and 4.2 on
  an SE), so its "every slide owns the screen" contract is simply false there. All
  four reported symptoms — text resting under the fixed nav at 7 of 15 stops, one
  swipe scrolling twice, a light flick going nowhere, one swipe skipping a screen —
  follow from the deck resting *inside* slides, and turning it off removes all four
  by deleting behaviour rather than adding compensation;
- the **homepage's rail hides**: it is `SideRail`, which every rail page hides at 1100px
  and below, where the slides take its gutter back;
- the **descent graph** drops its in-frame labels and becomes a block with its own
  height, with the sentence that explains it read *after* it rather than across it;
- the **fluid sky canvas is skipped** entirely under 640px;
- on the **research routes**, from 1100px down (where `SideRail` hides) the page is one
  column: a paper page opens with a **Contents** list that replaces the rail, listing
  exactly the rail's stops (`paperSections()`), and its margin notes fall in under the
  block they explain (so they do with no script, at any width). At 640px the type steps
  down, an equation or figure that has a narrow drawing shows it (an equation's `$$ narrow`,
  Figure 2's `svg.narrow`, Figure 1's `.pp-art.narrow`) — the same equation or figure, broken
  for the width — Table 1's dates take their short form, its row heads stick as it scrolls in
  its own box, and an index card sets its picture beside its title with a short tag for
  a caption. Figure 2's readout works by tap; a term's link to its note and a symbol's to
  its Notation row are a mouse's or a pen's, never a tap's, so nothing stays marked;
- on **/projects**, the gallery's fan becomes a horizontal strip, the drafting field is
  painted once as a still frame, and the rows' floating preview and the cards' glow are
  gated on `(hover: hover)` rather than on width, so they also stay off on a tablet's
  touch. Two more, both *deleting* behaviour:
  - **No boot.** `shouldBoot` takes a `phone` flag (the inline decider asks
    `lib/viewport.ts`'s `PHONE_QUERY`, passed in, never typed) and a phone gets the
    finished page, even with `?boot=1`. On a phone the largest element is a listing line
    the boot prints late: observed mobile LCP was 2,294ms with the boot and 61ms without
    — exactly what boot B was chosen to avoid. With the gate, Lighthouse mobile observed
    71ms (simulated 1,955ms; Perf 99), the LCP element the summary line.
  - **The cow sits beside the listing's last line, as it does from 641px, and says only
    what it is asked** — no greeting and no idle lines, so the idle timer is never set. It
    was docked bottom-right over the first screen, then put in a 218px band under the
    listing. The one difference from 641px: a 343px column has no room for the bubble on
    the prompt's row or above it, so on a phone it opens below the prompt, tail turned up,
    into a fixed strip sized for its tallest line (four rows at 320px). `tests/cowTalk.test.ts`
    word-wraps every line at 320px from the stylesheets' own literals and fails on a fifth row:
    the strip is hand-sized against the copy, and a longer line would otherwise overrun it into
    the gallery with the suite green.
  - **Where the cow stands is two rules, for the whole in-flow range (0–1179px).** It is
    **top-aligned** in its row: the rail wrapper is `align-items: flex-end`, so the cow sat
    on the bottom of a line as tall as its tallest item. From 641px that item is the cow,
    so nothing showed. On a phone it is the bubble, so the cow rested 23px low and dropped
    18px for every row a line wrapped to, under the finger that had just tapped it. A probe
    that watches the gallery and not the cow reports "nothing moves when it speaks" while
    that happens: assert the cow's rect for every line. And its top is the **prompt line's top**, 12px
    under the summary rather than on it. The 11px hop (12.2px with the easing's
    overshoot) carried the horns over the summary's last words wherever they end above
    the cow, at 360, 390 and 681–761px. The cost is that a lifted gallery card now covers
    15.9px of the cow's legs from 641px (it was 3.9px). The card paints over the cow, so
    the cow still covers nothing.

## Navigation & structure

- **`src/data/nav.ts` `PAGES` is the canonical page set** — "where can you go from
  here", in the site's own hierarchy (research first, art last; /writing directly
  after /research because it's the same subject at a different formality). It lives
  in `data/` because the page set is a *fact* about the site: the site once shipped
  a link to `/experience` before that page existed. `tests/distSmoke.test.ts` resolves
  every href the nav renders, on every built page, and `tests/nav.test.ts` asserts no
  duplicate hrefs or labels and the converse: every page in `src/pages` but `/`, the 404
  and a `/proto-` route is in `PAGES`, since the corner nav is the only link to
  `/experience` anywhere on the site.
  `CornerNav` renders it.
- **The page you are on is marked by a lit DOT before its label**, on every page:
  `aria-current="page"` on the link, a 6px dot plus a glow, and the label at weight 600. A page
  under a door (`/research/<slug>`, `/writing/<slug>`) marks its section's link the same way, with
  `aria-current="true"` — it is in that section, not on that page; `tests/distSmoke.test.ts` checks
  every built route.
  It replaced a 1px accent hairline under the label at weight 500, which the owner found
  unclear — that thin, it reads as an underline or as nothing. The dot is shape plus
  colour, so it does not rely on colour alone; the **bloom pill stays hover's and
  focus's**, so "here" and "you could go here" never look alike.
  - **The dot reserves its space; it does not take any.** It is positioned in the link's
    left padding, off the label, and every page link carries the same 20px of it (6px more
    than the other items), so every `.page-label` has the same x and width on every page
    (measured on the five pages in both themes: within 0.02px). That holds with overlay
    scrollbars; with classic 15px scrollbars the
    capsule, anchored on the right of the viewport, moves by the scrollbar's width between a
    page that scrolls and one that does not, labels and all. The 6px is what keeps the
    dot off the edge: in the shared 14px it sat flush on the link's edge, 4px from the
    capsule's border on "Research" — the owner: "almost on the edge". Its first version
    was an inline-block inside the label, which made the current item 14px wider — and
    the capsule is anchored on the right, so every label left of the current page moved
    14px from page to page, and a View Transition cross-faded two capsules. The weight
    moves nothing: a monospace face keeps its advances at 400 and 600.
  - Its colour is the accent **role token** `--ochre`, never a literal: ochre in light,
    emerald in dark, seal red on /projects and the research routes (whose registers
    override `--ochre`).
    The pill and the focus ring read the same token.
  - The 600 is real, not synthesised: the local JetBrains Mono face declares its weight
    range up to it, and `tests/distSmoke.test.ts` compares the built rule's weight with
    the declared face — a weight past the face's range gets a fake bold that no
    computed style can reveal.
- **The contact links are one typed record, `contact` in `profile.ts`** (`github`,
  `email`, `cv`, `linkedin`, each an href, a label and a new-tab flag), read by
  `CornerNav` and by BaseLayout's JSON-LD `sameAs`; `PAGES` is the only page list.
  - **The corner nav is the only place CV and Email are linked**, so it links them at
    every width: from 1200px all four marks, as icons (with their words from 2200px);
    from 641 to 1199px Email and CV only, in a capsule whose paddings tighten to fit one
    row at 641px (`CornerNav.astro` has the arithmetic, classic scrollbar included); on a
    phone, rows in the opened list (*Phones*). Below 1200px no page links GitHub or
    LinkedIn as profiles. `tests/distSmoke.test.ts` checks every built page's nav for the
    CV and Email links and that no rule hides them.
- **`src/lib/pageStops.ts` is one tree per page, and it drives BOTH the rail and
  the page's section ids.** This is structural, not stylistic: an old single-page
  /research rendered N papers with `featured.map(...)` while building its rail with
  `featured.some(...)`, so N papers collapsed into one flat anchor set pointing at
  ids emitted once per paper — `getElementById` takes the first match, so every
  "Method" link jumped to paper 1. Now the same function that names a stop's anchor
  hands the page the id to render, so **a stop cannot point at an id the page didn't
  emit.** Add a section to a page → add it to its `*Stops()` and render the id from
  the same helper. A paper page's sections are its file's, as the plugin reports them,
  then the page's own (`paperSections()`, `PAPER_END`); its rail and its phone Contents
  both list exactly that. `SideRail` is dumb markup over these trees, on every rail page
  (the homepage's is `homeStops()`).
  - Rail labels are **bookmarks, not sentences**: on `/` the rail must end left of the
    slides' 168px gutter, and `tests/pageStops.test.ts` holds the label lengths that keep it
    there (the arithmetic is beside `homeStops()`).
  - `flattenStops()` is *tree* order, which need not be visual order (a page may set a
    section higher on screen than its tree position). `SideRail` numbers its rows by it
    for their entrance and nothing else; `railMarks` sorts by measured top where order
    matters — don't assume monotonicity.
- **`SideRail` is the one rail**, on /, /research, /research/&lt;slug&gt;, /writing, /experience
  and /projects (the /art rail is separate, coupled to its gallery). It hides at 1100px and
  below, where a paper page shows its Contents list instead.
  - **On `/` it stays off the hero**, through its one page-facing prop, `hideOver="heights"`:
    `display: none` (so its links leave the tab order too) until the script finds the hero's
    bottom above mid-screen, as it is when the deck rests on the Interlude. With no script it
    stays hidden, since over the hero it would print across the name on a short window. A
    rail click is a plain `#anchor` jump, which the deck leaves to the browser, and at every
    deck rest one slide fills the reading band, so one stop leads (an explainer slide with
    "The field" lit as its ancestor).
  - **That breakpoint is one query, `(max-width: 1100px)`, and the wide side is always its exact
    negation**, `not all and (max-width: 1100px)` (`WIDE_QUERY` in `lib/viewport.ts`, for the one
    script that asks: the paper page's note placement), never a second bound at 1101px. A zoomed
    or OS-scaled window can be 1100.83 CSS px wide (1321px at 120%), which a pair of bounds leaves
    to neither: measured there, the rail showed while the paper's 24 notes went unplaced, 8 of them
    overlapping, /projects' content sat under the rail, and the homepage's Choice slide stacked.
    `tests/viewport.test.ts` reads SideRail's hide query and the paper page's one-column query and
    holds `WIDE_QUERY` to their exact negation, so a breakpoint retuned in the CSS alone fails; it
    also fails on any breakpoint in `src` written as two bounds a pixel apart (/projects' cow column
    is `(max-width: 1179px)` and its negation for the same reason). The homepage's five paper slides
    give the rail's gutter back on this same query, once (`.slide-gutter` in `styles/slides.css`).
  - **Under forced colours** (Windows High Contrast) every ink becomes one system colour and the
    dash, a background, is painted as Canvas, so nothing would tell the current stop apart; there
    the dash is `Highlight` and the current label is underlined.
  - **Its marking rule is `railMarks()` in `lib/scrollspy.ts`**, pure and specified (its doc
    comment is the rule). Two stops are lit at a section boundary **on purpose** — the reader
    is looking at both — and one of them leads; links carry `aria-current="true"`, which is
    valid on more than one.
  - **Every label clears 4.5:1 at rest, on every rail page's ground** (on `/`, the sky as its
    CSS gradient; see the end of this bullet), because a label is three
    layers of one text (`SideRail.astro`'s header says how): a mark is a cross-fade of
    opacities, never a colour transition, so every state is a solid ink. The label is the only text
    in the markup; the two inks over it are empty `aria-hidden` elements whose text is generated
    (`::before { content: attr(data-l) }`). `aria-hidden` is what keeps them out of the accessible
    name in every engine — generated text alone joins the name in some and not others — and being
    generated is what keeps them out of a selection, find-in-page and the unstyled page, each of
    which would otherwise hold a label three times. The sheets' numbers are
    held by `tests/paperPalette.test.ts` and `tests/draftingPalette.test.ts`; over the reading sky
    they were measured on screen (inactive labels 5.53 / 5.74 on /writing and 5.54 / 5.63 on
    /experience, light / dark; the dash at least 3.74:1). On `/` a resting label is `--rail-ink`
    (light `#4e483d`: 4.59:1 on the tan panels, where `--ink-3` is 3.80; dark `--ink-3`) and the
    focus ring `--rail-focus` (light `--ink-1`, 9.32:1 on the tan, where `--ochre` is 1.19; dark
    `--ochre`), held with the marks and the dash by `tests/deckPalette.test.ts` on the panels and
    on the sky's CSS gradient, its no-WebGL state, down to the Interlude's foot; the last screen
    is Work's panel, as nothing follows it. Not held: the live sky a desktop with WebGL draws
    over that gradient (FluidSky, SkyWash,
    the `.descent` washes), which the descent variant lets darken nearly freely, since what it
    guards against is a lighter sky under its paper-coloured text — a danger to the light
    theme's dark labels.
  - **Its motion is the rule's, and every piece of it runs once** (the timings are
    `lib/motionTiming.ts`'s `RAIL`; the entrance's duration reaches the CSS as `--row`). The entrance is CSS because a bundled script runs after first paint, and
    a from-state it set could land on a rail already drawn at rest. Hover is `.is-hover`, not
    `:hover`, set for a mouse or a pen and never for `pointerType === 'touch'`. Reduced motion:
    the same marks, at once. On `/` the entrance plays as the reader leaves the hero, and again
    each time they come back down past it (a CSS animation restarts when its element renders).
  - **A page reskins it through four role tokens and nothing else**: `--knockout` and
    `--rail-dash-halo`, each read with a `none` fallback (the drafting register's), and
    `--rail-ink` and `--rail-focus`, read with `--ink-3` and `--ochre` (the homepage's). No page
    styles the rail;
    `tests/draftingPalette.test.ts` checks.

## The content model rule

This is the structural conclusion of the audit, and it is policy, not preference:

- **Records rendered in more than one shape stay TypeScript data.** Publications,
  the timeline, projects and artworks are cross-referenced by id and rendered in 3+
  shapes each (a rail label, a homepage line, a full panel, JSON-LD, a computed
  number). They live in `src/data/*.ts` where a type error catches a mistake and a
  test can assert the invariant.
- **Unbounded prose with exactly one renderer becomes a content collection.**
  Writing is that: one route renders it, there is no upper bound on how much of it
  there will be, and its author should never open an editor on a `.ts` file to add a
  piece. So is a paper's explainer (*Papers are files*), beside its record, which stays data.

**Do not converge them.** Turning `profile.ts` into markdown would break every
cross-reference and every computed number; turning writing back into a TS array
would make a new post a code change. Each collection meets the data at exactly one
seam, and that is the whole point: for writing, one function (`buildKinds`); for a
paper, its frontmatter's `publication` (the slug of its record), with the records and
`PAPER_DATA` handed to the plugins as options by `markdownPlugins()`.

## Writing is markdown

The owner: *"i want the writing to be flexible. so essentially writing.ts displays
some markdown notes i have. My favorite quotes is just a markdown file."*

**A new piece is a FILE, not a code change**: drop a `.md` into
`src/content/writing/`, give it frontmatter, and it appears on `/writing` under its
kind and gets its own page at `/writing/<slug>`. Nothing else is edited.

- **`src/content.config.ts`** defines the collection (`glob` loader) and validates
  frontmatter at **build** time, which is why it's a collection rather than
  `import.meta.glob`: a typo in `kind:` fails `npm run build` naming the file,
  where a glob would render a broken row and ship it.
- **The frontmatter contract:**

  | field | required | notes |
  | --- | --- | --- |
  | `title` | yes | |
  | `date` | yes | `YYYY-MM-DD`. Unquoted YAML dates are fine — the schema accepts a string *or* a `Date` and normalises, because YAML parses `2026-08-15` into a Date object and a bare `z.string()` rejected the most natural spelling (that is how the first file failed to build). |
  | `kind` | yes | enum: `notes` \| `essays` \| `explainers` \| `misc`. An enum so a misspelling is a build error, not a piece that silently belongs to no section. |
  | `blurb` | yes | one or two sentences; shown on the index, not on the piece. |
  | `updated` | no | when the piece last **gained** something. |
  | `minutes` | no | omit rather than guess — the index only prints it when it's real. |
  | `featured` | no | leads its kind. |
  | `draft` | no | committed but unpublished: no index row, no page. |

- **`updated` is SET BY HAND, and only when a piece gains content.** It is not
  derived from git: a reformat, a typo fix or a rebase would each register as an
  edit, CI's shallow clones make the git date unreliable anyway, and a date that
  moves on its own teaches a reader to distrust every date on the site. Leave it
  alone for a CSS change. It renders only when it *differs* from `date`, so a piece
  written once shows one date rather than two identical ones. It may not precede
  `date` (the schema refuses).
- **`data/writing.ts` keeps only the taxonomy** — what each kind IS, its rail
  label, its gloss, and the copy shown while it's empty. That is site *voice*, so it
  stays in TypeScript. **`buildKinds()` is the single seam** between taxonomy and
  files, and it returns the same `WritingKind` shape the page and `pageStops`
  already consumed, deliberately: nothing downstream had to learn that content
  moved. The schema's enum and `KINDS`' keys must agree, and
  `tests/writingContent.test.ts` asserts exactly that (it reads `content.config.ts`
  as *text*, since `astro:content` is a virtual module vitest cannot import).
- **Empty kinds are shown**, with copy that names what is coming rather than
  "coming soon" — it states intent, and it's honest in a way a silently-missing
  section is not. A test enforces that the empty copy is specific.

## Papers are files

**A new paper page is a FILE, not a code change.** A paper's explainer is one `.md` in the
`papers` collection (`src/content/papers/`), written in a small directive syntax that
`remark-directive` parses and `lib/paperMarkdown/` compiles and checks at build time. What the
file holds is the prose; everything else has one home of its own:

- **The record** (title, authors, abstract, BibTeX, links, the owner's `reproduction`, tags) is
  the paper's entry in `profile.ts` `publications`, never repeated in the file. The page is
  `/research/<record slug>`, and it says which author wrote it from `profile.ts` `authorName`.
  A status is called what `STATUS_LABEL` beside its type says, on every surface that prints one (a
  card as written, the homepage line and the paper's head in lower case, a preprint's head adding
  ", not peer reviewed"). The prose the page writes round the file from these (the owner's place
  among the authors, the note on the references, for any count of them, none included) is
  `lib/paperPage.ts`'s, specified.
- **The frontmatter** (zod, `content.config.ts`): `publication` (a slug in `publications`),
  `pageDate`, `references` (`{ key, authors, year, title, journal?, venue?, doi?, url?, addedHere? }[]`,
  an author written `Family, Given` so a citation can read "López de Prado, 2016"; `journal` is set
  in italics and `venue` plain after it; `addedHere` is where the paper names a work its
  bibliography leaves out), `bibliographyOmits` (the bibliography's works the page does not draw on,
  each described, for the note above the references), `leftOut` (what the page leaves out of the
  paper, for "Read the full paper") and `errata` (`{ date, text }[]`, a `:v` in the text filled in).
- **The numbers and pictures** are `PAPER_DATA[slug]` (`src/data/papers/`): `values`, strings
  computed from the paper's data; `figures`, the drawings and tables made from it by
  `lib/paperFigures/` (HTML strings, the maths in them build-time MathML; a figure's caption is the
  file's); `line`, the homepage appendix's line, for a paper whose line quotes its numbers; and `thumb`,
  the index card's picture, for a paper that has one. TypeScript that quotes a value (`profile.ts`'s
  finding, the line) reads it through `paperValue`, whose key is typed as `VALUES`' keys, so a typo is a
  type error; and since the build strips types unchecked, it also throws on an unknown key, as an unknown
  `:v` fails the build. A bare `values[key]` would print "undefined" with every gate green. They reach the plugins as
  **options** from `astro.config.mjs`, with the records (for `::abstract`), so they are in Astro's
  config digest and a moved number re-renders the paper. Plugin *code* is not in the digest: after editing a
  plugin, delete `node_modules/.astro/data-store.json` before building or the old render is served.

**The syntax** — every construct has a case in `tests/fixtures/papers/simple.md`:

| write | renders |
| --- | --- |
| `::::section[The question]{#question n=1 rail="Question"}` … `::::` | `<section class="sec" id="question">` with `<h2><span class="n">1</span>The question</h2>`. `n` is optional (In brief has none), `rail` defaults to the title, an `aside="…"` follows the title in the heading only (`· in the paper’s own words`). The rail and the phone Contents come from these; the ids are the file's as written (one paper to a page), and the page refuses one it writes itself (see below). A numbered section opens with its lead, set in full ink. |
| `::abstract` | the record's abstract, verbatim, as `<blockquote class="abstract" cite="<record href>">`; the paragraph after it is the page's note on it. Built as nodes, so it is counted in `bodyWords` and its `RL-BHRP` kept whole like the file's |
| `**The problem.** …` | a run-in head: `<strong>`, set italic in full ink at the body's weight |
| `:t[risk parity]{#rp}` | `<i class="t" data-n="rp">` — a term at first use, the anchor of its note |
| `:::def{for=rp}` `**Risk parity.** …` `:::` | `<aside class="mn def" data-at="rp"><dfn>Risk parity.</dfn> …` — joins the block before it in one `<div class="an">` host, which must hold the term (the page looks for it there) |
| `:::why{for=…}` … `:::` | `<aside class="mn why"><span class="mk">Why it matters.</span> …`; `for` optional on both kinds |
| `:hl[…]` | `<mark class="hl">` — Underline, the one highlight style |
| `::::eq{#eq-4 n=4}` `$$` … `$$` `:::where` … `:::` notes `::::` | `<div class="eq an" id="eq-4">`: the display, its number `(4)` as HTML outside `<math>` (never `\tag`), `<p class="where">`, then its notes. One `$$`, or a `$$ wide` and a `$$ narrow` |
| `:::::thm{#thm-3-1-11}` … `:::::` | `<div class="thm">`, a theorem's frame, its displays inside it; the paragraphs that open it and introduce a display are its heads |
| `:::notation` with a GFM table `\| Symbol \| Meaning \|` `:::` | `<div class="tbl-scroll"><table class="notation">`, each row `<tr data-sym><th scope="row">`. Each row's symbols (every maths in its Symbol cell, `$N$, $G$` as well as `$N,\ G$`, split at commas; a membership introduces its subject and its set's index, a subscript: `i\in\mathcal{I}_{g}` is `i` and `g`, never the set nor a superscript of it, so `w\in\mathbb{R}^{N}` is `w` alone and `N` is a symbol only through a row of its own) are matched **structurally** in every display's MathML and tagged `class="sym" data-sym`: an equal subtree first, else the symbol's family — a scripted `W_{g}` also stands for `W` with any other script (`W_{g(i)}`, `W^{\top}`) and for `W` alone; the largest first, then on through what a tagged symbol holds (the `i` and `g` of `W_{g(i)}`, the `w` of `RC_i(w)`) but never its own letter (`W` is not tagged again inside `W_{g(i)}`, nor `Σ` inside `Σ̃`). The page reads a pointer on a nested symbol as the outermost. A row that is only in the prose ends its Symbol cell with `{text-only}`. A row is keyed by its position, so a paper has one `:::notation`, and a second is refused. |
| `:cite[markowitz1952]` | `<a class="cite" href="#ref-markowitz1952">Markowitz, 1952</a>` — one author, two (`Feng and He`), more (`Maillard et al.`) |
| `:v[usd.rl]` | the text of `PAPER_DATA[slug].values['usd.rl']`. **Every quantity the prose prints that comes from data is a `:v`** — a return, a ratio, a count of stocks, sectors, months or runs, a date or year of the window, a cost, a turnover. Typed by hand, and only these: a reference to the paper or into it (arXiv:2508.11856v1, §4.1, eq. (4), Alg. 1, Def. 3.2.3, Table 2), or to the page's own figures and table (Figure 2, Table 1); a year that names an event rather than a measurement ("the 2020 crash and the 2022 sell-off"); a constant of a method or a convention, stated by the paper or the field (the \$1 every growth figure starts from, the 15 of its top-15 share, 1.96 at the 5% level, VaR 5%, 12 months to a year, a basis point's 0.01%); and a quotation of what the paper itself prints, quoted to correct or discuss it (the errata's "Feb - 2020 to Aug - 2020" and "13.37%" are the paper's misprints: as a `:v` each would print the correction in place of the error it corrects). A word that glosses a value printed beside it ("about a quarter as much", "about half the money") is not a second quantity; where the value is computed, a spec holds the word to it (`tests/paperNumbers.test.ts`, the quarter). A `$` amount is always `:v` or `\$` — a bare `$` starts maths |
| `$:v[wealth.rl]^{12/67}-1$` | the same value written into the TeX, with `$ % # &` escaped — the one directive that works inside maths, so an equation's numbers are computed too. A `:cite`, `:t` or `:hl` there is refused |
| `:::figure{name=wealth n=2}` caption `:::` | `<figure class="fig" id="figure-2">`: `PAPER_DATA[slug].figures.wealth`, then the container's prose as its `<figcaption>`, "Figure 2." before it, and any notes beside it. A drawing that is a `<table>` is a table: `<figure class="tbl" id="table-1">`, its first paragraph the caption above it, "Table 1.", the table in its own scroll box, its other paragraphs `<p class="src">` under it. A drawing that names its own figure writes `FIGURE_NAME` (`lib/paperMarkdown/names.ts`) there, and the plugin puts in its place the name `n` gives it ("Figure 2"), so another paper's Figure 5 reads Figure 5. Astro's rehype-raw re-serialises the drawing's markup |
| `:::inpaper` `**In the paper:** …` `:::` | `<p class="inpaper">`, the pointer to what the page leaves to the paper |
| `:sup[a]` | `<sup>a</sup>`, a table note's mark |

- **Nesting takes colons.** A container holding another needs more colons than the one inside it:
  `:::` for a note or a where, `::::` for an eq or a section of notes, `:::::` for a section that
  holds an eq (or a theorem that holds one, whose section then takes `::::::`). With as many, the
  inner fence closes both, silently — so the build refuses exactly
  the traces that leaves (a stray `:::`, a container never closed, content outside a section).
- **Raw HTML is refused.** It would stay an opaque `raw` node until Astro's rehype-raw, after every
  check here, and an HTML comment would ship.
- **So are a code block and a markdown heading.** Shiki writes a fence's colours as inline styles
  (`github-dark`, a `#24292e` slab), and seal red is the only colour on the research routes; a
  heading without an id gets one slugged by Astro after every check here, which can repeat a
  section's. A section's title is its `[label]`.
- **Smartypants runs before the plugins** (Astro puts it ahead of every user remark plugin), so a
  title from a `[label]` is curled. An attribute is not, so a `rail="…"` holding a straight quote,
  `--` or `...` is refused (write the character), and a reference key is joined by single hyphens,
  since `--` in the `:cite[…]` naming it would become a dash. Smartypants never sees maths either, so
  it opens a quote that follows inline maths (`$g$'s` drew as g‘s); `remarkPaper` closes it (g’s).
- **Every mistake is reported, by name, and fails the build.** A plugin cannot fail the build
  itself — Astro logs a plugin's throw and stores the entry unrendered, an empty page with a green
  build — so the plugins collect problems into `remarkPluginFrontmatter.paperProblems` and the
  paper page throws on an entry with no `rendered`, then through `checkedReport` (`lib/paperMarkdown/`)
  on any problem, on an id it writes itself (below) and on a render with no report at all: a file the
  plugins never compiled, as they compile only what is under `PAPERS_DIR`, the one spelling of the
  directory, which `content.config.ts` loads too. The checks are in `lib/paperMarkdown/`, the less
  obvious ones with their reason beside them; `tests/fixtures/papers/malformed.md` holds one of each
  mistake a file can make (a record with no abstract is the spec's own case), and
  `tests/paperMarkdown.test.ts` names each, and checks `checkedReport`'s refusals. One is an authoring rule rather than
  a refusal: an unknown directive is reported, so a literal colon is written `\:`, as in
  `arXiv\:2508.11856`.
- **A file id the page writes itself fails the build too.** The plugin reports every id the file
  carries (`ids`) and the page refuses any that `paperPageOwns()` (`lib/pageStops.ts`) claims:
  PAPER_END's `read`, `references` and `cite`, `bibtex`, the corner nav's `cnav-list` and every
  `ref-…`. A second element with an id takes none of its links — a `#fragment`
  and `getElementById` find the first — so `{#bibtex}` would have Copy BibTeX copy a section, and
  `{#ref-markowitz1952}` would take every cite of it. `tests/distSmoke.test.ts` holds the list to the
  built page: each id there is the file's or the page's, never both and never neither, so an id the
  layout gains fails by name.
- **The render also reports** `sections` (`{ id, n?, title, rail }`, for the rail and Contents),
  `errataText` (the errata with their `:v` filled in) and `bodyWords` — `countWords` from
  `lib/words.ts` over the body's text, the abstract in it, every element boundary a space, with
  `math`, `table` and the figures' drawings (still raw) left out. The page's reading time counts
  every word a reader reads, as the approved prototype did: `bodyWords` plus the prose the page writes
  round the file (the head, Read the full paper, the note on the references, the cite line, the
  corrections, the tags). Not the controls, the Contents, the reference list or the BibTeX. Each of
  those strings is built once in `pages/research/[slug].astro`'s frontmatter, printed as built (a line
  with a date through `components/research/PaperLine.astro`) and counted from the same value, so a
  string cannot be counted one way and printed another; a new line in the template still has to be
  added to the count. `tests/distSmoke.test.ts` recounts the built page's minutes by that rule, and
  checks the plugin's `bodyWords` against the same rule, to the word, over the test chain's render.
- **A line never breaks inside a hyphenated word led by an acronym (RL-BHRP, RNN-based), two
  capitalised words joined (Black-Litterman, Self-Attention), a span of years, an ISO date or an
  arXiv category (q-fin.PM)**: one rule, `wholeParts` in `lib/words.ts`. The body's last pass wraps
  each in `<span class="nw">`, after the words are counted; the page's own prose (its title, meta,
  cite line, references, corrections) goes through `PaperLine`, and the /research cards' and the
  homepage's titles through the same function. A compound in lower case (risk-parity) may break at
  its hyphen, as in any prose.
- **The margin notes are placed by the page's script, and held until placed.** Wider than 1100px a note
  sits in the notes column beside its anchor — its term's line, or its block's top — stacked 16px
  apart so none overlap (`stackNotes` in `lib/paperPage.ts`), re-placed by a ResizeObserver
  (after layout, before paint) when a webfont lands or the window changes. Only a script knows where
  a term's line falls, so a note is `visibility: hidden` until `place()` marks it `.is-placed`:
  hidden keeps its box, so it first paints where it rests and nothing shifts — **CLS 0** at
  1440×900, 1280×720, 1101×700 and 1101×600, cold, throttled, from a `#results` deep link and on a
  restored-scroll reload. The hold is CSS alone, `@media (scripting: enabled)` nested in the wide
  layout's `@media not all and (max-width: 1100px)`, with no pre-paint script; its backstop is a CSS animation that shows every note after
  `MOTION_LIMIT_MS` if the script never runs (then at its block's top, perhaps overlapping —
  accepted, as it shifts nothing). Without a script the query does not match and every note falls
  into the column, as at 1100px and below. `tests/motionLimit.test.ts` reads the hold, its delay
  and `place()`'s mark from the page's source.
- **Inert everywhere else, by construction.** Astro runs one processor for every `.md`, so the
  directive syntax is not a plugin in the list: `remarkPaperSyntax` wraps remark-parse and adds
  remark-directive's extensions only for the length of a paper's parse. Any other file is parsed
  exactly as it would be without them — a `:word`, a `:::` line or a `mailto:me@…` in /writing is
  never a directive, so nothing has to be put back. Verified: `dist` byte-identical with and
  without the plugins, and the spec compares `favourite-quotes.md` and a file of directive-like
  text both ways. The one plugin that is not paper-only is the MathML letter fix (*Stack*).
- The chain is spelled once, in `lib/paperMarkdown/index.ts`; the spec runs it inside Astro's own
  order (parse, GFM, the site's remark plugins, remark-rehype, the site's rehype plugins). Astro's
  other passes — smartypants, shiki, heading ids, images, rehype-raw — are left out of the spec,
  and the rules above are what keep each of them from reaching anything the plugins check; the
  spec's header says which rule answers which pass.

## Identity & voice (a design constraint)

The hierarchy is deliberate and load-bearing for how the site reads. Keep it:

- **Quant / mathematician first.** Hero headline: **"Quant Researcher · Portfolio
  Optimization"**, with a small mono subline (incoming PhD · University of
  Toronto · the engineering role) beneath. Software engineering is the *second*
  hat — when it's named, it's a **full-stack SDE/MLE** (more than "a developer"),
  but it never gets promoted above the quant identity.
- **The PhD is incoming** (Operations Research, University of Toronto). State it
  as incoming — never present-tense "PhD student." Honesty over flourish,
  everywhere on the site.
- **Tagline** (the Interlude): *"A researcher by day, an artist by night, and a
  mathematician at heart."* "by night" deliberately lands where the gradient
  turns to dusk. Its links to /research and /art are an **easter egg** — real
  navigation must never require a discovery, which is why the corner nav carries
  the page set at all times.
- The art avocation (guqin + Chinese/English calligraphy) is real and shown on
  /art, but stays an avocation in the framing.
- **/research is papers-only.** A paper and a post have different contracts — one
  is co-authored, dated, citable and has results; the other is one person thinking
  out loud. Filed together, the informal writing quietly borrows the paper's
  authority. That's why /writing is its own route.
- **The appendix is not a résumé.** A résumé lists credentials and claims
  authorization; the Work slide lists **artefacts** and where to read them. Every
  row is something a reader can go and check.

All résumé content lives in `src/data/profile.ts` — editing the site's facts
means editing data, never components. A new résumé becomes a `profile.ts` edit.

## The hero — math-generative terrain

A 3D dotted optimization landscape (Gaussian-mixture loss field) rendered to a
full-bleed hero `<canvas>` in **Heights**, colored by height (ochre valleys →
indigo peaks), breathing gently, with occasional gradient-descent "walkers"
flowing downhill into local minima as fading comet trails — "The Descent" made
literal. A rare Easter-egg pill at a settled optimum shows typeset math (∇f = 0,
the stationarity condition) or "Moo!".

- Code: `components/TerrainHero.astro` (vanilla `<script>`) + pure, unit-tested
  math in `lib/terrain.ts` (gradient verified vs finite-difference; descent
  converges to true minima), painted via `lib/terrainRender.ts`, with
  `lib/equations.ts` for build-time KaTeX→MathML.
- **The math must stay honest.** Don't claim quadratic convergence for plain
  gradient descent; ∇f=0 is the unconstrained stationarity condition. Misstated
  math undercuts the whole point of the piece. The same rule governs the explainer
  slides and the descent graph.
- Perf: rAF loop paused offscreen (IntersectionObserver) + ~30fps throttle + a **160ms debounced**
  resize (reassigning `cvs.width`/`height` reallocates a full-bleed backing store at DPR 2, and the pending
  timer is cleared in teardown or it fires against a canvas `ClientRouter` already replaced) +
  DPR≤2; a finished static frame is painted first (instant LCP) and is the
  reduced-motion / no-JS state.

### The first-open intro — "the map becomes the territory"

On a **first open of `/`** the hero arrives rather than simply being there: isolines of the same
`field()` stroke themselves onto a **flat plane**, the surface **rises out of that map** carrying the
lines up with it so they deform into the terrain they were describing, and the dots resolve as the lines
fade. **5200ms**, landing on exactly the frame the hero paints at rest. No click, no overlay, nothing to
dismiss. Replaces the first-visit gate, which was built twice and rejected twice — once as a design, and
once more as "still boring" — for blocking the page behind a button and for being decorative. Design doc:
`docs/superpowers/specs/2026-11-01-intro-animation-design.md` (local; `docs/` is gitignored).

**FOUR BEATS IN SEQUENCE, AND THE SEQUENCE IS THE OWNER'S CORRECTION.** `INTRO_PHASES` in
`lib/introTimeline.ts` reads: **ground** (0 -> 0.20 — the sky resolves from one flat tone to its full
gradient, alone, nothing else moving) -> **lines** (0.17 -> 0.62) -> **relief** (0.52 -> 0.90) ->
**substance** (0.62 -> 0.96, the dots), with the isolines leaving over 0.74 -> 0.97 so the last frame is
clean. The first version fused all of it into one gesture, on the reasoning that a strict sequence had
read as three disconnected events; seen on the real page the verdict was the opposite — *"give it a clear
phase to draw the background. then we draw the line, and so on"* — and separating the beats is also what
took the duration from 3600 to 5200ms, because each beat then needed room. The handoffs still **overlap**
by a few hundredths: distinct beats must not mean dead air, and `tests/introTimeline.test.ts` enforces
both ends (the no-plateau test fails if any 150ms window goes quiet; the ordering tests fail if a beat
starts before the one it follows).

**Beat 1 reaches the SKY, which is the one part of this that is not the terrain canvas.** `introFrame(t)`
returns a fifth channel, `sky`, and `FluidSky` multiplies its `uFlatten` uniform by it — at 1 the shader
resolves to a single colour sampled from the ramp itself, which is also the CSS `--descent-grad` state
the no-WebGL path shows, so it costs no extra draw work. Three other background levers were built and
compared live on the page, and all three are **deleted, not left behind a flag**: ramping the warp
amplitude (`uAmp` — measured imperceptible, because it moves the warp's *displacement*, which is
textural, while the sky's visible presence is its colours), drifting the pattern into place, and fading
the `SkyWash` layer.

- **THE CAMERA NEVER MOVES.** The one animated quantity is elevation: `z = field(x, y) * lift`. That is
  what makes the lines and the dots read as one surface drawn twice rather than two animations stapled
  together. `lift` is **global**: one scalar per frame, no per-point front. An animated `YAW`/`TILT`
  would invalidate the precomputed EDL shade and the depth sort for the whole intro.
  - **The EDL shade is NOT camera-only, and this file said it was.** `computeEDL` projects each dot at
    FULL elevation and reads screen-space depth differences between neighbours, so it depends on the
    fixed camera *and* on the finished geometry — it is exact only at `lift === 1`. During the rise the
    flat plane wears the finished relief's shade, as a density/size ghost with uniform colour (`hn`
    collapses to 0.5). That is accepted — it reads as a shaded-relief map, which is what a survey is —
    and the landing frame is still byte-exact. The false version of this claim would have sent the next
    reader looking for camera animation as the only thing that could break it.
- **THE DECISION IS MADE IN AN `is:inline` SCRIPT AT THE TOP OF `pages/index.astro`, BEFORE FIRST PAINT,
  AND THAT IS NOT A STYLE CHOICE.** `--descent-grad` is the sky's base layer *and* its no-WebGL state and
  it holds the FINISHED colours, so with the decision in a component script a visitor saw the real sky for
  ~300ms, then the canvas's first draw replaced it with the intro's flat tone, then it resolved back:
  warm -> flat -> warm, reported as *"renders to our normal stuff and suddenly goes blank"*. A bundled
  `<script>` cannot fix that — Astro defers it until after parse. `is:inline` parses in document order,
  so it runs before anything below it paints; `BaseLayout` already uses the same mechanism twice (the
  no-FOUC theme resolver and the veil). **This is Astro's answer to the problem, not an Astro limitation**
  — worth stating plainly, because the first diagnosis here wrongly concluded the framework couldn't do it.
  - `define:vars` passes `INTRO_SEEN_KEY`, the duration and both clamp bounds in from `lib/`, so what is
    duplicated in raw JS is the decision *expression*, never the policy. `lib/introSession.ts` then
    **reads** what that script published on `<html>` rather than deciding again — one decider, so the two
    cannot disagree. A module read also removes a race: `FluidSky` draws synchronously during its own
    init, and when each component read the DOM itself the sky could render finished and then snap flat.
  - **It is also the reason three well-tested functions were deleted.** `introStillRunning`,
    `introDurationFrom` and `shouldPlayIntro` had 97 lines of specs and, after the move, zero production
    callers — a green suite over code nothing ran. `tests/distSmoke.test.ts` now reads the built
    `index.html` and asserts the shipped constants equal the `lib/` ones and that the script precedes the
    canvas it gates. **Assert the policy where it ships; a parallel implementation kept alive to host
    assertions is worse than no test.**
- Code: `lib/introTimeline.ts` (the schedule — pure, and the `t=1` landing is an assertion, because the
  live breath ramp is only the right continuation if the intro finished where the static frame is),
  `lib/terrainContours.ts` + `lib/marchingSquares.ts` (the survey geometry), and plumbing in
  `TerrainHero.astro`. `paintTerrain` takes an optional `lift` defaulting to 1; the dot fade-in rides on
  `ctx.globalAlpha`, and the survey is a separate stroke pass — widening the painter for elevation was
  right, widening it for a different kind of mark would not be.
- **Contour cost is measured, and the parameters are a perf decision:** 9 levels at res 74 is **10.0ms**
  median (13 runs / 1245 points), against 21.0ms at res 110 and 47.1ms at the descent graph's res 150.
  Memoised, so it is paid once per page. `tests/terrainContours.test.ts` pins both parameters and bounds
  the work; it does **not** time the build — see below.
  - **The memo has ONE slot and no key, deliberately.** `terrainLevels(n)` and
    `terrainContoursFor(level, res)` were parameterised, with a `level|res` cache key and four specs
    exercising it — and production never passed either argument: one call site, using the constants
    declared above it. The parameters' only callers were the tests of the parameters, which is this repo's
    documented *"a test is not a consumer"* trap.
  - **The 40ms ceiling was not measuring anything, and then it was measuring the wrong machine.** Worth
    the whole arc, because each step looked like the fix and the third one is the lesson.
    1. The cold-build test called `terrainContoursFor(l + 1e-7, ...)`, with a comment saying the offset
       kept the memo from being warm. The key was `level.toFixed(4)`, and 1e-7 does not survive four
       decimals: **9 of 9 offset keys hashed identically** to the warm ones, so it timed nine `Map` hits
       and passed at ~0ms. A perf ceiling that cannot fail is worse than none — it reads as covered.
    2. `vi.resetModules()` plus a dynamic import gave genuinely empty caches and measured **44.9ms**,
       red. Real, but not production's number: re-importing re-evaluates `terrain.ts`, so `field` loses
       its JIT feedback, while on a real first open the static frame has already run it tens of thousands
       of times. **Cold cache, warm JIT** — model both or the budget describes nothing that ships.
    3. Timing the kernel directly with a warm field passed locally at ~11ms and **went red on CI at
       57.1ms**, against a ceiling whose own comment claimed it was "deliberately loose enough not to
       flake on a loaded CI box". It had never been tested against a real measurement, because the
       measurement was fake when the ceiling was chosen.
    - **So there is no time budget, and that is the answer rather than a bigger number.** A ceiling loose
      enough for the slowest 2-vCPU runner stops discriminating; a tight one flakes. This is the same
      category error as the cadence lesson in *The fluid sky* below — a per-run stopwatch reports the
      runner, not the code. What guards the first frame instead is **deterministic**: cost is
      `levels x (res+1)^2` field evaluations, so the only way to make it expensive is to raise a
      constant, and the spec pins `9` and `74` and asserts the product stays under 55,000. Mutating res
      to descentPath's 150 fails both immediately, on any machine — 205,209 against the bound. The
      measured times live in `lib/terrainContours.ts`'s header for whoever retunes it.
- **Do not "optimise" the stitch in `marchingSquares.ts`.** A hashed endpoint-bucketing stitch was
  written and measured: **slower** (10.9 vs 10.0ms) *and wrong*, fragmenting 13 polylines into 32.
  Separately, the original stitch had a real bug — it attached the *first* segment within `dx * 1.2`
  rather than the *nearest*, and since true neighbours are coincident to floating-point noise it grabbed
  segments further along the curve and orphaned the real ones, which were then dropped as sub-4-point
  noise. A circle at res 60 returned runs of `[50, 7, 63, 3, 2, 2, 2, 3]` — three kept pieces of one
  loop and **five** fragments thrown away, i.e. visible gaps. Nearest-first returns one run of **124**
  points. (Both of those numbers were wrong on first writing — 125 and "four" — which is the same
  transcribe-rather-than-measure habit this file keeps warning about.)
- **The hero text is NOT part of this animation and must stay that way.** It keeps its own tuned arrival
  — `.hero-rise` 1400/0, `.hero-bio` 1400/250, `.hero-doors-line` 1100/620 — so the intro adds nothing
  to the arrival of the first thing a visitor came to read. Measured: **the LCP element on `/` is the H1
  text, not the canvas**. A first pass measured the intro costing it **+12ms** and that was real, not
  noise: the first frame built the whole contour geometry (10.6ms) and then stroked zero paths, because
  `contourAlpha` is 1 at t=0 while `survey` is still 0. Guarding the survey pass on `survey > 0` — and
  the dot pass on `dots > 0.004` — moved that work off the first-paint path, which is what the design
  asked for in the first place. That independence is what makes a 5.2s animation affordable at all;
  if the text is ever folded in, the duration must come down with it. A comment in `Heights.astro`
  records that the tagline's separate beat was once lost and the owner noticed.
  - **A `?seq=1` spike that held the text until the landing was built and DELETED, and the reason is the
    arithmetic above.** It came from a real note — *"it might be wiser for the texts to enter after the
    hero mountain animation... otherwise, everything is competing for the same attention"* — and it
    worked, by pausing the hero's three text animations at `opacity: 0` until `TerrainHero` dropped the
    class. But the H1 inside that block is `/`'s measured LCP element, so it moved LCP from ~450ms to the
    end of the intro: a Lighthouse Perf hit against a stated >=99 bar, traded for a sequencing preference.
    **If the sequencing is wanted, shorten the intro — do not pause the LCP.** Notes sit in
    `Heights.astro` and `index.astro` so this is not rediscovered as a missing feature.
- **Walkers are suppressed until it lands** (the intro paints with `animate: false`, and `nextSpawnAt` is
  re-seeded 600ms after). A comet descending a flat plane is meaningless, and at partial lift it would
  hang in mid-air — walker points are projected at full elevation and know nothing about `lift`.
- **An unseen intro is consumed, not deferred.** A reload at a restored scroll position leaves the hero
  offscreen; keeping it pending would play a 5.2s construction animation on a scroll-back minutes later,
  in front of someone already reading. Same rule if the deck carries them off mid-intro.
- **It runs unthrottled**, unlike the live loop's 33ms. 5.2s once per session, and the first thing anyone
  sees; the FluidSky lesson below is that perceived smoothness is cadence locked to the refresh rate, not
  draw count.
- **Session key** `descent.intro.seen.v1`, **set at START** (so repeated reloads do not replay it) and
  versioned — bump the suffix when the animation changes enough to want a second look mid-session, or a
  reload during a design pass shows nothing and the change looks unshipped. Storage access **can throw**
  (private mode), and a throw means *play it*, never *break the hero*.
- **TUNING IS A URL PARAMETER, and the timing is expected to change.** `?intro=1` replays past the flag;
  `?dur=3000` overrides the duration, clamped to 400–20000 with a fallback on anything unparseable
  (`t = elapsed / 0` is `Infinity` and would paint a blank hero). Phase boundaries are **fractions of the
  total**, so retuning is one number. The override is an affordance, not a feature: it appears in no
  link, no sitemap, and `tests/distSmoke.test.ts` asserts that.
  - **ANSWERED, AND THE MOCKUP'S INSTINCT WAS BACKWARDS.** This bullet used to read "still open: 3600ms
    was judged on 320px prototypes, a full-bleed hero is a larger object and large objects read slower, so
    this may want ~3000ms." Judged on the real page at full viewport it went the other way, to **5200ms**:
    once the beats were separated each one needed room. Keep the habit (`?dur=` on the real page, not a
    mockup) and distrust the prediction.
- `tests/distSmoke.test.ts` pins `data-intro` to `/` and nowhere else. Moving this component, or
  BaseLayout growing its own copy, is the single edit that would hand the animation to all nine routes.

## The fluid sky

`components/FluidSky.astro` is the sky on **every page except the two registers'** — six
routes: `/`, `/writing`, `/writing/<slug>`, `/experience`, `/art` and the
404. `/projects` and both research routes render neither it nor `SkyWash`: each register's ink
is sized for its own ground, not the reading sky (light drafting `--ink-3` over
`--reading-grad` measured 3.89:1), and the paper register is a still sheet by design.
A WebGL canvas: a two-level domain
warp over the descent/reading ramps, sampled from scroll position, with viscous
luminance banding and a warm bloom. `lib/skyShader.ts` holds the GLSL,
`lib/skyPalette.ts` the ramps, `lib/skyLegibility.ts` the **contrast policy** that
keeps text readable over it. Two archetypes: `descent` (paper text; the dangerous
direction is lighter) and `reading` (dark ink on a luminous field; dangerous is
darker). Every page starts at the top of the pattern: the shader samples it from
`scrollY / vw` alone, and the component takes `variant`, nothing else (its warp amplitude follows it).

Two invariants, both about the compositor and both easy to break:

1. **The canvas is OPAQUE, with no `mix-blend-mode`.** A blended full-screen layer
   forces the compositor to re-read the page backdrop every frame, which defeats
   layer caching for the entire document.
2. **`.fluid-live` must never outlive a visible canvas.** CSS hides the canvas under
   640px, and the class is additionally dropped on resize-to-hidden and on GL context loss.

Perf: viewport-sized (scroll is a uniform), half internal resolution, ~30fps idle and **every rAF tick while
scrolling**, paused on tab-hide, skipped on phones. The CSS
`--descent-grad` gradient remains underneath as the base and the no-WebGL state.

**THE SCROLLING BUDGET IS 0 AND MUST STAY 0. DO NOT "OPTIMISE" IT.** It was briefly capped at 16ms (~60fps),
on the reasoning that 0 means 120 full-viewport fragment-shader draws per second on a 120 Hz panel, plus 16
`gl.uniform*` calls each, at exactly the moment the compositor is busiest and during every deck slide
transition. The draw count did halve. The owner's report was that the homepage and `/art` became *"stucky as
hell"* compared to `main`, and it was reverted.
  **The mistake was measuring a cost instead of the experience.** What matters for a full-screen background
during a scroll is not how many times it draws but whether it updates *in step with the scroll*. At 0 the sky
is locked to the display refresh, so background and content move together; at 16ms on a 120 Hz display the
content scrolls at 120fps while the background behind it updates at 60, and a half-rate background under
full-rate content is perceived as the background dragging. So the change was worse precisely on the
high-refresh hardware it was supposed to help.
  **And it is invisible to this project's own verification path**, which is the part worth remembering:
headless Chrome caps at 60 Hz, so a trace of a synthesized 2400px scroll reported 60.2 fps, 2 dropped frames
and no long task on the capped build — indistinguishable from the good one. A cadence regression can only be
seen on real hardware. If this genuinely needs to cost less, spend it on internal resolution or on shader
work per draw, never on the cadence.

## Themes (light ⇄ dark)

Two themes, driven by `html[data-theme]` (absent = light, `'dark'` = terminal
galaxy). The whole system is **token override**, not per-component branching:

- **How it flips:** `tokens.css` defines the palette in `:root` (light) and
  re-declares it under `html[data-theme='dark']`. `global.css` `@theme` maps
  `--color-*` → those tokens, so **every Tailwind utility and hand-written
  `var(--ink-*)` re-themes for free** — no component edits for the ~90% that
  just uses tokens. Only redefine a surface explicitly when it hardcodes a
  color a token can't reach.
- **Role tokens that must NOT flip with the ink ramp:** `--bg` (page base
  behind the sky — always dark, never flashes bright, **except under a page register**,
  below, whose `--bg` is its sheet), `--on-accent` (dark ink for text ON the accent chip — the accent is a light
  color in both themes, so text on it stays dark), and `--descent-grad` (the whole sky,
  redefined wholesale per theme).
- **A page can override the ROLE tokens, per theme, from `html[data-page]`** (BaseLayout's
  `page` prop). Two registers do: `page="drafting"` (/projects) and `page="paper"` (both
  research routes). Each has two blocks in `tokens.css`, `html[data-page='…']` and
  `…[data-theme='dark']`, that re-declare `--paper`, the ink ramp, `--ochre` (→ the seal),
  `--on-accent`, `--hairline-rgb` and `--bg` (= the sheet, light in the light theme, so the
  body and overscroll show paper), plus the register's own tokens. That is how the shared
  nav, rail, button anatomy and cow reskin with no edit. **Both theme blocks declare every
  token**: `[data-page]` and `[data-theme='dark']` tie on specificity, so a light-only value
  would win in dark. The role tokens a register must declare are one list, `ROLE_TOKENS` in
  `tests/helpers/palette.ts`, which both palette specs read. The homepage's `page="deck"` is
  not a register: its two blocks declare only `--rail-ink` and `--rail-focus`, the rail's
  resting ink and focus ring (`tests/deckPalette.test.ts`; see *Navigation*).
  - **drafting** adds `--knockout` (the label knockout, one 1px ring of the bare sheet that
    `<main>`'s text and `SideRail`'s labels both read — the rail with a `none` fallback, so
    the page never styles the rail), `--rail-dash-halo` (the rail dash's 2px ring)
    and eight `--draft-*` tokens. `tests/draftingPalette.test.ts` checks that the two sets
    match and the inks clear AA.
  - **paper** adds eight `--sheet-*` tokens, each glossed in `tokens.css`'s paper header. The
    ground is `--sheet-ground`, never `--paper`, which in the dark convention is the light text
    colour; the band of runs and the grid are **exempt from 3:1 by name**, every value they help
    read being text. It needs no knockout: nothing strokes under its text, so the rail reads its
    `none` fallbacks. `tests/paperPalette.test.ts` holds the numbers, exemptions included, and
    that the page's own CSS never paints a ground with `--paper`.
- **Surfaces that can't inherit CSS tokens** (handle per-theme by hand):
  the **terrain canvas** (JS-painted — `TerrainHero.astro` picks a `TerrainRamp`
  + walker palette off `data-theme`; dark = the cyan-blue **"Glacier"** ramp,
  `TERRAIN_TERMINAL` in `lib/terrain.ts` — NOT green, which this line claimed for
  a long time; the green phosphor is the fluid sky's and the accent token's, not
  the terrain's), the **fluid sky**
  (`skyPalette`/`skyShader` switch to a phosphor nebula with stars behind the
  line), the **SkyWash** + `.descent::before/::after` washes (raw rgba — dark
  nearly kills the warm Monet strokes), the **hero legibility halo** (paper→dark
  veil), the **homepage panels' paper ground** (`styles/slides.css`, chosen per theme), and the
  **corner-nav glass** (forced dark-frost in dark theme). The research routes' figures are
  not among them: their SVG is drawn from CSS classes that read the paper tokens, so they
  re-theme with no listener.
- **Default + persistence:** an inline no-FOUC head script in `BaseLayout`
  resolves theme *before first paint* — explicit `localStorage.theme` first,
  else `prefers-color-scheme` (so a first-time visitor matches their OS). The
  toggle (a real `<button>` in `CornerNav`, sun/moon by action) writes
  `localStorage`, flips the attribute live, and dispatches **`theme:change`** on
  `document` so the scripts that paint from JS repaint for the new palette:
  `TerrainHero`, `DescentPath`, `FluidSky`, and on /projects `DraftingField` and
  `Gallery` (manifold's still and video are per theme). **Never re-fire
  `astro:page-load` for a repaint** — it re-runs every page script's init, re-measuring
  the deck and rebuilding observers no colour affects, and measured as a 357ms long task on `/`. A new
  JS-painted surface listens for `theme:change`, with its teardown. It is the only path: no surface
  observes `data-theme` or re-reads it per frame, as the flip and the event are one task.
- **Additive rule (load-bearing):** the dark theme must NEVER degrade the
  shipped light Descent. Light is the base; dark is an override layer. When
  touching themes, verify BOTH — build breaks and contrast regressions hide in
  the theme you didn't look at.
- One panel used to be dark in both themes for emphasis. It was removed: a
  light-theme reader read it as a **bug**, not as emphasis. All five paper slides
  share one palette, `.slide-paper` in `styles/slides.css`, and follow the theme.

## Three Astro traps that have each shipped a bug here

1. **Astro scoped styles rewrite selectors with `[data-astro-cid-…]`,** which
   changes specificity **and what the selector can reach.** A scoped rule **cannot**
   reach markdown rendered by `<Content />`, slotted content, nodes a script
   created at runtime, **or an element declared in a different component** —
   `.prose blockquote` becomes `.prose[cid] blockquote[cid]` and matches nothing,
   silently. This is why `/writing/<slug>`'s prose styles are in an `is:global`
   block (nested under `.prose` so going global cannot leak), and why several
   component rules use `:global(...)`. When a rule "does nothing" and the markup is
   clearly right, check this first.
   - **Four real instances, three of them found by audit rather than by looking.**
     `DescentPath` hit it with its script-created `b`/`i` emphasis nodes and fixed
     it. `TerrainHero`'s `.terrain-bubble .m` and `.terrain-bubble math` had the
     same bug — both descendants come from `bubbleEl.innerHTML`, so the Moo glyph
     rendered unstyled and the three MathML bubbles never got their colour or
     size. And `Heights` wrote `#heights .terrain-canvas { opacity: 0.4 }` for the
     phone dim, but `.terrain-canvas` is declared in `TerrainHero.astro`, so it
     carries *that* component's hash: the rule compiled to
     `#heights[cid-A] .terrain-canvas[cid-A]` and matched zero elements on every
     route. The dim had never once applied.
   - **The cheap check is in `dist`, not in review.** Parse every
     `X[data-astro-cid-N]` fragment out of `dist/_astro/*.css` and assert some
     element in `dist` carries that hash *and* that tag/class (an attribute value
     may hold a `>`: the terrain canvas's `data-bubbles` and Grain's data-URI style
     do). 356 fragments today, 4 of them dead. Be aware this cannot be a blind gate:
     all 4 are a legitimate empty-state branch in `Work.astro` (`.wk-tag`,
     `.wk-promise`, `.wk-topics` and its `li`) that simply never renders while a
     writing piece is published, and their signature is identical to a real bug.
     An allowlist would be needed, which is why it is a tool to run and not a
     test that exists.
2. **At equal specificity, SOURCE ORDER decides.** Put an override **after** the
   rule it overrides. A phone override placed above the desktop rule it was meant to
   beat has shipped here more than once.
3. **`{/* … */}` IS A JSX EXPRESSION, SO WHERE IT GOES IS LOAD-BEARING.** It is
   legal **between elements** and in the frontmatter. It is **illegal between a
   component's attributes**, and it is **not accepted inside a `.map()` arrow
   body** either, because Astro parses that position as template rather than as JS.
   Getting this wrong breaks the build with a parse error that points at the
   element, not at the comment.
   - This is written down because it cost **three broken builds in one session**:
     the same mistake was made in the old single-page `research.astro` (since replaced by
     `research/index.astro` and `research/[slug].astro`), `writing/[...slug].astro` and
     `art.astro`, and the fix for the third put the comment in the `.map()` body,
     which took the error count from 8 to 19. **If a note belongs to a specific
     attribute, put it above the element or in the frontmatter** — never among the
     attributes.
   - And the reason all three reached CI: the local check was
     `npm run typecheck | grep -cE "error ts"`, which reads 0 forever because
     Astro colourises its output and ANSI escapes sit between "error" and "ts".
     **Read the `Result (N files): - N errors` summary line instead.** See
     *Conventions* below.

Related: `scroll-margin-top` is only honoured by `scrollIntoView()`. The deck moves
with `window.scrollTo()`, so a CSS rule looked correct, did nothing, and panel
titles came to rest hard against the browser chrome. The air above a panel title is the panel's own
`padding-top` (`global.css`), not a deck stop lifted above the slide, which shows a strip of sky over a
full-bleed panel.

## Conventions

- **Node:** Astro 6 rejects Node 20. Use `nvm use` (`.nvmrc` pins 24) before any
  npm/npx. CI and the deploy action read the same version — except
  `withastro/action`, which takes only `node-version` and is hardcoded to 24;
  **edit that line and `.nvmrc` together.**
- **Branch hygiene:** never commit to `main`. Cut `claude/<topic>`, open a PR,
  squash-merge. Commit messages end with the Co-Authored-By trailer.
- **CI is the merge gate.** `.github/workflows/ci.yml` runs **build → typecheck →
  test** on every PR. **Wait for CI to go green before merging** — don't squash-merge
  a PR with a pending or failing check, even when local gates passed. It also has
  `workflow_dispatch`, so the gate can be run by hand (`gh workflow run ci.yml --ref
  <branch>`) — during the 2026-08-06 Actions incident, webhook throttling meant
  pushes produced no runs at all and a PR could not be merged through no fault of
  the branch.
- **Local gates before commit: `npm run build`, `npm run typecheck`, `npm test`.**
  All three, and the middle one is not optional:
  - **`npm run build` is NOT type-checked.** Astro and vitest both hand `.ts` to
    esbuild, which strips annotations without asking the compiler. A green build says
    nothing about types — proof: `tsc --noEmit` reported a real TS2345 in
    `tests/skyShader.test.ts` while build and test were both green.
  - **`npm run typecheck` is the only place types are checked**, and it runs **two**
    checkers because neither covers the other: `astro check` is the only thing that
    reads the ~4,800 lines of `<script>` bodies inside `.astro` files (tsc can't parse
    `.astro`), and `tsc --noEmit` is the only thing that covers `tests/` and `src/lib`.
    Run it after a build so the generated content-collection types in `.astro/` exist.
  - `tsconfig.json` excludes `tmp_*` and `.tmp-*` — the ad-hoc probes the verification
    loop produces are not the project, and a gate whose output is mostly noise is a
    gate people learn to ignore.
  - **The gate is at ZERO, so a red typecheck means you broke it.** Read that literally:
    `npm run typecheck` reports `0 errors` today, and there is no inherited noise to
    excuse a new one. (This bullet previously said the opposite — it described the 86-error
    backlog `astro check` arrived with and told you a red gate "does not mean you broke
    it". All 86 were fixed in the same batch that added the gate; leaving that sentence up
    would have taught the next reader to dismiss a real failure as somebody else's mess,
    which is how a gate stops being one.)
  - **The error class those 86 were, because it will come back.** `astro check` is the only
    thing that reads the `<script>` bodies in `.astro` files, and they were written for
    years against a compiler that never looked. Almost all of it was `ts(18047)/(18049)`
    "possibly null" on canvas contexts and `querySelector` results — and the guards were
    *already correct*. The cause is that TypeScript does not carry a `const`'s narrowing
    into a **hoisted `function` declaration**, only into arrow functions, since a hoisted
    function could in principle run before the guard. The fix is a non-null alias right
    after the guard (`const nav = maybeNav;`), which makes the type true at the
    declaration so no narrowing has to survive anything. Prefer that to a `!` or a cast.
  - **Types gate the MERGE, tests gate the DEPLOY**, and that asymmetry is
    deliberate: `deploy.yml` runs tests but not typecheck, because a type error cannot
    change the shipped bytes, and blocking a deploy on it would leave the live site
    stale to punish a mistake that isn't in the output.
- **`vitest` runs with `passWithNoTests: false`**, on purpose: a mistake in the
  `include` glob would otherwise collect zero files and still exit 0, turning every
  required check green with the safety net switched off and nothing red to say so.
- **Verify visually, not just by build.** Art/layout/animation must be SEEN, and
  small-detail screenshots are unjudgeable — put the options *in the live page* as a
  switcher and look (that is what a `/proto-*` route is for; see *Routes*). When a browser is
  needed: `npm run build` → `npm run preview` → drive **one** headless Chrome over
  CDP → screenshot at scroll positions → look → refine. For faint issues,
  contrast-stretch the screenshot or toggle layers off and diff — single-column pixel
  math misleads. Helper scripts are ad-hoc; recreate as needed.
  - **One browser at a time, and never a fleet.** A parallel browser fleet took the
    owner's machine down. If a task forbids browsers, `npm run build` plus reading
    `dist/` with grep is the verification path — the last several defects here were
    confirmed exactly that way (`grep -c 'content="noindex"' dist/proto-*/index.html`,
    `grep -o '<loc>' dist/sitemap-0.xml`).
  - **rAF and screencast cannot measure fps**, and extent probes must skip
    `position: fixed` elements (the descent veil lies about page height).
- **Lighthouse bar:** Perf ≥99 / A11y 100 / Best-practices 100 / SEO 100. Don't
  regress a11y: there's a `<main>` landmark; nav is real `<button>`/`<a>`; decorative
  canvases, rails and the cow bubble are `aria-hidden` or labeled.
  - **A11y 100 does not test WCAG 1.4.13** (content on hover or focus), and neither does axe.
    A tip that covers text must be dismissible and hoverable: the paper page's two (Figure 2's
    readout, a symbol's Notation row) go on Escape, without the pointer or the focus moving,
    and stay while the pointer crosses onto them (a shown tip takes the pointer, and a bridge
    spans its gap; `tests/distSmoke.test.ts` reads both in the built CSS).
- **Pure logic is tested.** Anything non-trivial in `lib/` gets a vitest spec, and
  so does every *invariant between two files* (`nav.test.ts`: every page is a nav
  href; `writingContent.test.ts`: the schema enum
  matches `KINDS`; `pageStops.test.ts`: no stop points at an id the page won't emit;
  `viewport.test.ts`: the breakpoint still says 640; `artSizes.test.ts`: both
  `sizes` hints still describe the layout that decides them). They're the only
  automated safety net, and they're where "two places must agree" is actually
  enforced.
  - **`commentPaths.test.ts` extends that to PROSE, and it is the newest member of
    this family for a specific reason: this file's own policy created the gap.**
    Comments here are load-bearing by design, which also makes them *references* —
    and references rot on every delete, silently, because nothing reads them.
    `astro check` and `tsc` do not parse a comment; a stale path looks exactly like
    a true one. An audit found six live cases, the worst being `Rules.astro` and
    `complexity.ts` both promising that the two retired Rules drawings "stay in the
    tree, unreferenced and still fully tested … either can return" — about modules
    deleted along with their specs, and listed in *Rejected — do not rebuild* right
    here. That sentence aimed the next agent at the exact work this file exists to
    prevent. The same class had already been swept by hand twice.
  - It asks "does a comment claim a path is HERE", not "does every path exist" —
    because the rule above (*say what is true rather than only deleting the false
    part*) means deletions get written down on purpose, and `index.astro` naming the
    terminal's deleted `data/script.ts` is the opposite of rot. A deletion marker
    near the mention passes. **What no gate can catch is a false claim about LIVE
    code** — the same audit found the homepage's old rail (`Toc.astro`, since replaced by
    `SideRail`) asserting "the Solve slide is dark in
    both themes", false since that design was rejected, and a real legibility defect.
    That half is still a human reading carefully.
- **A TEST IS NOT A CONSUMER. `noUnusedLocals` cannot see a dead export,** so
  `lib/` accumulates functions whose only caller is their own spec, and the spec
  makes them look alive. A sweep removed **13 such exports and ~470 lines**
  (`discoveryOf`, `perceivedField`, `walkerKnownness`, `currentStop`,
  `luminanceRange`, `bestConstant`, `scenarioLeaves`, `decisionVariables`,
  `zoneAt`, `maxDarkwardExcursion`, `GLOBAL_MIN_IS_KNOWN`, `PATH_END`, `phases`).
  The check is a grep for `\bname\b` over comment-stripped `src/**/*.{ts,astro}`,
  counting `src` and `tests` separately — **not** `tsc`, which is blind to it.
  - **That grep has a blind spot, and a second sweep found ~600 more lines in it:**
    an export whose only caller is *another export in the same file*. Counting
    `src` hits outside the module misses it, and counting inside the module sees a
    caller. `lib/factorModel.ts` had a dead half — the whole fan
    (`fanBeams`, `beamQuad`, `expressionTerms`, `FAN`), orphaned when
    `FactorFan.astro` went — and `lib/knowledge.ts` held a complete superseded
    model (`knownAfter`, `isKnown`, `knownness`, `discoveredAt`, `knownMean`)
    beside the one the page runs. **Trace the call graph from what `src` imports**,
    not from each export's name. And an import is not a read: the rest of
    `factorModel`, with `signalRubric` and `signalWeights`, was reached only through
    `/proto-sketches`' `SketchData` fields that no sketch read (and `capability` by
    nothing but its spec). All four, ~1,200 lines with their specs, were deleted with
    that route.
  - **When the dead half has the spec, re-point the spec before deleting it.**
    `knowledge.test.ts` was the ONLY guard on the sentence the Story slide prints —
    *"a deeper basin is now visible — it was there the whole time"* — and it was
    asserting it against the dead model. The two models disagree: the dead one
    found the basin at the last stop, the live one just past the seventh. The
    printed claim was unguarded while the suite was green. It now walks the page's
    own path via `trailSampler()` (moved into `lib/descentPath.ts` for exactly this),
    and a radius retune that reveals the basin early fails two tests.
  - **THE EXCEPTION, and it is a real one: a function written so a test can assert
    an invariant on live production data.** Those stay, and they say so in their
    own doc comment — `sumsToWhole` ("used by tests to catch a hand-edited split
    that no longer sums to the whole"), `bellmanResidual` ("exposed so the TEST can
    check the algorithm rather than the test re-implementing it"), `contrastRatio`,
    `luminance01`, `inBounds`. Deleting one of these does not remove dead code, it
    removes a check. **If you add one, document why in the declaration** — that
    comment is the only thing separating it from the 13 above.
  - **What is NOT an exception: a "printer".** `tests/factorInspect.test.ts` and
    `tests/perfDiag.test.ts` were 115 lines with **two assertions between them**,
    console-logging a table for a human to read, and they were the sole reason two
    exports stayed alive. Both deleted. If per-frame cost is worth watching, assert
    a budget and point it at a function production actually calls.
  - **Two cautions learned doing this**, because both nearly shipped a bug. A
    brace-matcher that starts counting at the declaration line is wrong — a
    multi-line signature containing an inline object type
    (`pathAt: (t: number) => { x: number; y: number }`) balances to zero *inside the
    signature* and cuts the function in half; match from the brace that is last on
    its line. And a bare `\bname\b` grep over tests gives false positives:
    `starIdentity.test.ts` has a local `const phases = new Set()` about dot pulsing
    that has nothing to do with `trajectory.phases()`. **Read each hit.**

## Taste rules (these define the look — hold the line)

- **Palette discipline:** ONLY the tokens in `tokens.css` (paper, ink-1..5,
  ochre, indigo, seal, plus the derived `--hairline-rgb` and `--rule` — and, under a page
  register only, its own tokens and its overrides of the role tokens: /projects' eight
  `--draft-*` and two knockouts, the research routes' eight `--sheet-*`; see *Themes* — and on
  `/`, which is not a register, `--rail-ink` and `--rail-focus`, the rail's resting ink and
  focus ring (see *Navigation*), the six `--panel-*` of `styles/slides.css`, the five paper
  panels' ground and inks per theme, and Choice's own chart colours, `--c-h*` and `--c-p*`).
  - **`--rule` exists because `/experience` was already using it.** Two rules there declared
    `border-bottom: 1px solid var(--rule)` against a property defined nowhere, which by spec makes the whole
    shorthand invalid at computed-value time — every longhand falls back to its initial, and
    `border-bottom-style`'s initial is `none`. Measured: `none` / `0px` on all three group titles and every
    award row. Three section dividers had never drawn. It is now
    `rgba(var(--hairline-rgb), 0.32)`, so it re-themes for free.
    **`tests/cssVars.test.ts` now fails the build on any `var(--x)` without a fallback that nothing
    declares** — nothing else could catch it: the build is happy (it is valid syntax), `astro check` and
    `tsc` do not read CSS, and a missing border looks like a design choice. Collecting declarations needs
    three sources, and a CSS-only scan reports false positives: stylesheets, inline `style="--l:0"`
    attributes, and runtime `el.style.setProperty()` (`sections/Rules.astro` sets `--len` and `--i` from
    measured geometry). Note that Rules.astro *documents* an unset `--len` as acceptable — the real
    distinction is not whether a var resolves but whether the initial-value fallback is a state someone
    chose.
  In the **light** theme the vermilion **seal**
  (`--seal #b23a2e`) is the ONLY saturated color. Never pure `#fff` / `#f00`.
  **Deliberate exception — the dark theme.** `html[data-theme='dark']` is the
  "terminal galaxy": it intentionally swaps the ochre accent for a phosphor
  **emerald** (`--ochre: #66c28c` under dark) — a second saturated color, on
  purpose, because the terminal/coder identity is the whole point of dark mode
  (the user chose it seeing both this and a "night descent" variant live). Do
  NOT "fix" this back to ochre. Seal red stays the brand colour in both
  themes (`--seal`, brightened to `#e0574a` for the dark ground). The IT seal
  itself is drawn on no page since the footer went; it is the favicon and the
  OG card.
  **And the exception to the exception: the registers have no emerald**: /projects' and
  the research routes' palettes set `--ochre` to the seal in both themes (see *Themes*), so
  seal red is the only saturated colour on them in dark too.
- **Motion:** animate only `transform` / `opacity`; NEVER animate `filter: blur`
  (bake it). ALL motion is gated behind `@media (prefers-reduced-motion:
  no-preference)` via `lib/motion.ts`. The no-motion state must look *finished* —
  it's also the Firefox fallback (`animation-timeline` isn't in Firefox yet), and
  it's what a reduced-motion reader gets instead of the deck.
  - **Nothing new that moves on its own runs past five seconds** — WCAG 2.2.2 (Level A),
    which neither Lighthouse nor axe tests, so A11y 100 says nothing about it. The limit is
    `MOTION_LIMIT_MS` in `lib/motion.ts`. On /projects, the idle prompt's cursor blinks four
    times (4.2s, counted from when it appears) and rests solid, and manifold's MP4 plays only
    for the first five seconds after the fan opens, then rests on the frame it reached and
    plays again while its card is hovered or keyboard-focused (`videoPlays()` in
    `lib/galleryLayout.ts`). Both used to run forever beside what a reader is reading.
    `tests/motionLimit.test.ts` reads the cursor's CSS literals against the limit.
    **So did the cow, and this rule claimed the page met it while the cow did not.** Its idle
    chatter popped a bubble, typed and hopped beside the listing every 14-32s for as long as
    the page was open, under reduced motion too (minus the typing and the hop), and pressing
    it only said more: the auto-advancing carousel 2.2.2 is written for. Now it says the
    greeting and at most `idleLines()` (`lib/cowTalk.ts`: two, none on a phone or under
    reduced motion) unprompted lines per page view, then stops scheduling them; the rest of
    the idle set is a press away. `tests/cowTalk.test.ts` adds up what it does unasked from
    PlushCow's transition and hop literals and `TYPE_MS`, ~3.4s, and holds it under the
    limit.
    **The research routes and the rail are held to it, and to 2s per animation.** What moves
    there unasked moves once, by `transform` and `opacity` (the rail's entrance in CSS, the rest
    through `scripts/motion.ts`), and ends within 2s (`MOVE_MAX`). `tests/motionTiming.test.ts`
    holds each single duration to it, and each staggered batch as it is computed: the rail's entrance
    (`stagger` over `RAIL`, every row in by `RAIL.enter`), the paper page's highlights and a figure's
    arrows (`highlightDelay`, `arrowDelay`: the last ends within `MOVE_MAX` of the first's start,
    however many), and the reveal, whose `REVEAL.max` caps any one delay. Not held: the /research
    cards' title underlines, `--k` lines × `CARD.underlineStep` in CSS, which stay within 2s up to a title
    of sixteen lines (the titles have two or three), and the time a highlight waits for its block to
    rise before its batch starts. Nothing on the screen the reader
    lands on is held back, nor anything above it (a deep link, a restored scroll), and what waits
    runs at the latest after `MOTION_LIMIT_MS` on screen. Under reduced motion each is its finished
    state at once. The timings are `lib/motionTiming.ts`'s (`REVEAL`, `RAIL`, `PAPER_PAGE`, `CARD`,
    `MOVE_MAX`), not here.
    **Everything older is not held to it yet, and this is the list known, not a guarantee**: the hero terrain, the fluid sky, the drafting field, SkyWash's three breathe
    loops and the `.descent::before/::after` drifts run for as long as they are on screen, and
    `/`'s `.scroll-cue` bobs forever in the foreground (`Heights.astro`). That is the site's
    older pattern and a known gap against 2.2.2, not a precedent for new motion in the
    reading area.
- **Loading states are designed, not default.** No bare grey rectangles — a
  loading tile uses a palette-tone placeholder with a transform-only shimmer (see
  `.tile` in `art.astro`), gone the instant the image decodes.
- **Pixel art has no curves.** The cow's speech bubble is built from one number
  (a 10px cell, the owner's pick of two mocks): border thickness, the MOO glyph and
  the tail's steps all measure exactly one cell. That is what makes it read as pixel
  art rather than as a rounded chat bubble with a blocky font. `MOO!` is *type*,
  drawn from a matrix in `data/cowGlyph.ts`.
- **Favicons:** the browser tab uses the SVG seal; Google Search renders a
  *raster* favicon, so PNG fallbacks (48/32/180/192/512) + a webmanifest +
  `og:image` ship from `public/`. Regenerate them from `favicon.svg` if the seal
  changes (sharp rasterizes SVG→PNG).
- **`public/` in full, since two of its twelve top-level files are easy to be surprised by:**
  `favicon.svg`, `favicon-32.png`, `favicon-48.png`, `apple-touch-icon.png`,
  `icon-192.png`, `icon-512.png`, `og-card.png`, `site.webmanifest`, `robots.txt`,
  `cv.pdf`, `google39d8e886995c3420.html` (a Search Console verification file — do
  not delete it as junk) and **`sitemap.xml`** — plus one directory, `public/projects/`:
  manifold's two screensaver MP4s for /projects, written by `tools/vendor-projects.mjs`
  (a video is not an image, so it is served by URL rather than through `astro:assets`).
  - **`public/sitemap.xml` is a static index, NOT a list of routes.** `@astrojs/sitemap`
    emits `sitemap-index.xml` + `sitemap-0.xml`, and `sitemap-0.xml` lists every route less
    `/404` and the `/proto-` ones. This third file is a `<sitemapindex>` whose one `<loc>` is the
    generated `sitemap-0.xml`, so the conventional `/sitemap.xml` name resolves too. A route
    change never touches it: the generated child gains or loses the URL. What would break it is
    the child's name changing, and `tests/distSmoke.test.ts` reads both — that the built
    index points at `sitemap-0.xml`, and that `sitemap-0.xml` lists the research routes.
  - `og-card.png` is **2400×1260**, while `BaseLayout` declares `og:image:width`
    1200 and `height` 630. Tracked in issue #67.

## Rejected — do not rebuild

Kept here so the same work isn't done a fourth time. Each of these was built,
looked at, and turned down:

- **Pointer/mouse interaction on the hero** — built and rejected 2026-08-06.
- **A phone-specific content design** — built three times, reverted every time.
  Phone content stays in sync with desktop; see *Phones*.
- **CSS scroll-snap for the deck** — measured stuck; see *The deck*.
- **Five showpieces** for the explainer slides, three of them hand-drawn props —
  each "looked like it meant something without meaning anything". The replacement
  rule: the surface has to be real math, computed.
- **The feasible polygon and the decision lattice** in the Rules slide — exact,
  unit-tested, and *still wrong for the slide*, because both shrink something on a
  slide whose whole job is that the problem grows. See *The homepage*.
- **A dark panel for emphasis** in the light theme — read as a bug, not emphasis.
- **The scripted terminal** — the site's only React island, deleted on the owner's
  instruction ("you can delete the terminal at the bottom, it's already useless").
  Its data, engine and spec went with it; git holds them.
- **A factor model of the person** — `r_TIAN = α + Σ β_k f_k + ε`, its betas from
  LLM-scored evidence for every `profile.ts` item, then breadth statistics (HHI,
  effective dimensions) over the same scores. The framing was rejected (a return
  implies a P&L a person does not have), no page showed a number once the fan went,
  and every `profile.ts` title edit still forced a re-scoring. Deleted on the owner's
  instruction ("delete them"): `lib/factorModel.ts`, `lib/capability.ts`,
  `lib/signalRubric.ts`, `data/signalWeights.ts` and their specs; git holds them.
- **The /proto-sketches gallery** — five still SVG candidates for the bottom of the
  homepage, a slot the explainer slides and Story filled. DescentPath and Story's type
  came out of it; the route and its harness were retired ("Retire it"). Its still-frame
  gate stays, in *Stack*.

**From the /projects redesign.** These were built in its design mockups rather than in
the repo, looked at there, and turned down — so git does not hold them, and the design
doc (`docs/superpowers/specs/2026-11-02-projects-page-design.md`, local; `docs/` is
gitignored) is the record:

- **A sweeping light across the background** — a moving horizontal band; the owner
  rejected it because it competes with the reading. After the boot's two pings the
  field does nothing but drift, "so that readers can read quietly".
- **The "blueprint" (blue) and "phosphor" (green) backgrounds** — colour variants of the
  drafting field. Seal red is the only colour on the page, in both themes.
- **The cursor-dent field** — isolines that dented around the pointer. It lagged on the
  owner's machine, and a cursor-driven background competes with the reading, the same
  reason as the sweeping light.
- **The liquid-metal button** — a WebGL shader; its swirls echoed the contour
  background, so the button read as part of the field.
- **Brushed steel as a site-wide button** — liked, but "not applicable to other pages",
  and weak on paper. Buttons are page-own instead: one anatomy, a skin per page (see
  *The concept*), so a page that wants steel can have it as its own skin.
- **Boot A** — the first approved boot, which held the gallery and the listing invisible
  until ~3.2s. Measured in the mockup at Lighthouse's desktop size: **LCP 3,192ms**,
  because Chrome does not count the banner or the gallery fading in, so the listing's
  last line became the largest element. Boot B paints the banner and the gallery on the
  first frame and measured **108ms** there. The rule it leaves: nothing the reader came
  for starts invisible — the same arithmetic as the homepage's deleted `?seq=1` spike.
