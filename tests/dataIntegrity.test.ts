import { describe, it, expect } from 'vitest';
import { links } from '../src/data/profile';

// These guard the string-keyed couplings the type system CAN'T check, so a
// typo becomes a red test instead of a silent dead nav link that only shows up
// in production. (Audit finding: CornerNav label→href lookups.)
//
// The terminal script-graph suite that used to live here is gone with the
// terminal itself — data/script.ts, the typewriter engine and its spec were all
// deleted when the section was removed from the homepage. Git holds them.

describe('profile links resolve the labels the UI depends on', () => {
  const byLabel = new Set(links.map((l) => l.label));

  // The exact labels CornerNav.astro looks up by string (href('...')). If any
  // is renamed in profile.ts without updating the component, the nav silently
  // renders href="#" — this catches that.
  it.each(['GitHub', 'Email', 'Download CV', 'LinkedIn'])(
    'CornerNav label "%s" exists in profile.links',
    (label) => {
      expect(byLabel).toContain(label);
    },
  );

  it('every link has a non-empty href', () => {
    for (const l of links) {
      expect(l.href, `link "${l.label}"`).toBeTruthy();
    }
  });

  // THE FOOTER IS NOW THE ONLY DOORWAY to these routes. The homepage résumé section that used to link
  // them was deleted, and /experience had no inbound link anywhere on the site until it was added here —
  // it was reachable only by typing the URL. If one of these is dropped from profile.links again, the
  // page becomes orphaned silently, so it is a test rather than a comment.
  it.each(['/research', '/experience', '/projects', '/art'])(
    'route "%s" is reachable from the footer link list',
    (href) => {
      expect(links.map((l) => l.href)).toContain(href);
    },
  );
});
