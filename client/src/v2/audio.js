// Original, lightweight soundscape and syncopated instrumental. No external recording is embedded.
import { h, ic, sheet } from './ui/dom.js';
import { G, accraClock } from './store.js';
class CityAudio {
  constructor(){this.settings={music:.24,ambience:.4,muted:false};try{Object.assign(this.settings,JSON.parse(localStorage.getItem('awd_sound')||'{}'));}catch{}for(const k of ['music','ambience'])this.settings[k]=Math.max(0,Math.min(1,Number(this.settings[k])||0));this.ctx=null;this.street=false;this.active=false;this.beat=0;this.lastStep=0;this.lastHorn=0;this.lastBird=0;this.lastEnvironment='';
    document.addEventListener('pointerdown',()=>this.unlock(),{passive:true});document.addEventListener('keydown',()=>this.unlock());document.addEventListener('visibilitychange',()=>{if(!this.ctx)return;if(document.hidden)this.ctx.suspend().catch(()=>{});else this.unlock();});
  }
  async unlock(){if(!G.state?.onboarded||this.settings.muted||document.hidden)return;try{if(!this.ctx)this.init();await this.ctx.resume();}catch{}}
  init(){const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)return;const c=this.ctx=new Audio();this.music=c.createGain();this.ambience=c.createGain();this.music.connect(c.destination);this.ambience.connect(c.destination);this.music.gain.value=0;this.ambience.gain.value=0;
    this.noise=c.createBuffer(1,c.sampleRate*4,c.sampleRate);const data=this.noise.getChannelData(0);let smooth=0;for(let i=0;i<data.length;i++){smooth=smooth*.96+(Math.random()*2-1)*.04;data[i]=smooth;}
    const source=c.createBufferSource();source.buffer=this.noise;source.loop=true;const filter=c.createBiquadFilter();filter.type='lowpass';filter.frequency.value=430;this.traffic=c.createGain();this.traffic.gain.value=0;source.connect(filter);filter.connect(this.traffic);this.traffic.connect(this.ambience);source.start();this.nextBeat=c.currentTime+.05;
  }
  save(){try{localStorage.setItem('awd_sound',JSON.stringify(this.settings));}catch{}this.apply();}
  apply(){if(!this.ctx)return;const t=this.ctx.currentTime,on=this.active&&!this.settings.muted&&!document.hidden,key=[on,this.settings.music,this.settings.ambience,this.street].join('|');if(key===this.lastEnvironment)return;this.lastEnvironment=key;this.music.gain.setTargetAtTime(on?this.settings.music*.55:0,t,.15);this.ambience.gain.setTargetAtTime(on?this.settings.ambience:0,t,.15);this.traffic.gain.setTargetAtTime(this.street?.7:.045,t,.4);}
  tone(freq,time,duration,volume,output,type='triangle',end=freq){const c=this.ctx,o=c.createOscillator(),g=c.createGain();o.type=type;o.frequency.setValueAtTime(freq,time);o.frequency.exponentialRampToValueAtTime(Math.max(20,end),time+duration);g.gain.setValueAtTime(volume,time);g.gain.exponentialRampToValueAtTime(.0001,time+duration);o.connect(g);g.connect(output);o.start(time);o.stop(time+duration+.02);o.onended=()=>{o.disconnect();g.disconnect();};}
  percussion(time,volume=.1){const c=this.ctx,o=c.createBufferSource(),g=c.createGain(),f=c.createBiquadFilter();o.buffer=this.noise;f.type='highpass';f.frequency.value=2000;g.gain.setValueAtTime(volume,time);g.gain.exponentialRampToValueAtTime(.0001,time+.08);o.connect(f);f.connect(g);g.connect(this.music);o.start(time);o.stop(time+.1);o.onended=()=>{o.disconnect();f.disconnect();g.disconnect();};}
  update(place,moving=false,enabled=true){this.active=enabled&&!!G.state?.onboarded;this.street=/^[ne]:/.test(place||'')||['circle','makola','kantamanto','aboki','fanyogo','labadi','canoes','oxford','viewing'].includes(place);if(!this.ctx||this.ctx.state!=='running')return;const c=this.ctx,t=c.currentTime;this.apply();if(!this.active||this.settings.muted)return;
    if(this.nextBeat<t-.5)this.nextBeat=t+.05;
    while(this.nextBeat<t+.12){const b=this.beat++%32,at=this.nextBeat;this.nextBeat+=60/102/2;if(this.settings.music){const roots=[130.81,174.61,196,174.61],root=roots[Math.floor(b/8)];if(b%4===0)this.tone(root/2,at,.3,.15,this.music,'sine');if([1,3,6].includes(b%8)){const note=[1,1.25,1.5,2][Math.floor(b/2)%4];this.tone(root*note,at,.22,.075,this.music);this.tone(root*note*2,at,.12,.025,this.music,'sine');}if(b%4===0)this.tone(100,at,.13,.24,this.music,'sine',38);if(b%4===2)this.tone(180,at,.095,.12,this.music,'triangle',90);this.percussion(at,b%2?.1:.06);}}
    if(!this.settings.ambience)return;const hour=accraClock().h;
    if(this.street&&t-this.lastHorn>17){this.lastHorn=t;this.tone(370,t,.28,.032,this.ambience,'sine');this.tone(460,t,.26,.018,this.ambience,'sine');}
    if(this.street&&t-this.lastBird>8){this.lastBird=t;const night=hour<6||hour>=18;this.tone(night?2400:1700,t,.12,.012,this.ambience,'sine',night?2500:2300);this.tone(night?2500:2100,t+.18,.1,.008,this.ambience,'sine',1800);}
    if(moving&&t-this.lastStep>.42){this.lastStep=t;this.tone(120,t,.045,.055,this.ambience,'triangle',65);}
  }
  controls(){const status=h('p.muted',null,'Instrumental music, footsteps and a street soundscape. Sound starts after a tap.');const mute=h('button.btn.wide',{onclick:()=>{this.settings.muted=!this.settings.muted;this.save();mute.textContent=this.settings.muted?'Enable sound':'Mute all';if(!this.settings.muted)this.unlock();}},this.settings.muted?'Enable sound':'Mute all');
    sheet(h('div.sheet-body',null,status,...[['music','Music'],['ambience','Street sounds']].map(([key,label])=>h('label.sound-control',null,h('span',null,label),h('input',{type:'range',min:0,max:1,step:.05,value:this.settings[key],'aria-label':label,oninput:e=>{this.settings[key]=Number(e.target.value);this.save();this.unlock();}}))),mute),{title:'Sound'});
  }
}
export const cityAudio=new CityAudio();
