// main.js. Terminal Overdrive. Game orchestration: loop, input, combat, waves, boss, FFA.
import * as THREE from 'three';
import { buildMap } from './map.js';
import { AudioSys } from './audio.js';
import { HUD } from './hud.js';
import { WEAPONS, WEAPON_ORDER } from './weapons.js';
import { buildEnemy, animateEnemy, updateEnemyAI, hitsCollider, hasLineOfSight, findFreeSpot } from './enemies.js';
import { buildBoss, updateBoss } from './boss.js';
import { rollAugments, applyAugment } from './augments.js';
import { StyleRank } from './style.js';
import { startFFA, updateFFA } from './ffa.js';
import { pollGamepad } from './gamepad.js';
import { initTouch } from './touch.js';
import { createPlayerView, updatePlayerView, showMuzzleFlash } from './player.js';
import { buildThirdPersonBody, updateThirdPersonBody, showThirdPersonFlash, thirdPersonMuzzleWorld } from './thirdperson.js';
import { loadModels } from './models.js';

const WAVES = [
  { wolf: 3, boar: 0, robot: 0, dog: 1, exo: 0 },
  { wolf: 4, boar: 2, robot: 1, dog: 2, exo: 0 },
  { wolf: 4, boar: 3, robot: 3, dog: 2, exo: 0 },
  { wolf: 5, boar: 3, robot: 4, dog: 3, exo: 1 },
  { wolf: 5, boar: 4, robot: 5, dog: 4, exo: 1 },
  { wolf: 6, boar: 4, robot: 6, dog: 4, exo: 2 },
  { wolf: 6, boar: 5, robot: 7, dog: 5, exo: 2 },
  { wolf: 4, boar: 3, robot: 4, dog: 3, exo: 1, boss: true },
];
const PLAYER_DMG_MULT = 1.25;

const G = {
  state: 'loading', mode: 'survival', wave: 1, score: 0, kills: 0, shots: 0, hits: 0,
  enemies: [], projectiles: [], pickups: [], spawnQueue: [], spawnT: 0, waveActive: false,
  boss: null, ffaBots: [], ffaOver: false, time: 0, hitStopT: 0, shakeT: 0, shakeMag: 0,
  firing: false, touchFiring: false, mouseAim: false, streamQueue: [], streamPaused: false,
  player: null, weapons: WEAPONS,
};
window.TO = G;

const audio = new AudioSys(); G.audio = audio;
const hud = new HUD(); G.hud = hud;
G.style = new StyleRank();

// ---------- Renderer, scene, camera ----------
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
document.getElementById('app').appendChild(renderer.domElement);

const scene = new THREE.Scene();
G.scene = scene;
const camera = new THREE.PerspectiveCamera(78, window.innerWidth / window.innerHeight, 0.08, 600);
camera.rotation.order = 'YXZ';
scene.add(camera);
G.camera = camera; G.renderer = renderer;

const map = buildMap(scene, renderer);
G.map = map;
const solids = [];
scene.traverse((o) => { if (o.isMesh && o.material && o.material.isMeshStandardMaterial) solids.push(o); });
G.solids = solids;

const view = createPlayerView(camera, scene);
G.view = view;
// Third person operator body. Always one body visible: the first person rig
// in first person, the full operator in third person, never neither.
// Built in boot() after the models load, so the body is the real Soldier
// model when it is available and the procedural fallback when it is not.
let tpBody = null;
G.thirdPerson = null;
G.viewMode = 'first';
G.toggleView = function (force) {
  // The force flag is for the VIEW buttons only: it lets one click toggle
  // the view while paused and then resume. The T key and touch button
  // keep the strict playing-only guard.
  if (G.state !== 'playing' && !force) return;
  G.viewMode = G.viewMode === 'first' ? 'third' : 'first';
  setViewLabels();
  audio.uiClick();
};
// Last shown screen rect of the HUD VIEW button, for the dead zone below.
// While the button is hidden its rect is 0, so the last shown rect is kept.
let viewBtnRect = { left: 0, top: 0, right: 0, bottom: 0, w: 0 };
function setViewLabels() {
  const label = 'VIEW: ' + (G.viewMode === 'first' ? '1ST' : '3RD') + ' [T]';
  const b = document.getElementById('viewBtn');
  // On desktop the HUD button only ever appears while paused, so the
  // label says so plainly. On touch it is reachable during play.
  if (b) b.textContent = label + (isTouchDevice() ? '' : ' · PAUSED');
  const pv = document.getElementById('btnPauseView');
  // The pause button is the one a touch player sees, and there is no T
  // key on touch, so it drops the [T] on touch only. Desktop keeps it.
  if (pv) pv.textContent = isTouchDevice() ? label.replace(' [T]', '') : label;
}
// Honest design for the HUD VIEW button (B1): while pointer lock is
// engaged on desktop there is no cursor, so the button is unreachable by
// construction in every pointer-lock FPS. It is hidden instead of making
// a promise it cannot keep. It is shown only while paused (lock released,
// cursor back) or on touch devices, where no pointer lock ever engages.
// The mouse route on desktop is T during play, or the VIEW button in the
// pause menu, which toggles and resumes in one click.
function syncViewBtn() {
  const show = G.state === 'paused' || isTouchDevice();
  const b = document.getElementById('viewBtn');
  if (b) {
    b.classList.toggle('hidden', !show);
    if (show) { const r = b.getBoundingClientRect(); if (r.width > 0) viewBtnRect = { left: r.left, top: r.top, right: r.right, bottom: r.bottom, w: r.width }; }
  }
  setViewLabels();
}
function inHiddenViewBtnZone(x, y) {
  if (isTouchDevice()) return false;
  const z = viewBtnRect.w > 0 ? viewBtnRect : { left: window.innerWidth / 2 - 110, top: 8, right: window.innerWidth / 2 + 110, bottom: 46 };
  return x >= z.left - 4 && x <= z.right + 4 && y >= z.top - 4 && y <= z.bottom + 4;
}

// ---------- Player state ----------
function freshPlayer() {
  return {
    pos: new THREE.Vector3(0, 0, 30), vel: new THREE.Vector3(), yaw: -0.3, pitch: 0,
    health: 100, maxHealth: 100, armor: 150, maxArmor: 150, onGround: true,
    sprinting: false, sliding: false, slideT: 0, crouching: false, aiming: false,
    weapon: 'rifle', prevWeapon: 'shotgun', lastSwapT: 99, moveMag: 0,
    damageMult: 1, fireRateMult: 0, reloadMult: 0, rechargeMult: 0, speedMult: 0, lifesteal: 0,
    augments: [], grenades: 4, maxGrenades: 4, overdriveT: 0, overdriveCd: 0,
    lastDamageT: -99, rechargeSoundT: 0, padMove: { x: 0, y: 0 }, stepT: 0,
    ammo: { rifle: { mag: 30, magSize: 30, reserve: 180 }, shotgun: { mag: 6, magSize: 6, reserve: 42 }, rocket: { mag: 1, magSize: 1, reserve: 8 }, grenade: { mag: 1, magSize: 1, reserve: 4 }, melee: { mag: Infinity, magSize: Infinity, reserve: Infinity } },
  };
}
G.player = freshPlayer();
let fireT = 0, reloadT = 0, reloading = false;

