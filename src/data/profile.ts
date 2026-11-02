export interface TimelineEntry {
  period: string;
  title: string;
  sub?: string;       // optional second line under the title (e.g. employer / arrangement)
  detail: string;
  kind: 'work' | 'education';
}

export interface PublicationResult {
  value: string; // e.g. "~120%"
  label: string; // e.g. "adaptive (out-of-sample 2020–25)"
}

// A full results table: one row per metric, compared across columns (models).
export interface MetricsTable {
  caption: string;
  columns: string[];          // e.g. ['RL-BHRP', 'BHRP', 'Benchmark']
  rows: { metric: string; values: string[]; highlight?: boolean }[];
}

export interface Publication {
  authors: string;
  title: string;
  venue: string;
  year: string;
  href?: string;          // primary link (arXiv abstract page, etc.)
  // ── richer fields, surfaced on the /research page (all optional) ──
  arxivId?: string;       // e.g. "2508.11856"
  pdfHref?: string;       // direct PDF link
  subject?: string;       // e.g. "q-fin.PM (Portfolio Management)"
  idea?: string;          // plain-language "what it is"
  takeaway?: string;      // one-line "why it matters"
  results?: PublicationResult[]; // headline numbers, shown as a stat strip
  metrics?: MetricsTable; // full results table (verbatim from the paper)
  abstract?: string;      // verbatim abstract
  featured?: boolean;     // gets the full treatment on /research
  // Short label for the /research rail. Real titles run 100+ chars, which is
  // unusable at 11px mono in a narrow margin. Falls back to `title`.
  shortTitle?: string;
  // Which set of typeset equations this paper OWNS, keyed into research.astro's
  // showcase table. Load-bearing for honesty: the showcase used to be a
  // page-level constant rendered inside the per-paper loop, so a second featured
  // paper would have displayed RL-BHRP's equations under its own title. A paper
  // without a mathKey renders no Method block and gets no Method stop.
  mathKey?: string;
}

export interface Award {
  year: string;
  title: string;
}

export interface ResearchInterest {
  label: string;
  gloss: string;
}

export type ProjectTier = 'selected' | 'workshop';
export type ProjectKind = 'research' | 'data' | 'tool' | 'engine' | 'art' | 'guide';

// Images are deliberately NOT on the record: vitest runs without Astro's vite, so a test importing this
// file could not import an image. They are keyed by slug in their own module.
export interface Project {
  slug: string;            // the GitHub repo name; also the section id and the signal id
  name: string;
  tier: ProjectTier;
  kind: ProjectKind;
  year: string;
  idea: string;            // the one-line idea — rows, cards, pop-up, homepage appendix
  short: string;           // the ls listing's description (≤ 44 chars), set in mono — no → or ↗, which its latin subset lacks
  proof: string[];         // chips; proof[0] is the highlighted one
  // The README's own line, verbatim and runnable — never abbreviated. manifold's holds a 74-char URL with no
  // break opportunity (~510px of 11.5px mono in a ~240px card), so a renderer must wrap it
  // (`overflow-wrap: anywhere`); the card clips its overflow, so an unwrapped line is cut off silently.
  install?: { text: string; prompt?: boolean };   // prompt: shown without a leading "$ "
  visibility: 'public' | 'private';
  registry?: 'pypi' | 'npm';
  ci: boolean;
  releases?: { count: number; asOf: string };     // hand-maintained, YYYY-MM-DD — not fetched at build time
}

export interface InProgressItem { name: string; idea: string; repo?: string }   // repo: set only once the repo exists

export const name = { first: 'Ing', last: 'Tian' } as const;

export const roles = 'Quant Researcher · Portfolio Optimization';
export const rolesSub = 'Full-stack SDE / MLE';
// promoted into the hero subline — incoming OR PhD (starts Fall 2027), kept honest
export const phd = 'Incoming PhD · University of Toronto';

// About-me, shown top-right in the hero (layout B). First-person, quant-first.
// `strong` marks the phrases set in medium weight (UofT + the research focus).
export const bio: { text: string; strong: string[] } = {
  text: 'Quant researcher and incoming Operations Research PhD at the University of Toronto, working on multi-period portfolio optimization. By day, a full-stack software and ML engineer building recommendation systems at scale. Also a guqin player and calligraphy practitioner.',
  strong: ['University of Toronto', 'multi-period portfolio optimization'],
};

