// Additional public venues and street life. Amounts are simulation prices in GH₵.
const food = (id, label, cost, hunger, open) => ({ id, label, ic: 'icon:bowl-food', min: 15, cost, inst: { hunger, fun: 8 }, tags: ['eat'], ...(open ? { open } : {}) });
export const STREET_ACTS = [
  food('khebab', 'Aboki beef khebab', 20, 28, [17, 26]),
  food('chickenkhebab', 'Chicken khebab', 25, 34, [17, 26]),
  food('fanyogo', 'FanYogo frozen yoghurt', 8, 12, [9, 19]),
  food('fanice', 'FanIce vanilla', 10, 14, [9, 19]),
  food('provisionsnack', 'Water and a snack', 10, 16),
  food('streetmeal', 'Jollof at the neighbourhood joint', 30, 45),
  { id: 'barber', label: 'Choose a hairstyle', ic: 'icon:scissors', opens: 'wardrobe', tags: ['shop'] },
  { id: 'stroll', label: 'Stroll around the neighbourhood', ic: 'icon:person-simple-walk', min: 30, needs: { fun: 20, energy: -6 }, skill: { fitness: .15 }, tags: ['relax', 'sport'] },
  { id: 'streetgames', label: 'Play games with a neighbour', ic: 'icon:game-controller', opens: 'games', tags: ['games'] },
  { id: 'streetwatch', label: 'Watch football', ic: 'icon:television', min: 45, cost: 5, needs: { fun: 40, social: 20 }, tags: ['tv', 'relax'] },
  { id: 'streetbet', label: 'Match predictions', ic: 'icon:soccer-ball', opens: 'matches', tags: ['sport'] },
];
export const EXTRA_LOCATIONS = {
  cinema: { name: 'Silverbird Cinemas, Accra Mall', area: 'Tetteh Quarshie', ic: 'icon:film-slate', ll: [5.6228, -.1731], open: [10, 24], blurb: 'A cinema foyer and screening room. Original animated shorts on the screen.', acts: [
    { id: 'film', label: 'Watch an animated short', ic: 'icon:film-slate', min: 90, cost: 80, needs: { fun: 45, social: 8 }, tags: ['relax'] }, food('popcorn', 'Popcorn and a drink', 35, 18),
  ] },
  court: { name: 'Law Court Complex, High Street', area: 'Accra Central', ic: 'icon:scales', ll: [5.5440, -.2056], open: [8, 17], days: [1, 2, 3, 4, 5], blurb: 'Court reception, public gallery and legal information desk.', acts: [
    { id: 'gallery', label: 'Sit in the public gallery', ic: 'icon:scales', min: 30, needs: { fun: 5, social: 10 }, tags: ['tour'] },
    { id: 'legal', label: 'Read about custody and release', ic: 'icon:book-open', opens: 'police', tags: ['tour'] },
  ] },
  aboki: { name: 'Aboki Khebab Joint, Oxford Street', area: 'Osu', ic: 'icon:fire', ll: [5.5640, -.1807], open: [17, 26], blurb: 'Charcoal grills, suya spice and fresh skewers. The grill opens at 17:00 Accra time.', acts: STREET_ACTS.filter(a => ['khebab', 'chickenkhebab'].includes(a.id)) },
  fanyogo: { name: 'FanYogo Ice Cream Stop, Circle', area: 'Circle', ic: 'icon:ice-cream', ll: [5.5694, -.2198], open: [9, 19], blurb: 'A bicycle vendor with FanYogo and FanIce for a hot Accra afternoon.', acts: STREET_ACTS.filter(a => ['fanyogo', 'fanice'].includes(a.id)) },
  restaurant: { name: 'Oxford Street Restaurant, Osu', area: 'Osu', ic: 'icon:fork-knife', ll: [5.5575, -.1796], open: [11, 24], blurb: 'Table service, jollof, grilled tilapia and a place to meet friends.', acts: [food('jollof', 'Chicken jollof', 65, 65), food('tilapia', 'Grilled tilapia and banku', 100, 80)] },
  gymlegon: { name: 'East Legon Fitness Club', area: 'East Legon', ic: 'icon:barbell', ll: [5.6350, -.1635], open: [5, 23], blurb: 'A neighbourhood gym with weights, benches and training space.', acts: [{ id: 'train', label: 'Weight training', ic: 'icon:barbell', min: 45, cost: 35, needs: { fun: 12, hygiene: -20, energy: -15 }, skill: { fitness: .7 }, tags: ['sport', 'workout'] }] },
};
export function neighbourhoodLocations(homes) {
  return Object.fromEntries(Object.entries(homes).flatMap(([id, home]) => [['e:'+id,{name:home.area+' player estate',area:home.area,ic:'icon:house-line',ll:[home.ll[0]+.0012,home.ll[1]+.002],open:[0,24],estate:id,blurb:'Purchased player homes in this neighbourhood. Select a home to meet its owner.',acts:[]}],['n:' + id, {
    name: home.area + ' neighbourhood', area: home.area, ic: 'icon:buildings', ll: [home.ll[0] + .0007, home.ll[1] + .0008], open: [0, 24], neighbourhood: id,
    blurb: 'Walk the streets, meet neighbours, visit local joints and find player-owned houses. Aboki grills open in the evening; the ice cream vendor sells in the day.', acts: STREET_ACTS,
  }]]));
}