// ---------- FX pools ----------
const fx = {
  tracers: [], particles: [], decals: [], shells: [], rings: [], light: new THREE.PointLight(0xffa040, 0, 26, 2),
};
scene.add(fx.light);
G.fx = fx;
for (let i = 0; i < 10; i++) {
  const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
  const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0 }));
  line.visible = false; scene.add(line); fx.tracers.push({ line, t: 0 });
}
for (let i = 0; i < 140; i++) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.09, 0.09), new THREE.MeshBasicMaterial({ color: 0xcc9966 }));
  m.visible = false; scene.add(m); fx.particles.push({ m, vel: new THREE.Vector3(), t: 0, life: 1 });
}
for (let i = 0; i < 40; i++) {
  // Bullet-hole decal: 10 cm across, dark grey-brown, semi-transparent.
  // The old 32 cm solid-black disc read as a hole punched through the
  // container rather than a mark on it.
  const m = new THREE.Mesh(new THREE.CircleGeometry(0.05, 10), new THREE.MeshBasicMaterial({ color: 0x2e2620, transparent: true, opacity: 0.55, depthWrite: false }));
  m.visible = false; scene.add(m); fx.decals.push(m);
}
for (let i = 0; i < 24; i++) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.02, 0.05), new THREE.MeshStandardMaterial({ color: 0xc8a038, metalness: 0.9, roughness: 0.3 }));
  m.visible = false; scene.add(m); fx.shells.push({ m, vel: new THREE.Vector3(), t: 0 });
}
for (let i = 0; i < 6; i++) {
  const m = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.62, 32), new THREE.MeshBasicMaterial({ color: 0xff8c2e, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }));
  m.rotation.x = -Math.PI / 2; m.visible = false; scene.add(m); fx.rings.push({ m, t: 0 });
}
fx.tracer = function (a, b, color) {
  const t = fx.tracers.find((x) => x.t <= 0) || fx.tracers[0];
  t.line.geometry.setFromPoints([a, b]); t.line.material.color.set(color || 0xffd27a); t.line.material.opacity = 0.95; t.line.visible = true; t.t = 0.09;
};
fx.burst = function (pos, n, color, speed) {
  let made = 0;
  for (const p of fx.particles) {
    if (p.t > 0) continue;
    p.m.position.copy(pos); p.m.visible = true; p.m.material.color.set(color);
    p.vel.set((Math.random() - 0.5) * 2, Math.random() * 1.4 + 0.4, (Math.random() - 0.5) * 2).multiplyScalar(speed || 3);
    p.t = p.life = 0.4 + Math.random() * 0.5; made++;
    if (made >= n) break;
  }
};
fx.decal = function (pos, normal) {
  const d = fx.decals.find((x) => !x.visible) || fx.decals[0];
  d.position.copy(pos).addScaledVector(normal, 0.02); d.lookAt(pos.clone().add(normal)); d.visible = true;
};
fx.shell = function () {
  const s = fx.shells.find((x) => x.t <= 0); if (!s) return;
  const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
  s.m.position.copy(camera.position).addScaledVector(right, 0.25).add(new THREE.Vector3(0, -0.18, 0));
  s.m.visible = true; s.vel.copy(right).multiplyScalar(1.6); s.vel.y = 1.6; s.t = 1.1;
};
fx.ring = function (pos, big) {
  const r = fx.rings.find((x) => x.t <= 0) || fx.rings[0];
  r.m.position.copy(pos); r.m.position.y = 0.06; r.m.visible = true; r.t = 0.55; r.big = big ? 11 : 6;
};
fx.explosion = function (pos, big) {
  fx.burst(pos, big ? 40 : 22, 0xff7a1a, big ? 7 : 5);
  fx.burst(pos, 14, 0x333333, 3);
  fx.ring(pos, big);
  fx.light.position.copy(pos).add(new THREE.Vector3(0, 1.5, 0)); fx.light.intensity = big ? 40 : 22;
  fx.shake(big ? 0.5 : 0.3);
  audio.explosion(big);
};
fx.shake = function (mag) { G.shakeT = Math.max(G.shakeT, 0.35); G.shakeMag = Math.max(G.shakeMag, mag); };
fx.update = function (dt) {
  for (const t of fx.tracers) { if (t.t > 0) { t.t -= dt; t.line.material.opacity = Math.max(0, t.t / 0.09) * 0.95; if (t.t <= 0) t.line.visible = false; } }
  for (const p of fx.particles) { if (p.t > 0) { p.t -= dt; p.m.position.addScaledVector(p.vel, dt); p.vel.y -= 9 * dt; p.m.scale.setScalar(Math.max(0.05, p.t / p.life)); if (p.t <= 0) p.m.visible = false; } }
  for (const s of fx.shells) { if (s.t > 0) { s.t -= dt; s.m.position.addScaledVector(s.vel, dt); s.vel.y -= 12 * dt; if (s.m.position.y < 0.03) { s.m.position.y = 0.03; s.vel.set(0, 0, 0); } s.m.rotation.x += dt * 9; if (s.t <= 0) s.m.visible = false; } }
  for (const r of fx.rings) { if (r.t > 0) { r.t -= dt; const f = 1 - r.t / 0.55; r.m.scale.setScalar(0.5 + f * (r.big || 6)); r.m.material.opacity = Math.max(0, 0.8 * (1 - f)); if (r.t <= 0) r.m.visible = false; } }
  fx.light.intensity = Math.max(0, fx.light.intensity - dt * 90);
};

// ---------- Input ----------
const keys = {};
let pointerLocked = false;
document.addEventListener('keydown', (e) => {
  if (e.code === 'Space') e.preventDefault();
  if (keys[e.code]) return;
  keys[e.code] = true;
  if (G.state !== 'playing') return;
  if (e.code === 'KeyQ') quickSwitch();
  if (e.code === 'KeyR') reloadWeapon();
  if (e.code === 'KeyG') G.throwGrenade();
  if (e.code === 'KeyV') G.meleeAttack();
  if (e.code === 'KeyF') G.activateOverdrive();
  if (e.code === 'KeyT') G.toggleView();
  if (e.code === 'Space') G.jump();
  if (e.code === 'KeyX') { G.firing = true; G.tryFire(true); }
  if (e.code === 'ControlLeft' || e.code === 'KeyC') { if (G.player.moveMag > 0.4 && G.player.onGround) G.startSlide(); }
  if (e.code.startsWith('Digit')) { const i = parseInt(e.code.slice(5), 10) - 1; if (WEAPON_ORDER[i]) selectWeapon(WEAPON_ORDER[i]); }
});
document.addEventListener('keyup', (e) => { keys[e.code] = false; if (e.code === 'KeyX') G.firing = false; });
// Esc pauses and resumes on its own, even when pointer lock is not engaged.
// It also closes the how-to panel, which opens from the title screen where
// there is no game to pause.
document.addEventListener('keydown', (e) => {
  if (e.code !== 'Escape') return;
  const howto = document.getElementById('howto');
  if (howto && !howto.classList.contains('hidden')) { howto.classList.add('hidden'); return; }
  if (G.state === 'playing') togglePause(true);
  else if (G.state === 'paused') togglePause(true);
});
document.addEventListener('mousemove', (e) => {
  if (!pointerLocked || G.state !== 'playing') return;
  G.player.yaw -= e.movementX * 0.0021;
  G.player.pitch = Math.max(-1.45, Math.min(1.45, G.player.pitch - e.movementY * 0.0021));
});
document.addEventListener('mousedown', (e) => {
  // Firing does not require pointer lock. Clicking also requests the lock for mouse look.
  if (G.state !== 'playing') return;
  // A mousedown on a HUD button is a UI gesture, not a shot: never fire
  // the weapon and never re-request pointer lock for it, or the button's
  // own click never fires (the lock engages on mousedown and swallows it).
  if (e.target && e.target.closest && e.target.closest('button')) return;
  // While the button is hidden and the lock is NOT engaged, a click on
  // its former spot is a dead gesture, not a shot: the spot is aimable
  // (the cursor is visible and the coordinates are real), so the click
  // is a mistaken button press, not a fire input. While the lock IS
  // engaged the guard is deliberately inert: the browser freezes mouse
  // coordinates at the lock point (proven: clicks dispatched at (640,26)
  // and (100,100) both arrive as (640,380), the DEPLOY center), so no
  // code can tell a click at the former spot from any other click, and
  // every click while locked is a fire input by design. There is no
  // cursor and no visible button to mistake while locked.
  if (!pointerLocked && inHiddenViewBtnZone(e.clientX, e.clientY)) return;
  // Fire one shot at once: the animate loop only samples G.firing once per
  // frame, so a quick click that lands between two frames never fired.
  // tryFire is rate-gated by fireT, so this cannot double-fire.
  if (e.button === 0) { G.firing = true; G.tryFire(true); lockPointer(); }
  if (e.button === 2) { G.player.aiming = true; G.mouseAim = true; }
});
document.addEventListener('mouseup', (e) => {
  if (e.button === 0) G.firing = false;
  if (e.button === 2) { G.player.aiming = false; G.mouseAim = false; }
});
document.addEventListener('contextmenu', (e) => e.preventDefault());
document.addEventListener('pointerlockchange', () => {
  pointerLocked = document.pointerLockElement === renderer.domElement;
  // Losing an engaged lock pauses, on every device. The event only fires
  // on a real lock transition, so a touch-only machine where the lock
  // never engages cannot pause spuriously here.
  if (!pointerLocked && G.state === 'playing' && !G._noLockPause) togglePause(true);
  syncViewBtn();
});
document.addEventListener('visibilitychange', () => { if (document.hidden && G.state === 'playing') togglePause(true); });
window.addEventListener('resize', () => { camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix(); renderer.setSize(window.innerWidth, window.innerHeight); });
function isTouchDevice() { return 'ontouchstart' in window || navigator.maxTouchPoints > 0; }
// Pointer lock is requested on every mouse click, even on a touchscreen
// laptop: a touch screen does not mean there is no mouse, and gating on
// it left mouse look dead (cursor visible, no turning) on exactly those
// machines. A failed request (touch-only device, no gesture) is swallowed.
function lockPointer() { try { const r = renderer.domElement.requestPointerLock(); if (r && r.catch) r.catch(() => {}); } catch (e) { /* headless or no gesture yet; mouse look waits for a click */ } }

