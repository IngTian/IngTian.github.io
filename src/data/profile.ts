import { paperValue } from './papers/rl-bhrp';

/** One role. Its organisation's panel on /experience lists it; the homepage's descent graph matches its period. */
export interface TimelineEntry {
  org: string;        // its organisation's key in `organisations`
  role: string;       // the role alone; the organisation is the panel's
  period: string;
  detail: string;
  kind: 'work' | 'education';   // a degree is listed as a Degree, a job as a Position
}

/** A row of an organisation's facts on /experience. */
export interface Fact { label: string; value: string; href?: string }
/** An organisation, one panel on /experience. Its roles are the timeline's entries that name it. */
export interface Organisation {
  key: string;        // the panel's id (x-<key>) and its mark's key in data/experienceMarks.ts
  name: string;
  rail: string;       // the rail's bookmark
  tagline: string;
  facts: Fact[];      // after the roles, which the page lists first
}

export interface Author { name: string; affiliation?: string }
export type PublicationStatus = 'preprint' | 'conference' | 'journal';
/** What a status is called wherever one is printed: as written on a /research card, in lower case in the homepage
 *  line and in a paper page's head (which adds ", not peer reviewed" to a preprint). */
export const STATUS_LABEL: Record<PublicationStatus, string> = { preprint: 'Preprint', conference: 'Conference paper', journal: 'Journal article' };

export interface Publication {
  slug: string;              // URL segment and stable id
  title: string;             // exactly as the paper prints it
  authors: Author[];
  status: PublicationStatus;
  venue: string;             // e.g. 'arXiv', 'SPIE (CNSSE)': never the year, which every surface prints after it, nor a volume, which the DOI carries
  year: string;
  submitted?: string;        // YYYY-MM-DD
  version?: string;          // e.g. 'v1'
  versions?: number;         // how many versions arXiv lists (its abstract page's submission history)
  arxivId?: string; doi?: string; subject?: string;
  href: string;              // where a card links when there is no explainer page
  pdfHref?: string;
  reproduction?: string;     // the owner's own reproduction's repo, where one exists — never the paper's code
  finding: string;           // ONE plain sentence, honest and scoped — the card line
  tags: string[];
  abstract?: string;         // verbatim
  bibtex?: string;
}

/** A field is given only when it is on record, and printed only then. */
export interface Award {
  year?: string;
  title: string;
  gloss?: string;     // what an abbreviation stands for
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
  slug: string;            // the GitHub repo name; also the section id
  name: string;
  tier: ProjectTier;
  kind: ProjectKind;
  idea: string;            // the one-line idea — rows, cards, pop-up, homepage appendix
  short: string;           // the ls listing's description (≤ 44 chars), set in mono — no → or ↗, which its latin subset lacks
  proof: string[];         // chips; proof[0] is the highlighted one
  // The README's line verbatim, never abbreviated (WorkshopCards wraps it). `prompt`: words for an agent, no '$ ',
  // may be an excerpt ending in '…'.
  install?: { text: string; prompt?: boolean };
  visibility: 'public' | 'private';
  registry?: 'pypi' | 'npm';
  ci: boolean;
}

export interface InProgressItem { name: string; idea: string; repo?: string }   // repo: set only once the repo exists

export const name = { first: 'Ing', last: 'Tian' } as const;
/** The name his papers carry, as their author lists spell it. */
export const authorName = 'Zeying Tian';

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

// Research interests — a quiet list after the papers on /research, each its label and a one-line gloss.
// Grounded in the RL-BHRP paper + the incoming OR PhD focus; kept to areas actually worked in.
export const researchInterests: ResearchInterest[] = [
  { label: 'Multi-period portfolio optimization', gloss: 'Allocation across horizons, rebalancing as conditions change — not single-shot mean–variance.' },
  { label: 'Risk parity & hierarchical methods', gloss: 'Distributing risk across structure — sectors, then assets — rather than chasing returns.' },
  { label: 'Reinforcement learning for allocation', gloss: 'Policies that learn to allocate under uncertainty, instead of assuming a fixed model.' },
  { label: 'Operations research & convex optimization', gloss: 'The constraints, duality, and structure underneath it all — the OR core of the PhD.' },
];

