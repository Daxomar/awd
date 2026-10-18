// Server-authoritative Accra Story & Aspiration Engine.
// End-to-end multi-chapter narrative progression, interactive encounters, and dynamic events.

export const STORY_ARCS = {
  landlord: {
    id: 'landlord',
    name: 'East Legon Landlord',
    tagline: 'From Jamestown Compound to Trasacco Villa',
    ic: 'house',
    accent: '#d97706',
    desc: 'Climb from a leaking compound room to owning sprawling estates, commercial arcades, and luxury Trasacco mansions.',
    chapters: [
      { num: 1, title: "The Caretaker's Scheme", summary: "Survive living in a leaky compound room and uncover the caretaker's extortion." },
      { num: 2, title: "The Land Guard Showdown", summary: "Acquire your first boundary plot on the city outskirts and defend it from land guards." },
      { num: 3, title: "Contractor Wahala", summary: "Procure blocks and cement at Makola, manage construction, and survive Dumsor blackouts." },
      { num: 4, title: "Commercial Property Empire", summary: "Lease out high-value retail stalls in Osu and screen profitable tenants." },
      { num: 5, title: "The Trasacco Kingdom", summary: "Own your multi-million cedi estate in Trasacco and rise as the undisputed Chairman." },
    ],
    dbeeChapters: [
      { num: 1, title: "The Family Estate Trust", summary: "Audit family luxury serviced flats in Airport Residential and screen elite expat tenants." },
      { num: 2, title: "Commercial Portfolio Expansion", summary: "Deploy family seed investment into high-yield retail plots in East Legon and Cantonments." },
      { num: 3, title: "Contractor Wahala", summary: "Procure blocks and cement at Makola, manage construction, and survive Dumsor blackouts." },
      { num: 4, title: "Commercial Property Empire", summary: "Lease out high-value retail stalls in Osu and screen profitable tenants." },
      { num: 5, title: "The Trasacco Kingdom", summary: "Own your multi-million cedi estate in Trasacco and rise as the undisputed Chairman." },
    ]
  },
  star: {
    id: 'star',
    name: 'Afrobeats Hitmaker',
    tagline: 'From Bedroom Freestyles to Afrochella Headline',
    ic: 'microphone',
    accent: '#ec4899',
    desc: 'Rise from late-night bedroom recordings to packing out Vibes Lounge, topping the airwaves, and headlining Detty December.',
    chapters: [
      { num: 1, title: "The Bedroom Demo", summary: "Record your first raw voicenotes and test the crowd at Labadi Beach." },
      { num: 2, title: "The Street Sound Battle", summary: "Drop bars at Vibes Lounge and win high-stakes Azonto sound clashes." },
      { num: 3, title: "Shady Record Deals & Indie Grind", summary: "Navigate predatory 360 label contracts and shoot your breakthrough video." },
      { num: 4, title: "The Viral Hit & Club Residency", summary: "Take over radio frequencies, host VIP tables in Osu, and survive industry beef." },
      { num: 5, title: "Detty December Headline", summary: "Sell out the 40,000-capacity festival stage and ride through Accra in celebrity luxury." },
    ],
    dbeeChapters: [
      { num: 1, title: "The Silver Spoon Stigma", summary: "Produce studio masters with elite gear, then prove your lyrics have real street grit." },
      { num: 2, title: "The Street Cypher Respect", summary: "Earn the respect of veteran producers and face down corrupt radio DJ payola." },
      { num: 3, title: "Shady Record Deals & Indie Grind", summary: "Navigate predatory 360 label contracts and shoot your breakthrough video." },
      { num: 4, title: "The Viral Hit & Club Residency", summary: "Take over radio frequencies, host VIP tables in Osu, and survive industry beef." },
      { num: 5, title: "Detty December Headline", summary: "Sell out the 40,000-capacity festival stage and ride through Accra in celebrity luxury." },
    ]
  },
  mogul: {
    id: 'mogul',
    name: 'Makola Business Mogul',
    tagline: 'From Pavement Table to Conglomerate',
    ic: 'storefront',
    accent: '#10b981',
    desc: 'Turn thrift bale hunting into a commercial freight empire, a trotro fleet, and high-stakes retail conglomerate.',
    chapters: [
      { num: 1, title: "The Kantamanto Hustle", summary: "Bale hunting, sharp bargaining, and selling out your first thrift stock." },
      { num: 2, title: "Trotro Logistics Fleet", summary: "Buy a commercial 207 bus, hire crew, and handle station masters and police checkpoints." },
      { num: 3, title: "The Circle Container Store", summary: "Open a 20ft container shop at Circle, launch MoMo merchant till, and beat tax audits." },
      { num: 4, title: "Tema Port Clearance", summary: "Import sea-freight electronics, navigate customs duties, and supply supermarkets." },
      { num: 5, title: "The Conglomerate Chairman", summary: "Acquire nightlife equity, build a multi-fleet empire, and chair the Chamber of Commerce." },
    ],
    dbeeChapters: [
      { num: 1, title: "The Family Import Line", summary: "Clear high-value freight containers at Tema Port and supply upscale shopping malls." },
      { num: 2, title: "Commercial Freight & Fleet", summary: "Expand the shipping and transport pipeline and outsmart monopolistic port cartels." },
      { num: 3, title: "The Circle Container Store", summary: "Open a 20ft container shop at Circle, launch MoMo merchant till, and beat tax audits." },
      { num: 4, title: "Tema Port Clearance", summary: "Import sea-freight electronics, navigate customs duties, and supply supermarkets." },
      { num: 5, title: "The Conglomerate Chairman", summary: "Acquire nightlife equity, build a multi-fleet empire, and chair the Chamber of Commerce." },
    ]
  },
  unicorn: {
    id: 'unicorn',
    name: 'Osu Tech Founder',
    tagline: 'From Cafeteria Coding to Silicon Accra Unicorn',
    ic: 'laptop',
    accent: '#6366f1',
    desc: 'Build tech products on iced Milo, raise venture capital in Airport Residential, survive Dumsor crashes, and hit a $100M valuation.',
    chapters: [
      { num: 1, title: "Late Night Commits", summary: "Master coding at the tech hub and ship a 100% working prototype MVP." },
      { num: 2, title: "The Seed Pitch Deck", summary: "Survive harsh angel investor grilling in Airport Residential and secure pre-seed capital." },
      { num: 3, title: "Dumsor & Server Meltdown", summary: "Grid blackouts threaten user databases; install solar backups and counter dev poaching." },
      { num: 4, title: "Scaling the FinTech Platform", summary: "Pass Bank of Ghana regulatory sandboxes and close multi-million cedi Series A." },
      { num: 5, title: "The Accra Unicorn", summary: "Move into a Cantonments tech campus, hit unicorn valuation, and deliver Africa Tech Keynote." },
    ],
    dbeeChapters: [
      { num: 1, title: "The Boardroom Defiance", summary: "Reject comfortable corporate nepotism to build an independent software startup." },
      { num: 2, title: "The Angel Syndicate Round", summary: "Pitch high-net-worth family networks at the Polo Club and counter predatory term sheets." },
      { num: 3, title: "Dumsor & Server Meltdown", summary: "Grid blackouts threaten user databases; install solar backups and counter dev poaching." },
      { num: 4, title: "Scaling the FinTech Platform", summary: "Pass Bank of Ghana regulatory sandboxes and close multi-million cedi Series A." },
      { num: 5, title: "The Accra Unicorn", summary: "Move into a Cantonments tech campus, hit unicorn valuation, and deliver Africa Tech Keynote." },
    ]
  },
  bigman: {
    id: 'bigman',
    name: 'High Society Borga',
    tagline: 'From Heathrow Arrival to King of Accra',
    ic: 'crown',
    accent: '#f59e0b',
    desc: 'Step off the flight with foreign currency, handle family black tax demands, cruise in a Prado, and cement your reign in Accra high society.',
    chapters: [
      { num: 1, title: "Akwaaba Check-in", summary: "Survive airport protocol, cash out at the Forex bureau, and get bespoke tailored Kente." },
      { num: 2, title: "The Black Tax Council", summary: "Family emergency conclave in the family compound; balance filial piety with financial sanity." },
      { num: 3, title: "The Prado & Highway Checkpoints", summary: "Acquire the legendary Land Cruiser V8, command respect at VIP valet, and build elite clout." },
      { num: 4, title: "The Cantonments Charity Gala", summary: "Host exclusive fundraisers, donate to civic community development, and enter corporate governance." },
      { num: 5, title: "The Untouchable Pillar", summary: "Attain legendary civic prestige, establish an enduring foundation, and reign as an elder statesman." },
    ],
    dbeeChapters: [
      { num: 1, title: "The Dynastic Heir", summary: "Represent the family dynasty at diplomatic receptions and prove you are more than a nepo baby." },
      { num: 2, title: "The Family Trust Succession", summary: "Consolidate executive control over the family trust and earn civic chieftaincy respect." },
      { num: 3, title: "The Prado & Highway Checkpoints", summary: "Acquire the legendary Land Cruiser V8, command respect at VIP valet, and build elite clout." },
      { num: 4, title: "The Cantonments Charity Gala", summary: "Host exclusive fundraisers, donate to civic community development, and enter corporate governance." },
      { num: 5, title: "The Untouchable Pillar", summary: "Attain legendary civic prestige, establish an enduring foundation, and reign as an elder statesman." },
    ]
  }
};