// ---------- Player actions ----------
G.jump = function () { const p = G.player; if (p.onGround) { p.vel.y = 7.6; p.onGround = false; p.sliding = false; } };
G.startSlide = function () {
  const p = G.player;
  if (!p.onGround || p.sliding) return;
  p.sliding = true; p.slideT = 0.7;
  const f = new THREE.Vector3(-Math.sin(p.yaw), 0, -Math.cos(p.yaw));
  p.vel.addScaledVector(f, 5);
  audio.noise(0.18, 0.2, 500, 0.6, audio.worldGain);
};
function selectWeapon(type) {
  const p = G.player;
  if (p.weapon === type || reloading) return;
  p.prevWeapon = p.weapon; p.weapon = type; p.lastSwapT = 0; p.aiming = false;
  for (const t in view.weapons) view.weapons[t].visible = t === type;
  view.reloadT = 0;
  audio.blip(700, 0.05, 'square', 0.1);
  hud.update(G);
}
G.cycleWeapon = function (dir) {
  const i = WEAPON_ORDER.indexOf(G.player.weapon);
  selectWeapon(WEAPON_ORDER[(i + dir + WEAPON_ORDER.length) % WEAPON_ORDER.length]);
};
function quickSwitch() { selectWeapon(G.player.prevWeapon); }
function reloadWeapon() {
  const p = G.player; const a = p.ammo[p.weapon];
  if (reloading || a.mag === Infinity || a.mag >= a.magSize || a.reserve <= 0) return;
  reloading = true; reloadT = WEAPONS[p.weapon].reload / (1 + p.reloadMult); view.reloadT = reloadT;
  audio.reload();
}
G.reloadWeapon = reloadWeapon;
G.activateOverdrive = function () {
  const p = G.player;
  if (p.overdriveCd > 0 || p.overdriveT > 0 || G.state !== 'playing') return;
  p.overdriveT = 8; audio.overdrive(); hud.killfeed('OVERDRIVE ACTIVE. 8 SECONDS');
};
G.throwGrenade = function () {
  const p = G.player;
  if (G.state !== 'playing' || p.grenades <= 0 || fireT > 0) return;
  p.grenades--; fireT = 0.5; audio.grenadePin();
  const dir = new THREE.Vector3(); camera.getWorldDirection(dir);
  spawnProjectile('grenade', shotOrigin().addScaledVector(dir, 0.5), dir.clone().multiplyScalar(17).add(new THREE.Vector3(0, 3.5, 0)));
  hud.update(G);
};
G.meleeAttack = function (fromTouch) {
  const p = G.player;
  if (G.state !== 'playing' || fireT > 0) return;
  // Touch-only short step toward the camera facing, so a retreating robot
  // just outside the swing can still be reached. Robots retreat below 6 m
  // and then only strafe, so a tap at 3 to 4 m would otherwise always
  // miss. The step uses the same collider check as walking (radius 0.45);
  // a blocked step is skipped and the swing still happens. Desktop melee
  // (V key, gamepad, weapon select) passes no flag and is unchanged.
  if (fromTouch) {
    const fwd = new THREE.Vector3(); camera.getWorldDirection(fwd);
    fwd.y = 0; fwd.normalize();
    const nx = p.pos.x + fwd.x * 1.2, nz = p.pos.z + fwd.z * 1.2;
    if (!hitsCollider(map.colliders, nx, nz, 0.45)) {
      p.pos.x = THREE.MathUtils.clamp(nx, map.bounds.minX, map.bounds.maxX);
      p.pos.z = THREE.MathUtils.clamp(nz, map.bounds.minZ, map.bounds.maxZ);
      if (G.viewMode === 'first') camera.position.set(p.pos.x, p.pos.y + eyeHeightOf(p), p.pos.z);
    }
  }
  fireT = 0.45; audio.melee();
  view.kick = 0.5;
  // Short range arc check, not a single level ray: the camera sits at 1.62 m
  // but the robot dog tops out at 0.74 m, so a level ray passes 0.9 m over
  // it. The arc is measured horizontally: a full 3D cone would reject a low
  // target at the edge of the swing, because the drop to its body centre
  // alone eats most of the cone. Vertical reach is checked separately.
  const eye = shotOrigin();
  const fwd = new THREE.Vector3(); camera.getWorldDirection(fwd);
  const fwdH = Math.atan2(-fwd.x, -fwd.z);
  let best = null, bestD = 99;
  for (const e of G.enemies) {
    if (e.dead) continue;
    const c = e.group.position.clone(); c.y += (e.height || 1.9) * 0.55;
    const to = c.clone().sub(eye);
    const d = to.length();
    if (d > WEAPONS.melee.range + 0.3) continue;
    if (Math.abs(c.y - eye.y) > 1.8) continue;
    const ang = Math.atan2(-to.x, -to.z);
    let diff = ang - fwdH;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    if (Math.abs(diff) > 0.65) continue;
    if (d < bestD) { bestD = d; best = e; }
  }
  if (best) damageEnemy(best, WEAPONS.melee.damage * PLAYER_DMG_MULT * p.damageMult, 'body', best.group.position.clone().add(new THREE.Vector3(0, 1, 0)), 'melee');
};
// Where shots and throws start from. First person: the camera. Third
// person: the player eye, so projectiles do not spawn behind the operator.
function eyeHeightOf(p) { return p.sliding ? 0.95 : p.crouching ? 1.15 : 1.62; }
function shotOrigin() {
  const p = G.player;
  if (G.viewMode === 'third') return new THREE.Vector3(p.pos.x, p.pos.y + eyeHeightOf(p), p.pos.z);
  return camera.position.clone();
}
function spawnProjectile(kind, pos, vel) {
  const mesh = new THREE.Mesh(
    kind === 'rocket' ? new THREE.CylinderGeometry(0.09, 0.09, 0.6, 8) : new THREE.SphereGeometry(0.09, 10, 8),
    new THREE.MeshStandardMaterial({ color: kind === 'rocket' ? 0x8a2a1a : 0x3d4a2a, roughness: 0.5, metalness: 0.5 }));
  mesh.position.copy(pos);
  if (kind === 'rocket') mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), vel.clone().normalize());
  scene.add(mesh);
  G.projectiles.push({ kind, mesh, vel, fuse: kind === 'grenade' ? 1.5 : 99, alive: true });
}