export const timeline: TimelineEntry[] = [
  { org: 'uoft', role: 'Incoming PhD, Operations Research', period: 'Fall 2027 —', detail: 'Doctoral research in operations research — multi-period portfolio optimization, and the convex-optimization and duality structure beneath it.', kind: 'education' },
  { org: 'ea', role: 'Software Engineer', period: '2026 —', detail: 'Recommendation systems for EA’s AI-driven products — dual-tower retrieval and ranking, end-to-end indexing & serving in Golang, training pipelines in Python over Elasticsearch / vector search, decoupled with Kafka & NATS.', kind: 'work' },
  { org: 'independent', role: 'Freelance Quantitative Researcher', period: '2023 —', detail: 'Built an end-to-end quant trading system (Forex, commodities, indices via OANDA) with a collaborator — signal research in Python, execution engine in Golang, deployed on AWS (ECS, SageMaker). Authored the RL-BHRP portfolio-construction paper.', kind: 'work' },
  { org: 'tiktok', role: 'Senior Software Engineer', period: '2023 — 25', detail: 'ML systems for ads (Exceptional review — top rating). Built a dual-tower vision pipeline with billion-scale vector search (Faiss) tracking $200M in creative spend, and a C++ / gRPC ad-signature service sustaining 50k QPS for real-time delivery.', kind: 'work' },
  { org: 'ericsson', role: 'SWE Co-op', period: '2022 — 23', detail: 'JAMScript NodeCache for node discovery in IoT; a C++ mobility simulator; one-shot ML models detecting malicious smart contracts from time-series data.', kind: 'work' },
  { org: 'amazon', role: 'SDE Intern', period: '2022', detail: 'A fulfillment-data archiving and visual-analysis service — SNS transformed via Lambda, landed in S3 through Firehose, queried with Athena for QuickSight dashboards.', kind: 'work' },
  { org: 'mcgill', role: 'Research Assistant', period: '2021 — 23', detail: 'Compiler research on JAMScript under Prof. Maheswaran — Ohm-based parser translating to C/JS, CFG grammar for ES6, side-effect & control-flow analysis.', kind: 'work' },
  { org: 'tiktok', role: 'SDE Intern', period: '2021', detail: "Modeled the landing page's structure in TypeScript ahead of a later refactor, and helped ship the interim download page — $1M/day in revenue.", kind: 'work' },
  { org: 'mcgill', role: 'B.Eng, Computer Engineering', period: '2019 — 23', detail: "CGPA 3.99 · Dean's Honour List · Full Scholarship.", kind: 'education' },
];

