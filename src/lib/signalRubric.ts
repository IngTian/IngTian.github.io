// src/lib/signalRubric.ts
// The RUBRIC an LLM scores against, and the identity of the content it scored.
//
// WHY A PUBLISHED RUBRIC IS THE WHOLE POINT:
// The factor model's betas are numbers on a page a quant researcher will read. When beta was
// "artefact count / total" the caption could state verifiable arithmetic. The moment an LLM
// assigns strengths, beta becomes a JUDGEMENT wearing a hard number's clothing — and
// "an LLM scored it" is a worse answer to "what is this computed from?" than counting is.
//
// So the split, and it is load-bearing:
//   • the LLM scores EVIDENCE STRENGTH per item, against the fixed rubric below
//   • the arithmetic that turns scores into betas stays mechanical and readable
//   • the rubric ships ON THE PAGE, so a reader can see the rule the number came from
// A judgement with a published rule is defensible. An unexplained number is not.
//
// WHY SCORES ARE A COMMITTED ARTEFACT AND NOT A BUILD-TIME CALL:
// An LLM call at build time would make two builds of identical content produce different
// betas — breaking the site's determinism rule, drifting the numbers between deploys for no
// content reason, and putting an API key in the deploy path. So src/data/signalWeights.ts is
// committed and reviewed like any other change, and the build only ever reads it. A PR then
// shows the score diff, so a moved beta is visible BEFORE it ships. That part is sound.
//
// THERE IS NO `npm run score`, AND THIS COMMENT CLAIMED THERE WAS — twice, here and on
// `staleSignals` below. Scoring is a MANUAL operation: run the RUBRIC_PROMPT below against the
// live items by hand, then hand-edit signalWeights.ts. Nothing in the repo automates it —
// there is no `scripts/` directory, package.json has no `score` entry, and no file writes
// signalWeights.ts. Naming a command that does not exist is worse than naming none: it reads
// as "the procedure is covered" to the next person who finds `staleSignals` red, and they then
// go looking for a script instead of doing the work. If this is worth automating, write the
// script and restore the name in the same commit.

/** The scale. Deliberately coarse: an LLM asked for 1-100 invents precision it does not
 *  have, and a five-point scale with named anchors is reproducible enough that two runs
 *  mostly agree. */
export const SCALE = [
  { score: 1, name: 'mention', gloss: 'Stated, with no artefact a reader could check.' },
  { score: 2, name: 'described', gloss: 'Concrete detail, but nothing external to verify it.' },
  { score: 3, name: 'evidenced', gloss: 'A named system, dataset, venue or measurable outcome.' },
  { score: 4, name: 'verifiable', gloss: 'A reader can go and check it — a link, a paper, a repo, a public artefact.' },
  { score: 5, name: 'peer-checked', gloss: 'Reviewed or adopted by someone other than the author.' },
] as const;

export type Score = 1 | 2 | 3 | 4 | 5;

/**
 * The instruction the model is given, verbatim.
 *
 * KEPT AS PROVENANCE, NOT FOR A RENDERER — and this doc used to claim the opposite ("exported so the
 * page can print it: the reader sees exactly what was asked, not a paraphrase"). No page prints it; a
 * grep over comment-stripped `src` finds zero references outside this file. The intent was real and may
 * come back, but the sentence described a surface that does not exist.
 *
 * It stays because the betas in data/signalWeights.ts are a committed judgement, and this is the only
 * record of what was actually asked to produce them — delete it and the numbers become unexplained,
 * which is the thing this module's header says it exists to prevent. `tests/signalRubric.test.ts` is
 * therefore its only caller, deliberately: this is the documented "exists so a test can assert an
 * invariant on production data" case, and the spec checks the prompt still names the scale it ships.
 */
export const RUBRIC_PROMPT = `
Score how strongly each item EVIDENCES quantitative-research capability, on this scale:

  1 mention      — stated, no artefact a reader could check
  2 described    — concrete detail, nothing external to verify it
  3 evidenced    — a named system, dataset, venue or measurable outcome
  4 verifiable   — a reader can go and check it (link, paper, repo, public artefact)
  5 peer-checked — reviewed or adopted by someone other than the author

Rules:
- Score the EVIDENCE, not the prestige. A big company name is not evidence; a measured
  outcome or a checkable artefact is.
- Score only what the text says. Do not infer, do not be generous, do not round up.
- An item with no verifiable trace cannot exceed 3, however impressive it sounds.
- Return one score per item and one clause saying which words in the item justified it.
`.trim();

/** A single scored item, as written into the committed artefact. */
export interface ScoredSignal {
  /** Stable id: '<collection>:<index>', or '<collection>:<slug>' for projects. An index id survives
   *  reordering within a collection only if the label also matches — see `staleSignals`. */
  id: string;
  /** The item's own text, stored so a later edit is DETECTABLE rather than silent. */
  label: string;
  factor: string;
  score: Score;
  /** The model's one-clause justification. Shown on hover; also the thing that makes a bad
   *  score arguable rather than mysterious. */
  because: string;
}

export interface SignalWeights {
  /** Which model produced these, so the provenance is on the record. */
  model: string;
  /** ISO date the scoring ran. Passed in, never generated at import time (determinism). */
  scoredAt: string;
  signals: ScoredSignal[];
}

// A `hashContent` FUNCTION AND A `contentHash` FIELD USED TO LIVE HERE, and they are deleted rather
// than finished, because the thing they promised already exists and works.
//
// The field's doc read: "A mismatch means profile.ts moved on and the scores are stale — asserted by a
// test, so staleness is a red build rather than a quiet lie." None of that was happening. Its value in
// the only record that exists was the literal string 'PENDING'; nothing read the field; and no test
// asserted it, so the red build it promised could not occur. `hashContent`'s only caller was its own
// spec — five assertions about a hash nobody computed.
//
// `staleSignals` below answers the same question and is wired up: it compares every scored id's label
// against the live one, and tests/signalWeights.test.ts calls it, so an edited profile.ts entry really
// does turn the suite red. Two mechanisms for one question, one finished and one abandoned half-way,
// with the comment claiming the guarantee attached to the abandoned one. If a hash is ever wanted — it
// would catch a reordering that label-matching misses — add it with its producer and its assertion in
// the same change.

/** Which scored ids no longer match the live content, and which live items are unscored.
 *
 *  Either condition means the scores need redoing — BY HAND. See the header: there is no `score` script,
 *  which is what this doc comment used to send you looking for. `tests/signalWeights.test.ts` calls this to
 *  assert the committed artefact has not drifted from live profile.ts, which is the documented exception for
 *  an export whose only caller is a spec: it exists so the test can check an invariant on production data. */
export function staleSignals(
  live: readonly { id: string; label: string }[],
  scored: readonly ScoredSignal[],
): { missing: string[]; changed: string[]; orphaned: string[] } {
  const byId = new Map(scored.map((s) => [s.id, s]));
  const liveIds = new Set(live.map((l) => l.id));
  return {
    missing: live.filter((l) => !byId.has(l.id)).map((l) => l.id),
    changed: live.filter((l) => byId.has(l.id) && byId.get(l.id)!.label !== l.label).map((l) => l.id),
    orphaned: scored.filter((s) => !liveIds.has(s.id)).map((s) => s.id),
  };
}
