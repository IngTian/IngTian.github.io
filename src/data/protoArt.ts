// PROTOTYPE (throwaway) data for /proto-art: the placeholder places and the three candidate sentences. Delete with
// that page; nothing else reads it.
//
// PLACES ARE PLACEHOLDERS. No photograph carries a location (the 2026-06 re-export dropped every EXIF block), and
// photoNotes.ts was written by a model looking at the pixels. These are guesses from that copy; the real places come
// from the owner, and the page prints each one marked as a placeholder. City level only, never a home. A photo is
// its number, photo-NN.jpg, which is photography[NN - 1] (sorted by name).

export interface ProtoPlace { name: string; region: string; photos: number[] }

export const PLACES: ProtoPlace[] = [
  { name: 'San Francisco', region: 'California', photos: [9, 15, 6, 22, 39] },
  { name: 'The Oregon coast', region: 'Oregon', photos: [17, 35, 2] },
  { name: 'Seattle', region: 'Washington', photos: [24, 27, 14, 12, 42] },
  { name: 'Vancouver', region: 'British Columbia', photos: [41, 40, 3, 10, 13, 11] },
  { name: 'The Rockies', region: 'Alberta', photos: [23, 37, 25, 5, 7, 8] },
  { name: 'The foothills', region: 'Alberta', photos: [19, 16, 26, 30, 21, 31, 1, 38] },
  { name: 'Toronto', region: 'Ontario', photos: [34, 20, 4, 28, 29] },
  { name: 'Montreal', region: 'Quebec', photos: [36, 32, 33, 18] },
];

/** A work by its key: `photo-NN` (photo-NN.jpg) or `cal-N` (calligraphy[N - 1]). It is also the work's id below. */
export type WorkKey = `photo-${string}` | `cal-${number}`;
export interface Phrase { text: string; work: WorkKey }
export interface Sentence { tone: string; parts: (string | Phrase)[] }

const p = (text: string, work: WorkKey): Phrase => ({ text, work });

/**
 * THE THREE CANDIDATE SENTENCES, in the owner's voice, for the owner to choose from or rewrite. Each phrase stands for
 * one work, and says only what that work shows (checked against the picture and its alt) or what artworks.ts records
 * (the couplet's clerical script and stele setting, the poem's running-cursive): no place, date or story is claimed.
 * A phrase is the noun alone and the description stays in ink, so red marks and never fills: the page refuses a
 * sentence whose red is outside RED_SHARE of its words (the Met's index sentence is about 32%).
 */
export const RED_SHARE = { min: 0.3, max: 0.4 };
export const SENTENCES: Sentence[] = [
  {
    tone: 'plain',
    parts: [
      'I take photographs — of ',
      p('a red canoe', 'photo-23'), ' on a turquoise lake, ',
      p('a bridge tower', 'photo-09'), ' lit against the city, ',
      p('a heron', 'photo-12'), ' waiting on a stone and ',
      p('cherry blossoms', 'photo-42'), ' against a clear sky — and I write calligraphy, among it ',
      p('a spring couplet', 'cal-1'), ' in clerical script and ',
      p('a poem', 'cal-2'), ' in running-cursive.',
    ],
  },
  {
    tone: 'lyrical',
    parts: [
      'Outdoors, light does a brush’s work — ',
      p('a mountainside', 'photo-25'), ' erased by mist, ',
      p('a crescent moon', 'photo-06'), ' early over the sea, ',
      p('white water', 'photo-35'), ' writing on mossy stone, ',
      p('a sailboat', 'photo-41'), ' on hammered silver — and with the brush itself I write ',
      p('a poem', 'cal-2'), ' in running hand and ',
      p('a spring couplet', 'cal-1'), '.',
    ],
  },
  {
    tone: 'wry',
    parts: [
      'Calligraphy is slow and a camera is quick, so beside ',
      p('a spring couplet', 'cal-1'), ' and ',
      p('a poem', 'cal-2'), ' in running-cursive I keep ',
      p('a steam engine', 'photo-08'), ' still at work, ',
      p('a landscape', 'photo-38'), ' gone to streaks at speed, ',
      p('plush cows', 'photo-18'), ' posing at a monument and ',
      p('one plush cow', 'photo-30'), ' looking over the real thing.',
    ],
  },
];
