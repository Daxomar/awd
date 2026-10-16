import { DISTRICT_SPECS, FAMILIES } from './city/districts.js';

// Art direction only. No property, progression, destination or action rules live here.
export const HOME_ART = {
  nima: { district:'nima', style:'compound', accent:'#518776', wall:'#eee5d4', floor:'concrete', ground:'#c6bca9', wood:'#825b40', cloth:'#527d83', layout:'courtyard-room' },
  jtown: { district:'jamestown', style:'coastal', accent:'#497d94', wall:'#f0e5d3', floor:'terrazzo', ground:'#d2c2ae', wood:'#97654b', cloth:'#c58354', layout:'coastal-room' },
  kaneshie: { district:'kaneshie', style:'chamber', accent:'#a5674b', wall:'#f0dfc9', floor:'wood', ground:'#c49b72', wood:'#76513c', cloth:'#587f76', layout:'chamber-hall' },
  labadi: { district:'la', style:'coastal', accent:'#488985', wall:'#f2ead6', floor:'tiles', ground:'#ded5bf', wood:'#b88c60', cloth:'#528d8c', layout:'wet-room-studio' },
  osu: { district:'osu', style:'veranda', accent:'#aa6655', wall:'#eae7dd', floor:'wood', ground:'#b88c66', wood:'#715240', cloth:'#b7725e', layout:'veranda-apartment' },
  airres: { district:'airport-residential', style:'gallery', accent:'#537765', wall:'#eeeae1', floor:'terrazzo', ground:'#d9d5c8', wood:'#937356', cloth:'#668078', layout:'garden-flat' },
  legon: { district:'east-legon', style:'modern', accent:'#51706c', wall:'#e8e1d4', floor:'wood', ground:'#a17c58', wood:'#604b3e', cloth:'#5a7772', layout:'family-court' },
  trasacco: { district:'trasacco', style:'villa', accent:'#385e59', wall:'#f2eee4', floor:'stone', ground:'#e5ded1', wood:'#7e674d', cloth:'#ece5d8', layout:'pool-terrace' },
};
const groups = {
  transport:['circle','airport'], market:['makola','kantamanto'], food:['muni','chopbar','kenkey','restaurant','aboki','fanyogo'],
  retail:['oxford','mall','cars','momo'], night:['vibes','viewing','cinema','radio'], office:['hub','bank'],
  medical:['ridge','korlebu'], civic:['police','court','ama'], heritage:['memorial','blackstar','castle','lighthouse'],
  coast:['canoes','labadi'], fitness:['bukom','stadium','gymlegon'], community:['funeral','church','mosque'], campus:['ug'], hotel:['hotel'],
};
const palette = {
  transport:['#657b76','#dcd3be'],market:['#a95e42','#e8dcc2'],food:['#637c4e','#eee2c9'],retail:['#487b78','#ede5d5'],
  night:['#87636e','#343745'],office:['#4d7569','#e7e7df'],medical:['#5b938a','#edf1e9'],civic:['#527185','#e4e3db'],
  heritage:['#a6794b','#e7ddc7'],coast:['#477f89','#f0dfb9'],fitness:['#a45e45','#dfddd2'],community:['#786c55','#eee5ce'],campus:['#925b43','#efdfbc'],hotel:['#577a6c','#f0e7d5'],
};
export const VENUE_ART = Object.fromEntries(Object.entries(groups).flatMap(([category, ids])=>ids.map((id,i)=>[id,{category,accent:palette[category][0],wall:palette[category][1],variant:i}])));
export function neighbourhoodArt(area) {
  const id = Object.keys(HOME_ART).find(id => HOME_ART[id].district === area || ({nima:'Nima',jtown:'Jamestown',kaneshie:'Kaneshie',labadi:'Labadi',osu:'Osu',airres:'Airport Residential',legon:'East Legon',trasacco:'Trasacco'})[id] === area) || 'nima';
  const art=HOME_ART[id],district=DISTRICT_SPECS.find(d=>d[0]===art.district);
  return {...art,id,family:district[2],familyArt:FAMILIES[district[2]]};
}
export function dressHome(spec, id, owned={}) {
  const art=HOME_ART[id]||HOME_ART.nima;
  spec.environment={...art,type:'home',id};
  spec.floor=art.floor;spec.floorColor=art.ground;spec.wallColor=art.wall;
  for(const it of spec.items){
    if(it.kind.startsWith('dado:'))it.color=art.accent;
    if(['sofa','armchair','window_curtain'].includes(it.kind))it.color=art.cloth;
    if(['bed','wardrobe','coffee_table','dining_table'].includes(it.kind))it.color=art.wood;
    if(it.kind==='bed'){it.sheet=art.cloth;it.upgraded=!!owned.bed;}
  }
  if(id==='jtown'){
    const bed=spec.items.find(i=>i.key==='bed');Object.assign(bed,{x:-1.25,z:-1.7,rot:Math.PI/2});
    for(const it of spec.items){if(it.kind==='standing_fan'){it.x=-.2;it.z=.1;}if(it.kind==='barrel')it.z=-.25;if(it.kind==='bucket')it.z=.55;if(it.key==='desk'||it.kind==='plastic_table'){it.x=.65;it.z=.75;}}
  }
  if(id==='osu')for(const it of spec.items){if(it.kind.startsWith('half_wall:')){it.kind='half_wall:1.35';it.z=-2.85;}if(it.key==='desk')it.x=.65;if(it.kind==='dining_table')it.z=-.1;}

  const partition={kaneshie:[-.13,-1.85,1.55,Math.PI/2],labadi:[2.65,-.6,1.6,0],osu:[3,-1.05,1.9,0],airres:[3.15,-1.6,2.3,0],legon:[3.5,-2.1,2.6,0],trasacco:[4.6,-2.6,2.5,0]}[id];
  if(partition){const [x,z,len,rot]=partition;spec.items.push({kind:`room_divider:${len},1.05`,x,z,rot,color:art.wall,trim:art.wood});}
  if(owned.solar)spec.items.push({kind:'solar_unit',x:spec.w/2-.35,z:spec.d/2-.3,rot:-Math.PI/2});
  if(owned.dslr)spec.items.push({kind:'camera_case',x:0,z:spec.d/2-.32});
  // Built-in AC stays in the established higher-tier specifications. Purchased
  // equipment remains controlled solely by homeSpec's existing ownership filters.
  return spec;
}
export function dressVenue(spec,id) {
  const art=VENUE_ART[id];if(!art)throw new Error(`Missing venue art direction: ${id}`);
  spec.environment={...art,type:'venue',id};
  if(id==='funeral'){spec.items.find(i=>i.key==='dj').x=3.8;spec.npcs.find(n=>n.label==='DJ Sly').x=4.45;}
  if(id==='church'){spec.items.find(i=>i.key==='choir').rot=Math.PI;const npc=spec.npcs.find(n=>n.label==='Bro. Eli');npc.z=-3.15;npc.rot=Math.PI;}

  if(id==='makola')spec.items.push({kind:'market_table',x:-1.8,z:.1,decorative:true},{kind:'clothes_rack:1.6',x:-4.25,z:-2.4,rot:Math.PI/2,decorative:true});
  if(id==='court')spec.items.push({kind:'desk',x:2,z:-2.8,color:'#795b44',decorative:true},{kind:'notice_board',x:2,z:-3.9,decorative:true});
  if(id==='restaurant')spec.items.push({kind:'wall_shelf:2',x:0,z:-4,color:'#81664d',decorative:true},{kind:'picture',x:-2,z:-4,arg:1.1,decorative:true});
  if(id==='gymlegon')spec.items.push({kind:'mirror',x:0,z:-4,decorative:true},{kind:'wooden_bench',x:3,z:2.9,color:'#8d7960',decorative:true});
  if(!spec.outdoor)spec.wallColor=art.wall;
  for(const it of spec.items)if(it.kind.startsWith('dado:'))it.color=art.accent;
  return spec;
}
