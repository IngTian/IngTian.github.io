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

  it('keeps the teardown init returns and runs it before the next init — only for a new DOM, and also when leaving', () => {
    const doc = fakeDocument('interactive');
    const log: string[] = [];
    let n = 0;
    onPageView('[data-term]', () => {
      if (!doc.el) { log.push('init, nothing found'); return undefined; }
      const k = ++n;
      log.push(`init ${k}`);
      return () => { log.push(`teardown ${k}`); };
    });
    doc.readyState = 'complete';
    doc.pageLoad();       // the page-load that ends the full load: same DOM, nothing torn down
    expect(log).toEqual(['init 1']);
    doc.el = null;        // left for another page
    doc.pageLoad();
    doc.el = {};          // back again: a new DOM, and the page without it left nothing to tear down
    doc.pageLoad();
    expect(log).toEqual(['init 1', 'teardown 1', 'init, nothing found', 'init 2']);
  });

  it('never runs a teardown twice, even when the init after it throws', () => {
    const doc = fakeDocument('interactive');
    const log: string[] = [];
    let n = 0;
    onPageView('[data-term]', () => {
      const k = ++n;
      if (k === 2) throw new Error('init 2 failed');
      log.push(`init ${k}`);
      return () => { log.push(`teardown ${k}`); };
    });
    doc.el = {};          // a new DOM, whose init throws
    expect(() => doc.pageLoad()).toThrow('init 2 failed');
    doc.el = {};          // and another: teardown 1 is spent and must not run again
    doc.pageLoad();
    expect(log).toEqual(['init 1', 'teardown 1', 'init 3']);
  });
});