// Newest first. Each record is what every surface listing a paper reads: the /research cards, the homepage
// appendix and a paper's own page.
export const publications: Publication[] = [
  {
    slug: 'rl-bhrp',
    title: 'Optimal Portfolio Construction — A Reinforcement Learning Embedded Bayesian Hierarchical Risk Parity (RL-BHRP) Approach',
    authors: [
      { name: 'Shaofeng Kang', affiliation: 'University of Toronto' },
      { name: 'Zeying Tian', affiliation: 'McGill University' },
    ],
    status: 'preprint',
    venue: 'arXiv',
    year: '2025',
    submitted: '2025-08-16',
    version: 'v1',
    versions: 1,               // arXiv's submission history lists [v1] alone, read 3 November 2026
    arxivId: '2508.11856',
    doi: '10.48550/arXiv.2508.11856',
    subject: 'q-fin.PM · Portfolio Management',
    // Version 1, the version every figure quoted from it describes.
    href: 'https://arxiv.org/abs/2508.11856v1',
    pdfHref: 'https://arxiv.org/pdf/2508.11856v1',
    reproduction: 'https://github.com/IngTian/rl-bhrp',
    // The paper's own figures (data/papers/rl-bhrp.ts VALUES).
    finding: `On one ${paperValue('startYear')}–${paperValue('endYear')} test of ${paperValue('universe')} large US stocks, a policy that learns sector and stock weights under a risk-parity penalty turned $1 into ${paperValue('usd.rl')}, against ${paperValue('usd.bhrp')} for plain two-level risk parity — with somewhat more risk, and no test of whether the gap is more than chance.`,
    tags: ['reinforcement learning', 'Bayesian hierarchical risk parity', 'portfolio optimization', 'asset allocation'],
    abstract:
      'We propose a two-level, learning-based portfolio method (RL-BHRP) that spreads risk across sectors and stocks, and adjusts exposures as market conditions change. Using U.S. Equities from 2012 to mid-2025, we design the model using 2012 to 2019 data, and evaluate it out-of-sample from 2020 to 2025 against a sector index built from exchange-traded funds and a static risk-balanced portfolio. Over the test window, the adaptive portfolio compounds wealth by approximately 120 percent, compared with 101 percent for the static comparator and 91 percent for the sector benchmark. The average annual growth is roughly 15 percent, compared to 13 percent and 12 percent, respectively. Gains are achieved without significant deviations from the benchmark and with peak-to-trough losses comparable to those of the alternatives, indicating that the method adds value while remaining diversified and investable. Weight charts show gradual shifts rather than abrupt swings, reflecting disciplined rebalancing and the cost-aware design. Overall, the results support risk-balanced, adaptive allocation as a practical approach to achieving stronger and more stable long-term performance.',
    bibtex: `@misc{kang2025rlbhrp,
  title = {Optimal Portfolio Construction -- A Reinforcement Learning Embedded Bayesian Hierarchical Risk Parity (RL-BHRP) Approach},
  author = {Kang, Shaofeng and Tian, Zeying},
  year = {2025},
  eprint = {2508.11856},
  archivePrefix = {arXiv},
  primaryClass = {q-fin.PM},
  url = {https://arxiv.org/abs/2508.11856}
}`,
  },
  {
    slug: 'self-attention-rnn-text',
    title: 'Self-Attention on RNN-based Text Classification',
    authors: [{ name: 'Dailun Li' }, { name: 'Zeying Tian' }, { name: 'Yining Duan' }],
    status: 'conference',
    venue: 'SPIE (CNSSE)',     // Proc. SPIE vol. 12290, which the DOI carries
    year: '2022',
    doi: '10.1117/12.2641031',
    href: 'https://doi.org/10.1117/12.2641031',
    // Scoped to its abstract (OpenAlex's record for the DOI; Crossref carries none).
    finding: 'Testing the claim that self-attention always helps, it found that the gain grows with the size of the dataset, that attention can hurt on small datasets, and that the same dataset can show opposite effects in different models.',
    tags: ['self-attention', 'recurrent neural networks', 'text classification'],
  },
];

