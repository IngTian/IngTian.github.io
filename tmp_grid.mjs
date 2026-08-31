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
const whole=area(SIMPLEX);
const YOURS=[0.60,0.25,0.15];
const SIZES=[8000,250000,40e6,1e9];
const capN=b=>({a:[1,0,0],b}), capB=b=>({a:[0,1,0],b}), floorG=b=>({a:[0,0,-1],b:-b}),
      risk=b=>({a:[0.55,0.30,0.08],b});

const results=[];
for(const g1 of [0.15,0.18,0.20,0.22,0.25]){
 for(const n2 of [0.35,0.38,0.40,0.42,0.45]){
  for(const b2 of [0.30,0.32,0.35,0.38,0.40]){
   for(const n3 of [0.20,0.22,0.25]){
    for(const r3 of [0.20,0.22,0.24,0.26,0.28]){
     const rungs=[[],[{l:'safe floor',hs:[floorG(g1)]}],
       [{l:'name cap',hs:[capN(n2)]},{l:'bank cap',hs:[capB(b2)]}],
       [{l:'tighter cap',hs:[capN(n3)]},{l:'risk budget',hs:[risk(r3)]}]];
     let poly=[...SIMPLEX]; const legal=[100]; const bites=[]; const turns=[0]; let ok=true; let verts=[];
     for(let i=1;i<4;i++){
       for(const r of rungs[i]){const b=poly;for(const h of r.hs)poly=clip(poly,h);
         bites.push({r:i,l:r.l,cut:(area(b)-area(poly))/whole});}
       if(poly.length<3){ok=false;break;}
       legal.push(area(poly)/whole*100); verts.push(poly.length);
       const pr=project(toPlane(YOURS),poly); turns.push(turnover(toW(pr.p),YOURS)*100);
     }
     if(!ok) continue;
     const minBite=Math.min(...bites.map(b=>b.cut))*100;
     // want: legal ~ [100, 60-70, 25-35, 10-18]; each bite >= 4%; turnover strictly increasing and rung1 small
     if(minBite < 4) continue;
     if(!(legal[1]>=58&&legal[1]<=72)) continue;
     if(!(legal[2]>=24&&legal[2]<=36)) continue;
     if(!(legal[3]>=9&&legal[3]<=18)) continue;
     if(!(turns[1]>0.5&&turns[1]<9)) continue;
     if(!(turns[2]>turns[1]+6)) continue;
     if(!(turns[3]>turns[2]+8)) continue;
     const pr=project(toPlane(YOURS),poly); const fw=toW(pr.p); const cg=toW(cent(poly));
     results.push({g1,n2,b2,n3,r3,legal:legal.map(v=>+v.toFixed(1)).join('/'),
       minBite:+minBite.toFixed(2), turns:turns.map(v=>+v.toFixed(1)).join('/'),
       dollars:turns.map((t,i)=>Math.round(t/100*SIZES[i])).join('/'),
       finalVerts:poly.length, closest:fw.map(v=>(v*100).toFixed(1)).join('/'),
       cg:cg.map(v=>(v*100).toFixed(1)).join('/'),
       bites:bites.map(b=>b.cut*100|0).join(',')});
    }}}}}
results.sort((a,b)=>b.minBite-a.minBite);
console.log('candidates:',results.length);
console.table(results.slice(0,25));