// Research interests — shown as themed entries atop /research, with a one-line
// teaser linking in from the homepage. Grounded in the RL-BHRP paper + the
// incoming OR PhD focus; kept to areas actually worked in.
export const researchInterests: ResearchInterest[] = [
  { label: 'Multi-period portfolio optimization', gloss: 'Allocation across horizons, rebalancing as conditions change — not single-shot mean–variance.' },
  { label: 'Risk parity & hierarchical methods', gloss: 'Distributing risk across structure — sectors, then assets — rather than chasing returns.' },
  { label: 'Reinforcement learning for allocation', gloss: 'Policies that learn to allocate under uncertainty, instead of assuming a fixed model.' },
  { label: 'Operations research & convex optimization', gloss: 'The constraints, duality, and structure underneath it all — the OR core of the PhD.' },
];

export const timeline: TimelineEntry[] = [
  { period: 'Fall 2027 —', title: 'Incoming PhD, Operations Research · University of Toronto', sub: 'Advised by Prof. Roy H. Kwon', detail: 'Doctoral research in operations research — multi-period portfolio optimization, and the convex-optimization and duality structure beneath it.', kind: 'education' },
  { period: '2026 —', title: 'Software Engineer · Electronic Arts', sub: 'Contracted via Hatch Innovations Canada', detail: 'Recommendation systems for EA’s AI-driven products — dual-tower retrieval and ranking, end-to-end indexing & serving in Golang, training pipelines in Python over Elasticsearch / vector search, decoupled with Kafka & NATS.', kind: 'work' },
  { period: '2023 —', title: 'Freelance Quantitative Researcher · Independent', detail: 'Built an end-to-end quant trading system (Forex, commodities, indices via OANDA) with a collaborator — signal research in Python, execution engine in Golang, deployed on AWS (ECS, SageMaker). Authored the RL-BHRP portfolio-construction paper (arXiv:2508.11856).', kind: 'work' },
  { period: '2023 — 25', title: 'Senior Software Engineer · TikTok', detail: 'ML systems for ads (Exceptional review — top rating). Built a dual-tower vision pipeline with billion-scale vector search (Faiss) tracking $200M in creative spend, and a C++ / gRPC ad-signature service sustaining 50k QPS for real-time delivery.', kind: 'work' },
  { period: '2022 — 23', title: 'SWE Co-op · Ericsson AI Lab (GAIA)', detail: 'JAMScript NodeCache for node discovery in IoT; a C++ mobility simulator; one-shot ML models detecting malicious smart contracts from time-series data.', kind: 'work' },
  { period: '2022', title: 'SDE Intern · Amazon', detail: 'A fulfillment-data archiving and visual-analysis service — SNS transformed via Lambda, landed in S3 through Firehose, queried with Athena for QuickSight dashboards.', kind: 'work' },
  { period: '2021 — 23', title: 'Research Assistant · McGill', detail: 'Compiler research on JAMScript under Prof. Maheswaran — Ohm-based parser translating to C/JS, CFG grammar for ES6, side-effect & control-flow analysis.', kind: 'work' },
  { period: '2021', title: 'SDE Intern · TikTok', sub: 'Shanghai, China', detail: "Modeled the landing page's structure in TypeScript ahead of a later refactor, and helped ship the interim download page — $1M/day in revenue.", kind: 'work' },
  { period: '2019 — 23', title: 'B.Eng, Computer Engineering · McGill', detail: "CGPA 3.99 · Dean's Honour List · Full Scholarship.", kind: 'education' },
];

