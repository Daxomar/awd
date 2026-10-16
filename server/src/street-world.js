import { streetGraph, streetEntry, isStreetPoint, STREET_VERSION } from '../../shared/local-streets.js';

// Optional, backwards-compatible save metadata. Geographic x/z remain solely
// owned by Game.goPlace/travel; these are bounded positions inside one room.
export function localEntry(state,from) {
  const place=state.place;
  if(typeof place!=='string'||!/^([ne]):/.test(place))return null;
  const id=place.slice(2),graph=streetGraph(id);if(!graph)return null;
  const saved=state.localWalk;
  if(place.startsWith('e:')){
    // Estate pages contain changing owner plots. Restore a safe gate/court entry,
    // never an arbitrary target that could now be inside an occupied property.
    if(from===undefined&&saved?.place===place&&saved.x===0&&[7,16].includes(saved.z))return {x:0,z:saved.z};
    return {x:0,z:from==='n:'+id?16:7};
  }
  if(from===undefined&&saved?.place===place&&isStreetPoint(graph,saved.x,saved.z))return {x:saved.x,z:saved.z};
  return streetEntry(id,from,state.home)||{...graph.spawn};
}
export function enterLocal(state,from) {
  const point=localEntry(state,from);
  if(point)state.localWalk={place:state.place,...point};
  return point;
}
export function localRoomInfo(state) {
  const entry=localEntry(state);return entry?{version:STREET_VERSION,network:state.place.slice(2),...entry}:null;
}
export function saveLocalMove(state,x,z) {
  if(state.place?.startsWith('e:')){
    if(!Number.isFinite(x)||!Number.isFinite(z)||Math.abs(x)>=20||Math.abs(z)>=19)return false;
    return true;
  }
  if(!state.place?.startsWith('n:'))return true;
  const graph=streetGraph(state.place.slice(2));
  if(!isStreetPoint(graph,x,z))return false;
  state.localWalk={place:state.place,x,z};return true;
}
export function updateStreetReturn(state,from,to) {
  const graph=typeof from==='string'&&from.startsWith('n:')?streetGraph(from.slice(2)):null;
  if(graph?.lots.some(l=>l.destination===to))state.streetReturn={place:from,venue:to};
  else if(state.streetReturn?.venue!==to)delete state.streetReturn;
}
