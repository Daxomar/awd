# ACCRA WE DEY — MASTER GAME COMPLETION PROGRAM
## The Living Virtual Accra
### Integrated World Redesign, Life Simulation, Property Economy, Social Systems, Creator Platform, Administration and Release Engineering

You are the Lead Game Director, Principal Gameplay Engineer, Three.js Technical Director, Backend Architect, Economy Designer, Security Engineer and QA Lead for Accra We Dey.

**This is one comprehensive implementation assignment, to be executed in ordered, verifiable stages inside the EXISTING Codex workspace.**

Repository: https://github.com/Daxomar/awd

Do not create another project, rewrite the application, change the game engine or discard completed work.

This is not a request for a proposal, mockup, theoretical architecture or superficial UI prototype.

Your task is to transform the existing game into a cohesive, visually compelling, technically reliable, persistent multiplayer virtual world.

The game must be enjoyable with a small player population and scalable toward a larger one.

The additional budget is GH₵0. Use existing tools, libraries, project assets and appropriately licensed free resources. Do not introduce paid dependencies or services.

**No public deployment, real-money activation, destructive migration or unapproved economic rebalance is authorized.**

---

# PART I — THE PRODUCT WE ARE BUILDING

## 1. Product vision

Accra We Dey is an 18+ browser-based multiplayer life simulator set in Ghana.

The experience should combine:

- An explorable, visually distinctive virtual Accra.
- Player identity and character customization.
- Career development and meaningful employment.
- Personal finance and economic progression.
- Player-owned businesses.
- Purchasable, customizable and resellable properties.
- Vehicle ownership and resale.
- Friendships, dating and social discovery.
- Shared activities and live events.
- Neighborhood culture and entertainment.
- Music and creator promotion.
- Contextual personal life events.
- Crime, consequences and recovery.
- A persistent player-driven economy.
- Reliable multiplayer.
- A secure administrative control center.

Players should be able to build different lives.

One player may become a banker.

Another may run a provision shop.

Another may buy and renovate houses.

Another may become known for hosting events.

Another may focus on relationships, fashion, entertainment or collecting vehicles.

Different paths should be meaningful, and players should be able to change direction.

**The central design principle: the game world must create reasons to play, not merely contain features to click.**

Do not build a collection of unrelated menus.

## 2. Visual direction

Use the previously supplied Lagos Life screenshots as references for:

- Recognizable building silhouettes.
- Readable destinations at normal camera distances.
- Compact, dense gameplay geography.
- Clear interactions.
- Third-person exploration.
- Believable neighborhood scale.
- Street-level detail.
- Prominent advertising.
- Social presence.

Do not copy Lagos Life's proprietary art, assets, interfaces, exact layouts or brand identity.

Accra We Dey must retain its own Ghanaian identity.

The visual target is:

**Premium stylized 3D realism, optimized for mobile browsers.**

Avoid:

- Flat-looking city tiles.
- Excessively toy-like buildings.
- Identical repetitive houses.
- Empty roads.
- Unreadable distant architecture.
- Tiny advertisements.
- Generic imported city aesthetics.
- Excessive bloom and gradients.
- Expensive photorealistic effects.
- Decorative geometry with no gameplay purpose.

Aim for recognizable Ghanaian residential and commercial architecture, believable proportions, useful signage, richer materials, effective lighting and strong visual hierarchy.

The player should immediately recognize where they can go and what they can do.

## 3. Existing architecture and completed milestones

The existing application uses:

- Three.js.
- Vanilla JavaScript.
- Vite.
- Node.js.
- PostgreSQL.
- Redis.
- Existing authoritative game services.
- Existing multiplayer rooms and shards.
- Existing in-game phone and HUD.

Completed:

- Phase 1: Onboarding and birth lottery.
- Phase 2: HUD and contextual interactions.
- Phase 3: Greater Accra geographic map.
- Phase 4: Buildings, interiors and environment systems.
- Phase 5: Connected local streets and neighborhoods.
- Interim milestone: Exploration, employment assignments, advertising, Paystack reliability, First Friend and objectives.
- Phase 8: Career history, business operations, commerce, relationships, legal consequences, financial persistence and long-term progression.

The original Phase 6 and Phase 7 were postponed. Their relevant requirements are now included in this master program.

Do not assume that every previously reported feature works perfectly.

Inspect the repository and validate actual behavior.

## 4. Phase 8 facts that must inform implementation

The Phase 8 report identifies:

- 19 careers.
- Ten existing skills.
- Eight existing home types.
- Three managed business-operation types.
- Existing passive investments.
- Existing financial and transaction journals.
- Existing phone escrow trading.
- Persistent friendships and relationships.
- Shared activities.
- Existing crime and legal consequences.
- Twelve introductory and twelve long-term objectives.
- Existing Paystack and advertising infrastructure.

Known deficiencies:

- The tested entry-level salary still requires 60 real minutes of attendance.
- The Hustler economy is difficult for social-first and business-first playstyles.
- Business operations are mostly phone-managed.
- Commerce supports a narrow item category.
- The city contains much decorative geography.
- Some important interactions are hidden in the phone.
- Character rendering and animation are being developed separately.
- Physical-phone performance remains unverified.
- Large-scale multiplayer capacity is unverified.

Use these findings.

Do not rebuild working transaction infrastructure merely to create new interfaces.

---

# PART II — NONNEGOTIABLE ENGINEERING RULES

## 5. Preserve persistent player data

Protect:

- Account IDs.
- Player IDs.
- Authentication records.
- Birth outcomes.
- Existing wallets and balances.
- Transaction history.
- Career history.
- Skills.
- Owned items.
- Existing homes.
- Property records.
- Vehicle ownership.
- Businesses.
- Advertising campaigns.
- Payment attempts.
- Relationships.
- Friend lists.
- Private messages.
- Saved appearance and clothing.
- Existing destination identifiers.

All schema changes must be additive or accompanied by an explicit compatibility and migration plan.

No destructive production migration.

No silent player-asset confiscation.

No resetting the economy.

No changing existing destination IDs without a migration plan and approval.

## 6. Server authority

The server must determine all consequential outcomes.

Never trust client-submitted:

- Currency amounts.
- Ownership.
- Item availability.
- Work completion.
- Qualifications.
- Salaries.
- Business profit.
- Property value.
- Vehicle ownership.
- Marketplace settlement.
- Event rewards.
- Crime outcomes.
- Relationship consent.
- Objective completion.
- Payment success.