// The organisations, in /experience's order: the incoming PhD, then research, then engineering newest first, then the
// B.Eng (the identity hierarchy, CLAUDE.md Identity & voice). A fact is given only when it is on record, so no
// location is guessed.
const rlBhrp = publications.find((p) => p.slug === 'rl-bhrp');
if (!rlBhrp?.arxivId) throw new Error('profile: the rl-bhrp record has no arXiv id');
export const organisations: Organisation[] = [
  { key: 'uoft', name: 'University of Toronto', rail: 'U of T', tagline: 'Operations research',
    facts: [
      { label: 'Advisor', value: 'Prof. Roy H. Kwon' },
      { label: 'Field', value: 'Portfolio optimization' },
      { label: 'Location', value: 'Toronto' },
      { label: 'Website', value: 'utoronto.ca', href: 'https://www.utoronto.ca' },
    ] },
  { key: 'independent', name: 'Independent', rail: 'Independent', tagline: 'Systematic trading research',
    facts: [
      { label: 'Markets', value: 'Forex, commodities, indices' },
      { label: 'Paper', value: `arXiv:${rlBhrp.arxivId}`, href: `/research/${rlBhrp.slug}` },
    ] },
  { key: 'ea', name: 'Electronic Arts', rail: 'EA', tagline: 'Interactive entertainment',
    facts: [
      { label: 'Contract', value: 'via Hatch Innovations Canada' },
      { label: 'Area', value: 'Recommendation systems' },
      { label: 'Website', value: 'ea.com', href: 'https://www.ea.com' },
    ] },
  { key: 'tiktok', name: 'TikTok', rail: 'TikTok', tagline: 'Short-form video',
    facts: [
      { label: 'Area', value: 'ML systems for ads' },
      { label: 'Location', value: 'Shanghai, China (2021)' },
      { label: 'Website', value: 'tiktok.com', href: 'https://www.tiktok.com' },
    ] },
  { key: 'ericsson', name: 'Ericsson', rail: 'Ericsson', tagline: 'Telecommunications',
    facts: [
      { label: 'Team', value: 'AI Lab (GAIA)' },
      { label: 'Website', value: 'ericsson.com', href: 'https://www.ericsson.com' },
    ] },
  { key: 'amazon', name: 'Amazon', rail: 'Amazon', tagline: 'E-commerce and cloud',
    facts: [
      { label: 'Area', value: 'Fulfillment data' },
      { label: 'Website', value: 'amazon.com', href: 'https://www.amazon.com' },
    ] },
  { key: 'mcgill', name: 'McGill University', rail: 'McGill', tagline: 'Computer engineering',
    facts: [
      { label: 'Location', value: 'Montreal' },
      { label: 'Website', value: 'mcgill.ca', href: 'https://www.mcgill.ca' },
    ] },
];

export const awards: Award[] = [
  { year: '2021', title: 'IEEExtreme — Top 4 teams in Canada' },
  { year: "'21–'22", title: 'Hatch Scholarships ($10k) · McGill' },
  { year: '2020', title: 'Rio Tinto–Richards Evans Exchange Award · McGill' },
  { title: 'COMC', gloss: 'Canadian Open Mathematics Challenge' },
  { title: 'CCC', gloss: 'Canadian Computing Competition' },
  { title: 'AIME', gloss: 'American Invitational Mathematics Examination' },
];

// witness's release count: hand-maintained, not fetched at build time (that needs the network); counted 2026-11-02.
export const WITNESS_RELEASES = 29;

