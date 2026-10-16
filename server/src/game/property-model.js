// Finite property definitions. Existing legacy homes, prices and saves remain separate.
import {HOMES} from './data.js';

export const MAX_UNITS_PER_HOME=4;
export const MAX_ASKING_PRICE=1_000_000_000;
export const LISTING_HOURS=Object.freeze([24,48,72]);
export const LEASE_MS=10_000;
export const FINISHES=Object.freeze([
  Object.freeze({id:'neutral',name:'Accra neutral',description:'Warm ivory walls and natural neutral accents.',cost:0}),
  Object.freeze({id:'coastal',name:'Coastal blue',description:'Pale blue walls with light coastal accents.',cost:0}),
  Object.freeze({id:'earth',name:'Earth tones',description:'Soft clay walls and warm earth accents.',cost:0}),
]);
export const PROPERTY_ITEM_IDS=Object.freeze(['gas','fridge','tv','laptop','speaker','guitar','dumbbells','bed','ac','gen','solar']);
const CLASSES=Object.freeze({nima:'single-room',jtown:'single-room',kaneshie:'compound-house',labadi:'apartment',osu:'apartment',airres:'apartment',legon:'townhouse',trasacco:'premium-residence'});
const LAT0=5.556,LON0=-.2,KX=111320*Math.cos(LAT0*Math.PI/180),KZ=110574;
export const propertyPosition=([lat,lon])=>({x:(lon-LON0)*KX,z:-(lat-LAT0)*KZ});
export const validUnitId=id=>typeof id==='string'&&/^[a-z][a-z0-9-]{2,63}$/.test(id);
export const validAssetId=id=>Number.isSafeInteger(id)&&id>0;
export const validAskingPrice=value=>Number.isSafeInteger(value)&&value>=1&&value<=MAX_ASKING_PRICE;
export const propertyPlace=id=>validUnitId(id)?'unit:'+id:null;
export const propertyId=place=>typeof place==='string'&&place.startsWith('unit:')&&validUnitId(place.slice(5))?place.slice(5):null;
export function listingIsLive(listing,now){return !!listing&&listing.status==='listed'&&new Date(listing.expires_at).getTime()>now;}
export function unitItems(assets){return Object.fromEntries(assets.filter(a=>PROPERTY_ITEM_IDS.includes(a.item)).map(a=>[a.item,true]));}
export function catalogue({unitsPerHome=2,testMode=false,priceOverrides=null}={}){
  if(!Number.isInteger(unitsPerHome)||unitsPerHome<1||unitsPerHome>MAX_UNITS_PER_HOME)throw Error('Property catalogue size must be between one and four units per home tier.');
  if(priceOverrides&&!testMode)throw Error('Property price overrides are restricted to explicit disposable test configuration.');
  const rows=[];
  for(const [template,h] of Object.entries(HOMES))for(let i=1;i<=unitsPerHome;i++){
    const id=`awd-${template}-${String(i).padStart(2,'0')}`,pos=propertyPosition(h.ll),override=priceOverrides?.[id];
    if(override!==undefined&&!validAskingPrice(override))throw Error('Invalid fixture property price.');
    const basePrice=override??h.buy??null;
    rows.push({id,name:`${h.name} · Unit ${String(i).padStart(2,'0')}`,area:h.area,neighbourhood:template,template,class:template==='legon'&&i>1?'detached-house':CLASSES[template],...pos,x:pos.x+(i-1)*12,z:pos.z+(i-1)*8,basePrice,purchaseEnabled:basePrice!==null,residential:true});
  }
  // Commercial interiors reuse a supported room; residential needs actions are disabled.
  for(const [template,name] of [['kaneshie','Kaneshie courtyard shop'],['osu','Osu commercial studio']]){
    const id=`awd-${template}-commercial-01`,h=HOMES[template],override=priceOverrides?.[id];
    if(override!==undefined&&!validAskingPrice(override))throw Error('Invalid fixture property price.');
    rows.push({id,name,area:h.area,neighbourhood:template,template,class:'commercial-unit',...propertyPosition(h.ll),basePrice:override??null,purchaseEnabled:override!==undefined,residential:false});
  }
  if(priceOverrides&&Object.keys(priceOverrides).some(id=>!rows.some(row=>row.id===id)))throw Error('Fixture prices must identify configured catalogue units.');
  return rows;
}
export function furnitureFor(items){return PROPERTY_ITEM_IDS.map(id=>({id,name:items[id][0],price:items[id][1]}));}
export function valuation(row){return {estimatedValue:row.base_price===null?null:Number(row.base_price),estimateNote:'Reference estimate uses the configured base price only. Finishes and furniture do not guarantee appreciation.'};}
