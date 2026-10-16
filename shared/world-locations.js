// Presentation coordinates are deliberately separate from authoritative metres.
// Never pass `playable` to travel/fare calculations or save it as player position.
export const CITY_NEIGHBOURHOODS = Object.freeze([
  {id:'kaneshie',name:'Kaneshie',x:-18,z:0,family:'transport'},
  {id:'circle',name:'Circle',x:-5,z:0,family:'commercial'},
  {id:'nima',name:'Nima',x:-5,z:-12,family:'compound'},
  {id:'ridge',name:'Ridge',x:8,z:0,family:'office'},
  {id:'central',name:'Accra Central',x:-5,z:12,family:'commercial'},
  {id:'jtown',name:'Jamestown',x:-18,z:12,family:'historic'},
  {id:'osu',name:'Osu',x:8,z:12,family:'mixed'},
  {id:'labadi',name:'Labadi',x:21,z:12,family:'coastal'},
  {id:'labone',name:'Labone',x:21,z:0,family:'established'},
  {id:'airres',name:'Airport Residential',x:8,z:-12,family:'established'},
  {id:'airport',name:'Airport City',x:21,z:-12,family:'office'},
  {id:'legon',name:'East Legon',x:8,z:-24,family:'modern'},
  {id:'university',name:'Legon',x:-5,z:-24,family:'campus'},
  {id:'trasacco',name:'Trasacco',x:21,z:-24,family:'modern'},
  {id:'spintex',name:'Spintex',x:34,z:-12,family:'industrial'}
].map(Object.freeze));
export const CITY_LINKS=Object.freeze([
  ['kaneshie','circle'],['circle','ridge'],['ridge','labone'],['labone','labadi'],
  ['kaneshie','jtown'],['jtown','central'],['central','osu'],['osu','labadi'],
  ['circle','nima'],['nima','university'],['nima','airres'],['airres','airport'],
  ['airres','legon'],['legon','trasacco'],['airport','trasacco'],['airport','spintex'],
  ['airres','ridge'],['ridge','osu'],['circle','central'],['airport','labone'],['university','legon']
].map(Object.freeze));

const AREAS={Circle:'circle','Accra Central':'central',Jamestown:'jtown',Osu:'osu',Ridge:'ridge',
  'Korle Bu':'jtown',La:'labadi',Labadi:'labadi',Labone:'labone',Nima:'nima',
  'Tetteh Quarshie':'airport',Legon:'university',Airport:'airport',Spintex:'spintex',
  Kaneshie:'kaneshie','Airport Residential':'airres','East Legon':'legon',Trasacco:'trasacco'};
const order=(a,b)=>a.id<b.id?-1:a.id>b.id?1:0;
export function worldLocations(cat) {
  const groups=new Map(CITY_NEIGHBOURHOODS.map(n=>[n.id,[]]));
  const inputs=[...cat.locs,...Object.entries(cat.homes).map(([key,h])=>({...h,id:'h:'+key,homeTemplate:key}))];
  for(const place of inputs){
    const district=place.homeTemplate||place.neighbourhood||place.estate||AREAS[place.area];
    if(!groups.has(district))throw new Error(`No playable-world mapping for ${place.id}`);
    if(!Number.isFinite(place.x)||!Number.isFinite(place.z))throw new Error(`Invalid geographic anchor ${place.id}`);
    groups.get(district).push(place);
  }
  const result=[];
  for(const node of CITY_NEIGHBOURHOODS){
    const members=groups.get(node.id).sort(order);
    if(members.length>16)throw new Error(`Authored neighbourhood capacity exceeded: ${node.id}`);
    for(let i=0;i<members.length;i++){
      const p=members[i],col=i%4,row=Math.floor(i/4),home=!!p.homeTemplate;
      // Streets run between blocks; front doors face a pedestrian frontage.
      const x=node.x+[-4.2,-1.4,1.4,4.2][col],z=node.z+[-1.4,1.4,-4.2,4.2][row];
      result.push({id:p.id,name:p.name,type:home?'home-template':p.estate?'estate':p.neighbourhood?'street':'venue',
        neighbourhood:node.id,geographic:{x:p.x,z:p.z},playable:{x,z},
        availability:{open:p.open||null,days:p.days||null,authority:'server'},
        ownership:{kind:home?'legacy-per-player':'public',account:null},
        entry:{requiresAuthentication:true,rule:home?'existing housing ownership/rental checks':p.estate?'existing estate/home permissions':'existing destination rules'},
        activities:(p.acts||[]).map(a=>({id:a.id,label:a.label,tags:a.tags||[]})),
        visual:{family:node.family,interactive:!home,representation:home?'housing-template':'destination-building'},
        navigation:{destination:home?'home':p.id,geographic:{x:p.x,z:p.z}},
        instance:{kind:home?'private-authorized-home':p.estate?'estate':p.neighbourhood?'local-street':'existing-public-room'},
        homeTemplate:p.homeTemplate||null});
    }
  }
  return result;
}

export function playableAnchor(locations,x,z){
  let best=null,distance=Infinity;
  for(const l of locations){const d=(l.geographic.x-x)**2+(l.geographic.z-z)**2;if(d<distance){best=l;distance=d;}}
  // Used for ad anchors and the current home fallback, never authoritative travel.
  return best ? [best.playable.x,best.playable.z] : [0,0];
}
