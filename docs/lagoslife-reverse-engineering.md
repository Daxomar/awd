# Lagos Life → Accra We Dey: reverse engineering and gap map

Pass 2 (world, scenes, vehicles, phone and UX friction log): [lagoslife-deep-dive.md](lagoslife-deep-dive.md).

Studied 2026-10-29 in the built-in browser at a 375×812 phone viewport, with non-essential cookies declined.
Nothing was copied: no code, art or text from lagoslife.app is in this repository.
The mechanics below are re-created in original form with Accra content.

## How it was studied (evidence and limits)

| Source | What it showed |
|---|---|
| Public landing page `https://lagoslife.app/` | An isometric 3D city map with tappable venue pins. A top bar shows "active today" and visit counters. Three chips: Governor, Sea Plots, 400 homes. A sign-up/log-in sheet sits at the bottom. |
| Taps on chips and pins | Each one opens a bottom sheet ("Lagos State House", "Sea Plots", "Your neighbours", "Go to i-Fitness"), and each sheet ends with a sign-up call to action. |
| Public JSON endpoints the page loads: `/api/daily`, `/api/gov`, `/api/auth/me`, `/build.json` | `/api/daily` returns `{date, weekday, weather, headline, tip}`: a daily satirical front page. `/api/gov` returns a governor term, an election, candidates, votes, and a pause flag. |
| The public client bundle (Next.js chunks, about 4.4 MB) | I searched it for endpoint paths and gameplay identifiers. That surfaced about 80 `/api/*` routes plus mission, streak, needs and FTUE definitions. |

**Limits.** Everything after sign-up is behind an account, and creating one is out of bounds for me, so I never played as a signed-in user.
Statements about the post-login game are **inferences from bundle identifiers**, not observed screens.
Anything marked *(inferred)* was read from the bundle. Anything marked *(observed)* was seen on screen or in a public JSON response.

## Navigation structure

- **Map-first home** *(observed)*: the city map is the main screen. You tap a venue pin, a bottom sheet opens, and "Go" takes you there. Roughly 30 venues are named on the landing map: shrine, viewing centre, amala joint, tech hub, market, salon, church, radio, hotel, car dealer, boat cruise, high court, university, casino, stadium, motor park and more.
- **Top bar** *(observed)*: brand, live player count, and civic chips (Governor, Sea Plots, Homes).
- **Bottom sheets** *(observed)* for every venue and civic feature. Our game already uses bottom sheets and a phone, so its navigation is broadly comparable.
- **Phone/wallet layers** *(inferred)*: bank, wallet top-up packs, messages with voice notes, family, company/corporation, court, betting, casino, radio, health consults, invites and referrals.

## Core loops and retention drivers

| Loop | Lagos Life *(inferred unless noted)* | Retention role |
|---|---|---|
| **Daily missions ("Today's Hustle")** | Three daily quests in **Grind / Life / Link-up**, one **re-roll**, and a **Daily Bonus**. Goal kinds are tag, visit, places, ride, shift, quest, social, skill and buy, in tiers *easy / city / hustle* (for example "Take public transport twice: danfo, okada or keke" and "Move around: 3 places today"). | The main reason to come back every day. |
| **Streak ladder** | Daily streak with escalating cash/XP rewards and a final **"Big chest"**. **Streak freezes** come from level unlocks. | Loss aversion keeps players returning. |
| **Level ladder** | XP per level = 100 + (level − 1) × 40. Rings: Bronze 1, Silver 10, Gold 25, Platinum 50, Diamond 75, Legend 100. Unlocks include a free spin every 4 h (L3), a bigger daily chest (L15) and a third streak freeze (L25). | Long-term goals and status. |
| **FTUE checklist** | Eat → ride a danfo → first shift → meet someone → buy a better item, with a toast after each step. | Teaches the loop in about 5 minutes. |
| **Needs and moodlets** | Sims-style needs (hunger, energy, hygiene, bladder, fun, social), and emotions caused by moodlets that expire. | Moment-to-moment pressure. |
| **City pressure** | Power cuts ("NEPA took light: −30%", a generator saves it), inspections and viral moments for businesses. | Variety and texture. |
| **Civic/social meta** | Governor elections with terms, policies and announcements; party "spray" money; jail, bail and lawyers; court; family. | Shared world stakes. |
| **Daily paper** *(observed)* | Date, weekday, weather, a satirical headline and a practical tip. | A small daily novelty. |
| **Skill mini-games** | Food rush, delivery run, market haggle, party DJ, tailoring, office sort. | Skill expression. |
| **Monetization** *(inferred)* | Wallet packs/checkout, rentable sea ad plots (₦100+/plot for 30 days, *observed*), billboards. | Revenue (out of scope here: needs approval). |

