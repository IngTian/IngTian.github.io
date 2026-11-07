// PROTOTYPE (throwaway) data for /proto-art, and the one piece of its logic worth replaying offline (the stack layout,
// at the end). Delete with that page; nothing else reads it.
//
// PLACES ARE PLACEHOLDERS. No photograph carries a location (the 2026-06 re-export dropped every EXIF block), and
// photoNotes.ts was written by a model looking at the pixels. These eight are guesses from that copy, grouped so the
// globe has something to hold; the real places come from the owner. City level only, never a home: the interiors
// (04, 28, 29) sit at a city pin. A photo is its number, photo-NN.jpg, which is photography[NN - 1] (sorted by name).
//
// THE LAND MASK. A 256x128 equirectangular bitset, row-major from 90N and 180W, bit i of byte i>>3 set on land. It
// is decoded from the 1-bit world map cobe 2.0.1 (MIT, by Shu Ding) embeds, which its README credits to
// de.wikipedia.org/wiki/Datei:World_map_blank_without_borders.svg (public domain). Decoded offline from the npm
// tarball and checked when written: an area-weighted land fraction of 31.8% (the map counts sea ice as land), and
// Montreal, Calgary, Paris, Beijing, the Sahara and inland Australia on land, the mid-Pacific, mid-Atlantic, Indian
// Ocean and Hudson Bay off it. No cobe code ships.

export interface ProtoPlace { id: string; name: string; region: string; lat: number; lon: number; photos: number[] }

/** West to east, the order the place list reads in. */
export const PLACES: ProtoPlace[] = [
  { id: "sf", name: "San Francisco", region: "California", lat: 37.77, lon: -122.42, photos: [9, 15, 6, 22, 39] },
  { id: "or", name: "The Oregon coast", region: "Oregon", lat: 44.14, lon: -124.12, photos: [17, 35, 2] },
  { id: "sea", name: "Seattle", region: "Washington", lat: 47.61, lon: -122.33, photos: [24, 27, 14, 12, 42] },
  { id: "van", name: "Vancouver", region: "British Columbia", lat: 49.28, lon: -123.12, photos: [41, 40, 3, 10, 13, 11] },
  { id: "rk", name: "The Rockies", region: "Alberta", lat: 51.42, lon: -116.18, photos: [23, 37, 25, 5, 7, 8] },
  { id: "ab", name: "The foothills", region: "Alberta", lat: 50.6, lon: -113.6, photos: [19, 16, 26, 30, 21, 31, 1, 38] },
  { id: "to", name: "Toronto", region: "Ontario", lat: 43.65, lon: -79.38, photos: [34, 20, 4, 28, 29] },
  { id: "mtl", name: "Montreal", region: "Quebec", lat: 45.5, lon: -73.57, photos: [36, 32, 33, 18] },
];

/**
 * The carousel: five placeholder picks, all 3:4 portraits so the 3:4 frame shows each whole. Chosen from the notes
 * for range, one idea each: 23 colour (the red canoe on turquoise), 09 night (the vermilion tower at blue hour),
 * 25 ink (mist doing a brush's work, the calligraphy's cousin), 06 a figure (the silhouette and the early
 * moon), 41 stillness (the sailboat on hammered silver).
 */
export const PICKS: number[] = [23, 9, 25, 6, 41];

/**
 * A PLACEHOLDER CULL, left off the page everywhere (the stacks, the wall, the lightbox): the frames the browser
 * check named as weak beside the rest. 32 the floor-tile close-up, 28 the interior still life, 18 and 30 the plush
 * cows. The real cull is the owner's; /art still shows all 42.
 */
export const CULL: number[] = [18, 28, 30, 32];

// ── THE STACK LAYOUT. Pure, so a replay can run the code that ships. Stage px; a card is a stack's box, by centre.
export interface Pin { x: number; y: number; o: number }
export interface Card { x: number; y: number }
export const CARD_W = 74, CARD_H = 82, CARD_LIFT = CARD_H / 2 + 22;
/** How far a card may move in one frame beyond what its pin moved. */
export const SLACK = 6;

