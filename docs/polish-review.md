# Accra We Dey — implementation and review

## Delivered

- Restrained forest/ivory interface, consistent typography and icon assets replacing active-game emoji decorations. Bolt spelling corrected.
- Continuous CC0 MakeHuman adult male/female anatomy retargeted to the existing animation skeleton. Connected torso, limbs, hands and facial features; fitted clothing, scalp and facial hair. Ten body/face controls: build, shoulders, waist, muscle, hips, height, female bust, face width, nose and lips. Values validate on the server and survive outfits and reconnects.
- Actual avatar face portraits in profiles, player lists, messages, social posts and the HUD. One small shared renderer and queued/cached portrait generation.
- Ghana 2026 home/away kit illustrations based on official PUMA references. Free for both body types; original in-game artwork without manufacturer/sponsor marks.
- Stable account background rolls: Dbee starts with GH₵25,000 and chooses among Osu/Airport/Legon homes; Hustler starts with GH₵800 and chooses Nima/Jamestown. Initial rent is covered. No assigned career, automatic debt, scripted NPC inbox, daily mission deadlines or story pop-ups. Optional aspirations can be changed or paused with remembered milestone progress.
- Accra GMT clock drives day/night and venue schedules. The map preserves real place coordinates and coastal orientation, with labelled schematic major roads. It is a simulation map rather than a navigation map.
- City chat reaches players in separate rooms and servers; Nearby stays in the current room. Delivery acknowledgements retain drafts on failure. Private messages support username search/player taps, one first-message request, accept/decline, blocking and privacy checks.
- Saved multiplayer Noughts & Crosses, Four in a Row and UNO-style Colour Cards, with invitations, turn/version validation, private card hands, reconnect persistence, draw/win/resign and cross-server notices. Existing Oware practice and player challenges remain available.
- Reachable furniture/staff activity zones across 39 public venues and eight housing tiers, with eight neighbourhoods and eight player estates; wardrobe changes, cooking/rest and purchased furnishings. Former placeholder menus now route to working phone games, a shared community priority vote, fixed savings, car rentals or hotel rest.
- Fictional custody rules, travel restrictions, cell movement limits, countdown/free bail review and basic needs while detained. Phone communication remains available. The community poll counts one changeable vote per account and does not claim to be a government election.
- Four-step character/traits/birth-lottery/housing onboarding followed by a dismissible, replayable six-card tutorial. Phone listeners/timers clean up on closing; rapid close/reopen preserves the new app window. Failed life-state persistence remains dirty for retry.

## Reference-game research

Reviewed Lagos Life's logged-in phone, private chats, profiles, visits/transfers, games and police/court UI. With explicit user approval, reset @doloR4's existing life and completed the new-life flow, choosing a Yaba self-contain; the new wallet showed ₦96,000. No messages or reports were sent to other users.

## Validation

- Client production build passed.
- 29 rule and game regressions passed: activity anchors, free play, background housing, body values, chat isolation/privacy, custody, savings, rental expiry, aspiration switching and failed-save retries.
- Full two-player WebSocket integration passed: onboarding, room movement/socials, City/private messages, delivery acknowledgements, MoMo transfers/requests, profiles/search, blocking, phone-market trade and social feed.
- Persistent phone-game integration passed: message acceptance, stale moves, unauthorized participants, reconnect/saved boards, wins, private hands, drawing and resignation.
- Two real Redis-connected servers passed City/private delivery, sender identity, blocking, phone-game notices/turns and shared community votes.
- Oware rule/complete-game checks passed, including feeding, captures and seed conservation.
- Two mobile browser sessions passed tutorial, chat, reconnects, furniture taps, timed activity, wardrobe, visible bust deformation, saved morphs/outfits, private requests/draft retention, avatar profiles and a live game board, with no browser exceptions.
- Fresh mobile onboarding passed woman/bust customization, two traits, eligible housing choices and a new life without an assigned job or loan.
- Focused mobile phone checks passed portrait rendering, rapid close/reopen, Colour Cards hand privacy/drawing and map overview. Character geometry checks confirmed finite male/female meshes. The final compiled preview on port 8080 also passed visible bust deformation, saved values, normalized skin weights and finite walking vertices at both body types’ slider extremes.

