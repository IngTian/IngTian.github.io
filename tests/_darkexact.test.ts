import { describe, it, expect } from 'vitest';
import { paintTerrain as pB, buildGrid as bB, TERRAIN_CONFIG_DEFAULTS as CB } from '../src/lib/terrainRender';
import { TERRAIN_TERMINAL as TB } from '../src/lib/terrain';
import { paintTerrain as pM, buildGrid as bM, TERRAIN_CONFIG_DEFAULTS as CM } from './_mainref/terrainRender';
import { TERRAIN_TERMINAL as TM } from './_mainref/terrain';

function rec() {
  const calls: string[] = [];
  const ctx: any = { beginPath(){}, arc(x:number,y:number,r:number){calls.push('arc '+x.toFixed(6)+' '+y.toFixed(6)+' '+r.toFixed(9));}, fill(){}, set fillStyle(v:string){calls.push('fill '+v);}, get fillStyle(){return '';} };
  return { ctx, calls };
}
describe('dark theme bit-for-bit', () => {
  it('starfield OFF: dark output identical to main', () => {
    const gB=bB(CB.edlParams), gM=bM(CM.edlParams);
    for (const t of [0, 1.37, 5.5]) {
      const A=rec(), B=rec();
      pM(B.ctx, gM, {...CM, ramp:TM, darkness:1, dotScale:1.18} as any, 1440, 900, 2, t, 0.06);
      pB(A.ctx, gB, {...CB, ramp:TB, darkness:1, dotScale:1.18, starfield:false} as any, 1440, 900, 2, t, 0.06);
      expect(A.calls.length).toBe(B.calls.length);
      const diffs = A.calls.filter((c,i)=>c!==B.calls[i]);
      if (diffs.length) console.log('t='+t+' first diffs:', diffs.slice(0,4), 'vs', diffs.slice(0,4).map((_,i)=>B.calls[A.calls.indexOf(diffs[i])]));
      console.log('t='+t+' dark starfield=false: '+A.calls.length+' calls, '+diffs.length+' differ');
      expect(diffs.length).toBe(0);
    }
  });
  it('starfield ON (what actually ships): how much differs', () => {
    const gB=bB(CB.edlParams), gM=bM(CM.edlParams);
    const A=rec(), B=rec();
    pM(B.ctx, gM, {...CM, ramp:TM, darkness:1, dotScale:1.18} as any, 1440, 900, 2, 1.37, 0.06);
    pB(A.ctx, gB, {...CB, ramp:TB, darkness:1, dotScale:1.18, starfield:true} as any, 1440, 900, 2, 1.37, 0.06);
    const diffs=A.calls.filter((c,i)=>c!==B.calls[i]);
    console.log('dark AS SHIPPED (starfield=true): '+A.calls.length+' calls, '+diffs.length+' differ ('+(100*diffs.length/A.calls.length).toFixed(0)+'%)');
  });
});
