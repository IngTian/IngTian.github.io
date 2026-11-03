// tests/pageView.test.ts
// onPageView: a /projects script starts at parse on a full load, not at window `load`, and the page-load that ends
// that load does not start it a second time — while a ClientRouter arrival (a new DOM) and a departure still do.
import { afterEach, describe, expect, it } from 'vitest';
import { onPageView } from '../src/lib/pageView';

const g = globalThis as { document?: unknown };

/** A stand-in document: its readyState, the element the selector finds, and a way to fire astro:page-load. */
function fakeDocument(readyState: string) {
  const listeners: (() => void)[] = [];
  const doc = {
    readyState,
    el: {} as object | null,
    querySelector: () => doc.el,
    addEventListener: (type: string, fn: () => void) => { if (type === 'astro:page-load') listeners.push(fn); },
    pageLoad: () => listeners.forEach((fn) => fn()),
  };
  g.document = doc;
  return doc;
}

afterEach(() => { delete g.document; });

describe('onPageView', () => {
  it('runs at once on a full load, and the page-load that ends it finds the same DOM and does nothing', () => {
    const doc = fakeDocument('interactive');
    let runs = 0;
    onPageView('[data-term]', () => { runs++; });
    expect(runs).toBe(1);
    doc.readyState = 'complete';
    doc.pageLoad();
    expect(runs).toBe(1);
  });

  it('waits for page-load when the document has already loaded — a ClientRouter arrival', () => {
    const doc = fakeDocument('complete');
    let runs = 0;
    onPageView('[data-term]', () => { runs++; });
    expect(runs).toBe(0);
    doc.pageLoad();
    expect(runs).toBe(1);
  });

  it('runs again for each new DOM, and for a page without the element, so its teardown happens', () => {
    const doc = fakeDocument('interactive');
    let runs = 0;
    onPageView('[data-term]', () => { runs++; });
    doc.el = null;        // left for another page
    doc.pageLoad();
    expect(runs).toBe(2);
    doc.el = {};          // back again: a new DOM
    doc.pageLoad();
    expect(runs).toBe(3);
  });
});
