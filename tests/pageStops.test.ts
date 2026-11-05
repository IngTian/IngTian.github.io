import { describe, it, expect } from 'vitest';
import {
  projectStops, projectSectionId, experienceStops, railLabel, homeStops, flattenStops, fragmentId, paperPageOwns, paperSections,
  paperStops, researchIndexStops, PAPER_END, type Stop,
} from '../src/lib/pageStops';
import { refId } from '../src/lib/paperMarkdown';
import type { TimelineEntry } from '../src/data/profile';
import { projects, timeline } from '../src/data/profile';

/** Every target in the tree, in document order. */
function targets(stops: Stop[]): string[] {
  return flattenStops(stops).map((s) => s.target);
}

describe('projectStops', () => {
  it('is Index / Selected (one child per selected project, by slug) / The workshop / In progress', () => {
    expect(projectStops(projects)).toEqual([
      { label: 'Index', target: 'p-index' },
      {
        label: 'Selected', target: 'p-selected',
        children: ['rl-bhrp', 'offchart', 'trading-desk', 'witness'].map((slug) => ({
          label: slug, target: projectSectionId(slug),
        })),
      },
      { label: 'The workshop', target: 'p-workshop' },
      { label: 'In progress', target: 'p-in-progress' },
    ]);
  });

  it('spells a project section id from its slug', () => {
    expect(projectSectionId('witness')).toBe('p-witness');
  });
});

describe('experienceStops', () => {
  const entry = (over: Partial<TimelineEntry> = {}): TimelineEntry => ({
    period: '2020', title: 'Role · Somewhere', detail: 'did things', kind: 'work', ...over,
  });

  it('puts Education before Roles', () => {
    // The site's identity hierarchy is load-bearing: the incoming PhD must not sit below
    // nine engineering jobs. Education leading is a requirement, not a preference.
    const stops = experienceStops([
      entry({ title: 'Job · TikTok' }),
      entry({ title: 'PhD · Toronto', kind: 'education' }),
    ]);
    expect(stops.map((s) => s.label)).toEqual(['Education', 'Roles']);
  });

  it('nests each entry under its group', () => {
    const stops = experienceStops([
      entry({ title: 'A · Alpha' }),
      entry({ title: 'B · Beta', kind: 'education' }),
      entry({ title: 'C · Gamma' }),
    ]);
    const edu = stops.find((s) => s.label === 'Education')!;
    const work = stops.find((s) => s.label === 'Roles')!;
    expect(edu.children?.map((c) => c.label)).toEqual(['Beta']);
    expect(work.children?.map((c) => c.label)).toEqual(['Alpha', 'Gamma']);
  });

  it('keeps each stop pointing at its ORIGINAL index, not its position in the group', () => {
    // The page renders ids from the unfiltered array, so grouping must not renumber. This is
    // the /research bug in a new costume: a rail stop pointing at an id nobody emitted.
    const stops = experienceStops([
      entry({ title: 'A · Alpha' }),                        // index 0 -> x-0
      entry({ title: 'B · Beta', kind: 'education' }),      // index 1 -> x-1
      entry({ title: 'C · Gamma' }),                        // index 2 -> x-2
    ]);
    const edu = stops.find((s) => s.label === 'Education')!;
    const work = stops.find((s) => s.label === 'Roles')!;
    expect(edu.children?.map((c) => c.target)).toEqual(['x-1']);
    expect(work.children?.map((c) => c.target)).toEqual(['x-0', 'x-2']);
  });

  it('omits a group that has no entries', () => {
    const stops = experienceStops([entry()]);
    expect(stops.map((s) => s.label)).toEqual(['Roles']);
  });

  it('returns nothing for an empty timeline', () => {
    expect(experienceStops([])).toEqual([]);
  });

  it('emits a unique target for every stop', () => {
    const all = targets(experienceStops(timeline));
    expect(new Set(all).size).toBe(all.length);
  });
});

