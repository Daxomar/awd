// One game-lifetime subscription set. The existing protocol has no request IDs;
// allow one contextual action at a time and match its busy/minigame ID.
export class ActivityRequests {
 constructor(net,{timeout=10000}={}){
  this.net=net;this.timeout=timeout;
  this.off=[net.on('busy',m=>{if(m.busy?.id===this.pending?.id)this.finish(true,m);}),net.on('mg',m=>{if(m.act===this.pending?.id)this.finish(true,m);}),net.on('toast',m=>{if(this.pending&&m.k==='bad')this.finish(false,new Error(m.m));}),net.on('connection',m=>{if(!m.connected&&this.pending)this.finish(false,new Error('Connection lost. Reconnect before trying again.'));})];
 }
 request(message){
  if(this.pending)return Promise.reject(new Error('Wait for the current action to be confirmed.'));
  if(!this.net.connected)return Promise.reject(new Error('Reconnecting. Try again when you are online.'));
  return new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>this.finish(false,new Error('The action was not confirmed. Check your connection and try again.')),this.timeout);
   this.pending={id:message.id,resolve,reject,timer};
   if(!this.net.send(message))this.finish(false,new Error('Could not send the action. Try again after reconnecting.'));
  });
 }
 finish(ok,result){const p=this.pending;if(!p)return;this.pending=null;clearTimeout(p.timer);ok?p.resolve(result):p.reject(result);}
 dispose(){this.off.forEach(off=>off());if(this.pending)this.finish(false,new Error('Game closed.'));}
}
