import test from 'node:test';
import assert from 'node:assert/strict';
import { STREET_IDS,streetGraph,isStreetPoint,activeStreetSegments,streetEntry } from '../../shared/local-streets.js';
import { connectedStreetSpec,streetArrivalYaw } from '../src/v2/scene/connected-streets.js';
import { Room } from '../src/v2/scene/room.js';
import { clearStreetSurfaces,streetSurfaceStats } from '../src/v2/scene/street-stream.js';
import { canvasFixture,stageFixture,reachable } from './environment-fixture.js';
canvasFixture();

test('all eight deterministic local graphs are connected and geometrically distinct',()=>{
  const signatures=new Set();
  for(const id of STREET_IDS){
    const g=streetGraph(id),seen=new Set([g.nodes[0].id]);
    for(let pass=0;pass<g.nodes.length;pass++)for(const s of g.segments)if(seen.has(s.a)||seen.has(s.b)){seen.add(s.a);seen.add(s.b);}
    assert.equal(seen.size,g.nodes.length,id);assert.ok(g.segments.length>=8);
    assert.equal(new Set(g.segments.map(s=>s.id)).size,g.segments.length);
    signatures.add(JSON.stringify([g.nodes,g.segments.map(s=>[s.a,s.b,s.width])]));
    for(const n of g.nodes)assert.ok(isStreetPoint(g,n.x,n.z),id+' junction '+n.id);
    assert.deepEqual(streetEntry(id,'home',id),g.lots.find(l=>l.role==='home').approach);
    for(const lot of g.lots){assert.ok(isStreetPoint(g,lot.approach.x,lot.approach.z),id+' frontage '+lot.id);assert.ok(Math.cos(streetArrivalYaw(id,lot.approach,0)-lot.rot)>.98,id+' doorway camera');}
    assert.equal(streetArrivalYaw(id,{x:0,z:0},.65),.65);
    assert.equal(isStreetPoint(g,g.w/2+1,0),false);assert.equal(isStreetPoint(g,NaN,0),false);
    assert.equal(isStreetPoint(g,g.lots[0].x,g.lots[0].z),false);
  }
  assert.equal(signatures.size,8);assert.equal(streetGraph('__proto__'),null);assert.ok(streetGraph('osu').pilot);
});

test('connected street navigation reaches every entrance and intersection without crossing solids',()=>{
  for(const id of STREET_IDS){
    const spec=connectedStreetSpec(id),room=new Room(stageFixture()).build(spec),cells=reachable(room),nav=room.nav;
    for(const z of spec.zones){const u=room.usePoint(room.items[z.item],z.use||0),[i,j]=room.nearestFree(u.x,u.z);assert.ok(cells.has(j*nav.nx+i),id+' '+z.id);assert.ok(room.path(room.spawn.x,room.spawn.z,u.x,u.z).length,id+' '+z.id+' path');}
    for(const n of streetGraph(id).nodes){const [i,j]=room.nearestFree(n.x,n.z);assert.ok(cells.has(j*nav.nx+i),id+' intersection '+n.id);}
    room.dispose();
  }
});

test('walking across segment joins retains surfaces and bounds active detail/resources',()=>{
  const room=new Room(stageFixture()).build(connectedStreetSpec('osu')),stream=room.streetStream,base=stream.base;
  const surface=base.getObjectByName('joined-road-surface'),released={geometry:0,texture:0};
  assert.equal(surface.geometry.attributes.position.count,4);
  surface.geometry.addEventListener('dispose',()=>released.geometry++);surface.material.map.addEventListener('dispose',()=>released.texture++);
  const frontages=room.items.filter(it=>it.streamed),indices=frontages.map(it=>room.items.indexOf(it));
  let sawLoaded=false,sawUnloaded=false;
  for(let visit=0;visit<5;visit++)for(const s of stream.graph.segments)for(const t of [0,.25,.5,.75,1]){
    const x=s.from[0]+(s.to[0]-s.from[0])*t,z=s.from[1]+(s.to[1]-s.from[1])*t;
    stream.update(x,z);assert.ok(stream.active.size<=4);assert.ok(base.parent===room.group);
    const wanted=activeStreetSegments(stream.graph,x,z);assert.deepEqual(new Set(stream.active.keys()),new Set(wanted));
    for(const rec of frontages){assert.equal(rec.loaded,wanted.includes(rec.spec.segment));if(rec.loaded)sawLoaded=true;else sawUnloaded=true;}
  }
  assert.ok(sawLoaded&&sawUnloaded);assert.deepEqual(frontages.map(it=>room.items.indexOf(it)),indices);
  assert.ok(stream.disposals>0);clearStreetSurfaces();room.dispose();assert.equal(stream.active.size,0);assert.equal(stream.baseResources.values.size,0);assert.equal(base.parent,null);
  assert.deepEqual(released,{geometry:1,texture:1});
});

test('surface reuse is bounded and eviction cannot dispose another live room',()=>{
  clearStreetSurfaces();
  const a=new Room(stageFixture()).build(connectedStreetSpec('osu')),b=new Room(stageFixture()).build(connectedStreetSpec('osu'));
  const material=a.streetStream.base.getObjectByName('joined-road-surface').material;
  assert.equal(b.streetStream.base.getObjectByName('joined-road-surface').material,material);
  let released=0;material.map.addEventListener('dispose',()=>released++);
  clearStreetSurfaces();a.dispose();assert.equal(released,0);b.dispose();assert.equal(released,1);
  for(const id of STREET_IDS){const r=new Room(stageFixture()).build(connectedStreetSpec(id));r.dispose();assert.ok(streetSurfaceStats().cached<=2);}
  clearStreetSurfaces();assert.equal(streetSurfaceStats().cached,0);
});
