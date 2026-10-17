// Animation-independent movement contract (Stage 4). Gameplay code asks for a state;
// the avatar maps it to whatever clips its character set provides, falling back to
// idle when a clip is missing (classic avatars, older character exports).
export const STATES = Object.freeze({
  idle: 'idle', walk: 'walk', run: 'run', turn: 'walk', sit: 'idle', interact: 'agree',
  passenger: 'idle', wave: 'wave', agree: 'agree', shake: 'shake', sad: 'sad', dance: 'dance',
});
export const WALK_SPEED = 1.45;   // metres per second, the existing walk
export const RUN_SPEED = 3.2;     // joystick at full tilt outdoors
export const RUN_THRESHOLD = 2.2;

// Running is permitted outdoors (streets, neighbourhoods); indoors everyone walks.
export function locomotion(speed, outdoor) {
  return outdoor && speed >= RUN_THRESHOLD ? STATES.run : STATES.walk;
}
// Joystick speed for a tilt in [0, 1].
export function joystickSpeed(tilt, outdoor) {
  const t = Math.max(0, Math.min(1, tilt));
  return outdoor ? WALK_SPEED * 0.8 + (RUN_SPEED - WALK_SPEED * 0.8) * t * t : 1.2 + 0.8 * t;
}
export function clipFor(state, available) {
  const clip = STATES[state] || STATES.idle;
  return available.has(clip) ? clip : available.has('idle') ? 'idle' : clip;
}

// Camera preference: 'iso' (overhead) or 'follow' (third person), kept per browser.
const KEY = 'awd.camera';
export function savedCameraMode(storage = globalThis.localStorage) {
  try { return storage?.getItem(KEY) === 'follow' ? 'follow' : 'iso'; } catch { return 'iso'; }
}
export function saveCameraMode(mode, storage = globalThis.localStorage) {
  try { storage?.setItem(KEY, mode === 'follow' ? 'follow' : 'iso'); } catch { /* private mode: session only */ }
}
// Follow mode needs a room the camera can safely sit inside: enclosed interiors or
// outdoor streets. The map, rides, the stylist and custody cells stay overhead.
export function followSupported({ spec, custody, studio, ride, view }) {
  return !!spec && view === 'room' && !custody && !studio && !ride;
}
