// src/data/signalWeights.ts
//
// RATED, THEN COMMITTED AND REVIEWED. Do not hand-pick a score — run the rating pass below and review the
// diff, so a moved beta is visible in a PR before it ships.
//
// THE RATING PASS IS MANUAL AND THERE IS NO SCRIPT. This header used to say "re-run the scorer", and
// lib/signalRubric.ts named `npm run score` as the thing that writes this file. No such script has ever
// existed — `package.json` has seven and none is `score` — so the three staleness tests in
// tests/signalWeights.test.ts were failing with instructions to run a command nobody could run. Keeping an
// API key out of the build is the deliberate reason there is no script (see signalRubric.ts), so the manual
// pass is the real price of that, not an oversight to route around. If it ever is automated, the script lands
// in package.json in the same commit as the comment claiming it.
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
//   23 items · 16 exact agreement · 23 within one point · 0 disputes (spread >= 2)
// A rubric that produced scattered scores would be a number generator, not a measurement,
// and would not belong on the page.
//
// THE THREE PROJECT ITEMS ADDED LATER WERE ANCHORED, NOT BLIND, and that is a real difference worth
// declaring rather than burying in an averaged agreement line. The original 20 were scored in one pass in
// which the raters saw no committed scores at all. offchart, trading-desk and daylogs were scored afterwards
// by three fresh raters (same three stances) who were shown the existing 20 as calibration anchors, because
// the alternative — a blind pass that re-scored everything — would have moved betas on items whose content had
// not changed. Their agreement was 2 exact / 3 within one / 0 disputes. Treat a future full re-score as the
// stronger measurement if the two ever disagree.
//
// WHAT THE SCORES SAY, stated plainly because the page must not soften it: verifiable
// quant-research evidence sits in THREE items — the RL-BHRP paper, the freelance quant role that produced it,
// and now offchart (all 4). The most impressive-sounding line on the résumé,
// Senior SWE at TikTok, scored 2: all three raters noted that "$200M in creative spend" and
// "50k QPS" measure serving throughput, not modelling quality. The four research interests
// scored 1 unanimously — they are declared interests, not artefacts.
//
// offchart is the one score that moved the picture, and it was the only non-unanimous item in this batch
// (3 / 4 / 4). The dissent is worth keeping because it is the better argument against the number: the
// sceptical rater held that a repo which is "data and preprocessing only", with the forward-return study
// explicitly not done, evidences hygiene rather than research and should sit at 3. The two 4s turned on the
// same fact read the other way — that the checkable thing IS the statistics (expanding-window ranking,
// look-ahead refused at the statistic, the gate, the as-of join and the query, with non-causal
// implementations asserted to fail), where witness and manifold were held at 2 for being tooling and
// visualisation. All three agreed it is not a 5: 0 stars, 0 forks, and 130 author-written tests are not
// external validation.
//
// Nothing may exceed 4 without external validation. arXiv is verifiable, not peer-reviewed.

import type { SignalWeights } from '../lib/signalRubric';

