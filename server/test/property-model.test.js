import test from 'node:test';
import assert from 'node:assert/strict';
import {HOMES} from '../src/game/data.js';
import {FINISHES,LEASE_MS,LISTING_HOURS,MAX_ASKING_PRICE,PROPERTY_ITEM_IDS,catalogue,furnitureFor,listingIsLive,propertyId,propertyPlace,unitItems,validAskingPrice,validAssetId,validUnitId,valuation} from '../src/game/property-model.js';
import {PropertyService} from '../src/property-service.js';
import * as Game from '../src/game/rules.js';

test('finite catalogue preserves every legacy home and the four approved purchase prices',()=>{
  const before=structuredClone(HOMES),rows=catalogue();
  assert.equal(rows.length,18);assert.equal(new Set(rows.map(r=>r.id)).size,18);
  for(const [id,price] of Object.entries({osu:1600000,airres:3200000,legon:4200000,trasacco:25000000})){
    const homes=rows.filter(r=>r.template===id&&r.residential);assert.equal(homes.length,2);
    for(const row of homes){assert.equal(row.basePrice,price);assert.equal(row.purchaseEnabled,true);}
  }
  for(const row of rows.filter(r=>!r.residential||['nima','jtown','kaneshie','labadi'].includes(r.template))){assert.equal(row.basePrice,null);assert.equal(row.purchaseEnabled,false);}
  assert.deepEqual(HOMES,before);
  for(const row of rows){assert.ok(validUnitId(row.id));assert.ok(HOMES[row.template]);assert.ok(HOMES[row.neighbourhood]);assert.ok(Number.isFinite(row.x)&&Number.isFinite(row.z));}
  for(const kind of ['single-room','compound-house','apartment','townhouse','detached-house','premium-residence','commercial-unit'])assert.ok(rows.some(r=>r.class===kind));
});

test('catalogue capacity is bounded and expanding capacity retains existing stable IDs',()=>{
  const one=catalogue({unitsPerHome:1}),four=catalogue({unitsPerHome:4});
  assert.equal(one.length,10);assert.equal(four.length,34);
  for(const row of one)assert.deepEqual(four.find(r=>r.id===row.id),row);
  for(const unitsPerHome of [0,-1,5,2.5,NaN,'2',true])assert.throws(()=>catalogue({unitsPerHome}));
});

test('unapproved production price overrides fail; explicit disposable fixtures affect only named units',()=>{
  assert.throws(()=>catalogue({priceOverrides:{'awd-nima-01':100}}),/test/);
  for(const price of [0,-1,1.5,Infinity,'100',MAX_ASKING_PRICE+1])assert.throws(()=>catalogue({testMode:true,priceOverrides:{'awd-nima-01':price}}));
  assert.throws(()=>catalogue({testMode:true,priceOverrides:{'not-a-unit':100}}));
  const fixture=catalogue({testMode:true,priceOverrides:{'awd-nima-01':100}});
  assert.equal(fixture.find(r=>r.id==='awd-nima-01').basePrice,100);
  assert.equal(fixture.find(r=>r.id==='awd-nima-02').basePrice,null);
  assert.equal(catalogue().find(r=>r.id==='awd-nima-01').basePrice,null);
});

test('property references and prices reject forged wire values',()=>{
  for(const id of ['',null,42,'../awd-nima-01','unit:awd-nima-01','a'.repeat(65),'awd-\u200bnima-01','__proto__'])assert.equal(validUnitId(id),false);
  assert.equal(propertyPlace('awd-nima-01'),'unit:awd-nima-01');
  assert.equal(propertyId('unit:awd-nima-01'),'awd-nima-01');
  assert.equal(propertyId('home'),null);assert.equal(propertyPlace('../home'),null);
  for(const value of [null,'1',0,-1,1.5,NaN,Infinity,MAX_ASKING_PRICE+1])assert.equal(validAskingPrice(value),false);
  assert.equal(validAskingPrice(1),true);assert.equal(validAskingPrice(MAX_ASKING_PRICE),true);
  for(const value of [null,'1',0,-1,1.5,NaN,Number.MAX_SAFE_INTEGER+1])assert.equal(validAssetId(value),false);
  assert.equal(validAssetId(1),true);
});

