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
room for calligraphy and photography. Every route rides the same sky, and the
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
- `astro:assets` optimizes gallery images (responsive `widths`, webp/avif).
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
  data/profile.ts                   # ALL résumé content: name, roles, rolesSub, phd, bio, timeline, publications, projects, awards, links
  data/nav.ts                       # PAGES — the canonical page set (see Navigation)
  data/writing.ts                   # the writing TAXONOMY (KINDS) + buildKinds(), the one seam to the markdown
  data/artworks.ts                  # gallery: calligraphy entries + globbed photos (+ photoNotes.ts for per-photo copy)
  data/{define,desk,making,story}.ts                       # the homepage explainer's copy + numbers, per slide
  data/{cowGlyph,ruleGlyphs,tickerGlyphs,signalWeights}.ts # pixel-art matrices and weights the slides draw from
  lib/deck.ts                       # pure deck stops: WHERE the homepage scroll may rest, and what's next — unit-tested
  lib/pageStops.ts                  # pure Stop trees: one tree per page drives BOTH its rail and its section ids — unit-tested
  lib/viewport.ts                   # PHONE_MAX_WIDTH = 640 + isPhone() — the one phone gate
  lib/motion.ts                     # prefersReducedMotion() — the one motion gate
  lib/gate.ts                       # the entrance's POLICY (session flag, fresh-load test, dismissal timing, isCovered, the two scripts' shared event names) AND its schedule (ENTRANCE_MS, entranceProgress, the per-axis open values, breathPhaseOffset) — unit-tested
  lib/skyShader.ts, skyPalette.ts, skyLegibility.ts   # the fluid sky: GLSL, ramps, and the text-contrast policy
  lib/terrain.ts, terrainRender.ts  # pure terrain math (field/grad/runDescent/colormap/project) + its painter AND terrainConfig/terrainPalette/BREATH_* — the per-theme picture and the breath's tempo, shared by the hero and the entrance so they cannot disagree
  lib/descentPath.ts, trajectory.ts # the career descent graph's field and route
  lib/{bellman,factorModel,problemSize,complexity,policyPnl,scenario,split}.ts   # the explainer slides' real math
  lib/{justify,scrollspy,pixels,cowSpeech,knowledge,capability,paperMath,equations,signalRubric}.ts
  lib/sketches/{kit,batch1}.ts      # the showpiece prototype harness — a sketch is (ctx) -> SVG string; /proto-sketches is its gallery
  sections/{Heights,Interlude,Choice,Rules,Solve,Story,Work}.astro   # the homepage, in scroll order — ALL of sections/, there is nothing else in it
  sections/Signature.astro          # links + seal — rendered INSIDE Work.astro, not as its own slide
  components/Deck.astro             # the deck's event plumbing (homepage only)
  components/Gate.astro             # the first-visit ENTRANCE (homepage only) — two scripts, see "The first-visit entrance" below
  components/proto/FluidSky.astro   # the WebGL sky canvas — on all 8 content pages despite the proto/ path (only /proto-sketches omits it)
  components/SkyWash.astro          # woven warm/cold broken-color wash over the sky — pure CSS
  components/TerrainHero.astro      # the hero's terrain canvas (Heights only)
  components/DescentPath.astro      # the career descent graph (inside Story)
  components/SideRail.astro         # the reading pages' marginal rail, driven by a Stop tree
  components/Toc.astro              # the homepage's thin left-margin TOC, driven by homeStops()
  components/CornerNav.astro        # the always-visible glass nav + theme toggle
  components/PlushCow.astro         # the cow, at three scales, with a pixel speech bubble
  components/{SealMark,Grain,ProjectCard}.astro
  scripts/artGallery.ts             # the /art page behavior (justified rows, placard, scrollspy, lightbox)
