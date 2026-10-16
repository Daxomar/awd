// Original condensed local street plans. Coordinates are room-local metres, not
// Phase 3 geographic/fare coordinates. One graph stays in one existing n: room.
export const STREET_VERSION = 1;
const definitions = {
  nima: {name:'Nima compound lanes',width:2.8,nodes:[[-12,-10],[0,-10],[12,-10],[-12,0],[0,0],[12,0],[-12,11],[0,11],[12,11]],edges:[[0,1],[1,2],[0,3],[3,6],[6,7],[1,4],[4,7],[4,5],[5,8],[7,8]],venues:['mosque','viewing'],labels:['Compound Lane','Market Approach','Community Court']},
  jtown: {name:'Jamestown coastal lanes',width:2.6,nodes:[[-13,10],[0,10],[13,10],[-13,0],[0,0],[13,-1],[-10,-11],[3,-11],[13,-10]],edges:[[0,1],[1,2],[0,3],[3,4],[4,5],[3,6],[6,7],[7,8],[8,5],[1,4]],venues:['lighthouse','kenkey'],labels:['Coastal Lane','Lighthouse Approach','Fishing Court']},
  kaneshie: {name:'Kaneshie market approaches',width:4,nodes:[[0,0],[-13,0],[13,0],[0,-12],[0,12],[-12,-11],[12,-11],[-12,11],[12,11]],edges:[[0,1],[0,2],[0,3],[0,4],[1,5],[5,3],[2,6],[1,7],[4,8]],venues:[],labels:['Commercial Road','Transport Approach','Shop Court']},
  labadi: {name:'Labadi residential coast',width:2.8,nodes:[[-13,10],[0,10],[13,10],[13,-9],[0,-9],[-13,-9],[0,0],[-13,0]],edges:[[0,1],[1,2],[2,3],[3,4],[4,5],[5,7],[7,0],[1,6],[6,4],[7,6]],venues:['labadi'],labels:['Coastal Road','Residential Lane','Community Approach']},
  osu: {name:'Osu Oxford Street pilot',width:3.2,nodes:[[0,-14],[0,-7],[0,0],[0,7],[0,14],[-12,-7],[-12,7],[12,-7],[12,7]],edges:[[0,1],[1,2],[2,3],[3,4],[1,5],[5,6],[6,3],[1,7],[7,8],[8,3]],venues:['oxford','restaurant'],labels:['Oxford Approach','Osu Side Street','Residential Court'],pilot:true},
  airres: {name:'Airport Residential garden roads',width:3.2,nodes:[[-12,-10],[0,-10],[12,-6],[12,8],[0,12],[-12,8],[0,0],[-12,0]],edges:[[0,1],[1,2],[2,3],[3,4],[4,5],[5,7],[7,0],[1,6],[6,4]],venues:['airport'],labels:['Garden Road','Residential Crescent','Airport Approach']},
  legon: {name:'East Legon compound courts',width:3.2,nodes:[[-14,0],[0,0],[14,0],[-10,-11],[7,-11],[12,10],[-6,12]],edges:[[0,1],[1,2],[0,3],[3,4],[4,1],[1,5],[5,6],[6,0]],venues:['gymlegon'],labels:['Residential Link','Commercial Court','Garden Lane']},
  trasacco: {name:'Trasacco landscaped courts',width:3.6,nodes:[[0,-14],[0,-7],[0,0],[0,7],[0,14],[-12,-7],[-12,7],[12,0],[12,12]],edges:[[0,1],[1,2],[2,3],[3,4],[1,5],[5,6],[6,3],[2,7],[7,8],[8,4]],venues:[],labels:['Estate Boulevard','Garden Court','Residents Approach']},
};

