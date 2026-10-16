import * as Game from './game/rules.js';
import {propertyService} from './properties.js';

// Catalogue IDs: awd-<home>-NN and awd-<home>-commercial-NN (game/property-model.js).
export const UNIT_PLACE=/^unit:awd-[a-z]+-(?:commercial-)?\d{2}$/;
export const LEASE_RENEW_MS=10000;
export const isUnitPlace=place=>typeof place==='string'&&UNIT_PLACE.test(place);
export function propertyLeaseValid(p,now=Date.now()){
  const c=p.propertyContext;
  return !!(isUnitPlace(p.state.place)&&c&&c.unit===p.state.place.slice(5)&&c.account===p.acct&&c.session===p.leaseToken&&c.expiresAt>now);
}

// Call under the account reservation on arrival, or before initial admission.
// A saved unit ID is only a candidate. No client descriptor is accepted here.
export async function prepareProperty(p,db=undefined,now=Date.now()){
  if(!isUnitPlace(p.state.place)){p.propertyContext=null;return null;}
  const old=p.propertyContext;
  const descriptor=await propertyService.resolveAccess(p.acct,p.state.place.slice(5),now,db?{db}:{});
  if(descriptor){
    p.propertyContext={...descriptor,account:p.acct,session:p.leaseToken,expiresAt:Math.min(descriptor.expiresAt||now+LEASE_RENEW_MS,now+LEASE_RENEW_MS)};
    p.x=descriptor.x;p.z=descriptor.z;return p.propertyContext;
  }
  const exit=old?.exit&&Game.LOC[old.exit]?old.exit:'circle';
  if(p.state.busy?.homeBenefits)p.state.busy=null;
  p.propertyContext=null;Game.goPlace(p,exit);p.dirty=true;return null;
}

export function propertyHome(context){
  if(!context)return null;
  const {unit,revision,template,name,items,mine,canAct,canFurnish,theme,upgrades,exit}=context;
  return {id:template,template,property:true,unit,revision,name,items,mine,canAct,canFurnish,theme,upgrades,exit};
}
