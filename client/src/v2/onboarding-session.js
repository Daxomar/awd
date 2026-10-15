// Correlate replies before sending, serialize mutations and bound every wait.
// Only acknowledged server state drives checkpoints and the birth result.
export class OnboardingSession {
  constructor(net,state,{onState=()=>{},onConnection=()=>{},timeout=10000}={}) {
    this.net=net;this.state=state;this.timeout=timeout;this.pending=new Map();this.tail=Promise.resolve();this.serial=0;
    this.apply=(state,reason)=>{this.state=state;onState(state,reason);};
    this.off=[net.on('onboarding',m=>{
      if(m.state)this.apply(m.state,'reply');const p=this.pending.get(m.id);if(!p)return;
      clearTimeout(p.timer);this.pending.delete(m.id);m.ok?p.resolve(m):p.reject(new Error(m.error||'Could not save your setup. Try again.'));
    }),net.on('reconnected',w=>this.apply(w.state,'reconnect')),net.on('connection',m=>{
      if(!m.connected){for(const p of this.pending.values()){clearTimeout(p.timer);p.reject(new Error('Connection lost. Your saved step will return when you reconnect.'));}this.pending.clear();}
      onConnection(m);
    })];
  }
  request(op,fields={}) {
    const run=()=>new Promise((resolve,reject)=>{
      if(this.closed)return reject(new Error('Setup closed.'));
      if(!this.net.connected)return reject(new Error('Connection lost. Wait for reconnection, then try again.'));
      const id='setup-'+Date.now().toString(36)+'-'+(++this.serial);
      const timer=setTimeout(()=>{this.pending.delete(id);reject(new Error('Saving took too long. Reconnect or try again.'));},this.timeout);
      this.pending.set(id,{resolve,reject,timer});
      if(!this.net.send({t:'onboarding',...fields,op,id,revision:this.state.onboarding?.revision||0})){
        clearTimeout(timer);this.pending.delete(id);reject(new Error('Connection lost. Your previous saved step is safe.'));
      }
    });
    const request=this.tail.then(run);this.tail=request.catch(()=>{});return request;
  }
  dispose(){this.closed=true;this.off.forEach(off=>off());for(const p of this.pending.values()){clearTimeout(p.timer);p.reject(new Error('Setup closed.'));}this.pending.clear();}
}
