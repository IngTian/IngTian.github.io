// /art's works, each by a stable key, and the one sentence that indexes them. A photograph's key is its file's name
// (photo-07.jpg is 'photo-07'), a calligraphy's is named, never an index. A field is given only when it is known:
// the page prints what is here and nothing in place of what is not (lib/artPage.ts, labelLine).
import type { ImageMetadata } from 'astro';
import steleSrc from '../assets/art/spring-couplet-stele.jpg';
import poemSrc from '../assets/art/running-script-poem.jpg';
import { photoNotes } from './photoNotes';
import type { Phrase, SentencePart } from '../lib/artPage';

/** `place` is the note's name, and only once the owner has confirmed it. */
export interface Photo { key: string; src: ImageMetadata; alt: string; title?: string; place?: string; year?: string }
export interface Calligraphy {
  key: string; src: ImageMetadata; alt: string; title?: string; titleZh?: string;
  script: string; scriptZh: string; medium: string; note?: string; treatment: 'stele' | 'paper';
}

// The couplet is stele-STYLE: ink on paper, recomposed white on black, never claimed as a rubbing or as stone. The
// poem has no title on record, and neither work has its note yet: each is the owner's to give.
export const calligraphy: Calligraphy[] = [
  { key: 'couplet', src: steleSrc, title: 'Spring Couplet', titleZh: '春聯', script: 'Clerical script', scriptZh: '隸書',
    medium: 'Ink on paper, set as stele', treatment: 'stele',
    alt: 'A Spring Festival couplet in clerical script, white characters on a black ground, recomposed in the manner of a stele' },
  { key: 'poem', src: poemSrc, script: 'Running-cursive script', scriptZh: '行草', medium: 'Ink on paper', treatment: 'paper',
    alt: 'A poem in running-cursive script, black ink on paper, signed with a red seal' },
];

// The photographs, in the order of their files, globbed so a new file is a new photograph. Per-photo copy comes from
// photoNotes, keyed by file name; a file without an entry gets a generic alt and no label but its medium.
const photoFiles = import.meta.glob<{ default: ImageMetadata }>(
  '../assets/art/photos/*.{jpg,jpeg,JPG,JPEG}',
  { eager: true },
);

/** The key a photograph's file gives it. A file not named photo-… fails the build, by name: the prefix keeps a
 *  photograph's id off the page's own (`calligraphy`, `photographs`). */
const photoKey = (file: string): string => {
  const key = file.replace(/\.jpe?g$/i, '');
  if (!key.startsWith('photo-')) throw new Error(`artworks: ${file} is not named photo-…, so it has no key`);
  return key;
};

export const photography: Photo[] = Object.keys(photoFiles)
  .sort()
  .map((path) => {
    const file = path.split('/').pop() ?? '';
    const meta = photoNotes[file];
    return {
      key: photoKey(file),
      src: photoFiles[path].default,
      alt: meta?.alt ?? 'Photograph by Ing Tian',
      title: meta?.title,
      place: meta?.place?.confirmed ? meta.place.name : undefined,
      year: meta?.year,
    };
  });

const p = (text: string, work: string): Phrase => ({ text, work });

/**
 * THE SENTENCE, the page's index, in the owner's first person. Each phrase (set in seal red) is a work, says only what
 * that work shows or what is recorded above, and is the noun alone, its description in ink. The page refuses a
 * sentence that breaks a rule in lib/artPage.ts, naming it.
 */
export const SENTENCE: SentencePart[] = [
  'I take photographs — of ', p('a red canoe', 'photo-23'), ' on a turquoise lake, ', p('a bridge tower', 'photo-09'),
  ' lit against the city, ', p('a heron', 'photo-12'), ' standing on a stone and ', p('cherry blossoms', 'photo-42'),
  ' against a clear sky — and I write calligraphy: ', p('a spring couplet', 'couplet'), ' in clerical script and ',
  p('a poem', 'poem'), ' in running-cursive.',
];
