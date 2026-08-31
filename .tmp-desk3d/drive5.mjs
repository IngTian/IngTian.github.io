import http from 'node:http';
function get(p){return new Promise((res,rej)=>{http.get({host:'127.0.0.1',port:9222,path:p},r=>{let b='';r.on('data',d=>b+=d);r.on('end',()=>res(JSON.parse(b)));}).on('error',rej);});}
const page=(await get('/json/list')).find(t=>t.type==='page');
const ws=new WebSocket(page.webSocketDebuggerUrl);
let id=0;const pending=new Map();
ws.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.id&&pending.has(m.id)){pending.get(m.id)(m);pending.delete(m.id);}});
await new Promise(r=>ws.addEventListener('open',r));
const send=(m,p={})=>{const i=++id;return new Promise(res=>{pending.set(i,res);ws.send(JSON.stringify({id:i,method:m,params:p}));});};

// ── 1. Accessibility tree of the FULL 3D desk (test5.html) ──
await send('Page.enable'); await send('Accessibility.enable');
await send('Page.navigate',{url:'file://'+process.cwd()+'/test5.html'});
await new Promise(r=>setTimeout(r,2500));
const ax=await send('Accessibility.getFullAXTree');
const nodes=ax.result.nodes||[];
const named=nodes.filter(n=>n.name?.value && n.role?.value!=='none' && n.role?.value!=='generic' && !n.ignored);
console.log('=== A11Y TREE of the CSS-3D desk (test5.html) ===');
console.log('total AX nodes:', nodes.length, '| ignored:', nodes.filter(n=>n.ignored).length);
console.log('named, non-generic, non-ignored nodes:', named.length);
for(const n of named.slice(0,26)) console.log('  ', (n.role?.value||'?').padEnd(12), JSON.stringify(String(n.name.value).slice(0,72)));

// ── 2. Does the desk contribute LCP / CLS? ──
await send('Performance.enable');
const m=await send('Runtime.evaluate',{expression:`
 JSON.stringify({
  headings:[...document.querySelectorAll('h1,h2,h3,h4')].length,
  textNodes:document.body.innerText.trim().length,
  scrollH:document.documentElement.scrollHeight
 })`});
console.log('\n=== content census ===\n', m.result.result.value);

// ── 3. the CSS-only journal a11y tree ──
await send('Page.navigate',{url:'file://'+process.cwd()+'/test10.html'});
await new Promise(r=>setTimeout(r,1500));
const ax2=await send('Accessibility.getFullAXTree');
const n2=(ax2.result.nodes||[]);
console.log('\n=== A11Y of the CSS-only radio journal (opacity:0 pages) ===');
console.log('radios exposed:', n2.filter(n=>n.role?.value==='radio').length);
const txt=n2.filter(n=>n.role?.value==='StaticText'&&!n.ignored).map(n=>String(n.name?.value||'').slice(0,44));
console.log('StaticText nodes NOT ignored:', txt.length);
for(const t of txt.slice(0,16)) console.log('   ', JSON.stringify(t));
ws.close();
