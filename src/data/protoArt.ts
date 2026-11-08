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
 */
export const SENTENCES: Sentence[] = [
  {
    tone: 'plain',
    parts: [
      'I take photographs and write calligraphy: ',
      p('a red canoe on a turquoise lake', 'photo-23'), ', ',
      p('a bridge tower lit against the city', 'photo-09'), ', ',
      p('a heron waiting on a stone', 'photo-12'), ', ',
      p('cherry blossoms against a clear sky', 'photo-42'), ', ',
      p('a spring couplet in clerical script', 'cal-1'), ' and ',
      p('a poem in running-cursive', 'cal-2'), '.',
    ],
  },
  {
    tone: 'lyrical',
    parts: [
      'Outdoors, weather and light do a brush’s work — ',
      p('mist erasing a mountainside', 'photo-25'), ', ',
      p('a crescent moon come early over the sea', 'photo-06'), ', ',
      p('white water writing along mossy stone', 'photo-35'), ', ',
      p('a sailboat on hammered silver', 'photo-41'), ' — and with the brush itself I write ',
      p('a poem in running hand', 'cal-2'), ' and ',
      p('a spring couplet, set as a stele', 'cal-1'), '.',
    ],
  },
  {
    tone: 'wry',
    parts: [
      'Calligraphy is slow and a camera is not, so beside ',
      p('a spring couplet in clerical script', 'cal-1'), ' and ',
      p('a poem in running-cursive', 'cal-2'), ' I keep ',
      p('a steam engine still at work', 'photo-08'), ', ',
      p('a view gone to streaks at speed', 'photo-38'), ', ',
      p('plush cows posing at a monument', 'photo-18'), ' and ',
      p('one plush cow looking over the real thing', 'photo-30'), '.',
    ],
  },
];
