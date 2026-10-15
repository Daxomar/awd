const smooth = n => { const t = Math.max(0, Math.min(1, n)); return t * t * (3 - 2 * t); };

// A shirt bridges small surface details rather than reproducing every contour of
// the underlying anatomy. Sample the selected body, including its morphs, so a
// fuller chest still has enough room. Skin, arms and face are never reshaped here.
export function shirtEnvelope(positions, limbFields, rig) {
  const step = .025, bins = new Map(), centre = rig.Hips.z;
  for (let i = 0; i < positions.length; i += 3) {
    const [x,y,z] = positions.slice(i, i + 3);
    if (limbFields[i / 3] < .7 || y < rig.Hips.y - .04 || y > rig.Neck.y - .025) continue;
    const key = Math.floor(y / step), bin = bins.get(key) || { width: .06, front: .04 };
    bin.width = Math.max(bin.width, Math.abs(x)); bin.front = Math.max(bin.front, z - centre);
    bins.set(key, bin);
  }
  return (position, limb) => {
    const [x,y,z] = position;
    if (limb < .7 || z < centre + .015) return position;
    const sample = y / step, key = Math.floor(sample); let weight = 0, width = 0, front = 0;
    for (let k = key - 5; k <= key + 5; k++) {
      const bin = bins.get(k); if (!bin) continue;
      const w = Math.exp(-(((k + .5 - sample) / 2.5) ** 2));
      width += bin.width * w; front += bin.front * w; weight += w;
    }
    if (!weight) return position;
    width /= weight; front /= weight;
    const shape = Math.max(0, 1 - (x / (width * 1.12)) ** 4) ** .25;
    const blend = smooth((rig.Neck.y - .025 - y) / .09) * smooth((y - rig.Hips.y + .04) / .08);
    position[2] += (centre + (front + .018) * shape - z) * blend;
    return position;
  };
}
