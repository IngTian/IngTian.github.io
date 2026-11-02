// src/data/projectVisuals.ts
// Each project's picture on /projects. Four are COMPUTED from the project's own output (lib/projectVisuals.ts,
// over src/data/vendor); three are real captures, vendored into src/assets/projects by tools/vendor-projects.mjs
// with their provenance in src/assets/projects/SOURCES.txt.
//
// trading-desk and daylogs have only a dark capture, shown in BOTH themes — never CSS-inverted, the "derived"
// light look the owner ruled out (spec section 6). manifold's still is its own 600x376 thumbnail, the poster in
// every theme; its motion is two MP4s in public/ (converted from the repo's 1.0-1.2 MB GIFs), so they are
// fetched by URL only once the fan has opened, never on the critical path.
import type { ImageMetadata } from 'astro';
import daylogsBody from '../assets/projects/daylogs-body.png';
import manifoldStill from '../assets/projects/manifold-thumbnail.png';
import tradingDeskDashboard from '../assets/projects/trading-desk-dashboard.png';
import { facetsSvg, positioningSvg, sectionsSvg, wealthSvg } from '../lib/projectVisuals';
import { macbootSections } from './vendor/macbootSections';
import { offchartPositioning } from './vendor/offchartPositioning';
import { rlBhrpWealth } from './vendor/rlBhrpWealth';
import { witnessFacets } from './vendor/witnessFacets';

export type ProjectVisual =
  | { kind: 'image'; dark: ImageMetadata; light?: ImageMetadata; poster?: ImageMetadata; motion?: { dark: string; light?: string } }
  | { kind: 'svg'; svg: string };

const VISUALS: Record<string, ProjectVisual> = {
  'rl-bhrp': { kind: 'svg', svg: wealthSvg(rlBhrpWealth) },
  offchart: { kind: 'svg', svg: positioningSvg(offchartPositioning) },
  'trading-desk': { kind: 'image', dark: tradingDeskDashboard },
  witness: { kind: 'svg', svg: facetsSvg(witnessFacets) },
  daylogs: { kind: 'image', dark: daylogsBody },
  manifold: {
    kind: 'image', dark: manifoldStill, poster: manifoldStill,
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
