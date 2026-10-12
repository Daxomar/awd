// Camera framing helper for the cutaway rooms. Room.build() frames by the room's longest side, which crops the
// iso diamond on a portrait phone; fitRoom() picks a zoom that shows the whole slab (width-limited on portrait).
export function fitRoom(stage, spec, zoom = null) {
  const { w, d } = spec; const v = stage.view; const a = stage.aspect || innerWidth / innerHeight;
  const c = Math.cos(v.yaw), s = Math.sin(v.yaw), sp = Math.sin(v.pitch), cp = Math.cos(v.pitch); const H = spec.outdoor ? 1.2 : (spec.wallH || 2.7);
  // project the 8 slab/wall corners onto the camera's screen axes
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  for (const px of [-w / 2, w / 2]) for (const pz of [-d / 2, d / 2]) for (const py of [-0.4, H]) {
    const sx = px * c - pz * s; const sy = py * cp - (px * s + pz * c) * sp;
    x0 = Math.min(x0, sx); x1 = Math.max(x1, sx); y0 = Math.min(y0, sy); y1 = Math.max(y1, sy);
  }
  const need = Math.max((y1 - y0) * 1.12, ((x1 - x0) * 1.06) / a);
  v.zoom = zoom || need; stage.zoomMin = Math.min(4.5, v.zoom * 0.5); stage.zoomMax = Math.max(v.zoom * 1.15, stage.zoomMax || 0);
  // centre on the slab's screen-space middle (shift target up the view so the room sits slightly low, leaving HUD room)
  v.target.set(0, 0.3, 0); stage.applyView();
  return v.zoom;
}
