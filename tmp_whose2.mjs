const SQ = Math.sqrt(3)/2;
const SIMPLEX=[{x:0,y:0},{x:1,y:0},{x:0.5,y:SQ}];
const toPlane=w=>({x:w[1]+0.5*w[2], y:w[2]*SQ});
const toW=p=>{const w3=p.y/SQ; const w2=p.x-0.5*w3; return [1-w2-w3,w2,w3];};
const hp=c=>{const[a1,a2,a3]=c.a;const i=1/Math.sqrt(3);return{nx:-a1+a2,ny:-a1*i-a2*i+a3*2*i,cc:c.b-a1};};
const slack=(p,c)=>{const h=hp(c);return h.nx*p.x+h.ny*p.y-h.cc;};
function dedupe(poly){const out=[];for(const p of poly){const l=out[out.length-1];if(!l||Math.hypot(l.x-p.x,l.y-p.y)>1e-9)out.push(p);}if(out.length>1){const f=out[0],l=out[out.length-1];if(Math.hypot(f.x-l.x,f.y-l.y)<1e-9)out.pop();}return out;}
function clip(poly,c){if(!poly.length)return[];const out=[];for(let i=0;i<poly.length;i++){const cur=poly[i],nx=poly[(i+1)%poly.length];const sc=slack(cur,c),sn=slack(nx,c);const ic=sc<=1e-12,inx=sn<=1e-12;if(ic)out.push(cur);if(ic!==inx){const t=sc/(sc-sn);out.push({x:cur.x+(nx.x-cur.x)*t,y:cur.y+(nx.y-cur.y)*t});}}return dedupe(out);}
const area=p=>{if(p.length<3)return 0;let s=0;for(let i=0;i<p.length;i++){const a=p[i],b=p[(i+1)%p.length];s+=a.x*b.y-b.x*a.y;}return Math.abs(s)/2;};
const cent=p=>{let x=0,y=0;for(const q of p){x+=q.x;y+=q.y;}return{x:x/p.length,y:y/p.length};};
function nearest(p,poly){
  const signs=[];
  for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length];
    signs.push(Math.sign((b.x-a.x)*(p.y-a.y)-(b.y-a.y)*(p.x-a.x)));}
  if(signs.every(s=>s>=0)||signs.every(s=>s<=0)) return {p:{...p},d:0,inside:true};
  let best=null;
  for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length];
    const dx=b.x-a.x,dy=b.y-a.y; const L=dx*dx+dy*dy;
    let t = L>0 ? ((p.x-a.x)*dx+(p.y-a.y)*dy)/L : 0; t=Math.max(0,Math.min(1,t));
    const q={x:a.x+t*dx,y:a.y+t*dy}; const d=Math.hypot(q.x-p.x,q.y-p.y);
    if(!best||d<best.d)best={p:q,d};}
  return {...best,inside:false};
}
const CAP = 0.08/0.35;
const RULES=[
 {id:1,rung:1,n:'Nothing more than half in one name', a:[1,0,0], b:0.50},
 {id:2,rung:2,n:`No name above ${(CAP*100).toFixed(0)}%`, a:[1,0,0], b:CAP},
 {id:3,rung:2,n:'Risk budget', a:[0.55,0.30,0.08], b:0.30},
 {id:4,rung:3,n:'At least 32% in gold', a:[0,0,-1], b:-0.32},
 {id:5,rung:3,n:'No more than 30% in the bank', a:[0,1,0], b:0.30},
];
const whole=area(SIMPLEX);
const YOURS=[0.45,0.20,0.35];
const yp=toPlane(YOURS);
let poly=[...SIMPLEX];
const rows=[];
for(const c of RULES){
  const before=poly;
  const after=clip(before,c);
  const slab=clip(before,{...c,a:c.a.map(v=>-v),b:-c.b});
  poly=after;
  const nb=nearest(yp,before), na=nearest(yp,after);
  const wn=toW(na.p);
  rows.push({id:c.id,rung:c.rung,n:c.n,
    left:+(area(after)/whole*100).toFixed(2), cut:+(area(slab)/whole*100).toFixed(2),
    verts:after.length, yoursLegal:na.inside,
    near:wn.map(v=>(v*100).toFixed(1)).join('/'),
    turn:+(wn.reduce((s,w,k)=>s+Math.abs(w-YOURS[k]),0)/2*100).toFixed(1)});
}
console.table(rows);
// per-rung cumulative
let p2=[...SIMPLEX]; const rungRows=[{rung:0,label:'your money',legal:100,rules:0,yoursLegal:true,near:'45.0/20.0/35.0',turn:0}];
for(const r of [1,2,3]){
  for(const c of RULES.filter(c=>c.rung===r)) p2=clip(p2,c);
  const n=nearest(yp,p2); const w=toW(n.p);
  rungRows.push({rung:r,legal:+(area(p2)/whole*100).toFixed(2),rules:RULES.filter(c=>c.rung<=r).length,
    verts:p2.length, yoursLegal:n.inside, near:w.map(v=>(v*100).toFixed(1)).join('/'),
    turn:+(w.reduce((s,ww,k)=>s+Math.abs(ww-YOURS[k]),0)/2*100).toFixed(1),
    centroid: toW(cent(p2)).map(v=>(v*100).toFixed(1)).join('/')});
}
console.table(rungRows);
console.log('risk budget at yours =', (0.55*0.45+0.30*0.20+0.08*0.35).toFixed(4));
