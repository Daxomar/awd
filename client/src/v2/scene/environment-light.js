import { Color } from 'three';

// Interpolated samples of the existing Accra clock, including the midnight seam.
const KEYS=[
  [0,'#263848','#aebedb','#c8d4eb',.66,.42,1],
  [5,'#344451','#b5bfd0','#d6cbd0',.7,.45,.95],
  [6.5,'#e4ccb0','#f3ddbd','#ffcb91',1.05,1.4,.2],
  [9,'#d8e1d5','#fff0d5','#ffe6bf',1.3,1.85,0],
  [12,'#dce4dc','#f6f2e5','#fff0db',1.35,1.9,0],
  [16,'#e6d9bd','#f5e5cc','#ffdcac',1.2,1.7,0],
  [18,'#c7b4b0','#dbcbd5','#ffc08b',.94,1.1,.45],
  [19.5,'#34465a','#bac7e0','#c8d4ed',.7,.45,1],
  [24,'#263848','#aebedb','#c8d4eb',.66,.42,1],
];
export function environmentLight(hour,outdoor=false) {
  const h=((Number.isFinite(hour)?hour:12)%24+24)%24;
  const i=KEYS.findIndex((v,j)=>j<KEYS.length-1&&h>=v[0]&&h<KEYS[j+1][0]);
  const a=KEYS[Math.max(0,i)],b=KEYS[Math.max(0,i)+1];let t=(h-a[0])/(b[0]-a[0]);t=t*t*(3-2*t);
  const lerp=k=>a[k]+(b[k]-a[k])*t,color=k=>new Color(a[k]).lerp(new Color(b[k]),t);
  return {background:color(1),ambient:color(2),sun:color(3),hemi:lerp(4)+(outdoor?0:.12),key:lerp(5),night:lerp(6),fill:.35+lerp(6)*.18,exposure:1.02};
}