Use durable transactional writes, idempotency and concurrency protection.

Maintain clear audit records for financial and ownership changes.

## 7. Keep character production separate

Claude, using Blender MCP, is responsible for the character-art pipeline.

That includes:

- Character models.
- Faces and bodies.
- Hairstyles.
- Clothing.
- Rigging.
- Animation clips.
- Character asset exports.

Do not duplicate that production work.

You may implement:

- Animation state machines.
- Character controllers.
- Third-person camera integration.
- GLB loading and validation.
- Asset manifests.
- Animation playback.
- Fallback character compatibility.
- Multiplayer avatar synchronization.

Coordinate integration through stable interfaces.

Do not overwrite uncommitted character work or simultaneously edit files owned by the Blender pipeline.

## 8. One assignment, ordered execution

You must implement the stages below in dependency order.

You may continue to the next stage without requesting another prompt when:

1. The stage's implementation is complete.
2. Its acceptance criteria pass.
3. Existing regression tests pass.
4. Data compatibility is maintained.
5. No explicit-approval boundary has been crossed.

At each stage, produce a concise checkpoint report and preserve evidence.

If a stage is blocked, record the blocker and continue only with genuinely independent work.

Do not declare a stage complete because its UI exists.

Do not silently substitute a simplified placeholder for a required system.

Do not claim the whole program is complete if important stages remain unfinished.

---

# STAGE 0 — REPOSITORY AUDIT AND IMPLEMENTATION BASELINE

Before modifying gameplay:

1. Inspect the current branch, HEAD and working tree.
2. Identify all existing systems and active development changes.
3. Locate the latest Phase 8 implementation.
4. Identify Claude-owned character files.
5. Run existing client/server tests.
6. Run the production build.
7. Check database migration state.
8. Inspect existing ad and payment routes.
9. Inspect the original standalone advertising page, if still present.
10. Inspect existing property, vehicle, employment and social mechanics.
11. Capture current authenticated gameplay screenshots.
12. Establish a performance baseline.

Create a feature inventory with four states:

- Working and verified.
- Working but requiring redesign.
- Partially implemented.
- Missing.

Create a dependency graph and implementation checklist for all remaining stages.

Record current destination IDs, geographic coordinates, ownership records, economy configuration and important database tables.

Do not begin with a visual rewrite.

**Acceptance:** the implementation plan is grounded in actual repository behavior and preserves concurrent character work.

---

# STAGE 1 — COMPACT, INTERACTIVE VIRTUAL ACCRA

## 1.1 Redesign the playable city

The current metropolitan map contains tens of thousands of procedurally generated buildings and 68 geographic districts.

This is too much decorative scale for the current gameplay density.

Create a more compact, gameplay-focused city presentation.

The objective is not to erase Greater Accra or invalidate the existing geography.

Instead:

- Preserve the authoritative metropolitan geographic dataset.
- Preserve existing destination coordinates and travel economics.
- Preserve established location identities.
- Reduce unnecessary visible decorative building density.
- Establish a concentrated primary playable city.
- Retain a coherent representation of the wider metropolitan area.
- Use authored, gameplay-focused neighborhood compositions.
- Support future geographic expansion.

Separate the strategic geographic map from the visually concentrated playable world where appropriate.

If visual positions are remapped, maintain explicit mappings to authoritative destination coordinates.

Never silently use condensed display distances to recalculate existing fares.

## 1.2 Build a coherent city layout

Include recognizable areas such as:

- Nima.
- Jamestown.
- Kaneshie.
- Labadi.
- Osu.
- Airport Residential.
- East Legon.
- Trasacco.
- Existing commercial and public destinations.

The city should contain:

- Residential areas.
- Commercial centers.
- Workplaces.
- Social venues.
- Shops.
- Food venues.
- Entertainment.
- Public spaces.
- Property opportunities.
- Advertising surfaces.
- Roads and transport access.

Create distinct visual identities.

Nima should not feel like a recolored Trasacco.

Osu should not feel identical to Airport Residential.

## 1.3 Meaningful building interaction

Every prominently presented interactive building must have a valid purpose.

Examples:

- Enter a venue.
- Apply for a job.
- Shop.
- Access a service.
- Buy a property.
- Inspect a business.
- Visit an authorized home.
- View a property listing.
- Access an event.
- Interact with an advertisement.

Do not promise interiors for buildings that have none.

Decorative background buildings may remain, but they should not dominate the playable environment.

A purchasable property is a valid building interaction even when its private interior is instanced.

## 1.4 Visual quality

Improve:

- Building proportions.
- Roof geometry.
- Facades.
- Windows.
- Doors.
- Balconies.
- Commercial frontages.
- Material variation.
- Architectural details.
- Ground contact.
- Shadows.
- Street furniture.
- Road markings.
- Signage.
- Day/night appearance.

Use efficient instancing, atlases, shared materials and appropriate LOD.

Avoid excessive polygon counts.

## 1.5 Zoomed-out readability

At normal city-view distance:

- Buildings must remain recognizable.
- Important landmarks must stand out.
- Public destinations must be identifiable.
- Property listings must be discoverable.
- Billboards must remain visually prominent.
- Interaction indicators must not overwhelm the screen.

Use semantic LOD and camera-aware presentation where useful.

Do not merely increase the scale of all buildings.

## 1.6 World interaction contract

Create a shared location/interaction contract covering:

- Stable destination ID.
- Location type.
- Geographic position.
- Playable-world position.
- Interaction availability.
- Ownership, if applicable.
- Entry rules.
- Activity catalogue.
- Visual representation.
- Navigation target.
- Instance behavior.

Existing location IDs remain valid.

**Acceptance:** the city is visually improved, less empty, easier to navigate and substantially more interaction-rich without breaking existing travel or property data.

---

# STAGE 2 — PURCHASABLE BUILDINGS AND THE PROPERTY ECONOMY

## 2.1 Persistent property catalogue

Create a finite, server-authoritative property catalogue.

Support different property classes, including:

- Single rooms.
- Compound houses.
- Apartments.
- Townhouses.
- Detached houses.
- Premium residences.
- Eligible commercial units.

Use existing home tiers and housing mechanics where compatible.

Do not invent tens of thousands of unique properties.

Start with a carefully balanced catalogue of persistent units distributed across supported neighborhoods.

Every property must have:

- Stable property ID.
- Neighborhood.
- World location.
- Building type.
- Property template.
- Ownership status.
- Purchase price.
- Supported interior.
- Upgrade state.
- Furnishing state.
- Primary residence eligibility.
- Listing status.
- Access permissions.
- Transaction history.

