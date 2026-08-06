import { describe, it, expect } from 'vitest';
import {
  researchStops, projectStops, paperSectionId, paperAnchorId, projectSectionId,
  flattenStops, isNested, type Stop,
} from '../src/lib/pageStops';
import type { Publication, Project } from '../src/data/profile';
import { publications, researchInterests, projects } from '../src/data/profile';

// A minimal featured paper carrying all three section-bearing fields.
function paper(over: Partial<Publication> = {}): Publication {
  return {
    authors: 'A. Author',
    title: 'A Very Long Title That Would Never Fit In An Eleven Pixel Mono Rail',
    venue: 'arXiv preprint',
    year: '2026',
    featured: true,
    idea: 'the idea',
    mathKey: 'k',
    results: [{ value: '1%', label: 'l' }],
    ...over,
  };
}

/** Every target in the tree, in document order. */
function targets(stops: Stop[]): string[] {
  return flattenStops(stops).map((s) => s.target);
}

describe('researchStops — always names the paper', () => {
  it('NESTS even for a single featured paper', () => {
    // Deliberate: hoisting a lone paper's sections to the top level made the
    // rail identical to the buggy flat one until a 2nd paper existed, and made
    // the rail's shape change the day a paper was added.
    const stops = researchStops([paper({ shortTitle: 'One' })], ['i']);
    expect(isNested(stops)).toBe(true);
    expect(stops.map((s) => s.label)).toEqual(['Interests', 'Selected research']);
    const sel = stops[1];
    expect(sel.children?.map((c) => c.label)).toEqual(['One']);
    expect(sel.children?.[0].children?.map((c) => c.label)).toEqual(['The idea', 'Method', 'Results']);
  });

  it('NESTS once there are two featured papers', () => {
    const stops = researchStops([paper({ shortTitle: 'One' }), paper({ shortTitle: 'Two' })], ['i']);
    expect(isNested(stops)).toBe(true);
    const selected = stops.find((s) => s.label === 'Selected research');
    expect(selected?.children?.map((c) => c.label)).toEqual(['One', 'Two']);
  });

  it('gives every paper its OWN section ids — the duplicate-id bug', () => {
    const stops = researchStops([paper({ shortTitle: 'One' }), paper({ shortTitle: 'Two' })], ['i']);
    const all = targets(stops);
    expect(new Set(all).size).toBe(all.length);
    expect(all).toContain(paperSectionId(0, 'idea'));
    expect(all).toContain(paperSectionId(1, 'idea'));
  });

  it('omits Method for a paper with no mathKey — it owns no equations', () => {
    const one = researchStops([paper({ shortTitle: 'One', mathKey: undefined })], []);
    expect(one[0].children?.[0].children?.map((c) => c.label)).toEqual(['The idea', 'Results']);

    const nested = researchStops(
      [paper({ shortTitle: 'One' }), paper({ shortTitle: 'Two', mathKey: undefined })], [],
    );
    const two = nested[0].children?.find((c) => c.label === 'Two');
    expect(two?.children?.map((c) => c.label)).toEqual(['The idea', 'Results']);
  });

  it('falls back to the full title when shortTitle is absent', () => {
    const p = paper();
    const stops = researchStops([p, paper({ shortTitle: 'Two' })], []);
    expect(stops[0].children?.[0].label).toBe(p.title);
  });

  it('emits no stops at all for an empty page', () => {
    expect(researchStops([], [])).toEqual([]);
  });

  it('emits no empty parents for a paper carrying no sections at all', () => {
    // A featured paper with nothing to point at must not leave a childless
    // "Selected research" stop, nor a paper stop with an empty child list —
    // either would render a rail row that goes nowhere.
    const bare = researchStops([paper({ idea: undefined, mathKey: undefined, results: undefined })], []);
    expect(bare).toEqual([]);
  });

  it('adds Earlier only when non-featured publications exist', () => {
    const withOthers = researchStops([paper(), paper({ featured: false, title: 'old' })], []);
    expect(withOthers.at(-1)?.label).toBe('Earlier');
    expect(researchStops([paper()], []).some((s) => s.label === 'Earlier')).toBe(false);
  });

  it("a paper's own stop points at its MASTHEAD, distinct from its sections", () => {
    const stops = researchStops(
      [paper({ shortTitle: 'One' }), paper({ shortTitle: 'Two' })], [],
    );
    const kids = stops[0].children!;
    expect(kids[0].target).toBe(paperAnchorId(0));
    expect(kids[1].target).toBe(paperAnchorId(1));
    // and it must NOT collide with any of that paper's own section anchors
    expect(kids[0].children!.map((c) => c.target)).not.toContain(paperAnchorId(0));
  });
});

describe('projectStops', () => {
  it('is one flat stop per project, labelled by name', () => {
    const ps = [{ name: 'a' }, { name: 'b' }] as Project[];
    const stops = projectStops(ps);
    expect(isNested(stops)).toBe(false);
    expect(stops).toEqual([
      { label: 'a', target: projectSectionId(0) },
      { label: 'b', target: projectSectionId(1) },
    ]);
  });

  it('has unique targets', () => {
    const stops = projectStops([{ name: 'x' }, { name: 'x' }] as Project[]);
    expect(new Set(targets(stops)).size).toBe(2);
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

describe('the REAL site data', () => {
  it('nests today, naming the real paper, with unique targets', () => {
    const stops = researchStops(publications, researchInterests);
    expect(isNested(stops)).toBe(true);
    // the rail must name the paper, not show a bare "Method"
    expect(flattenStops(stops).map((s) => s.label)).toContain('RL-BHRP');
    const all = targets(stops);
    expect(new Set(all).size).toBe(all.length);
  });

  it('would nest — with unique ids — if a second paper were featured', () => {
    const twice = [...publications, { ...publications.find((p) => p.featured)!, shortTitle: 'Next' }];
    const stops = researchStops(twice, researchInterests);
    expect(isNested(stops)).toBe(true);
    const all = targets(stops);
    expect(new Set(all).size).toBe(all.length);
  });

  it('gives /projects a stop per project', () => {
    expect(projectStops(projects)).toHaveLength(projects.length);
  });
});
