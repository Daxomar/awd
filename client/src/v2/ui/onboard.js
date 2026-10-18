// Server checkpoints own progression; the creator itself remains unchanged.
import { h, ic, cedi } from './dom.js';
import { G } from '../store.js';
import { net } from '../net.js';
import { OnboardingSession } from '../onboarding-session.js';
import { stylist } from './stylist.js';
import { BirthDie } from './birth-die.js';
import './onboarding.css';

const titles={welcome:'Welcome to Accra',character:'Your character',lottery:'Birth lottery',home:'Your first home',enter:'Your life starts here'};
const order=Object.keys(titles);
export function onboardScreen(ui,{preview,username,studio,stage}) {
 return new Promise(resolve=>{
  let state=G.state,look,name,traits,dream,characterPanel='style',busy=false,dirty=false,closed=false,timer,draftTask,zoom=1;
  const el=h('section.screen.ob.onboarding-flow',{'aria-label':'Start your Accra life'}),panel=h('div.of-panel'),content=h('div.of-content');
  const error=h('p.of-error',{role:'alert',hidden:true}),status=h('span.of-save',{role:'status'}),connection=h('p.of-connection',{role:'status',hidden:true});
  const back=h('button.of-back',{'aria-label':'Back',onclick:()=>{
    if(busy)return;
    if(phase()==='character'&&characterPanel==='dream'){characterPanel='traits';draw();return;}
    if(phase()==='character'&&characterPanel==='traits'){characterPanel='style';draw();return;}
    const to={character:'welcome',lottery:'character',home:'lottery',enter:'home'}[phase()];if(to)saveDraft().then(()=>run('back',{to})).catch(fail);
  }},ic('caret-left'));
  const stepLabel=h('span.of-step'),progress=h('ol.of-progress',{'aria-label':'Setup progress'},...order.map(k=>h('li',{'aria-label':titles[k]})));
  const header=h('header.of-header',null,h('div.of-brand',null,'Accra We Dey'),h('div.of-heading',null,back,stepLabel,status),progress);
  const viewport=h('div.of-preview',{'aria-label':'Character preview',role:'img'}),dieHost=h('div.of-die-stage',{'aria-label':'Birth lottery presentation',role:'img'});
  const fallback=h('p.of-preview-fallback',null,'Your choices still save when the 3D preview is unavailable.');viewport.append(fallback);fallback.hidden=!!studio;
  let pointer;viewport.addEventListener('pointerdown',e=>{if(e.target.closest('button')||!studio)return;pointer=e.clientX;viewport.setPointerCapture(e.pointerId);});
  viewport.addEventListener('pointermove',e=>{if(pointer===undefined)return;studio.turn(e.clientX-pointer);pointer=e.clientX;});
  viewport.addEventListener('pointerup',()=>{pointer=undefined;});viewport.addEventListener('pointercancel',()=>{pointer=undefined;});
  const zoomButtons=h('div.of-preview-controls',null,h('span',null,'Drag to turn'),h('button',{'aria-label':'Zoom out',onclick:()=>{zoom=Math.max(.8,zoom-.1);frame();}},ic('minus')),h('button',{'aria-label':'Zoom in',onclick:()=>{zoom=Math.min(1.2,zoom+.1);frame();}},ic('plus')));viewport.append(zoomButtons);
  panel.append(content,error,connection);el.append(header,viewport,dieHost,panel);ui.append(el);
  const die=new BirthDie(stage,dieHost);
  const phase=()=>state.onboarding?.step||'welcome';
  const fields=()=>({name,look:{...look},traits:[...traits],dream:dream||'landlord'});
  const fingerprint=()=>JSON.stringify(fields());
  function load(){const d=state.onboarding||{};look={...(d.look||G.cat.defaultLook.m)};name=d.name||username;traits=[...(d.traits||[])];dream=d.dream||state.dream||'landlord';}
  const session=new OnboardingSession(net,state,{onState:(s,reason)=>{
    state=G.state=s;
    if(s.onboarded){queueMicrotask(()=>finish(s));return;}
    if(reason==='reconnect'){if(!dirty||phase()!=='character'){load();dirty=false;status.textContent='Saved';}error.hidden=true;draw();if(dirty)scheduleSave();}
    else if(!busy&&!dirty){load();draw();}
  },onConnection:m=>{if(closed)return;connection.hidden=m.connected;connection.textContent=m.terminal?'Session ended. Reload and sign in again.':'Reconnecting. Your saved setup is safe.';if(m.connected&&dirty)scheduleSave();}});
  function fail(e){if(closed)return;error.hidden=false;error.textContent=e.message;status.textContent=dirty?'Changes not saved':'';}
  function mark(){dirty=true;status.textContent='Saving…';scheduleSave();}
  function scheduleSave(){clearTimeout(timer);if(phase()==='character')timer=setTimeout(()=>saveDraft().catch(fail),700);}
  async function saveDraft(){
    clearTimeout(timer);if(draftTask)await draftTask;if(!dirty||phase()!=='character')return;
    const key=fingerprint();status.textContent='Saving…';
    draftTask=session.request('draft',fields()).then(()=>{if(key===fingerprint()){dirty=false;status.textContent='Saved';}else scheduleSave();}).finally(()=>{draftTask=null;});
    await draftTask;
  }
  async function run(op,payload={},animation){
    if(busy||closed)return;busy=true;error.hidden=true;status.textContent=animation?'Revealing…':'Saving…';el.classList.add('saving');buttons();
    try{const wait=animation?.();await session.request(op,payload);if(wait)await wait;if(closed)return;load();dirty=false;status.textContent='Saved';draw();}
    catch(e){fail(e);if(state.onboarding?.step&&state.onboarding.step!==el.dataset.step){load();draw();}}
    finally{busy=false;el.classList.remove('saving');buttons();}
  }
  async function saveCharacter(){try{await saveDraft();await run('character',fields());}catch(e){fail(e);}}
  function cta(text,onclick,disabled=false){return h('button.of-primary',{type:'button',disabled,onclick},text,ic('caret-right'));}
  function buttons(){if(closed)return;back.disabled=busy;for(const b of content.querySelectorAll('.of-primary,.of-home,.of-trait'))b.disabled=busy||b.dataset.invalid==='yes';}
  function frame(){
    if(!studio||!stage||phase()!=='character')return;
    const r=viewport.getBoundingClientRect();stage.view.target.set(500,.92,500);stage.offsetY=.5-(r.top+r.height/2)/innerHeight;
    stage.view.zoom=2.35*innerHeight/Math.max(160,r.height)/zoom;stage.applyView();
    stage.camera.setViewOffset(innerWidth,innerHeight,(.5-(r.left+r.width/2)/innerWidth)*innerWidth,stage.offsetY*innerHeight,innerWidth,innerHeight);stage.camera.updateProjectionMatrix();
  }
  function draw(){
    if(closed)return;const step=phase(),index=order.indexOf(step);el.dataset.step=step;stepLabel.textContent=`${index+1} of 5 · ${titles[step]}`;
    [...progress.children].forEach((li,i)=>{li.classList.toggle('done',i<index);li.classList.toggle('current',i===index);if(i===index)li.setAttribute('aria-current','step');else li.removeAttribute('aria-current');});
    back.hidden=step==='welcome';viewport.hidden=step!=='character';die.hide();if(studio)studio.g.visible=step==='character';
    content.replaceChildren();const heading=(t,p)=>content.append(h('h1',{tabIndex:-1},t),h('p.of-intro',null,p));
    if(step==='welcome'){
      heading('A new life.\nYour kind of Accra.','Meet people, make a home and find your own way through the city.');
      content.append(h('div.of-welcome-scene',{'aria-hidden':'true'},homeArt('jtown'),h('span.of-city-line',null,'From Jamestown to East Legon')),
        h('p.of-note',null,'Create your character, discover your background, then choose your first home.'),cta('Create my character',()=>run('begin')));
    }else if(step==='character'){
      content.append(h('div.of-character-title',null,h('h1',null,characterPanel==='style'?'Make it you.':characterPanel==='traits'?'What are you like?':'What is your Accra Dream?')));
      if(characterPanel==='style'){
        const input=h('input',{id:'setup-name',value:name,maxLength:16,autocomplete:'nickname',oninput:e=>{name=e.target.value;mark();}});
        content.append(h('label.of-name',null,h('span',null,'Your name'),input));
        stylist(content,{mode:'create',look,onPreview:l=>{look=l;preview?.(l);mark();},onSave:l=>{look=l;characterPanel='traits';draw();},saveLabel:'Choose traits'});
      }else if(characterPanel==='traits'){
        content.append(h('p.of-intro',null,'Choose two traits. They shape what you enjoy and how you learn.'),h('div.of-traits',null,...Object.entries(G.cat.traits).map(([key,t])=>h('button.of-trait',{'aria-pressed':String(traits.includes(key)),onclick:()=>{
          traits=traits.includes(key)?traits.filter(t=>t!==key):[...traits.slice(-1),key];mark();draw();
        }},ic(t.ic),h('span',null,h('strong',null,t.name),h('small',null,t.desc)),traits.includes(key)?ic('check-circle'):null))),
        cta(`Choose aspiration (${traits.length}/2)`,()=>{characterPanel='dream';draw();},traits.length!==2));
        const b=content.querySelector('.of-primary');b.dataset.invalid=traits.length!==2?'yes':'no';
      }else{
        const arcs=[
          {id:'landlord',name:'East Legon Landlord',tag:'From Compound to Trasacco Villa',ic:'house-line',color:'#d97706',desc:'Own estates, retail stores, and Trasacco mansions.'},
          {id:'star',name:'Afrobeats Hitmaker',tag:'From Freestyles to Detty December',ic:'microphone',color:'#ec4899',desc:'Top the airwaves, pack out Vibes Lounge, and headline Detty December.'},
          {id:'mogul',name:'Makola Business Mogul',tag:'From Pavement Table to Conglomerate',ic:'storefront',color:'#10b981',desc:'Turn thrift bales into a freight empire and commercial conglomerate.'},
          {id:'unicorn',name:'Osu Tech Founder',tag:'From Cafeteria Coding to $100M Unicorn',ic:'laptop',color:'#6366f1',desc:'Build products on iced Milo, raise venture capital, and build Silicon Accra.'},
          {id:'bigman',name:'High Society Borga',tag:'From Heathrow to King of Accra',ic:'crown',color:'#f59e0b',desc:'Drip in tailored Kente, cruise in a Prado, and cement your high society reign.'},
        ];
        content.append(h('p.of-intro',null,'Choose your aspiration. It shapes your story chapters, personal missions and street events.'),
          h('div.of-traits',null,...arcs.map(a=>h('button.of-trait',{'aria-pressed':String(dream===a.id),onclick:()=>{dream=a.id;mark();draw();}},
            ic(a.ic),h('span',null,h('strong',{style:{color:a.color}},a.name),h('small',null,a.tag)),dream===a.id?ic('check-circle'):null))),
          cta('Save character',saveCharacter,!dream));
        const b=content.querySelector('.of-primary');b.dataset.invalid=!dream?'yes':'no';
      }
      preview?.(look);requestAnimationFrame(frame);
    }else if(step==='lottery'){
      die.show();const revealed=!!state.onboarding?.revealedAt,origin=G.cat.origins[state.birthOrigin];die.outcome(revealed?state.birthOrigin:null);
      heading(revealed?`You’re a ${origin.name}.`:'Every life starts somewhere.',revealed?(state.birthOrigin==='dbee'?'A comfortable start. What you build with it is up to you.':'Resourceful beginnings. A whole city of opportunities ahead.'):'Your starting circumstances are chance. Your future is yours to shape.');
      if(revealed)content.append(h('div.of-result',{class:'result-'+state.birthOrigin},h('span',null,'Starting savings'),h('strong',null,cedi(origin.cash+origin.momo)),h('p',null,origin.homes.map(k=>G.cat.homes[k].area).join(', '))),
        h('p.of-note',null,'Every career, business and aspiration is open to you.'),cta('Choose your first home',()=>run('homes')));
      else content.append(h('p.of-odds',null,'75% Hustler · 25% Dbee'),cta('Roll the birth lottery',()=>run('roll',{},()=>die.roll())),h('p.of-note',null,'One background per account. No paid rerolls.'));
    }else if(step==='home'){
      heading('Find your first doorstep.','Choose where your Accra life begins. Your first week is covered.');
      const origin=G.cat.origins[state.birthOrigin];let selected=state.onboarding?.home;
      const choose=cta('Choose this home',()=>run('home',{home:selected}),!selected);choose.dataset.invalid=selected?'no':'yes';
      const cards=origin.homes.map(k=>{const home=G.cat.homes[k];const card=h('button.of-home',{'aria-pressed':String(selected===k),onclick:()=>{selected=k;cards.forEach(c=>c.setAttribute('aria-pressed',c.dataset.home===k));choose.dataset.invalid='no';choose.disabled=busy;}},
        homeArt(k),h('span.of-home-copy',null,h('strong',null,home.area),h('span',null,home.name.split(' · ')[0]),h('small',null,`${home.toilet==='own'?'Private':'Shared'} bathroom`),h('small',null,`${cedi(home.rent)}/week after your covered start`)),ic('check-circle'));card.dataset.home=k;return card;});
      content.append(h('div.of-homes',null,...cards),choose);
    }else if(step==='enter'){
      const d=state.onboarding,home=G.cat.homes[d.home],origin=G.cat.origins[state.birthOrigin];
      heading(`Welcome home, ${d.name}.`,`Your ${home.name.split(' · ')[0].toLowerCase()} in ${home.area} is ready.`);
      content.append(h('div.of-arrival',null,homeArt(d.home),h('p',null,`${origin.name} beginnings`,h('br'),`${cedi(origin.cash+origin.momo)} starting savings`)),
        h('p.of-note',null,'Tap around your home to explore. Your phone connects you to people, jobs and the city.'),cta('Enter Accra',()=>run('finish')));
    }
    buttons();requestAnimationFrame(()=>{frame();die.resize();});
  }
  const resize=new ResizeObserver(()=>{frame();die.resize();});resize.observe(el);resize.observe(viewport);resize.observe(panel);
  const viewportResize=()=>{el.style.height=Math.min(innerHeight,window.visualViewport?.height||innerHeight)+'px';frame();die.resize();};
  window.visualViewport?.addEventListener('resize',viewportResize);viewportResize();
  function finish(s){if(closed)return;closed=true;clearTimeout(timer);resize.disconnect();window.visualViewport?.removeEventListener('resize',viewportResize);die.dispose();session.dispose();el.classList.add('leaving');setTimeout(()=>{el.remove();resolve(s);},matchMedia('(prefers-reduced-motion: reduce)').matches?0:180);}
  load();draw();
 });
}

