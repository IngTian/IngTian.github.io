// tests/projectsBoot.test.ts
// /projects' boot: when it plays (shouldBoot — the inline decider in pages/projects.astro ships this very function)
// and what it shows at each moment (bootSteps, bootState — TerminalHeader renders bootState on every tick).
import { describe, expect, it } from 'vitest';
import { inProgress, projects } from '../src/data/profile';
import { bannerRows } from '../src/lib/asciiBanner';
import { BOOT_CMD, BOOT_DEADLINE_MS, BOOT_KEY_MS, bootState, bootSteps, shouldBoot } from '../src/lib/projectsBoot';
import { listingLines } from '../src/lib/projectsListing';

const fresh = { seen: false, force: false, reduce: false, hash: '', restoredScroll: false };

describe('shouldBoot', () => {
  it('plays on a fresh arrival at the top', () => {
    expect(shouldBoot(fresh)).toBe(true);
  });
  it('does not replay once seen this session, but ?boot=1 forces it', () => {
    expect(shouldBoot({ ...fresh, seen: true })).toBe(false);
    expect(shouldBoot({ ...fresh, seen: true, force: true })).toBe(true);
  });
  it('never plays under reduced motion, at a deep link or at a restored scroll — not even forced', () => {
    expect(shouldBoot({ ...fresh, reduce: true })).toBe(false);
    expect(shouldBoot({ ...fresh, hash: '#p-witness' })).toBe(false);
    expect(shouldBoot({ ...fresh, restoredScroll: true })).toBe(false);
    expect(shouldBoot({ ...fresh, force: true, reduce: true })).toBe(false);
    expect(shouldBoot({ ...fresh, force: true, hash: '#p-witness' })).toBe(false);
    expect(shouldBoot({ ...fresh, force: true, restoredScroll: true })).toBe(false);
  });
});

describe('bootSteps — the approved mockup\'s boot(), as a schedule', () => {
  const steps = bootSteps('ls --shipped', 6, 8);
  const at = (d: string, i = 0) => steps.find((s) => s.do === d && s.i === i)!.at;

  it('lights the banner rows 62ms apart from 140ms', () => {
    expect(steps.filter((s) => s.do === 'banner-row').map((s) => s.at)).toEqual([140, 202, 264, 326, 388, 450]);
  });
  it('types the 12 keys of the command from 772ms, 61ms apart', () => {
    const keys = steps.filter((s) => s.do === 'type').map((s) => s.at);
    expect(keys).toHaveLength(12);
    expect(keys).toEqual(keys.map((_, i) => 772 + 61 * i));
  });
  it('prints the comment at 1724, the listing from 1874, the summary at 2530', () => {
    expect(at('line', 0)).toBe(1724);
    expect(at('line', 1)).toBe(1874);
    expect(steps.filter((s) => s.do === 'line')).toHaveLength(9);
    expect(at('summary')).toBe(2530);
  });
  it('deals and finishes together at 2920, finishing last', () => {
    expect(at('deal')).toBe(2920);
    expect(at('done')).toBe(2920);
    expect(steps.at(-1)!.do).toBe('done');
  });
  it('never goes back in time', () => {
    for (let k = 1; k < steps.length; k++) expect(steps[k].at).toBeGreaterThanOrEqual(steps[k - 1].at);
  });
  it('takes each key its own delay when given one', () => {
    const jittered = bootSteps('ab', 6, 8, [40, 80]).filter((s) => s.do === 'type' || s.do === 'line');
    expect(jittered.slice(0, 3).map((s) => s.at)).toEqual([772, 812, 812 + 80 + 220]);
  });
});

describe('bootState', () => {
  const steps = bootSteps('ls --shipped', 6, 8);
  it('starts with nothing lit', () => {
    expect(bootState(steps, 0)).toEqual({ rows: 0, typed: 0, lines: 0, summary: false, dealt: false });
  });
  it('has the banner lit and the first key typed at 800ms', () => {
    expect(bootState(steps, 800)).toMatchObject({ rows: 6, typed: 1 });
  });
  // Skipping renders bootState(steps, Infinity), so a skip and a full run land on the same state.
  it('finishes at Infinity, and a full run lands exactly there', () => {
    const done = { rows: 6, typed: 12, lines: 9, summary: true, dealt: true };
    expect(bootState(steps, Infinity)).toEqual(done);
    expect(bootState(steps, steps.at(-1)!.at)).toEqual(done);
  });
});

// The decider's failsafe takes html.projects-boot off at BOOT_DEADLINE_MS from parse, whether or not the header ran.
// It must never cut a real boot short: against the page as built today — its banner, its listing, its command —
// with every key at the slowest the header draws, the boot is still over a second before the deadline. A project
// added to the listing costs 82ms, a key in the command up to 84; this goes red before they eat the room.
describe('BOOT_DEADLINE_MS', () => {
  it('outlasts the slowest boot today\'s page can schedule, by at least a second', () => {
    const slowest = bootSteps(BOOT_CMD, bannerRows('PROJECTS').length, listingLines(projects, inProgress).length,
      [...BOOT_CMD].map(() => BOOT_KEY_MS[1]));
    expect(BOOT_DEADLINE_MS - slowest.at(-1)!.at).toBeGreaterThanOrEqual(1000);
  });
});
