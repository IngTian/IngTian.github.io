import { describe, it, expect } from 'vitest';
import { script } from '../src/data/script';
import { links } from '../src/data/profile';

// These guard the string-keyed couplings the type system CAN'T check, so a
// typo becomes a red test instead of a silent dead chip / dead nav link that
// only shows up in production. (Audit findings: terminal goto/start lookups,
// CornerNav label→href lookups.)

describe('terminal script graph', () => {
  const ids = Object.keys(script.pairs);

  it('start points at a real pair', () => {
    expect(ids).toContain(script.start);
  });

  it('every pair key matches its own id field', () => {
    for (const [key, pair] of Object.entries(script.pairs)) {
      expect(pair.id).toBe(key);
    }
  });

  it('every pair has a non-empty slash command', () => {
    for (const pair of Object.values(script.pairs)) {
      expect(pair.command, `pair "${pair.id}"`).toBeTruthy();
    }
  });

  it('no two pairs share a slash command (the palette would be ambiguous)', () => {
    const commands = Object.values(script.pairs).map((p) => p.command);
    expect(new Set(commands).size).toBe(commands.length);
  });
});

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
});
