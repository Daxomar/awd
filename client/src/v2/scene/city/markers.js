// Pure screen-space layout. Suppressed markers remain available in Places.
export function pinPosition(item,slotOf,display){
  if(item.id==='home')return (item.homeId?slotOf('h:'+item.homeId):null)||item.xz||display(item.x,item.z);
  return slotOf(item.id)||display(item.x,item.z);
}
export function clusterMarkers(input, { width, height, top = 168, bottom = 150, radius = 46, inset = 24 }) {
  const visible = input.filter(p => p.sx >= inset && p.sx <= width - inset && p.sy >= top + 24 && p.sy <= height - bottom - 24 && p.depth >= -1 && p.depth <= 1);
  visible.sort((a, b) => Number(!!b.keep) - Number(!!a.keep) || (b.count || 0) - (a.count || 0) || a.id.localeCompare(b.id));
  const groups = [];
  for (const p of visible) {
    const near = groups.find(g => Math.hypot(g.sx - p.sx, g.sy - p.sy) < radius);
    if (near) near.items.push(p); else groups.push({ sx: p.sx, sy: p.sy, items: [p] });
  }
  return groups;
}