Reproduce with `node --test server/loadtest/regression.test.js server/loadtest/city.test.js server/loadtest/phone-games.test.js`, the integration scripts under `server/loadtest`, and `tools/game-browser-test.py`, `tools/onboarding-browser-test.py`, `tools/phone-browser-test.py`, `tools/character-review.py` against a local Vite preview. Captures are in `.local/qa`. Test accounts live only in the isolated local database on port 55432.

## Remaining limits

The game retains stylised cutaway rooms. It is not a Sims 4 asset library, a seamless reconstructed street world, a full player court/lawyer system or an unlimited simulation. Clothes and hair are fitted/stylised meshes; an authored clothing library and richer animations remain possible future improvements.

Place coordinates are geographic; roads are deliberately schematic. Economy prices are gameplay estimates inspired by Accra, with the September 2026 transport change used as a fare reference. This does not establish current prices for every real shop, property or vehicle, or prove long-term economy balance. News uses dated linked reports rather than pretending to be a live events service.

Production hosting, HTTPS/WSS reachable by separate players, shared Postgres/Redis, real phones on separate networks, large populations and Paystack transactions still need deployment validation. Local software-rendered mobile viewport checks do not measure physical-phone frame rates. Existing source load-test figures in README are historical, not a benchmark of the new human geometry. Set strong SESSION_SECRET and a permanent BIRTH_SEED before production.

## References