test('furnishing catalogue uses only existing furniture prices and does not convert personal items',()=>{
  const furniture=furnitureFor(Game.ITEMS);
  assert.equal(furniture.length,11);assert.equal(new Set(furniture.map(x=>x.id)).size,11);
  for(const item of furniture){assert.equal(item.price,Game.ITEMS[item.id][1]);assert.equal(item.name,Game.ITEMS[item.id][0]);}
  assert.equal(PROPERTY_ITEM_IDS.includes('ring'),false);assert.equal(PROPERTY_ITEM_IDS.includes('dslr'),false);
  assert.deepEqual(unitItems([{item:'gas'},{item:'ring'},{item:'fridge'},{item:'__proto__'}]),{gas:true,fridge:true});
});

test('free cosmetic finishes and valuation cannot promise furnishing appreciation',()=>{
  assert.deepEqual(FINISHES.map(x=>x.id),['neutral','coastal','earth']);
  assert.ok(FINISHES.every(x=>x.cost===0));assert.ok(Object.isFrozen(FINISHES));
  assert.equal(valuation({base_price:null}).estimatedValue,null);
  assert.equal(valuation({base_price:'1600000',finish:'earth',upgrades:['costly']}).estimatedValue,1600000);
  assert.match(valuation({base_price:1}).estimateNote,/do not guarantee/);
});

test('listing expiry boundaries and bounded lease are deterministic',()=>{
  const now=1800000000000,listing={status:'listed',expires_at:new Date(now+1)};
  assert.equal(listingIsLive(listing,now),true);
  assert.equal(listingIsLive({...listing,expires_at:new Date(now)},now),false);
  assert.equal(listingIsLive({...listing,status:'sold'},now),false);
  assert.equal(listingIsLive(null,now),false);
  assert.deepEqual(LISTING_HOURS,[24,48,72]);assert.equal(LEASE_MS,10000);
});

test('public DTO hides owner identifiers and private furnishing assets',()=>{
  const service=new PropertyService(null),row={id:'awd-nima-01',owner:123,name:'Unit',area:'Nima',neighbourhood:'nima',template:'nima',class:'single-room',x:1,z:2,base_price:null,purchase_enabled:false,last_sale_price:100,residential:true,finish:'earth',upgrades:[],revision:'2'};
  const assets=[{id:'3',owner:123,item:'gas'}],dto=service.dto(row,null,assets,456,null,Date.now(),true);
  assert.equal(dto.mine,false);assert.equal(dto.canTour,false);assert.deepEqual(dto.items,[]);assert.equal(dto.finish,null);
  assert.equal('owner' in dto,false);assert.equal('acct' in dto,false);assert.equal(JSON.stringify(dto).includes('123'),false);
  const mine=service.dto(row,null,assets,123,row.id,Date.now(),true);
  assert.equal(mine.primary,true);assert.equal(mine.canList,false);assert.deepEqual(mine.items,[{id:3,item:'gas',name:'Gas cooker'}]);
});

test('trusted descriptors use per-unit items and never infer legacy belongings',()=>{
  const service=new PropertyService(null),row={id:'awd-nima-01',owner:123,name:'Unit',neighbourhood:'nima',template:'nima',residential:true,finish:'coastal',upgrades:[],revision:'4',x:1,z:2};
  const owner=service.descriptor(row,[{item:'gas'}],123,1000),tour=service.descriptor(row,[{item:'gas'}],456,1000);
  assert.deepEqual(owner.items,{gas:true});assert.equal(owner.comfort,HOMES.nima.comfort);assert.equal(owner.exit,'n:nima');assert.equal(owner.expiresAt,11000);
  assert.equal(owner.canAct,true);assert.equal(tour.canAct,false);assert.equal(tour.mine,false);
  assert.equal(service.descriptor({...row,residential:false},[],123,1000).canAct,false);
});
