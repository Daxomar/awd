import * as Game from './game/rules.js';
import {MIN_AGE_H} from './social.js';
import {event} from './game/life-progression.js';
import {FINISHES,LEASE_MS,LISTING_HOURS,PROPERTY_ITEM_IDS,furnitureFor,listingIsLive,propertyPlace,unitItems,validAskingPrice,validAssetId,validUnitId,valuation} from './game/property-model.js';
import {activeListing,bumpRevision,expireListing,installed,lockUnit,migrateProperties,recordProperty} from './property-store.js';

const assetView=a=>({id:Number(a.id),item:a.item,name:Game.ITEMS[a.item]?.[0]||'Furniture'});
const activePlayer=(p,now)=>{if(!p.state?.onboarded)throw Error('Finish creating your life first.');if(p.state.flags?.jailUntil>now)throw Error('Property transactions are unavailable in custody.');};
const idle=p=>{if(p.state.busy||p.state.shift)throw Error('Finish your current activity or shift first.');};
const ownerOnly=(row,acct)=>{if(row.owner!==acct)throw Error('Only the property owner can do that.');};
const noListing=listing=>{if(listing)throw Error('Cancel the active sale listing before changing this property.');};
const wholeId=id=>Number.isSafeInteger(Number(id))?Number(id):null;
const asTime=value=>new Date(value).getTime();

/** The caller owns withMoney, request receipts, commit and all post-commit effects. */
export class PropertyService {
  constructor(pool,options={}){this.pool=pool;this.options=options;}
  async migrate(){await migrateProperties(this.pool,this.options);}

  async status(db,accountId,now=Date.now(),{unit=null}={}){
    if(unit!==null&&!validUnitId(unit))throw Error('Choose a valid property.');
    const [units,listings,assets,residence,storage]=await Promise.all([
      db.query('select * from world_properties order by area,id'),
      db.query("select * from property_listings where status='listed' and expires_at>to_timestamp($1/1000.0) order by id",[now]),
      db.query('select id,item,owner,unit,paid from property_furnishings where unit is not null order by id'),
      db.query('select unit from property_residences where acct=$1',[accountId]),
      db.query('select id,item from property_furnishings where owner=$1 and unit is null order by id limit 200',[accountId]),
    ]);
    const primary=residence.rows[0]?.unit||null,listingMap=new Map(listings.rows.map(x=>[x.unit,x]));
    const assetsByUnit=new Map();for(const a of assets.rows){if(!assetsByUnit.has(a.unit))assetsByUnit.set(a.unit,[]);assetsByUnit.get(a.unit).push(a);}
    const cards=units.rows.map(row=>this.dto(row,listingMap.get(row.id),assetsByUnit.get(row.id)||[],accountId,primary,now,false));
    const row=unit?units.rows.find(row=>row.id===unit):null;
    if(unit&&!row)throw Error('Property not found.');
    const detail=row?this.dto(row,listingMap.get(row.id),assetsByUnit.get(row.id)||[],accountId,primary,now,true):null;
    return {catalogue:cards,owned:cards.filter(x=>x.mine),storage:storage.rows.map(assetView),primary,
      finishes:FINISHES,furniture:furnitureFor(Game.ITEMS),detail,
      legacyRentNotice:'Selecting a finite property does not cancel rent or remove your existing home and belongings.'};
  }

  dto(row,listing,assets,accountId,primary,now,detail){
    const mine=row.owner===accountId,live=listingIsLive(listing,now),canTour=mine||row.owner===null||live;
    const visible=detail&&canTour;
    const includes=visible&&live?assets.filter(a=>listing.included.map(Number).includes(Number(a.id))).map(assetView):[];
    return {id:row.id,name:row.name,area:row.area,neighbourhood:row.neighbourhood,template:row.template,class:row.class,
      x:row.x,z:row.z,basePrice:row.base_price===null?null:Number(row.base_price),...valuation(row),
      askingPrice:live?Number(listing.price):null,lastSalePrice:row.last_sale_price===null?null:Number(row.last_sale_price),
      purchaseEnabled:row.purchase_enabled,owned:row.owner!==null,mine,listed:live,
      listing:live?{id:Number(listing.id),price:Number(listing.price),furnished:listing.furnished,expiresAt:asTime(listing.expires_at),includes}:null,
      primary:primary===row.id,canTour,canBuy:!mine&&(live||row.owner===null&&row.purchase_enabled&&row.base_price!==null),
      canList:mine&&!live&&primary!==row.id,canFurnish:mine&&!live,residential:row.residential,
      finish:visible||mine?row.finish:null,upgrades:visible||mine?row.upgrades:[],items:visible?assets.map(assetView):[],
      furnished:canTour?assets.length>0:null,revision:Number(row.revision)};
  }

