import { describe, it, expect } from 'vitest';
import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  KINDS, sorted, totalEntries, kindSectionId, entrySectionId,
  type WritingKind, type WritingEntry,
} from '../src/data/writing';
import { writingStops, flattenStops } from '../src/lib/pageStops';
import { PAGES } from '../src/data/nav';

// THE POINT OF THIS FILE. /writing exists to GROW: the whole design is that adding a kind or a piece is a data
// edit with no layout work. These tests pin the contract that makes that safe — ids stay unique, the rail
// follows the data, and the empty state disappears on its own the moment a kind has an entry.

function entry(over: Partial<WritingEntry> = {}): WritingEntry {
  return { slug: 'a-piece', title: 'A piece', date: '2026-01-15', blurb: 'What it argues.', ...over };
}
function kind(over: Partial<WritingKind> = {}): WritingKind {
  return {
    key: 'k', label: 'A kind', railLabel: 'Kind',
    gloss: 'What belongs here.', empty: 'Nothing yet, and here is what is coming.',
    entries: [], ...over,
  };
}

describe('the kinds as shipped', () => {
  it('has at least one kind, each with a distinct key', () => {
    expect(KINDS.length).toBeGreaterThan(0);
    expect(new Set(KINDS.map((k) => k.key)).size).toBe(KINDS.length);
  });

  it('gives every kind a heading, a rail label, a gloss and an empty line', () => {
    for (const k of KINDS) {
      expect(k.label.length, k.key).toBeGreaterThan(0);
      expect(k.gloss.length, k.key).toBeGreaterThan(30);
      // The empty state must say WHAT is coming — a bare "coming soon" reads as filler, which is the whole
      // reason this field exists rather than a hardcoded string in the page.
      expect(k.empty.length, k.key).toBeGreaterThan(40);
      expect(k.empty.toLowerCase(), k.key).not.toBe('coming soon');
    }
  });

  it('keeps rail labels short enough for an 11px mono margin', () => {
    for (const k of KINDS) expect(k.railLabel.length, k.railLabel).toBeLessThanOrEqual(11);
  });

  it('has unique section ids across kinds and entries', () => {
    const ids = [
      ...KINDS.map((k) => kindSectionId(k.key)),
      ...KINDS.flatMap((k) => k.entries.map((e) => entrySectionId(k.key, e.slug))),
    ];
    expect(new Set(ids).size).toBe(ids.length);
  });

  // Two kinds may legitimately hold the same slug (an "intro" note and an "intro" essay), so the id must be
  // prefixed by kind. Without that the rail's two links would resolve to the same element.
  it('namespaces entry ids by kind, so two kinds may share a slug', () => {
    expect(entrySectionId('notes', 'intro')).not.toBe(entrySectionId('essays', 'intro'));
  });
});

describe('sorted', () => {
  it('puts the newest piece first', () => {
    const k = kind({ entries: [
      entry({ slug: 'old', date: '2025-03-01' }),
      entry({ slug: 'new', date: '2026-07-01' }),
      entry({ slug: 'mid', date: '2026-01-01' }),
    ] });
    expect(sorted(k).map((e) => e.slug)).toEqual(['new', 'mid', 'old']);
  });

  it('does not mutate the kind it reads', () => {
    const k = kind({ entries: [entry({ slug: 'a', date: '2025-01-01' }), entry({ slug: 'b', date: '2026-01-01' })] });
    sorted(k);
    expect(k.entries.map((e) => e.slug)).toEqual(['a', 'b']);
  });

  it('is stable and safe on an empty kind', () => {
    expect(sorted(kind())).toEqual([]);
  });
});

describe('totalEntries', () => {
  it('counts across kinds', () => {
    expect(totalEntries([kind({ key: 'a', entries: [entry()] }), kind({ key: 'b', entries: [entry(), entry()] })])).toBe(3);
  });

  it('is zero for an empty shelf — which is what drives the page-level state line', () => {
    expect(totalEntries([kind({ key: 'a' }), kind({ key: 'b' })])).toBe(0);
  });
});

describe('writingStops', () => {
  it('gives every kind a stop, INCLUDING empty ones — the section still renders', () => {
    const stops = writingStops(KINDS);
    expect(stops).toHaveLength(KINDS.length);
    for (const [i, s] of stops.entries()) {
      expect(s.target).toBe(kindSectionId(KINDS[i].key));
    }
  });

  it('leaves an empty kind childless rather than nesting an empty list', () => {
    const stops = writingStops([kind()]);
    expect(stops[0].children).toBeUndefined();
  });

  it('nests a kind’s pieces, newest first', () => {
    const stops = writingStops([kind({ entries: [
      entry({ slug: 'old', title: 'Older piece', date: '2025-01-01' }),
      entry({ slug: 'new', title: 'Newer piece', date: '2026-01-01' }),
    ] })]);
    expect(stops[0].children?.map((c) => c.label)).toEqual(['Newer piece', 'Older piece']);
    expect(stops[0].children?.map((c) => c.target))
      .toEqual([entrySectionId('k', 'new'), entrySectionId('k', 'old')]);
  });

  // A rail label is a bookmark, not a headline: real essay titles run well past what an 11px mono margin can
  // hold, so the tree truncates rather than letting the rail decide by overflowing.
  it('truncates a long title for the margin', () => {
    const long = 'A Very Long Essay Title That Would Never Fit In A Thin Margin';
    const stops = writingStops([kind({ entries: [entry({ title: long })] })]);
    const label = stops[0].children![0].label;
    expect(label.length).toBeLessThanOrEqual(18);
    expect(label.endsWith('…')).toBe(true);
  });

  it('produces unique targets across every stop', () => {
    const flat = flattenStops(writingStops(KINDS));
    const targets = flat.map((s) => s.target);
    expect(new Set(targets).size).toBe(targets.length);
  });
});

describe('the route is wired up', () => {
  it('exists as a page', () => {
    const pages = readdirSync(resolve(import.meta.dirname, '../src/pages'));
    expect(pages).toContain('writing.astro');
  });

  it('is reachable from the always-visible nav', () => {
    expect(PAGES.map((p) => p.href)).toContain('/writing');
  });

  // The split only makes sense if the two are adjacent and in this order: the papers, then the thinking around
  // them. If someone reorders the nav, that should be a decision rather than an accident.
  it('sits directly after /research', () => {
    const i = PAGES.findIndex((p) => p.href === '/research');
    expect(PAGES[i + 1]?.href).toBe('/writing');
  });
});