Use configurable catalogue sizes rather than hardcoded arbitrary city-wide capacity.

## 2.2 Multiple property ownership

Players may own multiple eligible properties.

One property may be designated as their primary residence.

Additional properties may serve as investments or eligible social spaces.

Preserve existing home ownership and rent.

Do not invalidate current housing records.

Do not create ownership conflicts between legacy homes and new property units.

## 2.3 Property inspection and tours

A player should be able to select a property and see:

- Location.
- Type.
- Asking price.
- Furnishing status.
- Supported upgrades.
- Ownership or listing status.
- Preview.
- Entry/tour availability.

Where supported, provide an actual property tour using the existing interior engine.

Private access must be authorized.

Do not reveal sensitive owner account information.

## 2.4 Furnishing and customization

Support:

- Existing furniture.
- Appliances.
- Interior decoration.
- Room themes.
- Predefined renovation packages.
- Supported exterior improvements.
- Comfort and functional benefits.

Changes must persist.

Furniture must not duplicate on reconnect.

Do not implement unrestricted structural construction.

## 2.5 Property resale

Owners may list eligible properties for sale.

Support:

- Seller-selected asking price.
- Listing expiration.
- Furnished or unfurnished sale.
- Inventory inclusion preview.
- Buyer inspection.
- Secure purchase.
- Atomic ownership transfer.
- Seller proceeds.
- Durable sale receipt.
- Cancellation.
- Relisting.

Use server-side ownership and balance validation.

Prevent:

- Double sale.
- Duplicate property records.
- Sale of unauthorized property.
- Transfer during incompatible pending operations.
- Invalid negative prices.
- Item duplication through furnished transfers.
- Listing a primary residence without handling relocation requirements.

Handle buyer and seller disconnects safely.

## 2.6 Valuation

Distinguish:

- Catalogue/base value.
- Estimated value.
- Seller asking price.
- Actual transaction price.

Do not guarantee appreciation.

Do not automatically equate furnishing expenditure with resale value.

Any estimated valuation model must be explainable.

## 2.7 Shared-world representation

Properties exist at persistent city locations.

Private interiors may be instanced.

Other players should be able to discover a property's public listing without rendering all of its interior contents.

Preserve room and shard boundaries.

**Acceptance:** two authenticated players can inspect, buy, customize, list and transfer an eligible property, with correct persistence and no duplicated money or inventory.

---

# STAGE 3 — VEHICLE OWNERSHIP, CUSTOMIZATION AND RESALE

Audit the existing vehicle catalogue and travel system.

Preserve owned vehicles and current transport rules.

Implement a secure player-to-player vehicle marketplace.

Support:

- Eligible vehicle listings.
- Seller ownership validation.
- Vehicle details.
- Condition, if the game supports it.
- Cosmetic customization.
- Supported upgrades.
- Asking price.
- Buyer inspection.
- Atomic sale.
- Durable ownership transfer.
- Listing cancellation.
- Transaction history.

Do not invent historical mileage for existing vehicles.

If mileage or condition is introduced, establish fair initialization and migration rules.

Do not add complicated repair, fuel, insurance or vehicle-physics systems merely to enable resale.

Do not implement unrestricted free driving in this stage.

Use existing transport benefits.

**Acceptance:** two players can complete a valid vehicle resale without duplicating ownership, inventory or currency.

---

# STAGE 4 — CAMERA, MOVEMENT AND IMMERSIVE INTERIORS

This stage incorporates the necessary work from postponed Phase 6.

## 4.1 Camera modes

Implement compatible camera perspectives:

1. Existing elevated/isometric mode.
2. Third-person follow mode.
3. Optional closer interior view where supported.

Provide an accessible camera-toggle control.

Persist player preference appropriately.

The toggle should work in:

- Homes.
- Supported public interiors.
- Neighborhood streets.
- Other compatible gameplay scenes.

Do not force a camera mode in scenes that cannot support it safely.

## 4.2 Third-person experience

The third-person camera should:

- Follow the character.
- Handle rotation.
- Support reasonable zoom.
- Avoid clipping through walls.
- Maintain visibility in narrow spaces.
- Respect interaction targets.
- Work with existing mobile controls.
- Handle doorway transitions.
- Support reduced-motion preferences.

Audit current room geometry.

Improve missing surfaces or occlusion where necessary.

Do not assume changing camera position alone creates a complete third-person experience.

## 4.3 Movement and navigation

Improve:

- Joystick responsiveness.
- Tap-to-move.
- Pathfinding.
- Turning.
- Collision.
- Doorway approaches.
- Camera-follow smoothing.
- Interaction proximity.
- Remote-player interpolation.
- Movement corrections.

Preserve authoritative transport fares and travel timers.

Do not implement a full physics engine unless justified by measurable requirements.

## 4.4 Character integration

Define an animation-independent movement contract.

Support:

- Idle.
- Walk.
- Run, if permitted.
- Turn.
- Sit.
- Interact.
- Vehicle passenger.
- Appropriate social gestures.

Use current character assets as fallback.

Integrate Claude's GLB animation assets only through the agreed manifest and validation process.

Do not change Blender source files without coordination.

**Acceptance:** actual authenticated gameplay demonstrates reliable above-view and third-person movement in homes and neighborhoods, including multiplayer visibility and camera collision handling.

---

# STAGE 5 — EMPLOYMENT AND CAREER SYSTEM 2.0

This is a major redesign.

The current system requires excessive real-world waiting.

The tested entry-level technology shift required 60 real minutes to pay GH₵150.

This is unacceptable as the primary active-work experience.

## 5.1 Separate simulation time from player waiting

Define distinct concepts:

- Work schedule.
- In-game shift duration.
- Active work session.
- Salary settlement.
- Career experience.
- Auto-work participation.

A fictional eight-hour shift must not require eight real-world hours.

Target approximately 2–5 minutes for an active work session, subject to testing.

Use a consistent, documented time-compression model.

Do not allow players to repeatedly claim an entire salary by restarting a short task.

## 5.2 Career qualifications

Audit all 19 careers.

Implement relevant prerequisites:

- Skills.
- Certificates.
- Training.
- Experience.
- Career level.
- Practical assessments.

Examples:

Bank Teller:

- Basic Financial Literacy.
- Customer Service.
- Teller Training.

Software Developer:

- Technical Fundamentals.
- Practical coding simulation.
- Relevant experience.