export const publications: Publication[] = [
  {
    authors: 'S. Kang, Z. Tian',
    title: 'Optimal Portfolio Construction — A Reinforcement-Learning-Embedded Bayesian Hierarchical Risk Parity (RL-BHRP) Approach',
    venue: 'arXiv preprint',
    year: '2025',
    href: 'https://arxiv.org/abs/2508.11856',
    arxivId: '2508.11856',
    pdfHref: 'https://arxiv.org/pdf/2508.11856',
    subject: 'q-fin.PM · Portfolio Management',
    featured: true,
    shortTitle: 'RL-BHRP',
    mathKey: 'rlbhrp',
    idea: 'Most portfolios either assume a fixed model of risk or chase returns directly. RL-BHRP does neither: it spreads risk hierarchically across sectors and the stocks within them, then uses reinforcement learning to adapt those exposures as market conditions shift — learning how to allocate, rather than assuming.',
    takeaway: 'Allocation that learns instead of assuming — diversified and investable, not a backtest curiosity.',
    results: [
      { value: '~120%', label: 'wealth compounded, out-of-sample 2020–25 (vs 101% static, 91% sector ETF)' },
      { value: '~15% / yr', label: 'average annual growth (vs 13% and 12%)' },
      { value: 'comparable', label: 'drawdowns — value added while staying diversified' },
    ],
    // Verbatim from Table 2 (67 periods, 2020-02-29 → 2025-08-31). Values
    // rounded for display from the paper's reported figures.
    metrics: {
      caption: 'Full period · 2020-02 to 2025-08 · RL-BHRP vs static BHRP vs sector benchmark',
      columns: ['RL-BHRP', 'BHRP', 'Benchmark'],
      rows: [
        { metric: 'Cumulative return', values: ['1.20', '1.01', '0.91'], highlight: true },
        { metric: 'CAGR', values: ['15.2%', '13.4%', '12.3%'], highlight: true },
        { metric: 'Annual volatility', values: ['17.4%', '16.5%', '17.3%'] },
        { metric: 'Sharpe', values: ['0.90', '0.85', '0.76'], highlight: true },
        { metric: 'Sortino', values: ['1.65', '1.53', '1.37'] },
        { metric: 'Max drawdown', values: ['−20.3%', '−19.1%', '−18.3%'] },
        { metric: 'Calmar', values: ['0.75', '0.70', '0.67'] },
        { metric: 'Information ratio', values: ['0.69', '0.22', '—'] },
        { metric: 'CVaR 5%', values: ['−10.2%', '−9.7%', '−10.3%'] },
        { metric: 'Hit rate (>0)', values: ['64.2%', '64.2%', '62.7%'] },
      ],
    },
    abstract:
      'We propose a two-level, learning-based portfolio method (RL-BHRP) that spreads risk across sectors and stocks, and adjusts exposures as market conditions change. Using U.S. Equities from 2012 to mid-2025, we design the model using 2012 to 2019 data, and evaluate it out-of-sample from 2020 to 2025 against a sector index built from exchange-traded funds and a static risk-balanced portfolio. Over the test window, the adaptive portfolio compounds wealth by approximately 120 percent, compared with 101 percent for the static comparator and 91 percent for the sector benchmark. The average annual growth is roughly 15 percent, compared to 13 percent and 12 percent, respectively. Gains are achieved without significant deviations from the benchmark and with peak-to-trough losses comparable to those of the alternatives, indicating that the method adds value while remaining diversified and investable. Weight charts show gradual shifts rather than abrupt swings, reflecting disciplined rebalancing and the cost-aware design. Overall, the results support risk-balanced, adaptive allocation as a practical approach to achieving stronger and more stable long-term performance.',
  },
  {
    authors: 'D. Li, Z. Tian, Y. Duan',
    title: 'Self-Attention on RNN-based Text Classification',
    venue: 'CNSSE / SPIE, vol. 12290',
    year: '2022',
  },
];

export const awards: Award[] = [
  { year: '2021', title: 'IEEExtreme — Top 4 teams in Canada' },
  { year: "'21–'22", title: 'Hatch Scholarships ($10k) · McGill' },
  { year: '2020', title: 'Rio Tinto–Richards Evans Exchange Award · McGill' },
];

