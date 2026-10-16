// Explicit disposable local database only. Provider calls are mocked; no real money.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
assert.notEqual(process.env.NODE_ENV,'production','Do not run fixture mutation against a production environment.');
const url=new URL(process.env.DATABASE_URL||'postgres://invalid/invalid');
assert.ok(['127.0.0.1','localhost'].includes(url.hostname)&&url.pathname.endsWith('_security'),'Use an isolated local *_security database.');
delete process.env.PAYSTACK_SECRET_FILE;
process.env.PAYSTACK_SECRET='sk_test_mock_never_contacts_paystack';
process.env.PAYMENT_ADMIN_EMAIL='admin-receipts@example.com';
const {pool,migrate}=await import('../src/db.js');
const Ads=await import('../src/ads.js'),Social=await import('../src/social.js'),Pay=await import('../src/payments.js');
let initCalls=0;const responses=new Map(),initializations=[];let loseInit=false;
globalThis.fetch=async(address,opts)=>{
  assert.ok(String(address).startsWith('https://api.paystack.co/'),'Provider host restriction');
  if(String(address).endsWith('/initialize')){
    initCalls++;const b=JSON.parse(opts.body);initializations.push(b);if(loseInit)throw new Error('Mock interruption');
    return {json:async()=>({status:true,data:{reference:b.reference,authorization_url:'https://checkout.paystack.com/mock-'+b.reference}})};
  }
  const ref=String(address).split('/').at(-1);return {json:async()=>responses.has(ref)?{status:true,data:responses.get(ref)}:{status:false}};
};
const pass=[];
try{
  await migrate();await Ads.migrateAds();await Social.migrateSocial();await Pay.migratePayments();
  Pay.registerPayment('ad',Ads.fulfillPayment);Pay.registerPayment('topup',Social.fulfillPayment);
  const acct=+(await pool.query('insert into accounts(username,pass) values($1,$2) returning id',['pm'+Date.now().toString(36),'unused-mock-account'])).rows[0].id;
  const key=crypto.randomUUID(),config={acct,type:'topup',key,amount:1000,email:'test@example.com',phone:'0240000000',context:{screen:'momo',pack:'p10'}};
  const factory=async(db,ref)=>+(await db.query("insert into topups(acct,pack,ghs,coins,ref) values($1,'p10',10,600,$2) returning id",[acct,ref])).rows[0].id;
  const pair=await Promise.all([Pay.startPayment(config,factory),Pay.startPayment(config,factory)]);
  assert.equal(pair[0].ref,pair[1].ref);assert.equal(initCalls,1);assert.equal((await Pay.startPayment({...config,key:crypto.randomUUID()},factory)).ref,pair[0].ref);assert.equal(initCalls,1);assert.equal((await Pay.startPayment(config,factory)).payUrl,pair[0].payUrl);pass.push('concurrent initialization/reload creates one persistent order and checkout');
  const ref=pair[0].ref,ok={reference:ref,status:'success',currency:'GHS',amount:1000,id:Date.now()};
  const callback=new URL(initializations[0].callback_url);assert.equal(callback.origin,new URL(process.env.PUBLIC_URL||'http://localhost:8080').origin);
  assert.equal(Pay.readReturn(callback.searchParams.get('payment')),ref);
  assert.ok((await Pay.paymentReturn(callback.searchParams.get('payment'),acct+1)).error);pass.push('signed callback and account ownership');
  await Pay.finalize({...ok,amount:999});assert.equal((await pool.query('select count(*) from credits where to_id=$1',[acct])).rows[0].count,'0');
  await Pay.finalize({...ok,currency:'NGN'});assert.equal((await pool.query('select count(*) from credits where to_id=$1',[acct])).rows[0].count,'0');pass.push('wrong amount/currency never credit');
  responses.set(ref,ok);await Promise.all([Pay.verifyPayment(ref),Pay.verifyPayment(ref)]);
  assert.equal((await pool.query('select count(*) from credits where to_id=$1',[acct])).rows[0].count,'1');
  const raw=Buffer.from(JSON.stringify({event:'charge.success',data:ok})),sig=crypto.createHmac('sha512',process.env.PAYSTACK_SECRET).update(raw).digest('hex');
  assert.equal(await Pay.webhook(raw,'f'.repeat(128)),false);assert.equal(await Pay.webhook(raw,sig),true);assert.equal(await Pay.webhook(raw,sig),true);
  assert.equal((await pool.query('select sum(amount) n from credits where to_id=$1',[acct])).rows[0].n,'600');pass.push('verification and signed webhook retries fulfill once');
  assert.equal(initializations[0].email,'test@example.com','Provider keeps the actual customer receipt address');
  const receipts=(await pool.query('select destination from payment_receipt_outbox r join payment_orders o on o.id=r.order_id where o.acct=$1',[acct])).rows;
  assert.deepEqual(receipts,[{destination:'admin-receipts@example.com'}],'One backend administrative-copy outbox record, no duplicate receipt');
  assert.equal((await Pay.finalize({...ok,id:ok.id+1})).status,'review');
  assert.equal((await pool.query('select count(*) from credits where to_id=$1',[acct])).rows[0].count,'1');pass.push('second provider charge retained for refund review, no second credit');
  const next=await Pay.startPayment({...config,key:crypto.randomUUID()},factory);responses.set(next.ref,{...ok,reference:next.ref,id:ok.id+2});
  await Pay.reconcile(50);assert.equal((await pool.query('select count(*) from credits where to_id=$1',[acct])).rows[0].count,'2');pass.push('missing webhook reconciles independently of browser return');
  loseInit=true;const unknown=await Pay.startPayment({...config,key:crypto.randomUUID()},factory),calls=initCalls;
  assert.ok(unknown.pending);await Pay.startPayment({...config,key:(await pool.query('select purchase_key from payment_orders o join payment_attempts a on a.order_id=o.id where a.ref=$1',[unknown.ref])).rows[0].purchase_key},factory);
  assert.equal(initCalls,calls);pass.push('interrupted initialization persists and cannot start a second charge');
  await Pay.migratePayments();assert.equal((await pool.query('select count(*) from credits where to_id=$1',[acct])).rows[0].count,'2');pass.push('migration rerun does not replay historical fulfillment');
  loseInit=false;
  const retryConfig={...config,key:crypto.randomUUID(),amount:2500,context:{screen:'momo',pack:'p25'}};
  const factory25=async(db,ref)=>+(await db.query("insert into topups(acct,pack,ghs,coins,ref) values($1,'p25',25,1700,$2) returning id",[acct,ref])).rows[0].id;
  const failed=await Pay.startPayment(retryConfig,factory25);responses.set(failed.ref,{...ok,reference:failed.ref,amount:2500,id:ok.id+10,status:'failed'});
  assert.equal((await Pay.verifyPayment(failed.ref)).status,'failed');
  const retried=await Pay.startPayment(retryConfig,factory25);assert.equal(retried.id,failed.id);assert.notEqual(retried.ref,failed.ref);
  responses.set(retried.ref,{...ok,reference:retried.ref,amount:2500,id:ok.id+11});assert.equal((await Pay.verifyPayment(retried.ref)).status,'fulfilled');
  responses.set(failed.ref,{...ok,reference:failed.ref,amount:2500,id:ok.id+10});
  await pool.query("update payment_attempts set checked_at=now()-interval '11 minutes' where ref=$1",[failed.ref]);
  const late=await Pay.reconcile(50);assert.equal(late.checked.find(a=>a.ref===failed.ref)?.status,'review');
  assert.equal((await pool.query('select count(*) n from credits where to_id=$1',[acct])).rows[0].n,'3');
  pass.push('confirmed failure retries the same order with a durable new attempt; late old success flagged without double credit');
  console.log(JSON.stringify({passed:pass.length,checks:pass},null,2));
}finally{await pool.end();}
