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
// content reason, and putting an API key in the deploy path. Instead `npm run score` writes
// src/data/signalWeights.ts, that file is committed and reviewed like any other change, and
// the build only ever reads it. A PR then shows the score diff, so a moved beta is visible
// BEFORE it ships.

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

/** The instruction the model is given, verbatim. Exported so the page can print it: the
 *  reader sees exactly what was asked, not a paraphrase. */
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
  /** Stable id: '<collection>:<index>'. Survives reordering within a collection only if the
   *  label also matches — see `staleSignals`. */
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
  /** Hash of the scored content. A mismatch means profile.ts moved on and the scores are
   *  stale — asserted by a test, so staleness is a red build rather than a quiet lie. */
  contentHash: string;
  signals: ScoredSignal[];
}

/** A small, stable string hash. Not cryptographic — it only has to change when the content
 *  changes, and be identical across machines and Node versions. */
export function hashContent(parts: readonly string[]): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (const p of parts) {
    for (let i = 0; i < p.length; i++) {
      const c = p.charCodeAt(i);
      h1 = ((h1 ^ c) * 0x01000193) >>> 0;
      h2 = ((h2 + c) * 0x85ebca6b) >>> 0;
    }
    h1 = (h1 ^ 0x2f) >>> 0;
  }
  return (h1.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0'));
}

/** Which scored ids no longer match the live content, and which live items are unscored.
 *  Either condition means `npm run score` needs re-running. */
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
