// Session keys preserve one intended purchase across taps, reloads and checkout returns.
export function purchaseKey(kind) {
  const name='awd-purchase:'+kind;
  let key=sessionStorage.getItem(name);
  if(!key){key=crypto.randomUUID();sessionStorage.setItem(name,key);}
  return key;
}
export function completePurchase(context) {
  sessionStorage.removeItem('awd-purchase:'+(context.screen==='ads'?'ad:'+context.placement:'topup:'+context.pack));
}
export async function resumePayment(phone,toast,opts={}){
  const params=new URLSearchParams(location.search);
  const state=params.get('payment');if(!state)return;
  const placementParam=params.get('placement');
  try{
    const r=await fetch('/api/payment/return',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({state})}).then(r=>r.json());
    if(r.error){toast(r.error,'bad');return;}
    if(r.status==='fulfilled'){
      completePurchase(r.context);
      const isAd = r.context?.screen === 'ads';
      toast(isAd ? 'Payment confirmed! Your billboard ad is now live on the map.' : 'Payment verified. Your wallet credit is saved.', 'good');
      if(isAd){
        const slotId = r.context?.placement || placementParam;
        if(opts.onAdConfirmed) opts.onAdConfirmed(slotId, r.context);
      }
    }
    else toast(r.status==='review'?'Payment needs review. Keep your reference.':'Payment is still being checked. Your purchase is saved.');
    if(r.context?.screen !== 'ads'){
      phone.show('momo',{...r.context,payment:{ref:r.ref,status:r.status}});
    }
    // Leave a pending token in the URL so a reload can retry verification safely.
    if(r.status==='fulfilled')history.replaceState(null,'',location.pathname);
  }catch{toast('Unable to check payment. Reload to try again.','bad');}
}
