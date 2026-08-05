import { describe, it } from 'vitest';
import { paintTerrain as pB, buildGrid as bB, TERRAIN_CONFIG_DEFAULTS as CB } from '../src/lib/terrainRender';
import { TERRAIN_LIGHT as LB } from '../src/lib/terrain';
import { paintTerrain as pM, buildGrid as bM, TERRAIN_CONFIG_DEFAULTS as CM } from './_mainref/terrainRender';
import { TERRAIN_LIGHT as LM } from './_mainref/terrain';

function mk() { const recs:any[]=[]; let pend=0; const ctx:any={beginPath(){},arc(_x:number,_y:number,r:number){pend=r;},
 set fillStyle(v:string){const m=/rgba\((\d+),(\d+),(\d+),([\d.]+)\)/.exec(v)!;const [r,g,b,a]=[+m[1],+m[2],+m[3],+m[4]];
 recs.push({r:pend,a,lin:(0.2126*r+0.7152*g+0.0722*b)/255});},fill(){}}; return {ctx,recs}; }

function meas(which:'main'|'branch', ds:number, wCss:number, hCss:number, DPR:number) {
  const W=Math.round(wCss*DPR), H=Math.round(hCss*DPR); const {ctx,recs}=mk();
  if(which==='main'){const c:any={...CM,ramp:LM,darkness:0,dotScale:ds};pM(ctx,bM(c.edlParams),c,W,H,DPR,0,0);}
  else{const c:any={...CB,ramp:LB,darkness:0,dotScale:ds};pB(ctx,bB(c.edlParams),c,W,H,DPR,0,0);}
  const ink=recs.reduce((s,d)=>s+d.a*d.r*d.r,0);
  const wl=recs.reduce((s,d)=>s+d.a*d.r*d.r*d.lin,0)/ink;
  // frame-mean luminance over paper 0.875, alpha-composited disc area
  const covered=recs.reduce((s,d)=>s+d.a*Math.PI*d.r*d.r,0);
  const darkSum=recs.reduce((s,d)=>s+d.a*Math.PI*d.r*d.r*(0.875-d.lin),0);
  return {n:recs.length,ink,wl,frameDrop:darkSum/(W*H),cov:covered/(W*H)};
}
describe('p2',()=>{it('r',()=>{
 for (const [w,h,dpr] of [[1440,900,2],[1440,900,1],[1920,1080,2],[1280,800,2],[3000,1600,2]] as any) {
   const m=meas('main',1.15,w,h,dpr), b=meas('branch',1.08,w,h,dpr);
   console.log(`${w}x${h}@${dpr}: nM=${m.n} nB=${b.n} ratio=${(b.ink/m.ink).toFixed(4)} lin wLum M=${m.wl.toFixed(4)} B=${b.wl.toFixed(4)} frameDrop M=${m.frameDrop.toFixed(5)} B=${b.frameDrop.toFixed(5)} d=${(b.frameDrop-m.frameDrop).toFixed(5)}`);
 }
 // parity sweep at 1920
 for (const ds of [0.95,0.955,1.05,1.08]) { const m=meas('main',1.15,1920,1080,2), b=meas('branch',ds,1920,1080,2); console.log(`1920 ds=${ds} ratio=${(b.ink/m.ink).toFixed(4)}`);}
});});
