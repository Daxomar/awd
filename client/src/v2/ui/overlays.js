// These layers own input while visible, including their closing animation.
// A hidden handset must never disable movement.
export const BLOCKING_LAYERS='.sheet-back,.phone-back:not([hidden]),.chat-panel:not([hidden]),.ios-alert,.celebrate-back,.oware-back,.mg-back,.ow,.mg,.screen.ob,.sty';
export function worldBlocked(root){return [...root.querySelectorAll(BLOCKING_LAYERS)].some(el=>!el.closest('[hidden]'));}
export function dialogKeys(el,close,active=()=>true){
 const handler=e=>{
  if(!active())return;
  if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();close();return;}
  if(e.key!=='Tab')return;
  const list=[...el.querySelectorAll('button:not(:disabled),input:not(:disabled),a[href],select,textarea,[tabindex="0"]')].filter(e=>!e.closest('[hidden]')&&e.getClientRects().length);
  if(!list.length){e.preventDefault();return;}
  const i=list.indexOf(document.activeElement);
  if(e.shiftKey&&(i<=0)){e.preventDefault();list.at(-1).focus();}
  else if(!e.shiftKey&&(i<0||i===list.length-1)){e.preventDefault();list[0].focus();}
 };
 document.addEventListener('keydown',handler);return()=>document.removeEventListener('keydown',handler);
}
export function gameplayViewport(ui){
 const resize=()=>{const v=window.visualViewport;ui.style.setProperty('--viewport-h',(v?.height||innerHeight)+'px');ui.style.setProperty('--viewport-top',(v?.offsetTop||0)+'px');ui.style.setProperty('--keyboard-bottom',Math.max(0,innerHeight-(v?.height||innerHeight)-(v?.offsetTop||0))+'px');};
 window.visualViewport?.addEventListener('resize',resize);window.visualViewport?.addEventListener('scroll',resize);addEventListener('resize',resize);resize();
 return()=>{window.visualViewport?.removeEventListener('resize',resize);window.visualViewport?.removeEventListener('scroll',resize);removeEventListener('resize',resize);};
}
