export interface TimelineEntry {
  period: string;
  title: string;
  sub?: string;       // optional second line under the title (e.g. employer / arrangement)
  detail: string;
  kind: 'work' | 'education';
}

export interface Publication {
  authors: string;
  title: string;
  venue: string;
  year: string;
  href?: string;
}

export interface Award {
  year: string;
  title: string;
}

export const name = { first: 'Ing', last: 'Tian' } as const;

export const roles = 'Quant Researcher · Portfolio Optimization';
export const rolesSub = 'Software Engineer';
// promoted into the hero subline — incoming OR PhD (starts Fall 2027), kept honest
export const phd = 'Incoming PhD · University of Toronto';

// About-me, shown top-right in the hero (layout B). First-person, quant-first.
// `strong` marks the phrases set in medium weight (UofT + the research focus).
export const bio: { text: string; strong: string[] } = {
  text: 'Quant researcher and incoming Operations Research PhD at the University of Toronto, working on multi-period portfolio optimization. By day, a software engineer building recommendation systems. Also a guqin player and calligraphy practitioner.',
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
  { label: 'Art', href: '/art' },
  { label: 'Email', href: 'mailto:zeying.tian@mail.mcgill.ca' },
  { label: 'GitHub', href: 'https://github.com/IngTian' },
  { label: 'LinkedIn', href: 'https://www.linkedin.com/in/ing-tian-1b2610149/' },
];
