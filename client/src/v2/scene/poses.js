// Procedural pose overrides applied on top of the mixer every frame (Room.update calls applyPose after mixer.update).
// Rig-agnostic: each limb bone is swung (shortest arc, in world space) so the segment bone→child points along a target
// direction given in the avatar's own frame (+z forward, +y up, +x = character's left). The animated twist is kept,
// so idle breathing still shows in the torso/head. Hips are translated by moving avatar.model so the pelvis lands on
// the seat (root y = use-point y, set by Room). Works for the RPM ('m') and Mixamo Michelle ('f') rigs.
//   stand  – no override (restores model offset/rotation)
//   sit    – on a chair/bench: thighs forward, shins down, hands on lap
//   sit_floor – cross-legged on a mat/rug/floor
//   lie    – on the back (head toward -z of the item), legs straight, arms by the sides
//   work   – standing, forearms forward (counter, stove, desk at standing height)
//   type   – seated variant of sit with hands forward on a desk/keyboard
//   lean   – standing, weight on one hip, arms folded-ish
//   squat  – low crouch (coal pot, fish tray, net pulling)
//   pray   – kneeling, upright torso, hands together in front
//   cheer  – standing, both arms raised (fans, party)
//   guard  – boxing stance (fists up); keeps the use-point height (ring floor)
//   wade   – waist-deep in water: use-point y is negative so the slab hides the legs; arms out on the surface
import * as THREE from 'three';

const _v = new THREE.Vector3(), _a = new THREE.Vector3(), _b = new THREE.Vector3(), _q = new THREE.Quaternion(), _wq = new THREE.Quaternion(), _pq = new THREE.Quaternion(), _rq = new THREE.Quaternion(), _m = new THREE.Matrix4();
const N = (x, y, z) => new THREE.Vector3(x, y, z).normalize();

// bone lookup per model, names normalised ('mixamorigLeftArm' / 'mixamorig:LeftArm' / 'LeftArm' → 'LeftArm')
function rig(av) {
  if (av._rig) return av._rig;
  const bones = {}; av.model.traverse((o) => { if (o.isBone) bones[o.name.replace(/^mixamorig:?/i, '')] = o; });
  const kid = (n, c) => bones[n] && bones[c] ? [bones[n], bones[c]] : null;
  const R = { bones, seg: {} };
  for (const s of ['Left', 'Right']) {
    R.seg[s + 'UpLeg'] = kid(s + 'UpLeg', s + 'Leg'); R.seg[s + 'Leg'] = kid(s + 'Leg', s + 'Foot'); R.seg[s + 'Foot'] = kid(s + 'Foot', s + 'ToeBase');
    R.seg[s + 'Arm'] = kid(s + 'Arm', s + 'ForeArm'); R.seg[s + 'ForeArm'] = kid(s + 'ForeArm', s + 'Hand'); R.seg[s + 'Hand'] = kid(s + 'Hand', s + 'HandMiddle1');
  }
  R.seg.Spine = kid('Spine', 'Neck');
  R.hips = bones.Hips;
  av._rig = R; return R;
}

// swing bone so (bone→child) points along dir (expressed in the avatar root frame)
function aim(R, name, dir, rootQ) {
  const s = R.seg[name]; if (!s) return; const [b, c] = s;
  b.getWorldPosition(_a); c.getWorldPosition(_b); const cur = _b.sub(_a); if (cur.lengthSq() < 1e-8) return; cur.normalize();
  _v.copy(dir).applyQuaternion(rootQ);
  _q.setFromUnitVectors(cur, _v);
  b.getWorldQuaternion(_wq); _wq.premultiply(_q);
  b.parent.getWorldQuaternion(_pq); b.quaternion.copy(_pq.invert().multiply(_wq));
  b.updateMatrixWorld(true);
}

