import {h,cedi} from '../ui/dom.js';
import {G,loc,accraNow} from '../store.js';
import {net} from '../net.js';

const card=(title,...children)=>h('div.group',{style:{padding:'16px'}},h('strong',null,title),...children);
const paragraph=t=>h('p',null,t);
const button=(text,fn,disabled=false)=>h('button.ibtn.wide',{onclick:fn,disabled},text);
const field=(label,input)=>h('label',{style:{display:'block',margin:'12px 0'}},h('span',null,label),input);
const input=(label,value,oninput,type='number')=>h('input',{'aria-label':label,type,value,min:0,step:1,style:{width:'100%'},oninput:e=>oninput(e.target.value)});
const TITLES={vehicles:'Car market',business:'Your businesses',market:'Phone marketplace',relationships:'People & shared activities',finance:'Your finances',career:'Career & development'};

export function lifeScreen(win,act,section,arg={}){
  let data=null,note='',waiting=false,last=null,timer,account=null,closed=false;
  const draft={business:null,type:'provisions',location:'makola',quantity:'10',price:'12',operating:false,amount:'10',name:arg?.name||'',phone:null,listPrice:'100',kind:'conversation'};
  const load=()=>{if(!closed&&!waiting&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName))net.send({t:'life_status',section});};
  const storage=()=>`awd-life-action:${account}`;
  const send=(op,fields={})=>{
    if(waiting||!account)return;
    last={t:'life_action',op,key:crypto.randomUUID(),...fields};sessionStorage.setItem(storage(),JSON.stringify(last));submit();
  };
  const submit=()=>{if(!last||!net.connected)return;waiting=true;note='Saving…';net.send(last);clearTimeout(timer);timer=setTimeout(()=>{waiting=false;note='No confirmation yet. Retry the same action safely.';win.refresh();},15000);win.refresh();};
  const offs=[net.on('life_status',m=>{
    if(m.section!==section)return;data=m;account=m.account;G.state=m.state;
    if(!last){try{last=JSON.parse(sessionStorage.getItem(storage())||'null');}catch{}if(last)note='An earlier action has no confirmation. Retry it to check its saved result.';}
    win.refresh();
  }),net.on('life_result',m=>{
    if(!m.key){if(!waiting){note=m.error||'Refresh this screen to try again.';win.refresh();}return;}
    if(m.key&&m.key!==last?.key)return;clearTimeout(timer);waiting=false;note=m.error||m.message||'Saved.';
    if(m.state){G.state=m.state;act.refresh();}
    if(!m.error&&m.key){sessionStorage.removeItem(storage());last=null;}
    if(m.error&&m.key&& !/saving|wait a moment|save this action|same reference/i.test(m.error)){sessionStorage.removeItem(storage());last=null;}
    win.refresh();if(m.key&&!m.error)setTimeout(load,500);
  }),net.on('connection',m=>{if(!m.connected){waiting=false;note='Connection lost. Your action reference is kept.';win.refresh();}}),net.on('life_notice',()=>setTimeout(load,500))];
  const poll=setInterval(load,12000);
  win.onclose=()=>{closed=true;offs.forEach(off=>off());clearInterval(poll);clearTimeout(timer);};
  const busy=()=>waiting||!data||!!last;
  win.page(TITLES[section],()=>{
    const root=h('div.life-screen',null,note?paragraph(note):null,
      last&&!waiting?button('Retry saved action',submit):null,button('Refresh',load,waiting));
    if(!data){root.append(paragraph('Loading saved life information…'));return root;}
    if(section==='business')businessUI(root);
    if(section==='market')marketUI(root);
    if(section==='vehicles')vehicleUI(root);
    if(section==='relationships')relationshipsUI(root);
    if(section==='finance')financeUI(root);
    if(section==='career')careerUI(root);
    return root;
  });load();

  function businessUI(root){
    const {models,rows}=data.business;
    root.append(paragraph('Operate a small business with game money. Your signboard appears at its location for other players to see. Sales are simulated and are not guaranteed. Keep stock and operating cash available. Your existing investments are in Invest.'));
    for(const b of rows){
      const m=models[b.type],st=b.statement;
      root.append(card(`${m.name} · ${loc(b.location)?.name||b.location}`,
        paragraph(`${b.operating?'Open':'Closed'} · stock ${b.stock}/${m.capacity*(b.level?2:1)} · price ${cedi(b.price)} · till ${cedi(b.till)}`),
        paragraph(`Simulated customers (game demand model, not real players): revenue ${cedi(st.revenue)} · cost of goods sold ${cedi(st.cogs)} · gross profit ${cedi(st.gross_profit)}`),
        paragraph(`Expenses ${cedi(st.expenses)} · net profit ${cedi(st.net_profit)} · operating profit ${cedi(st.operating_profit)}`),
        paragraph(`Inventory purchased ${cedi(st.inventory_purchases)}. Net profit includes startup/expansion. Unsold stock is inventory, not a sale.`),
        button('Manage business',()=>{draft.business=b.id;draft.price=String(b.price);draft.operating=b.operating;win.refresh();})));
      if(draft.business===b.id){
        const qty=input('Stock quantity',draft.quantity,v=>draft.quantity=v),price=input('Selling price',draft.price,v=>draft.price=v),amount=input('Till amount',draft.amount,v=>draft.amount=v);
        root.append(card('Operations',paragraph(`Wholesale ${cedi(m.unit)}/unit · operating cost ${cedi(m.expense)} per eligible six-hour period. At most 48 hours settle while away. The first complete period after setup must elapse before sales.`),
          field('Units to purchase',qty),button('Buy wholesale stock',()=>send('business_stock',{id:b.id,quantity:Number(draft.quantity)}),busy()),
          field('Price per unit',price),field('Open for trading',h('input',{type:'checkbox',checked:draft.operating,onchange:e=>draft.operating=e.target.checked})),
          button('Save trading settings',()=>send('business_configure',{id:b.id,price:Number(draft.price),operating:draft.operating}),busy()),
          field('Reserve / withdrawal amount',amount),button('Add operating reserve',()=>send('business_fund',{id:b.id,amount:Number(draft.amount)}),busy()),
          button('Withdraw till cash',()=>send('business_withdraw',{id:b.id,amount:Number(draft.amount)}),busy()),
          button('Settle elapsed periods',()=>send('business_settle',{id:b.id}),busy()),
          button(`Expand · ${cedi(m.expand)}`,()=>send('business_expand',{id:b.id}),busy()||!!b.level),
          paragraph('Expansion: at least 25 sales and operating profit of half the startup cost. Closing pauses trade and preserves stock and cash.'),
          ...b.transactions.map(t=>paragraph(`${new Date(t.at).toLocaleString()} · ${t.kind} · ${t.units} units · revenue ${cedi(+t.revenue)} · expenses ${cedi(+t.expense)} · cash movement ${cedi(+t.cash)}`))));
      }
    }
    if(rows.length<2){
      const model=models[draft.type];if(!model.locations.includes(draft.location))draft.location=model.locations[0];
      root.append(card('Start a business',
        field('Business type',h('select',{'aria-label':'Business type',value:draft.type,onchange:e=>{draft.type=e.target.value;draft.location=models[draft.type].locations[0];win.refresh();},style:{width:'100%'}},...Object.entries(models).map(([id,m])=>h('option',{value:id,selected:id===draft.type},m.name)))),
        field('Existing location',h('select',{'aria-label':'Business location',onchange:e=>draft.location=e.target.value,style:{width:'100%'}},...model.locations.map(id=>h('option',{value:id,selected:id===draft.location},loc(id)?.name||id)))),
        paragraph(`Startup ${cedi(model.startup)}, including ${cedi(model.reserve)} operating reserve. Stock is purchased separately. Suggested selling price ${cedi(model.price)}. Up to two businesses.`),
        button(`Create ${model.name}`,()=>send('business_create',{type:draft.type,location:draft.location}),busy())));
    }
  }
  function vehicleUI(root){
    const v=data.vehicles,swatch=hex=>h('span',{style:{display:'inline-block',width:'14px',height:'14px',borderRadius:'50%',marginRight:'6px',verticalAlign:'-2px',background:hex||'#9aa0a6',border:'1px solid #0002'}});
    const paintName=id=>v.paints.find(x=>x.id===id)?.name||'Factory colour';
    root.append(paragraph(v.note));
    if(v.car){
      const range=v.car.range;draft.carPrice??=String(Math.round(v.car.catalogue*0.6));
      root.append(card(v.car.name,paragraph(`Catalogue price ${cedi(v.car.catalogue)} · Paint: ${paintName(v.car.style.paint)}`),
        h('div',{role:'group','aria-label':'Car paint',style:{display:'flex',flexWrap:'wrap',gap:'8px',margin:'10px 0'}},...v.paints.map(x=>h('button.ibtn',{style:{height:'40px',fontSize:'13px'},'aria-pressed':String(v.car.style.paint===x.id),disabled:busy()||v.car.style.paint===x.id,onclick:()=>send('vehicle_paint',{paint:x.id})},swatch(x.hex),x.name))),
        paragraph('Paint is free and cosmetic. It shows on your car when you drive and transfers if you sell.')));
      root.append(card('Sell to another player',paragraph(`Ask between ${cedi(range.min)} and ${cedi(range.max)}. Your car waits safely in escrow for 72 hours and you can collect it any time before it sells. Fuel stays with you.`),
        field('Asking price',input('Car asking price',draft.carPrice,v2=>draft.carPrice=v2)),
        button('Place car in escrow',()=>send('vehicle_list',{price:Number(draft.carPrice)}),busy())));
    }else root.append(paragraph('You do not own a car. Buy a used one below or a new one at Correct Cars.'));
    const open=v.listings.filter(r=>r.status==='listed');
    root.append(h('h3',{style:{margin:'18px 2px 8px'}},'Cars for sale by players'));
    if(!open.length)root.append(paragraph('No player cars are listed right now. Listings appear here as soon as players place cars in escrow.'));
    for(const r of v.listings){
      const below=r.catalogue?Math.round(100-r.price/r.catalogue*100):null;
      root.append(card(`${r.name}`,paragraph(h('span',null,swatch(v.paints.find(x=>x.id===r.style.paint)?.hex),`${paintName(r.style.paint)} · @${r.seller}`)),
        paragraph(`${cedi(r.price)}${below>0?` · ${below}% below new`:''} · ${r.status==='sold'?'Sold':r.expired?'Expired':'Listed until '+new Date(r.expiresAt).toLocaleString()}`),
        r.mine&&r.status==='listed'?button(r.expired?'Collect your car':'Cancel and collect your car',()=>send('vehicle_cancel',{id:r.id}),busy()||!!v.car):
        !r.mine&&r.status==='listed'&&!r.expired?button(`Buy · ${cedi(r.price)}`,()=>send('vehicle_buy',{id:r.id}),busy()||!!v.car):null));
    }
  }
  function marketUI(root){
    root.append(paragraph('Only tested genuine Circle phones are tradable. Six-hour account age, existing MoMo fees/daily limits, three escrow listings and 24-hour expiry apply. Circle dealers buy at most eight phones a day, one per minute. No real-money trading or cash-out.'));
    const phones=(G.state.phones||[]).filter(p=>p.tested||p.fixed);
    if(phones.length){draft.phone ||= phones[0].id;root.append(card('List a phone',
      field('Phone to sell',h('select',{'aria-label':'Phone to sell',onchange:e=>draft.phone=e.target.value,style:{width:'100%'}},...phones.map(p=>h('option',{value:p.id,selected:p.id===draft.phone},`${data.phoneNames?.[p.m]||'Phone'} · ${p.cond}% condition`)))),
      field('Listing price',input('Listing price',draft.listPrice,v=>draft.listPrice=v)),
      button('Place phone in escrow',()=>send('market_list',{phone:draft.phone,price:Number(draft.listPrice)}),busy())));}
    else root.append(paragraph('Buy a tested phone at Circle, or repair an older untested genuine phone there, to list it.'));
    for(const row of data.market){root.append(card(`${row.modelName||'Phone'} · ${row.condition}% condition`,paragraph(`@${row.seller_name} · ${cedi(row.price)} · ${row.expired?'Expired':row.status}`),
      row.mine&&row.status==='listed'?button('Collect unsold phone',()=>send('market_cancel',{id:row.id}),busy()):!row.mine&&row.status==='listed'&&!row.expired?button(`Buy · ${cedi(row.price+row.fee)} incl. ${cedi(row.fee)} fee`,()=>send('market_buy',{id:row.id}),busy()):null));}
  }
  function relationshipsUI(root){
    const rel=data.relationships;
    root.append(paragraph('Meet in a public room, then send a friend request. Romantic status needs mutual consent. Shared activities take 30 seconds together; menu costs are charged only on completion. No cash reward for messages.'),
      field('Player username',input('Player username',draft.name,v=>draft.name=v,'text')),
      button('Send friend request',()=>send('friend_request',{name:draft.name}),busy()));
    for(const r of rel.rows){
      const now=accraNow(),pending=r.friendship==='pending'&&new Date(r.friendUntil).getTime()>now,romance=r.romanceIncoming&&new Date(r.romanceUntil).getTime()>now;
      root.append(card('@'+r.name,paragraph(`${r.friendship} · ${r.points} friendship · ${['none','ended'].includes(r.romance)?'No romantic relationship':r.romance}`),
        pending&&r.requestIncoming?button('Accept friend request',()=>send('friend_answer',{name:r.name,yes:true}),busy()):null,
        pending&&r.requestIncoming?button('Decline friend request',()=>send('friend_answer',{name:r.name,yes:false}),busy()):null,
        romance?button('Accept romantic invitation',()=>send('date_answer',{name:r.name,yes:true}),busy()):null,
        romance?button('Decline romantic invitation',()=>send('date_answer',{name:r.name,yes:false}),busy()):null,
        r.friendship==='accepted'?h('div',null,
          button('Invite to conversation',()=>send('shared_invite',{name:r.name,kind:'conversation'}),busy()),
          button('Invite to share a meal',()=>send('shared_invite',{name:r.name,kind:'meal'}),busy()),
          button('Invite to exercise',()=>send('shared_invite',{name:r.name,kind:'exercise'}),busy()),
          !['dating','engaged'].includes(r.romance)?button('Ask to start dating',()=>send('date_request',{name:r.name}),busy()):null,
          ['dating','engaged'].includes(r.romance)?button('Invite on a date',()=>send('shared_invite',{name:r.name,kind:'date'}),busy()):null,
          r.romance==='dating'?button('Propose with owned ring',()=>send('propose_request',{name:r.name}),busy()):null,
          ['dating','engaged'].includes(r.romance)?button('End relationship',()=>send('relationship_end',{name:r.name}),busy()):null,
          button('Remove friendship',()=>send('friend_remove',{name:r.name}),busy())):null));
    }
    for(const a of rel.sessions)root.append(card(`${a.kind} with @${a.with}`,paragraph(a.status==='active'?'Stay together here until the server completes the activity. Leaving or disconnecting cancels without charging.':`Invitation · ${cedi(a.cost)} each if completed · expires ${new Date(a.expires_at).toLocaleTimeString()}`),
      a.incoming&&a.status==='pending'?button('Accept shared activity',()=>send('shared_answer',{activity:a.id,yes:true}),busy()):null,
      a.incoming&&a.status==='pending'?button('Decline shared activity',()=>send('shared_answer',{activity:a.id,yes:false}),busy()):null));
    root.append(paragraph('Use Contacts or a player card to block or report unwanted contact. Either person can end a relationship.'));
  }
  function financeUI(root){
    const f=data.finance,home=G.cat.homes[f.home];
    root.append(card('Available money',paragraph(`Cash ${cedi(f.cash)} · MoMo ${cedi(f.momo)} · total ${cedi(f.balance)}`),paragraph(`Fixed savings ${cedi(f.savings)}. Business tills are separate; see Business.`)),
      card('Obligations',paragraph(home?`${home.name} · ${f.owned?'Owned':`${cedi(home.rent)}/week · rent paid until ${new Date(f.rentPaidUntil).toUTCString()}`}`:'No current home.'),paragraph(`Missed rent periods: ${f.arrears}. Existing advance and two-week arrears rules remain.`),f.loan?paragraph(`${f.loan.lender}: ${cedi(f.loan.owed)} owed · next ${new Date(f.loan.next).toUTCString()}`):paragraph('No loan balance.')),
      card('Recent saved transactions',...f.rows.map(r=>paragraph(`${new Date(r.at).toLocaleString()} · ${r.delta<0?'−':'+'}${cedi(Math.abs(r.delta))} · ${r.label} · balance ${cedi(r.balance)}`))),
      card('Earlier history',paragraph('Older saves keep their original bounded ledger. New transactions are recorded durably.'),...f.legacy.map(([at,amount,label])=>paragraph(`${new Date(at).toLocaleString()} · ${cedi(amount)} · ${label}`))));
  }
  function careerUI(root){
    const pr=data.progression,j=G.state.job,c=j&&G.cat.careers[j.id],h=j&&pr.careers[j.id];
    root.append(card('Standing',paragraph(`Professional ${Math.round(pr.professional)}/100 · social ${Math.round(pr.social)}/100. Business reputation belongs to each business; legal standing is separate.`)));
    if(j)root.append(card(c.ranks[j.rank][0],paragraph(`Grade ${j.grade+1}/4 · performance ${Math.round(j.perf)}% · ${h.shifts} recorded career shifts · ${h.assignments} assignments · workplace reputation ${h.reputation}/100`),
      paragraph(j.rank<4?`Promotion: grade 4, performance 100%, ${G.cat.promoShifts[j.rank]} shifts at this rank and ${G.cat.skills[c.skill]} ${G.cat.promoSkill[j.rank]}. Currently ${j.shifts} shifts, skill ${Math.floor(G.state.skills[c.skill])}.`:'Top rank reached.'),
      paragraph('Historical rank/grade is retained when changing careers. Salaries and promotion thresholds are unchanged.'),button('Open Jobs',()=>act.phone('jobs'))));
    for(const sk of pr.skills)root.append(card(`${sk.name} · ${Math.floor(sk.value)}/${sk.max}`,paragraph(`${Math.round((sk.value%1)*100)}% toward the next level. ${sk.growth}`),paragraph(sk.effect)));
    const legal=pr.legal;root.append(card('Game conduct',paragraph(`Heat ${Math.round(legal.heat)} · ${legal.attempts} fictional crime attempts · ${legal.caught} detections · fines ${cedi(legal.fines)}`),legal.last?paragraph(`Last outcome: ${legal.last.caught?'Detected':'Not detected'} · risk ${Math.round(legal.last.risk*100)}% · fine ${cedi(legal.last.fine)}`):null,
      legal.reviewActive?paragraph(`New banking/police applications reopen ${new Date(legal.reviewUntil).toUTCString()}. Existing employment is retained. Community service at the police station shortens review.`):paragraph('No active conduct review.'),button('Open Police',()=>act.phone('police'))));
  }
}
