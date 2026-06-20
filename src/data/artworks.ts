import type { ImageMetadata } from 'astro';
import steleSrc from '../assets/art/spring-couplet-stele.jpg';
import poemSrc from '../assets/art/running-script-poem.jpg';

export type ArtCategory = 'Calligraphy' | 'Photography';

export interface Artwork {
  src: ImageMetadata;
  alt: string;
  category: ArtCategory;
  kicker?: string;
  title?: string;
  medium?: string;
  note?: string;
  treatment?: 'stele' | 'paper';
}

export const calligraphy: Artwork[] = [
  {
    src: steleSrc,
    alt: 'A Spring Festival couplet in clerical script, white characters set against dark stone',
    category: 'Calligraphy',
    kicker: 'Calligraphy · 隸書',
    title: 'Spring Couplet',
    medium: 'clerical script · ink on paper, set as stele',
    note: '', // Ing to provide
    treatment: 'stele',
  },
  {
    src: poemSrc,
    alt: 'A poem in running-cursive script, black ink on paper, signed with a red seal',
    category: 'Calligraphy',
    kicker: 'Calligraphy · 行草',
    title: 'Untitled',
    medium: 'running-cursive script · ink on paper',
    note: '', // Ing to provide
    treatment: 'paper',
  },
];

// Photos: glob the assets dir, sort by filename for stable order. alt is generic
// (no per-photo titles yet); notes added later via a parallel map keyed by file.
const photoFiles = import.meta.glob<{ default: ImageMetadata }>(
  '../assets/art/photos/*.{jpg,jpeg,JPG,JPEG}',
  { eager: true },
);

export const photography: Artwork[] = Object.keys(photoFiles)
  .sort()
  .map((path) => ({
    src: photoFiles[path].default,
    alt: 'Photograph by Ing Tian',
    category: 'Photography' as const,
  }));

export const photoDefault = {
  kicker: 'Photography',
  title: `${photography.length} photographs`,
  note: 'Hover a photograph to read its note. Click any work to look closely.',
};
