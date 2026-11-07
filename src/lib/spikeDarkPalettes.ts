// SPIKE (throwaway, task 19): the JS half of four dark palettes the owner can switch between live
// (`html[data-darkpal]`, set by BaseLayout's theme resolver from localStorage['spike.darkpal']).
// The CSS half is styles/spike-darkpal.css. 'current' is what the site does today: no entry here,
// so every consumer falls back to its own shipped constants. Not for main: the chosen palette is
// to be built properly, through review.

import type { RampStop } from './skyPalette';
import type { TerrainRamp } from './terrain';
import type { StarBands } from './terrainRender';

type RGB = [number, number, number];

export interface DarkPal {
  descent: readonly RampStop[];
  reading: readonly RampStop[];
  nebula: RGB;
  bloom: number;        // the warm bloom's gain in dark (1 = today's)
  readingTint: number;  // the reading pages' subtractive tint's gain in dark (1 = today's)
  stars: StarBands;     // the shader's and the terrain's star tints
  terrain: TerrainRamp;
  terrainWarm: number;  // litColor's warm swing at darkness 1 (today's is 0.30)
  walker: { glow: RGB; settled: RGB; trail: RGB };
  survey: RGB;
}

/** Today's star tints, as the shader's literals were (the terrain's starIdentity keeps its own copy). */
export const CURRENT_STARS: StarBands = {
  coolA: [0.62, 0.74, 1.0], coolB: [0.86, 0.92, 1.0], white: [0.97, 0.97, 1.0],
  warmA: [0.80, 0.72, 1.0], warmB: [1.0, 0.86, 0.72],
};

export const DARK_PALS = {
  midnight: {
    descent: [[0, '#0d1117'], [0.2, '#0b0f14'], [0.4, '#0a0d12'], [0.6, '#080b0f'], [0.8, '#06090d'], [1, '#05070a']],
    reading: [[0, '#0d1117'], [0.48, '#0c1016'], [1, '#0b0e14']],
    nebula: [0.020, 0.030, 0.060],
    bloom: 0,
    readingTint: 1,
    stars: {
      coolA: [0.56, 0.68, 0.92], coolB: [0.72, 0.80, 0.96], white: [0.80, 0.86, 0.96],
      warmA: [0.66, 0.74, 0.88], warmB: [0.78, 0.84, 0.94],
    },
    terrain: { valley: [38, 52, 74], mid: [88, 110, 142], peak: [178, 196, 222] },
    terrainWarm: 0.06,
    walker: { glow: [214, 234, 255], settled: [75, 159, 242], trail: [34, 78, 128] },
    survey: [146, 157, 172],
  },
  blackout: {
    descent: [[0, '#0c0c0c'], [0.2, '#0b0b0b'], [0.4, '#0a0a0a'], [0.6, '#080808'], [0.8, '#070707'], [1, '#050505']],
    reading: [[0, '#0c0c0c'], [0.48, '#0b0b0b'], [1, '#0a0a0a']],
    nebula: [0, 0, 0],
    bloom: 0,
    readingTint: 0,
    stars: {
      coolA: [0.88, 0.88, 0.92], coolB: [0.94, 0.94, 0.97], white: [0.97, 0.97, 0.98],
      warmA: [0.78, 0.78, 0.81], warmB: [0.88, 0.88, 0.90],
    },
    terrain: { valley: [70, 70, 74], mid: [138, 138, 143], peak: [232, 232, 236] },
    terrainWarm: 0,
    walker: { glow: [255, 228, 222], settled: [224, 87, 74], trail: [112, 38, 32] },
    survey: [156, 156, 161],
  },
  graphite: {
    descent: [[0, '#161616'], [0.2, '#131313'], [0.4, '#111111'], [0.6, '#0e0e0e'], [0.8, '#0b0b0b'], [1, '#080808']],
    reading: [[0, '#151515'], [0.48, '#141414'], [1, '#121212']],
    nebula: [0.05, 0.05, 0.05],
    bloom: 0,
    readingTint: 0,
    stars: {
      coolA: [0.86, 0.87, 0.90], coolB: [0.93, 0.93, 0.95], white: [0.96, 0.96, 0.96],
      warmA: [0.95, 0.94, 0.92], warmB: [1.0, 0.95, 0.91],
    },
    terrain: { valley: [66, 65, 63], mid: [124, 123, 119], peak: [216, 215, 211] },
    terrainWarm: 0.08,
    walker: { glow: [255, 222, 214], settled: [224, 87, 74], trail: [122, 52, 45] },
    survey: [155, 154, 149],
  },
} satisfies Record<string, DarkPal>;

export type DarkPalName = 'current' | keyof typeof DARK_PALS;

/** The switcher's buttons, in order. */
export const DARKPAL_LABELS: ReadonlyArray<readonly [DarkPalName, string]> = [
  ['current', 'Current'], ['midnight', 'Midnight IDE'], ['blackout', 'Blackout Graphite'], ['graphite', 'Graphite and Seal'],
];

/** The palette `<html data-darkpal>` names, or null for 'current' (use the shipped constants). Browser only. */
export function activeDarkPal(): DarkPal | null {
  const k = document.documentElement.dataset.darkpal;
  return k && k in DARK_PALS ? DARK_PALS[k as keyof typeof DARK_PALS] : null;
}