// Pull every shown card a fraction toward its home above its pin, then push it off every pin and every other card,
// and keep it on the stage.
const relax = (cards: Card[], pins: Pin[], w: number, h: number, pull: number): boolean => {
  let moved = false;
  for (let i = 0; i < cards.length; i++) {
    if (!pins[i].o || !pull) continue;
    cards[i].x += (pins[i].x - cards[i].x) * pull;
    cards[i].y += (pins[i].y - CARD_LIFT - cards[i].y) * pull;
  }
  for (let i = 0; i < cards.length; i++) for (let j = 0; j < pins.length; j++) {
    if (!pins[i].o || !pins[j].o) continue;
    const dx = cards[i].x - pins[j].x, dy = cards[i].y - pins[j].y;
    const ox = CARD_W / 2 + 8 - Math.abs(dx), oy = CARD_H / 2 + 8 - Math.abs(dy);
    if (ox <= 0 || oy <= 0) continue;
    moved = true;
    if (ox < oy) cards[i].x += (dx >= 0 ? 1 : -1) * ox; else cards[i].y += (dy > 0 ? 1 : -1) * oy;
  }
  for (let i = 0; i < cards.length; i++) for (let j = i + 1; j < cards.length; j++) {
    if (!pins[i].o || !pins[j].o) continue;
    const dx = cards[j].x - cards[i].x, dy = cards[j].y - cards[i].y;
    const ox = CARD_W + 10 - Math.abs(dx), oy = CARD_H + 10 - Math.abs(dy);
    if (ox <= 0 || oy <= 0) continue;
    moved = true;
    if (ox < oy) { const m = ((dx >= 0 ? 1 : -1) * ox) / 2; cards[i].x -= m; cards[j].x += m; }
    else { const m = ((dy >= 0 ? 1 : -1) * oy) / 2; cards[i].y -= m; cards[j].y += m; }
  }
  for (const c of cards) {
    c.x = Math.max(CARD_W / 2 + 4, Math.min(w - CARD_W / 2 - 4, c.x));
    c.y = Math.max(CARD_H / 2 + 4, Math.min(h - CARD_H / 2 - 4, c.y));
  }
  return moved;
};

/**
 * One frame of the stack layout. With no `prev` it solves from scratch: sixty rounds, the first thirty pulling, so
 * the cards end apart. With `prev` (the last frame) it FOLLOWS THE MOTION: a card shown last frame starts where it
 * was, carried by its pin's move, gets eight rounds (two pulling gently, all pushing), and may then differ from that
 * carried place by at most SLACK px. Re-solving from the pins every frame is what made the stacks jump (a 3px drag
 * swapped a two-row cluster for one row: that solve is not continuous in the view). A card that was hidden starts
 * at its home: it fades in from opacity 0, so its first place is unseen. `still`: no card moved beyond its pin by a
 * quarter pixel, so the caller can stop asking for frames. Replayed offline by the workspace's follow.mjs.
 */
export function layoutCards(pins: Pin[], prev: { pins: Pin[]; cards: Card[] } | null, w: number, h: number): { cards: Card[]; still: boolean } {
  const carried = pins.map((p, i): Card | null => {
    const q = prev?.pins[i], c = prev?.cards[i];
    return p.o && q?.o && c ? { x: c.x + p.x - q.x, y: c.y + p.y - q.y } : null;
  });
  const cards = pins.map((p, i) => ({ ...(carried[i] ?? { x: p.x, y: p.y - CARD_LIFT }) }));
  if (!prev) {
    for (let it = 0; it < 60; it++) if (!relax(cards, pins, w, h, it < 30 ? 0.12 : 0) && it >= 30) break;
    return { cards, still: true };
  }
  for (let it = 0; it < 8; it++) relax(cards, pins, w, h, it < 2 ? 0.05 : 0);
  let worst = 0;
  cards.forEach((c, i) => {
    const b = carried[i];
    if (!b) return;
    const dx = c.x - b.x, dy = c.y - b.y, d = Math.hypot(dx, dy);
    worst = Math.max(worst, d);
    if (d > SLACK) { c.x = b.x + (dx * SLACK) / d; c.y = b.y + (dy * SLACK) / d; }
  });
  return { cards, still: worst < 0.25 };
}

