// What a character actually wears right now: their chosen look, or sleepwear, gym kit, or a work uniform.
import { G } from './store.js';
const GYM = new Set(['workout', 'beachworkout', 'train', 'jog', 'stadiumjog', 'spar']);
export function myFit(s = G.state) { if (!s) return null; const b = s.busy; return s.shift && s.job ? 'work:' + s.job.id : b && b.sleep ? 'sleep' : b && GYM.has(b.id) ? 'gym' : null; }
export function fitLook(look, fit) {
  if (!look || !fit || !G.cat) return look; const o = { ...look }; const W = G.cat.wear; const f = look.body === 'f';
  const put = (slot, id, col) => { if (!W[id] || (W[id].g !== 'u' && W[id].g !== (f ? 'f' : 'm'))) return false; o[slot] = id; if (col) o[slot + 'Col'] = col; return true; };
  if (fit === 'sleep') { delete o.full; put('top', 'tee', '#cfe0f5'); put('bottom', 'joggers', '#5b6170'); put('shoes', 'slides', '#17150f'); o.hat = 'nohat'; o.glasses = 'noglasses'; o.neck = 'nochain'; }
  else if (fit === 'gym') { delete o.full; put('top', f ? 'crop' : 'singlet', '#17150f'); put('bottom', 'shorts', '#17150f'); put('shoes', 'sneakers', '#f4f4f2'); o.hat = 'nohat'; o.neck = 'nochain'; }
  else if (fit.startsWith('work:')) { const U = G.cat.uniform[fit.slice(5)]; if (!U) return look; if (U.full || U.top || U.bottom) delete o.full;
    for (const slot in U) { const [id, col] = U[slot]; if (slot === 'full') { if (!put('full', id, col)) { put('top', 'office', col); put('bottom', 'chinos', col); } } else if (!put(slot, id, col) && slot === 'top') put('top', 'ankara', col); } }
  return o;
}
