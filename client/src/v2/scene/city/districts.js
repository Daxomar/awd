// Family mixes describe architectural variety, not inhabitants or economic status.
export const FAMILIES = {
  historic: { label: 'Historic coastal streets', width: [12, 24], depth: [15, 28], floors: [1, 3], roof: 'hip', spacing: 56, setback: 19, trees: .12, wall: '#d9b99a', ground: '#c7baa0', courtyard: true },
  compound: { label: 'Courtyard compounds', width: [18, 32], depth: [18, 32], floors: [1, 2], roof: 'gable', spacing: 58, setback: 22, trees: .10, wall: '#d6c4a8', ground: '#c4b69b', courtyard: true },
  commercial: { label: 'Commercial blocks and markets', width: [15, 34], depth: [20, 36], floors: [2, 5], roof: 'flat', spacing: 65, setback: 24, trees: .06, wall: '#dfc9a6', ground: '#c6bba7', frontage: true },
  mixed: { label: 'Shops, apartments and verandas', width: [14, 29], depth: [16, 30], floors: [2, 4], roof: 'flat', spacing: 69, setback: 25, trees: .21, wall: '#e1d4bf', ground: '#c8c2a9', frontage: true },
  established: { label: 'Gardens and established homes', width: [16, 29], depth: [18, 32], floors: [1, 3], roof: 'hip', spacing: 82, setback: 34, trees: .58, wall: '#ded9c8', ground: '#afbb99', boundary: true },
  modern: { label: 'Compounds and apartments', width: [20, 36], depth: [20, 38], floors: [2, 4], roof: 'flat', spacing: 96, setback: 40, trees: .53, wall: '#e9e3d5', ground: '#b5c29d', boundary: true },
  office: { label: 'Offices and commercial campuses', width: [24, 42], depth: [24, 40], floors: [4, 12], roof: 'flat', spacing: 115, setback: 42, trees: .40, wall: '#abc1c2', ground: '#bec6b6', glass: true },
  campus: { label: 'Institutional campus courts', width: [24, 44], depth: [24, 40], floors: [2, 4], roof: 'hip', spacing: 125, setback: 46, trees: .84, wall: '#e2d8c0', ground: '#9eaf86', courtyard: true },
  industrial: { label: 'Warehouses and service yards', width: [32, 70], depth: [35, 80], floors: [1, 2], roof: 'gable', spacing: 125, setback: 58, trees: .08, wall: '#b8bdb7', ground: '#bcb9aa', warehouse: true },
  suburb: { label: 'Growing residential streets', width: [15, 30], depth: [18, 34], floors: [1, 3], roof: 'hip', spacing: 108, setback: 38, trees: .55, wall: '#d9cfb7', ground: '#b7ba96', boundary: true },
  coastal: { label: 'Coastal courts and shelters', width: [12, 24], depth: [14, 26], floors: [1, 2], roof: 'gable', spacing: 68, setback: 23, trees: .33, wall: '#decbb2', ground: '#cfc3a4', courtyard: true },
  transport: { label: 'Transport yards and shop streets', width: [18, 34], depth: [20, 35], floors: [1, 4], roof: 'flat', spacing: 72, setback: 30, trees: .11, wall: '#d3c8ae', ground: '#bdb9a7', frontage: true }
};
// Names/aliases resolve to OSM place nodes in the committed extract. Hand-authored
// secondary anchors, where needed, are explicitly marked in district-anchors.json.
export const DISTRICT_SPECS = [
  ['jamestown','Jamestown','historic','coastal',1200],['ussher','Usshertown','historic','commercial',850,'Ussher Town'],['bukom','Bukom','historic','compound',650],['chorkor','Chorkor','coastal','compound',1300],['korle-gonno','Korle Gonno','coastal','established',1100],
  ['makola','Makola','commercial','historic',750],['central','Central Accra','commercial','mixed',1000,'Accra Central'],['high-street','High Street','historic','office',650],['ministries','Ministries','office','campus',1000],['ridge','Ridge','office','established',1250,'North Ridge'],
  ['circle','Kwame Nkrumah Circle','transport','commercial',1100,'Circle'],['kaneshie','Kaneshie','transport','mixed',1400],['lapaz','Lapaz','transport','commercial',1400,'La Paz'],['abeka','Abeka','compound','mixed',1100],['nima','Nima','compound','mixed',1000],['maamobi','Maamobi','compound','mixed',1000,'Mamobi'],['madina','Madina','commercial','compound',1700],['achimota','Achimota','transport','established',1500],['odorkor','Odorkor','mixed','compound',1600],
  ['osu','Osu / Oxford Street','mixed','historic',1600,'Osu'],['la','Labadi / La','coastal','mixed',1500,'Labadi'],['teshie','Teshie','coastal','established',2000],['nungua','Nungua','mixed','coastal',2000],['dansoman','Dansoman','established','mixed',2200],['dzorwulu','Dzorwulu','established','office',1400],['abelemkpe','Abelemkpe','established','mixed',1100],['tesano','Tesano','established','office',1100],['north-kaneshie','North Kaneshie','established','mixed',1300],
  ['east-legon','East Legon','modern','mixed',2400],['adjiringanor','Adjiringanor','modern','suburb',2200],['cantonments','Cantonments','established','modern',1500],['airport-residential','Airport Residential','modern','established',1450,'Airport Residential Area'],['airport-city','Airport City','office','mixed',1100],['roman-ridge','Roman Ridge','established','office',1100],['spintex','Spintex','mixed','industrial',2300],['baatsona','Baatsona','mixed','modern',1600],['sakumono','Sakumono','established','modern',1800],
  ['legon','Legon / University of Ghana','campus','established',2300,'Legon'],['haatso','Haatso','suburb','mixed',1900],['forest','Achimota Forest vicinity','campus','established',1500,'Achimota Forest'],['adenta','Adenta','suburb','mixed',2500,'Adentan'],['oyarifa','Oyarifa','suburb','modern',2600],['botwe','Ashaley Botwe','suburb','modern',2300],['dome','Dome','mixed','suburb',1800],['taifa','Taifa','suburb','compound',1700],['kwabenya','Kwabenya','suburb','modern',2600],
  ['tema','Tema residential communities','established','mixed',3500,'Tema'],['tema-industrial','Tema industrial / port','industrial','office',3200,'Tema Industrial Area'],['community-25','Community 25','modern','suburb',2700,'Tema Community 25'],['ashaiman','Ashaiman','compound','commercial',2700],['lashibi','Lashibi','suburb','modern',2200],['prampram','Prampram','coastal','suburb',2400],['weija','Weija','suburb','mixed',2400],['gbawe','Gbawe','suburb','compound',2400],['mallam','Mallam','transport','mixed',1600],['kasoa','Kasoa corridor','mixed','suburb',2900,'Kasoa'],
  ['labone','Labone','established','mixed',1000],['korle-bu','Korle Bu','campus','mixed',1100,'Korle-Bu'],['tetteh-quarshie','Tetteh Quarshie','transport','office',900],['trasacco','Trasacco Valley','modern','suburb',1500],['new-town','Accra New Town','compound','mixed',950],['adabraka','Adabraka','mixed','commercial',1100],['amasaman','Amasaman','suburb','mixed',2400],['pokuase','Pokuase','transport','suburb',2000],['ofankor','Ofankor','established','suburb',1700],['bortianor','Bortianor','coastal','suburb',2200],['legon-hills','East Legon Hills','suburb','modern',2400],['tema-heavy-industry','Tema heavy industrial area','industrial','office',2500]
];
const normal = s => s.toLowerCase().replace(/[^a-z0-9]/g, '');
export function resolveDistricts(data, anchors) {
  return DISTRICT_SPECS.map(([id, name, family, secondary, radius, alias]) => {
    const authored = anchors[id];
    const place = authored?.osm ? data.places.find(p => p.osm === authored.osm) : data.places.find(p => [normal(alias || name),normal(name)].includes(normal(p.name)));
    const p = place?.p || authored?.p;
    if (!p) throw new Error(`Missing geographic anchor: ${name}`);
    return { id, name, family, secondary, radius, x: p[0], z: p[1], provenance: place ? `OSM node ${place.osm}` : authored.source, approximate: !place };
  });
}
export function nearestDistrict(districts, x, z) {
  let selected = null, score = Infinity;
  for (const d of districts) {
    const n = Math.hypot(x - d.x, z - d.z) / d.radius;
    if (n < score) { score = n; selected = d; }
  }
  return { district: selected, score };
}