export const LAND = { w: 256, h: 128, b64: "////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////cPz//////5X///////////////////////////////8/AABAAAAAAf8A/P///////////////////////////wMAAP8HAAAAAAB8gf//////////////////////////AwAAvgAAAAAAAAAH////////////////////wf////8DAAAIAAAAmAEAgP/g/////////////////38A5P///wMAAAAAAAAfAMD//wEAfv7///////+P/////wGA////AwAAAAAAgAMA9P//AQV4/v///////4f/////zwz///8BAAAAAADgAI7/////D/ADAPf//P8BAPP/////H/7//wAAAAAQAOAA/////////98BwB/w/z//5/////8f/v9/AAAA4P8AAHjv///////////+H/z//////////z/8/x8AAAD4/5/5/+////////////9/+P//////////P/z/AQAAAPz/v////////////////3/+//////////8f/H8APwAA//7x////////////////EOD///////898g/4DwA/AIB//v///////////////38A/P//////fxDKA/AHAAAA4J///////////////////wD8//////8/AD8A4AMAAADwn/////////////////wHAPg3+v///x8AfwYAAwAAAPAf//////////////8/HAAAoAfA////PwD/DwAAAAAwIA/+////////////HwAOAACACYD/////Af4PAAAAADDAjv////////////8HgA8AACAAAP7///8P/h8AAAAAcMCD/////////////wGABwAAAAAA+P///7///wAAAADuwP//////////////D4ADAAAAAADw////P///AQAAAO7x//////////////8/gAEAAAAAAOD///////8AAAAA4P3//////////////z+AAAAAAAAAwP//////nwEAAACA/v//////////////bwAAAAAAAACA/////f/DAwAAAOD/////5/////////8vAAAAAAAAAAD////x/4MDAAAAwP////+B/////////ycAAAAAAAAAAP///9//HwAAAACA//+/+YD7////////AwAAAAAAAACA////2/8GAAAAAID//R/58fv///////9xAAAAAAAAAID/////PwAAAAAA/JPzD+Dj/////////3AAAAAAAAAAgP////8/AAAAAAD+Q87v48f///////8fAAAAAAAAAAAA/////w8AAAAAAP5B2P3/x////////w8YAAAAAAAAAAD/////BwAAAAAA/gCI+f/H//////8PBhgAAAAAAAAAAP7///8DAAAAAAB8QIb5/8///////38MDAAAAAAAAAAA/P///wMAAAAAABD/AID+////////P4wPAAAAAAAAAAD8////AQAAAAAA+P8AAP7///////8f5AMAAAAAAAAAAPD///8AAAAAAAD8/4MB/v///////z9wAAAAAAAAAAAA4P//PwAAAAAAAP7/z0//////////fyAAAAAAAAAAAABg//89AAAAAAAA/v////////////9/AAAAAAAAAAAAAMD/D2AAAAAAAAD///////f//////38AAAAAAAAAAAAAgP4HYAAAAAAAwP/////+5///////PwAAAAAAAAAAAAAA/QdAAAAAAADA//////0P/v////8fAAAAAAAAAAAAAAD7BwAAAAAAAOD//////d+B/////08AAAAAAAAAAAAAAPIHYAAAAAAA8P/////7/wP+////ZwAAAAAAAAAAAAAA4AfAAwAAAADw//////P/A/7//v8BAAAAAAAAAAAAAADgBwMGAAAAAPD/////9/8D+D/8TwAAAAAAAAAAAAAAAOCPA3AAAAAA8P/////n/wHwH/hnAAAAAAAAAAAAAAAAgP8BIAAAAADw/////8//APAH+A9gAAAAAAAAAAAAAAAA/AEAAAAAAPD/////zz8A8APoH2AAAAAAAAAAAAAAAADAHwAAAAAA8P/////fDwDwAeA/YAAAAAAAAAAAAAAAAAAfAAAAAADw//////8DAOABwD/AAAAAAAAAAAAAAAAAABwAAAAAAPD/////fwAA4AFAPgADAAAAAAAAAAAAAAAAGPwNAAAA4P//////HwDAAUAcgAAAAAAAAAAAAAAAAADw/x8AAADA//////8PAMACQAiAAgAAAAAAAAAAAAAAAGD/PwAAAID//////w8AAAPAAIADAAAAAAAAAAAAAAAAAP7/AAAAAP//////BwAAA4ABDAMAAAAAAAAAAAAAAAAA/v8HAAAA3PD///8HAAAAsAMeAAAAAAAAAAAAAAAAAAD+/w8AAAAAgP///wMAAABwAw8AAAAAAAAAAAAAAAAAAP//DwAAAACA////AQAAAOCDDwAAAAAAAAAAAAAAAACA//8fAAAAAMD//38AAAAAwOPPBQAAAAAAAAAAAAAAAMD//38AAAAAwP9/PwAAAACA489gAAAAAAAAAAAAAAAAwP///wEAAADA/38/AAAAAADPd8AGAAAAAAAAAAAAAACA////HwAAAID//x8AAAAAAI933H8AAAAAAAAAAAAAAMD///8/AAAAAP//DwAAAAAABuAA/wAAAAAAAAAAAAAAgP///38AAAAA/v8PAAAAAAA4AAD8DQAAAAAAAAAAAACA////fwAAAAD+/w8AAAAAAPABAPwBAAAAAAAAAAAAAAD///9/AAAAAP7/DwAAAAAAAAADMAMAAAAAAAAAAAAAAP///z8AAAAA/P8fAAAAAAAAAAAABgAAAAAAAAAAAAAA/v//HwAAAAD8/x8AAAAAAAAAwCEAAAAAAAAAAAAAAAD8//8fAAAAAP7/HwwAAAAAAADwMQAAAAAAAAAAAAAAAPz//x8AAAAA//8fDgAAAAAAAP5hAAAAAAAAAAAAAAAA+P//DwAAAAD//x8PAAAAAAAA//MAAAAAAAAAAAAAAADg//8PAAAAAP//hw8AAAAAAID//wAAQAAAAAAAAAAAAMD//w8AAAAA/v+DBwAAAAAAwP//AQAAAAAAAAAAAAAAwP//BwAAAAD+/4EHAAAAAAD4//8DAAAAAAAAAAAAAADA//8HAAAAAPz/gQMAAAAAAPz//wcgAAAAAAAAAAAAAMD//wMAAAAA/P+DAwAAAAAA/v//DwAAAAAAAAAAAAAAwP9/AAAAAAD8/4EDAAAAAAD+//8PAAAAAAAAAAAAAADg/z8AAAAAAPz/AAAAAAAAAP7//x8AAAAAAAAAAAAAAOD/PwAAAAAA+H8AAAAAAAAA/v//HwAAAAAAAAAAAAAA4P8fAAAAAAD4fwAAAAAAAAD+//8fAAAAAAAAAAAAAADg/w8AAAAAAPA/AAAAAAAAAPz//x8AAAAAAAAAAAAAAOD/BwAAAAAA4B8AAAAAAAAA/P//HwAAAAAAAAAAAAAA4P8HAAAAAADgDwAAAAAAAAD8gf8PAAAAAAAAAAAAAADw/wMAAAAAAOACAAAAAAAAABwA/Q8AAAAAAAAAAAAAAPD/AAAAAAAAAAAAAAAAAAAAAAD4BwAIAAAAAAAAAAAA8P8AAAAAAAAAAAAAAAAAAAAAAPgHABAAAAAAAAAAAADwPwAAAAAAAAAAAAAAAAAAAAAA4AEAcAAAAAAAAAAAAPgPAAAAAAAAAAAAAAAAAAAAAAAAAAAwAAAAAAAAAAAA+AcAAAAAAAAAAAAAAAAAAAAAAIADAAwAAAAAAAAAAAD4AwAAAAAAAAAAAAAAAAAAAAAAgAEADgAAAAAAAAAAAPADAAAAAAAAAAAAAAAAAAAAAAAAAAADAAAAAAAAAAAA+AAAAAAAAAAAAAAAAAAAAAAAAAAAwAEAAAAAAAAAAAD4AQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAPwBAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB4AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA8AEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA8AAAAAAAAAAAAAAAAADgAwAAAAAAAAAAAAAAAAAAAAA8AAAAAAAAAAAAAAAAQPAHGPgAAAAAAAAAAAAAAAAAgB8AAAAAAAAAAAD4AwD///////8AAAAAAAAAAAAAAACAPwAAAAAAAAAAwP//j////////38AAAAAAAAAAAAAAPwfAAAAAAAAPOD//////////////w8AAAAAAAAAAAAA/B8AAAAA/////////////////////wMAAAAAAADA/wH/PwAAAPD/////////////////////DwAAAAD2/87///8fAAAA/P////////////////////8PAAAA/////////38AAID//////////////////////wAAAPj//////////wcA+P////////////////////9/AAP8/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////w==" };
