import http from 'node:http';
function get(p){return new Promise((res,rej)=>{http.get({host:'127.0.0.1',port:9222,path:p},r=>{let b='';r.on('data',d=>b+=d);r.on('end',()=>res(JSON.parse(b)));}).on('error',rej);});}
const page=(await get('/json/list')).find(t=>t.type==='page');
const ws=new WebSocket(page.webSocketDebuggerUrl);
let id=0;const pending=new Map();const trace=[];
ws.addEventListener('message',e=>{const m=JSON.parse(e.data);
 if(m.id&&pending.has(m.id)){pending.get(m.id)(m);pending.delete(m.id);}
 else if(m.method==='Tracing.dataCollected')trace.push(...m.params.value);
 else if(m.method==='Tracing.tracingComplete')trace.push({__done:1});});
await new Promise(r=>ws.addEventListener('open',r));
const send=(m,p={})=>{const i=++id;return new Promise(res=>{pending.set(i,res);ws.send(JSON.stringify({id:i,method:m,params:p}));});};
await send('Page.enable');

for (const [label,file] of [['direct+var probe','test12.html']]) {
  await send('Page.navigate',{url:'file://'+process.cwd()+'/'+file});
  await new Promise(r=>setTimeout(r,1500));
  trace.length=0;
  await send('Tracing.start',{categories:'devtools.timeline,blink.animations,cc,disabled-by-default-blink.debug',transferMode:'ReportEvents'});
  await new Promise(r=>setTimeout(r,2500));
  await send('Tracing.end');
  await new Promise(r=>{const t=setInterval(()=>{if(trace.some(e=>e.__done)){clearInterval(t);r();}},100);});
  const c={};for(const e of trace){if(e.name)c[e.name]=(c[e.name]||0)+1;}
  console.log('===',label,'===');
  for(const k of ['Paint','UpdateLayoutTree','RecalcStyle','Layout','Commit','DrawFrame','RasterTask','Animation','CompositorAnimation'])
    if(c[k])console.log('  ',String(c[k]).padStart(5),k);
  const anim=Object.keys(c).filter(k=>/nimation|ompositor/i.test(k));
  console.log('   animation-ish events:',anim.map(k=>k+'='+c[k]).join(', ')||'(none)');
}
ws.close();
