// Venue "vibes": short ambient lines that make each place feel alive while you are in it.
// Display only: nothing here changes state. Lines are original Accra flavour.
import { h, icf } from './dom.js';

export const VIBES = {
  circle: ['A mate is shouting "Kaneshie-Kaneshie-Kaneshie!"', 'Horns from every direction at the interchange', 'Somebody is selling phone chargers from a wheelbarrow', 'A preacher with a speaker is outshouting the traffic', 'Pure water sachets flying through trotro windows'],
  muni: ['The waakye leaf smell has reached the main road', 'Auntie Muni asks: "Gari, spaghetti, wele, egg?"', 'The queue is mostly office shirts and school uniforms', 'Somebody begs for "small more shito"'],
  makola: ['"Customer, come and buy!" from three directions', 'A kayayo balances a full basin through the crowd', 'Tomato prices have gone up again. Everyone is complaining', 'Fabric stalls glowing with fresh wax print'],
  kantamanto: ['A fresh bale just burst open. People are rushing', '"Obroni wawu! Ten cedis, ten cedis!"', 'A tailor is hemming jeans on the spot', 'Somebody found a jacket with the tag still on'],
  chopbar: ['The fufu pounders are keeping perfect rhythm', 'Light soup steam rising from the pot', 'Two men arguing football over goat meat', 'Madam Jah: "Who ordered the extra meat?"'],
  kenkey: ['Fresh kenkey balls unwrapped from dried leaves', 'The fried fish just came out of the oil', 'Pepper being ground with tomatoes and onions'],
  oxford: ['Kelewele frying on every corner', 'Music from three bars at once', 'Tourists bargaining for beads', 'A street artist painting portraits on the pavement', 'Taxi drivers calling "Drop? Drop?"'],
  vibes: ['The DJ just dropped an amapiano remix', 'Somebody is spraying cedis on the dance floor', 'The VIP section is ordering another round', 'Azonto circle forming in the middle'],
  hub: ['Somebody is pitching "Uber for fufu pounding"', 'The Wi-Fi is fast today. Everyone is downloading', 'A founder is on a call with investors in London', 'Free jollof at the meet-up tonight'],
  bank: ['The queue is moving slowly. Very slowly', 'The security man checks every bag', 'Somebody is arguing about charges'],
  ridge: ['A nurse calls the next patient', 'The pharmacy window has a long line', 'Somebody is asking for their NHIS card'],
  korlebu: ['The waiting hall is packed', 'Medical students rushing between wards', 'A family is sharing banku in the courtyard'],
  police: ['A man is explaining how his phone was snatched', 'The desk officer is writing slowly in a big book', 'A radio crackles in the back office'],
  memorial: ['A school group is listening to the guide', 'Tourists taking photos by the fountains', 'Quiet green lawns in the middle of the city'],
  blackstar: ['Joggers doing laps around the square', 'Kites flying high over the arch', 'Sea breeze across the open ground'],
  castle: ['The guide is telling a hard story quietly', 'Waves hitting the old walls', 'Visitors standing silently at the door'],
  lighthouse: ['The view from the top stretches to the harbour', 'Fishermen are mending nets below', 'Kids racing up the stairs'],
  bukom: ['Gloves hitting pads in rhythm', 'The coach shouts "Hands up! Hands up!"', 'A young boxer is shadowboxing alone', 'Fight posters peeling on the walls'],
  canoes: ['Painted canoes pulled up on the sand', 'The fishermen are singing as they pull the net', 'Fish sellers waiting with basins'],
  labadi: ['Horses for hire walking the beach', 'Drummers starting a jam on the sand', 'Somebody is selling coconut from a cart', 'The waves are strong today', 'A group playing beach football'],
  funeral: ['Red and black cloth everywhere', 'The brass band is playing highlife', 'Someone is announcing donations on the mic', 'The dancing has started'],
  church: ['The choir is warming up', 'The pastor says "Somebody shout Amen!"', 'Offering bowls going round'],
  mosque: ['The call to prayer echoes over Nima', 'Men washing before prayers', 'Children reading at the madrasa'],
  stadium: ['The Hearts and Kotoko fans are trading songs', 'Vuvuzelas in the stands', 'Groundsmen marking the pitch'],
  viewing: ['The whole room screams at a near miss', 'Betting slips everywhere', 'Somebody is explaining tactics to nobody'],
  radio: ['The presenter is reading listeners\' text messages', '"Caller, you are on air!"', 'A highlife classic is playing in the studio'],
  mall: ['The AC is a relief after the sun', 'Teenagers taking selfies by the fountain', 'A new phone launch at the gadget shop'],
  ug: ['Students reviewing past questions under the trees', 'Hall week celebrations getting loud', 'The night market is lighting up'],
  airport: ['A family is crying happy tears at Arrivals', 'Taxi drivers waiting with name cards', 'A plane is coming in low over the city'],
  hotel: ['Live band by the pool tonight', 'Guests in white linen at the bar', 'A wedding party is taking photos in the garden'],
  ama: ['Somebody is paying their property rate', 'A community meeting notice on the board', 'Traders asking about permits'],
  cars: ['A salesman polishing a Prado', 'Somebody test-driving round the lot', '"Home-used, no accident, straight from Belgium!"'],
  momo: ['"Network is down, come back small"', 'Somebody cashing out for rent', 'The agent counting notes fast'],
  cinema: ['Popcorn smell everywhere', 'The Kumawood trailer got loud laughs', 'Couples choosing seats at the back'],
  court: ['Lawyers in black gowns hurrying', 'A case is called. Everyone stands', 'Families waiting on the benches'],
  aboki: ['Khebab sticks sizzling on the grill', '"Plenty pepper or small?"', 'Taxi drivers on a quick break'],
  fanyogo: ['Fan Ice bicycle bells ringing', 'Kids fighting over the last FanYogo', 'Ice cream melting fast in the sun'],
  restaurant: ['Jollof versus jollof debate at table three', 'The waiter recommends the tilapia', 'Afrobeats playing softly'],
  gymlegon: ['Weights clanking', 'A trainer counts "two more, two more!"', 'Treadmills facing the window'],
  street: ['A trotro mate calls the next stop', 'Somebody\'s generator is roaring', 'Kids playing football with a plastic ball', 'A hawker balances a tray of bofrot', 'Neighbours gisting on a bench'],
  home: ['A neighbour\'s radio is playing gospel', 'You can hear kids playing outside', 'The fan is doing its best'],
};
// Fallbacks: neighbourhood streets share street life; your home and visits share home life.
export function vibeLines(place = '') {
  if (VIBES[place]) return VIBES[place];
  if (place.startsWith('n:')) return VIBES.street;
  if (place === 'home' || place.startsWith('visit:') || place.startsWith('e:')) return VIBES.home;
  return [];
}
export const pickVibe = (lines, i) => (lines.length ? lines[((i % lines.length) + lines.length) % lines.length] : null);

const FIRST_MS = 6000, EVERY_MS = 28000, SHOW_MS = 6500;
// Starts the ticker for a place and returns a stop function. Safe to call on every room change.
export function startVibes(ui, place) {
  const lines = vibeLines(place); if (!lines.length) return () => {};
  const el = h('div.venue-vibe', { role: 'status', 'aria-live': 'polite', hidden: true });
  ui.append(el); let i = Math.floor(Math.random() * lines.length), hideTimer = null;
  const show = () => {
    if (document.hidden || document.querySelector('.sheet-back:not([hidden]), .phone-back:not([hidden])')) return;
    el.replaceChildren(icf('chat-teardrop-dots'), h('span', null, pickVibe(lines, i++))); el.hidden = false; el.classList.add('in');
    clearTimeout(hideTimer); hideTimer = setTimeout(() => { el.classList.remove('in'); setTimeout(() => { el.hidden = true; }, 400); }, SHOW_MS);
  };
  const first = setTimeout(show, FIRST_MS), every = setInterval(show, EVERY_MS);
  return () => { clearTimeout(first); clearInterval(every); clearTimeout(hideTimer); el.remove(); };
}