export const STREET_IDS=Object.freeze(Object.keys(definitions));
export function segmentProjection(point,a,b) {
  const dx=b[0]-a[0],dz=b[1]-a[1],length2=dx*dx+dz*dz;
  const t=Math.max(0,Math.min(1,((point[0]-a[0])*dx+(point[1]-a[1])*dz)/length2));
  const x=a[0]+t*dx,z=a[1]+t*dz;
  return {t,x,z,distance:Math.hypot(point[0]-x,point[1]-z)};
}
export function lotBounds(lot,pad=0) {
  const c=Math.abs(Math.cos(lot.rot)),s=Math.abs(Math.sin(lot.rot));
  const x=lot.w/2*c+lot.d/2*s+pad,z=lot.w/2*s+lot.d/2*c+pad;
  return [lot.x-x,lot.x+x,lot.z-z,lot.z+z];
}
const overlaps=(a,b)=>a[0]<b[1]&&a[1]>b[0]&&a[2]<b[3]&&a[3]>b[2];
function makeGraph(id,def) {
  const nodes=def.nodes.map(([x,z],i)=>({id:'j'+i,x,z}));
  const segments=def.edges.map(([a,b],i)=>({id:id+'-s'+i,a:'j'+a,b:'j'+b,from:def.nodes[a],to:def.nodes[b],width:def.width,label:def.labels[i%def.labels.length]}));
  const candidates=[];
  for(const seg of segments)for(const t of [.5,.2,.8])for(const side of [-1,1]){
    const dx=seg.to[0]-seg.from[0],dz=seg.to[1]-seg.from[1],len=Math.hypot(dx,dz),nx=-dz/len*side,nz=dx/len*side;
    const offset=seg.width/2+1.25+2.25;
    const x=seg.from[0]+dx*t+nx*offset,z=seg.from[1]+dz*t+nz*offset;
    const lot={x,z,w:5,d:4,rot:Math.atan2(-nx,-nz),segment:seg.id,approach:{x:x-nx*2.9,z:z-nz*2.9}};
    const bounds=lotBounds(lot,.25);
    if(bounds.some(v=>Math.abs(v)>19.6)||overlaps(bounds,[-5.5,5.5,-5.5,5.5]))continue;
    // Lots must not intrude on any neighbouring roadway or intersection.
    if(segments.some(other=>{
      if(other===seg)return false;
      const samples=[[bounds[0],bounds[2]],[bounds[1],bounds[2]],[bounds[0],bounds[3]],[bounds[1],bounds[3]],[x,z]];
      return samples.some(p=>segmentProjection(p,other.from,other.to).distance<other.width/2+1.1);
    }))continue;
    candidates.push(lot);
  }
  const lots=[],roles=['home','provisions','barber','food',...def.venues.map(v=>'venue:'+v)];
  for(const role of roles){
    const lot=candidates.find(l=>!lots.some(o=>overlaps(lotBounds(l,.4),lotBounds(o,.4))));
    if(!lot)throw Error('No clear frontage for '+id+' '+role);
    lots.push({...lot,id:role,role:role.startsWith('venue:')?'venue':role,destination:role.startsWith('venue:')?role.slice(6):null});
  }
  for(const lot of candidates){if(lots.length>=roles.length+5)break;if(!lots.some(o=>overlaps(lotBounds(lot,.5),lotBounds(o,.5))))lots.push({...lot,id:'scenery-'+lots.length,role:'scenery'});}
  const gate=nodes.reduce((a,b)=>b.z>a.z?b:a),map=nodes.reduce((a,b)=>b.z<a.z?b:a);
  return {id,version:STREET_VERSION,name:def.name,pilot:!!def.pilot,w:40,d:40,nodes,segments,lots,
    court:{x:0,z:0,w:11,d:11},spawn:{x:0,z:0},estate:{x:gate.x,z:gate.z},map:{x:map.x,z:map.z}};
}
const graphs=Object.fromEntries(STREET_IDS.map(id=>[id,makeGraph(id,definitions[id])]));
export const streetGraph=id=>Object.hasOwn(graphs,id)?graphs[id]:null;
export function isStreetPoint(graph,x,z) {
  if(!graph||!Number.isFinite(x)||!Number.isFinite(z)||Math.abs(x)>=19.8||Math.abs(z)>=19.8)return false;
  const inCourt=Math.abs(x-graph.court.x)<graph.court.w/2&&Math.abs(z-graph.court.z)<graph.court.d/2;
  if(!inCourt&&!graph.segments.some(s=>segmentProjection([x,z],s.from,s.to).distance<=s.width/2+1.25))return false;
  return !graph.lots.some(l=>{const dx=x-l.x,dz=z-l.z,c=Math.cos(l.rot),s=Math.sin(l.rot);return Math.abs(dx*c-dz*s)<=l.w/2+.05&&Math.abs(dx*s+dz*c)<=l.d/2+.05;});
}
export function streetEntry(id,from,home) {
  const graph=streetGraph(id);if(!graph)return null;
  if(from==='home'&&home===id)return {...graph.lots.find(l=>l.role==='home').approach};
  if(from==='e:'+id)return {...graph.estate};
  const venue=graph.lots.find(l=>l.destination===from);return {...(venue?.approach||graph.map)};
}
export function nearestStreetSegment(graph,x,z) {
  return [...graph.segments].sort((a,b)=>segmentProjection([x,z],a.from,a.to).distance-segmentProjection([x,z],b.from,b.to).distance)[0];
}
export function activeStreetSegments(graph,x,z,limit=4) {
  const primary=nearestStreetSegment(graph,x,z);
  return [...graph.segments].sort((a,b)=>{
    const score=s=>segmentProjection([x,z],s.from,s.to).distance-(s.id===primary.id?100:([s.a,s.b].includes(primary.a)||[s.a,s.b].includes(primary.b)?2:0));
    return score(a)-score(b)||a.id.localeCompare(b.id);
  }).slice(0,limit).map(s=>s.id);
}
