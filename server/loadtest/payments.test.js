import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { providerMatch, validKey, phoneNumber, receiptEmail, returnToken, readReturn, signatureValid } from '../src/payments.js';

test('payment success requires exact provider reference, amount, currency and transaction ID',()=>{
  const o={ref:'awd_'+'a'.repeat(20),amount:'120000',currency:'GHS'},d={reference:o.ref,amount:120000,currency:'GHS',status:'success',id:456};
  assert.equal(providerMatch(o,d),null);
  for(const change of [{reference:'other'},{amount:120001},{amount:'120000'},{currency:'NGN'},{status:'pending'},{id:null},{id:Number.MAX_SAFE_INTEGER+1}])assert.ok(providerMatch(o,{...d,...change}));
  assert.equal(providerMatch(o,{...d,id:'9007199254740999'}),null);
});
test('payment return tokens reject edits, expiry and arbitrary redirects',()=>{
  const ref='awt_'+'b'.repeat(20),now=Date.now(),token=returnToken(ref,now+10000);
  assert.equal(readReturn(token,now),ref);assert.equal(readReturn(token+'x',now),null);
  assert.equal(readReturn(token,now+10001),null);assert.equal(readReturn('https://evil.example'),null);
  assert.equal(readReturn(token.replace('awt_','awd_'),now),null);
});
test('raw webhook authenticity is checked before parsing',()=>{
  const raw=Buffer.from('{"event":"charge.success"}'),key='test-secret';
  const sig=crypto.createHmac('sha512',key).update(raw).digest('hex');
  assert.equal(signatureValid(raw,sig,key),true);assert.equal(signatureValid(Buffer.from('{}'),sig,key),false);
  assert.equal(signatureValid(raw,'x',key),false);assert.equal(signatureValid(raw,sig,''),false);
});
test('customer and idempotency validation does not treat a number as authorization',()=>{
  assert.equal(phoneNumber('024 000 0000'),'+233240000000');assert.equal(phoneNumber('+233550001111'),'+233550001111');
  assert.equal(phoneNumber('javascript:alert(1)'),null);assert.equal(receiptEmail('customer@example.com'),'customer@example.com');
  assert.equal(receiptEmail('phone-only'),null);assert.equal(validKey('purchase_123456789'),true);assert.equal(validKey('../bad'),false);
});
