import {h,cedi} from '../ui/dom.js';
import {G} from '../store.js';
import {net} from '../net.js';
import './property.css';

const OPS=new Set(['property_buy','property_primary','property_furnish','property_store','property_install','property_renovate','property_list','property_cancel','property_travel','property_exit','property_home_act']);
const LIMIT=12;
const paragraph=text=>h('p',null,text);
const card=(title,...children)=>h('section.property-card',null,h('h2',null,title),...children);
const money=n=>Number.isFinite(n)?cedi(n):'Not configured';
const label=(text,control)=>h('label',null,h('span',null,text),control);
const button=(text,fn,disabled=false,primary=false)=>h('button.property-button'+(primary?'.property-primary':''),{type:'button',onclick:fn,disabled},text);
const CLASS_NAMES={'single-room':'Single room','compound-house':'Compound house',apartment:'Apartment',townhouse:'Townhouse','detached-house':'Detached house','premium-residence':'Premium residence','commercial-unit':'Commercial unit'};
const className=id=>CLASS_NAMES[id]||id;
const when=value=>{const date=new Date(value);return Number.isFinite(date.getTime())?date.toLocaleString():'Not available';};

export const properties=act=>({id:'properties',name:'Property',icon:'buildings',bg:'#496c50',open:(win,arg)=>propertyScreen(win,act,arg)});

