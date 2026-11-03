// tests/galleryLayout.test.ts
// /projects' gallery geometry and the click rule its project surfaces share (src/lib/galleryLayout.ts).
import { describe, expect, it } from 'vitest';
import { projects } from '../src/data/profile';
import { GALLERY_ORDER, READY_MS, askPoint, fanPose, readyAfter } from '../src/lib/galleryLayout';

describe('GALLERY_ORDER', () => {
  it('is the mockup\'s six, every one a real project', () => {
    expect([...GALLERY_ORDER]).toEqual(['rl-bhrp', 'trading-desk', 'offchart', 'manifold', 'witness', 'daylogs']);
    const slugs = new Set(projects.map((p) => p.slug));
    expect(GALLERY_ORDER.filter((s) => !slugs.has(s))).toEqual([]);
  });
});

describe('fanPose', () => {
  it('poses the outermost card of six', () => {
    expect(fanPose(0, 6)).toEqual({ x: -375, z: -175, ry: 22.5, rz: -5.5, zi: 5, pile: -10.5 });
  });

  it('stacks the middle pair on top and the edges below', () => {
    expect(fanPose(3, 6).zi).toBe(9);
    expect([0, 1, 2, 3, 4, 5].map((i) => fanPose(i, 6).zi)).toEqual([5, 7, 9, 9, 7, 5]);
  });

  it('mirrors about the middle, except the pile, which alternates its offset', () => {
    for (let i = 0; i < 3; i++) {
      const a = fanPose(i, 6), b = fanPose(5 - i, 6);
      expect([b.x, b.ry, b.rz, b.z, b.zi]).toEqual([-a.x, -a.ry, -a.rz, a.z, a.zi]);
    }
    // 3.4k, then +2 for an odd index and -2 for an even one
    expect([0, 1, 2, 3, 4, 5].map((i) => fanPose(i, 6).pile)).toEqual([-10.5, -3.1, -3.7, 3.7, 3.1, 10.5]);
  });

  it('prints clean numbers: 2.2 * -1.5 is -3.3, not -3.3000000000000003', () => {
    expect(fanPose(1, 6).rz).toBe(-3.3);
    expect(String(fanPose(4, 6).pile)).toBe('3.1');
  });
});

describe('readyAfter', () => {
  it('is ready the moment the picture has loaded', () => {
    expect(readyAfter(true, 0)).toBe(true);
  });

  it('gives a picture that never arrives four seconds, then leaves the loading state anyway', () => {
    expect(READY_MS).toBe(4000);
    expect(readyAfter(false, 3999)).toBe(false);
    expect(readyAfter(false, 4000)).toBe(true);
  });
});

describe('askPoint', () => {
  const plain = { button: 0, detail: 1, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false, clientX: 120, clientY: 340 };
  const box = { left: 100, top: 300, width: 200, height: 80 };

  it('asks at the pointer on a plain primary click', () => {
    expect(askPoint(plain, box, true)).toEqual({ x: 120, y: 340 });
  });

  it('lets a modified or non-primary click on a link fall through to the link', () => {
    for (const k of ['metaKey', 'ctrlKey', 'shiftKey', 'altKey'] as const) expect(askPoint({ ...plain, [k]: true }, box, true)).toBeNull();
    expect(askPoint({ ...plain, button: 1 }, box, true)).toBeNull();
  });

  it('asks on a modified click when there is no link to fall through to (a private project\'s button)', () => {
    for (const k of ['metaKey', 'ctrlKey', 'shiftKey', 'altKey'] as const) {
      expect(askPoint({ ...plain, [k]: true }, box, false)).toEqual({ x: 120, y: 340 });
    }
  });

  it('asks at the element\'s centre for a keyboard activation: a click count of 0, whatever coordinates it reports', () => {
    expect(askPoint({ ...plain, detail: 0 }, box, true)).toEqual({ x: 200, y: 340 });
    expect(askPoint({ ...plain, detail: 0, clientX: 0, clientY: 0 }, box, false)).toEqual({ x: 200, y: 340 });
  });

  it('keeps Chrome\'s (0, 0) as a second sign of a keyboard activation', () => {
    expect(askPoint({ ...plain, clientX: 0, clientY: 0 }, box, true)).toEqual({ x: 200, y: 340 });
  });
});