export const SIGNAL_WEIGHTS: SignalWeights = {
  model: 'claude-opus-5 (3 raters, median)',
  scoredAt: '2026-08-08',
  contentHash: 'PENDING',
  signals: [
    // ── Experience ──────────────────────────────────────────────────────────
    {
      id: 'timeline:incoming-phd-operations-research-university-of-toronto', factor: 'experience', score: 2,
      label: 'Incoming PhD, Operations Research · University of Toronto',
      because: 'Named advisor and a specific focus, but the entry says the PhD has not begun — no research output exists yet to check.',
    },
    {
      id: 'timeline:software-engineer-electronic-arts', factor: 'experience', score: 2,
      label: 'Software Engineer · Electronic Arts',
      because: 'Dual-tower retrieval and ranking is concrete modelling, but everything measurable is stack and infrastructure, with no result and no external trace.',
    },
    {
      id: 'timeline:freelance-quantitative-researcher-independent', factor: 'experience', score: 4,
      label: 'Freelance Quantitative Researcher · Independent',
      because: 'Signal research in Python plus arXiv:2508.11856 is a checkable artefact squarely on the quant axis; the trading system alone reports no PnL or track record.',
    },
    {
      id: 'timeline:senior-software-engineer-tiktok', factor: 'experience', score: 2,
      label: 'Senior Software Engineer · TikTok',
      because: '$200M and 50k QPS are real numbers, but they measure serving throughput rather than model quality, and "Exceptional review" is an internal rating with no external trace.',
    },
    {
      id: 'timeline:swe-co-op-ericsson-ai-lab-gaia', factor: 'experience', score: 2,
      label: 'SWE Co-op · Ericsson AI Lab (GAIA)',
      because: 'One-shot ML models over time-series data is genuine modelling, described with no accuracy figure, dataset name, or publication.',
    },
    {
      id: 'timeline:sde-intern-amazon', factor: 'experience', score: 1,
      label: 'SDE Intern · Amazon',
      because: 'Entirely data-pipeline engineering — no statistical or modelling content to evidence on this axis.',
    },
    {
      id: 'timeline:research-assistant-mcgill', factor: 'experience', score: 1,
      label: 'Research Assistant · McGill',
      because: 'Compiler and programming-languages research: real research training, but it carries no quantitative content and no output is linked.',
    },
    {
      id: 'timeline:sde-intern-tiktok', factor: 'experience', score: 1,
      label: 'SDE Intern · TikTok',
      because: 'Front-end work; the $1M/day figure is the page’s revenue, not an outcome attributable to the work described.',
    },
    {
      id: 'timeline:b-eng-computer-engineering-mcgill', factor: 'experience', score: 2,
      label: 'B.Eng, Computer Engineering · McGill',
      because: 'CGPA 3.99 and Dean’s Honour List are measurable and externally conferred, but they attest coursework rather than research output.',
    },

    // ── Research ────────────────────────────────────────────────────────────
    {
      id: 'publications:optimal-portfolio-construction-a-reinforcement-learning-embedded-bayesian-hierarchical-risk-parity-rl-bhrp-approach', factor: 'research', score: 4,
      label: 'Optimal Portfolio Construction — A Reinforcement-Learning-Embedded Bayesian Hierarchical Risk Parity (RL-BHRP) Approach',
      because: 'arXiv:2508.11856 with a public PDF and a full out-of-sample metrics table over a stated train/test split is fully checkable — but a preprint is not peer-reviewed.',
    },
    {
      id: 'publications:self-attention-on-rnn-based-text-classification', factor: 'research', score: 4,
      label: 'Self-Attention on RNN-based Text Classification',
      because: 'A real proceedings volume a reader can look up, but the entry carries no link, no dataset and no reported metric, and text classification is off this axis.',
    },
    {
      id: 'interests:multi-period-portfolio-optimization', factor: 'research', score: 1,
      label: 'Multi-period portfolio optimization',
      because: 'A declared interest — a statement of intent with no attached artefact.',
    },
    {
      id: 'interests:risk-parity-hierarchical-methods', factor: 'research', score: 1,
      label: 'Risk parity & hierarchical methods',
      because: 'A topic label with a prose gloss; nothing produced or checkable.',
    },
    {
      id: 'interests:reinforcement-learning-for-allocation', factor: 'research', score: 1,
      label: 'Reinforcement learning for allocation',
      because: 'Restates the paper’s theme as an interest; the paper itself is the artefact and is scored separately.',
    },
    {
      id: 'interests:operations-research-convex-optimization', factor: 'research', score: 1,
      label: 'Operations research & convex optimization',
      because: 'Names theory intended for study, with no coursework grade, proof or write-up to inspect.',
    },

    // ── Projects ────────────────────────────────────────────────────────────
    // Listed in profile.ts array order, which is also render order. offchart is the first project to reach 4,
    // and the only item on the page outside the paper and the freelance role to do so.
    {
      id: 'projects:offchart', factor: 'projects', score: 4,
      label: 'offchart',
      because: 'Point-in-time percentile discipline over a named public dataset, mechanically proven rather than asserted: the suite requires a prefix-computed rank to match the full series sliced, and asserts that a full-sample rank and a centred rolling mean both FAIL that check. Not a result, though — the forward-return study is named as work not done, and nobody outside the author has reviewed any of it.',
    },
    {
      id: 'projects:witness', factor: 'projects', score: 2,
      label: 'witness',
      because: 'A public, checkable artefact, but developer tooling with no statistics, optimisation or modelling in it.',
    },
    {
      id: 'projects:trading-desk', factor: 'projects', score: 2,
      label: 'trading-desk',
      because: 'A public, checkable artefact with a real instinct about what is unknown — NULL is never zero, and a partial total is refused rather than printed — but the substance is database constraints and accounting arithmetic, with no statistic, no model, and deliberately no track record.',
    },
    {
      id: 'projects:daylogs', factor: 'projects', score: 2,
      label: 'daylogs',
      because: 'Public, packaged and fully checkable, and refusing a BMI chart because that curve is the weight curve times a constant is real restraint — but the only mathematics in it is a published BMR formula applied honestly, and a personal day log carries nothing on the quant-research axis.',
    },
    {
      id: 'projects:manifold', factor: 'projects', score: 2,
      label: 'manifold',
      because: 'Public and checkable, and it does implement a Gaussian-bump field with gradient-descent walkers — but it visualises maths rather than researching it.',
    },

    // ── Craft ───────────────────────────────────────────────────────────────
    {
      id: 'awards:ieeextreme-top-4-teams-in-canada', factor: 'craft', score: 2,
      label: 'IEEExtreme — Top 4 teams in Canada',
      because: 'A measurable placement judged by a third party, but it measures timed competitive programming, and no standings page is linked.',
    },
    {
      id: 'awards:hatch-scholarships-10k-mcgill', factor: 'craft', score: 1,
      label: 'Hatch Scholarships ($10k) · McGill',
      because: 'Merit funding with a magnitude; it attests academic standing rather than quantitative-research output.',
    },
    {
      id: 'awards:rio-tinto-richards-evans-exchange-award-mcgill', factor: 'craft', score: 1,
      label: 'Rio Tinto–Richards Evans Exchange Award · McGill',
      because: 'A name only — no criteria, magnitude or quantitative content.',
    },
  ],
};
