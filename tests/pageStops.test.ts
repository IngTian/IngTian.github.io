import { describe, it, expect } from 'vitest';
import {
  researchStops, projectStops, paperSectionId, paperAnchorId, projectSectionId,
  experienceStops, railLabel, homeStops,
  flattenStops, type Stop,
} from '../src/lib/pageStops';
import { mathFor } from '../src/lib/paperMath';
import type { Publication, Project, TimelineEntry } from '../src/data/profile';
import { publications, researchInterests, projects, timeline } from '../src/data/profile';

// A minimal featured paper carrying all three section-bearing fields.
function paper(over: Partial<Publication> = {}): Publication {
  return {
    authors: 'A. Author',
    title: 'A Very Long Title That Would Never Fit In An Eleven Pixel Mono Rail',
    venue: 'arXiv preprint',
    year: '2026',
    featured: true,
    idea: 'the idea',
    mathKey: 'rlbhrp',
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
    expect(stops.some((s) => !!s.children?.length)).toBe(true);
    expect(stops.map((s) => s.label)).toEqual(['Interests', 'Selected research']);
    const sel = stops[1];
    expect(sel.children?.map((c) => c.label)).toEqual(['One']);
    expect(sel.children?.[0].children?.map((c) => c.label)).toEqual(['The idea', 'Method', 'Results']);
  });

  it('NESTS once there are two featured papers', () => {
    const stops = researchStops([paper({ shortTitle: 'One' }), paper({ shortTitle: 'Two' })], ['i']);
    expect(stops.some((s) => !!s.children?.length)).toBe(true);
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

  it('falls back to the title for a BLANK shortTitle, not an empty rail row', () => {
    // `??` would accept '' as a real label and render a row with no text.
    for (const blank of ['', '   ']) {
      const p = paper({ shortTitle: blank });
      const stops = researchStops([p], []);
      expect(stops[0].children?.[0].label).toBe(p.title);
    }
  });

  it('omits Method when mathKey is set but UNRESOLVABLE', () => {
    // The rail must agree with what the page can actually render: research.astro
    // only emits a Method block when lib/paperMath resolves the key, so a stop for
    // an unknown key would point at an id that never exists in the DOM.
    const stops = researchStops([paper({ shortTitle: 'One', mathKey: 'no-such-key' })], []);
    const sections = stops[0].children?.[0].children?.map((c) => c.label);
    expect(sections).toEqual(['The idea', 'Results']);
    expect(targets(stops)).not.toContain(paperSectionId(0, 'math'));
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
    expect(stops.some((s) => !!s.children?.length)).toBe(false);
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

describe('the REAL site data', () => {
  it('nests today, naming the real paper, with unique targets', () => {
    const stops = researchStops(publications, researchInterests);
    expect(stops.some((s) => !!s.children?.length)).toBe(true);
    // the rail must name the paper, not show a bare "Method"
    expect(flattenStops(stops).map((s) => s.label)).toContain('RL-BHRP');
    const all = targets(stops);
    expect(new Set(all).size).toBe(all.length);
  });

  it('would nest — with unique ids — if a second paper were featured', () => {
    const twice = [...publications, { ...publications.find((p) => p.featured)!, shortTitle: 'Next' }];
    const stops = researchStops(twice, researchInterests);
    expect(stops.some((s) => !!s.children?.length)).toBe(true);
    const all = targets(stops);
    expect(new Set(all).size).toBe(all.length);
  });

  it('gives /projects a stop per project', () => {
    expect(projectStops(projects)).toHaveLength(projects.length);
  });

  /* A ONE-CHARACTER TYPO IN profile.ts CAN DELETE A SECTION OF /research, SILENTLY. That is the hole
     this closes, and every gate the repo has was blind to it.

     The mechanism: `mathKey` is typed `string` (profile.ts), lib/paperMath resolves it with a plain
     lookup, and BOTH the page's Method block and the rail's Method stop are conditional on that
     lookup succeeding. So 'rlbhpr' instead of 'rlbhrp' does not throw and does not render an empty
     panel — it removes the paper's whole Method block AND its rail stop, in agreement with each
     other, and `npm run build`, `npm run typecheck` and every other test in this file stay green.
     The rail-suppression is *correct* behaviour (a stop must never point at an id the page did not
     emit, which is what pageStops.ts exists for) and that correctness is exactly what hides the
     loss: tests/distSmoke.test.ts only checks that links resolve, and after the typo there is no
     link and no target, so nothing is dangling. A consistent absence.

     Why this assertion is over the REAL data and not a fixture: every other `mathKey` in this file
     is on a synthetic paper() and one case (`'no-such-key'`) asserts that an unresolvable key is
     handled — the suppression path is well covered, and none of it looks at what profile.ts says.

     Why it does not name 'rlbhrp': a test that hardcodes the expected key would pass while the site
     was broken (it would be asserting that the table contains a string the test itself supplied).
     The claim has to be relational — every key the DATA carries resolves in the TABLE — so mathFor()
     is asked, which is the same function research.astro and pageStops.ts both ask. */
  it('resolves every mathKey the real publications carry', () => {
    const keyed = publications.filter((p) => p.mathKey !== undefined);
    // Asserted, not assumed: if the last mathKey were dropped from profile.ts this must go red rather
    // than iterate an empty list and pass. Method blocks are a feature of the site, not an accident.
    expect(keyed.length, 'no publication in profile.ts carries a mathKey any more').toBeGreaterThan(0);
    for (const p of keyed) {
      expect(
        mathFor(p),
        `publication "${p.title}" has mathKey="${p.mathKey}", which lib/paperMath.ts cannot resolve. ` +
          'Nothing else will tell you: /research silently drops that paper\'s entire Method block and ' +
          'its rail stop, and build, typecheck and the rest of the suite all stay green. Fix the key ' +
          'in src/data/profile.ts, or add the entry to MATH_BY_KEY in src/lib/paperMath.ts.',
      ).toBeDefined();
    }
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