Senior corporate roles:

- Prior experience.
- Relevant qualifications.
- Demonstrated performance.
- Promotion eligibility.

A newly created player must not immediately qualify for CTO simply because the job appears in a catalogue.

Do not require expensive training for every entry-level opportunity.

Provide viable free and affordable routes.

## 5.3 In-game courses

Implement short, interactive courses.

A course should contain:

- Learning objective.
- Cost, if any.
- Eligibility.
- Short playable content.
- Assessment.
- Result.
- Certificate or skill reward.
- Retry rules.
- Progress persistence.

Do not create empty timer-based courses.

Use original fictional scenarios.

Avoid real-world professional certification claims.

## 5.4 Career guidance

Selecting a locked job should explain:

- Why it is locked.
- Which requirements are missing.
- Available training.
- Expected progression.
- Affordable next steps.

Provide a direct route to the relevant in-game activity.

## 5.5 Active work

Create differentiated short work experiences for major career families:

- Retail and service.
- Food and hospitality.
- Banking and administration.
- Technology.
- Transport and logistics.
- Skilled trades.
- Management.

Use actual workplace interactions where feasible.

Avoid repeating one generic minigame across every job.

Avoid trivial tap-spamming.

Activities should have meaningful choices, bounded outcomes and appropriate skill effects.

## 5.6 Auto-work

Implement optional auto-work.

Players may configure:

- Enable/disable.
- Eligible job.
- Shift participation.
- Preferred existing transport option.
- Maximum automatic transport spending.
- Auto-work status and recent results.

The server must validate:

- Employment.
- Qualifications.
- Schedule.
- Availability.
- Existing activity.
- Transport affordability.
- Player settings.
- Shift uniqueness.
- Offline settlement limits.

Auto-work should provide reliable baseline income and slower career progression than active participation.

Do not allow unlimited offline income.

Do not simulate thousands of offline avatars walking through the city.

Use authoritative bounded settlement.

If the player is online, show appropriate activity status or lightweight presentation.

If offline, record the shift without expensive world rendering.

Do not forcibly interrupt a player's active activity without clear rules.

## 5.7 Salary rebalance

Audit all 19 careers and their grades.

Normalize compensation to a clear game-time unit.

Evaluate:

- Entry wages.
- Executive wages.
- Salary intervals.
- Work-session duration.
- Auto-work earnings.
- Food.
- Transport.
- Rent.
- Training costs.
- Business startup.
- Vehicle affordability.
- Property affordability.

Produce proposed salary tables with before/after comparisons.

Do not silently activate a broad economic rebalance.

Implement the supporting configurable structure and simulations, then preserve existing production values until explicit approval.

## 5.8 Career progression

Preserve existing ranks, grades, experience and career history.

Make promotions achievable through relevant work and qualifications.

Connect careers to:

- Skills.
- Reputation.
- Training.
- Business opportunities.
- Long-term goals.

**Acceptance:** a player can train, qualify, work actively, earn an authoritative wage, progress toward promotion and optionally use bounded auto-work without spending 60 real minutes waiting for the basic active-work reward.

---

# STAGE 6 — FIRST-SESSION OBJECTIVES AND SOCIAL DISCOVERY

## 6.1 Move onboarding objectives onto the main HUD

The new-player experience must not depend on discovering an objectives app inside the in-game phone.

Create a compact, collapsible objectives interface on the main gameplay HUD.

Include:

- Objective icon.
- Current objective.
- Progress.
- Clear next action.
- Completion feedback.
- Expand/collapse behavior.
- Persistent state.

Avoid covering movement controls.

The existing phone may retain advanced long-term objectives if useful, but introductory guidance must be visible from gameplay.

## 6.2 First-session objectives

Create a flexible, nonblocking first-session path.

Suggested objectives:

1. Establish your first home.
2. Explore your neighborhood.
3. Interact with a useful location.
4. Meet or attempt to meet another player.
5. Explore available careers.
6. Complete an introductory earning activity.
7. Review your character's needs.
8. Discover a social venue.

Use existing authoritative objectives where possible.

Do not duplicate rewards.

Do not force a specific order when unnecessary.

A player must be able to continue exploring even if no other players are online.

## 6.3 First Friend redesign

The First Friend objective begins from the main HUD.

Selecting it opens a lightweight discovery interface.

Support:

**Nearby**

Eligible real players in the same multiplayer instance.

**Discover**

Real online players who explicitly opt into discovery.

**Friends**

Existing accepted contacts.

A player may select an eligible person and send an introduction request.

The recipient must accept or decline.

After acceptance, the existing private messaging system opens.

A qualifying reply can complete the existing First Friend flow.

Do not fabricate online players.

Do not expose private locations or hidden presence.

Do not automatically match users who have opted out.

## 6.4 Empty-server behavior

If nobody is available:

- Explain that no eligible players are online.
- Offer retry.
- Suggest other objectives.
- Preserve objective progress.
- Allow later completion.

Do not invent NPC users.

## 6.5 Rewards

Preserve the existing First Friend backend and one-time reward protections.

The proposed GH₵1,000/GH₵500 cash rewards remain disabled unless explicitly approved.

XP and badge rewards may follow existing approved objective rules.

Protect against:

- Alternate-account farming.
- Repeated introductions.
- Message spam.
- Reconnect duplication.
- Reward replay.
- Unwanted contact.

**Acceptance:** a newly registered player can discover objectives from the HUD, initiate a consent-based introduction and continue playing when no other player is available.

---

# STAGE 7 — SOCIAL LIFE, PLAYER IDENTITY AND COMMUNITY EVENTS

## 7.1 Player identity

Implement an optional public player profile containing eligible game information such as:

- Character name.
- Selected career.
- Achievements.
- Public reputation.
- Selected possessions.
- Business identity.
- Optional public residence information.
- Chosen profile presentation.

Players must control which eligible details are public.

Never expose private account credentials, email addresses, payment data or sensitive account records.

## 7.2 Social interaction

Build upon Phase 8:

- Friendship.
- Dating.
- Mutual relationship status.
- Shared activities.
- Private messaging.
- Blocking.
- Reporting.
- Existing room presence.

Support meaningful in-world interactions.

Avoid forcing players to navigate several phone menus for basic nearby social actions.

## 7.3 House visits and gatherings

Allow authorized visits to eligible player-owned homes.

Support:

- Invitations.
- Owner-controlled access.
- Private/public gathering settings where appropriate.
- Visitor limits.
- Leaving and reconnecting.
- Furniture interaction permissions.
- Blocking and removal.

