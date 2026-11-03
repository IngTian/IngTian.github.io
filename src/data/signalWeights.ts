// src/data/signalWeights.ts
//
// GENERATED, THEN COMMITTED AND REVIEWED. Do not hand-edit scores — re-run the scorer and
// review the diff, so a moved beta is visible in a PR before it ships.
//
// Why this is a committed file rather than a build-time LLM call: an LLM call during `astro
// build` would make two builds of identical content produce different betas, breaking the
// site's determinism rule, drifting the numbers between deploys for no content reason, and
// putting an API key in the deploy path. Here the judgement is an artefact under review.
//
// HOW THESE WERE PRODUCED
// Three independent raters scored every item against the fixed rubric in
// src/lib/signalRubric.ts (RUBRIC_PROMPT, published on the page). Each rater had a different
// stance — sceptical, literal, and "a quant hiring for a buy-side seat" — and none saw the
// others' scores. The committed score is the MEDIAN, which is robust to one outlier.
//
// INTER-RATER AGREEMENT (the reason these numbers are usable at all):
//   20 items · 14 exact agreement · 20 within one point · 0 disputes (spread >= 2)
// A rubric that produced scattered scores would be a number generator, not a measurement,
// and would not belong on the page.
//
// WHAT THE SCORES SAY, stated plainly because the page must not soften it: verifiable
// quant-research evidence is concentrated in TWO items — the RL-BHRP paper and the freelance
// quant role that produced it (both 4). The most impressive-sounding line on the résumé,
// Senior SWE at TikTok, scored 2: all three raters noted that "$200M in creative spend" and
// "50k QPS" measure serving throughput, not modelling quality. The four research interests
// scored 1 unanimously — they are declared interests, not artefacts.
//
// Nothing may exceed 4 without external validation. arXiv is verifiable, not peer-reviewed.
//
// SECOND PASS — Claude Opus 5.5, 2026-11-02 — for the five projects added by the /projects redesign
// (rl-bhrp, offchart, trading-desk, daylogs, macboot). The `model` and `scoredAt` fields below still
// describe the first pass, which scored the other twenty.
//
// WHAT THE RATERS WERE GIVEN: RUBRIC_PROMPT and SCALE, this file (to calibrate against witness and manifold,
// both 2), and each project's RECORD text from profile.ts — NOT its README. One item per project: its
// visibility, its `idea` in quotes, then its `proof` chips joined by "; ". macboot's item opened "PRIVATE
// repo, no public link", which is the scoring prompt's wording for `visibility: 'private'`, not record text.
// Record text is the instrument on purpose (an early plan draft said READMEs and was corrected): it is what
// the first pass scored for all twenty items, the item a reader of this site sees under RUBRIC_PROMPT's
// "score only what the text says", and the only text the quote guard below can check offline.
//
// Three raters, run concurrently; each read only the rubric and this file, and none saw another's output.
// Unlike the first pass they had no assigned stances — all three got the same prompt. Their scores:
//              rl-bhrp  offchart  trading-desk  daylogs  macboot
//   rater 1       4        3           2           2        1
//   rater 2       4        3           2           2        1
//   rater 3       4        3           2           2        1
// 5 items · 5 exact agreement · 0 disputes, so each committed MEDIAN is unanimous, and each `because` is
// rater 2's sentence verbatim (all three tied, so the middle rater) — with ONE later edit. trading-desk's
// chip was scored as "~270 tests" and then corrected to "~300 tests" (323 collected, 299 run without a
// book), and its quote follows the chip. It was not re-scored: all three raters read the count only as
// "public and checkable" and capped the item as ledger software rather than modelling (two called it
// bookkeeping, one accounting), so the count did not set the 2.
// tests/signalWeights.test.ts checks that every quoted span in a project's `because` is still in its item.
//
// Project ids are keyed by slug (`projects:witness`), not by index, so adding a project does not reshuffle
// these scores.

import type { SignalWeights } from '../lib/signalRubric';

