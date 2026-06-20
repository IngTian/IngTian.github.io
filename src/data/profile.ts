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
  abstract?: string;      // verbatim abstract
  featured?: boolean;     // gets the full treatment on /research
}

export interface Award {
  year: string;
  title: string;
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

export const timeline: TimelineEntry[] = [
  { period: '2026 —', title: 'Software Engineer · Electronic Arts', sub: 'Contracted via Hatch Innovations Canada', detail: 'Recommendation systems for EA’s AI-driven social app (Project Air) and mobile game (Project Nava) — dual-tower retrieval and ranking, end-to-end indexing & serving in Golang, training pipelines in Python over Elasticsearch / vector search, decoupled with Kafka & NATS.', kind: 'work' },
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

export const links: { label: string; href: string; primary?: boolean }[] = [
  { label: 'Download CV', href: '/cv.pdf', primary: true },
  { label: 'Research', href: '/research' },
  { label: 'Art', href: '/art' },
  { label: 'Email', href: 'mailto:zeying.tian@mail.mcgill.ca' },
  { label: 'GitHub', href: 'https://github.com/IngTian' },
  { label: 'LinkedIn', href: 'https://www.linkedin.com/in/ing-tian-1b2610149/' },
];