Do not expose private homes to unauthorized players.

## 7.4 Live events infrastructure

Implement a server-authoritative events system.

Support:

- Event ID.
- Name.
- Description.
- Host.
- Venue.
- Start/end time.
- Capacity.
- Visibility.
- Eligibility.
- Attendance.
- Activity rules.
- Rewards, if approved.
- Cancellation.
- Moderation.
- Persistent results.

Example event types:

- Oware tournament.
- Football viewing party.
- Beach gathering.
- Community meetup.
- Fashion showcase.
- Business fair.
- Music-promotion event.
- Nightlife gathering.

Events should use existing venues and capabilities.

Do not promise playable football or full concerts if those systems do not exist.

## 7.5 Player-hosted events

Implement a controlled foundation for eligible player-hosted gatherings.

Require:

- Authorized venue.
- Scheduling limits.
- Capacity.
- Privacy settings.
- Moderation.
- Anti-spam controls.

Do not enable unrestricted public broadcasts or external media uploads.

## 7.6 Small-population design

Events should remain useful with a small player population.

Do not require hundreds of attendees.

Allow solo-compatible venue activities where appropriate.

Display real attendance and presence.

Do not invent crowd counts.

**Acceptance:** an administrator can schedule an event, players can discover and attend it, and attendance/state remain consistent across disconnects.

---

# STAGE 8 — PERSONAL LIFE EVENTS AND CONSEQUENCES

Implement a server-authoritative personal events engine.

These are events affecting individual players based on their actual circumstances.

## 8.1 Event categories

Support a curated initial set:

- Neighborhood incidents.
- Career opportunities.
- Social dilemmas.
- Business opportunities.
- Business setbacks.
- Property incidents.
- Financial surprises.
- Positive discoveries.
- Community opportunities.

## 8.2 Event definitions

Each event must define:

- Stable ID.
- Eligibility.
- Trigger context.
- Frequency.
- Cooldown.
- Decision options.
- Outcome rules.
- Skill modifiers.
- Need/mood effects.
- Financial limits.
- Persistence.
- Expiration behavior.
- Recovery behavior.

Do not make events client-authoritative.

## 8.3 Neighborhood robbery

Implement an abstract fictional robbery event where appropriate.

Possible choices:

- Hand over limited carried cash.
- Attempt to escape.
- Seek help.
- Negotiate.

Outcomes may affect:

- Capped in-game cash.
- Mood.
- Energy.
- Temporary stress.
- Reputation or event history.

Do not permit arbitrary theft of houses, vehicles, protected inventory or major savings.

Do not allow player-targeted robbery or griefing.

Do not give real-world instructions for theft or violence.

## 8.4 Contextual risk

Risk may depend on:

- Neighborhood.
- Game time.
- Player activity.
- Relevant skills.
- Recent event history.
- Cooldowns.

Avoid stigmatizing real neighborhoods through unsupported or discriminatory crime assumptions.

Use fictionalized, transparent gameplay-risk design rather than asserting real-world crime rates.

## 8.5 Event frequency and fairness

Major events should be occasional.

Do not interrupt every activity.

No punitive event should resolve against an offline player without a fair, documented rule.

Do not punish a player for failing to respond to a popup they never saw.

Allow safe dismissal, deferral or neutral expiration where appropriate.

Prevent repeated loss loops.

## 8.6 Life-system integration

Events should connect to existing systems:

- Needs.
- Mood.
- Skills.
- Relationships.
- Careers.
- Businesses.
- Finances.
- Legal standing.
- Objectives.

Do not create disconnected reward popups.

**Acceptance:** multiple contextual event types produce persistent, bounded, server-validated consequences and recover safely after disconnects.

---

# STAGE 9 — AMBIENT CITY LIFE AND BELIEVABLE NEIGHBORHOODS

This stage incorporates the useful parts of postponed Phase 7.

## 9.1 Ambient world

Make streets feel populated and lived-in.

Introduce efficient ambient elements such as:

- Pedestrian activity.
- Stationary vendors.
- Market activity.
- Street conversations.
- Parked vehicles.
- Limited moving traffic.
- Street sounds.
- Local environmental details.
- Appropriate day/night variation.

Do not simulate the entire metropolitan population.

## 9.2 NPC behavior

Use bounded, lightweight NPC schedules.

NPCs may:

- Walk between predefined points.
- Stand at market stalls.
- Perform simple ambient actions.
- Appear at existing service locations.
- React to nearby interactions.
- Represent fictional service providers.

Do not claim sophisticated autonomous AI where only scripted behavior exists.

Do not replace real multiplayer presence with fake players.

## 9.3 Performance

Use:

- NPC pooling.
- Distance-based activation.
- Animation LOD.
- Bounded update frequency.
- Shared materials.
- Efficient pathing.
- Population caps.
- Scene disposal.

Ambient traffic must not introduce a new heavyweight driving simulation.

## 9.4 Business integration

Where practical, connect player businesses to the world.

Examples:

- Visible business frontage.
- Owner signage.
- Open/closed status.
- Inventory/service interaction.
- Appropriate vendor representation.

Do not create fake customer transactions.

Phase 8's numerical demand model may remain, but the interface must clearly distinguish simulated demand from actual player purchases.

**Acceptance:** the city visibly feels more alive while preserving low-end mobile performance and real multiplayer presence.

---

# STAGE 10 — ADVERTISING, MUSIC PROMOTION AND STANDALONE CHECKOUT

This is a high-priority correction to the interim milestone.

## 10.1 Restore the standalone advertising page

The user previously had a dedicated billboard purchase page.

The advertising purchase flow was moved into the in-game phone.

That change is not desired.

Audit the original page, routes and checkout behavior.

Restore or reconstruct the dedicated standalone advertising experience using existing implementation where possible.

The main advertising purchase flow must not be hidden inside the in-game phone.

It should be accessible as a separate page associated with the game.

Support:

- Available placements.
- Billboard preview.
- Ground-advertising preview.
- Pricing.
- Duration.
- Artwork upload.
- Campaign destination.
- Checkout.
- Payment status.
- Campaign management.
- Reporting.

The in-game world may offer a shortcut to the external page, but the primary purchase and management experience belongs outside the fictional phone.

## 10.2 Paystack checkout return

The advertiser should:

1. Select placement.
2. Upload artwork.
3. Complete validation.
4. Review price and duration.
5. Start checkout.
6. Complete Paystack payment.
7. Return to the appropriate game or advertising page.
8. See verified purchase status.

