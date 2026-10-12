// Binary wire format (little-endian). Low-frequency messages are JSON text frames.
// C→S  MOVE  : u8 op=1 | u16 seq | f32 x | f32 z | i16 yaw | u8 anim | u8 flags            (15 B)
// S→C  SNAP  : u8 op=2 | u32 tick | u16 n | n × ( u32 id | f32 x | f32 z | i16 yaw | u8 anim )  (7 + 15n B)
export const OP_MOVE = 1, OP_SNAP = 2;
export const ENT_BYTES = 15;
const PI = Math.PI;
export const packYaw = (y) => Math.max(-32767, Math.min(32767, Math.round((((y + PI) % (2 * PI) + 2 * PI) % (2 * PI) - PI) / PI * 32767)));
export const unpackYaw = (v) => (v / 32767) * PI;

export function decodeMove(buf) {
  if (buf.byteLength !== 15) return null;
  const dv = new DataView(buf);
  if (dv.getUint8(0) !== OP_MOVE) return null;
  const x = dv.getFloat32(3, true), z = dv.getFloat32(7, true);
  if (!Number.isFinite(x) || !Number.isFinite(z)) return null;
  return { seq: dv.getUint16(1, true), x, z, yaw: unpackYaw(dv.getInt16(11, true)), anim: dv.getUint8(13), flags: dv.getUint8(14) };
}
export function encodeMove(seq, x, z, yaw, anim, flags = 0) {
  const b = new ArrayBuffer(15), dv = new DataView(b);
  dv.setUint8(0, OP_MOVE); dv.setUint16(1, seq & 0xffff, true); dv.setFloat32(3, x, true); dv.setFloat32(7, z, true);
  dv.setInt16(11, packYaw(yaw), true); dv.setUint8(13, anim & 255); dv.setUint8(14, flags & 255);
  return b;
}
// Writes one entity record into dv at offset o.
export function writeEnt(dv, o, p) {
  dv.setUint32(o, p.id, true); dv.setFloat32(o + 4, p.x, true); dv.setFloat32(o + 8, p.z, true);
  dv.setInt16(o + 12, packYaw(p.yaw), true); dv.setUint8(o + 14, p.anim & 255);
}
export function decodeSnap(buf) {
  const dv = new DataView(buf); const tick = dv.getUint32(1, true), n = dv.getUint16(5, true); const ents = [];
  for (let i = 0, o = 7; i < n; i++, o += ENT_BYTES) ents.push({ id: dv.getUint32(o, true), x: dv.getFloat32(o + 4, true), z: dv.getFloat32(o + 8, true), yaw: unpackYaw(dv.getInt16(o + 12, true)), anim: dv.getUint8(o + 14) });
  return { tick, ents };
}
