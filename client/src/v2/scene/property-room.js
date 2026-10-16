// Presentation only. The server's current room capability controls access/actions.
const THEMES = Object.freeze({
  neutral: {wallColor:'#eee7d9',floorColor:'#cbb99b'},
  coastal: {wallColor:'#d7e8e4',floorColor:'#d7c7ac'},
  earth: {wallColor:'#e5cdb5',floorColor:'#ab8a66'},
});

/** Adapt an existing homeSpec result without mutating its template or inventory. */
export function propertyRoomSpec(base, context) {
  if (!context?.unit || !context.template) throw new Error('A verified property room is required');
  const spec = structuredClone(base);
  const theme = THEMES[context.theme];
  if (theme) Object.assign(spec, theme);
  spec.name = String(context.name || 'Property');
  spec.sign = {...spec.sign,text:spec.name,bg:spec.sign?.bg||'#315a45',fg:spec.sign?.fg||'#fffaf0'};
  spec.property = {unit:context.unit,revision:context.revision,mine:context.mine===true,canAct:context.canAct===true,canFurnish:context.canFurnish===true};
  // A tour displays the real furniture, but cannot offer owner-only home actions.
  if (!spec.property.canAct) {
    for (const item of spec.items || []) item.acts = [];
    for (const zone of spec.zones || []) zone.acts = [];
  }
  const spawn = spec.spawn || {x:0,z:0};
  spec.items ||= [];
  spec.zones ||= [];
  const item = spec.items.length;
  spec.items.push({kind:'doormat',x:spawn.x,z:spawn.z,label:'Property entrance',acts:[]});
  spec.zones.push({id:'property-exit',label:'Walk outside',icon:'ph-person-simple-walk',item,acts:[],route:'property-exit',propertyUnit:context.unit,destination:context.exit});
  return spec;
}
