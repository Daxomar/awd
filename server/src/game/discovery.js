// Authored optional neighbourhood activities. No new destination or money faucet.
export const NEIGHBOURHOOD_ACTIVITIES = {
  nima:{id:'nima_courtyard',label:'Join courtyard conversation',ic:'icon:chats',min:25,needs:{social:30,fun:12},skill:{charisma:.25},tags:['social']},
  jtown:{id:'jtown_harbour',label:'Listen to harbour stories',ic:'icon:sailboat',min:30,needs:{social:24,fun:16},skill:{charisma:.2},tags:['social','tour']},
  kaneshie:{id:'kaneshie_prices',label:'Compare provisions prices',ic:'icon:basket',min:30,needs:{fun:12,energy:-4},skill:{hustle:.3},tags:['shop','study']},
  labadi:{id:'labadi_stretch',label:'Neighbourhood mobility session',ic:'icon:person-simple-walk',min:25,needs:{fun:20,energy:-8,hygiene:-6},skill:{fitness:.3},tags:['sport','relax']},
  osu:{id:'osu_photo',label:'Oxford side-street photo walk',ic:'icon:camera',min:30,needs:{fun:22,energy:-6},skill:{photo:.3},tags:['photo','tour']},
  airres:{id:'airres_exchange',label:'Join a language exchange',ic:'icon:chat-circle-dots',min:30,needs:{social:26,fun:12},skill:{charisma:.3},tags:['study','social']},
  legon:{id:'legon_study',label:'Join the neighbourhood study circle',ic:'icon:book-open',min:35,needs:{social:20,fun:8,energy:-6},skill:{coding:.25},tags:['study','social']},
  trasacco:{id:'trasacco_walk',label:'Take the garden circuit',ic:'icon:leaf',min:30,needs:{fun:24,energy:-6},skill:{fitness:.2},tags:['relax','sport']},
};
export const SOCIAL_HUBS=['makola','labadi','ug','vibes','n:jtown'];
export function discoverable(loc){
  if(loc.estate)return {kind:'estate',reason:'Visit player-owned homes with the resident’s invitation.',hub:false};
  const tags=new Set(loc.acts.flatMap(a=>a.tags||[]));
  const kind=loc.neighbourhood?'neighbourhood':tags.has('study')?'learning':tags.has('shop')?'market & shopping':tags.has('eat')?'food & company':tags.has('sport')?'sport':tags.has('party')?'nightlife':tags.has('tour')?'culture & services':'community';
  return {kind,reason:loc.blurb,hub:SOCIAL_HUBS.includes(loc.id),activities:loc.acts.map(a=>a.id)};
}
