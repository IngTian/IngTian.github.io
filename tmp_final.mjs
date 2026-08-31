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
// EUCLIDEAN projection of p onto convex polygon (unique). Plane distance = weight-space distance / sqrt2.
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
const whole=area(SIMPLEX);
const YOURS=[0.60,0.25,0.15];
const SIZES=[8000,250000,40e6,1e9];
const capN=b=>({a:[1,0,0],b}), capB=b=>({a:[0,1,0],b}), floorG=b=>({a:[0,0,-1],b:-b}),
      risk=b=>({a:[0.55,0.30,0.08],b}), floorN=b=>({a:[-1,0,0],b:-b});

function run(name, rungs){
  console.log('\n===== '+name);
  let poly=[...SIMPLEX];
  const rows=[];const detail=[];
  rungs.forEach((R,i)=>{
    const before=poly;
    for(const r of R){const b2=poly;for(const h of r.hs)poly=clip(poly,h);
      detail.push(`  r${i} ${r.label}: -${(((area(b2)-area(poly))/whole)*100).toFixed(2)}%  lines ${r.hs.map(h=>!!cutLine(h)).join(',')}`);}
    const yp=toPlane(YOURS); const pr=project(yp,poly); const w=toW(pr.p);
    const t=turnover(w,YOURS);
    rows.push({rung:i, legal:+(area(poly)/whole*100).toFixed(2), cut:+((area(before)-area(poly))/whole*100).toFixed(2),
      verts:poly.length, ok:pr.inside,
      closest:w.map(v=>(v*100).toFixed(1)).join('/'),
      trade:w.map((v,k)=>((v-YOURS[k])>=0?'+':'')+((v-YOURS[k])*100).toFixed(1)).join('/'),
      turnPP:+(t*100).toFixed(2), dollars:Math.round(t*SIZES[i]),
      centroid:toW(cent(poly)).map(v=>(v*100).toFixed(1)).join('/')});
  });
  console.table(rows); console.log(detail.join('\n'));
}

run('A  g>=20 | n<=40,b<=35 | n<=25,risk<=.26', [
  [],
  [{label:'at least 20% in gold', hs:[floorG(0.20)]}],
  [{label:'no name above 40%', hs:[capN(0.40)]},{label:'no more than 35% in the bank', hs:[capB(0.35)]}],
  [{label:'no name above 25%', hs:[capN(0.25)]},{label:'risk budget 26', hs:[risk(0.26)]}],
]);

run('B  g>=20 | n<=40,b<=35 | n<=25,g>=40', [
  [],
  [{label:'at least 20% in gold', hs:[floorG(0.20)]}],
  [{label:'no name above 40%', hs:[capN(0.40)]},{label:'no more than 35% in the bank', hs:[capB(0.35)]}],
  [{label:'no name above 25%', hs:[capN(0.25)]},{label:'at least 40% in gold', hs:[floorG(0.40)]}],
]);

run('C  g>=20 | n<=40,risk<=.34 | n<=25,b<=30,g>=35', [
  [],
  [{label:'at least 20% in gold', hs:[floorG(0.20)]}],
  [{label:'no name above 40%', hs:[capN(0.40)]},{label:'risk budget 34', hs:[risk(0.34)]}],
  [{label:'no name above 25%', hs:[capN(0.25)]},{label:'no more than 30% in the bank', hs:[capB(0.30)]},{label:'at least 35% in gold', hs:[floorG(0.35)]}],
]);

run('D  g>=15 | n<=40,b<=35 | n<=25,risk<=.24', [
  [],
  [{label:'at least 15% in gold', hs:[floorG(0.15)]}],
  [{label:'no name above 40%', hs:[capN(0.40)]},{label:'no more than 35% in the bank', hs:[capB(0.35)]}],
  [{label:'no name above 25%', hs:[capN(0.25)]},{label:'risk budget 24', hs:[risk(0.24)]}],
]);
