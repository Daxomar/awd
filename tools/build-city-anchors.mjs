// Resolve curated display districts against the frozen OSM database.
import fs from 'node:fs';
import {DISTRICT_SPECS} from '../client/src/v2/scene/city/districts.js';
const data = JSON.parse(fs.readFileSync('client/public/assets/greater-accra.json', 'utf8'));
const cat = JSON.parse(fs.readFileSync('client/test/fixtures/city-catalog.json', 'utf8'));
const norm = s => s.toLowerCase().replace(/[^a-z0-9]/g, '');
const overrides = {jamestown:132387846, abelemkpe:30748442, la:5016517876, adenta:2148020762, ministries:102775650, 'community-25':3159027048, trasacco:1831819675, ridge:105936375,'legon-hills':8196274245};
const anchors = {};
const center = points => [0,1].map(i => Math.round(points.reduce((s,p) => s+p[i],0)/points.length));
for (const [id,name,,,,alias] of DISTRICT_SPECS) {
  const place = overrides[id] ? data.places.find(p => p.osm===overrides[id]) : data.places.find(p => [norm(alias||name),norm(name)].includes(norm(p.name)));
  if (place) {anchors[id]={osm:place.osm}; continue;}
  if (id==='high-street'||id==='circle') {
    const ways=data.roads.filter(r=>r.name===(id==='circle'?'Kwame Nkrumah Circle':'High Street'));
    anchors[id]={p:center(ways.flatMap(r=>r.p)),source:'Representative average of sourced OSM '+(id==='circle'?'Circle junction':'High Street')+' ways',osmWays:ways.map(r=>r.osm)};
  } else if (id==='forest') {
    const polygon=data.green.find(g=>g.osm===13975296);anchors[id]={p:center(polygon.rings[0]),source:'Representative centre of OSM Achimota Forest Reserve way13975296',osmWay:polygon.osm};
  } else if (id==='tema-industrial') {
    const node=data.places.find(p=>p.osm===12862616082);anchors[id]={p:node.p,source:'OSM Ports & Harbour place node12862616082; representative port/industrial district, not a boundary',osmNode:node.osm};
  } else if(id==='tema-heavy-industry'){
    const area=data.features.find(f=>f.osm===791950334);anchors[id]={p:center(area.p),source:'Representative centre of OSM Heavy Industrial Area way791950334',osmWay:area.osm};
  } else if (id==='makola'||id==='tetteh-quarshie') {
    const venue=cat.locs.find(l=>l.id===(id==='makola'?'makola':'mall'));anchors[id]={p:[venue.x,venue.z],source:'Art anchor: existing '+venue.name+' game coordinate; approximate district centre'};
  } else throw new Error(`Unresolved district ${id} (${name})`);
}
fs.writeFileSync('client/public/assets/district-anchors.json',JSON.stringify(anchors,null,2)+'\n');
console.log(`${Object.keys(anchors).length} districts resolved`);
