const SQ = Math.sqrt(3)/2, i3 = 1/Math.sqrt(3);
const SIMPLEX=[{x:0,y:0},{x:1,y:0},{x:0.5,y:SQ}];
const toPlane=w=>({x:w[1]+0.5*w[2], y:w[2]*SQ});
const toW=p=>{const w3=p.y/SQ; const w2=p.x-0.5*w3; return [1-w2-w3,w2,w3];};
const hp=c=>{const[a1,a2,a3]=c.a;return{nx:-a1+a2,ny:-a1*i3-a2*i3+a3*2*i3,cc:c.b-a1};};
const slack=(p,c)=>{const h=hp(c);return h.nx*p.x+h.ny*p.y-h.cc;};
function dedupe(poly){const out=[];for(const p of poly){const l=out[out.length-1];if(!l||Math.hypot(l.x-p.x,l.y-p.y)>1e-9)out.push(p);}if(out.length>1){const f=out[0],l=out[out.length-1];if(Math.hypot(f.x-l.x,f.y-l.y)<1e-9)out.pop();}return out;}
function clip(poly,c){if(!poly.length)return[];const out=[];for(let i=0;i<poly.length;i++){const cur=poly[i],nx=poly[(i+1)%poly.length];const sc=slack(cur,c),sn=slack(nx,c);const ic=sc<=1e-12,inx=sn<=1e-12;if(ic)out.push(cur);if(ic!==inx){const t=sc/(sc-sn);out.push({x:cur.x+(nx.x-cur.x)*t,y:cur.y+(nx.y-cur.y)*t});}}return dedupe(out);}
const area=p=>{if(p.length<3)return 0;let s=0;for(let i=0;i<p.length;i++){const a=p[i],b=p[(i+1)%p.length];s+=a.x*b.y-b.x*a.y;}return Math.abs(s)/2;};
const cent=p=>{let x=0,y=0;for(const q of p){x+=q.x;y+=q.y;}return{x:x/p.length,y:y/p.length};};
function cutLine(c){const h=hp(c);const pts=[];for(let i=0;i<3;i++){const a=SIMPLEX[i],b=SIMPLEX[(i+1)%3];const sa=h.nx*a.x+h.ny*a.y-h.cc,sb=h.nx*b.x+h.ny*b.y-h.cc;if((sa<=0&&sb>0)||(sa>0&&sb<=0)){const t=sa/(sa-sb);pts.push({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});}}return pts.length>=2?[pts[0],pts[1]]:null;}
const turnover=(a,b)=>a.reduce((s,v,i)=>s+Math.abs(v-b[i]),0)/2;
function inside(p,poly){if(poly.length<3)return false;const s=poly.map((a,i)=>{const b=poly[(i+1)%poly.length];return Math.sign((b.x-a.x)*(p.y-a.y)-(b.y-a.y)*(p.x-a.x));});return s.every(v=>v>=-1e-12)||s.every(v=>v<=1e-12);}
function project(p,poly){
  if(inside(p,poly)) return {p:{...p},d:0,inside:true};
  let best=null;
  for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length];
    const dx=b.x-a.x,dy=b.y-a.y,L=dx*dx+dy*dy;
    let t=L>0?((p.x-a.x)*dx+(p.y-a.y)*dy)/L:0;t=Math.max(0,Math.min(1,t));
    const q={x:a.x+t*dx,y:a.y+t*dy},d=Math.hypot(q.x-p.x,q.y-p.y);
    if(!best||d<best.d)best={p:q,d};}
  return {...best,inside:false};
}
function bruteMinTurn(w0,poly,N=1200){let best=Infinity,bw=null;
  for(let i=0;i<=N;i++)for(let j=0;j<=N-i;j++){const w=[i/N,j/N,(N-i-j)/N];
    if(!inside(toPlane(w),poly))continue;const f=turnover(w,w0);if(f<best-1e-15){best=f;bw=w;}}
  return {f:best,w:bw};}

const whole=area(SIMPLEX);
const YOURS=[0.60,0.25,0.15];
const RUNGS=[
 {who:'Your money', size:8000, clauses:[]},
 {who:"Your friends' money", size:250000, clauses:[{t:'not more than half in the chipmaker', a:[1,0,0], b:0.50}]},
 {who:'A small fund', size:40e6, clauses:[
   {t:'no more than 40% in the chipmaker', a:[1,0,0], b:0.40},
   {t:'at least 20% in gold at all times', a:[0,0,-1], b:-0.20}]},
 {who:"A teachers' pension", size:1e9, clauses:[
   {t:'no more than 25% in the chipmaker', a:[1,0,0], b:0.25},
   {t:'no more than 25% in financials', a:[0,1,0], b:0.25}]},
];

let poly=[...SIMPLEX];
const yp=toPlane(YOURS);
const rows=[];
const detail=[];
RUNGS.forEach((R,i)=>{
  const before=poly;
  const slabs=[];
  for(const c of R.clauses){
    const b2=poly;
    const flipped={a:c.a.map(v=>-v),b:-c.b};
    const slab=clip(b2,flipped);
    poly=clip(b2,c);
    slabs.push({t:c.t,cut:area(slab)/whole,slabVerts:slab.length,line:cutLine(c)!==null,
      partition:Math.abs((area(slab)+area(poly))-area(b2))});
    detail.push(`  r${i} "${c.t}": cuts ${(area(slab)/whole*100).toFixed(2)}%  left ${(area(poly)/whole*100).toFixed(2)}%  slabVerts ${slab.length}  drawable ${cutLine(c)!==null}  partitionErr ${Math.abs((area(slab)+area(poly))-area(b2)).toExponential(1)}`);
  }
  const pr=project(yp,poly);
  const w=toW(pr.p);
  const t=turnover(w,YOURS);
  const bm=bruteMinTurn(YOURS,poly,900);
  rows.push({rung:i, who:R.who, size:R.size,
    clausesCum:RUNGS.slice(0,i+1).reduce((s,r)=>s+r.clauses.length,0),
    legalPct:+(area(poly)/whole*100).toFixed(4),
    rungCutPct:+((area(before)-area(poly))/whole*100).toFixed(2),
    verts:poly.length, yourBookLegal:pr.inside,
    projection:w.map(v=>+(v*100).toFixed(4)).join(' / '),
    turnoverPP:+(t*100).toFixed(4),
    bruteMinPP:+(bm.f*100).toFixed(4),
    projIsMinTurnover: Math.abs(t-bm.f)<5e-4,
    chipSoldPP:+((YOURS[0]-w[0])*100).toFixed(4),
    forcedUSD:Math.round(t*R.size),
    chipUSD:Math.round((YOURS[0]-w[0])*R.size),
    centroid:toW(cent(poly)).map(v=>+(v*100).toFixed(1)).join('/')});
});
console.table(rows);
console.log(detail.join('\n'));
console.log('\nlegal series:', rows.map(r=>r.legalPct).join(' -> '));
console.log('$350,000,000 / $8,000 =', 350e6/8000);
console.log('final polygon vertices as weights:');
for(const p of poly) console.log('  ', toW(p).map(v=>(v*100).toFixed(1)).join(' / '));
console.log('final centroid weights:', toW(cent(poly)).map(v=>(v*100).toFixed(1)).join(' / '));
// sanity: is every rung polygon nonempty & nested?
let prev=null; let nested=true;
let q=[...SIMPLEX];
RUNGS.forEach((R)=>{for(const c of R.clauses)q=clip(q,c);
  if(prev!==null && area(q)>prev+1e-12) nested=false; prev=area(q);});
console.log('nested (monotone shrinking):', nested);
