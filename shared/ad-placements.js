// Authored simulation inventory; no arbitrary player parcels. See docs/advertising-inventory.md.
const LAT0 = 5.556, LON0 = -0.2, KX = 111320 * Math.cos((LAT0 * Math.PI) / 180), KZ = 110574;
const proj = (lat, lon) => [Math.round((lon - LON0) * KX), Math.round(-(lat - LAT0) * KZ)];
export const AD_PLACEMENTS = [
  { id: 'circle', name: 'Kwame Nkrumah Interchange (Circle)', ll: [5.5712, -0.2142], price: 1200, tier: 'MEGA', yaw: 2.4 },
  { id: 'oxford', name: 'Oxford Street, Osu', ll: [5.5590, -0.1826], price: 1200, tier: 'MEGA', yaw: 1.6 },
  { id: 'airportcity', name: 'Airport City roundabout', ll: [5.6010, -0.1758], price: 1200, tier: 'MEGA', yaw: 3.1 },
  { id: 'accramall', name: 'Tetteh Quarshie / Accra Mall', ll: [5.6215, -0.1740], price: 1000, tier: 'MEGA', yaw: 2.0 },
  { id: 'makola', name: 'Makola Market', ll: [5.5490, -0.2080], price: 800, tier: 'Standard', yaw: 0.8 },
  { id: 'kaneshie', name: 'Kaneshie First Light', ll: [5.5675, -0.2340], price: 800, tier: 'Standard', yaw: 1.2 },
  { id: 'labadi', name: 'Labadi Beach Road', ll: [5.5615, -0.1500], price: 800, tier: 'Standard', yaw: 3.6 },
  { id: 'legon', name: 'East Legon, A&C Mall road', ll: [5.6330, -0.1630], price: 800, tier: 'Standard', yaw: 1.0 },
  { id: 'stadium', name: 'Accra Sports Stadium', ll: [5.5525, -0.1915], price: 800, tier: 'Standard', yaw: 4.4 },
  { id: 'jamestown', name: 'Jamestown Lighthouse', ll: [5.5335, -0.2118], price: 500, tier: 'Community', yaw: 0.2 },
  { id: 'kotoka_arr', name: 'Kotoka Airport · Arrivals', ll: [5.6035, -0.1700], price: 3500, tier: 'Exclusive', exclusive: true, yaw: 3.4 },
  { id: 'kotoka_dep', name: 'Kotoka Airport · Departures', ll: [5.6048, -0.1688], price: 3500, tier: 'Exclusive', exclusive: true, yaw: 3.4 },
  { id:'madina',name:'Madina commercial forecourt',ll:[5.6735,-0.1648],price:800,tier:'Standard',yaw:1.2 },
  { id:'tema',name:'Tema Community One commercial forecourt',ll:[5.6445,-0.0015],price:800,tier:'Standard',yaw:1.8 },
  { id:'ground_mall',name:'Accra Mall · designated plaza panel',ll:[5.6184830430300075,-0.17301371551221617],price:800,tier:'Ground rental',type:'ground',exclusive:true,width:6,height:3,yaw:0,surface:'commercial paved forecourt',offset:[0,0] },
  { id:'ground_osu',name:'Oxford Street · commercial courtyard panel',ll:[5.555370223747891,-0.1843085283239743],price:1200,tier:'Ground rental',type:'ground',exclusive:true,width:6,height:3,yaw:0,surface:'commercial courtyard',offset:[0,0] },
  { id:'ground_hotel',name:'Airport hotel · event forecourt panel',ll:[5.604510499755819,-0.17900665628140966],price:1000,tier:'Ground rental',type:'ground',exclusive:true,width:6,height:3,yaw:0,surface:'designated paved event forecourt',offset:[0,0] },
].map((s) => { const [x, z] = proj(...s.ll); return { type:'billboard',width:s.tier==='MEGA'?12:9,height:s.tier==='MEGA'?6:4.5,visibility:{minSeconds:2,minPixels:400,estimated:true}, ...s, x, z }; });