Use a server-controlled callback URL.

Do not trust the browser redirect as payment proof.

Preserve PostgreSQL payment attempts, signed webhooks, independent verification and reconciliation.

Customer receipt email requirements must follow the actual provider API.

A Ghana phone number may be prioritized for contact and MoMo selection, but entering a phone number alone is not authorization to charge it.

## 10.3 Automatic campaign activation

The owner wants eligible campaigns to become active immediately after successful payment verification.

Remove routine manual approval for campaigns that pass automated content and placement validation.

Implement:

- File validation.
- Safe media decoding/re-encoding.
- Allowed formats.
- Dimension and size limits.
- URL validation.
- Prohibited-content checks within the capabilities actually available.
- Rate limits.
- Ownership checks.
- Placement availability.
- Payment verification.
- Automatic activation.
- Immediate world-state refresh or bounded propagation.

If a campaign cannot be safely validated, reject it or place it in a clearly disclosed review state.

Do not falsely claim automated checks can detect all inappropriate content.

Do not activate on an unverified callback.

Administrators must be able to suspend a campaign after activation.

Handle late payments, expired reservations, duplicate charges and refund review.

## 10.4 Billboard visibility

Make advertising clearly visible at actual gameplay distances.

Improve:

- Placement size.
- Orientation.
- Height.
- Readability.
- Material quality.
- Lighting.
- Distance-based presentation.
- Camera framing.
- Placement density.
- City-map discoverability.

Do not place advertisements over roads, entrances, protected landmarks or interactive controls.

Do not let ads obscure gameplay.

## 10.5 Ground advertising

Preserve approved ground-advertising inventory.

Support suitable additional placements only after validating geometry, land-use compatibility and visibility.

Ground advertising rents an in-game promotional surface.

It does not transfer ownership of real-world land or in-game property.

## 10.6 Music and creator promotion

Support eligible promotional campaigns for:

- Music releases.
- Albums.
- Events.
- Fashion.
- Businesses.
- Creators.
- Community gatherings.

Allow validated external destination links.

Use an allowlist or equivalent secure link policy where appropriate.

Protect against malicious URLs and deceptive advertising.

Do not automatically host, stream or broadcast copyrighted music.

Virtual concerts and full listening-party playback are future expansions unless authorized rights and technical requirements are satisfied.

## 10.7 Campaign analytics

Preserve impression and click reporting.

Clearly label client-assisted visibility metrics as estimates.

Do not promise guaranteed real-world audience reach.

Deduplicate and rate-limit reporting.

**Acceptance:** an advertiser can purchase an eligible campaign through the standalone page, complete a mocked or sandbox verified checkout, return correctly, and see the campaign automatically appear in the appropriate world placement without routine manual approval.

---

# STAGE 11 — SECURE DEVELOPER AND ADMINISTRATOR DASHBOARD

Build a separate web administration application.

It must not be part of the in-game phone.

It must not be accessible to ordinary players.

Do not expose administrative routes merely through hidden navigation.

## 11.1 Architecture

Use a maintainable solution compatible with the existing stack.

Prefer the current repository and deployment architecture unless separation is justified.

Implement:

- Dedicated admin routes.
- Separate admin UI.
- Server-side authorization.
- Secure sessions.
- Role-based access.
- Audit logs.
- Input validation.
- CSRF/origin protection as appropriate.
- Rate limits.
- Sensitive-operation confirmation.
- Safe error handling.

Admin authorization must be checked on every protected backend operation.

Do not rely on frontend route hiding.

## 11.2 Administrator roles

Support appropriate roles such as:

- Owner/superadmin.
- Operations administrator.
- Moderator.
- Support analyst.
- Finance reviewer.

Grant least-privilege permissions.

Do not give every administrator access to payment operations or unrestricted account changes.

## 11.3 Overview dashboard

Display actual metrics:

- Total registered players.
- Daily active users.
- Weekly active users.
- Monthly active users.
- Concurrent online players.
- Sessions.
- Visits.
- New registrations.
- Returning players.
- Retention cohorts.
- Active businesses.
- Property transactions.
- Active advertising campaigns.
- Relevant server health indicators.

Define the meaning of each metric.

Do not count refreshes as unique players.

Do not fabricate historical analytics that were never collected.

## 11.4 Player management

Support:

- Player search.
- Account overview.
- Relevant gameplay records.
- Account status.
- Reports.
- Moderation history.
- Suspensions.
- Bans.
- Appeal/review notes.
- Authorized support actions.

Do not expose passwords, payment credentials or unnecessary private-message content.

Access to sensitive records must be restricted and audited.

## 11.5 Economy monitoring

Display:

- Currency creation.
- Currency sinks.
- Salary payouts.
- Business profits.
- Property transfers.
- Vehicle transfers.
- Marketplace volume.
- Unusual transactions.
- Ledger reconciliation status.

Support investigation without permitting arbitrary silent balance changes.

Any authorized administrative adjustment must require a reason and create a durable audit record.

## 11.6 Advertising management

Support:

- Placement inventory.
- Active campaigns.
- Revenue.
- Payment status.
- Impression estimates.
- Campaign suspension.
- Reported content.
- Refund-review cases.
- Expired campaigns.

Do not require manual approval for every eligible paid campaign.

## 11.7 Payment operations

Support read-only or role-restricted review of:

- Payment orders.
- Attempts.
- Verification status.
- Reconciliation.
- Duplicate-charge review.
- Refund status.
- Administrative receipt delivery.

Never expose secret keys to the browser.

Never treat an admin dashboard status toggle as equivalent to provider verification.

## 11.8 World and event management

Allow authorized configuration of:

- Scheduled events.
- Event descriptions.
- Eligible venues.
- Announcements.
- Supported gameplay configuration.
- Advertising placements where safe.
- Feature flags.

Do not allow arbitrary executable code or unsafe geometry injection through admin forms.

## 11.9 Operational monitoring

Show useful indicators for:

- HTTP/WebSocket health.
- Database health.
- Redis health.
- Background workers.
- Payment reconciliation.
- Error counts.
- Failed jobs.
- Connection capacity.
- Recent operational incidents.

Use actual available telemetry.

## 11.10 Admin testing

Verify:

- Unauthenticated denial.
- Ordinary-player denial.
- Role restrictions.
- Session expiry.
- CSRF/origin controls.
- Audit logging.
- Unauthorized financial actions.
- Concurrent admin changes.
- Pagination.
- Filtering.
- Safe error states.

