// src/data/projectVisuals.ts
// Each project's picture on /projects. Four are COMPUTED from the project's own output (lib/projectVisuals.ts,
// over src/data/vendor); three are real captures, vendored into src/assets/projects by tools/vendor-projects.mjs
// with their provenance in src/assets/projects/SOURCES.txt.
//
// trading-desk and daylogs have only a dark capture, shown in BOTH themes — never CSS-inverted, the "derived"
// light look the owner ruled out (spec section 6). manifold has a capture per theme: each still is the first
// frame of that theme's MP4, so it is also that video's poster — the swap to motion shows no jump, a light-theme
// reader never sees a dark still turn light, and reduced motion keeps a real frame. The MP4s sit in public/
// (converted from the repo's 1.0-1.2 MB GIFs), fetched by URL only once the fan has opened, never on the
// critical path.
import type { ImageMetadata } from 'astro';
import daylogsBody from '../assets/projects/daylogs-body.png';
import manifoldDark from '../assets/projects/manifold-saver-dark.png';
import manifoldLight from '../assets/projects/manifold-saver-light.png';
import tradingDeskDashboard from '../assets/projects/trading-desk-dashboard.png';
import { facetsSvg, positioningSvg, sectionsSvg, wealthSvg } from '../lib/projectVisuals';
import { macbootSections } from './vendor/macbootSections';
import { offchartPositioning } from './vendor/offchartPositioning';
import { rlBhrpWealth } from './vendor/rlBhrpWealth';
import { witnessFacets } from './vendor/witnessFacets';

/** A capture's `alt` is hand-written; a computed svg labels itself (lib/projectVisuals.ts). */
export type ProjectVisual =
  | { kind: 'image'; dark: ImageMetadata; light?: ImageMetadata; alt: string; motion?: { dark: string; light?: string } }
  | { kind: 'svg'; svg: string };

const VISUALS: Record<string, ProjectVisual> = {
  'rl-bhrp': { kind: 'svg', svg: wealthSvg(rlBhrpWealth) },
  offchart: { kind: 'svg', svg: positioningSvg(offchartPositioning) },
  'trading-desk': {
    kind: 'image', dark: tradingDeskDashboard,
    alt: 'trading-desk\'s dashboard in a terminal: a book\'s net worth against what went in, its return split into '
      + 'realised, unrealised, income and currency, then its holdings and cash flows.',
  },
  witness: { kind: 'svg', svg: facetsSvg(witnessFacets) },
  daylogs: {
    kind: 'image', dark: daylogsBody,
    alt: 'daylogs\' Body view in a terminal: the day\'s weight and BMI, a month\'s weight trend, the energy balance '
      + 'against maintenance, and the food log.',
  },
  manifold: {
    kind: 'image', dark: manifoldDark, light: manifoldLight,
    alt: 'manifold\'s screensaver: a clock floating over a mountain drawn in points of light.',
    motion: { dark: '/projects/manifold-saver-dark.mp4', light: '/projects/manifold-saver-light.mp4' },
  },
  macboot: { kind: 'svg', svg: sectionsSvg(macbootSections) },
};

/** The picture for a project slug. Throws for a slug without one, so a new project fails the build rather than
 *  shipping an empty card. */
export function visualFor(slug: string): ProjectVisual {
  const v = VISUALS[slug];
  if (!v) throw new Error(`visualFor: no picture for "${slug}" — add it to src/data/projectVisuals.ts`);
  return v;
}