// ---------- Shooting ----------
const raycaster = new THREE.Raycaster();
function enemyMeshes() {
  const list = [];
  for (const e of G.enemies) if (!e.dead) e.group.traverse((m) => { if (m.isMesh) list.push(m); });
  return list;
}
G.tryFire = function (held) {
  if (G.state !== 'playing' || reloading) return;
  const p = G.player; const w = WEAPONS[p.weapon];
  if (fireT > 0) return;
  if (p.weapon === 'rocket') {
    if (p.ammo.rocket.mag <= 0) { reloadWeapon(); return; }
    fireT = 1 / (w.rof * (1 + p.fireRateMult) * (p.overdriveT > 0 ? 1.6 : 1));
    if (p.overdriveT <= 0) p.ammo.rocket.mag--;
    audio.shot('rocket'); if (G.viewMode === 'third' && tpBody) showThirdPersonFlash(tpBody, G); else showMuzzleFlash(view, G);
    const dir = new THREE.Vector3(); camera.getWorldDirection(dir);
    spawnProjectile('rocket', shotOrigin().addScaledVector(dir, 0.6), dir.clone().multiplyScalar(46));
    return;
  }
  if (p.weapon === 'melee') { G.meleeAttack(); return; }
  if (p.weapon === 'grenade') { G.throwGrenade(); return; }
  const a = p.ammo[p.weapon];
  if (a.mag <= 0) { reloadWeapon(); return; }
  fireT = 1 / (w.rof * (1 + p.fireRateMult) * (p.overdriveT > 0 ? 1.6 : 1));
  if (p.overdriveT <= 0) a.mag--;
  G.shots += w.pellets;
  G.bloom = Math.min(1, (G.bloom || 0) + 0.22);
  audio.shot(w.sfx); if (G.viewMode === 'third' && tpBody) showThirdPersonFlash(tpBody, G); else showMuzzleFlash(view, G); fx.shell();
  const dir = new THREE.Vector3(); camera.getWorldDirection(dir);
  const tracerStart = G.viewMode === 'third' && tpBody
    ? (thirdPersonMuzzleWorld(tpBody, p.weapon) || camera.position.clone().addScaledVector(dir, 0.6))
    : camera.position.clone().addScaledVector(dir, 0.6);
  for (let i = 0; i < w.pellets; i++) {
    const d = dir.clone();
    d.x += (Math.random() - 0.5) * w.spread * 2 * (p.aiming ? 0.4 : 1);
    d.y += (Math.random() - 0.5) * w.spread * 2 * (p.aiming ? 0.4 : 1);
    d.z += (Math.random() - 0.5) * w.spread * 2 * (p.aiming ? 0.4 : 1);
    d.normalize();
    raycaster.set(camera.position, d); raycaster.far = w.range;
    const hits = raycaster.intersectObjects(enemyMeshes().concat(solids), false);
    G.debugShot = hits.length ? { hit: hits[0].object.userData.enemyRef ? 'enemy:' + (hits[0].object.userData.part || 'body') : 'solid', dist: Math.round(hits[0].distance * 10) / 10 } : { hit: 'none', dist: null };
    if (!hits.length) continue;
    const h = hits[0];
    const end = h.point.clone();
    fx.tracer(tracerStart, end, 0xffd27a);
    const ref = h.object.userData.enemyRef;
    if (ref && !ref.dead) {
      G.hits++;
      // Headshot by height for GLB figures: the hit point sits above the
      // figure's head line, so a shot that lands on the mask or visor
      // counts as a headshot even when the mesh tagging misses it.
      let part = h.object.userData.part;
      if (ref.isGLB && ref.headLine && h.point.y > ref.group.position.y + ref.headLine) part = 'head';
      damageEnemy(ref, w.damage * PLAYER_DMG_MULT * p.damageMult, part, h.point, p.weapon);
    } else {
      fx.decal(h.point, h.face ? h.face.normal.clone().transformDirection(h.object.matrixWorld) : new THREE.Vector3(0, 1, 0));
      fx.burst(h.point, 4, 0xaa9988, 2);
    }
  }
  hud.update(G);
};
function damageEnemy(e, dmg, part, point, weapon) {
  if (e.dead) return;
  let mult = 1; let kind = 'body';
  if (part === 'head') { mult = WEAPONS[weapon] ? WEAPONS[weapon].headMult : 2; kind = 'head'; }
  if (part === 'weak') { mult = 1.5; kind = 'weak'; }
  e.hp -= dmg * mult; e.hitFlash = 0.12; e.flinchT = 0.18;
  fx.burst(point, kind === 'body' ? 5 : 9, kind === 'head' ? 0xff4444 : 0xffaa33, 2.5);
  hud.hitmarker(kind);
  hud.damage(e, dmg * mult, kind === 'head', G);
  if (kind === 'head') audio.headshot(); else audio.hitmarker(kind === 'weak');
  if (e.hp <= 0) killEnemy(e, kind, weapon);
}
function killEnemy(e, kind, weapon) {
  e.dead = true; e.deathT = 0;
  const pts = e.isBoss ? 1000 : e.type === 'exo' ? 150 : e.type === 'robot' ? 60 : e.type === 'dog' ? 40 : 50;
  G.kills++; G.score += pts;
  hud.scorePopup(e.group.position.clone().add(new THREE.Vector3(0, 1.6, 0)), '+' + pts, G);
  const label = G.style.onKill(G, { headshot: kind === 'head', weak: kind === 'weak' });
  hud.killfeed(label + '  ' + (e.name || e.type.toUpperCase()));
  G.hitStopT = kind === 'head' ? 0.07 : 0.05;
  const p = G.player;
  if (p.lifesteal > 0) p.health = Math.min(p.maxHealth, p.health + p.lifesteal);
  if (Math.random() < 0.35) dropPickup(e.group.position);
  if (e.isBoss) { G.boss = null; hud.setBoss(false); fx.explosion(e.group.position.clone().add(new THREE.Vector3(0, 1, 0)), true); }
  else fx.burst(e.group.position.clone().add(new THREE.Vector3(0, 1, 0)), 16, 0xff8844, 4);
  // Remove from raycast quickly by marking dead; body falls and fades in the loop.
  if (G.mode === 'ffa' && e.isBot) { e.respawnT = 4; }
  hud.update(G);
}
G.debugKillAll = function () { for (const e of [...G.enemies]) if (!e.dead) damageEnemy(e, 9999, 'body', e.group.position.clone().add(new THREE.Vector3(0, 1, 0)), 'rifle'); };
function dropPickup(pos) {
  const kinds = ['health', 'armor', 'ammo'];
  const kind = kinds[Math.floor(Math.random() * kinds.length)];
  const color = kind === 'health' ? 0x2aff66 : kind === 'armor' ? 0x37b6ff : 0xffc233;
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.34, 0.34), new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.7, roughness: 0.4 }));
  mesh.position.copy(pos); mesh.position.y = 0.6;
  scene.add(mesh);
  G.pickups.push({ kind, mesh, t: 0 });
}
function explode(pos, radius, dmg, fromPlayer) {
  fx.explosion(pos, radius > 5);
  for (const e of G.enemies) {
    if (e.dead) continue;
    const d = e.group.position.distanceTo(pos);
    if (d < radius) { const fall = 1 - d / radius * 0.6; damageEnemy(e, dmg * fall * (fromPlayer ? PLAYER_DMG_MULT * G.player.damageMult : 1), 'body', e.group.position.clone().add(new THREE.Vector3(0, 1.2, 0)), 'rocket'); }
  }
  const pd = G.player.pos.distanceTo(pos);
  if (pd < radius * 0.7) {
    // Self inflicted explosive damage is NOT multiplied. Flat, modest.
    const self = fromPlayer ? Math.round(22 * (1 - pd / radius)) : dmg;
    G.damagePlayer(self, pos, true);
  }
}

// ---------- Player damage and armor ----------
G.damagePlayer = function (dmg, fromPos, isExplosion) {
  const p = G.player;
  if (G.state !== 'playing' || p.health <= 0) return;
  let remaining = dmg;
  const hadArmor = p.armor > 0;
  if (p.armor > 0) { const absorbed = Math.min(p.armor, remaining); p.armor -= absorbed; remaining -= absorbed; if (p.armor <= 0 && hadArmor) { audio.armorBreak(); hud.killfeed('ARMOR BROKEN'); hud.banner('ARMOR BROKEN', 'Find cover. Armor recharges after 1 second'); } }
  if (remaining > 0) p.health -= remaining;
  p.lastDamageT = G.time;
  hud.hurtFlashSet(1);
  setTimeout(() => hud.hurtFlashSet(0), 250);
  audio.hurt();
  if (fromPos) {
    const dx = fromPos.x - p.pos.x, dz = fromPos.z - p.pos.z;
    const worldAng = Math.atan2(dx, dz);
    const rel = worldAng - (Math.PI - p.yaw);
    hud.damageArc(rel * 180 / Math.PI);
  }
  if (p.health <= 0) { p.health = 0; gameOver(false, 'You fell on wave ' + G.wave + '.'); }
  hud.update(G);
};
function updateArmor(dt) {
  const p = G.player;
  if (G.time - p.lastDamageT > 1 && p.armor < p.maxArmor && p.health > 0) {
    if (p.rechargeSoundT <= 0) { audio.armorRecharge(); p.rechargeSoundT = 1.5; }
    p.armor = Math.min(p.maxArmor, p.armor + 55 * (1 + p.rechargeMult) * dt);
  }
  // The ARMOR BROKEN warning hides the moment armor is full again, even
  // if its hide timer was restarted by another break meanwhile.
  if (p.armor >= p.maxArmor) hud.hideArmorBanner();
  p.rechargeSoundT -= dt;
}