// Every notable project, in VALUE order: the selected (quant) tier first, then the workshop of personal tools.
// Records, not prose, because they render in many shapes — the ls listing, the gallery, a row or a card, the
// pop-up, the homepage appendix, and the summary line's counts, which are computed from these fields rather
// than typed. Held back: rebal ("not for release yet") and argmin (one script, no tests or output).
export const projects: Project[] = [
  {
    slug: 'rl-bhrp', name: 'rl-bhrp', tier: 'selected', kind: 'research',
    // "From my arXiv paper", not "my published": the paper is a preprint — its status in `publications` above, and
    // how /research shows it.
    idea: "The portfolio allocator from my arXiv paper, rebuilt from the paper alone — with a plain report of which numbers reproduce and which don't.",
    short: 'my paper, rebuilt from the paper alone',
    proof: ["tests tied to the paper's theorems", 'results committed'],
    visibility: 'public', ci: false,
  },
  {
    slug: 'offchart', name: 'offchart', tier: 'selected', kind: 'data',
    idea: "Public positioning and survey data — CFTC Commitments of Traders, UMich expectations — in one database that can't see the future.",
    short: 'CFTC + survey data, look-ahead-free',
    proof: ['daily CI against the live CFTC feed', 'CFTC data back to 1986'],
    visibility: 'public', ci: true,
  },
  {
    slug: 'trading-desk', name: 'trading-desk', tier: 'selected', kind: 'tool',
    idea: 'A trading book in the terminal that gets P&L right across currencies and refuses to record a state that contradicts itself.',
    short: "a trading book that can't contradict itself",
    // ~300, not the spec's ~270: at trading-desk 1e60108 pytest collects 323, of which test_book.py's 24 skip
    // without a book — so CI runs 299. The README states no count.
    proof: ['on PyPI', '~300 tests'],
    visibility: 'public', registry: 'pypi', ci: true,
  },
  {
    slug: 'witness', name: 'witness', tier: 'selected', kind: 'engine',
    idea: 'Turns any text stream — market news, research, coding sessions — into a dated history of what changed, and why.',
    short: 'text stream to dated history of change',
    // The chip is computed from the count, so the row, the summary line and the cow's joke all read one number.
    proof: [`${WITNESS_RELEASES} releases`, 'cross-platform binaries', 'npm'],
    visibility: 'public', registry: 'npm', ci: true,
  },
  {
    slug: 'daylogs', name: 'daylogs', tier: 'workshop', kind: 'tool',
    idea: 'Weight, food and spending, typed by hand in one line each — plus one short daily read.',
    short: 'weight, food, spending — by hand',
    // No release count, unlike witness's: the spec's "5 releases" was 9 on PyPI by 2026-11-03 (0.6.0-0.6.3 landed in
    // nine hours), and a count that moves that fast is false between edits whether or not it carries a date.
    proof: ['on PyPI'],
    install: { text: 'uv tool install daylogs' },
    visibility: 'public', registry: 'pypi', ci: true,
  },
  {
    slug: 'manifold', name: 'manifold', tier: 'workshop', kind: 'art',
    idea: 'A macOS screensaver: a mountain of light where gradient-descent walkers roll down real optimization surfaces.',
    short: 'a macOS screensaver of real descent',
    proof: ['gradients checked against finite differences in CI'],
    install: { text: 'curl -fsSL https://raw.githubusercontent.com/IngTian/manifold/main/scripts/install.sh | bash' },
    visibility: 'public', ci: true,
  },
  {
    // Private, so there is nothing to clone: the card shows the prompt its README hands to Claude Code instead.
    slug: 'macboot', name: 'macboot', tier: 'workshop', kind: 'guide',
    idea: 'My Mac setup as one document an AI agent runs: it looks before it changes anything, skips what is already there, and hands me only the steps a person should do.',
    short: 'a Mac setup an agent runs, from one README',
    proof: ['one README', 'run by Claude Code', 'was ~4,700 lines of bash'],
    // An excerpt (macboot's README at a690e47, lines 10-12): verbatim to the end of its first clause, colon kept; the
    // prompt goes on to what to skip, never to upgrade, and the three lists to finish with. The \u00a0 holds the
    // ellipsis to the colon, so a narrow card cannot wrap it onto a line of its own.
    install: { text: '> Set up this Mac from README.md. Look before you change anything:\u00a0…', prompt: true },
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

/** The four ways to reach the owner, each as the corner nav links it (`external` opens a new tab); BaseLayout's
 *  JSON-LD `sameAs` names the two profiles. The pages are data/nav.ts's PAGES, the one page list. */
export const contact = {
  github: { label: 'GitHub', href: 'https://github.com/IngTian', external: true },
  email: { label: 'Email', href: 'mailto:zeying.tian@mail.mcgill.ca', external: false },
  cv: { label: 'CV', href: '/cv.pdf', external: true },
  linkedin: { label: 'LinkedIn', href: 'https://www.linkedin.com/in/zeying-tian-1b2610149/', external: true },
} as const satisfies Record<string, { label: string; href: string; external: boolean }>;
