# The showpiece slot — what has been tried, and what the corpus actually is

Working notes for the bottom-of-homepage section. **Deliberately unresolved.** Five attempts have
been rejected; the owner's call is to stop shipping and keep thinking — *"we don't need to rush,
we have plenty of time to think about this."* That is the right call: every one of the five failed
because it got built before the thinking had converged.

This file exists so a sixth attempt does not repeat the same mistakes, and so the reasoning
survives a new session. It lives in `notes/` rather than `.superpowers/` or `docs/` because both
of those are gitignored, and this reasoning is currently the most valuable artefact in the whole
effort — it would not survive a `git clean`.

**Status: no showpiece is live.** The section slot on the homepage is intentionally empty
(commit 3555811). The maths that survived is committed and tested; the visual is not decided.

## What IS decided, and committed

- `src/lib/trajectory.ts` — the career-as-descent reading, with the field's two basins, the
  barrier and the entrapment all measured rather than asserted. 14 honesty tests.
- `src/lib/factorModel.ts` + `src/data/signalWeights.ts` — 20 signals scored 1–5 against a
  published rubric by three independent raters, medians committed as a reviewed artefact. Useful
  as an ORDERING mechanism even though the fan that displayed it was rejected.
- `src/lib/capability.ts` — breadth statistics (HHI, effective dimensions). Rejected as a
  *subject* but kept: they are honest and may serve as substructure.
- `/experience` — built and live, with the descent spine.

## What is NOT decided

The visual form. Everything below is input to that decision, not a conclusion.

## The brief, in the owner's words (latest, and the clearest so far)

> "I think we shouldn't rely on depth/breadth either. It's too direct. It's like advertising and
> branding yourself like a commodity. What I want is to let the user EXPLORE and GET INTERESTED
> in who you are. I think that's the main intent. Simply listing things out is dull. Previously I
> do believe the quant pod idea is interesting because essentially it's a MINI-GAME where you can
> touch and you can click on the monitors to see who I am. I don't quite like the quant pods
> because it's TOO REALISTIC and CONTRADICTING WITH THE MATH TERRAIN seen above — it's like
> jumping from theory to real world instantly. My best guess is to let's KEEP THE DESCENT IDEA
> where user scrolls down like a journey."

And: *"this is exceptionally hard but I do believe this is how to distinguish my portfolio from
others."* That is the actual objective function — differentiation through curiosity, not
completeness of information.

## Rejected, with the reason (the reason matters more than the list)

1. **Isometric dotted desk** — "reads as an abstract diagram, not a place."
2. **Pixel-art room** — "looks like my bedroom, not a quant shop." Preserved on branch
   `claude/quant-pod-pixel`, pushed.
3. **Flat-modernist terrace** — "horribly wrong": monitors floated with no stands, desk read as a
   bathtub. Removed from the homepage in 3555811.
4. **Factor exposure fan** — mechanically correct, betas honest, ring/measuring-frame quality
   liked. Died twice: first "still reads empty on a large screen", then the framing itself —
   `r_TIAN` is a RETURN and implies a P&L that does not exist.
5. **Breadth / depth statistics** (HHI 0.340, effective dimensions 2.94 of 6) — honest and
   computed, but "too direct… like advertising and branding yourself like a commodity."

Also rejected as concepts: a second loss surface (repeats the hero), a market globe (cliche), a
correlation matrix over his own items (category error — one asset, not n assets).

## The one good quality of the pod, which is separable from what killed it

It was a small toy you could poke, and poking revealed something specific. The furniture was the
problem; the *pokability* was not. Any successor needs somewhere for curiosity to go.

## THE CORPUS — measured, not estimated

    9   roles + degrees, periods 2019–2027, several overlapping
    2   publications (one arXiv paper with a real 11-row out-of-sample metrics table,
        67 periods 2020-02..2025-08, three strategies)
    2   shipped projects with public repos
    3   awards
    4   declared research interests
    2   calligraphy works
    42  photographs — real image assets
    42  photo TITLES and 42 written NOTES, mean 82 chars, e.g.
        "Foam carves temporary calligraphy into the granite edge, then erases it."
        "A red canoe solving the equation between turquoise stillness and the mountain's
         white verticals."
    9   typeset equations (KaTeX → MathML at build time)
    20  signals scored 1–5 for evidence strength, with one-clause justifications
    ---
    173 items total. The factor fan mined 20 and ignored 153 (88%).

## The insight this changes

Every chart read empty because it visualised **20 abstracted scores** while ignoring the only
material on the site with a VOICE in it. A stranger does not get curious about β = 0.459. They
get curious about a sentence like the two quoted above — and then wonder who wrote it.

So the showpiece's raw material is probably the 42 notes + 42 images + 9 equations, not the
scores. Scores can stay as the *ordering* mechanism underneath; they should not be the subject.

## THE FRAMING THAT ARRIVED LAST, AND IS THE STRONGEST (owner, verbatim)