// ---------- Spawning and waves ----------
G.spawnEnemy = function (type, nearPos, exact) {
  const scale = 1 + (G.wave - 1) * 0.12;
  let sp = null;
  if (nearPos && exact) {
    // Exact spot requested by the caller (wave openers, boss minions stay jittered).
    sp = new THREE.Vector3(nearPos.x, 0, nearPos.z);
  } else if (!nearPos) {
    // Prefer a point the player can actually see: clear line of sight and in
    // the forward half. Fall back to the nearest point beyond 14 m.
    const p = G.player.pos;
    const fwd = new THREE.Vector3(-Math.sin(G.player.yaw), 0, -Math.cos(G.player.yaw));
    let best = 1e9;
    for (const s of map.spawnPoints) {
      const d = s.distanceTo(p);
      if (d <= 14) continue;
      const to = new THREE.Vector3(s.x - p.x, 0, s.z - p.z).normalize();
      const seen = hasLineOfSight(G, s, p) ? 0 : 1000;
      const ahead = to.dot(fwd) > 0 ? 0 : 500;
      const score = seen + ahead + d;
      if (score < best) { best = score; sp = s; }
    }
    if (!sp) sp = map.spawnPoints[Math.floor(Math.random() * map.spawnPoints.length)];
  }
  const pos = (nearPos && exact) ? new THREE.Vector3(sp.x, 0, sp.z)
    : nearPos ? new THREE.Vector3(nearPos.x + (Math.random() - 0.5) * 8, 0, nearPos.z + (Math.random() - 0.5) * 8)
    : new THREE.Vector3(sp.x + (Math.random() - 0.5) * 4, 0, sp.z + (Math.random() - 0.5) * 4);
  // Jittered wave spawns share the FFA trap: 14.5 percent of the jitter
  // box around [14,-30], [32,20] and [22,30] is inside a container
  // collider, and a bot that starts inside a box can never walk out by
  // steps. Exact spots are already collider-checked by the caller.
  const spot = (nearPos && exact) ? { x: pos.x, z: pos.z } : findFreeSpot(G, pos.x, pos.z, 0.45);
  const e = buildEnemy(type, { pos: new THREE.Vector3(spot.x, 0, spot.z) });
  e.hp = e.maxHp = Math.round(e.maxHp * scale);
  scene.add(e.group); G.enemies.push(e);
  return e;
};
// Openers for a wave: spots in front of the player, inside the spawn view,
// clear of cover, so a cold player sees an enemy within seconds of DEPLOY.
G.spawnOpener = function (type, lateral, dist) {
  const p = G.player;
  const fwd = new THREE.Vector3(-Math.sin(p.yaw), 0, -Math.cos(p.yaw));
  const right = new THREE.Vector3(Math.cos(p.yaw), 0, -Math.sin(p.yaw));
  const spot = new THREE.Vector3(p.pos.x, 0, p.pos.z)
    .addScaledVector(fwd, dist).addScaledVector(right, lateral);
  spot.x = THREE.MathUtils.clamp(spot.x, map.bounds.minX, map.bounds.maxX);
  spot.z = THREE.MathUtils.clamp(spot.z, map.bounds.minZ, map.bounds.maxZ);
  if (hitsCollider(map.colliders, spot.x, spot.z, 0.9)) return null;
  const e = G.spawnEnemy(type, spot, true);
  // Openers hold position for the first 1.2 game-seconds, so a cold player
  // still sees the enemy in the first frame instead of watching it strafe
  // behind a container before the first screenshot.
  if (e) e.holdT = 1.2;
  return e;
};
function startWave(n) {
  G.wave = n; G.waveActive = true; G.spawnQueue = []; G.spawnT = 0.5;
  const cfg = WAVES[n - 1];
  const types = ['wolf', 'boar', 'robot', 'dog', 'exo'];
  for (const t of types) for (let i = 0; i < (cfg[t] || 0); i++) G.spawnQueue.push(t);
  // Shuffle the queue.
  for (let i = G.spawnQueue.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [G.spawnQueue[i], G.spawnQueue[j]] = [G.spawnQueue[j], G.spawnQueue[i]]; }
  // Open the wave with enemies already in view: take up to three from the
  // queue and place them in front of the player right now, not after a
  // spawn timer. Spots sit 5 to 6 m ahead in the open yard between the
  // player and the z = 18 container row, so the first shot has a clear
  // line of sight: the old spots sat behind that row, and the nearest
  // enemy could be seen but not hit. A blocked spot is skipped, never a
  // reason to stop trying.
  const openerSpots = [[0, 6], [2, 7], [-2, 7], [5, 6], [-5, 6]];
  let opened = 0, si = 0;
  while (opened < 3 && G.spawnQueue.length && si < openerSpots.length) {
    const t = G.spawnQueue[0];
    const e = G.spawnOpener(t, openerSpots[si][0], openerSpots[si][1]);
    si++;
    if (!e) continue;
    G.spawnQueue.shift();
    opened++;
  }
  // Stage the next wave in the background during this wave, paused in heavy combat.
  G.streamQueue = n < 8 ? Object.entries(WAVES[n]).filter(([k, v]) => k !== 'boss' && v > 0).map(([k]) => k) : [];
  const q = G.spawnQueue.length;
  hud.banner('WAVE ' + n, n === 8 ? 'Exoskeleton Prime is coming' : q + (q === 1 ? ' hostile incoming' : ' hostiles incoming'));
  audio.waveHorn();
  if (n === 8) {
    const boss = buildBoss(new THREE.Vector3(0, 0, -28));
    scene.add(boss.group); G.enemies.push(boss); G.boss = boss;
    hud.setBoss(true, 1, 'EXOSKELETON PRIME. PHASE 1');
    audio.startMusic('boss');
  } else if (G.mode === 'survival') audio.startMusic('combat');
  hud.update(G);
}
G.startWave = startWave;
function waveCleared() {
  G.waveActive = false;
  G.score += 250 * G.wave;
  audio.sting(true);
  if (G.wave >= 8) { gameOver(true, 'All 8 waves cleared. The terminal is yours.'); return; }
  // Augment choice.
  G.state = 'augment';
  document.exitPointerLock && document.exitPointerLock();
  const cards = rollAugments(3);
  const wrap = document.getElementById('augmentCards'); wrap.innerHTML = '';
  for (const a of cards) {
    const d = document.createElement('div'); d.className = 'aug-card';
    d.innerHTML = '<h3>' + a.name + '</h3><p>' + a.desc + '</p>';
    d.onclick = () => { applyAugment(G, a.id); audio.uiClick(); document.getElementById('augment').classList.add('hidden'); G.state = 'playing'; lockPointer(); startWave(G.wave + 1); };
    wrap.appendChild(d);
  }
  document.getElementById('augment').classList.remove('hidden');
  hud.update(G);
}

// ---------- Game flow ----------
function startGame(mode) {
  audio.init();
  G.mode = mode; G.score = 0; G.kills = 0; G.shots = 0; G.hits = 0;
  G.player = freshPlayer();
  G.player.weapon = startWeapon;
  G.player.prevWeapon = startWeapon === 'rifle' ? 'shotgun' : 'rifle';
  G.style = new StyleRank();
  for (const e of G.enemies) scene.remove(e.group);
  G.enemies = []; G.projectiles.forEach((p) => scene.remove(p.mesh)); G.projectiles = [];
  G.pickups.forEach((p) => scene.remove(p.mesh)); G.pickups = [];
  G.boss = null; G.ffaOver = false; hud.setBoss(false);
  for (const t in view.weapons) view.weapons[t].visible = t === G.player.weapon;
  document.getElementById('title').classList.add('hidden');
  document.getElementById('gameover').classList.add('hidden');
  document.getElementById('pause').classList.add('hidden');
  document.body.classList.remove('paused');
  document.getElementById('pause').classList.remove('editing-layout');
  if (G.setLayoutEdit) G.setLayoutEdit(false);
  document.getElementById('hud').classList.add('on');
  G.state = 'playing';
  lockPointer();
  syncViewBtn();
  if (mode === 'ffa') { startFFA(G); }
  else { audio.restoreAfterGameOver(); startWave(1); }
  hud.update(G);
}
G.gameOver = gameOver;
function gameOver(win, text) {
  if (G.state === 'gameover') return;
  G.state = 'gameover';
  G.firing = false;
  audio.stopAllForGameOver();
  audio.sting(win);
  document.exitPointerLock && document.exitPointerLock();
  document.getElementById('hud').classList.remove('on');
  document.getElementById('gameoverTitle').textContent = win ? 'VICTORY' : 'RUN OVER';
  document.getElementById('gameoverText').textContent = text;
  const acc = G.shots > 0 ? Math.round(100 * G.hits / G.shots) + '%' : 'NO SHOTS';
  const row = (k, v, wide) => '<div class="gs-row' + (wide ? ' wide' : '') + '"><span>' + k + '</span><b>' + v + '</b></div>';
  document.getElementById('gameoverStats').innerHTML =
    row('WAVE REACHED', G.wave) + row('KILLS', G.kills) + row('SCORE', G.score) +
    row('ACCURACY', acc) + row('STYLE RANK', G.style.rank) +
    row('AUGMENTS', (G.player.augments.join(', ') || 'NONE'), true);
  document.getElementById('gameover').classList.remove('hidden');
}
function togglePause(force) {
  // Toggles both ways, with or without the force flag, so RESUME, Esc, and
  // pointer lock loss all reach the same correct state.
  if (G.state === 'playing') {
    G.state = 'paused'; audio.setPaused(true);
    document.body.classList.add('paused');
    document.exitPointerLock && document.exitPointerLock();
    document.getElementById('pause').classList.remove('hidden');
    const run = document.getElementById('pauseRun');
    if (run) run.textContent = (G.mode === 'ffa' ? 'FREE FOR ALL · TARGET 10' : 'WAVE ' + G.wave) + ' · SCORE ' + G.score + ' · KILLS ' + G.kills;
    syncViewBtn();
  } else if (G.state === 'paused') {
    G.state = 'playing'; audio.setPaused(false);
    document.body.classList.remove('paused');
    document.getElementById('pause').classList.add('hidden');
    lockPointer();
    syncViewBtn();
  }
}
G.togglePause = togglePause;