// target directions; L = character's left (+x). mirror() flips x for the right side.
const P = {
  relaxed: { UpLeg:N(.025,-1,0),Leg:N(0,-1,.01),Foot:N(0,-.4,1),Arm:N(.14,-1,.04),ForeArm:N(.04,-1,.12),Hand:N(0,-1,.1),hips:null },
  sit: { UpLeg: N(0.1, -0.08, 1), Leg: N(0.02, -1, 0.12), Foot: N(0, -0.25, 1), Arm: N(0.12, -0.92, 0.3), ForeArm: N(-0.35, -0.35, 1), Hand: N(-0.2, -0.4, 1), hips: [0, 0.1, -0.06] },
  type: { UpLeg: N(0.1, -0.08, 1), Leg: N(0.02, -1, 0.12), Foot: N(0, -0.25, 1), Arm: N(0.1, -0.78, 0.6), ForeArm: N(-0.3, -0.05, 1), Hand: N(-0.1, -0.2, 1), hips: [0, 0.1, -0.06] },
  sit_floor: { UpLeg: N(0.75, 0.08, 0.66), Leg: N(-0.92, -0.06, 0.35), Foot: N(-0.4, 0, 0.9), Arm: N(0.2, -0.88, 0.42), ForeArm: N(-0.1, -0.5, 1), Hand: N(0, -0.6, 1), hips: [0, 0.12, 0], cross: true },
  lie: { UpLeg: N(0.06, 0, 1), Leg: N(0.02, 0, 1), Foot: N(0, 1, 0.3), Arm: N(0.22, -0.08, 1), ForeArm: N(0.05, 0.05, 1), Hand: N(0, 0, 1), hips: [0, 0.13, -0.12], lie: true },
  work: { Arm: N(0.18, -0.75, 0.62), ForeArm: N(-0.22, -0.28, 1), Hand: N(-0.1, -0.5, 1) },
  lean: { UpLeg: N(0.05, -1, 0.02), Arm: N(0.15, -0.9, 0.35), ForeArm: N(-1, 0.25, 0.4), Hand: N(-1, 0, 0.2), hips: null },
  squat: { UpLeg: N(0.28, 0.1, 1), Leg: N(0.06, -1, -0.38), Foot: N(0, -0.15, 1), Arm: N(0.2, -0.75, 0.62), ForeArm: N(-0.25, -0.55, 1), Hand: N(0, -0.7, 1), hips: [0, 0.48, 0] },
  pray: { UpLeg: N(0.08, -1, 0.06), Leg: N(0, -0.05, -1), Foot: N(0, -0.6, -1), Arm: N(0.12, -0.85, 0.45), ForeArm: N(-0.75, 0.35, 0.55), Hand: N(-0.4, 0.8, 0.3), hips: [0, 0.6, 0] },
  cheer: { Arm: N(0.45, 0.88, 0.1), ForeArm: N(0.15, 1, 0.05), Hand: N(0, 1, 0) },
  guard: { Arm: N(0.38, -0.55, 0.55), ForeArm: N(-0.35, 0.78, 0.5), Hand: N(-0.1, 1, 0.2) },
  wade: { Arm: N(0.75, -0.45, 0.35), ForeArm: N(0.45, -0.1, 0.85), Hand: N(0.3, -0.2, 1) },
};
const mirror = (v) => new THREE.Vector3(-v.x, v.y, v.z);
for (const k in P) { const p = P[k]; p.R = {}; for (const part of ['UpLeg', 'Leg', 'Foot', 'Arm', 'ForeArm', 'Hand']) if (p[part]) { p.R[part] = mirror(p[part]); } }
// cross-legged: right shin crosses in front of the left one
P.sit_floor.R.Leg = N(0.92, 0.04, 0.4);

export const POSES = ['stand', ...Object.keys(P)];

// armsFree: an action clip (scene/actions.js) is driving the arms; only legs and hips are posed.
export function applyPose(av, pose, armsFree = false) {
  const m = av.model;
  const p = pose==='stand'&&av.native&&av.curName==='idle'?P.relaxed:P[pose];
  if (!p) { if (av._posed) { m.position.set(0, 0, 0); m.rotation.set(0, 0, 0); av._posed = false; } return; }
  const R = rig(av); av._posed = true;
  // body orientation: lying rotates the model onto its back (head → -z), everything else stays upright
  m.rotation.set(p.lie ? -Math.PI / 2 : 0, 0, 0); m.position.set(0, 0, 0);
  av.root.updateMatrixWorld(true);
  av.root.getWorldQuaternion(_rq);
  // place the pelvis: hips target is in root-local metres
  if (p.hips && R.hips) {
    R.hips.getWorldPosition(_a); av.root.worldToLocal(_a);
    m.position.set(p.hips[0] - _a.x, p.hips[1] - _a.y, p.hips[2] - _a.z);
    m.updateMatrixWorld(true);
  }
  if (pose === 'lie') { // straighten the torso along the bed (idle sway would lift the head)
    aim(R, 'Spine', new THREE.Vector3(0, 0.1, -1).normalize(), _rq);
  }
  for (const part of armsFree ? ['UpLeg', 'Leg', 'Foot'] : ['UpLeg', 'Leg', 'Foot', 'Arm', 'ForeArm', 'Hand']) {
    if (p[part]) aim(R, 'Left' + part, p[part], _rq);
    if (p.R[part]) aim(R, 'Right' + part, p.R[part], _rq);
  }
}

// Original in-place walk for portable model previews, sampled into export keyframes.
export function applyModelWalk(av, phase) {
  const R=rig(av);av.root.updateMatrixWorld(true);av.root.getWorldQuaternion(_rq);
  for(const side of ['Left','Right']){
    const wave=Math.sin(phase+(side==='Left'?0:Math.PI)),thigh=.36*wave,shin=thigh-.65*Math.max(0,-wave);
    aim(R,side+'UpLeg',N(side==='Left'?.025:-.025,-Math.cos(thigh),Math.sin(thigh)),_rq);
    aim(R,side+'Leg',N(0,-Math.cos(shin),Math.sin(shin)),_rq);
    aim(R,side+'Foot',N(0,-.4,1),_rq);
    aim(R,side+'Arm',N(side==='Left'?.14:-.14,-1,-wave*.35),_rq);
    aim(R,side+'ForeArm',N(side==='Left'?.04:-.04,-1,.12-wave*.3),_rq);
  }
}
