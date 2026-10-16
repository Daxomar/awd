import {h,cedi} from '../ui/dom.js';
import {purchaseKey} from '../payments.js';
const drafts=new Map();
const request=(url,body={})=>fetch(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}).then(r=>r.json());
const row=(title,detail,fn)=>h('button.cell.noic',{onclick:fn},h('div.cm',null,h('div.c1',null,title),h('div.c2',null,detail)));
export function advertising(win,act,arg){
  let slots=null,mine=null,error='';
  const load=()=>Promise.all([fetch('/api/billboards').then(r=>r.json()),request('/api/ads/mine')]).then(([a,b])=>{slots=a.slots;mine=b.rows||[];error=b.error||'';if(slots)act.adInventory(slots);win.refresh();}).catch(()=>{error='Campaign service unavailable. Please retry.';win.refresh();});
  win.page('My Ads',()=>h('div',null,h('p',{style:{padding:'0 8px'}},'Rent an approved billboard or ground panel. Prices are real GHS. Artwork is reviewed before activation.'),error?h('p',{role:'status'},error):null,
    h('button.ibtn.wide',{onclick:()=>browse()},'Browse placements'),h('button.ibtn.wide.gray',{onclick:load},'Refresh campaigns'),
    h('div.group-h',null,'Your campaigns'),h('p',{style:{padding:'0 8px',fontSize:'13px'}},'Impressions are estimated from measured visibility. Unique viewers cover up to 90 days. Counts are not fraud-proof.'),
    mine?h('div.group',null,...mine.map(c=>row(c.title,`${slots?.find(s=>s.id===c.slot)?.name||'Placement'} · ${c.status.replaceAll('_',' ')} · payment ${c.payment_status} · ${Number(c.impressions)} estimated impressions · ${Number(c.unique_viewers)} viewers · ${Number(c.clicks)} clicks`,()=>campaign(c))),mine.length?null:h('p',{style:{padding:'12px'}},'Your bookings will appear here.')):h('p',null,'Loading campaigns…')));
  load().then(()=>{const c=arg?.campaign&&mine?.find(c=>c.id===+arg.campaign);if(c)return campaign(c);const id=arg?.placement||arg?.slot;if(id&&slots?.some(s=>s.id===id))book(slots.find(s=>s.id===id));});
  function browse(){
    if(!slots)return;
    win.page('Advertising placements',()=>h('div',null,h('p',{style:{padding:'0 8px'}},'Ground panels rent advertising surfaces only. Land ownership is separate.'),h('div.group',null,...slots.map(s=>row(s.name,`${s.type==='ground'?'Ground panel':'Billboard'} · ${s.width} × ${s.height} m · ${cedi(s.price)}/week · ${s.availability}`,()=>book(s))))));
  }
  function book(slot){
    const d=drafts.get(slot.id)||{weeks:1,title:'',phone:'',email:'',url:'',image:null};drafts.set(slot.id,d);
    const field=(key,label,type='text')=>h('label',{style:{display:'block',marginBottom:'12px'}},label,h('input',{type,value:d[key],maxlength:key==='title'?60:120,oninput:e=>{d[key]=e.target.value;},style:{width:'100%'}}));
    const picture=h('img',{hidden:!d.image,src:d.image||'',alt:'Your campaign artwork',style:{width:'100%',aspectRatio:'2/1',objectFit:'cover',borderRadius:'12px'}}),status=h('p',{role:'status'}),price=h('strong',null,cedi(slot.price*d.weeks));
    const upload=h('input',{type:'file',accept:'image/png,image/jpeg,image/webp','aria-label':'Campaign artwork',onchange:async e=>{
      const f=e.target.files[0];if(!f)return;
      if(f.size>4*1024*1024||!['image/png','image/jpeg','image/webp'].includes(f.type)){status.textContent='Use PNG, JPEG or WebP up to 4 MB.';return;}
      try{const bitmap=await createImageBitmap(f);const pixels=bitmap.width*bitmap.height;bitmap.close();if(pixels>1e7)throw Error();const reader=new FileReader();reader.onload=()=>{d.image=reader.result;picture.src=d.image;picture.hidden=false;};reader.readAsDataURL(f);}catch{status.textContent='Unreadable artwork or over 10 megapixels.';}
    }});
    const weeks=h('select',{'aria-label':'Campaign weeks',onchange:e=>{d.weeks=+e.target.value;price.textContent=cedi(slot.price*d.weeks);}},...Array.from({length:12},(_,i)=>h('option',{value:i+1,selected:i+1===d.weeks},`${i+1} week${i?'s':''}`)));
    let waiting=false;
    const pay=h('button.ibtn.wide.green',{disabled:slot.availability==='reserved',onclick:async()=>{
      if(waiting)return;if(!d.image){status.textContent='Add campaign artwork first.';return;}
      waiting=true;pay.disabled=true;status.textContent='Saving your booking…';
      try{const r=await request('/api/ads',{slot:slot.id,weeks:d.weeks,title:d.title,contact:d.phone,email:d.email,url:d.url,image:d.image,orderKey:purchaseKey('ad:'+slot.id)});
        if(r.payUrl){location.assign(r.payUrl);return;}status.textContent=r.error||r.message||`Order #${r.id} saved. ${r.pay||'Check your campaigns for payment status.'}`;
      }catch{status.textContent='Connection interrupted. Retry resumes the same purchase.';}finally{waiting=false;pay.disabled=false;}
    }},'Reserve and continue to payment');
    win.page(slot.name,()=>h('div.group',{style:{padding:'16px'}},h('p',null,`${slot.type==='ground'?'Exclusive ground rental':'Billboard'} · ${slot.width} × ${slot.height} m · ${cedi(slot.price)} / 7 days. ${slot.exclusive?'One campaign at a time.':'Shared rotation every 15 seconds.'}`),
      h('button.ibtn.wide.gray',{onclick:()=>act.previewAd(slot,d.image)},'Preview at this location'),field('title','Business / campaign name'),h('p',null,'Landscape 2:1. Output 1024 × 512; PNG/JPEG/WebP, maximum 4 MB and 10 megapixels. No executable content.'),upload,picture,field('phone','Ghana phone / mobile-money contact','tel'),field('email','Customer receipt email','email'),field('url','Website (optional)','url'),h('label',null,'Rental duration',weeks),h('p',null,'Total: ',price),h('p',null,'Paystack requests approval on your phone. Booking holds for 30 minutes; a late charge requires review. No instant activation or guaranteed impressions.'),pay,status));
  }
  function campaign(c){
    win.page(c.title,()=>h('div.group',{style:{padding:'16px'}},h('img',{src:c.img,alt:c.title,style:{width:'100%',aspectRatio:'2/1',objectFit:'cover'}}),h('p',null,`Placement: ${slots?.find(s=>s.id===c.slot)?.name||'Placement unavailable'}. ${c.weeks} weeks · ${cedi(c.amount)}. Status: ${c.status}. Payment: ${c.payment_status}.`),h('p',null,`Reference: ${c.ref}`),h('p',null,`Starts: ${c.starts?new Date(+c.starts).toLocaleString():'After payment and approval'}. Ends: ${c.ends?new Date(+c.ends).toLocaleString():'Not active'}.`),c.review_reason?h('p',null,c.review_reason):null,
      h('p',null,`${c.impressions} estimated impressions · ${c.unique_viewers} unique viewers (90 days) · ${c.clicks} clicks`),
      c.checkout_url&&c.payment_status==='pending'&&+c.expires>Date.now()?h('a.ibtn.wide',{href:c.checkout_url},'Resume saved checkout'):null,
      c.payment_status==='failed'?h('button.ibtn.wide',{onclick:async e=>{const button=e.currentTarget;button.disabled=true;try{const r=await request('/api/ads/retry',{id:c.id});if(r.payUrl)location.assign(r.payUrl);else act.toast(r.error||r.message||'Payment is being checked.');}catch{act.toast('Unable to resume payment. Try again later.');}finally{button.disabled=false;}}},'Retry saved payment'):null,
      c.payment_status==='pending'?h('button.ibtn.wide.gray',{onclick:async()=>{const r=await request('/api/ads/cancel',{id:c.id});if(r.ok)sessionStorage.removeItem('awd-purchase:ad:'+c.slot);act.toast(r.error||'Booking cancelled. Any late charge will be reviewed.');await load();win.pop();}},'Cancel unpaid booking'):null));
  }
}