  descriptor(row,assets,accountId,now){
    const mine=row.owner===accountId,h=Game.DATA.HOMES[row.template];
    return {unit:row.id,revision:Number(row.revision),template:row.template,name:row.name,items:unitItems(assets),
      mine,canAct:mine&&row.residential,canFurnish:mine,theme:row.finish,upgrades:row.upgrades,
      comfort:h.comfort,power:h.power,x:row.x,z:row.z,neighbourhood:row.neighbourhood,
      exit:'n:'+row.neighbourhood,expiresAt:now+LEASE_MS};
  }

  async resolveAccess(accountId,unitId,now=Date.now(),{revision=null,db=this.pool}={}){
    if(!validUnitId(unitId))return null;
    const row=(await db.query('select * from world_properties where id=$1',[unitId])).rows[0];
    if(!row||!Game.DATA.HOMES[row.template]||revision!==null&&Number(row.revision)!==revision)return null;
    const listing=await activeListing(db,unitId,now);
    if(row.owner!==accountId&&row.owner!==null&&!listing)return null;
    const assets=await installed(db,unitId);
    // Another transaction may revoke access between the component reads. Recheck
    // the revision after fetching furnishings before returning a room capability.
    const current=(await db.query('select revision,owner from world_properties where id=$1',[unitId])).rows[0];
    if(!current||Number(current.revision)!==Number(row.revision)||current.owner!==row.owner)return null;
    const descriptor=this.descriptor(row,assets,accountId,now);
    descriptor.canFurnish=descriptor.mine&&!listing;
    if(!descriptor.mine&&listing)descriptor.expiresAt=Math.min(descriptor.expiresAt,asTime(listing.expires_at));
    return descriptor;
  }

  async primary(accountId,now=Date.now(),{db=this.pool}={}){
    const row=(await db.query('select r.unit from property_residences r join world_properties p on p.id=r.unit where r.acct=$1 and p.owner=$1',[accountId])).rows[0];
    return row?this.resolveAccess(accountId,row.unit,now,{db}):null;
  }

