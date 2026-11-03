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

The homepage is the descent. Around it are the **reading pages** — /research,
/writing, /writing/&lt;slug&gt;, /projects, /experience — and **/art**, a quiet museum
room for calligraphy and photography. Every route except /projects rides the same sky
(/projects sits on the plain drafting ground its `data-page` palette is measured on), and the
reading pages deliberately share one margin, one measure and one back-link
treatment: pages that each guessed their own layout would read as several sites.
Borrow composition from the neighbouring page rather than inventing it.

**Restraint is the aesthetic.** Text is English-only — the literati feel comes
from composition and negative space, never from displayed CJK glyphs. The lone
exceptions are deliberate math glyphs (∇/λ/μ), rendered as build-time MathML.
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
  `@astrojs/check`, `typescript`, `vitest` — is a devDependency, and only output
  ships. `grep -c three package.json` → 0.
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
    library would have cost. And the gate is written down in `lib/sketches/kit.ts`:
    *a still frame first, in SVG, judged in one look — three.js only after a frame
    survives being looked at.* Four of the five rejected showpieces were only
    judgeable once finished, which is what the cheap gate exists to prevent. So: no
    island, and no 3D library either, until a still frame has earned one.
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
    preload — removing it measured a worse FCP (1956 → 2333ms; see BaseLayout).
- **Math in markdown is typeset at build time.** `astro.config.mjs` wires
  `remark-math` + `rehype-katex` with **`output: 'mathml'`**, which is the
  load-bearing option: KaTeX's default HTML tree needs `katex.min.css` and ~half a
  megabyte of `KaTeX_*` webfonts, and a third downloaded family is against the font
  rules above. MathML ships as static `<math>` markup — zero client JS, zero CSS,
  zero fonts. `katex` is a **devDependency** and stays one; only its output ships.
  `lib/equations.ts` holds the same guarantee for build-time equations in `.astro`,
  and `tests/equations.test.ts` asserts it.