## Feature-gap map against Accra We Dey

| Lagos Life mechanic | Accra We Dey before this work | Gap | Plan |
|---|---|---|---|
| Daily 3 missions + re-roll + bonus | `daily` state existed, but `MISSIONS = []` since import. The HUD chip and `streak` celebration were wired but always empty. | **Missing (high value)** | **Phase 1, done**: "Today" board |
| Streak ladder + chest + freezes | `streak` field only | **Missing** | **Phase 1, done** |
| Daily paper (weather/headline/tip) | none | **Missing** | **Phase 1, done**: *The Daily Chale* |
| Needs, moodlets, sickness | present (`rules.js`) | parity | none |
| Transport modes (danfo/okada/keke) | trotro, okada, taxi, Bolt, walk, own car | parity | none |
| Power cuts | dumsor schedule + emergency | parity | Phase 2: tie dumsor to business income like "gen saves it" |
| FTUE checklist | milestones + first-session HUD path | parity | none |
| Level rings and unlocks | Rep titles, XP-to-rep | partial | Phase 2: unlock ladder (savers, bigger chest) |
| Governor elections | AMA vote/townhall actions, ballots | partial | Phase 3: MCE election cycle |
| Party "spray" money | none | missing | Phase 2: spray at funerals/parties (server-controlled) |
| Skill mini-games | trotro, waakye, bolu, bughunt, azonto, boxing mini-games | parity | none |
| Jail/bail/court | present | parity | none |
| Rentable map ad plots | Advertise app | parity (monetization frozen) | none without approval |
| Map-first venue sheets | Bolt/map app + venue sheets | parity | none |

## Phased plan

1. **Phase 1, implemented here: the daily return loop.**
   - **Today app** (first app after the dock). It shows three server-dealt missions, one per category: **Hustle** (work/money), **Street** (moving around and eating local) and **Link-up** (people). Each mission uses real Accra places and actions (Makola, Labadi, waakye/kenkey/fufu, trotro/okada, oware, Jumu'ah/church).
   - **One swap a day.** Each mission is claimed separately: Hustle pays GH₵45 + 20 XP, Street and Link-up pay GH₵30 + 15 XP.
   - **7-day streak ladder.** Day bonuses run GH₵40 → GH₵150, and the day-7 chest pays GH₵300 + 80 XP plus a **streak saver** (keep at most 2). A saver covers exactly one missed day.
   - ***The Daily Chale***: a front page shared by the whole city, with a satirical Accra headline, a season-aware weather line (harmattan, major/minor rains), Ghanaian holidays, Detty December and Chale Wote Saturdays, and a practical tip.
   - **HUD chip** "Today 2/3 · claim" opens the board. The app badge counts missions ready to claim.
   - **Server authority.** Progress comes only from the server's own daily counters (`bump` → `s.dc.cnt`). Claims run inside the durable money transaction (`hustle` ∈ `durableActions`), and saved data is normalized and never trusted.
2. **Phase 2: city texture.** Party/funeral "spray" (money to a host, server-controlled). Dumsor hits business income unless a generator or solar kit is owned. Weather affects needs (rain soaks hygiene, harmattan dries energy). A Homowo and Chale Wote seasonal event with themed missions. Rep-level unlocks (third saver, bigger chest).
3. **Phase 3: civic meta.** An MCE (Metropolitan Chief Executive) election cycle at the AMA building, with candidacy, votes and one city-wide policy per term. The existing `shard.policy` hooks (`food`, `wages`, `tax`, `light`) are already there to support it.

## Files

- `server/src/game/daily-hustle.js`: mission pool, deal, progress, claims, re-roll, streak and savers.
- `server/src/game/accra-daily.js`: *The Daily Chale*.
- `server/src/game/rules.js`: `hustle` message, `view().daily` board, migration keeps today's board.
- `server/src/life-game.js`: `hustle` runs as a durable transaction.
- `client/src/v2/phone/today.js`, `today-state.js`, `phone.css`: the Today app. `ui/hud.js` holds the chip and `main.js` adds `act.today()`.
- Tests: `server/loadtest/daily-hustle.test.js`, `client/test/today.test.js`.
- Sourced facts: `docs/accra-facts.json`.