**Acceptance:** the game owner can manage the virtual world through a dedicated secure application without modifying source code for routine operational tasks.

---

# STAGE 12 — MULTIPLAYER, ECONOMY, PERFORMANCE AND RELEASE READINESS

This stage incorporates the remaining Phase 9 engineering requirements.

## 12.1 Multiplayer reliability

Verify:

- Room presence.
- Nearby players.
- Remote movement.
- Character appearance.
- Friendship.
- Dating.
- Shared activities.
- Home visits.
- Business transactions.
- Property resale.
- Vehicle resale.
- Event attendance.
- Reconnection.
- Shard transitions.
- Account leases.
- Message delivery.

Do not claim cross-shard visibility where it does not exist.

## 12.2 Economy balancing

Re-run simulations using the updated systems.

Include:

- Hustler starting at GH₵800.
- Dbee starting at GH₵25,000.
- Employment-focused play.
- Business-focused play.
- Social-focused play.
- Mixed play.
- Casual play.
- Auto-work.
- Training expenses.
- Transport.
- Food.
- Rent.
- Property ownership.
- Vehicle purchases.
- Marketplace activity.
- Personal event losses.
- Currency sinks.
- Inflation risk.

Evaluate realistic active-play and offline scenarios.

Report:

- Median earnings.
- Median expenses.
- Time to basic financial stability.
- Time to qualify for careers.
- Time to purchase an entry property.
- Time to start a business.
- Wealth distribution.
- Business profitability.
- Money creation/destruction.
- Potential exploit paths.

Do not silently change production salaries, rents, starting balances, First Friend cash rewards or major item prices.

Produce an approval-ready balance proposal.

The owner must approve material economic changes before activation.

## 12.3 Performance targets

The primary target is a usable portrait-mobile browser experience.

Optimize:

- City rendering.
- Geometry.
- Materials.
- Texture memory.
- Lighting.
- Shadows.
- Character animation.
- NPC density.
- Billboard visibility scans.
- Camera collision.
- Network messages.
- Database queries.
- Business settlement.
- Scene transitions.
- Memory retention.

Set explicit test-device tiers and measurable budgets.

Aim for stable 30 FPS on a representative low-end target where feasible, but do not claim success without actual device measurements.

Provide adaptive quality settings.

Test lower pixel ratios, reduced effects and limited ambient population.

Investigate previous performance regressions, including expensive cold scene construction.

## 12.4 Loading and network resilience

Support:

- Progressive loading.
- Scene loading feedback.
- Recoverable errors.
- Socket reconnect.
- Duplicate-request protection.
- Network interruption.
- Background/foreground transitions.
- Reasonable asset caching.
- Low-bandwidth conditions.

Do not silently lose financial or ownership operations.

## 12.5 Security

Audit:

- Authentication.
- Session management.
- Authorization.
- Admin access.
- WebSockets.
- Payment webhooks.
- Media uploads.
- External links.
- Player commerce.
- Property ownership.
- Vehicle ownership.
- Auto-work.
- Random events.
- Economy actions.
- Social abuse.
- Rate limits.
- Database transactions.

Add tests for high-risk exploits.

Do not perform destructive or uncontrolled load testing against production.

## 12.6 Accessibility and mobile usability

Test:

- 375×812.
- 390×844.
- 430×932.
- 390×530.
- 844×390.

Check:

- Text legibility.
- Touch targets.
- Input ownership.
- Scroll containment.
- Camera controls.
- Reduced motion.
- Modal behavior.
- Loading feedback.
- Color contrast.
- Screen-reader support for DOM-based critical interfaces where practical.

## 12.7 Real-money release gates

Do not activate live Paystack processing without:

- Valid merchant configuration.
- Correct callback origin.
- Verified webhook handling.
- Duplicate-payment protection.
- Reconciliation testing.
- Refund procedures.
- Customer receipt verification.
- Administrative support procedures.
- Content moderation.
- Applicable legal and policy review.

Do not treat test-mode success as live merchant certification.

## 12.8 Privacy and moderation

Provide suitable policies and controls for:

- Player reports.
- Blocking.
- Account suspensions.
- Advertising content.
- Player-created event descriptions.
- Profile information.
- Data retention.
- Administrative access.
- User-generated content.

Avoid intrusive monitoring beyond what is necessary for legitimate game operations and safety.

---

# PART III — END-TO-END ACCEPTANCE PROGRAM

## 13. Required player journeys

Use disposable authenticated accounts.

Do not use existing production players.

### Journey A — New Hustler

Create a Hustler player.

Complete onboarding.

See HUD objectives.

Move into the first home.

Explore the compact city.

Complete a short earning activity.

Review available career pathways.

### Journey B — Career qualification

Select a job with missing requirements.

Take a valid in-game course.

Complete the assessment.

Obtain the qualification.

Apply for the job.

Complete an active work session.

Receive the correct salary.

Verify persistence.

### Journey C — Auto-work

Configure an eligible job for auto-work.

Select a transport option and spending limit.

Process an authorized shift.

Verify transport cost, earnings, progress and cooldown.

Disconnect/reconnect.

Verify no duplicate salary.

### Journey D — Property ownership

Inspect an available property.

Purchase it.

Enter it.

Furnish it.

Complete a predefined renovation.

List it for sale.

Have a second account purchase it.

Verify ownership and inventory transfer.

### Journey E — Vehicle resale

Purchase or use an eligible owned vehicle.

List it.

Have another player buy it.

Verify currency, ownership and persistence.

### Journey F — Social discovery

Create two eligible accounts.

Discover an available real player.

Send an introduction.

Accept it.

Exchange messages.

Complete the First Friend objective.

Verify blocking and opt-out behavior.

### Journey G — Empty-server onboarding

Create a player when no eligible social candidates are online.

Verify the objective offers alternatives and does not block gameplay.

### Journey H — Third-person home

Enter a home.

Switch camera mode.

Walk around furniture.

Interact with objects.

Exit to the street.

Switch camera modes again.

Verify collision, controls and visibility.

### Journey I — Personal life event

Trigger an eligible test event through controlled QA fixtures.

Make a decision.

Verify server-authoritative consequences.

Reconnect.

Verify the outcome is not duplicated.

### Journey J — Player business

Operate an existing managed business.

Purchase stock.

Make sales.

Review financial records.

Interact with its supported world representation.

Verify simulated demand is accurately labelled.