export const SIGNAL_WEIGHTS: SignalWeights = {
  model: 'claude-opus-5 (3 raters, median)',
  scoredAt: '2026-08-08',
  signals: [
    // ── Experience ──────────────────────────────────────────────────────────
    {
      id: 'timeline:0', factor: 'experience', score: 2,
      label: 'Incoming PhD, Operations Research · University of Toronto',
      because: 'Named advisor and a specific focus, but the entry says the PhD has not begun — no research output exists yet to check.',
    },
    {
      id: 'timeline:1', factor: 'experience', score: 2,
      label: 'Software Engineer · Electronic Arts',
      because: 'Dual-tower retrieval and ranking is concrete modelling, but everything measurable is stack and infrastructure, with no result and no external trace.',
    },
    {
      id: 'timeline:2', factor: 'experience', score: 4,
      label: 'Freelance Quantitative Researcher · Independent',
      because: 'Signal research in Python plus arXiv:2508.11856 is a checkable artefact squarely on the quant axis; the trading system alone reports no PnL or track record.',
    },
    {
      id: 'timeline:3', factor: 'experience', score: 2,
      label: 'Senior Software Engineer · TikTok',
      because: '$200M and 50k QPS are real numbers, but they measure serving throughput rather than model quality, and "Exceptional review" is an internal rating with no external trace.',
    },
    {
      id: 'timeline:4', factor: 'experience', score: 2,
      label: 'SWE Co-op · Ericsson AI Lab (GAIA)',
      because: 'One-shot ML models over time-series data is genuine modelling, described with no accuracy figure, dataset name, or publication.',
    },
    {
      id: 'timeline:5', factor: 'experience', score: 1,
      label: 'SDE Intern · Amazon',
      because: 'Entirely data-pipeline engineering — no statistical or modelling content to evidence on this axis.',
    },
    {
      id: 'timeline:6', factor: 'experience', score: 1,
      label: 'Research Assistant · McGill',
      because: 'Compiler and programming-languages research: real research training, but it carries no quantitative content and no output is linked.',
    },
    {
      id: 'timeline:7', factor: 'experience', score: 1,
      label: 'SDE Intern · TikTok',
      because: 'Front-end work; the $1M/day figure is the page’s revenue, not an outcome attributable to the work described.',
    },
    {
      id: 'timeline:8', factor: 'experience', score: 2,
      label: 'B.Eng, Computer Engineering · McGill',
      because: 'CGPA 3.99 and Dean’s Honour List are measurable and externally conferred, but they attest coursework rather than research output.',
    },

    // ── Research ────────────────────────────────────────────────────────────
    {
      id: 'publications:0', factor: 'research', score: 4,
      label: 'Optimal Portfolio Construction — A Reinforcement-Learning-Embedded Bayesian Hierarchical Risk Parity (RL-BHRP) Approach',
      because: 'arXiv:2508.11856 with a public PDF and a full out-of-sample metrics table over a stated train/test split is fully checkable — but a preprint is not peer-reviewed.',
    },
    {
      id: 'publications:1', factor: 'research', score: 4,
      label: 'Self-Attention on RNN-based Text Classification',
      because: 'A real proceedings volume a reader can look up, but the entry carries no link, no dataset and no reported metric, and text classification is off this axis.',
    },
    {
      id: 'interests:0', factor: 'research', score: 1,
      label: 'Multi-period portfolio optimization',
      because: 'A declared interest — a statement of intent with no attached artefact.',
    },
    {
      id: 'interests:1', factor: 'research', score: 1,
      label: 'Risk parity & hierarchical methods',
      because: 'A topic label with a prose gloss; nothing produced or checkable.',
    },
    {
      id: 'interests:2', factor: 'research', score: 1,
      label: 'Reinforcement learning for allocation',
      because: 'Restates the paper’s theme as an interest; the paper itself is the artefact and is scored separately.',
    },
    {
      id: 'interests:3', factor: 'research', score: 1,
      label: 'Operations research & convex optimization',
      because: 'Names theory intended for study, with no coursework grade, proof or write-up to inspect.',
    },

    // ── Projects ────────────────────────────────────────────────────────────
    {
      id: 'projects:rl-bhrp', factor: 'projects', score: 4,
      label: 'rl-bhrp',
      because: 'A public repo that rebuilds "my published portfolio allocator" from the paper, with "tests tied to the paper\'s theorems" and "results committed", is checkable and squarely on the quant axis. It is still the author reproducing his own work, though, so nobody else has checked it yet.',
    },
    {
      id: 'projects:offchart', factor: 'projects', score: 3,
      label: 'offchart',
      because: 'Named datasets ("CFTC Commitments of Traders, UMich expectations") in a public repo, plus "can\'t see the future", show point-in-time discipline that matters for research. But it is data infrastructure, and the text names no signal, model or result built on it.',
    },
    {
      id: 'projects:trading-desk', factor: 'projects', score: 2,
      label: 'trading-desk',
      because: 'Public and checkable ("on PyPI; ~300 tests"), but "a trading book in the terminal" that "gets P&L right across currencies" is bookkeeping software. The tests show engineering correctness, not modelling or research.',
    },
    {
      id: 'projects:witness', factor: 'projects', score: 2,
      label: 'witness',
      because: 'A public, checkable artefact, but developer tooling with no statistics, optimisation or modelling in it.',
    },
    {
      id: 'projects:daylogs', factor: 'projects', score: 2,
      label: 'daylogs',
      because: 'Public and checkable ("on PyPI"), but tracking "weight, food and spending" is a personal logging tool with no statistics, optimisation or modelling in it, the same off-axis band as witness.',
    },
    {
      id: 'projects:manifold', factor: 'projects', score: 2,
      label: 'manifold',
      because: 'Public and checkable, and it does implement a Gaussian-bump field with gradient-descent walkers — but it visualises maths rather than researching it.',
    },
    {
      id: 'projects:macboot', factor: 'projects', score: 1,
      label: 'macboot',
      because: 'A "PRIVATE repo, no public link", so a reader can check nothing. "Mac setup" run "by Claude Code" and "was 4,700 lines of bash" describe machine provisioning, with no quantitative content.',
    },

    // ── Craft ───────────────────────────────────────────────────────────────
    {
      id: 'awards:0', factor: 'craft', score: 2,
      label: 'IEEExtreme — Top 4 teams in Canada',
      because: 'A measurable placement judged by a third party, but it measures timed competitive programming, and no standings page is linked.',
    },
    {
      id: 'awards:1', factor: 'craft', score: 1,
      label: 'Hatch Scholarships ($10k) · McGill',
      because: 'Merit funding with a magnitude; it attests academic standing rather than quantitative-research output.',
    },
    {
      id: 'awards:2', factor: 'craft', score: 1,
      label: 'Rio Tinto–Richards Evans Exchange Award · McGill',
      because: 'A name only — no criteria, magnitude or quantitative content.',
    },
  ],
};
