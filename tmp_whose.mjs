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
function cutLine(c){const h=hp(c);const pts=[];for(let i=0;i<3;i++){const a=SIMPLEX[i],b=SIMPLEX[(i+1)%3];const sa=h.nx*a.x+h.ny*a.y-h.cc,sb=h.nx*b.x+h.ny*b.y-h.cc;if((sa<=0&&sb>0)||(sa>0&&sb<=0)){const t=sa/(sa-sb);pts.push({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});}}return pts.length>=2?[pts[0],pts[1]]:null;}
function nearest(p,poly){
  const signs=[];
  for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length];
    signs.push(Math.sign((b.x-a.x)*(p.y-a.y)-(b.y-a.y)*(p.x-a.x)));}
  const pos=signs.every(s=>s>=0), neg=signs.every(s=>s<=0);
  if(pos||neg) return {p:{...p},d:0,inside:true};
  let best=null;
  for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length];
    const dx=b.x-a.x,dy=b.y-a.y; const L=dx*dx+dy*dy;
    let t = L>0 ? ((p.x-a.x)*dx+(p.y-a.y)*dy)/L : 0; t=Math.max(0,Math.min(1,t));
    const q={x:a.x+t*dx,y:a.y+t*dy}; const d=Math.hypot(q.x-p.x,q.y-p.y);
    if(!best||d<best.d)best={p:q,d};}
  return {...best,inside:false};
}
const CAP = 0.08/0.35;
const C=[
 {n:'half in one name', a:[1,0,0], b:0.50, rung:2},
 {n:'single name cap 23%', a:[1,0,0], b:CAP, rung:3},
 {n:'risk budget', a:[0.55,0.30,0.08], b:0.30, rung:3},
 {n:'gold floor 20%', a:[0,0,-1], b:-0.20, rung:4},
 {n:'financials cap 35%', a:[0,1,0], b:0.35, rung:4},
 {n:'turnover band NVDA>=12%', a:[-1,0,0], b:-0.12, rung:4},
];
const whole=area(SIMPLEX);
let poly=[...SIMPLEX];
console.log('CAP =', CAP.toFixed(5), '->', (CAP*100).toFixed(1)+'%');
const YOURS=[0.55,0.20,0.25];
const yp=toPlane(YOURS);
const rows=[];
C.forEach((c,i)=>{
  const before=poly;
  const after=clip(before,c);
  const slab=clip(before,{...c,a:c.a.map(v=>-v),b:-c.b});
  poly=after;
  const n=nearest(yp,after);
  const wn=toW(n.p);
  const turn = wn.reduce((s,w,k)=>s+Math.abs(w-YOURS[k]),0)/2;
  rows.push({i:i+1,name:c.n,rung:c.rung,
    left:+(area(after)/whole*100).toFixed(2),
    cut:+(area(slab)/whole*100).toFixed(2),
    verts:after.length, line:!!cutLine(c),
    yoursLegal:n.inside, near:wn.map(v=>(v*100).toFixed(1)).join('/'), turn:+(turn*100).toFixed(1)});
});
console.table(rows);
const rungAreas={1:100};
let p2=[...SIMPLEX];
for(const r of [2,3,4]){ for(const c of C.filter(c=>c.rung===r)) p2=clip(p2,c); rungAreas[r]=+(area(p2)/whole*100).toFixed(2); }
console.log('rung legal %:', rungAreas);
console.log('final poly verts', p2.length, 'centroid weights', toW(cent(p2)).map(v=>(v*100).toFixed(1)).join('/'));
const fin=nearest(yp,p2); const fw=toW(fin.p);
console.log('nearest legal to yours:', fw.map(v=>(v*100).toFixed(1)).join('/'), 'turnover', (fw.reduce((s,w,k)=>s+Math.abs(w-YOURS[k]),0)/2*100).toFixed(1)+'%');
