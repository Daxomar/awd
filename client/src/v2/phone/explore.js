import {h} from '../ui/dom.js';
import {G,isOpen,hours} from '../store.js';
export function explore(win,act){
  let mode='hubs';
  win.page('Explore Accra',()=>{
    const places=G.cat.locs.filter(l=>!l.estate&&(mode!=='hubs'||l.discovery?.hub));
    return h('div',null,h('p',{style:{padding:'0 8px'}},'Choose your own next stop. Counts are connected players on this server, across its public rooms; private homes are excluded.'),
      h('div.row',null,...[['hubs','Social hubs'],['all','All places']].map(([id,label])=>h('button.ibtn.grow'+(mode===id?'':'.gray'),{onclick:()=>{mode=id;win.refresh();}},label))),
      h('div.group',null,...places.map(l=>h('button.cell.noic',{onclick:()=>details(l)},h('div.cm',null,h('div.c1',null,l.name),h('div.c2',null,`${l.area} · ${l.discovery?.kind||'Place'} · ${isOpen(l)?'Open':'Closed'} · ${G.places[l.id]||0} here`))))));
  });
  function details(l){
    win.page(l.name,()=>h('div',null,h('p',{style:{padding:'0 8px'}},l.discovery?.reason||l.blurb),h('p',{style:{padding:'0 8px'}},`${hours(l.open)} · ${G.places[l.id]||0} online here on this server`),
      h('div.group',null,...l.acts.map(a=>h('div.cell.noic',null,h('div.cm',null,h('div.c1',null,a.label),h('div.c2',null,a.opens?'Opens an existing game service':`${a.min||10} game minutes${a.cost?' · GH₵'+a.cost:''}${a.open?' · '+hours(a.open):''}`))))),
      h('button.ibtn.wide.green',{onclick:()=>{act.closePhone();if(G.state.place===l.id)act.interact();else act.place(l.id);}},G.state.place===l.id?'See activities around you':'Find entrance and travel options')));
  }
}