describe('railLabel', () => {
  it('keeps the institution, not the job title', () => {
    // A thin margin cannot hold "Senior Software Engineer · TikTok"; the institution is the
    // part a reader scans for.
    expect(railLabel({ period: '', title: 'Senior Software Engineer · TikTok', detail: '', kind: 'work' }))
      .toBe('TikTok');
  });

  it('falls back to the whole title when there is no separator', () => {
    expect(railLabel({ period: '', title: 'Independent', detail: '', kind: 'work' }))
      .toBe('Independent');
  });

  it('truncates anything too long for the rail', () => {
    const label = railLabel({
      period: '', kind: 'education', detail: '',
      title: 'Incoming PhD, Operations Research · University of Toronto and Also Somewhere Else',
    });
    expect(label.length).toBeLessThanOrEqual(24);
    expect(label.endsWith('…')).toBe(true);
  });

  it('never returns an empty label for the real timeline', () => {
    for (const t of timeline) {
      expect(railLabel(t).trim().length, t.title).toBeGreaterThan(0);
    }
  });
});

describe('flattenStops', () => {
  it('walks parents before children, depth-first (document order)', () => {
    const tree: Stop[] = [
      { label: 'a', target: 'a', children: [{ label: 'b', target: 'b', children: [{ label: 'c', target: 'c' }] }] },
      { label: 'd', target: 'd' },
    ];
    expect(flattenStops(tree).map((s) => s.target)).toEqual(['a', 'b', 'c', 'd']);
  });
});

describe('paperStops', () => {
  // A paper page's sections are the file's, as the plugin reports them, and then the three the page writes itself.
  const report = [
    { id: 'brief', title: 'In brief', rail: 'In brief' },
    { id: 'question', n: '1', title: 'The question', rail: 'Question' },
    { id: 'limits', n: '4', title: 'What it implies, and where it stops', rail: 'Limits' },
  ];

  it("is the file's sections, in the order reported, then Full paper, References and Cite", () => {
    expect(paperStops(report)).toEqual([
      { label: 'In brief', target: 'brief' },
      { label: 'Question', target: 'question' },
      { label: 'Limits', target: 'limits' },
      { label: 'Full paper', target: 'read' },
      { label: 'References', target: 'references' },
      { label: 'Cite', target: 'cite' },
    ]);
  });

  // The page renders its own three sections from PAPER_END, so their ids and titles are spelled once.
  it("spells the page's own sections once, each a title and a bookmark", () => {
    expect(PAPER_END).toEqual([
      { id: 'read', title: 'Read the full paper', rail: 'Full paper' },
      { id: 'references', title: 'References', rail: 'References' },
      { id: 'cite', title: 'Cite', rail: 'Cite' },
    ]);
    expect(paperStops([]).map((s) => s.target)).toEqual(PAPER_END.map((s) => s.id));
  });

  it('is flat: a paper section is one stop, however much it holds', () => {
    expect(paperStops(report).every((s) => !s.children)).toBe(true);
  });

  // The phone's Contents lists paperSections and the rail paperStops: one list, so the two cannot drift.
  it('is paperSections, each a stop', () => {
    expect(paperSections(report)).toEqual([...report, ...PAPER_END]);
    expect(paperStops(report)).toEqual(paperSections(report).map((s) => ({ label: s.rail, target: s.id })));
  });
});

// The page renders its two sections' ids from this tree, so they are spelled here and nowhere else.
describe('researchIndexStops', () => {
  it('is Papers then Interests, flat', () => {
    expect(researchIndexStops()).toEqual([
      { label: 'Papers', target: 'r-papers' },
      { label: 'Interests', target: 'r-interests' },
    ]);
  });
});

describe('paperPageOwns', () => {
  it('owns the ids a paper page writes around its file: its sections, BibTeX, the nav list, every reference', () => {
    for (const id of [...PAPER_END.map((s) => s.id), 'bibtex', 'cnav-list', refId('markowitz1952')]) {
      expect(paperPageOwns(id), id).toBe(true);
    }
  });

  it("leaves the file's own ids to the file", () => {
    for (const id of ['brief', 'brief-title', 'results', 'eq-4', 'figure-2', 'fm-wide', 'cited', 'references-title']) {
      expect(paperPageOwns(id), id).toBe(false);
    }
  });
});