- `astro:assets` optimizes gallery images (responsive `widths`, **webp — not avif**). This line said
  "webp/avif" for a long time; `ls dist/_astro/*.avif` is empty and nothing in `astro.config.mjs` asks
  for avif, so no page has ever shipped one. Either add the format deliberately or leave it — but do
  not read this line as evidence it is already happening.
  - **NEVER put a native image width in a `widths` array.** `/art`'s calligraphy asked for
    `widths={[480, 900, w.src.width]}` — 1727 for `spring-couplet-stele`, a **1342 KB** webp — on the element
    that is also `fetchpriority="high"`. At `40vw`, a 1440px viewport at DPR 2 needs 1152 device px, so that
    file became the page's high-priority LCP resource; the 900w variant is 139 KB. Capped at
    `[480, 900, 1200]`, the chosen candidate is **387 KB**. The photo grid never had the bug — it caps at 900
    via `photoSizes()`, pinned by `tests/artSizes.test.ts`.
  - **The lightbox's source is a processed webp at NATIVE pixels, via `getImage()` — not `ImageMetadata.src`.**
    It was the untouched original: 38.6 MB of JPEG across 44 works, 0.6–2.2 MB per open. The pixels are
    deliberate and must stay — `scripts/artGallery.ts` zooms to **6×**, so capping the long edge would quietly
    degrade the feature while the byte count improved. Only the container changed.
    It also turned waste into the fix: `<Image>` already emitted a native-dimension variant for the `src`
    attribute independent of `widths`, which a browser with `srcset` never requests — 18.6 MB of pure build
    output, now the thing actually being used. `tests/distSmoke.test.ts` weighs the file a browser would
    *choose* rather than checking the array, because the array is a means and bytes on the critical path
    are what hurt — and it derives the device-px figure from the shipped `sizes` instead of hard-coding it,
    after a first version hard-coded the wrong one (see the next bullet).
  - **`sizes` MATTERS AS MUCH AS `widths`, and fixing only one left two thirds of the over-fetch.** The
    calligraphy hint was `40vw` — a fluid bound for an element whose width is a CONSTANT. `.cal :global(img)`
    is `width: auto; max-width: 100%; max-height: min(82vh, 820px)`, so for a tall work the HEIGHT cap binds
    and the width is `cap * ar`, bounded by `820 * ar` at any window height: **414 CSS px** for the stele,
    against the 512–1536 that `40vw` declares. So DPR 2 still chose the 1200w variant (396,030 B) where
    900w (142,128 B) covers the 828 device px actually needed. The arithmetic that justified it ("needs 1152
    device px", "rendered at 576 CSS px") reasoned from the viewport rather than from the cap, and had been
    written down five times — including into a test — which is the strongest form of "this will stop the next
    reader from looking". `calSizes()` now derives it from the cap, and `tests/artSizes.test.ts` pins
    `CAL_MAX_H` against the `820px` in the stylesheet so the pair cannot drift.
  - **Nothing below the fold is eager.** The photo grid used `i < 9 ? 'eager' : 'lazy'`, and the grid starts
    ~2,100px down — past two calligraphy blocks, each as tall as `min(82vh, 820px)` allows. Those nine were
    **754,378 B of the 896,506 B** `/art` fetched on first load, 84% of its image payload, for content nobody
    had scrolled to. First-load image bytes are now 142,128. Deferring was safe because the layout never used
    them: `buildRows()` solves each row from the build-time `data-ar`, not from a decoded image.
  - **Still true and not fixed:** **44** original JPEGs (**38.65 MiB**, 55% of a 73 MB artifact) are emitted
    into `dist` that nothing references — `grep` across every .html/.css/.js/.xml in `dist` finds zero hits
    for any of them. 42 are photos: `data/artworks.ts` globs them with `{ eager: true }`, and an eagerly
    imported `ImageMetadata` bakes a URL to the original, so Vite cannot prove it unused. The other 2 are the
    calligraphy masters, which arrive by static import. (This bullet said "42 / 36.3 MB" — correct for the
    photos it named, but it omitted the calligraphy pair, and a comment in `art.astro` separately claimed the
    originals "drop out of `dist` entirely", which was simply false.) Costs deploy artifact size and zero
    visitor bytes; see issue #60.
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
  layouts/BaseLayout.astro          # head, astro:fonts, meta/OG/JSON-LD, favicons, the page-load veil, CornerNav, ClientRouter
  content.config.ts                 # the `writing` collection + its frontmatter schema (the ONLY content collection)
  content/writing/*.md              # the pieces themselves — a new one is a FILE, not a code change
  data/profile.ts                   # ALL résumé content: name, roles, rolesSub, phd, bio, researchInterests, timeline, publications, projects + inProgress, awards, links
  data/nav.ts                       # PAGES — the canonical page set (see Navigation)
  data/writing.ts                   # the writing TAXONOMY (KINDS) + buildKinds(), the one seam to the markdown
  data/artworks.ts                  # gallery: calligraphy entries + globbed photos (+ photoNotes.ts for per-photo copy)
  data/{define,desk,making,story}.ts                       # the homepage explainer's copy + numbers, per slide
  data/{cowGlyph,ruleGlyphs,tickerGlyphs,signalWeights}.ts # pixel-art matrices and weights the slides draw from
  lib/deck.ts                       # pure deck stops: WHERE the homepage scroll may rest, and what's next — unit-tested
  lib/pageStops.ts                  # pure Stop trees: one tree per page drives BOTH its rail and its section ids — unit-tested
  lib/viewport.ts                   # PHONE_MAX_WIDTH = 640 + isPhone() — the one phone gate
  lib/motion.ts                     # prefersReducedMotion() — the one motion gate
  lib/skyShader.ts, skyPalette.ts, skyLegibility.ts   # the fluid sky: GLSL, ramps, and the text-contrast policy
  lib/terrain.ts, terrainRender.ts  # pure terrain math (field/grad/runDescent/colormap/project) + its painter AND the memoised grid cache
  lib/marchingSquares.ts            # isoRuns(fn, bounds, level, res) — the ONE stitched kernel; descentPath and terrainContours are both callers. Plus isoSegments: unstitched, over a pre-sampled grid, for lib/draftingField.ts (redrawn per frame, so the O(n²) stitch is unaffordable)
  lib/terrainContours.ts            # the hero field's isolines + levels, memoised — the intro's survey pass
  lib/introTimeline.ts              # the homepage intro's SCHEDULE only — pure. The decision and the ?dur= clamp live in pages/index.astro's is:inline script (it must run before first paint, so it cannot import); lib/introSession.ts reads what that publishes
  lib/descentPath.ts, trajectory.ts # the career descent graph's field and route
  lib/{bellman,factorModel,problemSize,complexity,policyPnl,scenario,split}.ts   # the explainer slides' real math
  lib/{justify,scrollspy,pixels,cowSpeech,knowledge,capability,paperMath,equations,signalRubric}.ts
  lib/sketches/{kit,batch1}.ts      # the showpiece prototype harness — a sketch is (ctx) -> SVG string; /proto-sketches is its gallery
  sections/{Heights,Interlude,Choice,Rules,Solve,Story,Work}.astro   # the homepage, in scroll order — ALL of sections/, there is nothing else in it
  sections/Signature.astro          # links + seal — rendered INSIDE Work.astro, not as its own slide
  components/Deck.astro             # the deck's event plumbing (homepage only)
  components/proto/FluidSky.astro   # the WebGL sky canvas — on 7 content pages despite the proto/ path (/projects and /proto-sketches omit it)
  components/SkyWash.astro          # woven warm/cold broken-color wash over the sky — CSS + a small script (it is in the Interactivity list below; this line used to say "pure CSS")
  components/TerrainHero.astro      # the hero's terrain canvas (Heights only)
  components/DescentPath.astro      # the career descent graph (inside Story)
  components/SideRail.astro         # the reading pages' marginal rail, driven by a Stop tree
  components/Toc.astro              # the homepage's thin left-margin TOC, driven by homeStops()
  components/CornerNav.astro        # the always-visible glass nav + theme toggle
  components/PlushCow.astro         # the cow, at three scales, with a pixel speech bubble
  components/{SealMark,Grain}.astro
  scripts/artGallery.ts             # the /art page behavior (justified rows, placard, scrollspy, lightbox)
tests/*.test.ts                     # vitest — every pure lib module, the data/route invariants, the content seam
```

### Routes

**Nine pages, not two**, and that is the number `npm run build` prints (`9 page(s)
built`) — check it against the build rather than against this table, and `ls
src/pages` beats both. This line read "twelve" for a while, left over from when three
more prototype routes existed and the table below still named all four.

| Route | What it is |
| --- | --- |
| `/` | the descent — the homepage deck |
| `/research` | papers, in full: the idea, the method's equations, results |
| `/writing` | the writing shelf — kinds, each listing its markdown pieces |
| `/writing/<slug>` | one piece, rendered from `src/content/writing/<slug>.md` |
| `/projects` | shipped artifacts with links |
| `/experience` | the timeline — education and roles |
| `/art` | calligraphy + photography |
| `/404` | the not-found page (noindex, no canonical) |
| `/proto-sketches` | the one surviving **prototype** — the showpiece sketch gallery |

**The prototype routes are internal, and there is one of them left.**
`/proto-sketches` survives; `/proto-showpiece`, `/proto-ladder` and `/proto-paper`
were retired once they had answered their question (the reasons are in
`tests/protoNoindex.test.ts`, which is where the count lives now). Git holds them.

They exist so a visual choice can be made by looking at the real thing in the real
page rather than at a screenshot (see the project's own habit: put the options in
the page as a switcher). Every one must carry `noindex={true}` on `BaseLayout`
**and** stay out of the sitemap — `astro.config.mjs` filters `/proto-` from the
sitemap already, and `tests/protoNoindex.test.ts` globs `src/pages/proto-*.astro`
and asserts the prop, so a *new* one is caught the moment it is written. That suite's
floor is **1, not 0**, deliberately — renaming the `proto-` prefix must turn it red
rather than leave it iterating over an empty glob, the same hole as `passWithNoTests`.
Don't "tidy" the floor down. Their rendered bodies quote internal review notes, so an
indexed one is a real leak, not an untidiness.

### Interactivity — vanilla scripts, and the contract they keep

`Deck`, `Toc`, `SideRail`, `CornerNav`, `TerrainHero`, `FluidSky`, `SkyWash`,
`DescentPath`, `PlushCow`, the three explainer slides (`Choice`, `Rules`, `Solve`),
`BaseLayout`'s no-FOUC theme resolver and veil, `pages/index.astro`'s intro decider,
the `/art` and `/research` pages, and `/projects` — `pages/projects.astro` (the boot
decider, the ask dispatcher and the cow's talk) plus six of `components/projects/*`:
`DraftingField`, `Gallery`, `SelectedRows`, `WorkshopCards`, `ProjectAsk` and
`TerminalHeader` (the boot) — all need JS. That is the whole list, 23 files. Every one
is a plain Astro component or page with a `<script>`, **not** an island (see *Stack*).

**Two corrections to how this list is checked, because the obvious check misleads.**
`grep -rln '<script' src` returns **26 files** against the 23 surfaces above, and the
difference is not all drift: `lib/introTimeline.ts`, `lib/motion.ts` and
`lib/descentPath.ts` match on the string `<script>` inside their own COMMENTS. Filter
to `src/{components,sections,pages,layouts}` before trusting a count. The real gap this
caught was `pages/index.astro`, which the list had never named. (It read 19 against 16
until `/projects` added seven surfaces across several commits, most of which did not
update it.)

**And `index.astro` is the one surface that does NOT keep the contract below, on
purpose.** Its intro decider is `is:inline`, so it runs at parse time and exactly once
— no `astro:page-load`, no teardown. That is the whole reason it exists: a bundled
script is deferred until after parse, by which point the sky has already painted its
finished colours, which is the flash it was written to remove. `BaseLayout`'s two
inline scripts are the same exception for the same reason, and so is `projects.astro`'s
boot decider: it sets `html.projects-boot` before the banner and the gallery parse, or
the finished listing and the open fan would paint and then be taken away. It ships
`lib/projectsBoot.ts`'s `shouldBoot` as its own source rather than a retyped copy, so the
tested function is the one that runs. Everything else here:

- **Re-init on `astro:page-load`, with a teardown**, because `ClientRouter` is on
  and a View Transition replaces the DOM without a fresh page load. A script that
  only runs at parse time works on first load and is dead after the first
  navigation.
- **Pure logic goes in `lib/`, plumbing stays in the component.** That split is
  why `deck.ts`, `pageStops.ts`, `terrain.ts`, `justify.ts` and `scrollspy.ts`
  have specs at all — the parts worth testing are not tangled in event handlers.
- **Both gates are asked, not re-derived**: `prefersReducedMotion()` from
  `lib/motion.ts`, `isPhone()` from `lib/viewport.ts`.

## The homepage — the deck

Section order (= the descent), all seven top-level `<section>`s of `main.is-slides`:

**Heights** (hero — de-centered: name bottom-left, bio top-right, terrain canvas
full-bleed behind) → **Interlude** (the tagline in the warm sky) → **Choice** →
**Rules** → **Solve** (the three-slide explainer) → **Story** (the editorial, with
the descent graph in a sticky column beside it) → **Work** (the appendix: papers,
writing, projects — with **Signature**, links + seal, inside it).

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
every block has its own route, and the corner nav plus the footer carry the doors.

`sections/Mountains.astro` — the old résumé section — **is deleted**, and so is
/proto-paper, the last route that rendered it. This file used to say it was "kept on
purpose … so the markup is recoverable without git archaeology"; it isn't kept, and
git is the archive. What *does* still reference it is a handful of comments that
were written while it existed: `lib/skyShader.ts` and `components/proto/FluidSky.astro`
each explain an amplitude decision in terms of where Mountains used to sit, which is
a historical note on a live decision and is fine to leave.

The loose end it left behind — `ProjectCard.astro`'s unreachable `'teaser'` variant,
tuned for the dark Mountains gradient — is gone with the card itself: the component
was **deleted** by the /projects redesign, whose data model dropped every field it
rendered (`tagline`, `blurb`, `highlights`, `stack`, `links`).

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
enough to engage the deck on a viewport whose styles think it's a phone).

**The number lives in two places and they are synced BY HAND.** `@media
(max-width: var(--x))` is not valid CSS, so there is no way to feed one value to
both. **If you change `PHONE_MAX_WIDTH`, change every `@media (max-width: 640px)`
block with it.** `grep -rn 'max-width: *640px' src` returns **19 hits in 13 files**,
and **four of the 19 are prose, not rules** — `viewport.ts` ×2 (its own doc
comments) plus `global.css:178` and `global.css:327`, which describe the
breakpoint in comments rather than declaring it — and **one is a `sizes` hint**:
`projects/Gallery`'s `sizes="(max-width: 640px) 240px, 330px"`, the phone strip's
card width, which must move with the strip's block. So there are **14 real CSS
blocks across 12 files**: `experience` ×2, `projects/Gallery` ×2 (one of them
`@media not all and (max-width: 640px)` — the desktop-only card lift, written
negated so this grep still finds it), and one each in `global.css`, `CornerNav`,
`Toc`, `DescentPath`, `FluidSky`, `Heights`, `projects/TerminalHeader`, `404`,
`research` and `writing/[...slug]`. (`ProjectCard.astro`, which carried one, was
deleted with the /projects redesign. `global.css:343`'s `min-width: 641px` is the
same breakpoint spelled so this grep misses it — check it by hand.)
  Two notes on how this count has gone wrong before, because it keeps doing so.
It read "15 hits … 13 real blocks … `global.css` ×2" — overcounting `global.css`
because one of its two prose mentions is `max-width:640px` with **no space**,
which the documented `grep -rn 'max-width: 640px' src` silently misses while a
careless re-count catches it as a rule. Use the pattern above, with the `*`, and
classify each hit rather than subtracting a remembered number of prose lines.
Earlier still it listed "the two proto sections": there are no proto *sections* —
`src/sections/` holds only the seven homepage slides plus Signature — and the one
surviving proto route, `/proto-sketches`, breaks at 820px, not 640, because it is
an internal gallery and not part of the phone treatment.
`tests/viewport.test.ts` pins the value so a silent drift shows up as a failure
rather than as a phone with half a treatment.

**The phone gets the same CONTENT as the desktop.** A phone-specific content
design was built **three times and reverted every time** — do not rebuild it. The
phone treatment is *bug fixes only*, and the whole of it is:

- the corner nav collapses to a **menu mark** that swaps for the list when opened
  (mutually exclusive, so the capsule can never grow a second row);
- the **deck disengages** — measured in real WebKit, 5 of the 7 slides are taller
  than the viewport (rules 1.84 screens, story 3.07 on an iPhone 14; 2.5 and 4.2 on
  an SE), so its "every slide owns the screen" contract is simply false there. All
  four reported symptoms — text resting under the fixed nav at 7 of 15 stops, one
  swipe scrolling twice, a light flick going nowhere, one swipe skipping a screen —
  follow from the deck resting *inside* slides, and turning it off removes all four
  by deleting behaviour rather than adding compensation;
- the **Toc hides** (`display: none` — a 38px margin rail has no margin to sit in);
- the **descent graph** drops its in-frame labels and becomes a block with its own
  height, with the sentence that explains it read *after* it rather than across it;
- the **fluid sky canvas is skipped** entirely under 640px.

## Navigation & structure

- **`src/data/nav.ts` `PAGES` is the canonical page set** — "where can you go from
  here", in the site's own hierarchy (research first, art last; /writing directly
  after /research because it's the same subject at a different formality). It lives
  in `data/` because the page set is a *fact* about the site: the site once shipped
  a link to `/experience` before that page existed, and `tests/nav.test.ts` now
  asserts every href resolves to a real route, with no duplicate hrefs or labels.
  `CornerNav` renders it.
- **`profile.ts`'s `links` array is a SECOND list, and it HAS diverged before.**
  It exists for a different job — the footer, the CV button, and the GitHub/LinkedIn
  hrefs that JSON-LD's `sameAs` reads — but it also enumerates pages, and it once
  went a whole release missing `/writing` while `PAGES` carried it, so the corner nav
  offered five doors and the footer four. **The two lists now hold the same five
  pages**, and the seam is no longer trust-based: `tests/distSmoke.test.ts` reads the
  built homepage's footer nav and asserts every `PAGES` href reaches it, plus the
  converse — that the footer never links a page the build didn't produce. A human
  never caught the original drift; that test did.
  - They agree on **membership, not on order**, and a comment in `profile.ts` claims
    otherwise ("The order matches PAGES so the two read the same way round"). It
    doesn't: `PAGES` runs research → writing → **projects → experience** → art, and
    `links` runs research → writing → **experience → projects** → art. Nothing reads
    order across the two lists, so this is cosmetic — but don't trust that comment as
    a spec, and if you make the orders match, fix the comment or delete it.
  When you add a page: **`PAGES` is canonical, `links` must be updated by hand, and
  the dist smoke test is what tells you that you forgot.** Anything that just needs
  "the pages" should read `PAGES`.
- **`src/lib/pageStops.ts` is one tree per page, and it drives BOTH the rail and
  the page's section ids.** This is structural, not stylistic: `/research` used to
  render N papers with `featured.map(...)` while building its rail with
  `featured.some(...)`, so N papers collapsed into one flat anchor set pointing at
  ids emitted once per paper — `getElementById` takes the first match, so every
  "Method" link jumped to paper 1. Now the same function that names a stop's anchor
  hands the page the id to render, so **a stop cannot point at an id the page didn't
  emit.** Add a section to a page → add it to its `*Stops()` and render the id from
  the same helper. `SideRail` (reading pages) and `Toc` (homepage, via `homeStops()`)
  are both dumb markup over these trees.
  - Rail labels are **bookmarks, not sentences**: measured, "The problem" /
    "Constraints" pushed the indented tier's right edge to x=151 against a headline
    starting at 143, and the rail printed over the words.
  - `flattenStops()` is *tree* order, which is **not** visual order (/research puts
    Results in a right-hand column, higher on screen than its tree position).
    `SideRail` sorts by measured position before running the scrollspy — don't
    assume monotonicity.

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
  piece.

**Do not converge them.** Turning `profile.ts` into markdown would break every
cross-reference and every computed number; turning writing back into a TS array
would make a new post a code change. The seam between the two is exactly one
function (`buildKinds`), and that is the whole point.

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

`components/proto/FluidSky.astro` is the sky on **every page a visitor reaches except `/projects`** —
seven content routes, the 404 included. `/projects` dropped it because its drafting
palette's ink is sized for the drafting ground, not the reading sky (light `--ink-3`
over `--reading-grad` measured 3.89:1). The other page without it is
`/proto-sketches`, which also has no `.descent` element at all (`<main class="sk">`):
it is an internal gallery, deliberately outside the sky's system so a candidate frame
is judged against a plain ground. (The `proto/` path is where the component was born,
not where it belongs.) A WebGL canvas: a two-level domain
warp over the descent/reading ramps, sampled from scroll position, with viscous
luminance banding and a warm bloom. `lib/skyShader.ts` holds the GLSL,
`lib/skyPalette.ts` the ramps, `lib/skyLegibility.ts` the **contrast policy** that
keeps text readable over it. Two archetypes: `descent` (paper text; the dangerous
direction is lighter) and `reading` (dark ink on a luminous field; dangerous is
darker). `yStart` lets a page begin further down the pattern — the owner, on the
reading pages: "what i liked is actually lower" — without touching the shader.

Two invariants, both about the compositor and both easy to break:

1. **The canvas is OPAQUE, with no `mix-blend-mode`.** A blended full-screen layer
   forces the compositor to re-read the page backdrop every frame, which defeats
   layer caching for the entire document.
2. **`.fluid-live` must never outlive a visible canvas.** CSS gates the canvas
   (hidden under 640px, under reduced motion, and at `strength=0`), and the class is
   additionally dropped on resize-to-hidden and on GL context loss.

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
  behind the sky — always dark, never flashes bright), `--on-accent` (dark
  ink for text ON the accent chip — the accent is a light color in both themes,
  so text on it stays dark), and `--descent-grad` (the whole sky, redefined
  wholesale per theme).
- **Surfaces that can't inherit CSS tokens** (handle per-theme by hand):
  the **terrain canvas** (JS-painted — `TerrainHero.astro` picks a `TerrainRamp`
  + walker palette off `data-theme`; dark = the cyan-blue **"Glacier"** ramp,
  `TERRAIN_TERMINAL` in `lib/terrain.ts` — NOT green, which this line claimed for
  a long time; the green phosphor is the fluid sky's and the accent token's, not
  the terrain's), the **fluid sky**
  (`skyPalette`/`skyShader` switch to a phosphor nebula with stars behind the
  line), the **SkyWash** + `.descent::before/::after` washes (raw rgba — dark
  nearly kills the warm Monet strokes), the **hero legibility halo** (paper→dark
  veil), the **Story panel's paper ground** (chosen per theme, not shared), and the
  **corner-nav glass** (forced dark-frost in dark theme).
- **Default + persistence:** an inline no-FOUC head script in `BaseLayout`
  resolves theme *before first paint* — explicit `localStorage.theme` first,
  else `prefers-color-scheme` (so a first-time visitor matches their OS). The
  toggle (a real `<button>` in `CornerNav`, sun/moon by action) writes
  `localStorage` and flips the attribute live, then re-fires `astro:page-load`
  so the canvases repaint for the new palette.
- **Additive rule (load-bearing):** the dark theme must NEVER degrade the
  shipped light Descent. Light is the base; dark is an override layer. When
  touching themes, verify BOTH — build breaks and contrast regressions hide in
  the theme you didn't look at.
- One panel used to be dark in both themes for emphasis. It was removed: a
  light-theme reader read it as a **bug**, not as emphasis. All four paper slides
  now share one palette and follow the theme.

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
     element in `dist` carries that hash *and* that tag/class. 128 fragments
     today, 5 of them dead. Be aware this cannot be a blind gate: one of the 5 is
     a legitimate empty-state branch in `Work.astro` that simply never renders
     while a writing piece is published, and its signature is identical to a real
     bug. An allowlist would be needed, which is why it is a tool to run and not a
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
     the same mistake was made in `research.astro`, `writing/[...slug].astro` and
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
titles came to rest hard against the browser chrome — the lead is a number in
`lib/deck.ts` for that reason.

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
    reads the ~3,200 lines of `<script>` bodies inside `.astro` files (tsc can't parse
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
  switcher and look (that is what a `/proto-*` route is for — `/proto-sketches` is the
  one that exists, and its harness makes a new candidate cost one function). When a browser is
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
- **Pure logic is tested.** Anything non-trivial in `lib/` gets a vitest spec, and
  so does every *invariant between two files* (`nav.test.ts`: every nav href is a
  real route; `writingContent.test.ts`: the schema enum matches `KINDS`;
  `pageStops.test.ts`: no stop points at an id the page won't emit;
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
    code** — the same audit found `Toc.astro` asserting "the Solve slide is dark in
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
    caller. `lib/factorModel.ts` was a live file with a dead half — the whole fan
    (`fanBeams`, `beamQuad`, `expressionTerms`, `FAN`), orphaned when
    `FactorFan.astro` went — and `lib/knowledge.ts` held a complete superseded
    model (`knownAfter`, `isKnown`, `knownness`, `discoveredAt`, `knownMean`)
    beside the one the page runs. **Trace the call graph from what `src` imports**,
    not from each export's name.
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
  ochre, indigo, seal, plus the derived `--hairline-rgb` and `--rule`).
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
  NOT "fix" this back to ochre. The seal red stays the brand mark in both
  themes (brightened to `#e0574a` for the dark ground).
- **Motion:** animate only `transform` / `opacity`; NEVER animate `filter: blur`
  (bake it). ALL motion is gated behind `@media (prefers-reduced-motion:
  no-preference)` via `lib/motion.ts`. The no-motion state must look *finished* —
  it's also the Firefox fallback (`animation-timeline` isn't in Firefox yet), and
  it's what a reduced-motion reader gets instead of the deck.
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
  - **`public/sitemap.xml` is hand-maintained and is NOT the generated one.**
    `@astrojs/sitemap` emits `sitemap-index.xml` + `sitemap-0.xml`; this third file
    is a static alias that sits beside them with no generator and no test. It is
    exactly the shape of thing that goes stale silently — if you add or remove a
    route, it does not update itself. Tracked in issue #67.
  - `og-card.png` is **2400×1260**, while `BaseLayout` declares `og:image:width`
    1200 and `height` 630. Also #67.

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