// ---------- Menu wiring ----------
function show(id) { const el = document.getElementById(id); el.classList.remove('hidden'); if (id === 'howto') { const body = el.querySelector('.howto-body'); if (body) body.scrollTop = 0; } }
function hide(id) { document.getElementById(id).classList.add('hidden'); }
// ---------- Menu: mode cards + loadout ----------
let selectedMode = 'survival';
let startWeapon = 'rifle';
function selectMode(mode) {
  selectedMode = mode;
  document.getElementById('btnSurvival').classList.toggle('selected', mode === 'survival');
  document.getElementById('btnFFA').classList.toggle('selected', mode === 'ffa');
  document.getElementById('btnDeploy').textContent = mode === 'ffa' ? 'DEPLOY: FREE FOR ALL' : 'DEPLOY: SURVIVAL';
}
document.getElementById('btnSurvival').onclick = () => { audio.init(); audio.uiClick(); selectMode('survival'); };
document.getElementById('btnFFA').onclick = () => { audio.init(); audio.uiClick(); selectMode('ffa'); };
document.getElementById('btnDeploy').onclick = () => { audio.init(); audio.uiClick(); startGame(selectedMode); };
// Loadout: pick the weapon in hand at deploy. All five weapons are owned
// from spawn (freshPlayer deals full ammo for each), so the pick only
// chooses the starting weapon. Stat bars are computed from the real
// WEAPONS defs, never typed by hand.
const LOADOUT_STATS = [
  ['DAMAGE', (w) => w.damage * w.pellets, 120],
  ['RANGE', (w) => w.range, 200],
  ['FIRE RATE', (w) => w.rof, 9],
  ['MAG', (w) => (w.mag === Infinity ? 30 : w.mag), 30],
  ['RELOAD', (w) => (w.reload > 0 ? 1 / w.reload : 0), 1 / 0.9],
];
function loadoutStatsHTML(type) {
  const w = WEAPONS[type];
  let rows = '';
  for (const [label, fn, max] of LOADOUT_STATS) {
    const v = fn(w);
    // No magazine (knife) or no reload (knife) has no bar: a full or
    // near-empty bar with a "--" value reads as a broken stat.
    const noBar = (label === 'MAG' && w.mag === Infinity) || (label === 'RELOAD' && w.reload === 0);
    const pct = noBar ? 0 : Math.max(2, Math.min(100, Math.round(100 * v / max)));
    const val = label === 'RELOAD' ? (w.reload > 0 ? w.reload.toFixed(1) + 's' : '--') : (label === 'MAG' && w.mag === Infinity ? '--' : (label === 'FIRE RATE' ? v.toFixed(1) : Math.round(v)));
    rows += '<div class="stat-row"><span class="stat-label">' + label + '</span><span class="stat-track"><span class="stat-fill" style="display:block;width:' + pct + '%"></span></span><span class="stat-val">' + val + '</span></div>';
  }
  return '<div class="ls-name">' + w.name + '</div>' + rows;
}
function selectStartWeapon(type) {
  startWeapon = type;
  document.querySelectorAll('#loadoutChips .wchip').forEach((el) => el.classList.toggle('selected', el.dataset.weapon === type));
  document.getElementById('loadoutStats').innerHTML = loadoutStatsHTML(type);
}
(function buildLoadout() {
  const chips = document.getElementById('loadoutChips');
  for (const t of WEAPON_ORDER) {
    const w = WEAPONS[t];
    const b = document.createElement('button');
    b.className = 'wchip' + (t === 'rifle' ? ' selected' : '');
    b.dataset.weapon = t;
    const tag = (t === 'rifle' || t === 'shotgun' || t === 'rocket') ? 'PRIMARY' : 'ALWAYS CARRIED';
    b.innerHTML = w.name + '<span class="wtag">' + tag + '</span>';
    b.onclick = () => { audio.init(); audio.uiClick(); selectStartWeapon(t); };
    chips.appendChild(b);
  }
  document.getElementById('loadoutStats').innerHTML = loadoutStatsHTML('rifle');
})();
// The HUD VIEW button toggles on pointerdown, not click: with pointer lock
// engaged a mousedown re-requests the lock and the click never fires, so
// the toggle has to happen on the first event of the gesture. One gesture
// does the whole job: while playing it toggles in place; while paused (the
// state the game is in once the lock is gone) it toggles and resumes play,
// so the game stays in playing state after clicking VIEW.
let viewBtnPointerDown = false;
const viewBtn = document.getElementById('viewBtn');
function viewButtonAction() {
  if (G.state === 'paused') { G.toggleView(true); togglePause(); }
  else if (G.state === 'playing') { G.toggleView(); }
}
viewBtn.addEventListener('pointerdown', (e) => {
  e.preventDefault(); e.stopPropagation();
  // Flag, not a timestamp: a click can arrive seconds after the pointerdown
  // on a slow machine, and a time window would let the click toggle twice.
  // The flag is consumed by the click that belongs to this gesture, so a
  // later keyboard activation still works.
  viewBtnPointerDown = true;
  viewButtonAction();
});
viewBtn.addEventListener('click', () => {
  // Keyboard activation (Enter or Space on a focused button) fires click
  // with no pointerdown. A click that follows a pointerdown belongs to
  // the gesture that already toggled, so it is consumed, not re-run.
  if (viewBtnPointerDown) { viewBtnPointerDown = false; return; }
  viewButtonAction();
});
document.getElementById('btnHowto').onclick = () => { audio.init(); audio.uiClick(); show('howto'); };
document.getElementById('btnLayout').onclick = () => {
  audio.uiClick();
  if (G.setLayoutEdit) G.setLayoutEdit(true);
  document.getElementById('pause').classList.add('editing-layout');
};
document.getElementById('btnLayoutSave').onclick = () => { audio.uiClick(); if (G.saveLayout) G.saveLayout(); };
document.getElementById('btnLayoutReset').onclick = () => { audio.uiClick(); if (G.resetLayout) G.resetLayout(); };
document.getElementById('btnLayoutDone').onclick = () => {
  audio.uiClick();
  if (G.setLayoutEdit) G.setLayoutEdit(false);
  document.getElementById('pause').classList.remove('editing-layout');
};
document.getElementById('btnHowtoClose').onclick = () => { audio.uiClick(); hide('howto'); };
document.getElementById('btnResume').onclick = () => { audio.uiClick(); togglePause(); };
document.getElementById('btnPauseView').onclick = () => { audio.uiClick(); if (G.state === 'paused') { G.toggleView(true); togglePause(); } };
syncViewBtn();
document.getElementById('btnRestart').onclick = () => { audio.uiClick(); hide('pause'); audio.setPaused(false); startGame(G.mode); };
document.getElementById('btnQuitTitle').onclick = () => { audio.uiClick(); hide('pause'); document.body.classList.remove('paused'); audio.setPaused(false); audio.stopMusic(); G.state = 'title'; document.getElementById('hud').classList.remove('on'); show('title'); audio.startMusic('title'); };
document.getElementById('btnAgain').onclick = () => { audio.uiClick(); audio.restoreAfterGameOver(); startGame(G.mode); };
document.getElementById('btnOverTitle').onclick = () => { audio.uiClick(); audio.restoreAfterGameOver(); G.state = 'title'; hide('gameover'); show('title'); audio.startMusic('title'); };
initTouch(G);

