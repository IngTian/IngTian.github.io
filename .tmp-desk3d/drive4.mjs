import http from 'node:http';
function get(p){return new Promise((res,rej)=>{http.get({host:'127.0.0.1',port:9222,path:p},r=>{let b='';r.on('data',d=>b+=d);r.on('end',()=>res(JSON.parse(b)));}).on('error',rej);});}
const page=(await get('/json/list')).find(t=>t.type==='page');
const ws=new WebSocket(page.webSocketDebuggerUrl);
let id=0;const pending=new Map();const events=[];
ws.addEventListener('message',e=>{const m=JSON.parse(e.data);
  if(m.id&&pending.has(m.id)){pending.get(m.id)(m);pending.delete(m.id);}
  else if(m.method==='Tracing.dataCollected') events.push(...m.params.value);
  else if(m.method==='Tracing.tracingComplete') events.push({__done:true});
});
await new Promise(r=>ws.addEventListener('open',r));
const send=(m,p={})=>{const i=++id;return new Promise(res=>{pending.set(i,res);ws.send(JSON.stringify({id:i,method:m,params:p}));});};

const base='file://'+process.cwd()+'/fps.html';
await send('Page.enable');
await send('Page.navigate',{url:`${base}?n=14`});
await new Promise(r=>setTimeout(r,2000));

await send('Tracing.start',{categories:'devtools.timeline,disabled-by-default-devtools.timeline.frame,blink,cc',transferMode:'ReportEvents'});
await new Promise(r=>setTimeout(r,3000));
await send('Tracing.end');
await new Promise(r=>{const t=setInterval(()=>{if(events.some(e=>e.__done)){clearInterval(t);r();}},120);});

const counts={};
for(const e of events){ if(e.name) counts[e.name]=(counts[e.name]||0)+1; }
const keys=['Paint','PaintImage','RasterTask','UpdateLayoutTree','Layout','CompositeLayers','DrawFrame','Commit','ParseHTML','FunctionCall','TimerFire','RecalcStyleTime','UpdateLayerTree'];
console.log('--- 3s of the desk camera animation (n=14 cards), event counts ---');
for(const k of keys) if(counts[k]) console.log(String(counts[k]).padStart(6), k);
const total=Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,14);
console.log('--- top events overall ---');
for(const [k,v] of total) console.log(String(v).padStart(6), k);
ws.close();
