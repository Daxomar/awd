import * as D from './data.js';
import * as W from './wardrobe.js';
import { cleanText } from '../filter.js';

const steps = ['welcome','character','lottery','home','enter'];
const traitsOf = value => [...new Set((Array.isArray(value)?value:[])
  .filter(t=>typeof t==='string'&&Object.hasOwn(D.TRAITS,t)))].slice(0,2);
export function onboardingDraft(state) {
  const d=state.onboarding||{},origin=D.ORIGINS[state.birthOrigin];
  const ready=d.characterReady===true, revealed=ready&&Number.isFinite(d.revealedAt)&&d.revealedAt>0;
  let step=steps.includes(d.step)?d.step:'welcome';
  if(!ready&&steps.indexOf(step)>1)step='character';
  if(!revealed&&steps.indexOf(step)>2)step='lottery';
  return {version:1,started:!!d.started,step,revision:Number.isSafeInteger(d.revision)?d.revision:0,
    name:cleanText(d.name||state.name||'',16),look:W.cleanLook(d.look||state.look||{},state.wardrobe),
    traits:traitsOf(d.traits||state.traits),dream:d.dream||state.dream||null,characterReady:ready,revealedAt:revealed?d.revealedAt:null,
    home:origin?.homes.includes(d.home)?d.home:null};
}

// Pure draft transition. The shard persists the returned state before replying.
// The existing birthOrigin is never derived from a client payload or die face.
export function transitionOnboarding(state,m,now=Date.now()) {
  const d=onboardingDraft(state),out=structuredClone(state);out.onboarding=d;
  const fail=error=>({error,state});
  if(state.onboarded)return {state,complete:true,repeated:true};
  if(m.op==='sync')return {state:out};
  if(m.op==='roll'&&d.revealedAt)return {state:out,repeated:true};
  if(m.revision!==d.revision)return {...fail('Your setup changed. Review the saved step and try again.'),conflict:true};
  if(m.op==='begin'&&d.step==='welcome'){d.started=true;d.step='character';}
  else if(['draft','character'].includes(m.op)&&d.step==='character'){
    if(!m.look||typeof m.look!=='object'||Array.isArray(m.look))return fail('Choose your character appearance.');
    const name=cleanText(m.name||'',16).trim(),traits=traitsOf(m.traits);
    if(m.op==='character'&&(!name||traits.length!==2))return fail('Add a name and choose exactly two traits.');
    d.name=name||d.name;d.look=W.cleanLook(m.look,state.wardrobe);d.traits=traits;
    if(m.dream)d.dream=m.dream;
    if(m.op==='character'){d.characterReady=true;d.step='lottery';}
  }else if(m.op==='roll'&&d.step==='lottery'&&d.characterReady){d.revealedAt=now;}
  else if(m.op==='homes'&&d.step==='lottery'&&d.revealedAt){d.step='home';}
  else if(m.op==='home'&&d.step==='home'&&d.revealedAt){
    if(!D.ORIGINS[state.birthOrigin]?.homes.includes(m.home))return fail('Choose one of the homes available for your background.');
    d.home=m.home;d.step='enter';
  }else if(m.op==='back'){
    const allowed={character:['welcome'],lottery:['character'],home:['lottery'],enter:['home']};
    if(!allowed[d.step]?.includes(m.to))return fail('Return to the previous setup step.');
    d.step=m.to;
  }else if(m.op==='finish'&&d.step==='enter'&&d.characterReady&&d.revealedAt&&d.home){
    return {state:out,finish:{name:d.name,look:d.look,traits:d.traits,home:d.home,dream:d.dream}};
  }else return fail('Complete the current setup step first.');
  d.revision++;return {state:out};
}
