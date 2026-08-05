import { describe, it } from 'vitest';
import { paintTerrain as pB, buildGrid as bB, TERRAIN_CONFIG_DEFAULTS as CB } from '../src/lib/terrainRender';
import { TERRAIN_LIGHT as LB } from '../src/lib/terrain';
import { paintTerrain as pM, buildGrid as bM, TERRAIN_CONFIG_DEFAULTS as CM } from './_mainref/terrainRender';
import { TERRAIN_LIGHT as LM } from './_mainref/terrain';
function rec(){ const dots:any[]=[]; let pend:any={};
  const ctx:any={beginPath(){pend={};},arc(x:number,y:number,r:number){pend={x,y,r};},fill(){dots.push(pend);},
    set fillStyle(v:string){const m=v.match(/[\d.]+/g)!;pend.c=[+m[0],+m[1],+m[2]];pend.a=+m[3];}, get fillStyle(){return '';}};
  return {ctx,dots}; }
const lum=(c:number[])=>{const f=(x:number)=>{x/=255;return x<=0.03928?x/12.92:Math.pow((x+0.055)/1.055,2.4)};return 0.2126*f(c[0])+0.7152*f(c[1])+0.0722*f(c[2])};
describe('light-theme claims', () => {
  it('ink ratio + composited luminance', () => {
    const A=rec(),B=rec();
    pM(B.ctx,bM(CM.edlParams),{...CM,ramp:LM,darkness:0,dotScale:1.15} as any,1440,900,2,1.37,0.06);
    pB(A.ctx,bB(CB.edlParams),{...CB,ramp:LB,darkness:0,dotScale:1.08,starfield:false} as any,1440,900,2,1.37,0.06);
    const ink=(d:any[])=>d.reduce((s,x)=>s+x.a*x.r*x.r,0);
    const iM=ink(B.dots), iB=ink(A.dots);
    console.log(`total ink (sum alpha*r^2): main=${iM.toFixed(1)} branch=${iB.toFixed(1)} ratio=${(iB/iM).toFixed(4)} => ${(((iB/iM)-1)*100).toFixed(1)}%  [comment claims ~+5%]`);
    // mean composited luminance over paper L=0.916 (#f4efe4-ish)
    const paper=[244,239,228];
    const meanL=(d:any[])=>{ let s=0; for(const x of d){ const comp=[0,1,2].map(k=>x.c[k]*x.a+paper[k]*(1-x.a)); s+=lum(comp);} return s/d.length; };
    const lM=meanL(B.dots), lB=meanL(A.dots);
    console.log(`mean composited DOT luminance: main=${lM.toFixed(4)} branch=${lB.toFixed(4)} delta=${(lB-lM).toFixed(4)}`);
    // area-weighted whole-hero mean luminance shift (the "<0.001" claim)
    const W=1440*2,H=900*2, area=W*H;
    const cov=(d:any[])=>d.reduce((s,x)=>s+Math.PI*x.r*x.r*x.a,0)/area;
    const shift=(d:any[])=>{ let acc=0; for(const x of d){ const a=Math.PI*x.r*x.r; acc += a*x.a*(lum(x.c)-lum(paper)); } return acc/area; };
    console.log(`hero mean-luminance shift vs bare paper: main=${shift(B.dots).toFixed(5)} branch=${shift(A.dots).toFixed(5)} | BRANCH-MINUS-MAIN=${(shift(A.dots)-shift(B.dots)).toFixed(5)}  [comment claims "<0.001"]`);
    console.log(`ink coverage fraction: main=${cov(B.dots).toFixed(5)} branch=${cov(A.dots).toFixed(5)}`);
  });
});