// ---------- Main loop ----------
const clock = new THREE.Clock();
let fpsFrames = 0, fpsLastT = performance.now();
function animate() {
  requestAnimationFrame(animate);
  // Frame-rate independent step. The 0.1 s clamp keeps one slow frame from
  // teleporting physics, while game time still advances on slow machines.
  let dt = Math.min(clock.getDelta(), 0.1);
  const now = performance.now();
  // Honest FPS: wall-clock frames per second, never the clamped game delta.
  fpsFrames++;
  if (now - fpsLastT >= 1000) { document.getElementById('fpsNote').textContent = Math.round(fpsFrames * 1000 / (now - fpsLastT)) + ' FPS'; fpsFrames = 0; fpsLastT = now; }
  if (G.state === 'paused' || G.state === 'loading' || G.state === 'title' || G.state === 'augment') {
    // Idle scene behind menus: slow camera drift on title.
    if (G.state === 'title') { camera.position.set(Math.sin(now * 0.00008) * 18, 7, 26); camera.lookAt(0, 4, -20); map.update(dt, new THREE.Vector3(0, 0, 0)); }
    if (G.state === 'title' || G.state === 'loading' || G.state === 'augment') { view.rig.visible = false; if (tpBody) tpBody.group.visible = false; }
    renderer.render(scene, camera);
    return;
  }
  if (G.state !== 'playing' && G.state !== 'gameover') { renderer.render(scene, camera); return; }
  if (G.hitStopT > 0) { G.hitStopT -= dt; dt *= 0.08; }
  G.time += dt;
  const p = G.player;
  // Timers.
  fireT = Math.max(0, fireT - dt);
  G.bloom = Math.max(0, (G.bloom || 0) - dt * 1.4);
  if (reloading) { reloadT -= dt; if (reloadT <= 0) { reloading = false; const a = p.ammo[p.weapon]; const need = a.magSize - a.mag; const take = Math.min(need, a.reserve); a.mag += take; a.reserve -= take; hud.update(G); } }
  G.reloading = reloading;
  p.lastSwapT += dt;
  if (p.overdriveT > 0) p.overdriveT -= dt;
  else if (p.overdriveCd > 0) p.overdriveCd -= dt;
  if (p.overdriveT <= 0 && p.overdriveCd <= 0 && p._wasOverdrive) { p.overdriveCd = 25; p._wasOverdrive = false; }
  if (p.overdriveT > 0) p._wasOverdrive = true;
  updateArmor(dt);
  G.style.update(dt);
  pollGamepad(G, dt);
  // Firing.
  if ((G.firing || G.touchFiring) && G.state === 'playing') {
    const w = WEAPONS[p.weapon];
    if (w.auto || G._fireEdge !== true) G.tryFire(true);
    G._fireEdge = true;
  } else G._fireEdge = false;
  // Movement. Arrow keys turn the view (classic FPS layout) so the camera
  // can be aimed without pointer lock. A/D keep strafing; W/S and Up/Down move.
  if (keys['ArrowLeft']) p.yaw += 2.6 * dt;
  if (keys['ArrowRight']) p.yaw -= 2.6 * dt;
  const speedBase = (p.sprinting ? 8.6 : 5.6) * (1 + p.speedMult) * (p.aiming ? 0.55 : 1) * (p.crouching ? 0.55 : 1);
  let ix = 0, iz = 0;
  if (keys['KeyW'] || keys['ArrowUp']) iz -= 1;
  if (keys['KeyS'] || keys['ArrowDown']) iz += 1;
  if (keys['KeyA']) ix -= 1;
  if (keys['KeyD']) ix += 1;
  ix += p.padMove.x; iz += p.padMove.y;
  const ilen = Math.hypot(ix, iz);
  p.moveMag = Math.min(1, ilen);
  // Touch sprint: pushing the stick fully forward sprints, the same rule
  // as Shift on keyboard. Forward is padMove.y < 0, full deflection -1.
  p.sprinting = ((keys['ShiftLeft'] || keys['ShiftRight']) || p.padMove.y < -0.92) && iz < 0 && !p.aiming && !p.crouching;
  p.crouching = (keys['KeyC'] || keys['ControlLeft']) && p.moveMag < 0.5 && !p.sliding;
  if (ilen > 0.01) {
    const nx = ix / Math.max(1, ilen), nz = iz / Math.max(1, ilen);
    const sin = Math.sin(p.yaw), cos = Math.cos(p.yaw);
    // Rotate the input by +yaw into world space: W (0,-1) must map to
    // the camera facing (-sin yaw, -cos yaw). The old signs rotated by
    // -yaw instead, so W walked mirrored in x whenever the player had
    // turned: at yaw 90 degrees the player moved +x while facing -x
    // (measured live 2026-11-11: velocity +5.6 x at yaw PI/2). That is
    // why chasing a strafing robot never closed the distance, and why
    // touch melee against retreating robots stayed hard. One fix for
    // keyboard, touch joystick, and gamepad: all three feed ix/iz.
    const wx = nx * cos + nz * sin, wz = -nx * sin + nz * cos;
    const target = new THREE.Vector3(wx, 0, wz).multiplyScalar(speedBase * (p.sliding ? 1.5 : 1));
    p.vel.x += (target.x - p.vel.x) * Math.min(1, dt * (p.onGround ? 12 : 4));
    p.vel.z += (target.z - p.vel.z) * Math.min(1, dt * (p.onGround ? 12 : 4));
  } else {
    const f = p.sliding ? 1.2 : 10;
    p.vel.x -= p.vel.x * Math.min(1, dt * f);
    p.vel.z -= p.vel.z * Math.min(1, dt * f);
  }
  if (p.sliding) { p.slideT -= dt; if (p.slideT <= 0 || !p.onGround) p.sliding = false; }
  p.vel.y -= 22 * dt;
  const nextX = p.pos.x + p.vel.x * dt, nextZ = p.pos.z + p.vel.z * dt;
  if (!hitsCollider(map.colliders, nextX, p.pos.z, 0.45)) p.pos.x = nextX;
  if (!hitsCollider(map.colliders, p.pos.x, nextZ, 0.45)) p.pos.z = nextZ;
  p.pos.x = THREE.MathUtils.clamp(p.pos.x, map.bounds.minX, map.bounds.maxX);
  p.pos.z = THREE.MathUtils.clamp(p.pos.z, map.bounds.minZ, map.bounds.maxZ);
  p.pos.y += p.vel.y * dt;
  if (p.pos.y <= 0) { p.pos.y = 0; p.vel.y = 0; p.onGround = true; } else p.onGround = false;
  // Footsteps.
  if (p.moveMag > 0.2 && p.onGround) { p.stepT -= dt * (p.sprinting ? 2 : 1); if (p.stepT <= 0) { p.stepT = 0.42; audio.footstep(p.sprinting); } }
  // Camera. First person: eye position. Third person: behind and slightly
  // above the operator, pulled in when a container would clip the lens.
  // Rotation is identical in both views, so the crosshair stays the true
  // aim point: shots raycast from the camera along its view direction.
  const eyeH = eyeHeightOf(p);
  if (G.viewMode === 'third') {
    const back = new THREE.Vector3(Math.sin(p.yaw), 0, Math.cos(p.yaw));
    // Over-shoulder: the camera sits right of centre so the operator's
    // weapon stays visible beside the body instead of hiding behind it.
    const right = new THREE.Vector3(Math.cos(p.yaw), 0, -Math.sin(p.yaw));
    if (p.aiming) {
      // ADS: closer, lower over-shoulder camera so the sight reads large
      // and near the centre. The camera stays offset right of the aim ray:
      // putting it exactly on the ray looks straight through the operator,
      // whose torso and backpack fill the frame and hide the sight.
      // The offset is 0.70, not the hip 0.55: at 0.55 the operator filled
      // the left of the frame (footprint x 322 to 559 at 1280x720). The
      // third-person weapon x must match this offset exactly, or the red
      // dot moves off centre (see src/thirdperson.js).
      const ADS_RIGHT = 0.70;
      let dist = 1.8;
      while (dist > 1.2 && hitsCollider(map.colliders, p.pos.x + back.x * dist + right.x * ADS_RIGHT, p.pos.z + back.z * dist + right.z * ADS_RIGHT, 0.4)) dist -= 0.4;
      camera.position.set(p.pos.x + back.x * dist + right.x * ADS_RIGHT, Math.max(0.5, p.pos.y + eyeH + 0.20), p.pos.z + back.z * dist + right.z * ADS_RIGHT);
    } else {
      let dist = 3.4;
      while (dist > 1.2 && hitsCollider(map.colliders, p.pos.x + back.x * dist + right.x * 0.55, p.pos.z + back.z * dist + right.z * 0.55, 0.4)) dist -= 0.4;
      camera.position.set(p.pos.x + back.x * dist + right.x * 0.55, Math.max(0.5, p.pos.y + eyeH + 0.55), p.pos.z + back.z * dist + right.z * 0.55);
    }
  } else {
    camera.position.set(p.pos.x, p.pos.y + eyeH, p.pos.z);
  }
  camera.rotation.y = p.yaw; camera.rotation.x = p.pitch + (view.recoilPitch || 0); camera.rotation.z = p.sliding ? 0.06 : 0;
  if (G.shakeT > 0) { G.shakeT -= dt; camera.position.x += (Math.random() - 0.5) * G.shakeMag * 0.12; camera.position.y += (Math.random() - 0.5) * G.shakeMag * 0.12; if (G.shakeT <= 0) G.shakeMag = 0; }
  const targetFov = p.aiming ? 52 : 78;
  if (Math.abs(camera.fov - targetFov) > 0.2) { camera.fov += (targetFov - camera.fov) * Math.min(1, dt * 12); camera.updateProjectionMatrix(); }
  updatePlayerView(view, G, dt);
  // Exactly one player body is visible at all times. The first person rig
  // shows in first person, the full operator in third person.
  const inGame = G.state === 'playing' || G.state === 'paused';
  view.rig.visible = inGame && G.viewMode === 'first';
  if (tpBody) {
    tpBody.group.visible = inGame && G.viewMode === 'third';
    if (tpBody.group.visible) updateThirdPersonBody(tpBody, G, dt);
  }
  map.update(dt, p.pos);
  // Streaming: build next wave staging slowly, never in heavy combat.
  if (G.streamQueue.length && G.enemies.filter((e) => !e.dead).length < 4 && G.state === 'playing') {
    G.streamQueue.shift();
    G.streamPaused = false;
  } else if (G.enemies.filter((e) => !e.dead).length >= 8) G.streamPaused = true;
  // Spawning. Tighter rhythm: 0.55 s between spawns and up to 14 alive
  // at once, so the yard never goes quiet between waves.
  if (G.waveActive && G.spawnQueue.length) {
    G.spawnT -= dt;
    if (G.spawnT <= 0 && G.enemies.filter((e) => !e.dead).length < 14) { G.spawnT = 0.55; G.spawnEnemy(G.spawnQueue.shift()); }
  }
  // Enemies.
  const deadBodies = [];
  for (const e of G.enemies) {
    if (e.dead) { e.deathT += dt; animateEnemy(e, dt, G.time); if (e.deathT > 2.2) deadBodies.push(e); continue; }
    animateEnemy(e, dt, G.time);
    if (e.isBoss) {
      const bres = updateBoss(e, G, dt);
      if (bres && bres.kind === 'volley') {
        for (let i = 0; i < bres.count; i++) {
          const dir = new THREE.Vector3(p.pos.x - e.group.position.x, 2 - e.group.position.y, p.pos.z - e.group.position.z).normalize();
          setTimeout(() => spawnProjectile('rocket', e.group.position.clone().add(new THREE.Vector3(0, 1.8, 0)), dir.clone().multiplyScalar(26)), i * 220);
        }
      }
    }
    const act = updateEnemyAI(e, G, dt);
    if (act) resolveEnemyAction(e, act);
  }
  for (const d of deadBodies) { scene.remove(d.group); const i = G.enemies.indexOf(d); if (i >= 0) G.enemies.splice(i, 1); }
  // Projectiles.
  for (const pr of G.projectiles) {
    if (!pr.alive) continue;
    pr.vel.y -= pr.kind === 'grenade' ? 14 * dt : 0;
    pr.mesh.position.addScaledVector(pr.vel, dt);
    if (pr.kind === 'rocket') pr.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), pr.vel.clone().normalize());
    pr.fuse -= dt;
    let boom = pr.fuse <= 0 || pr.mesh.position.y <= 0.05;
    if (!boom) for (const e of G.enemies) { if (!e.dead && e.group.position.distanceTo(pr.mesh.position) < 1.1) { boom = true; break; } }
    if (!boom && pr.kind === 'rocket' && pr.mesh.position.distanceTo(p.pos) < 1.2) boom = true;
    if (boom) { pr.alive = false; scene.remove(pr.mesh); explode(pr.mesh.position.clone(), pr.kind === 'rocket' ? 6 : 5, pr.kind === 'rocket' ? 120 : 110, pr.kind === 'rocket' && pr.fromEnemy ? false : true); }
  }
  G.projectiles = G.projectiles.filter((x) => x.alive);
  // Pickups.
  for (const pk of G.pickups) {
    pk.t += dt; pk.mesh.rotation.y += dt * 3; pk.mesh.position.y = 0.6 + Math.sin(pk.t * 3) * 0.12;
    const d = pk.mesh.position.distanceTo(new THREE.Vector3(p.pos.x, 0.6, p.pos.z));
    if (d < 2.2) pk.mesh.position.lerp(new THREE.Vector3(p.pos.x, 0.6, p.pos.z), dt * 6);
    if (d < 1.1) {
      if (pk.kind === 'health') p.health = Math.min(p.maxHealth, p.health + 30);
      if (pk.kind === 'armor') p.armor = Math.min(p.maxArmor, p.armor + 40);
      if (pk.kind === 'ammo') for (const k in p.ammo) if (p.ammo[k].reserve !== Infinity) p.ammo[k].reserve += 30;
      audio.pickup(); hud.killfeed('PICKED UP ' + pk.kind.toUpperCase());
      scene.remove(pk.mesh); pk.taken = true; hud.update(G);
    }
  }
  G.pickups = G.pickups.filter((x) => !x.taken);
  // Ammo fallback: the player can never be stuck with empty weapons. When
  // every ballistic weapon is at 0 mag and 0 reserve, trickle reserve
  // rounds into the current ballistic weapon (or the rifle). Firing
  // auto-reloads from reserve, so the player is shooting again within a
  // couple of seconds. The trickle stops as soon as any reserve exists, so
  // it is a lifeline, not free ammo.
  if (G.state === 'playing') {
    const a = p.ammo;
    const dry = ['rifle', 'shotgun', 'rocket'].every((k) => a[k].mag === 0 && a[k].reserve === 0);
    if (dry) {
      G.ammoTrickleT = (G.ammoTrickleT || 0) + dt;
      if (G.ammoTrickleT >= 2) {
        G.ammoTrickleT = 0;
        const cur = ['rifle', 'shotgun', 'rocket'].includes(p.weapon) ? p.weapon : 'rifle';
        a[cur].reserve += 6;
        hud.update(G);
      }
    } else G.ammoTrickleT = 0;
  }
  // FFA.
  if (G.mode === 'ffa') updateFFA(G, dt);
  // Boss bar.
  if (G.boss && !G.boss.dead) hud.setBoss(true, Math.max(0, G.boss.hp / G.boss.maxHp));
  // Wave clear check.
  if (G.mode === 'survival' && G.waveActive && !G.spawnQueue.length && G.enemies.filter((e) => !e.dead).length === 0) waveCleared();
  fx.update(dt);
  hud.update(G);
  renderer.render(scene, camera);
}
function resolveEnemyAction(e, act) {
  const p = G.player;
  if (act.kind === 'lunge') {
    if (e.group.position.distanceTo(p.pos) < 2.4) G.damagePlayer(act.damage, e.group.position);
    return;
  }
  if (act.kind === 'shoot') {
    const targetPos = e.isBot && e.ffaTargetEnemy ? e.ffaTargetEnemy.group.position.clone().add(new THREE.Vector3(0, 1.3, 0)) : new THREE.Vector3(p.pos.x, p.pos.y + 1.3, p.pos.z);
    const d = e.group.position.distanceTo(targetPos);
    const miss = new THREE.Vector3((Math.random() - 0.5) * d * act.spread * 2, (Math.random() - 0.5) * d * act.spread, (Math.random() - 0.5) * d * act.spread * 2);
    fx.tracer(act.from, targetPos.clone().add(miss), e.type === 'robot' ? 0xff8844 : 0xffcc66);
    audio.shot(e.type === 'dog' ? 'dog' : 'enemy');
    const hitChance = Math.max(0.18, 0.62 - d * 0.012);
    if (Math.random() < hitChance) {
      if (e.isBot && e.ffaTargetEnemy) {
        const victim = e.ffaTargetEnemy;
        victim.hp -= act.damage;
        if (victim.hp <= 0 && !victim.dead) { victim.dead = true; victim.deathT = 0; e.ffaScore = (e.ffaScore || 0) + 1; hud.killfeed(e.name + ' eliminated ' + victim.name); }
      } else {
        // A bot whose target is the player has no ffaTargetEnemy, so the
        // old else-if (!e.isBot) dropped its shots entirely: tracers and
        // sound played, but the player never took damage. Everything that
        // is not a bot-vs-bot hit lands on the player.
        G.damagePlayer(act.damage, e.group.position);
      }
    }
  }
}

