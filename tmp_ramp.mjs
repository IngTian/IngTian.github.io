const DESCENT_LIGHT=[[0.0,'#f4efe4'],[0.08,'#f0eadf'],[0.15,'#efe6d4'],[0.23,'#e2d2c2'],[0.3,'#ccc4b6'],[0.37,'#a6a8ad'],[0.44,'#7d7e88'],[0.52,'#565660'],[0.62,'#3a3833'],[0.78,'#2a2720'],[0.9,'#1d1b16'],[1.0,'#16140f']];
const READING_LIGHT=[[0.0,'#f4efe4'],[0.24,'#f1ebe0'],[0.48,'#efe6d4'],[0.74,'#e7ddce'],[1.0,'#dcd5cf']];
const DESCENT_DARK=[[0.0,'#16191d'],[0.2,'#131619'],[0.4,'#111417'],[0.6,'#0e1013'],[0.8,'#0b0d0f'],[1.0,'#08090b']];
const hex=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16));
function samp(stops,y){y=Math.max(0,Math.min(1,y));for(let i=0;i<stops.length-1;i++){const[a,ha]=stops[i],[b,hb]=stops[i+1];if(y>=a&&y<=b){const t=(y-a)/(b-a);const A=hex(ha),B=hex(hb);return A.map((v,k)=>v+(B[k]-v)*t);}}return hex(stops[stops.length-1][1]);}
function report(name,stops){
  console.log('==',name);
  const h=0.01;
  for(let d=0;d<=1.0001;d+=0.05){
    const c0=samp(stops,d), c1=samp(stops,d+h);
    const slope=Math.max(...c0.map((v,k)=>Math.abs(c1[k]-v)))/h;
    console.log(d.toFixed(2), 'rgb='+c0.map(v=>Math.round(v)).join(','), 'slope/unit='+slope.toFixed(0), 'disp_for_10='+(10/slope).toFixed(4));
  }
}
report('DESCENT_LIGHT',DESCENT_LIGHT);
report('READING_LIGHT',READING_LIGHT);
report('DESCENT_DARK',DESCENT_DARK);
