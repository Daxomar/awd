# Lagos Life deep dive: world, mechanics, UI, and what Accra We Dey changes

Companion to [lagoslife-reverse-engineering.md](lagoslife-reverse-engineering.md) (pass 1, which covered the daily loop).
Pass 2 was studied on 2026-10-29. Method: read the public client bundle (87 chunks, about 7.2 MB) in the built-in browser, and play our own game as a brand-new local account.
Lagos Life screens after sign-up were **not** seen, because account creation was out of bounds.
Every statement about their post-login game is *inferred* from data tables in the public client.
Nothing was copied. Our content is original and Accra-specific.

## 1. Their world model (inferred)

| Dimension | Lagos Life | Accra We Dey (before this pass) |
|---|---|---|
| Cities | 3 (Lagos, Abuja, Port Harcourt), each with an airport, motor parks and rail, plus flights, charter chopper and private jets | 1 city (Accra); Kotoka has a "Kumasi" trip action only |
| Venues on the map | about 150, each with `{id, name, area, emoji, blurb, map:{x,y}, open:[h,h], sky, ground, accent, actions}` | 55 places, of which 16 are estates or street areas, so about 39 real venues |
| Venue actions | **941**: food, leisure, work, civic, shopping and partner-brand actions | 231 |
| Action schema | `{id, label, emoji, minutes, cost, needs:{per-hour}, instant:{}, tags, moodlet, unlock(), opens*}`. `opens*` launches a panel: bus, flights, chopper, ballot, shop, wardrobe, screen, school, IPO | Similar: `{id, label, ic, min, cost, needs, inst, skill, earn, tags, opens}` |
| Scene schema per venue | `stations[]` (tappable object → action ids), `decor[]` props, `crowd[]` ambient NPCs with a pose and a **role caption** ("Groundnut seller", "Dozing in the 8 AM class"), `vibes[]` ambient lines, NPC outfit `styles[]`. There are 139 station sets and 149 crowd/vibe sets. | `zones[]` (equivalent to stations) and named `npcs[]` per venue. **No ambient vibes, no role captions.** |
| Vehicles | 29 owned vehicles, from your own okada and a painted danfo up to supercars, each with a nickname and fuel cost per km | 4 cars (Vitz, Corolla, Prado, G-Wagon) plus trotro, okada, taxi, Bolt and walking |
| Homes | Per city: face-me-I-face-you → self-contain → mini-flat → duplex → mansion | 8 home types plus estates and property |
| Phone apps referenced | Invest, Houses, Jobs, Bank, Family, Cars, Police, Gadgets, Staff, Bus Co, Court, Give, Business, Courses, Bet, Invite, Support, Hustle | 34 apps (overlapping) |
| Retention | Daily Hustle (3 quests, re-roll, bonus), streak and chest, freezes, level rings and unlocks, FTUE checklist | Pass 1 added the Today board (missions, streak, savers, daily paper) |
| Social and civic | Governor elections, party "spray", jail and bail, court, family, referrals, voice notes | AMA ballot, jail and bail, court, DMs, meet, events |

Their real edge is **content density and ambient life**. Most of their screens are the same pattern ours uses (map → venue sheet → stations → action), but every venue has 6–17 flavourful actions plus constant ambient captions.

## 2. Friction log: playing Accra We Dey as a new player (observed)

| # | What felt off | Severity | Status |
|---|---|---|---|
| F1 | Landing hero: the title and tagline overlap the illustration on a phone-size screen | Low | Open |
| F2 | The character editor's Body tab frames the torso and cuts off the head | Medium | Open (camera framing only; avatars untouched) |
| F3 | The "What would you like to see?" feedback sheet appeared **in the first minute** and then every 2.5–5 min, on boot, reconnect and resume | **High** | **Fixed**: never in the first 2 h of an account, at most once per 3 days, never after a suggestion was sent (`ui/suggestion-policy.js`) |
| F4 | Phone home: 34 apps over 3 pages; overlapping pairs (Houses/Property, Cars/Car market, Shop/Boutique, People/Contacts/Meet, Bank/Invest/Trade/Finances/Business, Milestones/Aspirations/My Life) | **High** | **Fixed**: one page with 6 daily apps and 6 folders (Money, Home & Car, Shopping, Me & People, City, More). No app removed; deep links unchanged (`phone/home-layout.js`) |
| F5 | The phone's "Today" widget opened Aspirations | Medium | **Fixed**: it now opens the Today board |
| F6 | 17 venues and 65 actions used a blank placeholder circle icon (blank map pins, blank action cards). Two more icon names did not exist in the shipped icon set (`person-simple-dance`, `palm-tree`) | **High** | **Fixed**: real icons for all of them, plus a test that every venue and action icon exists in Phosphor (`data.js` `PLACE_ICONS`/`ACTION_ICONS`). Food and drink actions now also get the eat/drink animation fallback |
| F7 | Venues feel static: nothing happens unless you act | **High** | **Fixed (first step)**: venue vibes give every venue, street and home 3–5 original Accra ambient lines in a pill under the HUD that never blocks taps (`ui/vibes.js`) |
| F8 | City chat is empty and silent for a new player; nothing to tap | Medium | **Fixed**: quick-phrase chips ("Chale, how far?", "Medaase, chale", …) fill the box, and the player still presses send |
| F9 | "Advertise here" placeholder billboards fill the map when no campaign is booked | Medium | Open: ad inventory is a monetization surface and needs the owner's approval to change |
| F10 | The HUD status extras (Today, gem hunt, sickness) only show inside the "How you dey?" sheet | Low | By design since commit 282f758; the Phone badge now counts claimable Today missions |
| F11 | Every venue is open around the clock | n/a | Intentional (`isOpen` returns true: "24/7 Accra life") |

## 3. Roadmap (ranked by impact on engagement)

1. **Content density**: grow from about 6 to 10+ actions per venue, mapped to zones, especially food (waakye variants, sobolo, bofrot, kelewele), leisure (Labadi horse rides, Jamestown boxing gym), work and civic actions. Each needs a zone entry in `scene/venues.js`, so do it per venue with tests.
2. **Ambient crowd with role captions**: give existing NPCs a short role line ("Selling pure water", "Waiting for a Kaneshie trotro") over their heads. This builds on `npcs[]`.
3. **Vehicle ladder**: about 12 Accra-realistic vehicles with nicknames (own okada, Kia Picanto "Yellow Yellow", Toyota Vitz "Small but Mighty", Corolla "Benz of the People", Hyundai Elantra, Prado, Land Cruiser V8, G-Wagon). Needs ride-scene models and economy tuning.
4. **Intercity trips**: Kotoka → Kumasi and Takoradi; VIP and STC bus from Circle/Kaneshie, with time cost and themed actions.
5. **Party spray and funerals**: server-controlled money spraying at Vibes and funerals (phase 2 of pass 1).
6. **MCE election cycle**: candidacy, votes and one city policy per term, using the existing `shard.policy` hooks.
7. **Billboards**: show in-world house promos (Today board, events) when no paid campaign is booked. **Needs owner approval** (ads surface).
8. **Character editor framing** (F2) and **landing hero overlap** (F1).