// Original lightweight illustrations, keyed to the existing starter-home catalogue.
function homeArt(id){
 const colors={jtown:['#c78d66','#8c4b39'],nima:['#d9ba83','#65765c'],osu:['#e7d9bd','#7e8c7d'],airres:['#d9e1d7','#697c83'],legon:['#e5d5b6','#8a6653']};
 const [wall,roof]=colors[id]||colors.nima,art=h('span.of-home-art',{'aria-hidden':'true'});
 art.innerHTML=`<svg viewBox="0 0 180 110" fill="none"><ellipse cx="90" cy="94" rx="72" ry="10" fill="#ced9c4"/><path d="M28 56L86 30L150 54L92 83Z" fill="${roof}"/><path d="M38 57L91 77V99L38 78Z" fill="${wall}"/><path d="M91 77L142 58V81L91 99Z" fill="#ab9b80"/><path d="M59 69L72 74V91L59 86Z" fill="#4b614d"/><path d="M105 77L119 72V82L105 87Z" fill="#dce9e4"/><path d="M113 74V84" stroke="#8caa9a"/><path d="M29 55L86 24L153 52L142 58L86 37L38 63Z" fill="${roof}"/><path d="M21 79V47M21 51L9 57M21 47L34 52" stroke="#647b52" stroke-width="5" stroke-linecap="round"/></svg>`;
 return art;
}