export const STORY_MISSIONS = {
  // =========================================================================
  // EAST LEGON LANDLORD
  // =========================================================================
  // Chapter 1: The Caretaker's Scheme
  landlord_1_1: {
    id: 'landlord_1_1', dream: 'landlord', chapter: 1, step: 1,
    title: 'Inspect the Compound Room',
    desc: 'Your compound room ceiling has a bad leak. Check on your living conditions and document the damage before confronting the caretaker.',
    dialogue: { speaker: 'Mr. Lamptey (Caretaker)', text: 'Chale, small water dripping from ceiling you dey complain? You want Trasacco palace with compound rent? Manage am!' },
    action: 'home', target: 'home', hint: 'Go to your home and inspect your room',
    reward: { cash: 100, xp: 20, badge: 'Tenant Alert' },
    check: (s, c) => c.at === 'home' || s.place === 'home' || (s.discovery?.visited && s.discovery.visited.home)
  },
  landlord_1_2: {
    id: 'landlord_1_2', dream: 'landlord', chapter: 1, step: 2,
    title: 'Source Emergency Sealant at Makola',
    desc: 'Don\'t let Lamptey cheat you. Go to Makola Market or Kantamanto and work a market gig (carry loads, resell, or hawk) to earn your own repair supplies.',
    dialogue: { speaker: 'Aunty Mansa (Neighbor)', text: 'Don\'t let Lamptey take your money for repairs and drink Guinness with it. Go hustle at Makola and buy the tar yourself!' },
    action: 'explore', target: 'makola', hint: 'Go to Makola/Kantamanto and complete any market work/gig to earn supplies',
    reward: { cash: 150, xp: 25 },
    check: (s, c) => ['makola', 'kantamanto'].includes(s.place) && ((s.stats?.gigs || 0) >= 1 || (s.cnt && ((s.cnt['act:kayayo'] || 0) + (s.cnt['act:resell'] || 0) + (s.cnt['act:hawk'] || 0) + (s.cnt['act:accessories'] || 0)) >= 1) || (s.gd && (s.gd.earned || 0) >= 60))
  },
  landlord_1_3: {
    id: 'landlord_1_3', dream: 'landlord', chapter: 1, step: 3,
    title: 'The Landlord\'s Susu Fund',
    desc: 'If you want to own property in Accra, your money cannot sit under a mattress. Deposit at least GH₵300 into savings.',
    dialogue: { speaker: 'Kofi Susu Collector', text: 'Drop by drop, the calabash gets full. When land opportunity comes, only cash in the bank speaks!' },
    action: 'bank', target: 'bank', hint: 'Deposit money into fixed savings or MoMo balance >= GH₵300',
    reward: { cash: 200, xp: 30, badge: 'Susu Saver' },
    check: (s) => (s.flags.fixed?.amount || 0) >= 300 || (s.momo || 0) >= 600 || (s.cash + s.momo >= 1000)
  },
  landlord_1_4: {
    id: 'landlord_1_4', dream: 'landlord', chapter: 1, step: 4, isClimax: true,
    title: 'Climax: The Caretaker\'s Extortion',
    desc: 'Mr. Lamptey tries to double the compound electricity surcharge. How do you handle this street extortion?',
    encounterId: 'enc_landlord_c1',
    action: 'story_event', hint: 'Make your decision on the Caretaker encounter',
    reward: { cash: 350, xp: 50, rep: 2, badge: 'Compound Diplomat' },
    check: (s) => (s.story?.completedEncounters || []).includes('enc_landlord_c1')
  },

  // Chapter 2: The Land Guard Showdown
  landlord_2_1: {
    id: 'landlord_2_1', dream: 'landlord', chapter: 2, step: 1,
    title: 'Scouting the City Outskirts',
    desc: 'Travel to Kaneshie or Circle and work a transport or station hustle to earn your land survey fee.',
    dialogue: { speaker: 'Surveyor Mensah', text: 'Accra land is pure gold, but you have to walk the perimeter with your two eyes before signing any paper!' },
    action: 'explore', target: 'kaneshie', hint: 'Go to Kaneshie/Circle and earn at least GH₵40 from gigs or station work',
    reward: { cash: 250, xp: 35 },
    check: (s, c) => ['kaneshie', 'circle', 'nima'].includes(s.place) && ((s.stats?.gigs || 0) >= 1 || (s.gd?.earned || 0) >= 40 || (s.cnt && ((s.cnt['act:mate'] || 0) + (s.cnt['act:load'] || 0) + (s.cnt['act:resell'] || 0)) >= 1))
  },
  landlord_2_2: {
    id: 'landlord_2_2', dream: 'landlord', chapter: 2, step: 2,
    title: 'Official Lands Commission Search',
    desc: 'Check official housing and land registries so you don\'t buy a litigation-trapped plot.',
    dialogue: { speaker: 'Lands Registry Clerk', text: 'Every plot in Accra has three owners: the real one, the ghost, and the chief\'s nephew. Always verify!' },
    action: 'houses', target: 'houses', hint: 'Open the Houses or Properties app on your phone',
    reward: { cash: 300, xp: 40 },
    check: (s) => (s.flags?.seen?.houses) || (s.cnt && (s.cnt['act:interact'] || 0) >= 3) || Object.keys(s.land || {}).length > 0
  },
  landlord_2_3: {
    id: 'landlord_2_3', dream: 'landlord', chapter: 2, step: 3,
    title: 'Acquiring the First Parcel',
    desc: 'Own a plot of land or upgrade to a self-contained home in Labadi or Osu.',
    dialogue: { speaker: 'Chief\'s Indenture Witness', text: 'Stamp this with the traditional council seal. Today you are a landholder!' },
    action: 'houses', target: 'houses', hint: 'Own a plot of land or rent a self-contained home',
    reward: { cash: 500, xp: 60, badge: 'Landholder' },
    check: (s) => Object.keys(s.land || {}).length > 0 || ['labadi', 'osu', 'airres', 'legon', 'trasacco'].includes(s.home)
  },
  landlord_2_4: {
    id: 'landlord_2_4', dream: 'landlord', chapter: 2, step: 4, isClimax: true,
    title: 'Climax: The Red Sand & The Land Guards',
    desc: 'Two land guards show up at your plot demanding GH₵300 "digging fee" before you lay boundary pillars.',
    encounterId: 'enc_landlord_c2',
    action: 'story_event', hint: 'Resolve the Land Guard standoff',
    reward: { cash: 600, xp: 80, rep: 3, badge: 'Boundary Master' },
    check: (s) => (s.story?.completedEncounters || []).includes('enc_landlord_c2')
  },

  // Chapter 3: Contractor Wahala
  landlord_3_1: {
    id: 'landlord_3_1', dream: 'landlord', chapter: 3, step: 1,
    title: 'Pricing Blocks & Rods',
    desc: 'Head to Kantamanto or Makola building area and hustle to earn at least GH₵80 towards building supplies.',
    dialogue: { speaker: 'Kweku Mason', text: 'Master, cement price jumped this morning oh! Dollar has touched it. Buy today before tomorrow rises!' },
    action: 'explore', target: 'kantamanto', hint: 'Work gigs or trades in Kantamanto/Makola to earn building supplies funds',
    reward: { cash: 400, xp: 45 },
    check: (s, c) => ['kantamanto', 'makola'].includes(s.place) && ((s.stats?.gigs || 0) >= 2 || (s.gd?.earned || 0) >= 80 || (s.cnt && ((s.cnt['act:resell'] || 0) + (s.cnt['act:kayayo'] || 0) + (s.cnt['act:hawk'] || 0)) >= 1))
  },
  landlord_3_2: {
    id: 'landlord_3_2', dream: 'landlord', chapter: 3, step: 2,
    title: 'Dumsor on the Construction Site',
    desc: 'ECG cuts power right when the borehole pump is needed for mortar. Secure a generator or work through the outage.',
    dialogue: { speaker: 'Tiger Generator Salesman', text: 'In Ghana, light is a visitor, but dumsor is the landlord! Small gen will keep work running.' },
    action: 'shop', target: 'shop', hint: 'Inspect generator/solar items or complete a work shift during dumsor',
    reward: { cash: 450, xp: 50 },
    check: (s) => !!s.items?.gen || !!s.items?.solar || (s.stats.shifts || 0) >= 2 || (s.cash + s.momo >= 2000)
  },
  landlord_3_3: {
    id: 'landlord_3_3', dream: 'landlord', chapter: 3, step: 3,
    title: 'The Roofing Ceremony Feast',
    desc: 'The roof trusses are up! Tradition demands you feed the artisans hot waakye and Malta Guinness so the roof stays blessed.',
    dialogue: { speaker: 'Carpenter Yaw', text: 'When the workers are happy, the nails drive straight! Bless our bellies!' },
    action: 'explore', target: 'makola', hint: 'Finish a meal at a local eatery or food joint',
    reward: { cash: 500, xp: 60, badge: 'Master Builder' },
    check: (s) => (s.stats.meals || 0) >= 2
  },
  landlord_3_4: {
    id: 'landlord_3_4', dream: 'landlord', chapter: 3, step: 4, isClimax: true,
    title: 'Climax: The Stolen Cement Mystery',
    desc: 'Ten bags of cement went missing overnight. The night watchman blames "spiritual dwarfs", but you suspect the mason\'s nephew.',
    encounterId: 'enc_landlord_c3',
    action: 'story_event', hint: 'Handle the missing cement dispute',
    reward: { cash: 700, xp: 90, rep: 4, badge: 'Eagle Eye' },
    check: (s) => (s.story?.completedEncounters || []).includes('enc_landlord_c3')
  },

  // Chapter 4: Commercial Property Empire
  landlord_4_1: {
    id: 'landlord_4_1', dream: 'landlord', chapter: 4, step: 1,
    title: 'Scouting Oxford Street Commercial Stalls',
    desc: 'Residential rent is safe, but commercial storefronts on Oxford Street Osu mint serious wealth. Earn commercial hustle income or network with shop owners.',
    dialogue: { speaker: 'Osu Commercial Agent', text: 'Foot traffic here is 24/7. Tourists, expats, ballers. A shop here pays for itself in one Christmas season!' },
    action: 'explore', target: 'oxford', hint: 'Visit Oxford Street Osu and earn GH₵100+ or network with shopkeepers',
    reward: { cash: 600, xp: 60 },
    check: (s, c) => s.place === 'oxford' && ((s.gd?.earned || 0) >= 100 || (s.stats?.gigs || 0) >= 3 || (s.cnt && (s.cnt.social || 0) >= 2) || (s.stats?.meals || 0) >= 2)
  },
  landlord_4_2: {
    id: 'landlord_4_2', dream: 'landlord', chapter: 4, step: 2,
    title: 'The Quarter-Million Net Worth',
    desc: 'Accumulate at least GH₵200,000 in combined net worth across bank savings, inventory, and real estate.',
    dialogue: { speaker: 'Bank Manager Boateng', text: 'You\'ve crossed into high-net-worth status. Private wealth banking is ready for you.' },
    action: 'bank', target: 'bank', hint: 'Reach a net worth of GH₵100,000+',
    reward: { cash: 1000, xp: 100, badge: 'High Net Worth' },
    check: (s) => (s.cash + s.momo + (s.flags.fixed?.amount || 0) >= 5000) || Object.keys(s.owned || {}).length > 0 || Object.keys(s.biz || {}).length > 0
  },
  landlord_4_3: {
    id: 'landlord_4_3', dream: 'landlord', chapter: 4, step: 3,
    title: 'Commercial Leasing & Business Equity',
    desc: 'Own at least one managed business or commercial lease operation.',
    dialogue: { speaker: 'Tenant Mama Akos', text: 'Here is my 6 months advance for the corner shop. God bless our partnership!' },
    action: 'enterprise', target: 'enterprise', hint: 'Start a managed business in the Enterprise app or own property',
    reward: { cash: 1200, xp: 120, badge: 'Commercial Landlord' },
    check: (s) => Object.keys(s.biz || {}).length >= 1 || Object.keys(s.owned || {}).length >= 1
  },
  landlord_4_4: {
    id: 'landlord_4_4', dream: 'landlord', chapter: 4, step: 4, isClimax: true,
    title: 'Climax: The Sidewalk Squatter Dilemma',
    desc: 'A struggling plantain roaster has pitched a kiosk against your prime storefront wall. The city taskforce wants to demolish it.',
    encounterId: 'enc_landlord_c4',
    action: 'story_event', hint: 'Decide the fate of the sidewalk trader',
    reward: { cash: 1500, xp: 150, rep: 6, badge: 'Pillar of Osu' },
    check: (s) => (s.story?.completedEncounters || []).includes('enc_landlord_c4')
  },

  // Chapter 5: The Trasacco Kingdom
  landlord_5_1: {
    id: 'landlord_5_1', dream: 'landlord', chapter: 5, step: 1,
    title: 'The Trasacco Valley Viewing',
    desc: 'Travel to East Legon or Trasacco Valley. The gold gates and manicured lawns await the city\'s biggest players. Present proof of wealth or luxury dining.',
    dialogue: { speaker: 'Trasacco Luxury Broker', text: 'Welcome home, Chairman. Double garage, private borehole, 24-hour estate armed security.' },
    action: 'explore', target: 'trasacco', hint: 'Visit East Legon/Trasacco with liquid capital >= GH₵5,000 or fine dining',
    reward: { cash: 2000, xp: 200 },
    check: (s, c) => ['trasacco', 'legon'].includes(s.place) && ((s.cash + s.momo >= 5000) || (s.stats?.meals || 0) >= 4 || (s.cnt && (s.cnt.social || 0) >= 2))
  },
  landlord_5_2: {
    id: 'landlord_5_2', dream: 'landlord', chapter: 5, step: 2,
    title: 'Accra Millionaire Status',
    desc: 'Achieve verified millionaire status with assets and funds crossing the threshold.',
    dialogue: { speaker: 'Forbes Accra Correspondent', text: 'They used to mock you in the compound house. Today they write your name in gold!' },
    action: 'status', target: 'status', hint: 'Reach high savings or own premium real estate',
    reward: { cash: 3000, xp: 300, badge: 'Accra Millionaire' },
    check: (s) => (s.cash + s.momo >= 15000) || Object.keys(s.owned || {}).length >= 1 || Object.keys(s.land || {}).length >= 2
  },
  landlord_5_3: {
    id: 'landlord_5_3', dream: 'landlord', chapter: 5, step: 3,
    title: 'The Crown Estate Deed',
    desc: 'Own your permanent residence in Accra through the property deed registry.',
    dialogue: { speaker: 'High Court Registrar', text: 'Under the authority of the Republic of Ghana, this title is deeded in perpetuity to you!' },
    action: 'houses', target: 'houses', hint: 'Own a home or reach net worth milestone',
    reward: { cash: 5000, xp: 500, badge: 'East Legon Chairman' },
    check: (s) => Object.values(s.owned || {}).some(v => v === true) || ['airres', 'legon', 'trasacco'].includes(s.home)
  },
  landlord_5_4: {
    id: 'landlord_5_4', dream: 'landlord', chapter: 5, step: 4, isClimax: true,
    title: 'Grand Finale: The Chairman\'s Housewarming',
    desc: 'Host the biggest housewarming banquet in East Legon. Politicians, musicians, and old friends from Jamestown arrive.',
    encounterId: 'enc_landlord_c5',
    action: 'story_event', hint: 'Deliver your Chairman banquet speech',
    reward: { cash: 10000, xp: 1000, rep: 10, badge: 'King of Real Estate' },
    check: (s) => (s.story?.completedEncounters || []).includes('enc_landlord_c5')
  },

  // =========================================================================
  // AFROBEATS HITMAKER
  // =========================================================================
  star_1_1: {
    id: 'star_1_1', dream: 'star', chapter: 1, step: 1,
    title: 'Bedroom Voicenotes',
    desc: 'Practise your cadence and lyric writing at home until you reach Music level 2.',
    dialogue: { speaker: 'Producer Datbeat', text: 'You have melody oh! But your breath control needs discipline. Practise your scales!' },
    action: 'status', target: 'status', hint: 'Practise music skill or listen to tracks',
    reward: { cash: 100, xp: 25, badge: 'Bedroom Artist' },
    check: (s) => (s.skills.music || 0) >= 1 || (s.cnt && (s.cnt['act:guitar'] || 0) >= 1)
  },
  star_1_2: {
    id: 'star_1_2', dream: 'star', chapter: 1, step: 2,
    title: 'Labadi Beach Listening Session',
    desc: 'Take your phone demo to Labadi Beach and test the beat with an on-site dance clash, busking, or beach interaction.',
    dialogue: { speaker: 'Chale Boy Sly', text: 'This baseline is sweet chaley! If you drop this at night, the girls will lose their sandals!' },
    action: 'explore', target: 'labadi', hint: 'Go to Labadi Beach and engage in dance, battle, music, or social chats',
    reward: { cash: 150, xp: 30 },
    check: (s, c) => s.place === 'labadi' && ((s.cnt && ((s.cnt['act:dance'] || 0) + (s.cnt['act:battle'] || 0) + (s.cnt['act:guitar'] || 0) + (s.cnt.social || 0) + (s.cnt.chat || 0)) >= 1) || (s.skills?.music || 0) >= 2)
  },
  star_1_3: {
    id: 'star_1_3', dream: 'star', chapter: 1, step: 3,
    title: 'Studio Gear & Stage Drip',
    desc: 'Visit the Shop or Boutique to upgrade your personal look for your first performance.',
    dialogue: { speaker: 'Osu Stylist', text: 'Talent without packaging in Accra is like waakye without shito! Dress the part!' },
    action: 'boutique', target: 'boutique', hint: 'Change your outfit in Boutique or buy studio gear',
    reward: { cash: 200, xp: 35, badge: 'Dressed to Impress' },
    check: (s) => (s.cnt && s.cnt.outfit > 0) || !!s.items?.speaker || !!s.items?.guitar || !!s.wardrobe?.jerseyaway
  },
  star_1_4: {
    id: 'star_1_4', dream: 'star', chapter: 1, step: 4, isClimax: true,
    title: 'Climax: The Jamestown Corner Cypher',
    desc: 'Local street rappers challenge you to an unscripted street freestyle outside a waakye joint.',
    encounterId: 'enc_star_c1',
    action: 'story_event', hint: 'Win the street cypher',
    reward: { cash: 350, xp: 60, rep: 3, badge: 'Street Freestyler' },
    check: (s) => (s.story?.completedEncounters || []).includes('enc_star_c1')
  },

  // Chapter 2: The Street Sound Battle
  star_2_1: {
    id: 'star_2_1', dream: 'star', chapter: 2, step: 1,
    title: 'Vibes Lounge Debut',
    desc: 'Arrive at Vibes Lounge in Osu and rock the mic or dance floor with a performance or club gig.',
    dialogue: { speaker: 'DJ Black', text: 'You get 3 minutes on my stage. If the crowd doesn\'t scream, I will cut your mic!' },
    action: 'explore', target: 'vibes', hint: 'Visit Vibes Lounge in Osu and complete a battle, performance or club gig',
    reward: { cash: 250, xp: 40 },
    check: (s, c) => s.place === 'vibes' && ((s.cnt && ((s.cnt['act:battle'] || 0) + (s.cnt['act:dance'] || 0) + (s.cnt['act:club'] || 0) + (s.cnt['act:sing'] || 0)) >= 1) || (s.stats?.gigs || 0) >= 1 || (s.gd?.earned || 0) >= 50)
  },
  star_2_2: {
    id: 'star_2_2', dream: 'star', chapter: 2, step: 2,
    title: 'Azonto Sound Clash',
    desc: 'Engage in a live dance or social interaction at a venue with fellow nightlife partygoers.',
    dialogue: { speaker: 'Hype Man Kofi', text: 'Hands in the air! Show them how Jamestown moves!' },
    action: 'interact', target: 'interact', hint: 'Complete a social or dance action at Vibes Lounge',
    reward: { cash: 300, xp: 50, badge: 'Stage Commander' },
    check: (s) => (s.cnt && (s.cnt['act:battle'] || s.cnt.social || s.cnt.chat || 0) >= 1)
  },
  star_2_3: {
    id: 'star_2_3', dream: 'star', chapter: 2, step: 3,
    title: 'The Viral Sound Snippet',
    desc: 'Level up Music skill to 3+ and watch your sound get shared across Accra group chats.',
    dialogue: { speaker: 'TikTok Influencer Esi', text: 'Everyone is using your audio for the waist dance challenge! You are trending!' },
    action: 'status', target: 'status', hint: 'Raise Music skill to 3 or complete 3 social chats',
    reward: { cash: 450, xp: 60 },
    check: (s) => (s.skills.music || 0) >= 2 || (s.cnt && s.cnt.social >= 2)
  },
  star_2_4: {
    id: 'star_2_4', dream: 'star', chapter: 2, step: 4, isClimax: true,
    title: 'Climax: The Tema Mic Showdown',
    desc: 'A rival artist tries to grab your mic during the encore at Vibes Lounge.',
    encounterId: 'enc_star_c2',
    action: 'story_event', hint: 'Conquer the mic battle',
    reward: { cash: 600, xp: 90, rep: 4, badge: 'Crowd Favourite' },
    check: (s) => (s.story?.completedEncounters || []).includes('enc_star_c2')
  },

  // Chapter 3: Shady Record Deals & Indie Grind
  star_3_1: {
    id: 'star_3_1', dream: 'star', chapter: 3, step: 1,
    title: 'The Executive Dinner in Airport Residential',
    desc: 'Meet record label A&Rs at an upscale dinner lounge in Airport Residential. Dine or network with industry figures.',
    dialogue: { speaker: 'Label Boss Dapper', text: 'We will put you on billboards in London and Lagos. Just put your signature on this little contract...' },
    action: 'explore', target: 'airres', hint: 'Visit Airport Residential and dine, network, or earn GH₵100+ at the venue',
    reward: { cash: 400, xp: 50 },
    check: (s, c) => s.place === 'airres' && ((s.stats?.meals || 0) >= 1 || (s.cnt && (s.cnt.social || 0) >= 2) || (s.gd?.earned || 0) >= 100)
  },
  star_3_2: {
    id: 'star_3_2', dream: 'star', chapter: 3, step: 2,
    title: 'Working the Radio Booth',
    desc: 'Work a paid shift as a radio personality, DJ, or guest host.',
    dialogue: { speaker: 'Station Producer', text: 'Cue the intro, plug the upcoming concert, and spin the hottest records in the city!' },
    action: 'jobs', target: 'jobs', hint: 'Complete a work shift or reach Music level 4',
    reward: { cash: 500, xp: 70, badge: 'Radio Host' },
    check: (s) => (s.stats.shifts || 0) >= 1 || (s.skills.music || 0) >= 4
  },
  star_3_3: {
    id: 'star_3_3', dream: 'star', chapter: 3, step: 3,
    title: 'Jamestown Lighthouse Video Shoot',
    desc: 'Shoot your official music video with the historic Jamestown lighthouse. Spar in the gym, perform on the street, or complete 2 gigs.',
    dialogue: { speaker: 'Video Director Nana', text: 'Camera rolls in 3, 2, 1! Flex the sunglasses, let the ocean wind blow your shirt!' },
    action: 'explore', target: 'n:jtown', hint: 'Visit Jamestown and engage in video shooting actions (performing, gym workout, or gigs)',
    reward: { cash: 600, xp: 80 },
    check: (s, c) => (s.place === 'jtown' || s.place?.includes('jtown')) && ((s.stats?.gigs || 0) >= 2 || (s.cnt && ((s.cnt['act:spar'] || 0) + (s.cnt['act:boxing'] || 0) + (s.cnt['act:guitar'] || 0) + (s.cnt.social || 0)) >= 1))
  },
  star_3_4: {
    id: 'star_3_4', dream: 'star', chapter: 3, step: 4, isClimax: true,
    title: 'Climax: The Predatory 360 Contract',
    desc: 'The label boss offers GH₵5,000 upfront, but demands 60% of all touring, master rights, and merch royalties forever.',
    encounterId: 'enc_star_c3',
    action: 'story_event', hint: 'Sign or stay independent',
    reward: { cash: 800, xp: 120, rep: 5, badge: 'Indie Icon' },
    check: (s) => (s.story?.completedEncounters || []).includes('enc_star_c3')
  },

  // Chapter 4: The Viral Hit & Club Residency
  star_4_1: {
    id: 'star_4_1', dream: 'star', chapter: 4, step: 1,
    title: 'Number 1 on Accra Shazam Charts',
    desc: 'Your song is ringing from trotros in Circle to beach parties in Labadi. Reach Music level 6+.',
    dialogue: { speaker: 'Trotromate Kwesi', text: 'Master, play that track again! The passengers say we shouldn\'t stop!' },
    action: 'status', target: 'status', hint: 'Train Music skill to level 6',
    reward: { cash: 800, xp: 100, badge: 'Chart Topper' },
    check: (s) => (s.skills.music || 0) >= 5 || (s.rep || 0) >= 10
  },
  star_4_2: {
    id: 'star_4_2', dream: 'star', chapter: 4, step: 2,
    title: 'Saturday Night VIP Bottle Service',
    desc: 'Host a VIP table at a premier nightclub and treat your industry crew.',
    dialogue: { speaker: 'Club Waitress', text: 'Sparklers for table 1! The Starboy is in the building tonight!' },
    action: 'explore', target: 'vibes', hint: 'Spend an evening at Vibes Lounge with high mood',
    reward: { cash: 1000, xp: 120 },
    check: (s) => (s.mood || 0) >= 15 || (s.cnt && s.cnt['act:club'] >= 1) || (s.cash + s.momo >= 3000)
  },
  star_4_3: {
    id: 'star_4_3', dream: 'star', chapter: 4, step: 3,
    title: 'International Starboy Collab',
    desc: 'Complete 5 mutual player interactions or build close in-game connections.',
    dialogue: { speaker: 'Lagos Producer Plug', text: 'Burna and Wizkid\'s manager just DM\'d about your hook. West Africa is united!' },
    action: 'relationships', target: 'relationships', hint: 'Have at least 1 friend or 5 social interactions',
    reward: { cash: 1500, xp: 150, badge: 'Afrobeats Royalty' },
    check: (s) => Object.keys(s.friends || {}).length >= 1 || (s.cnt && s.cnt.social >= 5)
  },
  star_4_4: {
    id: 'star_4_4', dream: 'star', chapter: 4, step: 4, isClimax: true,
    title: 'Climax: The Radio Payola Blackmail',
    desc: 'A prominent presenter threatens to pull your track unless you pay GH₵1,000 kickback.',
    encounterId: 'enc_star_c4',
    action: 'story_event', hint: 'Handle the payola shake-down',
    reward: { cash: 2000, xp: 200, rep: 6, badge: 'Integrity Star' },
    check: (s) => (s.story?.completedEncounters || []).includes('enc_star_c4')
  },

  // Chapter 5: Detty December Headline
  star_5_1: {
    id: 'star_5_1', dream: 'star', chapter: 5, step: 1,
    title: 'The Live Street Billboard Face',
    desc: 'Your face shines on the digital billboards of Accra announcing Detty December. Inspect the billboards in Osu or Circle with established street reputation.',
    dialogue: { speaker: 'Concert Promoter', text: 'All 8 city billboards are booked with your face. Tickets sold out in 14 minutes!' },
    action: 'explore', target: 'oxford', hint: 'Visit Oxford Street or Circle with Reputation 15+ or earn GH₵200+',
    reward: { cash: 2500, xp: 250 },
    check: (s, c) => ['oxford', 'circle'].includes(s.place) && ((s.rep || 0) >= 15 || (s.gd?.earned || 0) >= 200 || (s.skills?.music || 0) >= 6)
  },
  star_5_2: {
    id: 'star_5_2', dream: 'star', chapter: 5, step: 2,
    title: 'Celebrity Drip & Luxury Wheels',
    desc: 'Ride to the arena in a personal vehicle or high-end luxury car.',
    dialogue: { speaker: 'Valet Attendant', text: 'Clear the driveway! The headliner has pulled up!' },
    action: 'cars', target: 'cars', hint: 'Own a car, rent a vehicle, or cross GH₵10,000 savings',
    reward: { cash: 3500, xp: 350, badge: 'Superstar Ride' },
    check: (s) => !!s.car || !!s.rental || (s.cash + s.momo >= 10000)
  },
  star_5_3: {
    id: 'star_5_3', dream: 'star', chapter: 5, step: 3,
    title: 'Master of Melody (Level 10)',
    desc: 'Reach the pinnacle of musical mastery in Ghana.',
    dialogue: { speaker: 'Grammy Committee Scout', text: 'This isn\'t just dance music anymore. This is African artistic history.' },
    action: 'status', target: 'status', hint: 'Reach high Music skill (level 8+) or max career rank',
    reward: { cash: 5000, xp: 500, badge: 'Living Legend' },
    check: (s) => (s.skills.music || 0) >= 8 || (s.rep || 0) >= 30
  },
  star_5_4: {
    id: 'star_5_4', dream: 'star', chapter: 5, step: 4, isClimax: true,
    title: 'Grand Finale: Afrochella Stadium Climax',
    desc: 'Step out onto the stadium stage in front of 40,000 roaring fans under the Accra night sky.',
    encounterId: 'enc_star_c5',
    action: 'story_event', hint: 'Deliver the legendary stadium encore',
    reward: { cash: 10000, xp: 1000, rep: 12, badge: 'King of Afrobeats' },
    check: (s) => (s.story?.completedEncounters || []).includes('enc_star_c5')
  },

  // =========================================================================
  // MAKOLA BUSINESS MOGUL
  // =========================================================================
  mogul_1_1: {
    id: 'mogul_1_1', dream: 'mogul', chapter: 1, step: 1,
    title: 'The 5 AM Kantamanto Bale',
    desc: 'Visit Kantamanto early morning to inspect fresh imported bales. Work a sorting, load or resell gig to earn your first merchandise funds.',
    dialogue: { speaker: 'Bale Importer Yakubu', text: 'First grade UK bale! Clean jackets and jeans. If you take this, you double your money by sunset!' },
    action: 'explore', target: 'kantamanto', hint: 'Visit Kantamanto and complete a gig (thrift sort, load carry, or resell)',
    reward: { cash: 100, xp: 20 },
    check: (s, c) => s.place === 'kantamanto' && ((s.stats?.gigs || 0) >= 1 || (s.gd?.earned || 0) >= 40 || (s.cnt && ((s.cnt['act:resell'] || 0) + (s.cnt['act:load'] || 0) + (s.cnt['act:kayayo'] || 0)) >= 1))
  },
  mogul_1_2: {
    id: 'mogul_1_2', dream: 'mogul', chapter: 1, step: 2,
    title: 'Mastering the Makola Haggle',
    desc: 'Bargain with market women and complete a street hawking, retail or wholesale gig to earn at least GH₵50 in trade margin.',
    dialogue: { speaker: 'Market Queen Mother', text: 'You speak well, young trader. I\'ll give you merchant rate because you have sharp eyes!' },
    action: 'explore', target: 'makola', hint: 'Visit Makola market and earn GH₵50+ through trading or hawking',
    reward: { cash: 150, xp: 25, badge: 'Sharp Bargainer' },
    check: (s, c) => s.place === 'makola' && ((s.stats?.gigs || 0) >= 1 || (s.gd?.earned || 0) >= 50 || (s.cnt && ((s.cnt['act:hawk'] || 0) + (s.cnt['act:resell'] || 0) + (s.cnt['act:accessories'] || 0)) >= 1))
  },
  mogul_1_3: {
    id: 'mogul_1_3', dream: 'mogul', chapter: 1, step: 3,
    title: 'Your First Street Sale',
    desc: 'Complete your first business or marketplace sale to earn retail profit.',
    dialogue: { speaker: 'Customer Ama', text: 'I love these sunglasses! Here is cash in hand.' },
    action: 'market', target: 'market', hint: 'Complete a market transaction or earn income from a gig',
    reward: { cash: 200, xp: 30 },
    check: (s) => (s.life?.commerce?.sold || 0) > 0 || (s.stats.gigs || 0) > 0 || (s.stats.shifts || 0) > 0
  },
  mogul_1_4: {
    id: 'mogul_1_4', dream: 'mogul', chapter: 1, step: 4, isClimax: true,
    title: 'Climax: The Pavement Permit Raid',
    desc: 'City taskforce guards sweep the pavement stalls checking for trader compliance stickers.',
    encounterId: 'enc_mogul_c1',
    action: 'story_event', hint: 'Handle the taskforce inspection',
    reward: { cash: 350, xp: 50, rep: 2, badge: 'Licensed Trader' },
    check: (s) => (s.story?.completedEncounters || []).includes('enc_mogul_c1')
  },

  // Chapter 2: Trotro Logistics Fleet
  mogul_2_1: {
    id: 'mogul_2_1', dream: 'mogul', chapter: 2, step: 1,
    title: 'Meeting the Circle Station Master',
    desc: 'Go to Kwame Nkrumah Circle station and work a transport gig (trotro mate, loading, or phone repair hustle) to earn at least GH₵50.',
    dialogue: { speaker: 'GPRTU Chairman Agyeman', text: 'Circle to Kaneshie is hot. If your bus runs on time, you will print money every day.' },
    action: 'explore', target: 'circle', hint: 'Visit Circle Station and earn GH₵50+ doing station gigs or repairs',
    reward: { cash: 250, xp: 35 },
    check: (s, c) => s.place === 'circle' && ((s.stats?.gigs || 0) >= 1 || (s.gd?.earned || 0) >= 50 || (s.cnt && ((s.cnt['act:mate'] || 0) + (s.cnt['act:repair'] || 0) + (s.cnt['act:load'] || 0)) >= 1))
  },
  mogul_2_2: {
    id: 'mogul_2_2', dream: 'mogul', chapter: 2, step: 2,
    title: 'Acquiring Commercial Wheels',
    desc: 'Own or manage a trotro or taxi operation through the enterprise system.',
    dialogue: { speaker: 'Driver Master Joe', text: 'I know all the shortcuts through Achimota. Give me the wheel, I give you sales!' },
    action: 'enterprise', target: 'enterprise', hint: 'Own a business or reach GH₵2,000 capital',
    reward: { cash: 400, xp: 50, badge: 'Fleet Master' },
    check: (s) => !!s.biz?.trotro || Object.keys(s.biz || {}).length >= 1 || (s.cash + s.momo >= 2000)
  },
  mogul_2_3: {
    id: 'mogul_2_3', dream: 'mogul', chapter: 2, step: 3,
    title: 'Daily Float & Route Settlements',
    desc: 'Collect revenue and manage fuel reserves across your transport routes.',
    dialogue: { speaker: 'Trotro Mate', text: 'Circle! Circle! Board with your exact change! We are fully loaded!' },
    action: 'bank', target: 'bank', hint: 'Deposit transport profits into MoMo',
    reward: { cash: 500, xp: 60 },
    check: (s) => (s.momo || 0) >= 1000 || (s.stats.earned || 0) >= 1000
  },
  mogul_2_4: {
    id: 'mogul_2_4', dream: 'mogul', chapter: 2, step: 4, isClimax: true,
    title: 'Climax: The 37 Checkpoint Impound Threat',
    desc: 'Police stop your driver at 37 Military Hospital claiming roadworthy expired by 2 days.',
    encounterId: 'enc_mogul_c2',
    action: 'story_event', hint: 'Save your trotro from impound',
    reward: { cash: 650, xp: 80, rep: 3, badge: 'Road Boss' },
    check: (s) => (s.story?.completedEncounters || []).includes('enc_mogul_c2')
  },

  // Chapter 3: The Circle Container Store
  mogul_3_1: {
    id: 'mogul_3_1', dream: 'mogul', chapter: 3, step: 1,
    title: 'The 20ft Shipping Container Storefront',
    desc: 'Upgrade from a street table to an official container shop at Circle or Makola.',
    dialogue: { speaker: 'Welder Kojo', text: 'Glass sliding doors, ceiling fan, and painted blue. Your shop is looking executive!' },
    action: 'enterprise', target: 'enterprise', hint: 'Have at least 1 registered business operation',
    reward: { cash: 600, xp: 60, badge: 'Shop Owner' },
    check: (s) => Object.keys(s.biz || {}).length >= 1 || (s.cash + s.momo >= 3000)
  },
  mogul_3_2: {
    id: 'mogul_3_2', dream: 'mogul', chapter: 3, step: 2,
    title: 'The High-Float MoMo Till',
    desc: 'Set up an active mobile money merchant till handling steady deposits.',
    dialogue: { speaker: 'MTN Agent Supervisor', text: 'Your transaction volume qualifies you for premier merchant merchant float!' },
    action: 'momo', target: 'momo', hint: 'Send or receive money transfers',
    reward: { cash: 750, xp: 75 },
    check: (s) => (s.momo || 0) >= 2000 || (s.cnt && s.cnt.sent >= 1)
  },
  mogul_3_3: {
    id: 'mogul_3_3', dream: 'mogul', chapter: 3, step: 3,
    title: 'GH₵5,000 Operating Profit',
    desc: 'Reach GH₵5,000 in accumulated business profits or trade volume.',
    dialogue: { speaker: 'Accountant Mensah', text: 'Your margins are strong. We can comfortably afford a second location.' },
    action: 'enterprise', target: 'enterprise', hint: 'Grow business profits or savings balance',
    reward: { cash: 1000, xp: 100, badge: 'Profit Maker' },
    check: (s) => (s.life?.business?.profit || 0) >= 100 || (s.cash + s.momo >= 5000)
  },
  mogul_3_4: {
    id: 'mogul_3_4', dream: 'mogul', chapter: 3, step: 4, isClimax: true,
    title: 'Climax: The GRA Tax Audit Surprise',
    desc: 'Revenue authority inspectors arrive unannounced with clipboards asking for VAT records.',
    encounterId: 'enc_mogul_c3',
    action: 'story_event', hint: 'Handle the revenue authority audit',
    reward: { cash: 1200, xp: 120, rep: 4, badge: 'Audited & Clean' },
    check: (s) => (s.story?.completedEncounters || []).includes('enc_mogul_c3')
  },

  // Chapter 4: Tema Port Clearance
  mogul_4_1: {
    id: 'mogul_4_1', dream: 'mogul', chapter: 4, step: 1,
    title: 'The Sea Freight Consignment',
    desc: 'Import an entire 40ft shipping container of consumer electronics and fashion.',
    dialogue: { speaker: 'Clearing Agent Dan', text: 'Ship has docked at Tema Port! The container has arrived from Dubai.' },
    action: 'enterprise', target: 'enterprise', hint: 'Operate 2+ businesses or hold GH₵10,000 capital',
    reward: { cash: 1200, xp: 120 },
    check: (s) => Object.keys(s.biz || {}).length >= 2 || (s.cash + s.momo >= 10000)
  },
  mogul_4_2: {
    id: 'mogul_4_2', dream: 'mogul', chapter: 4, step: 2,
    title: 'Wholesale Distribution Network',
    desc: 'Distribute imported stock to boutique shops and supermarkets across Accra.',
    dialogue: { speaker: 'Osu Supermarket Buyer', text: 'We will take 20 cartons of every item. Deliver by Friday morning!' },
    action: 'market', target: 'market', hint: 'Complete trades or business sales',
    reward: { cash: 1500, xp: 150, badge: 'Wholesale Distributor' },
    check: (s) => (s.life?.business?.sales || 0) >= 1 || (s.cash + s.momo >= 15000)
  },
  mogul_4_3: {
    id: 'mogul_4_3', dream: 'mogul', chapter: 4, step: 3,
    title: 'Quarter-Million Commercial Valuation',
    desc: 'Expand total business assets and liquid cash beyond the quarter-million mark.',
    dialogue: { speaker: 'Commercial Banker', text: 'You are now one of the major commercial suppliers in Greater Accra.' },
    action: 'bank', target: 'bank', hint: 'Accumulate significant wealth and assets',
    reward: { cash: 2000, xp: 200 },
    check: (s) => (s.cash + s.momo >= 25000) || Object.keys(s.biz || {}).length >= 3
  },
  mogul_4_4: {
    id: 'mogul_4_4', dream: 'mogul', chapter: 4, step: 4, isClimax: true,
    title: 'Climax: The Tema Port Demurrage Stand-off',
    desc: 'A corrupt port inspector holds your container hostage demanding unexpected demurrage fines.',
    encounterId: 'enc_mogul_c4',
    action: 'story_event', hint: 'Clear the shipping container',
    reward: { cash: 2500, xp: 250, rep: 6, badge: 'Port Master' },
    check: (s) => (s.story?.completedEncounters || []).includes('enc_mogul_c4')
  },

  // Chapter 5: The Conglomerate Chairman
  mogul_5_1: {
    id: 'mogul_5_1', dream: 'mogul', chapter: 5, step: 1,
    title: 'Nightclub & Hospitality Equity',
    desc: 'Acquire equity in a premier nightlife club or luxury hotel in Osu.',
    dialogue: { speaker: 'Managing Partner', text: 'Welcome to the boardroom. Your share of Friday night door takings will be sent straight to MoMo.' },
    action: 'enterprise', target: 'enterprise', hint: 'Own a share of a club or operate 3+ businesses',
    reward: { cash: 3000, xp: 300, badge: 'Nightlife Partner' },
    check: (s) => !!s.biz?.club || Object.keys(s.biz || {}).length >= 3 || (s.cash + s.momo >= 50000)
  },
  mogul_5_2: {
    id: 'mogul_5_2', dream: 'mogul', chapter: 5, step: 2,
    title: 'GH₵100,000 Business Takings',
    desc: 'Reach over GH₵50,000 in recorded enterprise revenue across Accra operations.',
    dialogue: { speaker: 'Financial Auditor', text: 'A clean, high-velocity trading empire. You have outpaced the competition.' },
    action: 'status', target: 'status', hint: 'Maintain high enterprise revenue',
    reward: { cash: 5000, xp: 500, badge: 'Titan of Industry' },
    check: (s) => (s.cash + s.momo >= 75000) || (s.life?.business?.profit || 0) >= 1000
  },
  mogul_5_3: {
    id: 'mogul_5_3', dream: 'mogul', chapter: 5, step: 3,
    title: 'The Commercial Empire Fleet',
    desc: 'Control a multi-vehicle logistics fleet and premium real estate assets.',
    dialogue: { speaker: 'Fleet Operations Lead', text: '10 vehicles on the road, 3 warehouses stocked, 50 employees paid on time.' },
    action: 'cars', target: 'cars', hint: 'Own high-end vehicles or premium home',
    reward: { cash: 7500, xp: 750 },
    check: (s) => !!s.car || ['airres', 'legon', 'trasacco'].includes(s.home) || (s.cash + s.momo >= 100000)
  },
  mogul_5_4: {
    id: 'mogul_5_4', dream: 'mogul', chapter: 5, step: 4, isClimax: true,
    title: 'Grand Finale: Election as Chamber President',
    desc: 'The Association of Ghana Industries and Makola Traders elect you as President of the Chamber of Commerce.',
    encounterId: 'enc_mogul_c5',
    action: 'story_event', hint: 'Accept the presidential gavel',
    reward: { cash: 15000, xp: 1500, rep: 12, badge: 'Emperor of Makola' },
    check: (s) => (s.story?.completedEncounters || []).includes('enc_mogul_c5')
  },

  // =========================================================================
  // OSU TECH FOUNDER
  // =========================================================================
  unicorn_1_1: {
    id: 'unicorn_1_1', dream: 'unicorn', chapter: 1, step: 1,
    title: 'The Coffee & Late Night Code',
    desc: 'Grind coding skill to level 2+ at home or at the tech hub.',
    dialogue: { speaker: 'Co-founder Kwabena', text: 'The MoMo payment gateway documentation has three broken links. Drink your Milo and let\'s debug!' },
    action: 'status', target: 'status', hint: 'Train coding skill to level 2',
    reward: { cash: 100, xp: 20 },
    check: (s) => (s.skills.coding || 0) >= 1 || (s.cnt && (s.cnt['act:code'] || 0) >= 1)
  },
  unicorn_1_2: {
    id: 'unicorn_1_2', dream: 'unicorn', chapter: 1, step: 2,
    title: 'The Osu Tech Cafe Standup',
    desc: 'Visit Oxford Street in Osu and work a freelance dev, coffee gig, or tech collaboration to earn your first GH₵50.',
    dialogue: { speaker: 'UI/UX Designer Akua', text: 'Our wireframes are clean! If we build this right, every trotro passenger will use it.' },
    action: 'explore', target: 'oxford', hint: 'Visit Oxford Street Osu and complete a freelance gig or coding collaboration',
    reward: { cash: 150, xp: 25 },
    check: (s, c) => s.place === 'oxford' && ((s.stats?.gigs || 0) >= 1 || (s.gd?.earned || 0) >= 50 || (s.cnt && ((s.cnt['act:freelance'] || 0) + (s.cnt['act:code'] || 0) + (s.cnt.social || 0)) >= 1))
  },
  unicorn_1_3: {
    id: 'unicorn_1_3', dream: 'unicorn', chapter: 1, step: 3,
    title: 'Building the Working MVP',
    desc: 'Build your prototype MVP to at least 50% at the hub or home computer.',
    dialogue: { speaker: 'Lead Architect', text: 'Core database migrations are passing! We have a real product now.' },
    action: 'jobs', target: 'jobs', hint: 'Work on MVP or raise coding skill to 3',
    reward: { cash: 200, xp: 30, badge: 'Code Slinger' },
    check: (s) => (s.flags.mvp || 0) >= 20 || (s.skills.coding || 0) >= 2
  },
  unicorn_1_4: {
    id: 'unicorn_1_4', dream: 'unicorn', chapter: 1, step: 4, isClimax: true,
    title: 'Climax: The Demo Day Server Crash',
    desc: 'Ten minutes before pitching to tech angel investors, the test server runs out of memory.',
    encounterId: 'enc_unicorn_c1',
    action: 'story_event', hint: 'Hotfix the server crash',
    reward: { cash: 350, xp: 50, rep: 2, badge: 'Hotfix Hero' },
    check: (s) => (s.story?.completedEncounters || []).includes('enc_unicorn_c1')
  },

  // Chapter 2: The Seed Pitch Deck
  unicorn_2_1: {
    id: 'unicorn_2_1', dream: 'unicorn', chapter: 2, step: 1,
    title: 'Polishing the Deck & Charisma',
    desc: 'Investors don\'t just fund code; they fund founders. Level Charisma or Coding to 3+.',
    dialogue: { speaker: 'Venture Scout', text: 'Cut 10 slides from the deck. Tell them how much money they will make in year two!' },
    action: 'status', target: 'status', hint: 'Raise Charisma or Coding skill',
    reward: { cash: 250, xp: 35 },
    check: (s) => (s.skills.charisma || 0) >= 2 || (s.skills.coding || 0) >= 3
  },
  unicorn_2_2: {
    id: 'unicorn_2_2', dream: 'unicorn', chapter: 2, step: 2,
    title: 'The Airport Residential Angel Boardroom',
    desc: 'Present your fintech deck inside an executive suite in Airport Residential. Dine with investors or pitch your prototype.',
    dialogue: { speaker: 'Angel Investor Boateng', text: 'Your customer acquisition cost is low, and your MoMo conversion is high. I like this.' },
    action: 'explore', target: 'airres', hint: 'Visit Airport Residential with MVP 30%+ or dine with angel investors',
    reward: { cash: 350, xp: 45 },
    check: (s, c) => s.place === 'airres' && ((s.flags?.mvp || 0) >= 30 || (s.stats?.meals || 0) >= 1 || (s.cnt && (s.cnt.social || 0) >= 2) || (s.gd?.earned || 0) >= 100)
  },
  unicorn_2_3: {
    id: 'unicorn_2_3', dream: 'unicorn', chapter: 2, step: 3,
    title: 'Closing the Pre-Seed Round',
    desc: 'Secure pre-seed financing and deposit investment capital into corporate accounts.',
    dialogue: { speaker: 'Legal Counsel', text: 'Safe agreement executed. The wire transfer has cleared into your corporate account!' },
    action: 'bank', target: 'bank', hint: 'Raise pre-seed round or have GH₵2,500 funds',
    reward: { cash: 500, xp: 60, badge: 'Funded Founder' },
    check: (s) => (s.flags.round || 0) >= 1 || (s.cash + s.momo >= 2500)
  },
  unicorn_2_4: {
    id: 'unicorn_2_4', dream: 'unicorn', chapter: 2, step: 4, isClimax: true,
    title: 'Climax: The Shark Investor Term Sheet',
    desc: 'An aggressive investor offers GH₵50,000 but demands 45% of the company and voting control.',
    encounterId: 'enc_unicorn_c2',
    action: 'story_event', hint: 'Negotiate the term sheet',
    reward: { cash: 700, xp: 90, rep: 3, badge: 'Savvy Negotiator' },
    check: (s) => (s.story?.completedEncounters || []).includes('enc_unicorn_c2')
  },

  // Chapter 3: Dumsor & Server Meltdown
  unicorn_3_1: {
    id: 'unicorn_3_1', dream: 'unicorn', chapter: 3, step: 1,
    title: 'Handling 10,000 Live Virtual Users',
    desc: 'Your app goes viral on Ghanaian Twitter. Optimize server queries and expand database pool.',
    dialogue: { speaker: 'DevOps Engineer', text: 'CPU usage is at 94%! Switch on Redis caching or the whole city will get 502 errors!' },
    action: 'status', target: 'status', hint: 'Raise Coding skill to 4+',
    reward: { cash: 500, xp: 55 },
    check: (s) => (s.skills.coding || 0) >= 4 || (s.skills.tech || 0) >= 2
  },
  unicorn_3_2: {
    id: 'unicorn_3_2', dream: 'unicorn', chapter: 3, step: 2,
    title: 'Solar & Inverter Disaster Recovery',
    desc: 'ECG cuts electricity across Osu for 12 hours. Install battery backup or work from a resilient estate.',
    dialogue: { speaker: 'Solar Technician', text: 'Pure sine wave inverter with lithium batteries. Even if Accra turns pitch black, your servers stay online!' },
    action: 'shop', target: 'shop', hint: 'Buy solar/gen or move to estate power home',
    reward: { cash: 600, xp: 65, badge: 'Zero Downtime' },
    check: (s) => !!s.items?.solar || !!s.items?.gen || ['osu', 'airres', 'trasacco'].includes(s.home)
  },
  unicorn_3_3: {
    id: 'unicorn_3_3', dream: 'unicorn', chapter: 3, step: 3,
    title: 'The Counter-Poaching Fight',
    desc: 'A Silicon Valley multinational tries to poach your lead backend engineer with foreign currency.',
    dialogue: { speaker: 'Lead Engineer Kofi', text: 'They offered me remote dollars... but I believe in what we are building right here in Accra!' },
    action: 'relationships', target: 'relationships', hint: 'Build close relationships or raise employee happiness',
    reward: { cash: 750, xp: 80 },
    check: (s) => Object.keys(s.friends || {}).length >= 1 || (s.rep || 0) >= 5
  },
  unicorn_3_4: {
    id: 'unicorn_3_4', dream: 'unicorn', chapter: 3, step: 4, isClimax: true,
    title: 'Climax: The Zero-Day Exploit Attempt',
    desc: 'Russian bots attempt an automated brute-force attack on your user MoMo wallet endpoints.',
    encounterId: 'enc_unicorn_c3',
    action: 'story_event', hint: 'Defend the wallet gateway',
    reward: { cash: 1000, xp: 120, rep: 4, badge: 'Cyber Shield' },
    check: (s) => (s.story?.completedEncounters || []).includes('enc_unicorn_c3')
  },

  // Chapter 4: Scaling the FinTech Platform
  unicorn_4_1: {
    id: 'unicorn_4_1', dream: 'unicorn', chapter: 4, step: 1,
    title: 'Bank of Ghana Regulatory Approval',
    desc: 'Present your platform to financial regulators and secure full compliance authorization.',
    dialogue: { speaker: 'BoG Chief Inspector', text: 'Your anti-fraud models and reserves meet all central bank requirements. License granted.' },
    action: 'bank', target: 'bank', hint: 'Have clean financial record and active savings',
    reward: { cash: 1000, xp: 100, badge: 'Licensed FinTech' },
    check: (s) => (s.momo || 0) >= 3000 || (s.cash + s.momo >= 6000)
  },
  unicorn_4_2: {
    id: 'unicorn_4_2', dream: 'unicorn', chapter: 4, step: 2,
    title: 'Closing the Series A Funding Round',
    desc: 'Raise Series A funding from international venture capital syndicates.',
    dialogue: { speaker: 'Partner at Partech Africa', text: 'We are leading your round with \$3M. It\'s time to expand across the continent!' },
    action: 'bank', target: 'bank', hint: 'Raise Seed or Series A round in Tech Hub',
    reward: { cash: 2000, xp: 200, badge: 'Series A Founder' },
    check: (s) => (s.flags.round || 0) >= 2 || (s.cash + s.momo >= 15000)
  },
  unicorn_4_3: {
    id: 'unicorn_4_3', dream: 'unicorn', chapter: 4, step: 3,
    title: 'The Pan-African Payment Corridor',
    desc: 'Process cross-border payments between Accra, Lagos, Nairobi, and London.',
    dialogue: { speaker: 'VP of Growth', text: 'Transactions are firing every millisecond. We are moving billions of Cedis monthly!' },
    action: 'momo', target: 'momo', hint: 'Complete high-volume transactions',
    reward: { cash: 3000, xp: 300 },
    check: (s) => (s.cash + s.momo >= 25000) || (s.skills.coding || 0) >= 7
  },
  unicorn_4_4: {
    id: 'unicorn_4_4', dream: 'unicorn', chapter: 4, step: 4, isClimax: true,
    title: 'Climax: The \$50M Acquisition Buyout Offer',
    desc: 'A Silicon Valley tech conglomerate flies in to offer a \$50M full cash acquisition buyout.',
    encounterId: 'enc_unicorn_c4',
    action: 'story_event', hint: 'Decide the fate of the company',
    reward: { cash: 4000, xp: 400, rep: 6, badge: 'Visionary' },
    check: (s) => (s.story?.completedEncounters || []).includes('enc_unicorn_c4')
  },

  // Chapter 5: The Accra Unicorn
  unicorn_5_1: {
    id: 'unicorn_5_1', dream: 'unicorn', chapter: 5, step: 1,
    title: 'The Cantonments Glass Tech Campus',
    desc: 'Move your headquarters into an iconic glass campus in Cantonments with rooftop helipad.',
    dialogue: { speaker: 'Head of People', text: 'Barista bar, sleep pods, and 500 brilliant minds building the future of Africa!' },
    action: 'explore', target: 'trasacco', hint: 'Visit high-end districts or own luxury estate',
    reward: { cash: 5000, xp: 500 },
    check: (s) => ['airres', 'legon', 'trasacco'].includes(s.home) || (s.cash + s.momo >= 50000)
  },
  unicorn_5_2: {
    id: 'unicorn_5_2', dream: 'unicorn', chapter: 5, step: 2,
    title: 'Tech Visionary Level 10',
    desc: 'Max out Coding skill to level 10 and cement your legacy as an engineering icon.',
    dialogue: { speaker: 'MIT Tech Review', text: 'How a coder in Accra rewrote the financial infrastructure of an entire continent.' },
    action: 'status', target: 'status', hint: 'Reach top skill rank in Coding',
    reward: { cash: 7500, xp: 750, badge: 'Tech Titan' },
    check: (s) => (s.skills.coding || 0) >= 8 || (s.rep || 0) >= 25
  },
  unicorn_5_3: {
    id: 'unicorn_5_3', dream: 'unicorn', chapter: 5, step: 3,
    title: 'The \$100M+ Unicorn Valuation',
    desc: 'Official announcement: your venture is crowned the first homegrown Unicorn in Ghana!',
    dialogue: { speaker: 'TechCrunch Headline', text: 'ACCRA WE DEY: Ghana\'s Newest Tech Unicorn Breaks Records!' },
    action: 'status', target: 'status', hint: 'Achieve unicorn valuation and wealth',
    reward: { cash: 10000, xp: 1000, badge: 'Accra Unicorn' },
    check: (s) => (s.flags.round || 0) >= 3 || (s.cash + s.momo >= 75000)
  },
  unicorn_5_4: {
    id: 'unicorn_5_4', dream: 'unicorn', chapter: 5, step: 4, isClimax: true,
    title: 'Grand Finale: Keynote at Africa Tech Summit',
    desc: 'Take the stage at the Accra International Conference Centre to deliver the keynote address to world leaders.',
    encounterId: 'enc_unicorn_c5',
    action: 'story_event', hint: 'Deliver your inspiring keynote address',
    reward: { cash: 15000, xp: 1500, rep: 12, badge: 'Godfather of Silicon Accra' },
    check: (s) => (s.story?.completedEncounters || []).includes('enc_unicorn_c5')
  },

  // =========================================================================
  // HIGH SOCIETY BORGA
  // =========================================================================
  bigman_1_1: {
    id: 'bigman_1_1', dream: 'bigman', chapter: 1, step: 1,
    title: 'Kotoka International Airport Arrival',
    desc: 'Survive the airport protocol gauntlet and step out into the tropical Accra humidity. Tip the luggage attendants, socialize, or take a private ride.',
    dialogue: { speaker: 'Protocol Boy', text: 'Welcome home Boss! Anything for the boys? God bless your hustle!' },
    action: 'explore', target: 'airres', hint: 'Visit Airport Residential and take transport or chat with locals',
    reward: { cash: 100, xp: 20 },
    check: (s, c) => s.place === 'airres' && (Object.keys(s.cnt || {}).some(k => k.startsWith('travel:') && s.cnt[k] > 0) || (s.cnt && (s.cnt.social || 0) >= 1) || (s.stats?.meals || 0) >= 1)
  },
  bigman_1_2: {
    id: 'bigman_1_2', dream: 'bigman', chapter: 1, step: 2,
    title: 'Forex Bureau Cash-Out',
    desc: 'Exchange foreign currency into crisp Ghana Cedis at a reputable forex counter.',
    dialogue: { speaker: 'Forex Bureau Cashier', text: 'Here are crisp new 200 Cedi notes. Mind the street pickpockets outside!' },
    action: 'bank', target: 'bank', hint: 'Have at least GH₵500 in pocket cash or bank',
    reward: { cash: 150, xp: 25 },
    check: (s) => (s.cash + s.momo >= 500)
  },
  bigman_1_3: {
    id: 'bigman_1_3', dream: 'bigman', chapter: 1, step: 3,
    title: 'Custom Tailored Kente Attire',
    desc: 'Visit an Osu boutique tailor to commission authentic bespoke Kente attire.',
    dialogue: { speaker: 'Master Tailor Mensah', text: 'A real Borga doesn\'t wear airport jeans to church! Hand-woven Bonwire Kente for you!' },
    action: 'boutique', target: 'boutique', hint: 'Change outfit or update wardrobe look',
    reward: { cash: 200, xp: 30, badge: 'Tailored Drip' },
    check: (s) => (s.cnt && s.cnt.outfit > 0) || !!s.wardrobe?.kente || (s.cash + s.momo >= 1000)
  },
  bigman_1_4: {
    id: 'bigman_1_4', dream: 'bigman', chapter: 1, step: 4, isClimax: true,
    title: 'Climax: The Fake Estate Agent Scam',
    desc: 'A stylish agent in sunglasses tries to rent you a luxury apartment using forged keys.',
    encounterId: 'enc_bigman_c1',
    action: 'story_event', hint: 'Spot the rental fraud',
    reward: { cash: 350, xp: 50, rep: 2, badge: 'Street Smart Borga' },
    check: (s) => (s.story?.completedEncounters || []).includes('enc_bigman_c1')
  },

  // Chapter 2: The Black Tax Council
  bigman_2_1: {
    id: 'bigman_2_1', dream: 'bigman', chapter: 2, step: 1,
    title: 'The Family Compound Pilgrimage',
    desc: 'Visit the ancestral family compound in Jamestown or Nima to greet the elders. Share a meal with elders or make a family donation.',
    dialogue: { speaker: 'Elder Auntie', text: 'Our son has returned! Look how fat and handsome you have become! Praise God!' },
    action: 'explore', target: 'jtown', hint: 'Visit Jamestown or Nima and eat a meal, socialize, or donate',
    reward: { cash: 250, xp: 35 },
    check: (s, c) => ['jtown', 'nima'].includes(s.place) && ((s.stats?.meals || 0) >= 1 || (s.cnt && (s.cnt.social || 0) >= 1) || (s.cnt && (s.cnt.donate || 0) >= 20))
  },
  bigman_2_2: {
    id: 'bigman_2_2', dream: 'bigman', chapter: 2, step: 2,
    title: 'Emergency School Fees Relief',
    desc: 'Send MoMo remittances to help nephews and nieces with their school supplies.',
    dialogue: { speaker: 'Niece Abena', text: 'Thank you Uncle! I can write my exams now. God bless your pockets!' },
    action: 'momo', target: 'momo', hint: 'Send a MoMo transfer or donate to community',
    reward: { cash: 300, xp: 45, badge: 'Family Pillar' },
    check: (s) => (s.cnt && (s.cnt.sent || 0) >= 1) || (s.cnt && s.cnt.donate >= 50)
  },
  bigman_2_3: {
    id: 'bigman_2_3', dream: 'bigman', chapter: 2, step: 3,
    title: 'Sunday Harvest Thanksgiving',
    desc: 'Attend Sunday church or Friday prayers in pristine white lace attire.',
    dialogue: { speaker: 'Pastor Emmanuel', text: 'Let us welcome our beloved brother from abroad! Come forward with your thanksgiving offering!' },
    action: 'explore', target: 'oxford', hint: 'Visit Osu or church/mosque location',
    reward: { cash: 400, xp: 55 },
    check: (s) => (s.cnt && (s.cnt['loc:church'] || s.cnt['loc:mosque'] || 0) >= 1) || (s.rep || 0) >= 5
  },
  bigman_2_4: {
    id: 'bigman_2_4', dream: 'bigman', chapter: 2, step: 4, isClimax: true,
    title: 'Climax: The Entitled Uncle\'s Demands',
    desc: 'Your uncle convenes a family meeting demanding GH₵5,000 for a dubious gold business scheme.',
    encounterId: 'enc_bigman_c2',
    action: 'story_event', hint: 'Handle the family black tax meeting',
    reward: { cash: 600, xp: 80, rep: 3, badge: 'Wise Elder' },
    check: (s) => (s.story?.completedEncounters || []).includes('enc_bigman_c2')
  },

  // Chapter 3: The Prado & Highway Checkpoints
  bigman_3_1: {
    id: 'bigman_3_1', dream: 'bigman', chapter: 3, step: 1,
    title: 'The Land Cruiser Acquisition',
    desc: 'Visit Correct Cars on Spintex Road to test drive a Toyota Land Cruiser Prado.',
    dialogue: { speaker: 'Correct Cars Dealer', text: 'Tinted windows, clean leather, and horn that clears trotros off the road. The official vehicle of Big Men!' },
    action: 'cars', target: 'cars', hint: 'Inspect cars at Correct Cars or own a car',
    reward: { cash: 500, xp: 60 },
    check: (s) => !!s.car || !!s.rental || (s.cash + s.momo >= 5000)
  },
  bigman_3_2: {
    id: 'bigman_3_2', dream: 'bigman', chapter: 3, step: 2,
    title: 'Front Entrance Valet at Bloombar',
    desc: 'Roll up to the hottest lounge in Osu. The bouncers part the velvet ropes for you as you command the VIP lounge.',
    dialogue: { speaker: 'VIP Security Bouncer', text: 'Right this way Boss! Table 1 is reserved for the Big Man of Accra!' },
    action: 'explore', target: 'vibes', hint: 'Visit Vibes Lounge with Reputation 10+ or party in the VIP section',
    reward: { cash: 700, xp: 80, badge: 'VIP Reverence' },
    check: (s, c) => s.place === 'vibes' && ((s.rep || 0) >= 10 || (s.cnt && (s.cnt['act:club'] || s.cnt['act:party'] || 0) >= 1) || (s.stats?.meals || 0) >= 2)
  },
  bigman_3_3: {
    id: 'bigman_3_3', dream: 'bigman', chapter: 3, step: 3,
    title: 'Reputation Level 15 (Respected Citizen)',
    desc: 'Build your reputation through public generosity, career prominence, and clean business.',
    dialogue: { speaker: 'Assembly Member', text: 'Whenever you speak in town, people stop and listen. That is true influence.' },
    action: 'status', target: 'status', hint: 'Reach Reputation of 15+',
    reward: { cash: 1000, xp: 100 },
    check: (s) => (s.rep || 0) >= 12 || (s.stats.promos || 0) >= 1
  },
  bigman_3_4: {
    id: 'bigman_3_4', dream: 'bigman', chapter: 3, step: 4, isClimax: true,
    title: 'Climax: The Highway Checkpoint Shake-Down',
    desc: 'A late-night police checkpoint at 37 Military Hospital spots your tinted Prado.',
    encounterId: 'enc_bigman_c3',
    action: 'story_event', hint: 'Handle the highway checkpoint',
    reward: { cash: 1200, xp: 120, rep: 4, badge: 'Untouchable Citizen' },
    check: (s) => (s.story?.completedEncounters || []).includes('enc_bigman_c3')
  },

  // Chapter 4: The Cantonments Charity Gala
  bigman_4_1: {
    id: 'bigman_4_1', dream: 'bigman', chapter: 4, step: 1,
    title: 'Hosting the Diaspora Gala Dinner',
    desc: 'Host a formal gathering at Labadi Beach Hotel for diaspora investors and civic leaders. Dine and network with prominent guests.',
    dialogue: { speaker: 'Master of Ceremonies', text: 'Distinguished ladies and gentlemen, welcome to an evening of Ghanaian prestige!' },
    action: 'explore', target: 'labadi', hint: 'Visit Labadi Beach and dine or network with Reputation 15+',
    reward: { cash: 1500, xp: 150 },
    check: (s, c) => s.place === 'labadi' && ((s.stats?.meals || 0) >= 3 || (s.cnt && (s.cnt.social || 0) >= 3) || (s.rep || 0) >= 15)
  },
  bigman_4_2: {
    id: 'bigman_4_2', dream: 'bigman', chapter: 4, step: 2,
    title: 'Clean Water Community Donation',
    desc: 'Donate to a clean borehole or youth clinic community development project.',
    dialogue: { speaker: 'Youth Association Chairman', text: 'Because of your generosity, 500 children have clean water today. God bless you!' },
    action: 'phone', target: 'civic', hint: 'Donate to community development fund',
    reward: { cash: 2000, xp: 200, badge: 'Civic Benefactor' },
    check: (s) => (s.cnt && (s.cnt.donate || 0) >= 200) || (s.rep || 0) >= 20
  },
  bigman_4_3: {
    id: 'bigman_4_3', dream: 'bigman', chapter: 4, step: 3,
    title: 'Corporate Executive Governance',
    desc: 'Reach rank 3+ in a career or serve on prominent corporate boards.',
    dialogue: { speaker: 'Board Secretary', text: 'Your executive guidance has doubled our firm\'s market trust.' },
    action: 'jobs', target: 'jobs', hint: 'Reach career promotion rank or high reputation',
    reward: { cash: 2500, xp: 250 },
    check: (s) => (s.job && s.job.rank >= 2) || (s.rep || 0) >= 25 || (s.cash + s.momo >= 30000)
  },
  bigman_4_4: {
    id: 'bigman_4_4', dream: 'bigman', chapter: 4, step: 4, isClimax: true,
    title: 'Climax: The Developmental Chieftaincy Stool',
    desc: 'The traditional council of elders arrives in full regalia to offer you an honorary Chieftaincy title.',
    encounterId: 'enc_bigman_c4',
    action: 'story_event', hint: 'Accept the traditional stool title',
    reward: { cash: 3500, xp: 350, rep: 6, badge: 'Chief of Development' },
    check: (s) => (s.story?.completedEncounters || []).includes('enc_bigman_c4')
  },

  // Chapter 5: The Untouchable Pillar
  bigman_5_1: {
    id: 'bigman_5_1', dream: 'bigman', chapter: 5, step: 1,
    title: 'The Cantonments Gated Mansion',
    desc: 'Move into a luxury mansion in Cantonments or Airport Residential.',
    dialogue: { speaker: 'Estate Security Chief', text: 'Access perimeter secured, Chairman. Only dignitaries on the manifest are admitted.' },
    action: 'houses', target: 'houses', hint: 'Live in Airport Residential, East Legon, or Trasacco',
    reward: { cash: 4000, xp: 400 },
    check: (s) => ['airres', 'legon', 'trasacco'].includes(s.home) || (s.cash + s.momo >= 60000)
  },
  bigman_5_2: {
    id: 'bigman_5_2', dream: 'bigman', chapter: 5, step: 2,
    title: 'City-Wide Reverence (Reputation 40+)',
    desc: 'Command the highest respect in Greater Accra.',
    dialogue: { speaker: 'State Protocol Officer', text: 'When you walk into any room in Ghana, chairs are offered and heads are bowed.' },
    action: 'status', target: 'status', hint: 'Reach Reputation 35+',
    reward: { cash: 6000, xp: 600, badge: 'Elder Statesman' },
    check: (s) => (s.rep || 0) >= 30 || (s.cash + s.momo >= 80000)
  },
  bigman_5_3: {
    id: 'bigman_5_3', dream: 'bigman', chapter: 5, step: 3,
    title: 'The Endowed Legacy Foundation',
    desc: 'Endow a permanent foundation providing scholarships to brilliant but needy Accra youth.',
    dialogue: { speaker: 'Scholarship Recipient', text: 'Because of your scholarship, I am studying medicine at UG Legon. I will make you proud, Chairman!' },
    action: 'status', target: 'status', hint: 'Hold high savings and donate to foundation',
    reward: { cash: 8000, xp: 800, badge: 'Pillar of Ghana' },
    check: (s) => (s.cash + s.momo >= 100000) || (s.rep || 0) >= 40
  },
  bigman_5_4: {
    id: 'bigman_5_4', dream: 'bigman', chapter: 5, step: 4, isClimax: true,
    title: 'Grand Finale: The State House Honors',
    desc: 'Conferred national honors at the State House as an icon of Ghanaian achievement and character.',
    encounterId: 'enc_bigman_c5',
    action: 'story_event', hint: 'Receive your national honor',
    reward: { cash: 20000, xp: 2000, rep: 15, badge: 'Order of the Volta' },
    check: (s) => (s.story?.completedEncounters || []).includes('enc_bigman_c5')
  },

  // =========================================================================
  // DBEE ORIGIN BRANCHES (Chapters 1 & 2 for High-Born Players)
  // =========================================================================

  // --- Landlord Dbee: Chapter 1 (The Family Estate Trust) ---
  landlord_dbee_1_1: {
    id: 'landlord_dbee_1_1', dream: 'landlord', chapter: 1, step: 1,
    title: 'Audit the Airport Residential Estate',
    desc: 'Your family has entrusted you with oversight of a luxury 4-unit serviced complex in Airport Residential. Inspect the property and review the maintenance log.',
    dialogue: { speaker: 'Uncle Ekow (Trustee)', text: 'Don\'t think being born with a silver spoon means money manages itself. Go down to the Airport flats and audit every cedi!' },
    action: 'home', target: 'home', hint: 'Visit your home or Airport Residential area to inspect property records',
    reward: { cash: 200, xp: 25, badge: 'Estate Trustee' },
    check: (s, c) => c.at === 'home' || s.place === 'home' || ['airres', 'osu', 'legon', 'trasacco'].includes(s.place) || (s.discovery?.visited && (s.discovery.visited.airres || s.discovery.visited.home))
  },
  landlord_dbee_1_2: {
    id: 'landlord_dbee_1_2', dream: 'landlord', chapter: 1, step: 2,
    title: 'Contractor Facility Negotiations',
    desc: 'Head to Osu or East Legon to negotiate maintenance and solar contracts for the estate tenants. Consult with contractors or complete a commercial transaction.',
    dialogue: { speaker: 'Solar Facility Manager', text: 'European tenants will not tolerate even 2 minutes of Dumsor. Let us quote a 15kVA lithium backup system.' },
    action: 'explore', target: 'oxford', hint: 'Visit Osu or Hub/Makola and consult contractors or complete a gig',
    reward: { cash: 250, xp: 30 },
    check: (s, c) => ['oxford', 'hub', 'makola'].includes(s.place) && ((s.cnt && (s.cnt.social || 0) >= 1) || (s.stats?.gigs || 0) >= 1 || (s.gd?.earned || 0) >= 60)
  },
  landlord_dbee_1_3: {
    id: 'landlord_dbee_1_3', dream: 'landlord', chapter: 1, step: 3,
    title: 'The Escrow Reserve Sinking Fund',
    desc: 'A real estate portfolio requires liquidity. Ensure your liquid reserves (cash, MoMo, or fixed deposit) exceed GH₵1,500.',
    dialogue: { speaker: 'Private Banker Cynthia', text: 'Estate maintenance and tax clearance require liquid reserves. Never leave your escrow dry.' },
    action: 'bank', target: 'bank', hint: 'Hold at least GH₵1,500 in total liquid assets (cash + MoMo)',
    reward: { cash: 350, xp: 35, badge: 'Escrow Manager' },
    check: (s) => (s.cash + s.momo >= 1500) || (s.flags.fixed?.amount || 0) >= 1000
  },
  landlord_dbee_1_4: {
    id: 'landlord_dbee_1_4', dream: 'landlord', chapter: 1, step: 4, isClimax: true,
    title: 'Climax: The Expat Diplomatic Tenant Dispute',
    desc: 'An embassy attache leasing Unit 3 complains about an inverter dip and threatens diplomatic lease termination.',
    encounterId: 'enc_dbee_landlord_c1',
    action: 'story_event', hint: 'Resolve the diplomatic tenant dispute',
    reward: { cash: 500, xp: 60, rep: 3, badge: 'Diplomatic Landlord' },
    check: (s) => (s.story?.completedEncounters || []).includes('enc_dbee_landlord_c1')
  },

  // --- Landlord Dbee: Chapter 2 (Commercial Portfolio Expansion) ---
  landlord_dbee_2_1: {
    id: 'landlord_dbee_2_1', dream: 'landlord', chapter: 2, step: 1,
    title: 'Scouting Cantonments & East Legon Parcels',
    desc: 'Deploy your estate seed capital into prime real estate. Survey the elite corridors of Cantonments and East Legon with verified liquid wealth or fine dining.',
    dialogue: { speaker: 'Senior Broker Addo', text: 'Cantonments is where diplomats and oil execs pay in hard dollars. Half an acre here out-earns a factory in Tema!' },
    action: 'explore', target: 'oxford', hint: 'Travel through prime districts with liquid funds >= GH₵2,000 or dining',
    reward: { cash: 400, xp: 45 },
    check: (s, c) => ['trasacco', 'legon', 'oxford'].includes(s.place) && ((s.cash + s.momo >= 2000) || (s.stats?.meals || 0) >= 2 || (s.cnt && (s.cnt.social || 0) >= 2))
  },
  landlord_dbee_2_2: {
    id: 'landlord_dbee_2_2', dream: 'landlord', chapter: 2, step: 2,
    title: 'Lands Commission Title Due Diligence',
    desc: 'Check the official property deeds on your phone to review available luxury plots and titles.',
    dialogue: { speaker: 'State Attorney Nana', text: 'Even in Cantonments, double-sold land happens. Always review the survey search before transferring funds.' },
    action: 'houses', target: 'houses', hint: 'Open the Houses app on your phone and inspect real estate listings',
    reward: { cash: 450, xp: 50 },
    check: (s) => Boolean(s.flags?.seen?.houses) || Object.keys(s.land || {}).length > 0 || (s.cnt && (s.cnt['act:interact'] || 0) >= 3)
  },
  landlord_dbee_2_3: {
    id: 'landlord_dbee_2_3', dream: 'landlord', chapter: 2, step: 3,
    title: 'The Prime Parcel Acquisition',
    desc: 'Acquire your own plot of land or reside in a prime residential property (Airport Res, Legon, Trasacco).',
    dialogue: { speaker: 'Indenture Notary', text: 'Congratulations. The title deed is registered under your own name, not just the family trust.' },
    action: 'houses', target: 'houses', hint: 'Own a plot of land or reside in an upscale home',
    reward: { cash: 700, xp: 80, badge: 'Cantonments Landholder' },
    check: (s) => Object.keys(s.land || {}).length > 0 || ['airres', 'legon', 'trasacco', 'osu'].includes(s.home)
  },
  landlord_dbee_2_4: {
    id: 'landlord_dbee_2_4', dream: 'landlord', chapter: 2, step: 4, isClimax: true,
    title: 'Climax: The Cantonments High-Stakes Auction',
    desc: 'A rival dynasty tries to box you out of the final commercial half-acre off Cantonments Road.',
    encounterId: 'enc_dbee_landlord_c2',
    action: 'story_event', hint: 'Win the high-stakes land auction',
    reward: { cash: 900, xp: 100, rep: 5, badge: 'Auction Master' },
    check: (s) => (s.story?.completedEncounters || []).includes('enc_dbee_landlord_c2')
  },

  // --- Star Dbee: Chapter 1 (The Silver Spoon Stigma) ---
  star_dbee_1_1: {
    id: 'star_dbee_1_1', dream: 'star', chapter: 1, step: 1,
    title: 'The Airport Res Home Studio Demo',
    desc: 'Your bedroom is stacked with imported studio gear, but critics claim you are just making soulless sound. Record your first demo track.',
    dialogue: { speaker: 'Sound Engineer Kobby', text: 'Gear is nice, but Accra streets want pain and melody. Let\'s record a raw vocal pass.' },
    action: 'home', target: 'home', hint: 'Visit your home studio or listen to music',
    reward: { cash: 150, xp: 20 },
    check: (s, c) => c.at === 'home' || s.place === 'home' || (s.cnt && (s.cnt['act:guitar'] || 0) >= 1) || (s.skills?.music || 0) >= 1
  },
  star_dbee_1_2: {
    id: 'star_dbee_1_2', dream: 'star', chapter: 1, step: 2,
    title: 'The Jamestown Street Reality Check',
    desc: 'Step out of your gated enclave. Travel to Jamestown or Labadi Beach to test your track in the real street sound clash with music, dance, or freestyle.',
    dialogue: { speaker: 'Jamestown DJ', text: 'Play your track here. If the fishermen and street dancers don\'t move their feet, go back to the drawing board.' },
    action: 'explore', target: 'kenkey', hint: 'Travel to Jamestown or Labadi Beach and perform or dance',
    reward: { cash: 200, xp: 25 },
    check: (s, c) => ['kenkey', 'labadi', 'lighthouse', 'jtown'].includes(s.place) && ((s.cnt && ((s.cnt['act:dance'] || 0) + (s.cnt['act:battle'] || 0) + (s.cnt['act:guitar'] || 0) + (s.cnt.social || 0)) >= 1) || (s.skills?.music || 0) >= 1)
  },
  star_dbee_1_3: {
    id: 'star_dbee_1_3', dream: 'star', chapter: 1, step: 3,
    title: 'Mastering Ga & Twi Cadence',
    desc: 'You can\'t conquer Accra singing only English. Polish your local dialect flows and vocal rhythm.',
    dialogue: { speaker: 'Vocal Coach Auntie Bea', text: 'Blend that sweet highlife cadence into your chorus. That is what moves Ghanaian souls!' },
    action: 'status', target: 'status', hint: 'Improve Music skill or perform a creative activity',
    reward: { cash: 300, xp: 35, badge: 'Cadence Master' },
    check: (s) => (s.skills?.music || 0) >= 1 || (s.cnt && (s.cnt['act:guitar'] || 0) >= 2)
  },
  star_dbee_1_4: {
    id: 'star_dbee_1_4', dream: 'star', chapter: 1, step: 4, isClimax: true,
    title: 'Climax: The Jamestown Cypher Confrontation',
    desc: 'The street cypher crew questions your authenticity because of your privileged background. Step into the circle.',
    encounterId: 'enc_dbee_star_c1',
    action: 'story_event', hint: 'Win over the street cypher',
    reward: { cash: 400, xp: 50, rep: 3, badge: 'Street Tested' },
    check: (s) => (s.story?.completedEncounters || []).includes('enc_dbee_star_c1')
  },

  // --- Star Dbee: Chapter 2 (The Street Cypher Respect) ---
  star_dbee_2_1: {
    id: 'star_dbee_2_1', dream: 'star', chapter: 2, step: 1,
    title: 'Sound Engineering at Vibes Lounge',
    desc: 'Head to Vibes Lounge in Osu to connect with resident DJs and test your mastered track with a live performance, dance battle or club gig.',
    dialogue: { speaker: 'DJ Black Star', text: 'If the bass vibrates the cocktail glasses at 1 AM, the song is a smash.' },
    action: 'explore', target: 'vibes', hint: 'Visit Vibes Lounge in Osu and complete a performance, battle or party action',
    reward: { cash: 350, xp: 40 },
    check: (s, c) => s.place === 'vibes' && ((s.cnt && ((s.cnt['act:battle'] || 0) + (s.cnt['act:dance'] || 0) + (s.cnt['act:party'] || 0)) >= 1) || (s.skills?.music || 0) >= 2)
  },
  star_dbee_2_2: {
    id: 'star_dbee_2_2', dream: 'star', chapter: 2, step: 2,
    title: 'The Azonto Sound Clash',
    desc: 'Engage in a live dance or beat showdown to build street credibility among Accra night owls.',
    dialogue: { speaker: 'Hype MC', text: 'Let the rhythm talk! Show them this Dbee has rhythm in the veins!' },
    action: 'explore', target: 'vibes', hint: 'Engage in a dance battle or activity at Vibes Lounge',
    reward: { cash: 450, xp: 50 },
    check: (s) => (s.cnt && (s.cnt['act:battle'] || s.cnt['act:party'] || 0) >= 1) || (s.skills?.dance || 0) >= 1
  },
  star_dbee_2_3: {
    id: 'star_dbee_2_3', dream: 'star', chapter: 2, step: 3,
    title: 'Independent Radio Traction',
    desc: 'Advance your music craft to level 3+ to ensure your sound cuts through the national airwaves.',
    dialogue: { speaker: 'Producer Hammer', text: 'Clean production, undeniable hook. The whole city is humming your melody!' },
    action: 'status', target: 'status', hint: 'Reach Music skill 3+ or engage in musical gigs',
    reward: { cash: 600, xp: 70, badge: 'Buzzing Talent' },
    check: (s) => (s.skills?.music || 0) >= 3 || (s.cnt && (s.cnt['act:guitar'] || 0) >= 3)
  },
  star_dbee_2_4: {
    id: 'star_dbee_2_4', dream: 'star', chapter: 2, step: 4, isClimax: true,
    title: 'Climax: The Radio Gatekeeper\'s Extortion',
    desc: 'An old-guard radio DJ tries to extort you with payola demands simply because your family is known to have wealth.',
    encounterId: 'enc_dbee_star_c2',
    action: 'story_event', hint: 'Defeat the crooked payola gatekeeper',
    reward: { cash: 750, xp: 90, rep: 5, badge: 'Unstoppable Sound' },
    check: (s) => (s.story?.completedEncounters || []).includes('enc_dbee_star_c2')
  },

  // --- Mogul Dbee: Chapter 1 (The Family Import Line) ---
  mogul_dbee_1_1: {
    id: 'mogul_dbee_1_1', dream: 'mogul', chapter: 1, step: 1,
    title: 'The Tema Port Freight Manifest',
    desc: 'Your family conglomerate is clearing a 40ft container of consumer electronics at Tema Port. Head to Makola or Circle commercial hub to review cargo and earn your first GH₵50.',
    dialogue: { speaker: 'Logistics Manager Kwesi', text: 'Tema Port waits for no man. Clear the paperwork before container demurrage begins!' },
    action: 'explore', target: 'makola', hint: 'Visit Makola Market or Circle trading hub and complete work or trade',
    reward: { cash: 200, xp: 25 },
    check: (s, c) => ['makola', 'circle'].includes(s.place) && ((s.stats?.gigs || 0) >= 1 || (s.gd?.earned || 0) >= 50 || (s.cnt && (s.cnt.social || 0) >= 1))
  },
  mogul_dbee_1_2: {
    id: 'mogul_dbee_1_2', dream: 'mogul', chapter: 1, step: 2,
    title: 'Upscale Retail Distribution',
    desc: 'Visit Oxford Street in Osu or Accra Mall to pitch your imported goods to high-end boutique and electronics stores. Network or earn retail margins.',
    dialogue: { speaker: 'Mall Retail Buyer', text: 'If your goods are certified and customs-cleared, we will put them on prime shelves across all branches.' },
    action: 'explore', target: 'oxford', hint: 'Visit Oxford Street or Accra Mall and network or complete a gig',
    reward: { cash: 300, xp: 35 },
    check: (s, c) => ['oxford', 'mall'].includes(s.place) && ((s.stats?.gigs || 0) >= 1 || (s.gd?.earned || 0) >= 60 || (s.cnt && (s.cnt.social || 0) >= 1))
  },
  mogul_dbee_1_3: {
    id: 'mogul_dbee_1_3', dream: 'mogul', chapter: 1, step: 3,
    title: 'Commercial Working Capital',
    desc: 'High-volume trading requires serious liquidity. Hold at least GH₵2,500 across your accounts.',
    dialogue: { speaker: 'Trade Finance Officer', text: 'Letters of credit require cash collateral. Keep your balances healthy.' },
    action: 'bank', target: 'bank', hint: 'Hold at least GH₵2,500 in total liquid assets (cash + MoMo)',
    reward: { cash: 400, xp: 45, badge: 'Working Capitalist' },
    check: (s) => (s.cash + s.momo >= 2500) || (s.flags.fixed?.amount || 0) >= 1500
  },
  mogul_dbee_1_4: {
    id: 'mogul_dbee_1_4', dream: 'mogul', chapter: 1, step: 4, isClimax: true,
    title: 'Climax: The Tema Port Customs Clearance Bottleneck',
    desc: 'A chief customs controller has placed a red hold on your container demanding "special processing fees."',
    encounterId: 'enc_dbee_mogul_c1',
    action: 'story_event', hint: 'Resolve the customs clearance bottleneck',
    reward: { cash: 600, xp: 70, rep: 3, badge: 'Port Master' },
    check: (s) => (s.story?.completedEncounters || []).includes('enc_dbee_mogul_c1')
  },

  // --- Mogul Dbee: Chapter 2 (Commercial Freight & Fleet) ---
  mogul_dbee_2_1: {
    id: 'mogul_dbee_2_1', dream: 'mogul', chapter: 2, step: 1,
    title: 'Fleet Logistics Expansion',
    desc: 'Inspect commercial transport lines and vehicles. Visit Spintex car dealerships or travel between commercial corridors.',
    dialogue: { speaker: 'Transport Union Boss', text: 'Whoever owns the transport controls the goods. Add wheels to your business!' },
    action: 'explore', target: 'cars', hint: 'Visit Spintex car showroom or travel across districts',
    reward: { cash: 450, xp: 50 },
    check: (s, c) => (s.discovery?.visited && s.discovery.visited.cars) || s.place === 'cars' || Object.keys(s.cnt || {}).some(k => k.startsWith('travel:') && (s.cnt[k] || 0) >= 2)
  },
  mogul_dbee_2_2: {
    id: 'mogul_dbee_2_2', dream: 'mogul', chapter: 2, step: 2,
    title: 'Corporate Retail Contracts',
    desc: 'Establish managed business equity or operate a commercial enterprise.',
    dialogue: { speaker: 'Enterprise Consultant', text: 'Transition from pure trading to owning commercial enterprises.' },
    action: 'enterprise', target: 'enterprise', hint: 'Open Enterprise app or own commercial business/property',
    reward: { cash: 600, xp: 70 },
    check: (s) => Object.keys(s.biz || {}).length >= 1 || Object.keys(s.owned || {}).length >= 1 || (s.cash + s.momo >= 4000)
  },
  mogul_dbee_2_3: {
    id: 'mogul_dbee_2_3', dream: 'mogul', chapter: 2, step: 3,
    title: 'The Five-Figure Commercial Milestone',
    desc: 'Scale your business operations to reach at least GH₵5,000 in liquid reserves.',
    dialogue: { speaker: 'Auditor Mensah', text: 'Your revenues are outpacing established merchants. True tycoon status is within reach.' },
    action: 'bank', target: 'bank', hint: 'Reach at least GH₵5,000 in total liquid wealth',
    reward: { cash: 800, xp: 90, badge: 'Fleet Magnate' },
    check: (s) => (s.cash + s.momo >= 5000) || Object.keys(s.biz || {}).length >= 1
  },
  mogul_dbee_2_4: {
    id: 'mogul_dbee_2_4', dream: 'mogul', chapter: 2, step: 4, isClimax: true,
    title: 'Climax: The Mall Retail Monopoly Battle',
    desc: 'A rival foreign syndicate attempts to buy out your prime mall retail leases before your flagship store opens.',
    encounterId: 'enc_dbee_mogul_c2',
    action: 'story_event', hint: 'Win the mall retail battle',
    reward: { cash: 1000, xp: 120, rep: 5, badge: 'Retail Kingpin' },
    check: (s) => (s.story?.completedEncounters || []).includes('enc_dbee_mogul_c2')
  },

  // --- Unicorn Dbee: Chapter 1 (The Boardroom Defiance) ---
  unicorn_dbee_1_1: {
    id: 'unicorn_dbee_1_1', dream: 'unicorn', chapter: 1, step: 1,
    title: 'The Garage Dev Workstation',
    desc: 'Your family wants you to take an easy corporate desk job. Defy expectations and write the initial architecture for your independent startup.',
    dialogue: { speaker: 'Co-Founder Senyo', text: 'They think we are just playing with laptops. Let us ship an architecture that silences every skeptic!' },
    action: 'hub', target: 'hub', hint: 'Visit Sankofa Tech Hub or code at home',
    reward: { cash: 200, xp: 25 },
    check: (s, c) => (s.discovery?.visited && s.discovery.visited.hub) || s.place === 'hub' || (s.skills?.coding || 0) >= 1
  },
  unicorn_dbee_1_2: {
    id: 'unicorn_dbee_1_2', dream: 'unicorn', chapter: 1, step: 2,
    title: 'The Silicon Accra Tech Meetup',
    desc: 'Connect with grassroots Accra engineers and designers at Sankofa Tech Hub in Osu. Collaborate on code, socialize, or build MVP prototype progress.',
    dialogue: { speaker: 'Lead Frontend Dev', text: 'Accra has world-class engineering talent. Let us build products that solve real African pain points!' },
    action: 'explore', target: 'hub', hint: 'Visit Sankofa Tech Hub in Osu and code or collaborate with devs',
    reward: { cash: 300, xp: 35 },
    check: (s, c) => s.place === 'hub' && ((s.skills?.coding || 0) >= 1 || (s.cnt && ((s.cnt['act:code'] || 0) + (s.cnt.social || 0)) >= 1) || (s.flags?.mvp || 0) >= 10)
  },
  unicorn_dbee_1_3: {
    id: 'unicorn_dbee_1_3', dream: 'unicorn', chapter: 1, step: 3,
    title: 'The Prototype Codebase',
    desc: 'Advance your Coding skill to level 2+ and prepare the minimum viable product.',
    dialogue: { speaker: 'Product Manager Ama', text: 'Clean code and fast API response times. Investors will have to take us seriously.' },
    action: 'status', target: 'status', hint: 'Reach Coding skill 2+ or code projects',
    reward: { cash: 400, xp: 45, badge: 'Garagetech Dev' },
    check: (s) => (s.skills?.coding || 0) >= 2 || (s.flags.mvp || 0) >= 20
  },
  unicorn_dbee_1_4: {
    id: 'unicorn_dbee_1_4', dream: 'unicorn', chapter: 1, step: 4, isClimax: true,
    title: 'Climax: The Corporate Boardroom Intervention',
    desc: 'Uncle Kenneth and family elders convene an intervention to push you into an easy corporate job with a company Prado.',
    encounterId: 'enc_dbee_unicorn_c1',
    action: 'story_event', hint: 'Defend your startup autonomy against the family board',
    reward: { cash: 600, xp: 70, rep: 4, badge: 'Defiant Founder' },
    check: (s) => (s.story?.completedEncounters || []).includes('enc_dbee_unicorn_c1')
  },

  // --- Unicorn Dbee: Chapter 2 (The Angel Syndicate Round) ---
  unicorn_dbee_2_1: {
    id: 'unicorn_dbee_2_1', dream: 'unicorn', chapter: 2, step: 1,
    title: 'The Accra Polo Club Investor Circuit',
    desc: 'Visit high-end networking hubs in Airport Residential and Osu to map out prospective angel investors. Dine or network with business founders.',
    dialogue: { speaker: 'Angel Scout Kofi', text: 'High-net-worth individuals in Accra want tech exposure, but they need to see serious numbers.' },
    action: 'explore', target: 'oxford', hint: 'Visit Osu or Airport Residential area and dine, network or earn GH₵80+',
    reward: { cash: 500, xp: 55 },
    check: (s, c) => ['oxford', 'hub', 'airres'].includes(s.place) && ((s.stats?.meals || 0) >= 1 || (s.cnt && (s.cnt.social || 0) >= 2) || (s.gd?.earned || 0) >= 80)
  },
  unicorn_dbee_2_2: {
    id: 'unicorn_dbee_2_2', dream: 'unicorn', chapter: 2, step: 2,
    title: 'FinTech Architecture & Security',
    desc: 'Refine your platform code to pass regulatory and security scrutiny. Reach Coding skill 4+.',
    dialogue: { speaker: 'Security Auditor', text: 'Bank of Ghana data privacy standards require zero vulnerabilities in your payment gateway.' },
    action: 'hub', target: 'hub', hint: 'Reach Coding skill 4+ or build MVP',
    reward: { cash: 700, xp: 75 },
    check: (s) => (s.skills?.coding || 0) >= 3 || (s.flags.mvp || 0) >= 50
  },
  unicorn_dbee_2_3: {
    id: 'unicorn_dbee_2_3', dream: 'unicorn', chapter: 2, step: 3,
    title: 'The Pre-Seed Working Treasury',
    desc: 'Hold at least GH₵3,500 in working funds to fund server infrastructure and legal registration.',
    dialogue: { speaker: 'Startup CFO', text: 'AWS bills and registrar fees don\'t take IOUs. Our treasury is fully capitalized!' },
    action: 'bank', target: 'bank', hint: 'Hold at least GH₵3,500 in total funds',
    reward: { cash: 900, xp: 90, badge: 'Funded Founder' },
    check: (s) => (s.cash + s.momo >= 3500) || (s.flags.round || 0) >= 1
  },
  unicorn_dbee_2_4: {
    id: 'unicorn_dbee_2_4', dream: 'unicorn', chapter: 2, step: 4, isClimax: true,
    title: 'Climax: The Polo Club Shark Term Sheet',
    desc: 'An aggressive venture partner tries to demand 51% controlling equity in exchange for pre-seed capital.',
    encounterId: 'enc_dbee_unicorn_c2',
    action: 'story_event', hint: 'Reject the predatory shark term sheet',
    reward: { cash: 1200, xp: 120, rep: 6, badge: 'Syndicate Closer' },
    check: (s) => (s.story?.completedEncounters || []).includes('enc_dbee_unicorn_c2')
  },

  // --- Bigman Dbee: Chapter 1 (The Dynastic Heir) ---
  bigman_dbee_1_1: {
    id: 'bigman_dbee_1_1', dream: 'bigman', chapter: 1, step: 1,
    title: 'Diplomatic Wardrobe Fitting',
    desc: 'High society in Accra scrutinizes every detail. Visit an upscale boutique or dress in bespoke designer attire (update outfit or own Kente).',
    dialogue: { speaker: 'Master Tailor Ofori', text: 'When a dynastic heir enters a reception, the fabric must speak before the mouth opens!' },
    action: 'explore', target: 'mall', hint: 'Visit Accra Mall or boutique and change outfit or acquire fine clothes',
    reward: { cash: 250, xp: 30 },
    check: (s, c) => ['mall', 'kantamanto', 'oxford'].includes(s.place) && ((s.cnt && s.cnt.outfit > 0) || !!s.wardrobe?.kente || (s.cash + s.momo >= 800))
  },
  bigman_dbee_1_2: {
    id: 'bigman_dbee_1_2', dream: 'bigman', chapter: 1, step: 2,
    title: 'High-Society Diplomatic Reception',
    desc: 'Travel to Airport Residential or Ridge to attend elite diplomatic and business mixers. Dine or network with visiting delegates.',
    dialogue: { speaker: 'Ambassadorial Protocol', text: 'Good evening. Your family seat is reserved at the high table with visiting delegates.' },
    action: 'explore', target: 'bank', hint: 'Visit Ridge or Airport Residential and dine or network with delegates',
    reward: { cash: 350, xp: 40 },
    check: (s, c) => ['airres', 'oxford', 'bank', 'ridge'].includes(s.place) && ((s.stats?.meals || 0) >= 1 || (s.cnt && (s.cnt.social || 0) >= 2) || (s.rep || 0) >= 5)
  },
  bigman_dbee_1_3: {
    id: 'bigman_dbee_1_3', dream: 'bigman', chapter: 1, step: 3,
    title: 'The Dynastic Liquidity Threshold',
    desc: 'True influence requires financial staying power. Maintain at least GH₵3,000 across your accounts.',
    dialogue: { speaker: 'Family Trust Custodian', text: 'You represent generations of family prestige. Maintain your personal reserves.' },
    action: 'bank', target: 'bank', hint: 'Hold at least GH₵3,000 in cash or MoMo',
    reward: { cash: 500, xp: 50, badge: 'Dynastic Liquidity' },
    check: (s) => (s.cash + s.momo >= 3000) || (s.rep || 0) >= 5
  },
  bigman_dbee_1_4: {
    id: 'bigman_dbee_1_4', dream: 'bigman', chapter: 1, step: 4, isClimax: true,
    title: 'Climax: The Ambassador\'s Diplomatic Gala',
    desc: 'At an exclusive diplomatic charity dinner, a visiting delegate condescends to Ghanaian enterprise.',
    encounterId: 'enc_dbee_bigman_c1',
    action: 'story_event', hint: 'Defend national dignity at the gala',
    reward: { cash: 700, xp: 80, rep: 5, badge: 'Diplomatic Star' },
    check: (s) => (s.story?.completedEncounters || []).includes('enc_dbee_bigman_c1')
  },

  // --- Bigman Dbee: Chapter 2 (The Family Trust Succession) ---
  bigman_dbee_2_1: {
    id: 'bigman_dbee_2_1', dream: 'bigman', chapter: 2, step: 1,
    title: 'The Ancestral Civic Landmark Summons',
    desc: 'Travel to Black Star Square or Jamestown Lighthouse to connect with historical roots and civic legacy.',
    dialogue: { speaker: 'Civic Historian', text: 'Leadership in Ghana is rooted in knowing where our nation and your lineage come from.' },
    action: 'explore', target: 'blackstar', hint: 'Visit Black Star Square or Jamestown Lighthouse',
    reward: { cash: 500, xp: 60 },
    check: (s, c) => (s.discovery?.visited && (s.discovery.visited.blackstar || s.discovery.visited.lighthouse || s.discovery.visited.memorial)) || ['blackstar', 'lighthouse', 'memorial'].includes(s.place)
  },
  bigman_dbee_2_2: {
    id: 'bigman_dbee_2_2', dream: 'bigman', chapter: 2, step: 2,
    title: 'The Civic Philanthropy Endowment',
    desc: 'Demonstrate leadership by building public respect and community goodwill (Reputation 10+).',
    dialogue: { speaker: 'Community Youth Leader', text: 'A real leader doesn\'t just eat alone; they lift the entire community along.' },
    action: 'status', target: 'status', hint: 'Reach Reputation 10+ or make philanthropic donations',
    reward: { cash: 750, xp: 80 },
    check: (s) => (s.rep || 0) >= 10 || (s.cash + s.momo >= 5000)
  },
  bigman_dbee_2_3: {
    id: 'bigman_dbee_2_3', dream: 'bigman', chapter: 2, step: 3,
    title: 'The Executive Transport Command',
    desc: 'Acquire personal transport or travel through Accra with distinction.',
    dialogue: { speaker: 'VIP Chauffeur', text: 'Your presence commands respect at every gate and venue in Greater Accra.' },
    action: 'houses', target: 'houses', hint: 'Own a car, rental vehicle, or reside in executive home',
    reward: { cash: 1000, xp: 100, badge: 'High Society Escort' },
    check: (s) => Boolean(s.car) || Boolean(s.rental?.until) || ['airres', 'trasacco', 'legon', 'osu'].includes(s.home)
  },
  bigman_dbee_2_4: {
    id: 'bigman_dbee_2_4', dream: 'bigman', chapter: 2, step: 4, isClimax: true,
    title: 'Climax: The Chieftaincy Council Succession',
    desc: 'The family royal stool council convenes to test your readiness to assume executive leadership.',
    encounterId: 'enc_dbee_bigman_c2',
    action: 'story_event', hint: 'Earn the ancestral council\'s blessing',
    reward: { cash: 1500, xp: 150, rep: 8, badge: 'Council Pillar' },
    check: (s) => (s.story?.completedEncounters || []).includes('enc_dbee_bigman_c2')
  }
};

