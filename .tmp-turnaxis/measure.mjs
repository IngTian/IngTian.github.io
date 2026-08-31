// Measure the Rules slide's real part heights at the three target viewports.
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9401;
const OUT = new URL('.', import.meta.url).pathname;

const chrome = spawn(CHROME, [
  `--remote-debugging-port=${PORT}`,
  '--headless=new',
  '--window-size=1700,1050',
  '--user-data-dir=/tmp/cdp-turnaxis-profile',
  '--no-first-run',
  'about:blank',
], { stdio: 'ignore' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
await sleep(2500);

const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
const target = list.find((t) => t.type === 'page');
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => { ws.onopen = r; });
let id = 0;
const pending = new Map();
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
};
const send = (method, params = {}) => new Promise((res) => {
  const myId = ++id;
  pending.set(myId, (m) => res(m.result ?? m.error));
  ws.send(JSON.stringify({ id: myId, method, params }));
});
await send('Page.enable');
await send('Runtime.enable');
const evaluate = async (expr) => {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
  if (r?.exceptionDetails) return { err: r.exceptionDetails.text + ' ' + (r.exceptionDetails.exception?.description ?? '') };
  return r?.result?.value;
};
async function shot(name) {
  const r = await send('Page.captureScreenshot', { format: 'png' });
  if (r?.data) writeFileSync(OUT + name, Buffer.from(r.data, 'base64'));
}

const PROBE = `(() => {
  const sec = document.getElementById('rules');
  const q = (s) => sec.querySelector(s);
  const box = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height), x: Math.round(r.left), y: Math.round(r.top) }; };
  const cs = (el, p) => el ? getComputedStyle(el)[p] : null;
  const panels = Array.from(sec.querySelectorAll('[data-panel]')).map((p) => ({
    i: p.dataset.panel, box: box(p), scrollH: p.scrollHeight,
    kids: Array.from(p.children).map((k) => ({ cls: k.className.toString().slice(0,24), ...box(k), sh: k.scrollHeight })),
  }));
  return {
    vp: [innerWidth, innerHeight],
    section: box(sec), sectionScrollH: sec.scrollHeight,
    paper: box(q('.ru-paper')), paperPad: cs(q('.ru-paper'), 'paddingTop'),
    inner: box(q('.ru-inner')), innerPadL: cs(q('.ru-inner'), 'paddingLeft'),
    kicker: box(q('.ru-kicker')),
    head: box(q('.ru-head')), headFS: cs(q('.ru-head'), 'fontSize'),
    beats: box(q('.ru-beats')),
    beatBoxes: Array.from(sec.querySelectorAll('.ru-beat')).map(box),
    beatHeadFS: cs(q('.ru-beat-head'), 'fontSize'),
    beatBodyFS: cs(q('.ru-beat-body'), 'fontSize'),
    scale: box(q('.ru-scale')), scaleFS: cs(q('.ru-scale'), 'fontSize'),
    say: box(q('.ru-say')), fig: box(q('.ru-fig')),
    figHead: box(q('.ru-fig-head')),
    stage: box(q('.ru-stagebox')),
    fanchart: box(q('.ru-fanchart')),
    cap: box(q('.ru-cap')),
    catsH: box(q('.ru-cats')), rungsH: box(q('.ru-rungs')), tallyH: box(q('.ru-tally')),
    panels,
  };
})()`;

const sizes = [[1700, 1050], [1366, 768], [900, 1050]];
const results = {};
for (const [w, h] of sizes) {
  await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: 'http://localhost:4399/' });
  await sleep(3000);
  await evaluate(`document.getElementById('rules').scrollIntoView({block:'start'}); 1`);
  await sleep(900);
  results[`${w}x${h}`] = await evaluate(PROBE);
  await shot(`cur-${w}x${h}.png`);
}
writeFileSync(OUT + 'measure.json', JSON.stringify(results, null, 1));
console.log(JSON.stringify(results, null, 1));
ws.close();
chrome.kill();
process.exit(0);
