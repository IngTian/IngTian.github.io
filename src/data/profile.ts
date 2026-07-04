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
}

export interface Award {
  year: string;
  title: string;
}

export interface ResearchInterest {
  label: string;
  gloss: string;
}

export interface ProjectLink {
  label: string;         // e.g. 'GitHub', 'Live', 'Writeup'
  href: string;
}

export interface Project {
  name: string;
  year: string;          // e.g. '2026' or '2025 —'
  tagline: string;       // one line, shown on the card + as the homepage teaser
  blurb: string;         // 2-3 sentences, shown on the /projects page
  stack: string[];       // tech tags, e.g. ['Go', 'MCP', 'SQLite']
  links: ProjectLink[];  // repo / live / writeup
  highlights?: string[]; // a few notable points, surfaced on the /projects page
  featured?: boolean;    // gets the full treatment on /projects
}

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
  { period: '2023 — 25', title: 'Quantitative Researcher · Independent', detail: 'Built an end-to-end quant trading system (Forex, commodities, indices via OANDA) with a collaborator — signal research in Python, execution engine in Golang, deployed on AWS (ECS, SageMaker). Authored the RL-BHRP portfolio-construction paper (arXiv:2508.11856).', kind: 'work' },
  { period: '2023 — 25', title: 'Senior Software Engineer · TikTok', detail: 'ML systems for ads (Exceptional review — top rating). Built a dual-tower vision pipeline with billion-scale vector search (Faiss) tracking $200M in creative spend, and a C++ / gRPC ad-signature service sustaining 50k QPS for real-time delivery.', kind: 'work' },
  { period: '2022 — 23', title: 'SWE Co-op · Ericsson AI Lab (GAIA)', detail: 'JAMScript NodeCache for node discovery in IoT; a C++ mobility simulator; one-shot ML models detecting malicious smart contracts from time-series data.', kind: 'work' },
  { period: '2021 — 23', title: 'Research Assistant · McGill', detail: 'Compiler research on JAMScript under Prof. Maheswaran — Ohm-based parser translating to C/JS, CFG grammar for ES6, side-effect & control-flow analysis.', kind: 'work' },
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

// Selected projects — shipped artifacts with links (distinct from Experience
// = roles, and Selected writing = papers). Shown as a teaser on the homepage
// and in full on /projects. Engineering output: kept a clear second to the
// research signal in the site's identity hierarchy.
export const projects: Project[] = [
  {
    name: 'witness',
    year: '2026',
    tagline: 'A Claude Code / OpenCode plugin that keeps a person-centric archive of how you think and grow — not what your code did.',
    blurb:
      'A coach-oriented (not clone-oriented) memory layer: it quietly mines each coding session for evidence-anchored observations about how you reason, get stuck, and change — then synthesizes them into evolving, bi-temporal "facets" that keep their own history, so the archive answers "how did I change," not just "who am I now." Collect-only and local-first: it captures and serves the archive over MCP but never injects anything into a session.',
    stack: ['Go', 'MCP', 'SQLite', 'Local embeddings', 'Claude Code · OpenCode'],
    links: [{ label: 'GitHub', href: 'https://github.com/IngTian/witness' }],
    highlights: [
      'Four-layer archive — verbatim raw turns → mined observations → bi-temporal facets (with change history) → a regenerable narrative profile.',
      'Single self-contained Go binary: no Python, no external services, no vector DB, no cloud key.',
      'Pure-Go local multilingual (EN + ZH) embeddings via GoMLX (CGO_ENABLED=0) — verified to match ONNX Runtime exactly.',
      'Pluggable "lenses" (a markdown EXTRACT/REVIEW prompt pair) let you track any domain — coding, math — through the same engine.',
    ],
    featured: true,
  },
];

export const links: { label: string; href: string; primary?: boolean }[] = [
  { label: 'Download CV', href: '/cv.pdf', primary: true },
  { label: 'Research', href: '/research' },
  { label: 'Projects', href: '/projects' },
  { label: 'Art', href: '/art' },
  { label: 'Email', href: 'mailto:zeying.tian@mail.mcgill.ca' },
  { label: 'GitHub', href: 'https://github.com/IngTian' },
  { label: 'LinkedIn', href: 'https://www.linkedin.com/in/ing-tian-1b2610149/' },
];