/** A single listener lifecycle for catalogue, inspection and management pages. */
export function propertyScreen(win,act,arg={}){
  let data=null,account=null,last=null,waiting=false,closed=false,note='',confirmation=null,timer=null,refreshTimer=null;
  const area=typeof arg?.area==='string'?arg.area:null;   // opened from a neighbourhood street
  let selected=typeof arg?.unit==='string'?arg.unit:null,tab=selected?'detail':['owned','storage'].includes(arg?.tab)?arg.tab:'catalogue',page=0;
  const draft={price:'',durationHours:'24',furnished:true,mode:'trotro',storageUnit:null};
  const storageKey=()=>`awd-property-action:${account}`;
  const refresh=()=>{if(!closed)win.refresh();};
  const load=()=>{if(!closed&&!waiting&&net.connected)net.send({t:'life_status',section:'properties',...(selected?{unit:selected}:{})});};
  const laterLoad=()=>{clearTimeout(refreshTimer);refreshTimer=setTimeout(load,300);};
  const saveRef=value=>{try{if(value)sessionStorage.setItem(storageKey(),JSON.stringify(value));else sessionStorage.removeItem(storageKey());return true;}catch{note='This browser cannot retain an action reference. Allow session storage before making changes.';return false;}};
  function submit(){
    if(!last||waiting||closed)return;
    if(!net.connected){note='Reconnecting. The saved reference is kept; retry after the connection returns.';refresh();return;}
    waiting=true;note='Waiting for the server to confirm…';refresh();
    timer=setTimeout(()=>{waiting=false;note='No confirmation yet. Retry the saved action; it will not repeat a completed purchase or transfer.';refresh();},15000);
    if(!net.send(last)){clearTimeout(timer);waiting=false;note='Not sent. Your action reference is kept for a safe retry.';refresh();}
  }
  function request(op,fields={}){
    if(!account||waiting||last||!OPS.has(op))return;
    const next={t:'life_action',op,key:crypto.randomUUID(),...fields};
    if(!saveRef(next)){refresh();return;}
    last=next;confirmation=null;submit();
  }
  const confirm=(title,text,op,fields)=>{confirmation={title,text,op,fields};refresh();};
  const blocked=()=>waiting||!!last||!account||!net.connected;
  const inspect=id=>{selected=id;tab='detail';page=0;confirmation=null;refresh();load();};
  const switchTab=next=>{tab=next;selected=null;page=0;confirmation=null;refresh();load();};
  const offs=[net.on('life_status',m=>{
    if(m.section!=='properties'||closed)return;
    if(m.error){note=m.error;refresh();return;}
    if(!m.properties||!m.account)return;
    if(account&&account!==m.account){last=null;waiting=false;clearTimeout(timer);}
    account=m.account;
    if(selected&&m.properties.detail?.id!==selected)return;
    data=m.properties;
    if(m.state){G.state=m.state;act.refresh?.();}
    if(!last){
      try{const ref=JSON.parse(sessionStorage.getItem(storageKey())||'null');if(ref&&ref.t==='life_action'&&OPS.has(ref.op)&&typeof ref.key==='string'){last=ref;note='A previous action has no confirmation. Retry its saved reference to recover the result.';}}catch{note='A saved action reference could not be read. Refresh before making changes.';}
    }
    refresh();
  }),net.on('life_result',m=>{
    if(closed||!last||m.key!==last.key)return;
    clearTimeout(timer);waiting=false;note=m.error||m.message||'Saved.';
    const op=last.op;
    if(m.state){G.state=m.state;act.refresh?.();}
    if(!m.error||!/saving|wait a moment|save this action|same reference|not confirmed|temporarily unavailable/i.test(m.error)){saveRef(null);last=null;}
    refresh();
    if(!m.error){laterLoad();if(op==='property_travel'||op==='property_exit')act.propertyTravel?.(m);}
  }),net.on('connection',m=>{if(closed)return;if(!m.connected){clearTimeout(timer);waiting=false;note=last?'Connection lost. Your saved reference is kept for retry.':'Reconnecting. Property changes are unavailable until connected.';refresh();}else{load();refresh();}}),net.on('life_notice',laterLoad)];
  const poll=setInterval(()=>{if(!['INPUT','SELECT','TEXTAREA'].includes(document.activeElement?.tagName))load();},12000);
  const previousClose=win.onclose;
  win.onclose=()=>{if(closed)return;closed=true;offs.forEach(off=>off());clearTimeout(timer);clearTimeout(refreshTimer);clearInterval(poll);
    // A verified journey starts the ride and closes the phone before its confirmation arrives.
    // Still retire the saved reference once the server confirms, so no stale retry is offered.
    if(waiting&&last){const key=last.key,off=net.on('life_result',m=>{if(m.key!==key)return;off();clearTimeout(stop);if(!m.error)saveRef(null);}),stop=setTimeout(off,30000);}
    previousClose?.();};
  win.page('Property',()=>{
    const root=h('div.property-screen',null,note?h('p.property-note',{role:'status'},note):null,last&&!waiting?button('Retry saved property action',submit,!net.connected):null,
      h('div.property-tabs',{'aria-label':'Property sections'},...['catalogue','owned','storage'].map(id=>h('button',{type:'button','aria-pressed':String(tab===id),onclick:()=>switchTab(id)},({catalogue:'Explore',owned:'My units',storage:'Storage'})[id]))),button('Refresh properties',load,waiting));
    if(!data){root.append(paragraph('Loading the persistent property catalogue…'));return root;}
    if(confirmation){root.append(card(confirmation.title,paragraph(confirmation.text),button('Confirm property action',()=>request(confirmation.op,confirmation.fields),blocked(),true),button('Keep browsing',()=>{confirmation=null;refresh();})));return root;}
    if(tab==='detail')detailUI(root);else if(tab==='storage')storageUI(root);else catalogueUI(root);
    return root;
  });load();

  function catalogueUI(root){
    const owned=tab==='owned',rows=owned?data.owned:area?data.catalogue.filter(u=>u.neighbourhood===area):data.catalogue;
    root.append(paragraph(owned?'Finite property units you own. Your original home and its possessions remain separate.':area?`Property units on these ${G.cat?.homes?.[area]?.area||area} streets. Prices, ownership and access come from the server.`:'Explore finite units in existing Accra neighbourhoods. Prices, ownership and access come from the server.'));
    if(owned)root.append(card('Primary residence',paragraph(data.primary?`Selected unit: ${data.owned.find(u=>u.id===data.primary)?.name||data.primary}`:'Your original home is selected.'),paragraph('Choosing a property does not end rent on your original home. Both commitments remain until explicitly changed.'),data.primary?button('Use original home as primary',()=>confirm('Return to original home','This changes your primary selection. It does not sell any property or change existing rent.','property_primary',{unit:null}),blocked()):null));
    if(!rows?.length){root.append(paragraph(owned?'You do not own any finite units yet.':'No units are currently available.'));return;}
    page=Math.min(page,Math.max(0,Math.ceil(rows.length/LIMIT)-1));
    for(const unit of rows.slice(page*LIMIT,(page+1)*LIMIT))root.append(card(unit.name,
      paragraph(`${unit.area} · ${className(unit.class)} · ${unit.mine?'Owned by you':unit.listed?'Player listing':unit.owned?'Privately owned':'Catalogue unit'}`),
      paragraph(`Asking price: ${money(unit.askingPrice)}${unit.primary?' · Your primary residence':''}`),
      button('Inspect '+unit.name,()=>inspect(unit.id))));
    root.append(paragraph(`Page ${page+1} of ${Math.ceil(rows.length/LIMIT)}`),button('Previous units',()=>{page--;refresh();},page===0),button('Next units',()=>{page++;refresh();},(page+1)*LIMIT>=rows.length));
  }
  function detailUI(root){
    const u=data.detail;
    if(!u||u.id!==selected){root.append(paragraph('Loading this unit’s current inspection…'));return;}
    const pairs=[['Location',u.area],['Building',className(u.class)],['Interior',G.cat?.homes?.[u.template]?.name||u.template],['Catalogue/base price',money(u.basePrice)],['Estimated value',money(u.estimatedValue)],['Current asking price',money(u.askingPrice)],['Last actual sale',money(u.lastSalePrice)],['Owner status',u.mine?'You':u.owned?'Private owner':'Unowned catalogue unit'],['Finish',u.finish],['Furnishing',u.furnished?'Movable assets installed':'No movable assets installed']];
    root.append(card(u.name,h('dl',null,...pairs.flatMap(([k,v])=>[h('dt',null,k),h('dd',null,v||'None')])),paragraph(u.estimateNote||'Estimated value is informational. Furnishing spend does not guarantee resale proceeds.'),h('div.property-preview',null,`${u.name} uses the ${G.cat?.homes?.[u.template]?.name||u.template} interior. Use the timed tour to inspect the real room.`),paragraph('Supported changes: the existing furniture catalogue, fixed cosmetic finishes and the existing interior layout. Structural rebuilding is unavailable.')));
    if(u.listing)root.append(card('Current listing',paragraph(`${money(u.listing.price)} · ${u.listing.furnished?'Furnished':'Unfurnished'} · expires ${when(u.listing.expiresAt)}`),assetPreview(u.listing.includes||[],'Included movable assets'),paragraph('Only the listed unique assets transfer. Personal groceries, fuel, cars, clothing and original-home items stay with their owner.')));
    if(!u.purchaseEnabled&&!u.listed)root.append(paragraph('Purchase is disabled until this class has reviewed pricing. Touring does not grant ownership.'));
    if(u.canBuy)root.append(button(`Buy ${u.name} · ${money(u.askingPrice)}`,()=>confirm('Purchase '+u.name,`Pay ${money(u.askingPrice)} in game money for this unit${u.listing?.furnished?' and its listed movable assets':''}. The server rechecks price, funds and availability. Existing rent and your original home stay unchanged.`,'property_buy',{unit:u.id}),blocked(),true));
    if(u.canTour||u.mine){
      const modes=Object.entries(G.cat?.transport||{});
      root.append(card(u.mine?'Visit your unit':'Tour this property',paragraph('Travel uses the existing geographic distance, fares and real journey timer. Tours cannot use owner-only activities or furnishing controls.'),label('Travel mode',h('select',{'aria-label':'Property travel mode',onchange:e=>draft.mode=e.target.value},...modes.map(([id,m])=>h('option',{value:id,selected:id===draft.mode},m.name)))),button(u.mine?'Travel to unit':'Start timed property tour',()=>confirm('Start property journey','Your selected transport charges the existing geographic fare. The server checks funds, vehicle/range restrictions and access again on arrival.','property_travel',{unit:u.id,mode:draft.mode}),blocked())));
    }
    if(!u.mine)return;
    root.append(card('Residence selection',paragraph(u.primary?'This unit is your primary residence. Change to your original home before listing it.':'Your original home and its rent are not replaced by selecting this unit.'),button(u.primary?'Use original home as primary':'Make this unit primary',()=>confirm('Change primary residence','This selection does not terminate existing rent or move original-home possessions.','property_primary',{unit:u.primary?null:u.id}),blocked()||(!u.primary&&u.listed))));
    if(u.listed){root.append(card('Sale is active',paragraph('Furnishing, finishes and primary selection are frozen while listed.'),button('Cancel property listing',()=>confirm('Cancel listing','The server will cancel this active listing if the unit has not already sold. No assets are duplicated or refunded.','property_cancel',{unit:u.id}),blocked())));return;}
    if(u.canFurnish)furnishingUI(root,u);
    listingUI(root,u);
  }
  function assetPreview(assets,title){return h('div',null,h('h3',null,title),assets.length?h('ul',null,...assets.map(a=>h('li',null,`${a.name||a.item} · asset ${a.id}`))):paragraph('None. Fixed template fixtures remain part of the room.'));}
  function furnishingUI(root,u){
    root.append(card('Installed movable assets',assetPreview(u.items||[],'These belong to this unit'),...(u.items||[]).map(a=>button('Store '+a.name,()=>confirm('Move to storage',`${a.name} leaves this unit and remains yours in storage. Its benefit is removed from the unit. It is separate from original-home possessions.`,'property_store',{unit:u.id,asset:a.id}),blocked()))));
    root.append(card('Furniture & appliances',paragraph('Each purchase creates one unique movable asset in this unit. Existing home-item prices apply. Repeated copies of the same supported item are unavailable.'),...data.furniture.map(item=>button(`Install ${item.name} · ${money(item.price)}`,()=>confirm('Install '+item.name,`Pay ${money(item.price)} in game money. The asset belongs to this unit and may later move into your storage. It does not add the item to your original home.`,'property_furnish',{unit:u.id,item:item.id}),blocked()||(u.items||[]).some(a=>a.item===item.id)))));
    root.append(card('Cosmetic renovation',paragraph('Three predefined free finishes. These change appearance only and do not increase estimated value or functional benefits.'),...data.finishes.map(f=>button(`${f.name} · ${money(f.cost)}`,()=>confirm('Apply '+f.name,`${f.description} This is cosmetic; no guaranteed appreciation or added functional benefit.`,'property_renovate',{unit:u.id,finish:f.id}),blocked()||u.finish===f.id))));
  }
  function listingUI(root,u){
    if(!u.canList){root.append(paragraph(u.primary?'Select your original home as primary before listing this unit.':'This unit is not currently eligible for resale.'));return;}
    const price=h('input',{type:'number',inputMode:'numeric',min:1,max:1000000000,step:1,value:draft.price,'aria-label':'Property asking price',oninput:e=>draft.price=e.target.value});
    const duration=h('select',{'aria-label':'Listing duration',onchange:e=>draft.durationHours=e.target.value},...[24,48,72].map(n=>h('option',{value:String(n),selected:String(n)===draft.durationHours},`${n} hours`)));
    root.append(card('Offer for resale',paragraph('Your asking price is separate from the base and estimated value. No buyer or appreciation is guaranteed.'),label('Asking price in game cedis',price),label('Listing duration',duration),h('label.property-checkbox',null,h('input',{type:'checkbox',checked:draft.furnished,onchange:e=>{draft.furnished=e.target.checked;refresh();}}),h('span',null,'Include all installed movable assets')),
      assetPreview(draft.furnished?u.items||[]:[],'Inclusion preview'),paragraph(draft.furnished?'The server snapshots the exact installed asset IDs shown. They transfer once with the unit.':'Installed movable assets move into your storage only if the unit sells. None transfer to the buyer.'),
      button('Review property listing',()=>{const value=Number(draft.price);if(!Number.isSafeInteger(value)||value<1||value>1000000000){note='Enter a whole-number asking price from 1 to 1,000,000,000.';refresh();return;}confirm('List '+u.name,`Ask ${money(value)} for ${draft.durationHours} hours, ${draft.furnished?'including all shown unique movable assets':'excluding movable assets'}. Changes are frozen while listed. The server controls the transfer and seller credit.`,'property_list',{unit:u.id,price:value,furnished:draft.furnished,durationHours:Number(draft.durationHours)});},blocked())));
  }
  function storageUI(root){
    const units=(data.owned||[]).filter(u=>u.canFurnish&&!u.listed);
    if(!units.some(u=>u.id===draft.storageUnit))draft.storageUnit=units[0]?.id||null;
    root.append(paragraph('Unique movable assets stored from your finite units. Original-home items, personal groceries, clothing and vehicles are separate.'));
    if(units.length)root.append(label('Install into unit',h('select',{'aria-label':'Storage destination unit',onchange:e=>draft.storageUnit=e.target.value},...units.map(u=>h('option',{value:u.id,selected:u.id===draft.storageUnit},u.name)))));
    if(!data.storage?.length){root.append(paragraph('Your property storage is empty.'));return;}
    for(const asset of data.storage)root.append(card(asset.name,paragraph(`Unique asset ${asset.id}`),button('Install '+asset.name,()=>confirm('Install stored asset',`Move ${asset.name} into the selected unit. The server checks ownership and supported item capacity.`,'property_install',{unit:draft.storageUnit,asset:asset.id}),blocked()||!draft.storageUnit)));
  }
}
