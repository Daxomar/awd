import test from 'node:test';
import assert from 'node:assert/strict';
import {homeSpec} from '../src/v2/scene/homes.js';
import {propertyRoomSpec} from '../src/v2/scene/property-room.js';

const owner={unit:'osu-001',revision:2,template:'osu',name:'Osu courtyard 1',theme:'coastal',mine:true,canAct:true,canFurnish:true,exit:'n:osu'};

test('property room clones the real template and routes its own exit without touching legacy inventory',()=>{
  const inventory={gas:true,tv:true},base=homeSpec('osu',inventory),before=structuredClone(base);
  const room=propertyRoomSpec(base,owner);
  assert.deepEqual(base,before);assert.deepEqual(inventory,{gas:true,tv:true});
  assert.equal(room.name,owner.name);assert.equal(room.sign.text,owner.name);assert.equal(room.wallColor,'#d7e8e4');
  assert.equal(room.items.length,base.items.length+1);
  const exit=room.zones.at(-1);assert.equal(exit.route,'property-exit');assert.equal(exit.propertyUnit,'osu-001');assert.equal(exit.destination,'n:osu');
  assert.deepEqual(room.items[exit.item],{kind:'doormat',x:base.spawn.x,z:base.spawn.z,label:'Property entrance',acts:[]});
  room.items[0].x=999;assert.notEqual(base.items[0].x,999);
  assert.deepEqual(room.zones.find(z=>z.id==='bed').acts,['sleep','nap']);
});

test('tour preserves furniture presentation and exit while removing every home activity',()=>{
  const base=homeSpec('osu',{gas:true,tv:true,laptop:true}),room=propertyRoomSpec(base,{...owner,mine:false,canAct:false,canFurnish:false});
  assert.ok(room.items.some(i=>i.kind==='tv'));assert.ok(room.items.some(i=>i.kind==='laptop_desk'));
  assert.ok(room.zones.every(z=>z.acts.length===0));assert.ok(room.items.every(i=>i.acts?.length===0));
  assert.equal(room.property.canAct,false);assert.equal(room.property.canFurnish,false);
  assert.ok(base.zones.some(z=>z.acts.length));assert.equal(room.zones.at(-1).route,'property-exit');
});

test('finishes are allowlisted and cannot inject arbitrary material properties or privileges',()=>{
  const base=homeSpec('nima',{}),room=propertyRoomSpec(base,{...owner,theme:'url(https://example.com)',canAct:'true',canFurnish:1});
  assert.equal(room.wallColor,base.wallColor);assert.equal(room.property.canAct,false);assert.equal(room.property.canFurnish,false);
  assert.throws(()=>propertyRoomSpec(base,{}),/verified property/);
});