// Interactive Climax Encounters (Branching Dilemmas with Authentic Accra Lore)
export const STORY_ENCOUNTERS = {
  // Landlord Encounters
  enc_landlord_c1: {
    id: 'enc_landlord_c1',
    title: 'The Caretaker\'s Extortion',
    speaker: 'Mr. Lamptey (Caretaker)',
    text: 'Mr. Lamptey announces the electricity surcharge is doubling this month because "someone used an electric kettle." The other tenants look to you to speak up.',
    choices: [
      { id: 'expose', label: 'Call the Landlord directly', hint: 'Charisma test · Exposes Lamptey, gains respect from neighbors', req: { charisma: 1 }, result: { rep: 2, mood: { v: 8, label: 'Exposed Caretaker' }, note: 'You phoned the real property owner in Kumasi. Lamptey was reprimanded and withdrew the fake levy!' } },
      { id: 'deal', label: 'Cut a quiet deal for your room', hint: 'Save your own pocket (-GH₵50), keep quiet', result: { cash: -50, mood: { v: 2, label: 'Quiet compromise' }, note: 'You paid Lamptey small tea money. He quietly excused your room from the surcharge.' } },
      { id: 'rally', label: 'Organize a tenant boycott', hint: 'High community unity · All tenants refuse to pay', result: { rep: 3, mood: { v: 10, label: 'Tenant Leader' }, note: 'Every single tenant locked their doors and refused to pay. Lamptey backed down immediately!' } },
    ]
  },
  enc_landlord_c2: {
    id: 'enc_landlord_c2',
    title: 'The Land Guard Shakedown',
    speaker: 'Red Sand Land Guards',
    text: 'Two heavily built land guards block the cement truck at your plot boundary. "Before any block touches this red sand, you must pay GH₵200 digging kola!"',
    choices: [
      { id: 'indenture', label: 'Produce Stamped Indenture', hint: 'Show chief\'s legal title and seal', result: { rep: 3, mood: { v: 10, label: 'Legal Victory' }, note: 'You produced the stamped indenture and survey map. Realizing you had legitimate backing, they moved on.' } },
      { id: 'pay', label: 'Pay the digging kola (GH₵150)', hint: 'Quick resolution · Avoid physical trouble', result: { cash: -150, mood: { v: 2, label: 'Site Cleared' }, note: 'You negotiated them down to GH₵150. They took the cash and agreed to watch your site.' } },
      { id: 'police', label: 'Call the Regional Police Patrol', hint: 'Involve law enforcement (+Reputation)', result: { rep: 4, mood: { v: 6, label: 'Police Intervention' }, note: 'A police patrol cruiser rolled up with sirens on. The land guards scattered into the bush!' } },
    ]
  },
  enc_landlord_c3: {
    id: 'enc_landlord_c3',
    title: 'The Missing Cement Bags',
    speaker: 'Night Watchman Joe',
    text: 'Ten bags of Ghacem cement disappeared overnight. Joe swears "spiritual dwarfs" carried them into the sea, but the tire tracks match the mason\'s pickup.',
    choices: [
      { id: 'inspect', label: 'Deduct from Mason\'s Invoice', hint: 'Firm business management · Recover full value', result: { cash: 200, rep: 2, mood: { v: 8, label: 'Tight Books' }, note: 'You deducted GH₵200 from the contractor\'s bill. Miraculously, no more cement ever went missing.' } },
      { id: 'security', label: 'Install Solar Security Lights', hint: 'Invest in prevention (-GH₵100)', result: { cash: -100, rep: 3, mood: { v: 10, label: 'Modern Security' }, note: 'Bright solar floodlights now illuminate the whole site. The nocturnal thievery ended.' } },
      { id: 'forgive', label: 'Pardon with a stern warning', hint: 'Build worker loyalty', result: { rep: 1, mood: { v: 4, label: 'Second Chance' }, note: 'You gave the mason one last chance. Relieved, the crew worked double-time to finish the slab.' } },
    ]
  },
  enc_landlord_c4: {
    id: 'enc_landlord_c4',
    title: 'The Sidewalk Trader Dilemma',
    speaker: 'Aunty Comfort (Roaster)',
    text: 'The municipal taskforce wants to smash Aunty Comfort\'s roadside roasted plantain stand against your perimeter wall. She has 3 school children to feed.',
    choices: [
      { id: 'incorporate', label: 'Build her a branded kiosk', hint: 'Invest GH₵200 · Gain eternal community goodwill', result: { cash: -200, rep: 5, mood: { v: 15, label: 'Community Hero' }, note: 'You built her an attractive wooden vendor kiosk within your property boundary. The taskforce couldn\'t touch it, and your street reputation soared!' } },
      { id: 'evict', label: 'Let the municipal council clear it', hint: 'Keep commercial curb pristine', result: { rep: -1, mood: { v: -2, label: 'Cold Business' }, note: 'The taskforce cleared the pavement. Your frontage looks clean, though locals whisper.' } },
      { id: 'negotiate', label: 'Relocate her to the courtyard', hint: 'Balanced compromise', result: { rep: 3, mood: { v: 8, label: 'Fair Solution' }, note: 'You offered her space in your interior courtyard where her fresh bofrot brings foot traffic to all your tenants.' } },
    ]
  },
  enc_landlord_c5: {
    id: 'enc_landlord_c5',
    title: 'The Chairman\'s Housewarming Toast',
    speaker: 'Chairman of Trasacco',
    text: 'Champagne glasses clink across the marble terrace of your Trasacco villa. The mic is handed to you for the keynote toast of the evening.',
    choices: [
      { id: 'found', label: 'Endow a Jamestown Youth Fund', hint: 'Give back GH₵1,000 · Cement your name in history', result: { cash: -1000, rep: 10, mood: { v: 25, label: 'Philanthropist' }, note: 'You pledged GH₵1,000 to renovate schools in Jamestown. A standing ovation echoed across Trasacco Valley!' } },
      { id: 'consortium', label: 'Announce an Africa Real Estate Fund', hint: 'Invite elite investment partners', result: { cash: 5000, rep: 8, mood: { v: 20, label: 'Consortium Leader' }, note: 'High-table investors subscribed GH₵5,000 to your upcoming commercial plaza development!' } },
      { id: 'humble', label: 'Toast to the journey from the compound', hint: 'Pure cultural eloquence', result: { rep: 8, mood: { v: 20, label: 'True Chairman' }, note: 'You shared the story of the leaking compound ceiling and Mr. Lamptey. The room erupted in laughter and deep respect.' } },
    ]
  },

  // Afrobeats Encounters
  enc_star_c1: {
    id: 'enc_star_c1',
    title: 'The Jamestown Corner Cypher',
    speaker: 'MC Iron Boy',
    text: 'A ring of twenty street kids and beatboxers forms around you. "If you claim your music is sweet, let\'s hear what you have in your head right now!"',
    choices: [
      { id: 'pidgin', label: 'Drop heavy Ga & Pidgin bars', hint: 'Authentic street flow', result: { rep: 3, mood: { v: 12, label: 'Street Cypher Winner' }, note: 'Your punchlines about trotro traffic and high cedis had the whole corner screaming your name!' } },
      { id: 'melody', label: 'Sing a soulful highlife melody', hint: 'Win them over with vocal range', result: { rep: 3, mood: { v: 10, label: 'Golden Vocals' }, note: 'Your velvet hook brought the market mamas out of their stalls clapping in rhythm!' } },
      { id: 'dance', label: 'Hit the Azonto breakdance', hint: 'Hypnotize the crowd with footwork', result: { rep: 2, mood: { v: 8, label: 'Dance Champion' }, note: 'Your footwork was so slick, Iron Boy threw his hands up in defeat!' } },
    ]
  },
  enc_star_c2: {
    id: 'enc_star_c2',
    title: 'The Vibes Lounge Stage Duel',
    speaker: 'Tema Mic Challenger',
    text: 'Midway through your performance, the challenger tries to steal the crowd\'s energy with loud diss bars.',
    choices: [
      { id: 'freestyle', label: 'Freestyle a comedic comeback', hint: 'Humiliate him with wit', result: { rep: 4, mood: { v: 12, label: 'Stage King' }, note: 'You made a hilarious rhyme about his borrowed designer jacket. The VIP tables roared with laughter!' } },
      { id: 'chorus', label: 'Lead a massive crowd singalong', hint: 'Drown him out with unity', result: { rep: 5, mood: { v: 15, label: 'Anthem Unifier' }, note: '200 voices sang your hook at the top of their lungs, completely burying his mic!' } },
      { id: 'collab', label: 'Invite him to share the verse', hint: 'Show magnanimity & maturity', result: { rep: 4, mood: { v: 10, label: 'Gracious Star' }, note: 'You turned the beef into a surprise duet that blew up on Snapchat by morning!' } },
    ]
  },
  enc_star_c3: {
    id: 'enc_star_c3',
    title: 'The Predatory 360 Record Contract',
    speaker: 'Label Executive Dapper',
    text: 'Dapper pushes a pen into your hand: "Take GH₵3,000 cash advance today. In exchange, we manage everything: your masters, tours, and publishing rights for 7 years."',
    choices: [
      { id: 'decline', label: 'Stay 100% Independent', hint: 'Sacrifice instant cash · Retain all master rights', result: { rep: 5, mood: { v: 12, label: 'Independent Artist' }, note: 'You pushed the contract back. "My music stays mine." Street respect exploded among purists!' } },
      { id: 'negotiate', label: 'Demand distribution-only deal', hint: 'Charisma check · Keep 80% royalties', result: { cash: 1000, rep: 4, mood: { v: 10, label: 'Smart Mogul' }, note: 'You held firm. Dapper compromised on a 2-year distribution deal with GH₵1,000 advance and master retention!' } },
      { id: 'sign', label: 'Take the GH₵3,000 advance', hint: 'Instant wealth · Label takes royalties cut', result: { cash: 3000, rep: 1, mood: { v: 4, label: 'Advance Cash' }, note: 'You banked the GH₵3,000 cash advance. You got the instant bag, though your future royalties will have deductions.' } },
    ]
  },
  enc_star_c4: {
    id: 'enc_star_c4',
    title: 'The Radio Payola Blackmail',
    speaker: 'Corrupt Radio Host',
    text: '"Your song is good, but without GH₵500 grease on my palms every Friday, my station plays your rival instead."',
    choices: [
      { id: 'expose', label: 'Expose him on social media', hint: 'Bold public stance', result: { rep: 6, mood: { v: 15, label: 'Whistleblower' }, note: 'Your tweet went viral! The radio management suspended the host and put your song on power rotation for free!' } },
      { id: 'ignore', label: 'Rely on organic TikTok streaming', hint: 'Let the streets decide', result: { rep: 4, mood: { v: 8, label: 'Digital Power' }, note: 'Your fans streamed the audio so hard that radio stations had no choice but to spin it daily.' } },
      { id: 'charm', label: 'Invite him to co-host an exclusive party', hint: 'Diplomatic maneuver', result: { rep: 3, mood: { v: 6, label: 'Industry Player' }, note: 'You turned him into an ally without paying payola.' } },
    ]
  },
  enc_star_c5: {
    id: 'enc_star_c5',
    title: 'The Afrochella Grand Encore',
    speaker: '40,000 Screaming Fans',
    text: 'Fireworks burst into the night sky as your final beat drops. The crowd is chanting: "ONE MORE SONG! ONE MORE SONG!"',
    choices: [
      { id: 'acoustic', label: 'Sing an unreleased acoustic highlife song', hint: 'Pure vocal emotional climax', result: { rep: 12, mood: { v: 30, label: 'Transcendent Legend' }, note: '40,000 flashlight phones illuminated the darkness as your voice brought tears to people\'s eyes. An unforgettable night!' } },
      { id: 'jam', label: 'Bring up all the street dancers from Jamestown', hint: 'Honor your roots on the world stage', result: { rep: 14, mood: { v: 35, label: 'People\'s Champion' }, note: 'You invited the kids from your old block onto the world stage. The video trended worldwide!' } },
      { id: 'anthem', label: 'Drop the remix with the surprise international guest', hint: 'High-energy explosive stadium finale', result: { cash: 5000, rep: 12, mood: { v: 28, label: 'Global Superstar' }, note: 'The stadium shook to its foundations. You have officially made Ghanaian music history!' } },
    ]
  },

  // Mogul Encounters
  enc_mogul_c1: {
    id: 'enc_mogul_c1',
    title: 'The Pavement Taskforce Sweep',
    speaker: 'AMA Taskforce Sergeant',
    text: '"Pavement hawking permit check! If you don\'t have the official Accra Metropolitan decal, packing your goods into the truck right now!"',
    choices: [
      { id: 'permit', label: 'Produce the municipal receipt', hint: 'Show legitimate council papers', result: { rep: 3, mood: { v: 8, label: 'Fully Licensed' }, note: 'You produced your stamped receipt from the municipal office. The sergeant saluted and walked on!' } },
      { id: 'bargain', label: 'Offer merchant association solidarity', hint: 'Charisma check · Defend fellow traders', result: { rep: 4, mood: { v: 10, label: 'Trader Defender' }, note: 'You spoke with authority representing the traders union. The taskforce agreed to a grace period.' } },
      { id: 'pack', label: 'Politely pack goods and wait it out', hint: 'Safe, zero loss', result: { mood: { v: 2, label: 'Patience Pays' }, note: 'You folded your table neatly. Thirty minutes later, the sweep passed and business resumed.' } },
    ]
  },
  enc_mogul_c2: {
    id: 'enc_mogul_c2',
    title: 'The 37 Checkpoint Shake-Down',
    speaker: 'Highway Patrol Officer',
    text: '"Your trotro fire extinguisher gauge is slightly low. I have to impound this vehicle for the weekend unless we settle this matter."',
    choices: [
      { id: 'inspection', label: 'Produce valid roadworthy & logbook', hint: 'Firm legal standing', result: { rep: 3, mood: { v: 8, label: 'Legal Firmness' }, note: 'You calmly showed your pristine inspection sticker and DVLA logbook. He had no grounds and waved you through.' } },
      { id: 'settle', label: 'Offer GH₵50 for water and lunch', hint: 'Standard street expediency', result: { cash: -50, mood: { v: 2, label: 'On the Road' }, note: 'A small gift smoothed things over. Your driver was back on the Circle route in two minutes.' } },
      { id: 'call', label: 'Call the Station Master on speakerphone', hint: 'Union leverage', result: { rep: 4, mood: { v: 10, label: 'Union Backing' }, note: 'The Station Master spoke with the officer. The trotro was immediately released with an apology.' } },
    ]
  },
  enc_mogul_c3: {
    id: 'enc_mogul_c3',
    title: 'The Surprise GRA Tax Audit',
    speaker: 'GRA Revenue Inspector',
    text: '"We are auditing retail businesses on this avenue. Show us your daily sales ledger and VAT invoicing stamps."',
    choices: [
      { id: 'ledger', label: 'Present accurate ledger books', hint: 'Reward for keeping good records', result: { rep: 4, mood: { v: 12, label: 'Audit Commendation' }, note: 'Your clean bookkeeping impressed the inspectors. They awarded you an official Tax Compliance certificate!' } },
      { id: 'accountant', label: 'Call your business accountant', hint: 'Professional handling', result: { cash: -100, rep: 3, mood: { v: 6, label: 'Accountant Handled' }, note: 'Your accountant filed the prompt clarification. Everything was resolved smoothly.' } },
    ]
  },
  enc_mogul_c4: {
    id: 'enc_mogul_c4',
    title: 'The Tema Port Demurrage Stand-off',
    speaker: 'Clearing Official',
    text: '"Your container clearance requires special processing clearance fees of GH₵500, or the port will charge daily demurrage."',
    choices: [
      { id: 'expedite', label: 'Pay the expedited fee (GH₵300)', hint: 'Immediate release of valuable inventory', result: { cash: -300, rep: 2, mood: { v: 6, label: 'Cargo Released' }, note: 'You negotiated the fee to GH₵300. The container gates opened and your trucks loaded out immediately.' } },
      { id: 'minister', label: 'Petition the Port Authority Director', hint: 'High reputation leverage', result: { rep: 5, mood: { v: 12, label: 'Director Intervened' }, note: 'You petitioned the director directly. The fraudulent demurrage was wiped out and cargo released!' } },
    ]
  },
  enc_mogul_c5: {
    id: 'enc_mogul_c5',
    title: 'Chamber of Commerce Election',
    speaker: 'Election Presiding Officer',
    text: '"By overwhelming vote of the retail, transport, and import syndicates, you are elected President of the Chamber of Commerce!"',
    choices: [
      { id: 'fund', label: 'Launch the Young Traders Micro-Credit Fund', hint: 'Pledge GH₵2,000 to seed young entrepreneurs', result: { cash: -2000, rep: 12, mood: { v: 25, label: 'Trader Benefactor' }, note: 'You seeded 50 small market women with micro-grants. A historic victory for the grassroots!' } },
      { id: 'trade', label: 'Establish direct sea trade route to West Africa', hint: 'Massive commercial expansion', result: { cash: 10000, rep: 10, mood: { v: 20, label: 'Trade Magnate' }, note: 'You signed commercial pacts opening bilateral trade for all members of the chamber!' } },
    ]
  },

  // Unicorn Encounters
  enc_unicorn_c1: {
    id: 'enc_unicorn_c1',
    title: 'The Demo Day Hotfix',
    speaker: 'Lead Architect',
    text: 'Out of memory crash on the server 10 minutes before the pitch! The investors are taking their seats in the boardroom.',
    choices: [
      { id: 'restart', label: 'Flush cache and deploy lean build', hint: 'Fast engineering fix', result: { rep: 3, mood: { v: 10, label: 'Hotfix Master' }, note: 'You stripped the bulky assets, cleared the cache, and the demo ran buttery smooth at 60 FPS!' } },
      { id: 'talk', label: 'Stall with an engaging founder story', hint: 'Charisma check', result: { rep: 2, mood: { v: 6, label: 'Silver Tongued' }, note: 'You captivated the room with your customer discovery stories while your co-founder rebooted the node!' } },
    ]
  },
  enc_unicorn_c2: {
    id: 'enc_unicorn_c2',
    title: 'The Shark Investor Standoff',
    speaker: 'Venture Capitalist',
    text: '"We want 40% equity and 2 board seats for our GH₵50,000, or we will fund your competitor in Kumasi."',
    choices: [
      { id: 'refuse', label: 'Walk away and syndicate smaller angels', hint: 'Protect founder control', result: { rep: 4, mood: { v: 12, label: 'Founder Independence' }, note: 'You walked away. Three angel investors banded together to give you better valuation at only 15% equity!' } },
      { id: 'counter', label: 'Counter with 18% equity and milestone tranches', hint: 'Sophisticated negotiation', result: { cash: 5000, rep: 4, mood: { v: 10, label: 'Master Dealmaker' }, note: 'They respected your spine and accepted 18% with milestones. Capital in the bank!' } },
    ]
  },
  enc_unicorn_c3: {
    id: 'enc_unicorn_c3',
    title: 'The Zero-Day Cyber Attack',
    speaker: 'Security Bot Alert',
    text: 'High-frequency automated bot requests are attempting credential stuffing against the player MoMo withdrawal service.',
    choices: [
      { id: 'lockdown', label: 'Activate zero-trust rate limiting & 2FA', hint: 'Standard cybersecurity lockdown', result: { rep: 4, mood: { v: 10, label: 'Fortress Secure' }, note: 'The rate-limiter slammed the door shut on 50,000 bot requests. Not a single pesewa was lost!' } },
      { id: 'honeypot', label: 'Deploy a honeypot to trace the attackers', hint: 'High technical wizardry', result: { rep: 6, mood: { v: 15, label: 'Hacker Hunter' }, note: 'You traced the IP addresses back to an offshore proxy and blacklisted their entire ASN network!' } },
    ]
  },
  enc_unicorn_c4: {
    id: 'enc_unicorn_c4',
    title: 'The \$50M Acquisition Offer',
    speaker: 'Silicon Valley Corporate Corp',
    text: '"We are offering you \$50,000,000 in cash to acquire 100% of the platform and integrate it into our global app."',
    choices: [
      { id: 'decline', label: 'Decline: "Africa will build its own giants"', hint: 'Retain the destiny of your company', result: { rep: 8, mood: { v: 25, label: 'African Giant Builder' }, note: 'Your refusal made international tech headlines. Top engineers from across the diaspora sent resumes to join your crusade!' } },
      { id: 'partnership', label: 'Counter-offer a strategic commercial partnership', hint: 'Retain independence, take strategic capital', result: { cash: 10000, rep: 6, mood: { v: 20, label: 'Strategic Alliance' }, note: 'They invested \$10M for non-voting distribution access. You kept total control of your company!' } },
    ]
  },
  enc_unicorn_c5: {
    id: 'enc_unicorn_c5',
    title: 'The Africa Tech Keynote',
    speaker: '2,000 Tech Founders & Delegates',
    text: 'You stand before the international audience at the International Conference Centre. What is the central message of your address?',
    choices: [
      { id: 'empower', label: '"Code for the street corner, not just the board room"', hint: 'Grassroots fintech philosophy', result: { rep: 12, mood: { v: 30, label: 'Visionary Leader' }, note: 'A thundering 5-minute standing ovation. The next generation of African builders is inspired!' } },
      { id: 'fund', label: 'Announce a \$1M seed fund for student coders in Ghana', hint: 'Generous community endowment', result: { cash: -5000, rep: 15, mood: { v: 35, label: 'Angel of Silicon Accra' }, note: 'You pledged your own capital to fund the next 50 startups. Your legacy in Accra is cast in gold!' } },
    ]
  },

  // Big Man Encounters
  enc_bigman_c1: {
    id: 'enc_bigman_c1',
    title: 'The Bogus Agent Scheme',
    speaker: 'Agent in Sunglasses',
    text: '"Pay 2 years advance right now on this luxury apartment before another Borga lands from Amsterdam to take it."',
    choices: [
      { id: 'deed', label: 'Demand to inspect the land title and deed', hint: 'Call his bluff', result: { rep: 3, mood: { v: 8, label: 'Scam Avoided' }, note: 'When you asked for the Land Title Certificate number, he suddenly claimed he had another urgent meeting and ran!' } },
      { id: 'security', label: 'Ask the estate security supervisor to verify', hint: 'On-site due diligence', result: { rep: 2, mood: { v: 6, label: 'Safe Due Diligence' }, note: 'The gate supervisor confirmed the real owner is in the UK and this agent is a known impersonator!' } },
    ]
  },
  enc_bigman_c2: {
    id: 'enc_bigman_c2',
    title: 'The Family Black Tax Conclave',
    speaker: 'Uncle Ekow',
    text: '"You are a Big Man now! You must buy a passenger van for your cousins and give me GH₵5,000 for my gold concession license!"',
    choices: [
      { id: 'boundaries', label: 'Offer to fund only verifiable school tuition and medicals', hint: 'Constructive boundaries with love', result: { cash: -500, rep: 5, mood: { v: 12, label: 'Wise Family Pillar' }, note: 'You paid the kids\' school fees directly to the bank. The elders praised your wisdom and discipline!' } },
      { id: 'skills', label: 'Offer apprenticeships and jobs in your business', hint: 'Teach them how to fish', result: { rep: 4, mood: { v: 10, label: 'Generational Uplift' }, note: 'You offered the cousins training and jobs. Two of them took the offer and are earning their own living!' } },
    ]
  },
  enc_bigman_c3: {
    id: 'enc_bigman_c3',
    title: 'The 37 Highway Police Stop',
    speaker: 'Night Patrol Commander',
    text: '"Good evening Boss. Your tinted windows require high-profile exemption papers. Anything for the weekend boys?"',
    choices: [
      { id: 'exemption', label: 'Produce the official DVLA tint permit', hint: 'Pristine legal paperwork', result: { rep: 4, mood: { v: 10, label: 'Flawless Paperwork' }, note: 'You showed the official permit with hologram. The officer saluted: "Proceed, Honorable!"' } },
      { id: 'polite', label: 'Hand over GH₵50 with genuine warmth', hint: 'Accra street etiquette', result: { cash: -50, rep: 2, mood: { v: 4, label: 'Smooth Transit' }, note: '"God bless your journey Boss! Safe driving in town!"' } },
    ]
  },
  enc_bigman_c4: {
    id: 'enc_bigman_c4',
    title: 'The Chieftaincy Stool Enstoolment',
    speaker: 'Paramount Chief of Ga State',
    text: '"For your endless support of education, water, and employment, we wish to enstool you as Nkosuohene (Chief of Development)."',
    choices: [
      { id: 'accept', label: 'Humbly accept the traditional stool and regalia', hint: 'Traditional chieftaincy honor', result: { rep: 8, mood: { v: 25, label: 'Enstooled Chief' }, note: 'Kente cloth was draped across your shoulder as the royal drums beat. You are now an official Development Chief!' } },
      { id: 'endow', label: 'Accept and endow the Paramount Youth Training Centre', hint: 'Combine honor with concrete investment', result: { cash: -3000, rep: 12, mood: { v: 30, label: 'Royal Benefactor' }, note: 'You laid the foundation stone for a modern computer centre. The whole kingdom celebrated with horns!' } },
    ]
  },
  enc_bigman_c5: {
    id: 'enc_bigman_c5',
    title: 'The State House Order of the Volta',
    speaker: 'President of the Republic',
    text: '"In recognition of outstanding service to the development, culture, and economic dignity of Ghana, we bestow this national honor upon you."',
    choices: [
      { id: 'honor', label: 'Dedicate the honor to every young dreamer in Jamestown', hint: 'Humble national icon', result: { rep: 15, mood: { v: 40, label: 'National Hero' }, note: '"If a boy from the compound house can stand here today, every child in Ghana can reach the stars." Historic moment!' } },
      { id: 'future', label: 'Announce a nationwide youth endowment partnership', hint: 'Transform national honors into lasting action', result: { cash: -5000, rep: 20, mood: { v: 45, label: 'Father of the Nation' }, note: 'Your initiative will fund 10,000 young entrepreneurs over the next decade. Your legacy is immortalized in Accra!' } },
    ]
  },

  // =========================================================================
  // DBEE ORIGIN ENCOUNTERS
  // =========================================================================

  enc_dbee_landlord_c1: {
    id: 'enc_dbee_landlord_c1',
    title: 'The Expat Diplomatic Tenant Dispute',
    speaker: "Ambassador's Housing Attache",
    text: 'The European attache renting Unit 3 claims the solar inverter dipped during an official diplomatic dinner and demands a 30% lease reduction or immediate contract termination.',
    choices: [
      { id: 'upgrade', label: 'Upgrade to industrial 20kVA lithium battery bank', hint: 'Invest in elite infrastructure (-GH₵500)', result: { cash: -500, rep: 4, mood: { v: 14, label: 'Unshakeable Landlord' }, note: 'You installed pristine tier-1 lithium storage with zero-second transfer. The embassy extended the lease for 3 years!' } },
      { id: 'terms', label: 'Point to the Force Majeure utility clause in the signed lease', hint: 'Stand on strict legal contract terms', result: { rep: 3, mood: { v: 8, label: 'Contractual Rigor' }, note: 'You calmly reviewed Section 14 of the contract with their legal team. They dropped the threat and apologized.' } },
      { id: 'champagne', label: 'Host an exclusive apology wine tasting for the delegation', hint: 'Diplomatic charm & hospitality (-GH₵150)', result: { cash: -150, rep: 3, mood: { v: 10, label: 'Gracious Host' }, note: 'Your hospitality charmed the attache. The incident became a lighthearted inside joke!' } },
    ]
  },

  enc_dbee_landlord_c2: {
    id: 'enc_dbee_landlord_c2',
    title: 'The Cantonments High-Stakes Auction',
    speaker: 'Elite Auctioneer Quaye',
    text: 'A rival old-money family is aggressively bidding against you for the final prime commercial half-acre off Cantonments Road.',
    choices: [
      { id: 'counter', label: 'Counter-bid with personal syndicate reserves', hint: 'Commit funds to secure the crown plot (-GH₵800)', result: { cash: -800, rep: 6, mood: { v: 18, label: 'Cantonments Victor' }, note: 'The gavel slammed down! The deed is yours. The rival family politely tipped their hats in defeat.' } },
      { id: 'zoning', label: 'Expose their pending boundary litigation to the council', hint: 'Sharp legal maneuvering', result: { rep: 5, mood: { v: 14, label: 'Savvy Strategist' }, note: 'You presented documentation of their boundary disputes. The committee disqualified their bid and awarded you the parcel!' } },
      { id: 'pivot', label: 'Graciously pivot to an East Legon corner plot', hint: 'Conserve capital · High long-term upside', result: { rep: 4, mood: { v: 10, label: 'Prudent Mogul' }, note: 'You let them overpay, then snapped up a prime corner in East Legon at a 40% discount!' } },
    ]
  },

  enc_dbee_star_c1: {
    id: 'enc_dbee_star_c1',
    title: 'The Jamestown Cypher Confrontation',
    speaker: 'Jamestown Cypher Leader',
    text: 'The street cypher crew looks at your clean designer jacket. "Dbee boy, this isn\'t American International School. Drop real bars with street soul or take your car back to Airport!"',
    choices: [
      { id: 'bars', label: 'Drop a fierce, authentic Ga and Twi freestyle', hint: 'Spit raw dialect rhythm', result: { rep: 5, mood: { v: 16, label: 'Born Spitter' }, note: 'Your punchlines landed with devastating Ga street cadence! The cypher erupted in roars and pounds of respect!' } },
      { id: 'humble', label: 'Freestyle self-deprecating humor about Dbee life', hint: 'Charm the crowd with hilarious wit', result: { rep: 4, mood: { v: 14, label: 'Crowd Charmer' }, note: 'You roasted your own silver-spoon struggles. The block broke into laughter and welcomed you with open arms!' } },
      { id: 'collab', label: 'Invite the best young street MC to feature on your single', hint: 'Elevate street talent', result: { rep: 5, mood: { v: 15, label: 'Talent Champion' }, note: 'You gave the 19-year-old kid a chance on the mic. Your collaborative freestyle trended across Accra TikTok by night!' } },
    ]
  },

  enc_dbee_star_c2: {
    id: 'enc_dbee_star_c2',
    title: 'The Radio Gatekeeper\'s Extortion',
    speaker: 'Old-Guard Radio DJ',
    text: '"Your father is a big man, so why are you acting stingy? Give me GH₵1,000 promo kola or my afternoon drive show ignores your single."',
    choices: [
      { id: 'boycott', label: 'Boycott legacy radio and launch a grassroots TikTok wave', hint: 'Let the youth decide the sound', result: { rep: 6, mood: { v: 18, label: 'Digital Pioneer' }, note: 'The youth danced to your sound on TikTok and street bars. The radio station ended up playing it anyway to stay relevant!' } },
      { id: 'diss', label: 'Drop a searing freestyle mocking crooked payola', hint: 'Fearless artistic rebellion', result: { rep: 7, mood: { v: 20, label: 'Fearless Voice' }, note: 'Your diss track caught fire! Fans praised your courage and the station management issued a public apology.' } },
      { id: 'leverage', label: 'Call the station owner who belongs to your polo network', hint: 'Elite social leverage', result: { rep: 4, mood: { v: 10, label: 'High Connected' }, note: 'One polite phone call resolved the matter. The DJ was reassigned to the 3 AM graveyard shift.' } },
    ]
  },

  enc_dbee_mogul_c1: {
    id: 'enc_dbee_mogul_c1',
    title: 'The Tema Port Customs Clearance Bottleneck',
    speaker: 'Chief Customs Controller',
    text: 'Your family container of consumer electronics has been delayed at the terminal. The controller smiles: "Systems are slow today, unless you pay GH₵400 administrative expedite."',
    choices: [
      { id: 'single_window', label: 'Present pre-cleared Single Window exemption papers', hint: 'Strict regulatory precision', result: { rep: 5, mood: { v: 14, label: 'Compliance Master' }, note: 'You pulled out the digital Single Window QR clearance certificate. His supervisor verified it and ordered immediate gate release!' } },
      { id: 'expedite', label: 'Pay the GH₵300 expedited processing fee', hint: 'Practical business compromise (-GH₵300)', result: { cash: -300, rep: 2, mood: { v: 6, label: 'Cargo Released' }, note: 'You bargained the fee down and got your trucks moving to retail stores before sunset.' } },
      { id: 'commissioner', label: 'Escalate directly to the Port Authority Director', hint: 'High-level executive intervention', result: { rep: 6, mood: { v: 16, label: 'Executive Authority' }, note: 'You phoned the Port Director\'s office. The container was cleared within 20 minutes with no illegal fees!' } },
    ]
  },

  enc_dbee_mogul_c2: {
    id: 'enc_dbee_mogul_c2',
    title: 'The Mall Retail Monopoly Battle',
    speaker: 'Accra Mall Leasing Director',
    text: 'A rival foreign import syndicate offers a massive under-the-table sum to take over your prime retail locations in Accra Mall and West Hills.',
    choices: [
      { id: 'stand_firm', label: 'Stand firm on your signed long-term leases', hint: 'Defend your commercial footprint', result: { rep: 6, mood: { v: 16, label: 'Retail Fortress' }, note: 'You proved your legal tenure was airtight. Your retail stores opened to record crowds and packed aisles!' } },
      { id: 'joint_venture', label: 'Propose an exclusive joint distribution partnership', hint: 'Turn competition into profit (+GH₵2,000)', result: { cash: 2000, rep: 4, mood: { v: 12, label: 'Strategic Dealmaker' }, note: 'You partnered on logistics and took 20% margin on their wholesale supply. Pure profit!' } },
      { id: 'expansion', label: 'Expand to Kumasi and Takoradi commercial malls', hint: 'Scale outside Greater Accra', result: { rep: 7, mood: { v: 18, label: 'National Tycoon' }, note: 'You expanded beyond Accra, locking down regional dominance across Ghana!' } },
    ]
  },

  enc_dbee_unicorn_c1: {
    id: 'enc_dbee_unicorn_c1',
    title: 'The Corporate Boardroom Intervention',
    speaker: 'Uncle Kenneth (Board Chairman)',
    text: '"Why are you burning your nights coding buggy apps in a garage? Take this VP role at our logistics firm: GH₵25,000 monthly salary, company Prado, and no stress!"',
    choices: [
      { id: 'reject', label: 'Defiantly reject the corporate golden handcuffs', hint: 'Bet 100% on your independent startup dream', result: { rep: 6, mood: { v: 20, label: 'Self-Made Visionary' }, note: '"I want to build something that touches millions of lives across Africa, not just warm a boardroom chair." The room went silent in stunned admiration.' } },
      { id: 'enterprise', label: 'Pitch the family firm as your startup\'s first enterprise customer', hint: 'Turn skepticism into cash (+GH₵1,000)', result: { cash: 1000, rep: 5, mood: { v: 15, label: 'Master Pitcher' }, note: 'You demonstrated your logistics routing API. Uncle Kenneth signed a GH₵1,000 annual pilot contract on the spot!' } },
      { id: 'consult', label: 'Accept part-time advisory while keeping startup ownership', hint: 'Smart cash cushion (+GH₵500)', result: { cash: 500, rep: 4, mood: { v: 10, label: 'Pragmatic Founder' }, note: 'You took a light advisory stipend while retaining 100% equity in your tech baby.' } },
    ]
  },

  enc_dbee_unicorn_c2: {
    id: 'enc_dbee_unicorn_c2',
    title: 'The Polo Club Shark Term Sheet',
    speaker: 'Venture Capital Partner Van-Hein',
    text: '"I will inject GH₵50,000 in your fintech app today, but I require 51% controlling equity and board veto rights since you are young."',
    choices: [
      { id: 'reject_shark', label: 'Tear up the term sheet and walk away', hint: 'Preserve startup founder sovereignty', result: { rep: 7, mood: { v: 20, label: 'Uncompromising Founder' }, note: 'You walked away from the predatory valuation. Three Silicon Valley funds reached out the next week offering 10x better terms!' } },
      { id: 'counter_safe', label: 'Counter with a standard 10% SAFE note at a GH₵500,000 cap', hint: 'Professional Silicon-standard negotiation', result: { cash: 2000, rep: 6, mood: { v: 16, label: 'Venture Architect' }, note: 'He realized you understood venture finance inside out. He signed the SAFE note on your terms!' } },
      { id: 'bootstrap', label: 'Rely purely on customer transaction fees', hint: 'Profitable bootstrapping path', result: { rep: 5, mood: { v: 14, label: 'Bootstrapped Boss' }, note: 'Your user base grew organically and transaction fees covered all server bills. You own 100% of the goldmine.' } },
    ]
  },

  enc_dbee_bigman_c1: {
    id: 'enc_dbee_bigman_c1',
    title: 'The Ambassador\'s Diplomatic Gala',
    speaker: 'Visiting Foreign Delegate',
    text: 'At an elite diplomatic charity dinner, a visiting trade envoy condescendingly remarks that Ghanaian entrepreneurs lack global sophistication.',
    choices: [
      { id: 'oratory', label: 'Deliver an eloquent, data-backed Pan-African rebuttal', hint: 'Oratorical masterclass', result: { rep: 7, mood: { v: 22, label: 'National Dignity' }, note: 'You cited Ghanaian economic milestones, tech innovations, and historical legacy. The entire banquet applauded your eloquence!' } },
      { id: 'philanthropy', label: 'Pledge an endowed education fellowship for local coders', hint: 'Lead through generous action (-GH₵800)', result: { cash: -800, rep: 8, mood: { v: 20, label: 'Civic Beacon' }, note: 'Your pledge shamed the cynics and earned you a personal commendation from the High Commissioner!' } },
      { id: 'charm_delegate', label: 'Charm him with private business matchmaking', hint: 'Convert a skeptic into an international partner', result: { rep: 5, mood: { v: 14, label: 'Global Diplomat' }, note: 'You introduced him to top Ghanaian founders and secured bilateral business commitments.' } },
    ]
  },

  enc_dbee_bigman_c2: {
    id: 'enc_dbee_bigman_c2',
    title: 'The Chieftaincy Council Succession',
    speaker: 'Clan Elder Nana Obeng',
    text: 'The family royal stool council convenes. Some elders question whether your modern lifestyle means you have forgotten ancient customs and ancestral duty.',
    choices: [
      { id: 'address', label: 'Deliver a fluent, respectful traditional Ga/Twi address', hint: 'Honor ancestral heritage with humility', result: { rep: 8, mood: { v: 25, label: 'Beloved Heir' }, note: 'You recited ancestral lineages flawlessly and poured traditional libation with deep reverence. Nana smiled and blessed your head.' } },
      { id: 'solar_palace', label: 'Endow clean solar power and a health clinic for the ancestral village', hint: 'Bring lasting modernity to tradition (-GH₵1,200)', result: { cash: -1200, rep: 12, mood: { v: 30, label: 'Dynastic Patron' }, note: 'The village celebrated with talking drums! You proved that modern wealth can preserve and honor heritage.' } },
      { id: 'council_chair', label: 'Propose a transparent youth enterprise board for the clan', hint: 'Progressive leadership vision', result: { rep: 7, mood: { v: 18, label: 'Modern Leader' }, note: 'The young elders rallied behind your vision. You were officially consecrated as the council executive head!' } },
    ]
  }
};