tests/*.test.ts                     # vitest — every pure lib module, the data/route invariants, the content seam
```

### Routes

**Nine pages**, and that is the number `npm run build` prints (`9 page(s) built`) —
check it against the build rather than against this table, and `ls src/pages` beats
both. **This line has now been wrong three times**: it read "twelve" when three
prototype routes had been deleted, then "nine" for six commits after `/proto-gate`
was added, then "ten" after `/proto-gate` was retired again. Re-run the build; the
sentence has never once been corrected before the build disagreed with it.

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
| `/proto-sketches` | **prototype** — the showpiece sketch gallery |

**The prototype route is internal, and there is one of them.** `/proto-sketches`
survives; `/proto-showpiece`, `/proto-ladder`, `/proto-paper` and now `/proto-gate`
were each retired once they had answered their question (the reasons are in
`tests/protoNoindex.test.ts`, which is where the count lives now). Git holds them.
  `/proto-gate` is the instructive one: it rendered six candidate gates side by side
and settled the choice, but by the time the shipped gate was approved its own "the
original (ported)" frame had drifted — still 36 strokes, the source viewBox, ochre,
static, with none of the four corrections the real gate had gained — and one frame was
still labelled "ships today" about a design that had lost. **A prototype that is not
rebuilt alongside what ships becomes a confident lie.** Retiring it on schedule is
cheaper than maintaining it.

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
`DescentPath`, `PlushCow`, `Gate`, the three explainer slides (`Choice`, `Rules`,
`Solve`), `BaseLayout`'s no-FOUC theme resolver, and the `/art` and `/research`
pages all need JS — that is the whole list, and `grep -rln '<script' src`
regenerates it.
Every one of them is a plain Astro component or page with a bundled `<script>`,
**not** an island (see *Stack*). The shared contract:

**`Gate` is TWO scripts, and the split is a constraint rather than a style.** The *policy* script is
`is:inline` because it has to run before first paint — it is what raises the overlay, locks the scroll and
inerts the siblings — and an inline script cannot import. The *painter* is an ordinary bundled module, because
it needs `buildGrid`/`paintTerrain` and the entrance's schedule, and restating a renderer is not an option.
So:
- whatever the inline script needs is either *restated* in it (the session policy, which `lib/gate.ts` holds
  and unit-tests independently) or handed in through `define:vars` (`GATE_SEEN_KEY`, `GATE_UP_ATTR`,
  `GATE_DISMISS_MS`, `GATE_REVEAL_EVENT`, `GATE_LAND_EVENT`). **Prefer `define:vars` for anything numeric or
  any string two files must agree on** — a restated constant drifts from its test silently.
- the two talk through **one event name and nothing else**, because they cannot share a module. The painter
  fires `GATE_LAND_EVENT` when its clock runs out; the policy script fires the same event when a gesture or
  the backstop lands early, so the painter stops tweening. **Both halves must be wired** — the listener was
  missing for one build and the entrance silently ran on the backstop instead of its own clock.
- anything computable at BUILD time should be, for the same reason.

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

**One live loose end it left behind, so nobody rediscovers it as a bug.**
`components/ProjectCard.astro` has two variants, `'teaser'` and `'full'`, and
`'teaser'` is still the *default* — but its only reason to exist was the homepage
Mountains section, and the only place that renders a card now is `/projects`, which
passes `variant="full"` explicitly. So the teaser branch and its "light-on-dark,
tuned for the dark Mountains gradient" styling are unreachable, and its comments
describe a surface that no longer exists. Not urgent, and not a rendering bug — but
don't spend time tuning that branch, and don't trust its comments as a description
of the site.

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

## The first-visit entrance

On a **first visit in a session**, the homepage plays itself in: the hero's own terrain arrives pulled back
and churning, settles into exactly the hero's framing, and the name, roles and bio fade up. Nothing is
clicked. Homepage only — rendered from `index.astro`, **never `BaseLayout`**, because moving it up one file is
the single edit that would hand a full-screen interstitial to all nine routes.

The component is still called `Gate` and the session key is still `descent.gate.seen.v<n>`, because the
*policy* (once per session, fresh load only, fail closed) did not change when the drawing did. What a visitor
meets is an entrance, and that distinction is the whole point of this section.

`components/Gate.astro` (markup + both scripts) + `lib/gate.ts` (policy AND the entrance's schedule,
unit-tested) + `lib/terrainRender.ts` (`terrainConfig` / `terrainPalette` / `BREATH_*`, shared with the hero).

**THE FIELD IS THE HERO'S OWN TERRAIN, AND THERE IS NO TEXT ON THIS SCREEN.** The overlay paints the same
Gaussian-mixture loss field the hero paints, through the same renderer, with a camera and a tempo that tween
onto exactly the hero's. At the landing frame the two are the same picture, so the handover cannot be seen.

**WHY, because two designs lost here first and the second one lost badly.** The field was a port of the
21st.dev "BackgroundPaths" component — asked for by name, approved on sight (*"oh yeah perfect"*), tuned across
about ten rounds, and then rejected for *"still seems a little bit dull"*. The fault was never in the drawing:
it was a borrowed picture cross-faded into an unrelated hero, and no dial inside it could fix that. The
replacement kept the cross-fade but staged a stand-in name flying across the screen to its hero position, and
the verdict was *"that's horrible"* — it was reverted whole. The brief that replaced both is the owner's own:
*"a fluid field moving using the terrain we have. and then this terrain transforms into the terrain location we
have then seamlessly into the hero. the name and other stuff just fades in."*

**"The name just fades in" is why this component has no name in it.** The HERO's name fades in, underneath. That
one decision deletes the entire class of defects the previous attempt generated — no stand-in copy, no FLIP
between two measured boxes, no ivory-to-ink colour crossover, no two-names-on-screen, no descender collision
with the roles line. All of those were real, all were found by screenshot, and none of them can come back while
the overlay carries no text. `tests/distSmoke.test.ts` asserts it carries none.

### What moves, and why each axis lands exactly

Every axis is `open + (hero - open) * entranceProgress(ms)`, and `entranceProgress` reaches **1** with a zero
derivative — it has to *arrive*, not still be moving when the overlay goes.

| axis | opens at | lands on | what it does |
| --- | --- | --- | --- |
| `cfg.zoom` | `0.70 x` hero | **hero's 0.85** | the camera descends into the hero's framing |
| `breathAmp` | `0.16` | **`BREATH_AMP_LIVE` 0.04** | a swell calms to the hero's breath |
| `cfg.light.az` | hero − 1.15 rad | **hero's −0.565** | the warm/cool terminator slides across the relief |
| `cfg.edlSizeRange` | `0.34` | **hero's 0.75** | the silhouette resolves in dot *weight* |
| `cfg.elevEmphasis` | `0.07` | **hero's 0.20** | the ridge takes the form off the valley |
| `tsec` | hero's clock − 1 breath period | **hero's clock exactly** | the field flows, then settles |

**`zoom` is the one that cannot be approximate**: it is simultaneously position *and* dot radius, so a near
miss shifts every dot and resizes it. The painter does not trust the lerp at the landing frame — `heroFrame()`
assigns the hero's values by identity. (A lerp through `p = 1` does not return its endpoint in IEEE-754:
`0.30 + (0.04 - 0.30) * 1` is `0.03999999999999998`. Harmless at 1e-17, but the snap is why it is harmless.)

**THE CLOCK IS THE SUBTLE ONE, AND THE BREATH IS SLOWER THAN ITS NAME SUGGESTED.** `paintTerrain` displaces
each dot by `sin(tsec * BREATH_OMEGA + x*0.7 + y*0.6)` — there is no 2π in that expression, so with omega 0.4
the period is **15.71 seconds**, not the 2.5 the old local `breathHz` read as. Over a 2.6s entrance an
unwarped field advances through 17% of a cycle: it drifts, it does not flow. So the entrance runs the clock
fast and lets it decelerate — but `tsec` must *also* equal the hero's `rAF timestamp / 1000` at the landing
frame, or every dot sits up to ±8.8 CSS px away from where the hero's next frame will put it. Those two
requirements are only compatible because `sin` is periodic: **burn a WHOLE number of breath periods and the
phase you land on is the phase you would have had without the detour.** `breathPhaseOffset` is that, decaying
as `(1-p)²` so the tempo returns to 1× smoothly rather than stepping down from ~7× at the final frame.
`BREATH_OMEGA` is exported for this reason — it was restated in two places, here and in TerrainHero's walker
pass.

### The handover, in order, because the order is counter-intuitive

1. The painter reaches `ENTRANCE_MS`, paints the hero-exact frame, and fires `GATE_LAND_EVENT`.
2. **The policy script must be LISTENING for that, and the absence of that one line shipped.** Measured, the
   entrance ran **4000ms instead of 2600** — it only ever ended via the backstop timer, with the terrain
   sitting finished for a second and a half. Every other assertion passed through the bug (the backstop
   existed, the order below was right, the markup was right) because none of them checked that the two halves
   were *connected*. There is a test for it now.
3. `data-gate-up` comes off **before** `GATE_REVEAL_EVENT` fires. The hero's `apply()` re-reads `isCovered()`,
   which tests that attribute — fire first and it decides it is still covered and never resumes.
4. `GATE_REVEAL_EVENT` is dispatched on **`document`**. That is the hero's channel; dispatching on `window` is
   a separate one the hero never hears, and that is a bug this component shipped once.
5. Only then the dismissal, a 600ms crossfade. Both canvases paint the same frame in the same box through that
   window, so the only thing that visibly changes is the flat ground giving way to the warped sky, behind a
   terrain that does not move — and the hero's text rises on the same clock.

### The pieces that are load-bearing

- **GEOMETRY IS MEASURED, NEVER ASSUMED.** `project` scales by `min(W, Hh)` and centres at `0.46 * Hh`, and
  `#heights` is **108vh**, so on most desktop windows the hero's basis is its *height* and a 100vh overlay at
  the same `zoom` is a different picture in both scale and position. The overlay's canvas is positioned and
  sized from the hero canvas's own `getBoundingClientRect()`, which also means a CSS change to `#heights`
  cannot silently desynchronise them. Verified: both boxes measure identically.
- **DPR must match in value AND treatment**: `min(2, devicePixelRatio)`, `round(rect.w * DPR)` into
  `canvas.width`, CSS size in CSS px, and **no `ctx.scale`** — `paintTerrain` applies DPR to the dot radius
  itself, so a painter that scaled the context would get half-size dots *and* a wrong scale basis.
- **`buildGrid`, never a hand-rolled lattice.** Its loop accumulates floating point and stops at 2.52, giving
  1089 points and an asymmetric footprint — and `computeEDL` normalises by the p80 of the response over the
  *whole* set, so a "cleaner" lattice changes every dot's shade, not just the new ones.
- **THE GROUND IS `--sky-top`, NOT `--bg`, and that is legibility rather than taste.** It was `--bg`
  (near-black) for one build and the light theme's field nearly vanished: its terrain is dark ink whose
  eye-dome shading spends itself on *value* rather than opacity, so it needs the luminous ground it has on the
  hero. `--sky-top` is the descent gradient's own 0% stop, per theme, which also makes the dismissal crossfade
  almost nothing. Keep the token equal to that stop.
- **THE HERO'S TEXT IS PAUSED, NOT HIDDEN.** `.hero-rise` / `.hero-bio` / `.hero-doors-line` already rise in on
  load — that IS the fade the brief asks for; the only problem was that it played while the overlay covered
  it. `html[data-gate-up]` sets `animation-play-state: paused`, so they sit held at their `from` keyframe and
  play through on their own stagger when the attribute comes off. **Not an `opacity: 0` override**: that would
  make invisibility a property of the element, which is trap 6 — the defect that twice shipped an invisible
  name on the first screen of this portfolio. Here the resting state in the stylesheet is the animation
  running to opacity 1, so the entrance can only ever *delay* the text.
- **ANY GESTURE SKIPS IT.** The listeners that swallow input for trap 3 are the same ones that land the
  entrance, so nothing is swallowed without doing something. If you add a swallowing listener that does not
  land, you have re-created the defect trap 3's sub-bullet describes.
- **AND IT ENDS EVEN IF THE PAINTER NEVER RUNS.** The painter is a *bundled* module; if it fails to load,
  throws, or cannot get a 2D context, nothing would reach the landing and an opaque full-screen layer would
  sit over the site permanently — strictly worse than any defect this component has actually shipped. The
  **inline** script cannot fail to run, so it carries a bounded `setTimeout` backstop.
- **It does not raise under reduced motion at all.** An entrance made entirely of motion has nothing to show a
  reader who asked for none, and a still frame of the hero's terrain held for two seconds is a delay with no
  content. The finished state the motion rule asks for is the homepage itself.
- **Not a dialog.** Nothing to focus, so `aria-hidden`, and the real `<h1>` is the hero's — which also retires
  the two-`<h1>` defect this component shipped once.

**`terrainPalette` / `terrainConfig` are a two-places-must-agree seam.** The per-theme ramp, darkness, dot
scale and walker trio were a private `themePalette()` inside `TerrainHero.astro`; the entrance paints the same
field and must land on the hero's frame, so a second copy that drifted by one number would turn a continuation
into a visible jump. The easiest one to get wrong is **`dotScale`: 1.08 light / 1.18 dark, while
`TERRAIN_CONFIG_DEFAULTS.dotScale` is 1.** `terrainConfig()` returns a **fresh** object per call, deliberately
— the entrance mutates `zoom`, `light`, `edlSizeRange` and `elevEmphasis` on its own copy every frame, and one
shared object would make the hero's picture follow the overlay's camera.

**Two things the parameter survey ruled out, so they are not options.** `BUMPS` (the field's Gaussian centres,
weights and widths) is the most literally "fluid" axis — drifting the centres is a true moving field rather
than a camera move — but it is a **shared mutable singleton**: `lib/knowledge.ts`, `lib/descentPath.ts`,
`lib/trajectory.ts` and `lib/sketches/batch1.ts` all read `field`/`grad`, so the Rules slide, the Story descent
graph and `/proto-sketches` would all change, and it invalidates every `GridPoint`'s precomputed normal and EDL
shade. And **`cfg.darkness` is not a continuous cross-fade axis**: `litColor` and `edlSpend` blend smoothly but
`paintTerrain`'s base alpha is a hard `> 0.5` branch, so tweening through 0.5 pops.

**THE PORTED GEOMETRY IS DELETED.** `lib/gateRefPaths.ts`, `lib/gateComets.ts`, their two specs and the dash
half of `lib/gate.ts` (`drawnFrac`, `offsetFrac`, `opacityAt`, `widthAt`, `tintAt` and their constants) are
gone — reachable only from their own specs once the entrance landed, which is exactly the coverage-theatre
pattern the *Conventions* note on `noUnusedLocals` warns about. Deleted in the same commit as the entrance, so
a single `git revert` restores the old gate whole; that is not theoretical, it is how the previous attempt was
undone. The rejection list below carries what they taught.

### Seven things were rejected here, each after looking at it

Do not rebuild them. The first five were judged in `/proto-gate` — a route that has since been retired, so
these notes are the only record outside git. The last two are the designs that shipped and lost: the ported
line field, and the entrance that flew a name across the screen. Note the shape of the list: every rejection
was decided by LOOKING, and three of them were things that measured better than what won.

1. **Descent trails run to convergence** — the first version. Every stroke ends in one of the
   field's three basins, so 36 of them piled into 3 points: 71% of the set inside one cell of a
   20×20 grid, 271 pair crossings, 22× spread in length. The owner: *"ur lines are horrible."*
   (Its separate, real bug was uniform Catmull-Rom over 412× uneven spacing, which drew a
   173.8° hairpin. The fix was centripetal Catmull-Rom, which provably cannot cusp at any spacing; it lived in
   `lib/gatePaths.ts` and was deleted with the comb, since the ported geometry is cubics and needs no spline.
   Git holds it, and the rule it taught is the durable part: **uniform Catmull-Rom overshoots once the spacing
   ratio passes about 5×.**)
2. **Truncated descent, and marching-squares contours with elevation** — built, measured, cut.
   And a process lesson worth more than either: they were compared *against each other and the
   comb simultaneously*, each having chosen its own count, spacing and projection, so four
   frames differed in four ways. The owner: *"they are not even real comparisons."* Correct.
   **Sweep one variable.**
3. **Five harmonic fields** — `Re(z³)`, `Re(eᶻ)`, `Re(sin z)`, flow past a cylinder, `Re(z²)`,
   all rendered at the settled parameters. They are *better behaved* than the comb — the
   maximum principle forbids a harmonic function interior extrema, so their contours cannot
   close into rings with no tilt needed at all — and they still lost, for a reason worth
   keeping: *"less structural and pattern-noticable. others are so systematic."* A saddle or an
   exponential fan announces itself as a recognisable motif. The comb reads as incidental,
   because the tilt leaves only the terrain's irregular wobble showing. **Being mathematically
   elegant is not the same as looking unforced.**

4. **Combed contours of the hero's own field** (`lib/gateLines.ts`) — this one SHIPPED for several
   commits and is the most instructive loss. Its no-knot property is a theorem rather than a tuning:
   the tilt exceeds the field's maximum gradient (`MAX_FIELD_GRAD = 1.8668`, measured on a 401×401
   grid), so `grad g` cannot vanish, so there are no closed level sets and none that meet — zero
   crossings against 271 for the descent trails. Three of its dials were then settled by sweeping one
   variable at a time: **8 strokes** (from 8/12/18/30) and **opacity 0.10 → 0.80** (from four ramps). It
   still lost: *"the lines reads parallel and seems dull."*
   **And the parallelism was the theorem's own cost.** To guarantee no knots the tilt must swamp the
   field, which is exactly what flattens the terrain out of the picture. A safe drawing and an
   interesting one were in direct tension, and the guarantee won on the metrics and lost on the wall.
   `lib/gateLines.ts` and its 20 tests are **deleted** — this entry used to end "the module and its tests are
   kept because /proto-gate renders it as the comparison; it is not dead code, but it is not what ships", and
   when the route went, that sentence was the whole of its justification. One assertion was rescued first: it
   measured max|grad| = 1.8668 over the hero's field on a 401×401 grid, which is a property of `lib/terrain.ts`
   rather than of the comb, and nothing else covered it. It lives in `tests/terrain.test.ts` now.

5. **Four black-hole readings** (`lib/gateProtoShapes.ts`, deleted) — proposed when the owner asked whether the
   maths could go and something more pictorial arrive: *"maybe drop some math functions alltogether ... literally
   looks like a blackhole in the middle."* Built as **streamlines parting** (potential flow past a disc, as level
   sets of ψ = y(1 − a²/r²), solved by Newton steps rather than integrated so a line cannot drift off its own
   level set), **gravitational lensing** (rays integrated under a = −k·r̂/r² with the speed renormalised, so the
   bending, the crossing behind the mass and the capture of the innermost rays all fall out of the physics),
   **the void alone**, and an **accretion disc**. The owner: *"all your three doesn't read too well tbh"*, and
   then the verdict that ended the whole search — *"do u still have the background path ive given to u. it's
   already good enough."*
   - Two things worth keeping from it. The disc was flagged **in its own source** as the least defensible of the
     four by this site's rules, because its arcs were *drawn at chosen radii, not solved from anything* — written
     down before it was looked at, and it lost. And this entry exists at all only because the module was read
     before being deleted: CLAUDE.md had never listed these four, so retiring `/proto-gate` would otherwise have
     erased the record of an entire rejected direction.

6. **The ported 21st.dev line field** (`lib/gateRefPaths.ts`, `lib/gateComets.ts`, both deleted) — asked
   for by name (*"do u still have the background path ive given to u. it's already good enough"*), ported
   byte-for-byte, approved on sight (*"oh yeah perfect. now that's what im talking about"*), tuned across
   about ten rounds, then rejected whole for *"still seems a little bit dull"*. **The fault was never in the
   drawing.** It was a borrowed picture cross-fading into an unrelated hero, and no dial inside it could fix
   that. This entry is the record now that the modules are gone.
   - **There is a v2 of the reference and it is NOT what was ported.** The same author rewrote
     `background-paths` in June 2025: 37 generated sine waves in `viewBox="-2400 -800 4800 1600"` with
     `slice`, a purple→pink→blue gradient, no dash, and a slow `y` bob. The owner's link was to **v1** — he
     described it as black and white, which v2 is not. If a future ask sounds like "gentle bobbing gradient
     waves", that is v2 and a different component.
   - **Four dash treatments were each rejected after looking**, so they are not options either: a faint
     full-length stroke under the dash (*"seems like the line leaves a trail behind. remove that trail."*);
     no dash at all, groups drifting by transform (*"now it's just this"* — a static drawing); a canvas of
     comet trails, built from over-reading *"like the trails of asteroids"* literally (*"i think u
     misunderstood me."*); and scattering the dash phases, which was only ever a fix for an artifact the
     underlay caused.
   - **Four durable lessons, each of which cost a round:**
     **(a)** When a drawing looks wrong at one size, **check the size before retuning what is in it** —
     strokes were thinned twice for being "heavy" when the whole field was 1.357× oversized.
     **(b)** The arithmetic of an alpha says nothing about visibility — **composite it over the real
     background and take the L\* difference.** Effective alphas of 0.045–0.45 read as alarming and measured
     dL\* 4.2–42.5 over `#16140f`, none below the just-noticeable difference, because L\* is steeply
     nonlinear near black.
     **(c)** `getPropertyValue` on a custom property returns the **authored** string, so `--ochre` arrives as
     `#c8a36a`; an `rgb()`-only parser fell through to its default and made an animation that ran every frame
     change nothing — 1 distinct colour across 48 strokes, found by measuring, not by reading the code.
     **(d)** **A stated principle contradicted by the constant next to it**: a doc comment said a 20–30s
     cycle is far too slow to read in the few seconds a gate is on screen, and the traverse it rode on was
     left at exactly 20–30s.

7. **An entrance that flew the NAME across the screen** — the first attempt at this brief, and it shipped to
   the owner before losing: *"that's horrible. let's revert back."* It had the right idea (paint the hero's
   own terrain, land on the hero's camera) and the wrong staging: a stand-in copy of the name FLIP-animated
   from screen centre to the hero's name position while its ink crossed ivory→dark and the ground cleared
   underneath it. Reverted whole in one commit.
   - **Everything that went wrong with it came from the stand-in**, which is why the replacement has no text
     at all. In order of discovery, every one found by looking at a frame rather than by reasoning: the
     stand-in was `var(--ink-1)` on a dark ground, i.e. **invisible**; its colour then had to cross over, and
     the crossover ran parallel to the ground's so the two **hugged** — composited, the moving name measured
     **dL\* 6** mid-travel, the just-noticeable difference; its surname was roman where the hero's is italic,
     so it **snapped** at the swap; the hero's own name showed through the clearing ground, putting **two
     names on screen**; and the letters sprang up from below *through* the roles line for the whole 120–836ms
     stagger.
   - **The durable lesson is about where the complexity came from.** Each fix was correct and each one added a
     mechanism — a halo curve, a two-ink tween, a theme-scaled glow, a `data-gate-up` visibility rule, a
     reversed spring. Five mechanisms to make one borrowed element look like another element it was going to
     be replaced by anyway. **When a feature keeps generating defects of the same shape, the feature is the
     defect.** Deleting the stand-in removed all five at once, and the brief had said so all along: "the name
     and other stuff just fades in."

The lesson across all seven, worth more than any of them: **this screen was redesigned seven times and every
decision came from the owner looking at it in the real page at real size.** Not one came from a
metric, an argument, or a screenshot in a card. A `/proto-*` route exists for that, and a candidate that
cannot be put in one at full size is not ready to be proposed — but build it, use it, and retire it when the
question is answered, because an un-maintained prototype drifts into misinformation (see *Routes*).

**Six traps, each of which shipped. The first four were caught in review; the last two shipped to
the owner and cost five rounds between them. Do not reintroduce any of them.**

1. **It must ship NOT COVERING and be raised by script.** The static HTML carries
   `class="gate"`; the inline script adds `is-up`. A gate that defaulted to covering locks
   out every visitor whose JS failed, and hides the page from anything that does not run
   scripts. `tests/distSmoke.test.ts` asserts the shipped markup carries no covering class.
2. **An inline script RE-EXECUTES on a View Transition.** The gate's script lives only in
   `/`'s HTML, so `ClientRouter` does not find it in `scriptsAlreadyRan` for a visitor whose
   entry page was another route, and runs it on the navigation into `/`. Guard is
   `document.readyState !== 'loading'` (`isFreshLoad()` owns the rule). `BaseLayout`'s veil
   has had `__descentVeilInit` for the same hazard since it was written.
3. **`preventDefault()` does not stop a sibling listener.** `Deck.astro` also listens on
   `window` for `wheel`, and **its `onWheel` does not check `defaultPrevented`** (it does for
   keydown, not for wheel). `overflow: hidden` suppresses only the *user's* scrolling
   mechanism — `window.scrollTo()` still works — so one flick scrolled the page behind the
   gate and dismissal revealed a later slide instead of the hero. Use
   `stopImmediatePropagation()`, and swallow the deck's keys too.
   - **Swallowing `touchmove` once left a phone with no way out but the button**, and nobody noticed for
     several releases: `onKey` exited only on Escape, a key a phone does not have, so a visitor arriving from
     a link on a handset had one 44px target and no gesture — the arrival path for anyone following a
     LinkedIn link. **The entrance closes that structurally, which is why the fix is worth more than the
     bug:** the listeners that swallow input are the *same* listeners that land it, so nothing can be
     swallowed without also doing something. `touchend` rather than `touchstart`, so a swallowed scroll
     attempt still counts as "let me in" rather than firing before the finger has decided. **If you ever make
     a swallowing listener here that does not land, re-read this bullet** — that is the exact shape of the
     defect.
4. **Window/document listeners outlive the gate's DOM.** `ClientRouter` replaces
   `document.body`, so without a teardown `swallow`/`onKey` keep calling `preventDefault`
   forever: wheel scrolling and Tab dead site-wide, with no gate on screen to explain it.
   `astro:before-swap` dismisses. This is what the *Interactivity* contract's "with a
   teardown" means.
5. **Only about a QUARTER of each curve is inside the viewBox, so any dash scheme can make a whole
   stroke disappear — and that is the trap, not the dash length.** This is the most expensive bug in
   the component's history: reported as *"the screen is just flashing"*, diagnosed wrong **four
   times** (expensive paint, frame starvation, `vector-effect`, stroke count) and fixed only after
   opening a browser. A dash whose window slides off that quarter takes the line with it, and the
   source's growing dash adds a hard reset once per cycle on top.
   - **Careful with this bullet's history: it used to say the exact opposite of what now ships.** It
     read *"a dash of FIXED length FLASHES, and the growth from 0.3 to 1 is what stops it"* — which
     was a true observation about one specific combination (fixed length, period equal to the arc,
     scattered phases, no layer underneath) wrongly generalised into a rule — and the rule it stated
     was then used to justify two more dash schemes, both of which were also rejected. **A dash DOES ship
     today**, so read only the claim at the top of this bullet: the viewBox shows about a quarter of each
     curve, so any scheme that lets a stroke's painted span leave that quarter will eventually look broken.
     That is why travel is clipped to the measured on-screen window — see the motion section above.
   - Two more traps in the same family, both found the same way: `pathLength="1"` with fractional
     dash values loses precision on a ~1580-unit curve and stipples it, and **Chrome will not
     interpolate a `calc()` containing an unregistered custom property** — it snaps to the end
     value, so the keyframes silently did nothing.
6. **NOTHING on this screen may rest INVISIBLE, and there are THREE routes to it — the guard catches
   one.** Three elements once animated in from `opacity: 0` behind a `forwards` fade, and any element whose
   animation does not run or is interrupted is then permanently invisible. What vanished was **the owner's
   name** on the first screen of his portfolio, and on a later report the roles line together with the
   then-modal's only button. `tests/distSmoke.test.ts` asserts no `.gate-*` rule declares `opacity: 0`; the
   `.gate` container is exempt, because that is trap 1's not-covering resting state.
   - **The second route is COLOUR, and the entrance shipped it to a frame:** a stand-in name set to
     `var(--ink-1)` — the dark ink — on a dark ground. The guard greps for `opacity: 0` and **cannot see a
     colour**. There is no cheap static check for "dark on dark"; the check is to look at the first frame.
   - **The third route is holding another element's animation**, which is what the entrance does to the
     hero's text today. It is safe *only* because it is written as `animation-play-state: paused` behind an
     attribute: the resting state in the stylesheet is the animation running to opacity 1, so the entrance
     can delay the text but never lose it, and the inline script's backstop guarantees the attribute comes
     off. Written as an `opacity: 0` override under the same attribute it would be this trap again, one
     failed script away from a blank hero. A test pins the `paused` spelling and forbids the `opacity` one.

**The process lesson, which cost more than any single bug above:** every one of those five wrong
diagnoses came from reading the markup and reasoning about what it should do. The two real causes
took minutes to find once one headless Chrome was driven over CDP and the computed values were
read back. For a rendering bug here, **measure first** — and measure the symptom, not a proxy: the
check that finally settled it samples total drawn ink four times 1.5s apart, because "flashing"
*is* ink that comes and goes, and a 3.2% swing with nothing at `opacity: 0` is the proof.

`inert` goes on **every body child except the gate**, not on `<main>`: 18 focusable elements
(Toc links, CornerNav's page and mark links, the menu button, the theme toggle) render after
`</main>`, so inerting the landmark alone leaves a "modal" you can tab behind.

**`<dialog>` was the standing recommendation here, and the entrance made it the wrong one.** The note used
to read: `showModal()` gives real top-layer inertness, a cycling focus trap, Escape via `cancel`, a
`::backdrop` and closed-means-hidden for free; this codebase already uses it for the `/art` lightbox
(`art.astro` + `scripts/artGallery.ts`); and hand-rolling those was the weakest part of the component. All of
that was true **of a modal with a button in it.** The entrance has nothing to focus, nothing to trap and
nothing to act on, so a focus trap is a cost rather than a feature and `aria-hidden` plus `inert` on the
siblings is the whole requirement. If a future redesign puts an interactive control back on this screen, the
`<dialog>` recommendation comes back with it — and it still would not have fixed traps 3 or 4.

## Phones

`lib/viewport.ts` is the one phone gate: **`PHONE_MAX_WIDTH = 640`** and
`isPhone()`, which asks `matchMedia` rather than measuring `innerWidth` so it
agrees with CSS exactly (the two disagree by a scrollbar's width, and that is
enough to engage the deck on a viewport whose styles think it's a phone).

**The number lives in two places and they are synced BY HAND.** `@media
(max-width: var(--x))` is not valid CSS, so there is no way to feed one value to
both. **If you change `PHONE_MAX_WIDTH`, change every `@media (max-width: 640px)`
block with it.** `grep -rn 'max-width: 640px' src` returns 17 hits in 13 files, but
**four of the 17 are prose ABOUT the breakpoint, not the breakpoint** — two in
`viewport.ts`, one in a `global.css` comment, and one in `Gate.astro`, which explains
that its own block exists to match the hero's phone opacity. So there are **13 real CSS
blocks in 12 files**: `global.css` ×1, `experience` ×2, and one each in `CornerNav`,
`Toc`, `DescentPath`, `ProjectCard`, `FluidSky`, `Heights` and `Gate` (both compound,
`(max-width: 640px), (max-height: 520px)`), `404`, `research` and `writing/[...slug]`.
**Read the hits, do not just count them** — and re-run the grep rather than trusting this
sentence, which has now been wrong four times in both directions. "15 … 13" was right
until `Gate.astro` added a block; "16 … 14" was right until the gate's field briefly
became a canvas and dropped out; then the SVG field came back; now the entrance is a
canvas again and `Gate.astro` carries a block for the *opposite* reason — it has to
reproduce `#heights .terrain-canvas { opacity: 0.4 }`, because a second canvas does not
inherit it and a phone would otherwise land a field 2.5× stronger than the hero. The
sentence has never been wrong because someone miscounted — only because someone copied
the number instead of re-measuring it. (This list used to include "the two proto sections". There are
no proto *sections* — `src/sections/` holds only the seven homepage slides plus
Signature — and the one surviving proto route, `/proto-sketches`, breaks at 820px,
not 640: it is an internal gallery, so it is not part of the phone treatment.)
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

### Adding a résumé item costs one hand-written score

Every `timeline`, `publications`, `researchInterests`, `projects` and `awards` entry
is also a **signal** in the Rules slide's factor model, and its beta comes from a
committed evidence-strength score in `src/data/signalWeights.ts`. So adding one
project is a **two-file change**, and `tests/signalWeights.test.ts` enforces it —
three assertions (`missing`, `changed`, `orphaned`) go red until the new item has a
score, a factor and a `because` clause naming the evidence.

**There is no `npm run score`.** Two comments claimed there was and the test failure
messages still say "re-run the scorer"; the procedure is real but manual, and it is
written at the top of `signalWeights.ts` — three raters with different stances score
the item against `RUBRIC_PROMPT` independently, and the **median** is committed. An
LLM call at build time is deliberately refused (it would make two builds of identical
content disagree and put an API key in the deploy path), so the manual pass is the
price of that. Nothing may score 5 without third-party review; arXiv is a 4.

**Ids are slugs of the item's label, never array indices.** `signalId()` in
`lib/factorModel.ts` owns the spelling. This changed because index keys made a
*reorder* look like a content change: inserting `offchart` at the front of `projects`
renamed every entry below it, so one addition reported the whole collection as
drifted. Keyed by slug, reordering is free — which matters, because **array order is
rendered**: `sections/Work.astro` slices `projects.slice(0, 2)` for the homepage
appendix, so the first two entries are the only ones a reader meets without clicking.
(`Project.featured` does *not* control that, and does not control anything today —
`projects.astro` passes `variant="full"` to every card.)

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
- Perf: rAF loop paused offscreen (IntersectionObserver) + ~30fps throttle +
  DPR≤2; a finished static frame is painted first (instant LCP) and is the
  reduced-motion / no-JS state.

## The fluid sky

`components/proto/FluidSky.astro` is the sky on **every page a visitor reaches** —
all eight content routes, the 404 included. The only page without it is
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

Perf: viewport-sized (scroll is a uniform), half internal resolution, ~30fps idle
and full rate while scrolling, paused on tab-hide, skipped on phones. The CSS
`--descent-grad` gradient remains underneath as the base and the no-WebGL state.

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
  + walker palette off `data-theme`; dark = green "stars"), the **fluid sky**
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

## Two CSS traps that have each shipped a bug here

1. **Astro scoped styles rewrite selectors with `[data-astro-cid-…]`,** which
   changes specificity **and what the selector can reach.** A scoped rule **cannot**
   reach markdown rendered by `<Content />`, slotted content, or nodes a script
   created at runtime — `.prose blockquote` becomes `.prose[cid] blockquote[cid]`
   and matches nothing, silently. This is why `/writing/<slug>`'s prose styles are
   in an `is:global` block (nested under `.prose` so going global cannot leak), and
   why several component rules use `:global(...)`. When a rule "does nothing" and the
   markup is clearly right, check this first.
2. **At equal specificity, SOURCE ORDER decides.** Put an override **after** the
   rule it overrides. A phone override placed above the desktop rule it was meant to
   beat has shipped here more than once.

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
  - **`noUnusedLocals` IS ON AND IT WILL NOT FIND A DEAD EXPORT.** It is per-file and per-binding: an unused
    local or parameter is an error, but an `export` has, by definition, a possible consumer elsewhere, so
    TypeScript says nothing. That is exactly how `pointAt`, `fitMeet` and `jitter` survived three commits in
    `lib/gateComets.ts` after the code that called them was reverted — green build, green typecheck, green
    tests, because their own spec still imported them. **A dead export needs a grep, and a test that is the
    only consumer of what it tests is not coverage.** For each export ask: who outside this module and outside
    `tests/` uses it?
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
  `viewport.test.ts`: the breakpoint still says 640). They're the only automated
  safety net, and they're where "two places must agree" is actually enforced.

## Taste rules (these define the look — hold the line)

- **Palette discipline:** ONLY the tokens in `tokens.css` (paper, ink-1..5,
  ochre, indigo, seal). In the **light** theme the vermilion **seal**
  (`--seal #b23a2e`) is the ONLY saturated color. Never pure `#fff` / `#f00`.
  **Deliberate exception — the dark theme.** `html[data-theme='dark']` is the
  "terminal galaxy": it intentionally swaps the ochre accent for a phosphor
  **emerald** (`--ochre: #66c28c` under dark) — a second saturated color, on
  purpose, because the terminal/coder identity is the whole point of dark mode
  (the user chose it seeing both this and a "night descent" variant live). Do
  NOT "fix" this back to ochre. The seal red stays the brand mark in both
  themes (brightened to `#e0574a` for the dark ground).
- **Motion:** animate only `transform` / `opacity`; NEVER animate `filter: blur`
  (bake it).
  - **The one standing exception is GONE, and that is worth knowing because it was load-bearing
    for several commits.** The gate's SVG strokes animated `stroke-dasharray`, `stroke-dashoffset`,
    `stroke-width` and `stroke` — all **paint** properties on DOM nodes, exactly what this rule
    forbids — and the exception was argued at length: one rAF wrote all 48, so a frame cost one
    style/paint pass, and the gate was gone after a gesture. The entrance paints a canvas instead,
    which this rule has never needed an exception for, so **there is no DOM paint animation left on
    this site.** Keep it that way: the exception existed because a borrowed drawing could not be
    expressed any other way, and that drawing is deleted.
    ALL motion is gated behind `@media (prefers-reduced-motion:
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
