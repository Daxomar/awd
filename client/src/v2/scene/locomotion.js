// Human-feeling ground movement for every person in a room (the player, other players, residents).
// Speed eases in and out instead of jumping to full pace, the body turns at a human rate and
// slows down for sharp turns, paths are followed by steering towards a point a little ahead
// (corners are rounded, not walked to the centre of every navigation cell), and the joystick
// steers directly with sliding collision instead of re-planning a path several times a second.
export const ACCEL = 4.2;          // m/s² speeding up
export const DECEL = 6.5;          // m/s² slowing down
export const TURN_RATE = 7.5;      // rad/s at most
export const LOOKAHEAD = 0.6;      // metres along the path the body steers towards
export const ARRIVE = 0.05;        // last waypoint reached within this distance
export const PASS = 0.35;          // intermediate waypoints are passed within this distance
export const MIN_ARRIVAL_SPEED = 0.45;

const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

// Point LOOKAHEAD metres ahead along the polyline [here, ...path].
export function carrot(x, z, path, look = LOOKAHEAD) {
  let px = x, pz = z, left = look;
  for (const [tx, tz] of path) {
    const d = Math.hypot(tx - px, tz - pz);
    if (d >= left) return [px + ((tx - px) / d) * left, pz + ((tz - pz) / d) * left];
    left -= d; px = tx; pz = tz;
  }
  return [px, pz];
}

export function remaining(x, z, path) {
  let px = x, pz = z, total = 0;
  for (const [tx, tz] of path) { total += Math.hypot(tx - px, tz - pz); px = tx; pz = tz; }
  return total;
}

// Ease the current speed towards a target.
export function approach(vel, target, dt) {
  return vel < target ? Math.min(target, vel + ACCEL * dt) : Math.max(target, vel - DECEL * dt);
}

// Turn yaw towards want by at most TURN_RATE·dt, smoothly near the end. Returns the new yaw.
export function turnTowards(yaw, want, dt) {
  const diff = wrap(want - yaw);
  const step = Math.sign(diff) * Math.min(Math.abs(diff), TURN_RATE * dt, Math.abs(diff) * Math.min(1, dt * 14));
  return wrap(yaw + step);
}

// Speed factor while turning: a person facing away from where they need to go pivots first.
export const alignment = (yaw, want) => Math.max(0.15, Math.cos(Math.min(Math.PI / 2, Math.abs(wrap(want - yaw)))));

// One frame for one person. `free(x, z)` says whether a point is walkable (navigation grid).
// Returns true while the person is moving. Calls p.onArrive once at the end of a path.
export function stepPerson(p, dt, free) {
  p.vel ??= 0;
  if (p.steer) return steerDirect(p, dt, free);
  if (!p.path.length) { p.vel = 0; return false; }
  while (p.path.length > 1 && Math.hypot(p.path[0][0] - p.x, p.path[0][1] - p.z) < PASS) p.path.shift();
  const [lx, lz] = p.path[p.path.length - 1];
  const left = remaining(p.x, p.z, p.path);
  if (left < ARRIVE || (left < 0.12 && p.vel < 0.2)) { arrive(p, lx, lz); return false; }
  const [cx, cz] = carrot(p.x, p.z, p.path);
  const dx = cx - p.x, dz = cz - p.z, len = Math.hypot(dx, dz) || 1;
  const want = Math.atan2(dx, dz);
  // Brake so the person stops on the spot rather than overshooting: v² = 2·a·d.
  const brake = Math.max(MIN_ARRIVAL_SPEED, Math.sqrt(2 * DECEL * 0.6 * left));
  p.vel = approach(p.vel, Math.min(p.speed, brake) * alignment(p.yaw, want), dt);
  p.yaw = turnTowards(p.yaw, want, dt);
  const st = Math.min(left, p.vel * dt);
  p.x += (dx / len) * st; p.z += (dz / len) * st;
  return true;
}

function arrive(p, x, z) {
  p.path = []; p.vel = 0;
  const f = p.finalPose;
  if (f) { p.x = f.x; p.z = f.z; p.yaw = f.yaw ?? p.yaw; p.pose = f.pose || 'stand'; p.poseY = f.y || 0; }
  else { p.x = x; p.z = z; }
  const cb = p.onArrive; p.onArrive = null; cb && cb();
}

// Joystick: p.steer = {dx, dz, speed} (unit direction in room space). Slides along obstacles.
function steerDirect(p, dt, free) {
  const s = p.steer, mag = Math.hypot(s.dx, s.dz);
  if (mag < 1e-3 || !s.speed) { p.vel = approach(p.vel, 0, dt); return p.vel > 0.05; }
  const want = Math.atan2(s.dx, s.dz);
  p.vel = approach(p.vel, s.speed * alignment(p.yaw, want), dt);
  p.yaw = turnTowards(p.yaw, want, dt);
  const st = p.vel * dt, ux = s.dx / mag, uz = s.dz / mag;
  const nx = p.x + ux * st, nz = p.z + uz * st;
  if (free(nx, nz)) { p.x = nx; p.z = nz; }
  else if (Math.abs(ux) > 0.2 && free(nx, p.z)) p.x = nx;
  else if (Math.abs(uz) > 0.2 && free(p.x, nz)) p.z = nz;
  else p.vel = approach(p.vel, 0, dt * 3);
  return p.vel > 0.05;
}