// =========================================================================
// Story State Helpers & Logic
// =========================================================================

export function initStory(state, dream) {
  if (!STORY_ARCS[dream]) dream = 'landlord';
  // If story already exists for this dream, preserve progress!
  if (state.story && state.story.dream === dream && state.story.missionId) {
    return state.story;
  }
  if (state.storyProgress && state.storyProgress[dream]) {
    state.story = state.storyProgress[dream];
    return state.story;
  }
  const isDbee = state.origin === 'dbee' || state.birthOrigin === 'dbee';
  const firstDbee = `${dream}_dbee_1_1`;
  const firstMissionId = (isDbee && STORY_MISSIONS[firstDbee]) ? firstDbee : `${dream}_1_1`;
  state.story = {
    dream,
    chapter: 1,
    step: 1,
    missionId: firstMissionId,
    completedMissions: state.story?.completedMissions || [],
    completedChapters: state.story?.completedChapters || [],
    completedEncounters: state.story?.completedEncounters || [],
    activeEncounter: null,
    history: state.story?.history || [],
    startedAt: Date.now(),
    at: Date.now()
  };
  return state.story;
}

export function activeStoryMission(state, ctx = {}) {
  const story = state.story;
  if (!story || !story.dream) return null;
  const arc = STORY_ARCS[story.dream];

  // If this story arc has been conquered, display completion and encourage next aspiration
  if (story.finished) {
    const text = `You have completed all 5 chapters of ${arc?.name || 'this story arc'}! Open Aspirations to choose your next dream or continue dominating Accra.`;
    return {
      id: `${story.dream}_completed`,
      finished: true,
      kind: 'main',
      dream: story.dream,
      arcName: arc?.name || 'Aspiration',
      accent: arc?.accent || '#10b981',
      title: `${arc?.name || 'Aspiration'} Conquered!`,
      desc: text,
      description: text,
      action: 'aspirations',
      hint: 'Tap to pick your next Aspiration',
      ready: false
    };
  }

  const isDbee = state.origin === 'dbee' || state.birthOrigin === 'dbee';

  // If player is a Dbee on an initial chapter and not started, seamlessly point to Dbee track
  if (isDbee && story.chapter <= 2 && (!story.completedMissions || story.completedMissions.length === 0)) {
    const dbeeEquivalent = `${story.dream}_dbee_${story.chapter}_${story.step}`;
    if (STORY_MISSIONS[dbeeEquivalent]) story.missionId = dbeeEquivalent;
  }

  const m = STORY_MISSIONS[story.missionId];
  if (!m) return null;

  // Evaluate condition
  let ready = false;
  if (m.isClimax && m.encounterId) {
    ready = (story.completedEncounters || []).includes(m.encounterId);
  } else if (typeof m.check === 'function') {
    try { ready = Boolean(m.check(state, ctx)); } catch { ready = false; }
  }

  const chapters = (isDbee && arc?.dbeeChapters) ? arc.dbeeChapters : (arc?.chapters || []);
  const ch = chapters?.find(c => c.num === story.chapter);

  return {
    ...m,
    description: m.desc || m.description,
    kind: 'main', // Explicitly tag as main story mission
    chapterTitle: ch ? `Chapter ${ch.num}: ${ch.title}` : `Chapter ${story.chapter}`,
    arcName: arc?.name || 'Aspiration',
    accent: arc?.accent || '#d97706',
    ready,
    activeEncounter: (!ready && m.isClimax && m.encounterId) ? STORY_ENCOUNTERS[m.encounterId] : null
  };
}

