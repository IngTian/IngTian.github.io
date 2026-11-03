// src/data/cowLines.ts
// WHAT THE /projects COW SAYS. Two halves per line, STORED AS PAIRS: the other cows hand whole strings to
// lib/cowSpeech.ts's balanced split, which would move the break in 6 of these 20 and lose the punchline
// ("29 releases. I / have had zero."). These carry their break with them. Copy from the spec; editable.
import type { SpokenLine } from '../lib/cowSpeech';

export const PROJECT_COW_LINES: { hello: SpokenLine[]; idle: SpokenLine[]; byKey: Record<string, SpokenLine[]> } = {
  hello: [['Everything here ships.', "Click one. I'll explain."]],
  idle: [
    ['I hold no view on rates.', 'Still.'],
    ['Past performance is', 'not indicative of grass.'],
    ['Click a project.', 'I know things.'],
    ['Everything here runs.', 'Unlike me.'],
  ],
  // One set per project slug, plus the in-progress card; repeat clicks rotate through a set.
  byKey: {
    'rl-bhrp': [['Rebuilt from the paper alone.', 'Reproduced what it could.'], ["One column doesn't match.", 'It says so. I respect that.']],
    offchart: [['Look-ahead bias?', 'Not in this barn.'], ['CFTC data back to 1986.', 'Older than my grandmoo.']],
    'trading-desk': [["It won't log a trade", 'that contradicts itself.'], ['pip install trading-desk.', 'I would. No thumbs.']],
    // The 29 is witness's hand-maintained release count; tests/cowTalk.test.ts holds the two together.
    witness: [['It remembers what changed,', 'and when, and why.'], ['29 releases.', 'I have had zero.']],
    daylogs: [['It tracks his weight.', 'I do not ask about mine.'], ['Food, typed by hand.', 'Mine is grass. Easy.']],
    manifold: [['The homepage mountain,', 'now on your Mac.'], ['Gradient descent,', 'as a screensaver.']],
    macboot: [['4,700 lines of bash', 'became one good README.'], ['Look before you change anything.', 'Words to live by.']],
    'in-progress': [['Still being built.', 'Like my patience.']],
  },
};
