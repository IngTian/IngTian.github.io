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
  /**
   * NOTHING READS THIS FOR PROJECTS TODAY, and the comment here used to claim it "gets the full treatment on
   * /projects" — false: pages/projects.astro passes variant="full" to every card unconditionally, so the flag
   * changes no pixel. (`grep -rn '\.featured' src` finds only publication and writing call sites.) What
   * actually decides prominence is ARRAY POSITION, because Work.astro slices the first two for the homepage.
   * It is kept, and kept marking the two lead entries, because it is the natural hook if /projects ever does
   * give its lead a different treatment — but until something renders from it, array order is the truth.
   */
  featured?: boolean;
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

// Selected projects — shipped artifacts with links (distinct from Experience
// = roles, and Selected writing = papers). Shown as a teaser on the homepage
// and in full on /projects. Engineering output: kept a clear second to the
// research signal in the site's identity hierarchy.
//
// ARRAY ORDER IS RENDERED, not just stored: sections/Work.astro slices `projects.slice(0, 2)` for the
// homepage appendix, so the first two entries are the only ones a reader meets without clicking through.
// `offchart` leads for that reason — it is the one project here whose content is method rather than
// tooling (point-in-time ranking, refusing look-ahead bias), which is the identity the site claims.
// Everything after it descends by how much it says to that reader.
//
// Three repos on the same GitHub profile are deliberately NOT here, so the next sweep does not "find" them
// and add them: `pdhg` is 43 real lines of correct Chambolle-Pock abandoned after two days, and its repo
// description still advertises non-convex support the tree does not contain — the site cannot link out to a
// claim it would not make itself. `market-witness` is a 774-line wrapper around `witness`, which is already
// here. The old COMP/ECSE coursework is archived.
export const projects: Project[] = [
  {
    name: 'offchart',
    year: '2026',
    tagline:
      "CFTC positioning data since 1986 in one SQLite file — every percentile ranked against the past, never against data that didn't exist yet.",
    blurb:
      'All seven CFTC Commitments of Traders datasets across its four report families, the legacy series reaching back to 1986-01-15, fetched keyless into one SQLite file and drawn by Grafana from two committed dashboards — the repo owns no charting code at all. The work is in the data’s bad habits. A market code is a stable key but not a stable series: on 2023-05-02 the Consolidated NASDAQ re-based from the $100 contract to the $20 E-mini and open interest jumped 49,531 → 255,954 with no position changing hands, so history is cut at unit breaks and at gaps over a quarter, and percentiles restart inside a segment. Prices are joined backward only, because “nearest” would put a close that did not exist yet beside a Tuesday position. It states what it is not, too: positioning is contemporaneous with price rather than predictive, and the forward-return study is named as the next piece of work rather than as something done.',
    stack: ['Python', 'pandas', 'SQLite', 'Grafana', 'GitHub Actions'],
    links: [{ label: 'GitHub', href: 'https://github.com/IngTian/offchart' }],
    highlights: [
      'Causality proven by truncation, with negative controls: a percentile computed on a prefix must be bit-identical to the full series sliced, and the suite asserts that a full-sample rank and a centred rolling mean both FAIL that check.',
      'Look-ahead is refused in all four places it enters — the statistic, the gate on it, the as-of join, and the query: the committed dashboard JSON is linted by the test suite, which fails on PERCENT_RANK, CUME_DIST, NTILE or a bare RANK() OVER.',
      'Three of its own claims re-measured and corrected: the open-interest residual is publisher rounding, cohort nets sum to zero only to within 4 contracts, CR4/CR8 divide by the side total — each shipping the test that disproves the old reading.',
      'A committed 5MB slice of the database backs 130 test functions that touch no network, and every market code in it is there to make one awkward case true: the 2023 re-basing, a market-week whose nets do not sum to zero, two markets sharing one name.',
    ],
    featured: true,
  },
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
  {
    name: 'trading-desk',
    year: '2026',
    tagline:
      'A personal trading record in the terminal, where a figure with a missing input prints as an em dash and its reason, not a number.',
    blurb:
      'Three things in three places: the tool is this repo, the record is a SQLite file outside it, and the thesis behind each position is written wherever the author already writes — the only string shared between the book and the writing is the bet’s slug, because every richer pointer the project tried eventually rotted. What the tool guarantees is integrity, never judgement. The four parts of the return — trading, income, offsets, currency effect — tie to the total to the cent rather than exactly, since float32 marks make equality the wrong test, and the tie is checked before any of them prints. The rule the whole design turns on is that NULL means not recorded, never zero and never parity: a figure with a missing input prints as an em dash with the reason beneath it, because a partial total is not a conservative estimate, it is a wrong number that reads as a right one.',
    stack: ['Python', 'SQLite', 'Textual', 'PyPI'],
    links: [{ label: 'GitHub', href: 'https://github.com/IngTian/trading-desk' }],
    highlights: [
      'Integrity lives in the database, not the client: 16 STRICT tables, 22 triggers and 102 CHECK clauses, so a closed trade holding shares, a net-short fill or an edited audit row is refused even from a raw sqlite3 prompt.',
      'Cost basis is average cost reduced pro rata on a sell, and returns nothing rather than a number when a fill is undated. The SQL view it replaced averaged buy fills only, so a trim followed by a higher buy turned a realised gain into a loss.',
      'Every currency is held native and only the current balance is translated; contributed capital uses the rate on its own deposit date. Translating past movements at today’s rate cancels the currency gain on the principal.',
      '164 test functions over the seams, plus the two CI jobs that are the real gates: one builds a wheel and creates a fresh book with it in a clean venv, and one greps the tree so no real amount from the author’s own book can be committed.',
    ],
  },
  {
    name: 'daylogs',
    year: '2026',
    tagline:
      'A terminal day log for weight, food and spending where typing the number by hand is the mechanism rather than the friction.',
    blurb:
      'One process, one SQLite file, three things: what you weigh, what you eat, what you spend. Entry is a one-line sigil grammar — `127 Grocery Item X !grocery ~receipt in wallet`, where `!` marks a category and `~` a note — and every write answers with its consequence (`12.40 lunch → restaurant 289.50 of 200.00`) rather than an acknowledgement. There is deliberately no bank integration and no health-app import: the typing is what makes you notice the number, so automating it away would remove the point. Where the arithmetic is easy to get sloppy it is stated honestly instead — calories net against Mifflin-St Jeor resting BMR scaled by an activity factor, and an unset profile yields no factor at all rather than a silent 1.2. BMI shows as a bare number with no band and no chart, because a BMI curve is the weight curve times a constant.',
    stack: ['Python', 'Textual', 'SQLite', 'Claude Code CLI', 'PyPI'],
    links: [{ label: 'GitHub', href: 'https://github.com/IngTian/daylogs' }],
    highlights: [
      'On PyPI across five releases, with exactly one declared runtime dependency — textual — behind ~9,000 lines of package source and ~1,365 test functions.',
      'The keymap is data: one table generates the bindings, the contextual footer and the `?` overlay, so the footer cannot name a key that is not bound — and a test parses every example in the README’s grammar table with the real parser.',
      'Pure logic with injected clocks: parsers take `now` and the `claude -p` runners are injected so no test spawns a subprocess. CI runs nightly as well as on push, because eight date-dependent tests once broke on the calendar alone with nothing pushed.',
      '`PRAGMA journal_mode=DELETE` on purpose — WAL’s sidecar files can sync independently under iCloud Drive and corrupt the database on the receiving device. Backup copies via `VACUUM INTO`, and export reads its table list out of the schema.',
    ],
  },
  {
    name: 'manifold',
    year: '2026',
    tagline: "This site's hero terrain, ported to a native macOS screen saver and live wallpaper — a mountain rendered as breathing points of light.",
    blurb:
      'A faithful Swift port of the homepage\'s math-generative terrain: a Gaussian-bump elevation field sampled on a 33×33 grid, projected through a fixed rotation and drawn as ~1000 elevation-colored dots that breathe, with glowing "walker" particles that periodically trace gradient-descent paths downhill and settle. The name is literal — the terrain is a 2-manifold — and nods to manifold optimization and to many-folded mountain ranges. Two builds share one renderer: a screen saver with a clock on the golden section, and a menu-bar live wallpaper with no clock — just the mountain breathing behind your icons, cross-fading between light and dark. Everything is sized as a fraction of the view, so it scales cleanly from 16:9 to 32:9 ultrawide.',
    stack: ['Swift', 'Core Graphics', 'AppKit', 'macOS'],
    links: [{ label: 'GitHub', href: 'https://github.com/IngTian/manifold' }],
    highlights: [
      'Two builds, one shared renderer: a screen saver (.saver, in System Settings) and a "Manifold Wallpaper.app" live desktop wallpaper (menu-bar app, no clock) — pinned at the desktop level since macOS exposes no public API for animated wallpapers.',
      'Builds locally with swiftc into universal (arm64 + x86_64) bundles — no Xcode, no Apple Developer account; local builds skip Gatekeeper quarantine, so install is one curl command.',
      'The wallpaper is battery-aware: 30fps normally, 15fps on battery / Low Power Mode, and fully pauses whenever the desktop is covered, the display sleeps, or the screen is locked.',
      'Colors are the exact light/dark values from the site, and switching themes cross-fades smoothly — a slow dawn/dusk transition — rather than snapping.',
    ],
  },
];

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