- [MakeHuman source and graphical-asset licence](https://github.com/makehumancommunity/makehuman/blob/master/LICENSE.md) — CC0 assets; provenance is also in `client/public/assets/models/LICENSE-human.md`.
- [PUMA Ghana 2026 home](https://eu.puma.com/de/en/pd/ghana-2026-home-jersey-men/783419)
- [PUMA 2026 international kit launch](https://mediahub.puma.com/articles/for-the-love-of-the-shirt-puma-launches-football-kits-for-11-nations-for-the-worlds-biggest-stage)
- [GNA Labadi report](https://gna.org.gh/2026/10/la-mp-confronts-military-over-demolition-at-pleasure-beach/)
- [ISD September 2026 transport-fare change](https://www.isd.gov.gh/road-transport-operators-announce-8-fare-increase-effective-september-26/)


## Character refinement — 12 October 2026

Replaced proximity-based joint assignment with the source model's authored skin weights, remapped to the runtime skeleton. Relaxed the shoulder slope, increased head/neck definition, balanced male torso proportions and added volume to limbs. Fitted tops now bridge anatomical creases with a smooth garment surface; trousers have a small amount of fabric ease. Bust and other shape controls remain active.

Hairlines are clipped through triangles for a continuous edge. Removed the redundant helmet-shaped hair shell, reduced texture noise, and added surface-following eyebrow/lip pigmentation. Eye spacing follows face-width changes. The fitting room has an additional soft fill light.

Validation: production build and syntax checks passed. `tools/character-review.py` checked both body types, nine shape controls at both extremes, four outfit categories and standing/walking, seated and raised-arm deformation. All evaluated skin weights were normalised and posed vertices were finite and bounded. Compiled preview at port 8080 passed a 390×844 mobile wardrobe check, visible bust change and persisted appearance changes. Screenshots: `.local/qa/avatar-male.png`, `avatar-female.png`, `character-creator.png`.

These are customisable real-time human meshes with stylised garments, rather than photorealistic scanned characters. Hardware-phone performance still requires device testing.

## Streets, estates and sound — 12 October 2026

- Confined beard pigmentation to the chin/lower jaw, reduced stubble coverage, refined fade hairlines, rounded the trouser waist and removed the central dark pelvis patch. Male shoulders/torso and female waist/hips have distinct base proportions; player shape controls still apply.
- Added a visible birth-lottery reveal between traits and housing. The server's existing stable account roll supplies Dbee/Hustler funds and eligible homes; going back cannot reroll it or assign a career. This follows the reference game's creation pattern while retaining Ghanaian content.
- Added 915 dense background city plots, using merged meshes, geographic venue locations and the existing schematic road/coast network. Destination pins show icons by default, full names on hover or keyboard focus, and place details on mobile tap. Names, Streets and Estates filters are available.
- Each housing district has a walkable neighbourhood connected to its own home door and estate gate. Provisions, barber and food-joint facades expose actions. Purchases remain server controlled. Aboki grills operate 17:00–02:00 GMT; FanYogo/FanIce vendors operate 09:00–19:00. NPCs patrol or gesture and disappear outside their schedules; hidden actors/items cannot intercept taps.
- Estates query actual purchased ownership, including live purchases before saving and offline owners after saving. Renters do not generate houses. Twelve owner-labelled houses are shown per page; owner contact and existing acquaintance visits remain subject to multiplayer privacy/access rules. Reoccupying an owned property does not charge again, and the authoritative reply updates home and wallet immediately.
- Added Silverbird Cinemas at Accra Mall, Law Court Complex reception/gallery, an Osu restaurant, East Legon gym, Oxford Street khebab joint and Circle ice cream stop. Existing banks, hotels and other venues remain available. The court exposes the existing Police/custody app; this is not a player-run trial system.
- Viewing centres and neighbourhood screens show an original animated football pitch with mixed Ghanaian/international fixtures. The cinema and home screens show original animated city shorts. Shared fictional fixtures accept bounded game-money predictions before kick-off; server-only results settle once and survive reconnects. These are simulated programmes and results, not broadcasts or live sporting data.
- Added original generated instrumental music, traffic ambience, horns, birds/night insects and footsteps. Sound starts after an interaction; music/ambience volumes and mute persist locally, and hidden tabs suspend audio. No video audio or actual Accra field recording is embedded. A located Accra recording was commercially licensed, so it was not reused.

Validation: the production build and 29 rule/game tests pass. Mobile browser checks on the compiled port-8080 preview cover home-to-street-to-estate-and-back, moving NPCs, changing TV animation frames, match predictions, saved sound controls and compact map pins. A fresh fixture funded only in the isolated local database purchased an Osu house through the real server, appeared in the live and saved estate directory, opened its physical house menu and reoccupied without another charge. Character geometry and four-step onboarding checks also pass. Screenshots and test fixtures are confined to `.local`; physical-phone frame rates and production multiplayer deployment still require validation.

Additional checks: `tools/map-browser-test.py` covers hover/focus names, mobile filter hit targets and sound access. `tools/city-browser-test.py` accepts `AWD_TEST_URL=http://127.0.0.1:8080`; `tools/estate-browser-test.py` is restricted to a newly created QA account in the local database on port 55432.

References for place identity: [Silverbird Accra](https://silverbirdcinemas.com/cinema/accra/), [Accra Mall stores](https://www.accramall.com/accra-mall-stores), [Judicial Service court locator](https://judicial.gov.gh/jsweb/index.php/jsg-services/general-services/court-locator). Venue schedules and prices are simulation settings, not verified opening hours or ticket/property quotations. Keep a permanent `MATCH_SEED` alongside the existing production secrets so saved predictions retain consistent results.

Final review also rejected inherited object keys as home/estate identifiers and confirmed authoritative purchase replies, one-time prediction settlement, hidden-vendor picking and map control layering.

## Editable character models — 12 October 2026

The game now loads `accra-male.glb` and `accra-female.glb` as its anatomy assets. These use a licensed CC0 MakeHuman base, 13,380 surface vertices, an articulated rig and nine named body/face morph targets. Sparse storage keeps the anatomy files around 1.6 MB each. The animation skeleton now fits the adult anatomy, preserving body proportions instead of stretching the surface to the old rig. Existing outfits, skin tones, hair and shape controls remain available. Garments have surface clearance, closed footwear covers the feet, and idle posture keeps the arms and legs relaxed.

Dressed portable versions are `accra-male-player.glb` and `accra-female-player.glb`; they contain eyes, hair, fitted clothes, an idle pose and an original generated walk cycle. The source anatomy GLBs expose the editable morph targets. Open `/model-review.html` to rotate either dressed model, preview walking and download its GLB. Both pages are included in the client build. These are licensed-base derivatives and original game additions, not a claim of sculpting the entire anatomy from scratch.

Validation: all four files pass the Khronos glTF Validator with zero errors and zero warnings. Its unused-UV messages are informational: those coordinates are retained for clothing/material editing. Character review now updates the skeleton matrices before checking posed vertices; male/female models pass nine controls at both extremes, four outfit types, walking, seating and raised arms. The asset licence and build/export scripts are in the project. Hardware-phone performance remains unmeasured.

Compiled-preview checks also pass portable male/female rendering and animation, wardrobe gender changes in the translated studio, saved bust customization and walking outdoors. The portable preview runs at a capped frame rate, suspends drawing in hidden tabs and reserves space around the model for its controls.
