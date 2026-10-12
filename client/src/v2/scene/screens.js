import * as THREE from 'three';

// Small original animations, rendered at 10 fps. These are simulated programmes.
export function animatedScreen(kind) {
  const canvas=document.createElement('canvas');canvas.width=384;canvas.height=216;
  const c=canvas.getContext('2d'),texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  let last=-1,fixture=null;
  function update(time) {
    const frame=Math.floor(time*10);if(frame===last)return;last=frame;
    if(kind==='match') {
      c.fillStyle='#27854b';c.fillRect(0,0,384,216);
      for(let x=0;x<384;x+=48){c.fillStyle=x%96?'#308f52':'#27854b';c.fillRect(x,0,48,216);}
      c.strokeStyle='#d6edcf';c.lineWidth=2;c.strokeRect(12,28,360,175);c.beginPath();c.moveTo(192,28);c.lineTo(192,203);c.stroke();c.beginPath();c.arc(192,115,26,0,Math.PI*2);c.stroke();c.strokeRect(12,75,40,80);c.strokeRect(332,75,40,80);
      for(let i=0;i<20;i++){const team=i<10;c.fillStyle=team?'#f2db53':'#e66565';const x=32+(i%10)*32+Math.sin(time*.65+i)*13,y=50+(i*47)%140+Math.cos(time+i)*9;c.beginPath();c.arc(x,y,4,0,Math.PI*2);c.fill();}
      c.fillStyle='#fff';c.beginPath();c.arc(192+Math.sin(time*.42)*125,115+Math.sin(time*.9)*65,3,0,Math.PI*2);c.fill();
      const teams=fixture?[fixture.home.toUpperCase().slice(0,15),fixture.away.toUpperCase().slice(0,15)]:[['HEARTS','KOTOKO'],['ARSENAL','CHELSEA'],['MADRID','BARCELONA'],['LIVERPOOL','BAYERN']][Math.floor(Date.now()/1200000)%4];
      c.fillStyle='#182522';c.fillRect(0,0,384,24);c.fillStyle='#fff';c.font='bold 12px sans-serif';c.fillText(`${teams[0]} ${fixture?.score?fixture.score.home+'–'+fixture.score.away:'v'} ${teams[1]} · SIM`,12,16);
    } else {
      c.fillStyle='#c9dde3';c.fillRect(0,0,384,216);c.fillStyle='#efc680';c.beginPath();c.arc(290,48,20,0,Math.PI*2);c.fill();
      for(let i=0;i<8;i++){c.fillStyle=i%2?'#decab0':'#b9c6ba';c.fillRect(i*52,80+(i*13)%32,48,112);c.fillStyle='#4f6971';for(let y=108;y<180;y+=22)c.fillRect(i*52+12,y,12,12);}
      c.fillStyle='#4b5558';c.fillRect(0,186,384,30);const x=(time*35)%470-85;c.fillStyle='#dcb440';c.fillRect(x,166,80,29);c.fillStyle='#496771';c.fillRect(x+6,170,55,12);c.fillStyle='#222';for(const w of [x+13,x+67]){c.beginPath();c.arc(w,196,6,0,Math.PI*2);c.fill();}
      c.fillStyle='#233e36';c.font='bold 12px sans-serif';c.fillText('ACCRA DAYS · ORIGINAL ANIMATION',12,20);
    }
    texture.needsUpdate=true;
  }
  update(0);return {texture,update,setFixture:m=>{fixture=m;last=-1;},dispose:()=>texture.dispose()};
}
