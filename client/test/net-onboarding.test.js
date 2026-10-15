import test from 'node:test';
import assert from 'node:assert/strict';
import {Net} from '../src/v2/net.js';
test('a welcomed onboarding connection reconnects while room packets remain held',async()=>{
 const original=globalThis.WebSocket,location=globalThis.location;
 class Socket {static OPEN=1;readyState=1;send(){}close(){} }
 globalThis.WebSocket=Socket;globalThis.location={protocol:'http:',host:'localhost'};
 const net=new Net();net.backoff=10;
 try{
  const first=net.connect('cookie');net.ws.onmessage({data:JSON.stringify({t:'welcome',now:Date.now(),state:{}})});await first;
  net.ws.onmessage({data:JSON.stringify({t:'room',key:'stale'})});assert.equal(net.held.length,1);
  net.backoff=10;const closed=net.ws;closed.onclose({code:1006});assert.ok(net.retryTimer);
  await new Promise(resolve=>setTimeout(resolve,25));assert.notEqual(net.ws,closed);assert.equal(net.held.length,0);
  let progress;net.on('onboarding',m=>progress=m);net.ws.onmessage({data:JSON.stringify({t:'welcome',now:Date.now(),state:{}})});
  net.ws.onmessage({data:JSON.stringify({t:'onboarding',id:'save',ok:true})});assert.ok(progress.ok);assert.equal(net.holding,true);
 }finally{net.close();globalThis.WebSocket=original;globalThis.location=location;}
});
