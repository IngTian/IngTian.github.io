// Measure the Rules slide's real box budget at three viewports, and shoot each beat.
import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9401;
const OUT = new URL('.', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

const chrome = spawn(CHROME, [
  `--remote-debugging-port=${PORT}`,
  '--headless=new',
  '--window-size=1700,1050',
  '--user-data-dir=/tmp/cdp-stack-profile',
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
const ev = async (expr) => {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
  if (r?.exceptionDetails) return 'ERR ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text);
  return r?.result?.value;
};
async function shot(name) {
  const r = await send('Page.captureScreenshot', { format: 'png' });
  if (r?.data) writeFileSync(OUT + name, Buffer.from(r.data, 'base64'));
}

const script = `
(function(){
  var r = function(s){ var el = document.querySelector(s); if(!el) return null; var b = el.getBoundingClientRect();
    return { w: Math.round(b.width), h: Math.round(b.height), x: Math.round(b.x), y: Math.round(b.y) }; };
  var cs = function(s, p){ var el = document.querySelector(s); return el ? getComputedStyle(el)[p] : null; };
  var panels = {};
  document.querySelectorAll('#rules .ru-stagebox > [data-panel]').forEach(function(p){
    var kids = Array.from(p.children).map(function(k){ return Math.round(k.getBoundingClientRect().height); });
    panels['p'+p.dataset.panel] = { own: Math.round(p.getBoundingClientRect().height), kids: kids,
      kidSum: kids.reduce(function(a,b){return a+b;},0), scroll: p.scrollHeight };
  });
  return JSON.stringify({
    vp: [window.innerWidth, window.innerHeight],
    section: r('#rules'), paper: r('.ru-paper'), inner: r('.ru-inner'),
    kicker: r('.ru-kicker'), split: r('.ru-split'),
    say: r('.ru-say'), head: r('.ru-head'), beats: r('.ru-beats'), scale: r('.ru-scale'),
    fig: r('.ru-fig'), figHead: r('.ru-fig-head'), stagebox: r('.ru-stagebox'), cap: r('.ru-cap'),
    fanchart: r('.ru-fanchart'),
    fs: { beatHead: cs('.ru-beat-head','fontSize'), beatBody: cs('.ru-beat-body','fontSize'),
          head: cs('.ru-head','fontSize'), scale: cs('.ru-scale','fontSize'),
          catRule: cs('.ru-cat-rule','fontSize'), catWhy: cs('.ru-cat-why','fontSize'),
          note: cs('.ru-note','fontSize'), cap: cs('.ru-cap','fontSize'),
          rungLabel: cs('.ru-rung-label','fontSize'), tallyBig: cs('.ru-tally--big .ru-tally-n','fontSize'),
          kicker: cs('.ru-kicker','fontSize') },
    paperPad: cs('.ru-paper','paddingTop'), innerPadL: cs('.ru-inner','paddingLeft'),
    panels: panels,
    railRight: (function(){ var t=document.querySelector('.toc'); return t? Math.round(t.getBoundingClientRect().right):null; })()
  }, null, 1);
})()`;

const VIEWS = [[1700, 1050], [1366, 768], [900, 1050]];
for (const [w, h] of VIEWS) {
  await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: 'http://localhost:4411/' });
  await sleep(3000);
  await ev(`document.getElementById('rules').scrollIntoView({block:'start'}); 1`);
  await sleep(900);
  console.log(`\n===== ${w}x${h} =====`);
  console.log(await ev(script));
  for (let b = 0; b < 4; b++) {
    await ev(`document.querySelectorAll('#rules [data-beat]')[${b}].click(); 1`);
    await sleep(650);
    await shot(`cur-${w}x${h}-b${b}.png`);
  }
}
ws.close(); chrome.kill(); process.exit(0);