### Journey K — Advertising

Use the standalone advertising page.

Select a placement.

Upload valid artwork.

Complete mocked or sandbox verified checkout.

Return correctly.

Verify automatic activation and world rendering.

Suspend the campaign through an authorized administrator.

### Journey L — Community event

Schedule an event from the admin dashboard.

Have players discover and attend.

Complete an eligible activity.

Verify attendance and persistent state.

### Journey M — Administrator security

Attempt admin access as:

- Unauthenticated visitor.
- Ordinary player.
- Limited moderator.
- Authorized administrator.

Verify permissions and audit trails.

### Journey N — Multiplayer recovery

Test movement, trading, home visits, shared activities and transactions under disconnect/reconnect conditions.

Verify no duplicated money, property, vehicles or rewards.

### Journey O — Dbee progression

Create a natural Dbee account.

Verify that the player has meaningful goals beyond purchasing expensive items.

Test career eligibility, business opportunities, social progression and long-term objectives.

---

# 14. Visual acceptance

Capture actual running-game screenshots and video where possible.

Required views:

- Compact city at normal zoom.
- Compact city zoomed out.
- Multiple recognizable neighborhoods.
- Interactive public buildings.
- Purchasable properties.
- Property inspection.
- Furnished interior.
- Third-person interior.
- Third-person neighborhood.
- Multiple players.
- Ambient street life.
- Billboard at normal camera distance.
- Ground advertising.
- Standalone ad checkout.
- New-player HUD objectives.
- Social discovery.
- Career training.
- Active work.
- Auto-work.
- Business management.
- Personal life event.
- Live community event.
- Admin dashboard.

Inspect the images.

Do not simply generate screenshots and assume they are correct.

Do not substitute static design mockups for functioning gameplay.

---

# 15. Automated testing and CI

Maintain all existing tests.

Add coverage for:

- World interaction mappings.
- Destination compatibility.
- Property ownership.
- Property listing and transfer.
- Furnished sales.
- Vehicle transfer.
- Camera state.
- Movement validation.
- Career qualification.
- Course assessment.
- Salary idempotency.
- Auto-work settlement.
- Social consent.
- First Friend discovery.
- Empty-server behavior.
- Personal event outcomes.
- Event attendance.
- Advertising auto-activation.
- Payment verification.
- Admin permissions.
- Financial reconciliation.
- Multiplayer reconnect.
- Resource disposal.
- Mobile layout.

Run:

- Client tests.
- Server tests.
- PostgreSQL integration tests.
- Production build.
- Existing Docker/CI checks.
- Authenticated browser journeys.
- Performance diagnostics.

Do not weaken existing tests.

Do not count mocked integration tests as proof of live payment or real mobile performance.

---

# PART IV — EXECUTION, REPORTING AND APPROVAL

## 16. Stage checkpoint format

At the end of every stage, provide:

1. Stage name.
2. Features completed.
3. Existing systems reused.
4. Exact files changed.
5. Database changes.
6. Tests executed.
7. Pass/fail results.
8. Authenticated gameplay evidence.
9. Performance measurements.
10. Known limitations.
11. Regressions discovered.
12. Fixes applied.
13. Any approval needed.
14. Whether the next stage can safely begin.

Keep this in the repository as a durable implementation log.

Do not produce an enormous status report after every trivial edit.

The checkpoint must be accurate enough to audit.

## 17. Explicit approval boundaries

Stop and request approval before:

- Public deployment.
- Production database migration with meaningful risk.
- Destructive data changes.
- Changing existing player balances.
- Material salary/economy repricing.
- Changing Hustler/Dbee starting amounts or odds.
- Enabling First Friend cash rewards.
- Enabling live Paystack payments.
- Introducing player real-money cash-out.
- Introducing paid third-party services.
- Removing existing player assets.
- Breaking saved-game compatibility.
- Introducing significant new recurring hosting costs.

Do not interpret silence as approval.

You may continue with independent development and testing that does not cross these boundaries.

## 18. Definition of done

This program is complete only when:

- The city feels concentrated, recognizable and interactive.
- Buildings are visually stronger and readable at gameplay zoom.
- Important destinations have meaningful interactions.
- Property ownership and resale work.
- Vehicle resale works.
- Third-person camera works in supported interiors and streets.
- New-player objectives appear on the main HUD.
- First Friend discovery works without fake users.
- Careers have qualifications and short playable work sessions.
- Auto-work is bounded and authoritative.
- Personal events create persistent consequences.
- Social discovery and community events work.
- Player businesses connect meaningfully to the world.
- Standalone advertising checkout works.
- Verified eligible ads activate automatically.
- Billboards are clearly visible.
- A separate secure administrator dashboard works.
- Existing payment and financial records remain intact.
- Multiplayer actions are reliable.
- Major economic exploits are prevented.
- Existing saved data remains compatible.
- Mobile gameplay is tested honestly.
- Automated tests and authenticated journeys pass.
- Known limitations are clearly reported.
- No unauthorized public deployment occurs.

Do not claim complete production readiness merely because the build and CI pass.

## 19. Final delivery

At the end, provide:

- Full implementation summary.
- Before/after screenshots.
- Gameplay recordings where feasible.
- Architecture overview.
- Database migration summary.
- Economy simulation results.
- Security findings.
- Multiplayer results.
- Mobile performance measurements.
- Admin dashboard documentation.
- Payment release checklist.
- Known limitations.
- Remaining release blockers.
- Exact changed-file manifest.
- Final test report.
- Approval requests for any gated changes.

Clearly distinguish:

- Fully implemented and verified.
- Implemented but requiring release validation.
- Partially implemented.
- Deferred.
- Blocked.

Never describe planned functionality as completed.

---

# FINAL DIRECTIVE

Build Accra We Dey into a coherent, persistent virtual Accra where players can work, qualify for careers, own property, operate businesses, buy and sell vehicles, form relationships, attend events, experience personal stories and shape their own lives.

The world must be visually compelling.

The first session must be understandable.

The economy must offer meaningful progression.

The multiplayer systems must be reliable.

The developer must be able to operate the game securely.

The advertising platform must work outside the in-game phone.

Every important transaction must be authoritative, persistent and auditable.

**Preserve the existing codebase, protect existing player data, respect Claude's character-production work and execute the stages in order.**

Do not create a new workspace.

Do not deploy publicly.

**BEGIN STAGE 0 NOW, THEN EXECUTE THE MASTER PROGRAM THROUGH ITS VALIDATED STAGES.**