> "One thing peculiar to my case is that I've spent a very large portion of my career working as
> a fullstack SDE. This is weird because most who've chosen this path would stay on the path and
> never think about going into quant. I think one very important characteristic of my career is
> that I'm TRUE TO MY OWN DREAM AND FEELINGS. I'm almost running a GRADIENT DESCENT ON MY OWN
> while finding that we are at a LOCAL MIN in the SDE — that's why we adapted and intended to
> find the GLOBAL MIN. This is optimization. I think this part can be in the experience."

And immediately after, the part that upgrades it from metaphor to thesis:

> "As we wander through our career, we are not only getting more info from the exterior, we also
> learn more about OUR SENSITIVITY TO THE WORLD. Like what we really like vs. what we don't like.
> That's also the key."

### Why this is the answer and not another metaphor

1. **It is literally true of the hero's existing field.** Measured, not asserted — see below.
2. **It is the paper's own thesis.** profile.ts describes RL-BHRP as *"learning how to allocate,
   rather than assuming."* The career story is structurally identical: not descending a known
   landscape, but LEARNING THE OBJECTIVE while descending. Trajectory and research agenda are the
   same shape, which is a claim nobody else can borrow.
3. **It explains the SDE→quant move without self-congratulation.** The field looked flat in one
   direction until he learned he was sensitive to it. That is a statement about preference
   discovery, not about being better than other engineers.

### The hero's field ALREADY contains the story — measured with lib/terrain.ts's own BUMPS

    distinct minima                 2
    global min      (-1.46, -0.64)  depth -0.9019
    second basin    ( 1.76,  0.79)  depth -0.4774
    gap                             0.4245   (the global is meaningfully better)
    barrier on the direct path      +0.2646 at t=0.44
    climb required to escape        0.7421
    plain descent from the 2nd basin stays stuck   VERIFIED

So: a real local minimum, a real deeper minimum, a real barrier, and provable entrapment — a pure
gradient descent CANNOT cross it. Escaping requires going uphill, which is exactly the story and
is honest about the maths. Nothing has to be invented or relabelled.

MEASUREMENT BUG WORTH RECORDING: the first run of this reported "2nd basin = global min, gap
0.0000" because two of the three declared bump centres descend into the SAME basin and the script
took found[0] and found[1] off a sorted list without deduping. Dedupe by position before claiming
two basins exist.

### What this implies for the showpiece

The subject is not a chart of him. It is a TRAJECTORY through a landscape whose shape is being
learned — and the honest extra dimension is that the objective function itself changes as the
walker learns its own sensitivity. Candidate reading: the section is /experience, told as a
descent with one escape, where the terrain's curvature is what gets revealed rather than his
scores.

## Constraints any successor must satisfy

- Continuous with the descent in register AND scroll; it is the bottom of a journey down a sky.
- Continuity WITHOUT repetition: the hero is already a dotted gradient-descent terrain. Being
  the *arrival* of that journey is allowed; being a second terrain is not.
- Six destinations as real focusable DOM links over the geometry (Projects, Research,
  Experience, Writing "coming", Market reports "coming", Art).
- No hand-authored illustration. Three attempts proved this implementer cannot do drawn props,
  furniture or figures. Beauty must come from data, geometry, material and motion.
- Palette tokens only; seal vermilion is the only saturated colour in light theme.
- Lazy-loaded three.js (Lighthouse never scrolls, so Perf ≥99 holds); motion behind
  prefers-reduced-motion; the still state must look finished — it is also the no-JS state.
- Deterministic paint: no Math.random() at paint time.

## The open questions, for whenever this is picked up again

Not rhetorical — these are the actual forks, and none of them has been settled:

1. **Does the trajectory replace the showpiece, or live on /experience?** The owner said "I think
   this part can be in the experience." If it goes there, the homepage slot still needs an answer.
   If it becomes the showpiece, /experience keeps the spine it already has.
2. **What is the curiosity mechanism, concretely?** "Explorable" was satisfied by the pod because
   there were clickable monitors. What is the abstract equivalent that is not a menu in costume?
3. **What is the subject: the path, or the work?** The trajectory is about him. The 42 photographs
   with their 42 written notes are about the work and carry actual voice. A stranger is more likely
   to be hooked by "foam carves temporary calligraphy into the granite edge, then erases it" than
   by any statistic. These may be the same object (the path passes through what was made) or two
   different ones.
4. **Continuity without repetition** remains the hardest constraint. Being the ARRIVAL of the
   hero's descent is allowed. Being a second terrain is not. Nobody has drawn the line precisely.
5. **Does the objective-learning idea have a visual form?** "We learn our sensitivity to the
   world" is the strongest half of the framing and the least obviously drawable. A field whose
   curvature changes as the walker learns is the literal reading; whether that is legible in five
   seconds is untested.

## The lesson from five failures, stated plainly

Every rejection came from building before deciding. The pod was built, then diagnosed as wrong in
register. The fan was built twice, then rejected for framing. The cheapest thing that ever worked
was `/proto-showpiece` — static SVG frames judged in one look for the cost of one function. Any
sixth attempt should produce a still frame first and only then move to three.js.