// ---------- Loading and boot ----------
async function boot() {
  const bar = document.getElementById('loadBar'); const txt = document.getElementById('loadText');
  // Load the textured humanoid models before the title shows, with real
  // progress on the loading bar, so the first frame of play already has
  // the real operator and enemies in it. If a model fails to load, the
  // loader falls back to the CDN and then to the procedural bodies, and
  // boot still completes: a missing model never blocks the game.
  await loadModels((frac, label) => { bar.style.width = Math.round(frac * 60) + '%'; txt.textContent = label; });
  tpBody = buildThirdPersonBody(scene);
  G.thirdPerson = tpBody;
  const steps = [['BUILDING CONTAINER STACKS...', 66], ['RAISING GANTRY CRANE...', 74], ['WETTING CONCRETE...', 84], ['ARMING WAVE 1...', 94], ['READY', 100]];
  for (const [label, pct] of steps) {
    txt.textContent = label; bar.style.width = pct + '%';
    await new Promise((r) => setTimeout(r, 120));
    renderer.render(scene, camera);
  }
  camera.position.set(0, 7, 26); camera.lookAt(0, 4, -20);
  renderer.render(scene, camera);
  document.getElementById('loading').classList.add('hidden');
  document.getElementById('title').classList.remove('hidden');
  G.state = 'title';
  // Autostart for headless verification: ?autostart=survival or ?autostart=ffa
  const params = new URLSearchParams(location.search);
  const auto = params.get('autostart');
  if (auto === 'survival' || auto === 'ffa') {
    G._noLockPause = true;
    startGame(auto);
    if (params.get('wave')) { /* wave jump is handled by startGame wave 1; test hooks use TO directly */ }
  }
}
boot();
animate();