  async action(db,p,msg,now=Date.now()){
    activePlayer(p,now);
    const op=typeof msg.op==='string'?msg.op.replace(/^property_/,''):'';
    if(op==='primary'&&msg.unit===null){idle(p);await db.query('delete from property_residences where acct=$1',[p.acct]);return {ok:true,note:'Your existing legacy home is the primary residence again.'};}
    if(!validUnitId(msg.unit))throw Error('Choose a valid property.');
    const row=await lockUnit(db,msg.unit);if(!row||!Game.DATA.HOMES[row.template])throw Error('Property not found.');
    const expired=await expireListing(db,row,now),listing=await activeListing(db,row.id,now,{lock:true});
    const changed=()=>({unit:row.id,revision:Number(row.revision)});
    const mutate=async(kind,facts={})=>{await bumpRevision(db,row,now);await recordProperty(db,row,p.acct,kind,now,facts);};

    if(op==='inspect')return {ok:true,note:'Property inspected.',properties:await this.status(db,p.acct,now,{unit:row.id}),...(expired?{propertyChanged:changed()}: {})};
    if(op==='travel'){
      idle(p);
      const context=await this.resolveAccess(p.acct,row.id,now,{db});if(!context)throw Error('This private property is not available for entry.');
      return {ok:true,note:'Travel request verified.',travel:{to:propertyPlace(row.id),x:row.x,z:row.z,name:row.name,unit:row.id,revision:Number(row.revision),mode:msg.mode||'trotro'},...(expired?{propertyChanged:changed()}: {})};
    }
    if(op==='exit'){
      idle(p);if(p.state.place!==propertyPlace(row.id))throw Error('Enter this property before using its door.');
      const destination=Game.LOC['n:'+row.neighbourhood];if(!destination)throw Error('This neighborhood is not connected yet.');
      return {ok:true,note:'Neighborhood journey verified.',travel:{to:destination.id,x:destination.x,z:destination.z,name:destination.name,mode:msg.mode||'walk'}};
    }
    if(op==='home_act'){
      if(p.state.place!==propertyPlace(row.id)||row.owner!==p.acct||!row.residential)throw Error('Home activities require your own residential property.');
      if(typeof msg.action!=='string'||!Object.hasOwn(Game.HOME_ACTS,msg.action))throw Error('Choose an available home activity.');
      idle(p);const context=this.descriptor(row,await installed(db,row.id,{lock:true}),p.acct,now);context.canFurnish=!listing;
      return {ok:true,note:'Home activity verified.',homeAction:context,action:msg.action};
    }
    idle(p);
    if(op==='buy')return this.buy(db,p,msg,row,listing,now);
    ownerOnly(row,p.acct);
    if(op==='cancel'){
      if(!listing)return {ok:true,note:'This property has no active listing.',...(expired?{propertyChanged:changed()}: {})};
      if(msg.listing!==undefined&&msg.listing!==Number(listing.id))throw Error('The active listing has changed. Refresh before cancelling.');
      await db.query("update property_listings set status='cancelled',closed_at=to_timestamp($2/1000.0) where id=$1",[listing.id,now]);
      await mutate('cancelled',{listing:Number(listing.id)});return {ok:true,note:'Sale listing cancelled. Property access is private again.',propertyChanged:changed()};
    }
    noListing(listing);
    if(op==='primary'){
      if(!row.residential)throw Error('Commercial units cannot be primary residences.');
      await db.query('insert into property_residences(acct,unit,updated_at) values($1,$2,to_timestamp($3/1000.0)) on conflict(acct) do update set unit=excluded.unit,updated_at=excluded.updated_at',[p.acct,row.id,now]);
      await recordProperty(db,row,p.acct,'primary',now);
      return {ok:true,note:'Primary residence selected. Your existing rent obligations remain unchanged.'};
    }
    if(op==='furnish'){
      if(!PROPERTY_ITEM_IDS.includes(msg.item))throw Error('Choose a supported furniture item.');
      if((await db.query('select 1 from property_furnishings where unit=$1 and item=$2',[row.id,msg.item])).rowCount)throw Error('That furniture is already installed here.');
      const [name,price]=Game.ITEMS[msg.item];if(!Game.spendFor(p.state,price,`Property furniture: ${name}`))throw Error(`You need GH₵${price} for ${name}.`);
      const asset=(await db.query('insert into property_furnishings(item,owner,unit,paid,created_at) values($1,$2,$3,$4,to_timestamp($5/1000.0)) returning id',[msg.item,p.acct,row.id,price,now])).rows[0];
      await mutate('furnish',{amount:price,asset:Number(asset.id),item:msg.item});return {ok:true,note:`${name} installed.`,propertyChanged:changed()};
    }
    if(op==='store'||op==='install'){
      if(!validAssetId(msg.asset))throw Error('Choose a valid furniture asset.');
      const asset=(await db.query('select * from property_furnishings where id=$1 for update',[msg.asset])).rows[0];
      if(!asset||asset.owner!==p.acct||!PROPERTY_ITEM_IDS.includes(asset.item))throw Error('This furniture is not yours.');
      if(op==='store'&&asset.unit!==row.id||op==='install'&&asset.unit!==null)throw Error('The furniture location has changed. Refresh before trying again.');
      if(op==='install'&&(await db.query('select 1 from property_furnishings where unit=$1 and item=$2',[row.id,asset.item])).rowCount)throw Error('That kind of furniture is already installed here.');
      await db.query('update property_furnishings set unit=$2 where id=$1',[msg.asset,op==='store'?null:row.id]);
      await mutate(op,{asset:msg.asset,item:asset.item});return {ok:true,note:op==='store'?'Furniture moved to your property storage.':'Stored furniture installed.',propertyChanged:changed()};
    }
    if(op==='renovate'){
      if(!FINISHES.some(f=>f.id===msg.finish))throw Error('Choose a supported finish.');
      if(row.finish===msg.finish)return {ok:true,note:'This finish is already applied.',...(expired?{propertyChanged:changed()}: {})};
      await db.query('update world_properties set finish=$2 where id=$1',[row.id,msg.finish]);row.finish=msg.finish;
      await mutate('renovate',{finish:msg.finish,cost:0});return {ok:true,note:'Cosmetic finish applied. Property value is unchanged.',propertyChanged:changed()};
    }
    if(op==='list'){
      if(!validAskingPrice(msg.price))throw Error('Choose a whole asking price between GH₵1 and GH₵1,000,000,000.');
      if(typeof msg.furnished!=='boolean'||!LISTING_HOURS.includes(msg.durationHours))throw Error('Choose furnished or unfurnished and a supported listing duration.');
      if((await db.query('select 1 from property_residences where unit=$1',[row.id])).rowCount)throw Error('Choose a different primary residence before listing this unit.');
      const assets=await installed(db,row.id,{lock:true});
      if(assets.some(a=>a.owner!==p.acct))throw Error('Furniture ownership needs review before this property can be listed.');
      const include=msg.furnished?assets.map(a=>wholeId(a.id)):[];
      const l=(await db.query(`insert into property_listings(unit,seller,price,furnished,included,expires_at,created_at)
        values($1,$2,$3,$4,$5,to_timestamp($6/1000.0),to_timestamp($7/1000.0)) returning id`,[row.id,p.acct,msg.price,msg.furnished,include,now+msg.durationHours*3600000,now])).rows[0];
      await mutate('listed',{listing:Number(l.id),amount:msg.price,furnished:msg.furnished,included:include});
      return {ok:true,note:'Property listed. Furnishings and finishes are frozen until the listing closes.',propertyChanged:changed()};
    }
    throw Error('Choose a supported property action.');
  }