// Every script that reads a URL fragment (the rail's links, the reveals' landing screen) reads it through this, so a
// fragment a browser hands over undecodable cannot throw inside a page's setup.
describe('fragmentId', () => {
  it('is the id a fragment names, decoded', () => {
    expect(fragmentId('#results')).toBe('results');
    expect(fragmentId('#caf%C3%A9')).toBe('café');
  });

  it('is empty for no fragment', () => {
    expect(fragmentId('')).toBe('');
    expect(fragmentId('#')).toBe('');
  });

  it('is empty for a fragment that cannot be decoded, which names nothing', () => {
    expect(fragmentId('#%')).toBe('');
    expect(fragmentId('#100%')).toBe('');
  });
});

describe('the REAL site data', () => {
  it('gives /projects a rail stop per selected project, with unique targets', () => {
    const stops = projectStops(projects);
    const selected = stops.find((s) => s.target === 'p-selected')!;
    expect(selected.children!.map((c) => c.label))
      .toEqual(projects.filter((p) => p.tier === 'selected').map((p) => p.slug));
    const all = targets(stops);
    expect(new Set(all).size).toBe(all.length);
  });
});

// ── THE HOMEPAGE RAIL ─────────────────────────────────────────────────────────────────────────────────
// The rail is the only wayfinding on a page with no headings above the fold, and a stop pointing at a
// missing id renders as a link that goes nowhere — the exact bug that removed the old 'Work' and 'Ask'
// stops. These tests pin the SHAPE (nested, so the top level reads as structure) and the CONTRACT (every
// target exists in index.astro's section list).
describe('homeStops', () => {
  const stops = homeStops();
  const flat = flattenStops(stops);

  // Section ids actually rendered by src/pages/index.astro, in document order.
  // 'work' and 'signature' became ONE section, #appendix: they were separate deck stops, which left 161px of
  // empty panel below the work and made the final stop a 193px footer strip. The footer is now nested inside the
  // appendix, so it is not a top-level section and the deck does not stop on it. This list is the guard that
  // caught the rename — it is the only thing tying the rail's targets to the page's real ids.
  const RENDERED = ['heights', 'interlude', 'choice', 'rules', 'solve', 'story', 'appendix'];

  it('points every stop at a section the homepage renders', () => {
    for (const s of flat) {
      expect(RENDERED, `${s.label} -> #${s.target}`).toContain(s.target);
    }
  });

  it('has no duplicate targets or labels', () => {
    const targets = flat.map((s) => s.target);
    expect(new Set(targets).size).toBe(targets.length);
    const labels = flat.map((s) => s.label);
    expect(new Set(labels).size).toBe(labels.length);
  });

  // The owner asked for the field slide to have a stop at all, and for the explainer slides to sit under it
  // so the top level reads as structure rather than as five unrelated words.
  it('nests the three explainer slides under the field that names them', () => {
    const field = stops.find((s) => s.target === 'interlude');
    expect(field, 'the field slide must have its own stop').toBeDefined();
    expect(field!.children?.map((c) => c.target)).toEqual(['choice', 'rules', 'solve']);
  });

  it('keeps the top level short — structure, not a list of every slide', () => {
    expect(stops.length).toBeLessThanOrEqual(5);
  });

  it('no longer calls the problem slide "Choice"', () => {
    const problem = flat.find((s) => s.target === 'choice');
    expect(problem!.label.toLowerCase()).not.toBe('choice');
  });

  // TREE ORDER MUST MATCH DOCUMENT ORDER. The scrollspy walks stops as rendered and marks the last one whose
  // top crossed the reference line; a rail whose order disagrees with the page lights stops out of sequence.
  it('lists stops in the order the page renders them', () => {
    const positions = flat.map((s) => RENDERED.indexOf(s.target));
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });

  // A thin left margin is the constraint that shortened these labels: at "The problem" / "Constraints" the
  // indented tier measured past the slide's text edge.
  it('keeps rail labels short enough for an 11px mono margin', () => {
    for (const s of stops) expect(s.label.length, s.label).toBeLessThanOrEqual(11);
    for (const c of stops.flatMap((s) => s.children ?? [])) {
      expect(c.label.length, c.label).toBeLessThanOrEqual(8);
    }
  });

  it('zones every top-level stop, since the label colour follows the sky behind it', () => {
    for (const s of stops) expect(['light', 'dark']).toContain(s.zone);
  });
});
