import { describe, it } from 'vitest';
import { paintTerrain as pB, buildGrid as bB, TERRAIN_CONFIG_DEFAULTS as CB } from '../src/lib/terrainRender';
import { TERRAIN_LIGHT as LB } from '../src/lib/terrain';
import { paintTerrain as pM, buildGrid as bM, TERRAIN_CONFIG_DEFAULTS as CM } from './_mainref/terrainRender';
import { TERRAIN_LIGHT as LM } from './_mainref/terrain';
import { paintTerrain as pE, buildGrid as bE, TERRAIN_CONFIG_DEFAULTS as CE } from './_e8ref/terrainRender';
import { TERRAIN_LIGHT as LE } from './_e8ref/terrain';

function mock() {
  const recs: any[] = [];
  let pend = 0;
  const ctx: any = { beginPath(){}, arc(_x:number,_y:number,r:number){pend=r;},
    set fillStyle(v:string){ const m=/rgba\((\d+),(\d+),(\d+),([\d.]+)\)/.exec(v)!;
      const lin=(c:number)=>{const s=c/255;return s<=0.04045?s/12.92:Math.pow((s+0.055)/1.055,2.4);};
      const lum=0.2126*lin(+m[1])+0.7152*lin(+m[2])+0.0722*lin(+m[3]);
      recs.push({r:pend,a:+m[4],lum}); }, fill(){} };
  return { ctx, recs };
}
function m(kind:'main'|'branch'|'e8', ds:number, W=1440*2, H=900*2, DPR=2) {
  const { ctx, recs } = mock();
  if (kind==='main'){ const cfg:any={...CM,ramp:LM,darkness:0,dotScale:ds}; pM(ctx,bM(cfg.edlParams),cfg,W,H,DPR,0,0); }
  else if (kind==='e8'){ const cfg:any={...CE,ramp:LE,darkness:0,dotScale:ds}; pE(ctx,bE(cfg.edlParams),cfg,W,H,DPR,0,0); }
  else { const cfg:any={...CB,ramp:LB,darkness:0,dotScale:ds,starfield:false}; pB(ctx,bB(cfg.edlParams),cfg,W,H,DPR,0,0); }
  const ink = recs.reduce((s,d)=>s+d.a*d.r*d.r,0);
  // area-weighted mean-luminance shift over hero: sum(a*pi*r^2*(lum - paperLum))/heroArea
  const paper = 0.875;
  const dl = recs.reduce((s,d)=>s+d.a*Math.PI*d.r*d.r*(d.lum-paper),0)/(W*H);
  return { ink, dl };
}
describe('verify', () => {
  it('run', () => {
    const M = m('main',1.15), E = m('e8',1.08), B = m('branch',1.08);
    console.log('main ink',M.ink.toFixed(1),'dL',M.dl.toFixed(5));
    console.log('e8(comment-time) ds1.08 ink',E.ink.toFixed(1),'ratio',(E.ink/M.ink).toFixed(4),'dL',E.dl.toFixed(5));
    console.log('branch(head) ds1.08 ink',B.ink.toFixed(1),'ratio',(B.ink/M.ink).toFixed(4),'dL',B.dl.toFixed(5));
    for (const ds of [1.00,1.02,1.05,1.08]) {
      const e = m('e8',ds); console.log('  e8 ds',ds,'ratio',(e.ink/M.ink).toFixed(4));
    }
  });
});