  async buy(db,p,msg,row,listing,now){
    if(row.owner===p.acct)throw Error('You already own this property.');
    let price,assets=[];
    if(row.owner===null){
      if(!row.purchase_enabled||row.base_price===null)throw Error('This property has no approved purchase price yet.');
      price=Number(row.base_price);
    }else{
      if(!listing||listing.seller!==row.owner)throw Error('This property is not currently for sale.');
      if((await db.query('select 1 from property_residences where unit=$1',[row.id])).rowCount)throw Error('A primary residence cannot be transferred.');
      const seller=(await db.query('select a.username,a.banned,p.state from accounts a join players p on p.id=a.id where a.id=$1',[row.owner])).rows[0];
      if(!seller||seller.banned)throw Error('This seller is not currently eligible to trade.');
      for(const state of [p.state,seller.state])if(now-(state.flags?.bornAt||state.created)<MIN_AGE_H*3600000)throw Error(`Both trading wallets must be at least ${MIN_AGE_H} hours old.`);
      price=Number(listing.price);assets=await installed(db,row.id,{lock:true});
      const expected=listing.furnished?assets.map(a=>Number(a.id)).sort((a,b)=>a-b):[];
      if(assets.some(a=>a.owner!==row.owner)||JSON.stringify(expected)!==JSON.stringify(listing.included.map(Number).sort((a,b)=>a-b)))throw Error('The listing inventory changed. It must be reviewed before sale.');
    }
    if(!validAskingPrice(price))throw Error('This property does not have a valid purchase price.');
    if(!Game.spendFor(p.state,price,`Property purchase: ${row.name}`))throw Error(`You need GH₵${price.toLocaleString('en-GH')} to buy this property.`);
    const sellerId=row.owner;let credit=null;
    if(listing){
      const included=listing.included.map(Number);
      // Each asset stays one SQL row: included assets change owner, excluded
      // assets return to seller storage. No legacy item flags are copied.
      await db.query('update property_furnishings set owner=case when id=any($2::bigint[]) then $3 else owner end,unit=case when id=any($2::bigint[]) then unit else null end where unit=$1',[row.id,included,p.acct]);
      credit=(await db.query("insert into credits(to_id,from_id,from_name,amount,fee,kind,note) values($1,$2,$3,$4,0,'property','Property resale') returning id",[sellerId,p.acct,p.name,price])).rows[0].id;
      await db.query("insert into ledger(from_id,to_id,amount,kind) values($1,$2,$3,'property')",[p.acct,sellerId,price]);
      await db.query("update property_listings set status='sold',buyer=$2,credit=$3,closed_at=to_timestamp($4/1000.0) where id=$1",[listing.id,p.acct,credit,now]);
    }
    await db.query('update world_properties set owner=$2,last_sale_price=$3 where id=$1',[row.id,p.acct,price]);row.owner=p.acct;
    await bumpRevision(db,row,now);await recordProperty(db,row,p.acct,listing?'resale':'catalogue_purchase',now,{amount:price,listing:listing?Number(listing.id):null,credit:credit===null?null:Number(credit),included:listing?.included.map(Number)||[]});
    event(p.state,'property_purchase',{unit:row.id,amount:price},now);
    return {ok:true,note:'Property ownership saved.',...(sellerId!==null?{creditTo:sellerId}:{}),propertyChanged:{unit:row.id,revision:Number(row.revision)}};
  }
}