export function claimStoryMission(state, id, now = Date.now()) {
  const story = state.story;
  if (!story || story.missionId !== id) return { error: 'Not your active story mission.' };
  if ((story.completedMissions || []).includes(id)) {
    return { error: 'Mission already completed and claimed.' };
  }
  const m = STORY_MISSIONS[id];
  if (!m) return { error: 'Unknown story mission.' };

  // Verify completion
  let ready = false;
  if (m.isClimax && m.encounterId) {
    ready = (story.completedEncounters || []).includes(m.encounterId);
  } else if (typeof m.check === 'function') {
    ready = Boolean(m.check(state, { at: state.place, place: state.place, now }));
  }
  if (!ready) return { error: 'Mission requirements not yet completed.' };

  // Award rewards
  const rew = m.reward || {};
  if (rew.cash) { state.cash = (state.cash || 0) + rew.cash; state.ledger?.push([now, rew.cash, `Story: ${m.title}`]); }
  if (rew.momo) { state.momo = (state.momo || 0) + rew.momo; state.ledger?.push([now, rew.momo, `Story: ${m.title}`]); }
  if (rew.rep) { state.rep = (state.rep || 0) + rew.rep; }
  if (rew.badge) { state.flags.discoveryBadges = [...new Set([...(state.flags.discoveryBadges || []), rew.badge])]; }

  story.completedMissions.push(id);
  story.history.push({ id, completedAt: now, reward: rew });

  // Advance step or chapter
  const isDbee = state.origin === 'dbee' || state.birthOrigin === 'dbee';
  const nextStep = story.step + 1;
  const nextDbee = `${story.dream}_dbee_${story.chapter}_${nextStep}`;
  const nextStandard = `${story.dream}_${story.chapter}_${nextStep}`;
  const nextMissionId = (isDbee && STORY_MISSIONS[nextDbee]) ? nextDbee : (STORY_MISSIONS[nextStandard] ? nextStandard : null);

  if (nextMissionId) {
    story.step = nextStep;
    story.missionId = nextMissionId;
  } else {
    // End of chapter!
    story.completedChapters.push(story.chapter);
    const nextChapter = story.chapter + 1;
    const nextChDbee = `${story.dream}_dbee_${nextChapter}_1`;
    const nextChStandard = `${story.dream}_${nextChapter}_1`;
    const nextChapterFirst = (isDbee && STORY_MISSIONS[nextChDbee]) ? nextChDbee : (STORY_MISSIONS[nextChStandard] ? nextChStandard : null);
    if (nextChapterFirst) {
      story.chapter = nextChapter;
      story.step = 1;
      story.missionId = nextChapterFirst;
    } else {
      story.finished = true;
      story.missionId = null;
      state.dreamsDone = [...new Set([...(state.dreamsDone || []), story.dream])];
      state.dreamProgress ||= {};
      state.dreamProgress[story.dream] = (DREAM_TIERS[story.dream] || []).length || 5;
      state.dreamTier = state.dreamProgress[story.dream];
      if (state.storyProgress) {
        state.storyProgress[story.dream] = structuredClone(story);
      }
      return { ok: true, mission: m, reward: rew, arcFinished: true, arc: STORY_ARCS[story.dream] };
    }
  }

  return { ok: true, mission: m, reward: rew };
}