// Every notable project, in VALUE order: the selected (quant) tier first, then the workshop of personal tools.
// Records, not prose, because they render in many shapes — the ls listing, the gallery, a row or a card, the
// pop-up, the homepage appendix, and the summary line's counts, which are computed from these fields rather
// than typed. Held back: rebal ("not for release yet") and argmin (one script, no tests or output).
export const projects: Project[] = [
  {
    slug: 'rl-bhrp', name: 'rl-bhrp', tier: 'selected', kind: 'research', year: '2026',
    idea: "My published portfolio allocator, rebuilt from the paper alone — with a plain report of which numbers reproduce and which don't.",
    short: 'my paper, rebuilt from the paper alone',
    proof: ["tests tied to the paper's theorems", 'results committed'],
    visibility: 'public', ci: false,
  },
  {
    slug: 'offchart', name: 'offchart', tier: 'selected', kind: 'data', year: '2026',
    idea: "Public positioning and survey data — CFTC Commitments of Traders, UMich expectations — in one database that can't see the future.",
    short: 'CFTC + survey data, look-ahead-free',
    proof: ['daily CI against the live CFTC feed', 'CFTC data back to 1986'],
    visibility: 'public', ci: true,
  },
  {
    slug: 'trading-desk', name: 'trading-desk', tier: 'selected', kind: 'tool', year: '2026',
    idea: 'A trading book in the terminal that gets P&L right across currencies and refuses to record a state that contradicts itself.',
    short: "a trading book that can't contradict itself",
    // ~300, not the spec's ~270: at trading-desk 1e60108 pytest collects 323, of which test_book.py's 24 skip
    // without a book — so CI runs 299. The README states no count.
    proof: ['on PyPI', '~300 tests'],
    visibility: 'public', registry: 'pypi', ci: true,
  },
  {
    slug: 'witness', name: 'witness', tier: 'selected', kind: 'engine', year: '2026',
    idea: 'Turns any text stream — market news, research, coding sessions — into a dated history of what changed, and why.',
    short: 'text stream to dated history of change',
    proof: ['29 releases', 'cross-platform binaries', 'npm'],
    visibility: 'public', registry: 'npm', ci: true,
    releases: { count: 29, asOf: '2026-11-02' },
  },
  {
    slug: 'daylogs', name: 'daylogs', tier: 'workshop', kind: 'tool', year: '2026',
    idea: 'Weight, food and spending, typed by hand in one line each — plus one short daily read.',
    short: 'weight, food, spending — by hand',
    proof: ['on PyPI, 5 releases'],
    install: { text: 'uv tool install daylogs' },
    visibility: 'public', registry: 'pypi', ci: true,
  },
  {
    slug: 'manifold', name: 'manifold', tier: 'workshop', kind: 'art', year: '2026',
    idea: 'A macOS screensaver: a mountain of light where gradient-descent walkers roll down real optimization surfaces.',
    short: 'a macOS screensaver of real descent',
    proof: ['gradients checked against finite differences in CI'],
    install: { text: 'curl -fsSL https://raw.githubusercontent.com/IngTian/manifold/main/scripts/install.sh | bash' },
    visibility: 'public', ci: true,
  },
  {
    // Private, so there is nothing to clone: the card shows the prompt its README hands to Claude Code instead.
    slug: 'macboot', name: 'macboot', tier: 'workshop', kind: 'guide', year: '2026',
    idea: 'My Mac setup as one document an AI agent runs: it looks before it changes anything, skips what is already there, and hands me only the steps a person should do.',
    short: 'a Mac setup an agent runs, from one README',
    proof: ['one README', 'run by Claude Code', 'was 4,700 lines of bash'],
    install: { text: '> Set up this Mac from README.md. Look before you change anything.', prompt: true },
    visibility: 'private', ci: false,
  },
];

export const inProgress: InProgressItem[] = [
  { name: 'ai-mentor-core', repo: 'ai-mentor-core', idea: 'Study vaults that share one mentoring framework, so an improvement reaches every vault without hand-copying.' },
  { name: 'a new AI-learning repo', idea: 'Not started yet.' },
];

/** The repo's GitHub page, or null when it is private — a private repo has nothing a reader can open. */
export function repoUrl(p: Project): string | null {
  return p.visibility === 'public' ? `https://github.com/IngTian/${p.slug}` : null;
}

/** The homepage appendix's two rows, chosen by tier rather than array order: the first two selected projects
 *  that are not research-kind, since RL-BHRP already sits in the Publications column beside them. Two, because
 *  the slide's balance with the writing column depends on it. */
export function appendixProjects(ps: readonly Project[]): Project[] {
  return ps.filter((p) => p.tier === 'selected' && p.kind !== 'research').slice(0, 2);
}

export const links: { label: string; href: string; primary?: boolean }[] = [
  { label: 'Download CV', href: '/cv.pdf', primary: true },
  { label: 'Research', href: '/research' },
  // WRITING WAS MISSING HERE while data/nav.ts's PAGES carried it, so the corner nav offered /writing and the
  // footer did not — two page lists, already diverged. Caught by the dist smoke test, not by a human.
  // The order matches PAGES so the two read the same way round; tests/distSmoke.test.ts now asserts every
  // PAGES href reaches the rendered footer, which is what keeps them in step from here.
  { label: 'Writing', href: '/writing' },
  { label: 'Experience', href: '/experience' },
  { label: 'Projects', href: '/projects' },
  { label: 'Art', href: '/art' },
  { label: 'Email', href: 'mailto:zeying.tian@mail.mcgill.ca' },
  { label: 'GitHub', href: 'https://github.com/IngTian' },
  { label: 'LinkedIn', href: 'https://www.linkedin.com/in/ing-tian-1b2610149/' },
];
