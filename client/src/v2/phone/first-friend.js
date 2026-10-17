import {h} from '../ui/dom.js';
// The phone's Meet app opens the same consent-based Meet sheet as the HUD objective (Stage 6).
export function firstFriend(win,act){
  win.page('Meet people',()=>h('p',{style:{padding:'0 8px'}},'Opening Meet…'));
  setTimeout(()=>act.meet(),0);
}