export function resolveStoryChoice(state, encounterId, choiceId, now = Date.now()) {
  const enc = STORY_ENCOUNTERS[encounterId];
  if (!enc) return { error: 'Unknown encounter.' };
  const choice = enc.choices?.find(c => c.id === choiceId);
  if (!choice) return { error: 'Unknown choice.' };

  const res = choice.result || {};
  if (res.cash) {
    if (res.cash < 0) {
      const lost = Math.min(state.cash || 0, -res.cash);
      state.cash = Math.max(0, (state.cash || 0) - lost);
      state.ledger?.push([now, -lost, enc.title]);
    } else {
      state.cash = (state.cash || 0) + res.cash;
      state.ledger?.push([now, res.cash, enc.title]);
    }
  }
  if (res.rep) state.rep = Math.max(0, (state.rep || 0) + res.rep);
  if (res.mood) {
    state.mood = Math.max(-50, Math.min(50, (state.mood || 0) + res.mood.v));
  }

  state.story ||= {};
  state.story.completedEncounters = [...new Set([...(state.story.completedEncounters || []), encounterId])];
  state.story.history.push({ encounterId, choiceId, note: res.note, at: now });

  return { ok: true, encounter: enc, choice, note: res.note };
}

// Compatibility exports for older callers
export const DREAM_TIERS = {
  bigman: [['Get any job', (s) => !!s.job], ['Get promoted once', (s) => s.stats.promos >= 1], ['Reach rank 3 in a career', (s) => s.job && s.job.rank >= 2], ['Net worth GH₵150,000', (s, c) => c.worth >= 150000], ['Top rank of any career', (s) => s.job && s.job.rank >= 4]],
  landlord: [['Save GH₵5,000', (s) => s.cash + s.momo >= 5000], ['Rent a self-contain or better', (s) => ['labadi', 'osu', 'airres', 'legon', 'trasacco'].includes(s.home)], ['Own a plot of land', (s) => Object.keys(s.land).length > 0], ['Net worth GH₵1,000,000', (s, c) => c.worth >= 1000000], ['Own your own house', (s) => Object.keys(s.owned).length > 0]],
  star: [['Music level 2', (s) => s.skills.music >= 2], ['Perform at Vibes Lounge', (s, c) => c.cnt('act:battle') >= 1], ['Music level 6', (s) => s.skills.music >= 6], ['Work as a DJ or radio host (rank 2+)', (s) => s.job && ['dj', 'radio'].includes(s.job.id) && s.job.rank >= 1], ['Music level 10', (s) => s.skills.music >= 10]],
  chale: [['Send five private messages', (s, c) => c.cnt('dm') >= 5], ['Join twenty conversations', (s, c) => c.cnt('chat') >= 20], ['Make a friend', (s) => Object.values(s.friends || {}).some(f => f.pts >= 30)], ['Build a close friendship', (s) => Object.values(s.friends || {}).some(f => f.pts >= 70)], ['Get engaged', (s) => !!s.flags.engaged]],
  unicorn: [['Coding level 3', (s) => s.skills.coding >= 3], ['Finish your MVP', (s) => (s.flags.mvp || 0) >= 100 || (s.flags.round || 0) > 0], ['Raise pre-seed', (s) => (s.flags.round || 0) >= 1], ['Raise seed', (s) => (s.flags.round || 0) >= 2], ['Raise Series A', (s) => (s.flags.round || 0) >= 3]],
  mogul: [['Own a business', (s) => Object.keys(s.biz).length >= 1], ['Own 3 businesses', (s) => Object.keys(s.biz).length >= 3], ['Business profit GH₵20,000 total', (s, c) => c.cnt('bizIncome') >= 20000], ['Own a trotro', (s) => !!s.biz.trotro], ['Own a share of a club', (s) => !!s.biz.club]],
  politician: [['Reputation 10', (s) => s.rep >= 10], ['Make five acquaintances', (s) => Object.values(s.friends || {}).filter(f => f.pts >= 10).length >= 5], ['Reputation 25', (s) => s.rep >= 25], ['Donate GH₵10,000 to your community', (s, c) => c.cnt('donate') >= 10000], ['Reputation 40', (s) => s.rep >= 40]],
  saint: [['Go to church or mosque 3 times', (s, c) => c.cnt('loc:church') + c.cnt('loc:mosque') >= 3], ['Build a good reputation', (s) => s.rep >= 10], ['Help other players five times', (s, c) => c.cnt('sent') >= 5], ['Build three friendships', (s) => Object.values(s.friends || {}).filter(f => f.pts >= 30).length >= 3], ['Donate GH₵50,000', (s, c) => c.cnt('donate') >= 50000]],
};
export const DREAM_INFO = {
  mogul: { name: 'Business Mogul', ic: 'icon:buildings', desc: 'Build an empire of businesses across Accra.' },
  politician: { name: 'The Honourable', ic: 'icon:circle', desc: 'Earn respect across Accra.' },
  saint: { name: 'Good Samaritan', ic: 'icon:circle', desc: 'Stay clean, help your people, keep the faith.' },
};
export const TIER_REWARD = [[150, 3], [400, 5], [1500, 8], [5000, 12], [15000, 20]];
export const CONTACTS = {}, MISSIONS = [], MISSION_REWARD = 0, STREAK_BONUS = [], BEATS = [];
