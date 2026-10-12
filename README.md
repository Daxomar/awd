# Accra We Dey

An 18+ multiplayer life game set in Accra, played in a portrait mobile browser. It plays like Lagos Life: you live in little isometric rooms, travel on a city map, and run your life from a real-looking in-game phone.

## What's in the game

| Area | Details |
|---|---|
| Places | 33 venues (Circle, Makola, Auntie Muni's waakye, Oxford St, Labadi, Korle Bu, Bukom, the tech hub and more). Each is a cutaway room with staff NPCs and tap-able zones of activities. |
| Homes | Eight home tiers, from a Nima single room to a Trasacco villa. Furniture you buy appears in the room and unlocks actions (cook, TV, code, guitar, workout). |
| Map | Accra diorama with real place coordinates, a coastline, schematic major roads, place pins, live player counts, filters and paid billboards. You travel by walking, trotro, okada, taxi, Bolt or your own car, with fares and a ride screen. |
| Phone | Handset with Dynamic Island, status bar, widgets and app grid. Apps: Messages (player DMs), MoMo, Accra Gist, Jobs, Aspirations, Games, Houses, Cars, Shop, Invest, Bank, Forbes, Contacts, My Life, Health, Bolt, My Ads, Help, Settings. |
| Money between players | MoMo send / request money with a 0.75% fee (min GH₵1, max GH₵15), daily limits that grow with reputation, receipts and references. Money is delivered exactly once, even to offline players or players on other shards. |
| People | Players in the same place see and hear each other. Socials grow friendship from Stranger to Best friend: wave, chat, joke, praise, gist, dance, hug, flirt, ask out, then propose with a ring. You can also visit friends' houses, block and report. |
| Games | Saved multiplayer Noughts & Crosses, Four in a Row and UNO-style Colour Cards with private hands. Oware against people for stakes of GH₵0–200, or practice against the computer. |
| Life | Needs, moods, careers with 1-hour real shifts and promotions, gigs and mini-games, crime with heat and jail, businesses, land, loans, rent, tax, dumsor, sickness and NHIS. |
| Free play | No scripted story, daily mission deadlines, assigned career, automatic posts or forced shift pop-ups. A stable account background roll determines Dbee/Hustler starting resources and eligible homes. Aspirations can be changed or paused without losing progress. |
| Characters | Continuous CC0 MakeHuman adult male/female surfaces retargeted to the animation rig, with ten body/face controls including female bust. Clothing follows body shape; avatar faces become profile pictures. Free Ghana 2026 home and away kits. |
| Getting started | Dbee GH₵25,000 or Hustler GH₵800, a choice of eligible homes, a dismissible six-card tour, and replay from Help. |
| Chat | City reaches players in separate rooms; Nearby stays in your room. First private messages become requests that recipients accept or decline. Server delivery acknowledgements retain drafts on failure. |
| Safety | 18+ gate. Chat, DMs and Gist are filtered (sexual, minors, scams, selling game money). Links and phone numbers are hidden. Strikes lead to mutes, and you can block and report. |
| Revenue | Rotating paid billboards via Paystack, plus optional wallet top-up packs (Paystack, weekly-capped, off unless `PAYSTACK_SECRET` is set). |

## Run locally

Recommended: run the isolated Docker stack with `python tools/init-docker-secrets.py`, then `docker compose up --build -d --wait`. Open `http://localhost:8080`. See [Docker deployment and security](docs/deployment.md) for HTTPS, secrets, persistence and migration from a native development database.

For native development:

```bash
# Postgres 14+ and Redis 6+ running locally
cd server && npm install
cd ../client && npm install && npx vite build
cd ../server
DEV=1 ADMIN_KEY=change-me STATIC_DIR=../client/dist node src/index.js
# open http://localhost:8080 on a phone, or in a desktop browser at phone size
```

### Environment variables

| Variable | Default | Purpose |
|---|---|---|
| `DATABASE_URL` | `postgres://awd:awd@127.0.0.1:5432/awd` | Postgres |
| `REDIS_URL` | `redis://127.0.0.1:6379` | Redis: cross-shard chat, money and DM delivery, presence |
| `SESSION_SECRET` / `SESSION_SECRET_FILE` | dev value only | Production requires a random 32+ character secret. Signed tokens are restricted to explicit development automation; browser sessions use revocable HttpOnly cookies. |
| `BIRTH_SEED` / `BIRTH_SEED_FILE` | dev secret only | Production requires a permanent random secret. Stored rolls remain unchanged. |
| `NODE_ENV`, `PUBLIC_URL` | development, local HTTP | Production mode disables development bypasses and requires HTTPS for public origins. |
| `REDIS_NAMESPACE`, `TRUST_PROXY` | empty, off | Separate environments with different namespaces. Trust proxy IP headers only behind the isolated reverse proxy. |
| `SHARD_ID`, `PORT` | `accra-1`, `8080` | One process per shard |
| `SHARD_CAP` / `ROOM_CAP` | 2500 / 25 | Players per shard / per room instance |
| `ADMIN_KEY` | — | Ad moderation at `/admin.html` |
| `PAYSTACK_SECRET`, `PUBLIC_URL` | — | Turns on billboard checkout and wallet top-ups (GHS, MoMo and card) |
| `AUTO_APPROVE=1` | off | Paid ads go live immediately |
| `ADS_DIR`, `AD_CAP` | `./uploads/ads`, 40 | Ad image storage, ads per rotating board |

Set the Paystack webhook to `{PUBLIC_URL}/api/paystack/webhook`. It handles both billboard orders and top-ups.

## Scale

- Each shard holds 2,500 players. Rooms hold 25 each, and extra instances open automatically.
- Load test (`server/loadtest/bots.js 1500 45`): 1,500 bots walked, chatted, socialised and traveled across 63 rooms. Results: about 7–13 ms per tick, about 1 ms event-loop lag, 91 MB of RAM, and about 0.4 KB/s per player.
- To scale out, run N shards behind a load balancer with sticky WebSockets and share Postgres and Redis.
- Static files are gzipped by the server. In production, put `client/dist` behind a CDN.
- Character assets include a ~1 MB uncompressed human surface plus the existing animation rigs. Server gzip reduces transfer size; body geometry is cached for reuse. Benchmark first-load time and frame rate on target phones before release.

## Tests

```bash
cd server
node loadtest/e2e.js          # two players: rooms, moves, chat, socials, MoMo transfers, DMs, requests, profiles, Forbes, blocking
node loadtest/cross-shard.js  # two local shards on 8080/8081, shared Postgres/Redis
node loadtest/oware_test.js   # Oware rules + a full game vs the AI
node loadtest/econ_sim.js     # 3-week economy (casual vs grinder)
npm test                    # gameplay and security regression checks
node loadtest/phone-games-e2e.js # requests, saved multiplayer games, private card hands
node loadtest/bots.js 1500 45 # load
node loadtest/mkuser.js name  # dev: make an onboarded account, prints a token (open /?token=...)
```

## Where things live

| Path | Contents |
|---|---|
| `client/src/v2/main.js` | Game controller: boot, auth, onboarding, views, input, server messages |
| `client/src/v2/scene/` | `stage` (iso camera), `room` (cutaway rooms + navigation), `kit` (procedural furniture), `poses`, `venues`, `homes`, `map` (geographic city diorama), `ride` (3D chase-cam trips), `bake` (draw-call merging), `world` (room sync), `human`/`character`/`avatars`/`textures` (skinned dressable human surfaces), `studio` (fitting room) |
| `client/src/v2/ui/` | HUD, venue zones and action cards, travel sheet + ride HUD, stylist (creator / wardrobe / boutique), Circle phone market (`market.js`), player card, mini-games, Oware, auth, onboarding, styles |
| `client/src/v2/phone/` | Handset and every phone app |
| `server/src/shard.js` | Rooms, presence, socials, chat, Oware wiring |
| `server/src/social.js` | MoMo transfers, credits, DMs, profiles, search, Forbes, top-ups |
| `server/src/game/phone-games.js`, `server/src/civic.js` | Persistent phone games and shared weekly community votes |
| `server/src/oware.js` | Oware rules, matches, stakes, AI |
| `server/src/game/` | Rules engine, content (`data.js`), optional aspiration ladders (`story.js`) |
| `server/src/ads.js`, `gist.js`, `filter.js` | Billboards, social feed, moderation |
| `client/legacy/` | The earlier open-world prototype (not built) |

## October 2026 update

This polish pass was verified locally with two mobile browser sessions, WebSocket integration checks, and rule regression checks. It has not been deployed or tested over two physical phones on separate networks. A production multiplayer server requires a shared reachable HTTPS/WSS endpoint and working Postgres/Redis.

For browser checks, start Vite at `127.0.0.1:5173` and the game server at `127.0.0.1:8080`, then run `python tools/game-browser-test.py` (Python Playwright required). Screenshots go to `.local/qa/`. The test creates disposable local accounts; use a development database.


- **Character creator & wardrobe**: male/female, 8 skin tones, 15 hairstyles + colours, beards, Ghanaian wear (kente cloth/dress/skirt/shirt, Black Stars jersey, fugu, kaftan, kaba & slit, ankara, office, street wear), shoes, hats, glasses, chains/beads. Free starter items; the rest are bought at the boutique (Accra Mall → Fashion boutique, or the Boutique phone app). Uniforms, gym kit and sleepwear show automatically.
- **Travel that makes sense**: time = base + per-km × distance per mode (×rush hour on weekdays 6:30–9:30, 16:30–19:30). Walking is free but slow and capped at 5 km; okada is fastest in traffic; Bolt surges in rush hour. The place sheet tags Fastest / Cheapest / Too far.
- **3D rides**: chase camera behind your trotro / taxi / Bolt / car / okada (or behind you on foot) on a procedural Accra road: shops with signboards, container kiosks, gutters, hawkers, traffic, go-slow in rush hour, trotro bus stops, night lighting. Drag to look around.
- **City map**: landmarks at real place coordinates, geographic district relationships, coastline and labelled schematic major roads.
- **Circle (Tiptoe Lane)**: buy UK-used phones, pay the tester (or risk a soap bar in the box), fix at the fitter, flip for profit; daily prices; fitter apprenticeship, unlocking and accessory hustles.
- **Labadi Beach**: the 2 Oct 2026 beachfront demolition is in the game: rubble, excavator, tape, vendors on coolers, and new activities (walk the ruins, help a vendor, give to the vendors' fund, drummers' jam). Pinned Accra News card in Gist.
- **Gist**: Following tab and Follow buttons; pinned news.
- **Roaming**: joystick in every place (tap-to-walk still works).
