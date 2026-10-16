import { streetSpec } from './neighbourhood.js';
import { HOME_ART, neighbourhoodArt } from './environment-profiles.js';
import { streetGraph } from '../../../../shared/local-streets.js';

export function streetArrivalYaw(id,point,fallback){
  const graph=streetGraph(id);if(!graph||!Number.isFinite(point?.x)||!Number.isFinite(point?.z))return fallback;
  const lot=graph.lots.find(l=>Math.hypot(l.approach.x-point.x,l.approach.z-point.z)<1.5);
  return lot?lot.rot+.2:fallback;
}

export function connectedStreetSpec(id,locations=[]) {
  const graph=streetGraph(id);if(!graph)throw Error('Unknown local street');
  const area={nima:'Nima',jtown:'Jamestown',kaneshie:'Kaneshie',labadi:'Labadi',osu:'Osu',airres:'Airport Residential',legon:'East Legon',trasacco:'Trasacco'}[id];
  const spec=streetSpec(area),items=spec.items;
  Object.assign(spec,{w:graph.w,d:graph.d,spawn:{...graph.spawn},localNetwork:id});
  spec.environment={...neighbourhoodArt(area),type:'street',connected:true};
  items[0]={kind:'street_surface',x:0,z:0};
  for(const [index,x,z]of [[1,-2,3.5],[2,-3,-3],[3,4.25,3.75],[4,3,-3.75],[5,3,-.8],[6,graph.map.x,graph.map.z],[18,graph.estate.x,graph.estate.z]])Object.assign(items[index],{x,z});
  for(let i=0;i<4;i++){
    Object.assign(items[7+i*2],{x:i%2?5.2:-5.2,z:i<2?-5.2:5.2});
    Object.assign(items[8+i*2],{x:i%2?7.5:-7.5,z:i<2?-7:7});
  }
  for(const [i,role]of ['provisions','barber','food'].entries()){
    const lot=graph.lots.find(l=>l.role===role);Object.assign(items[15+i],{x:lot.x,z:lot.z,rot:lot.rot,segment:lot.segment});
  }
  for(const lot of graph.lots.filter(l=>l.role==='venue')){
    const loc=locations.find(l=>l.id===lot.destination),name=loc?.name||lot.destination;
    const item=items.length;items.push({kind:'street_building:5,4',x:lot.x,z:lot.z,rot:lot.rot,segment:lot.segment,label:name,...HOME_ART[id],color:spec.environment.wall});
    spec.zones.push({id:'front-'+lot.destination,label:'Walk to '+name,icon:'ph-door-open',item,acts:[],route:'venue',destination:lot.destination});
  }
  const home=graph.lots.find(l=>l.role==='home');
  // Every occupant sees the same item indices. Only a resident receives the
  // private home route; the shared frontage does not imply property ownership.
  items.push({kind:'street_building:5,4',x:home.x,z:home.z,rot:home.rot,segment:home.segment,localHome:true,label:'RESIDENTIAL ENTRANCE',...HOME_ART[id],color:spec.environment.wall});
  spec.npcs[0].x=-3;spec.npcs[0].z=-4;
  Object.assign(spec.npcs[1],{x:4.25,z:5,patrol:[[4.25,5],[0,4.8],[-4.5,1]]});
  Object.assign(spec.npcs[2],{x:-.5,z:1.5,patrol:[[0,0],[-4,1.5],[0,4.5],[4.5,1]]});
  spec.lights=[{x:-4,z:-3,intensity:8,dist:12},{x:4,z:3,intensity:7,dist:12}];
  return spec;
}
