// enemies.js. Enemy models, walk animation, and combat AI.
// Humanoids and the robot are real textured GLB models (Mixamo Soldier and
// Xbot, see src/models.js) with skinned walk and run animation and
// code-posed aiming arms. The robot dog and the fallback figures are
// detailed procedural builds from capsules, spheres, and tapered parts with
// painted textures, not boxes. No external files beyond the two GLBs.
import * as THREE from 'three';
import { modelStore, cloneHumanoid, playClip, findBone, buildWolfMask, buildBoarMask, buildRobotCore, buildExoPlates } from './models.js';
import { buildWeaponMesh } from './weapons.js';

const MAT = {
  black: new THREE.MeshStandardMaterial({ color: 0x23262b, roughness: 0.85, metalness: 0.15 }),
  olive: new THREE.MeshStandardMaterial({ color: 0x4a4d38, roughness: 0.9, metalness: 0.1 }),
  vest: new THREE.MeshStandardMaterial({ color: 0x2e2a22, roughness: 0.95, metalness: 0.05 }),
  white: new THREE.MeshStandardMaterial({ color: 0xe8e8e6, roughness: 0.35, metalness: 0.55, envMapIntensity: 0.6 }),
  whiteDark: new THREE.MeshStandardMaterial({ color: 0x2a2c30, roughness: 0.5, metalness: 0.7 }),
  core: new THREE.MeshStandardMaterial({ color: 0xff5a1a, roughness: 0.3, metalness: 0.2, emissive: 0xff4400, emissiveIntensity: 1.6 }),
  exo: new THREE.MeshStandardMaterial({ color: 0x3d4a55, roughness: 0.45, metalness: 0.85, envMapIntensity: 0.6 }),
  exoDark: new THREE.MeshStandardMaterial({ color: 0x1e242b, roughness: 0.5, metalness: 0.8 }),
  dog: new THREE.MeshStandardMaterial({ color: 0x5a5e63, roughness: 0.45, metalness: 0.8 }),
  dogDark: new THREE.MeshStandardMaterial({ color: 0x33363b, roughness: 0.5, metalness: 0.7 }),
  eye: new THREE.MeshStandardMaterial({ color: 0xff2211, emissive: 0xff2200, emissiveIntensity: 2.2, roughness: 0.2 }),
  eyeAmber: new THREE.MeshStandardMaterial({ color: 0xffaa00, emissive: 0xff8800, emissiveIntensity: 2.0, roughness: 0.2 }),
};

function box(w, h, d, x, y, z, mat) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); m.castShadow = true; return m; }
function cyl(rt, rb, h, x, y, z, mat, seg) { const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg || 10), mat); m.position.set(x, y, z); m.castShadow = true; return m; }
function cap(r, len, x, y, z, mat) { const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 4, 10), mat); m.position.set(x, y, z); m.castShadow = true; return m; }
function sph(r, x, y, z, mat, sx, sy, sz) { const m = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 12), mat); m.position.set(x, y, z); if (sx) m.scale.set(sx, sy, sz); m.castShadow = true; return m; }

// ---- Detailed procedural humanoid (fallback when a GLB is unavailable) ----
// Rounded geometry with real proportions: capsule torso and limbs, sphere
// helmet, sculpted mask head. Same part layout as the old box build so the
// animation and hit code do not care which kind of figure it is.
function humanoidBase(mat, vestMat) {
  const g = new THREE.Group();
  const parts = {};
  parts.torso = cap(0.26, 0.4, 0, 1.28, 0, mat); parts.torso.scale.set(1, 1, 0.62); g.add(parts.torso);
  parts.vest = box(0.54, 0.58, 0.34, 0, 1.3, 0, vestMat); g.add(parts.vest);
  parts.head = new THREE.Group(); parts.head.position.set(0, 1.82, 0); g.add(parts.head);
  const helm = sph(0.17, 0, 0.03, 0, mat, 1, 0.92, 1); parts.head.add(helm);
  parts.legL = new THREE.Group(); parts.legL.position.set(-0.13, 0.95, 0); g.add(parts.legL);
  parts.legR = new THREE.Group(); parts.legR.position.set(0.13, 0.95, 0); g.add(parts.legR);
  parts.legL.add(cap(0.085, 0.7, 0, -0.45, 0, mat));
  parts.legR.add(cap(0.085, 0.7, 0, -0.45, 0, mat));
  parts.legL.add(box(0.15, 0.09, 0.28, 0, -0.9, 0.04, MAT.exoDark)); // boot
  parts.legR.add(box(0.15, 0.09, 0.28, 0, -0.9, 0.04, MAT.exoDark));
  parts.armL = new THREE.Group(); parts.armL.position.set(-0.32, 1.5, 0); g.add(parts.armL);
  parts.armR = new THREE.Group(); parts.armR.position.set(0.32, 1.5, 0); g.add(parts.armR);
  parts.armL.add(cap(0.065, 0.45, 0, -0.28, 0, mat));
  parts.armR.add(cap(0.065, 0.45, 0, -0.28, 0, mat));
  // Rifle held across the body.
  const gun = new THREE.Group();
  gun.add(box(0.06, 0.08, 0.7, 0, 0, -0.2, MAT.whiteDark));
  gun.add(box(0.05, 0.14, 0.08, 0, -0.1, 0.05, MAT.whiteDark));
  gun.position.set(0.1, 1.28, 0.3); gun.rotation.y = -0.3; g.add(gun);
  parts.gun = gun;
  return { g, parts };
}

// ---- Detailed procedural robot dog ----------------------------------------
// Capsule body, tapered legs with knee pivots, sculpted head with snout,
// armored plates, wagging tail, turret with a glowing sight.
function buildDog() {
  const g = new THREE.Group(); const parts = {};
  // Longer, lower body: the short capsule read as a small dark blob.
  const body = cap(0.16, 0.62, 0, 0.5, 0, MAT.dog); body.rotation.z = Math.PI / 2; g.add(body);
  parts.body = body;
  // Chest as a child of the group, not of the rotated capsule: the old
  // child sat at local (0.32, 0.02, 0) on the capsule, and the capsule's
  // 90 degree Z rotation threw it to (-0.02, 0.82, 0), a dark ball on
  // the middle of the back. That ball was the rear-view toy read. At the
  // front of the body it reads as a chest and stays hidden from behind.
  g.add(sph(0.17, 0.32, 0.5, 0, MAT.dogDark)); // chest
  const plateL = box(0.52, 0.16, 0.03, 0, 0.52, 0.17, MAT.dogDark); g.add(plateL);
  const plateR = box(0.52, 0.16, 0.03, 0, 0.52, -0.17, MAT.dogDark); g.add(plateR);
  // Rear haunches and rump: wide thigh bulges over the back legs and a
  // rounded, widened rear end, so the back reads as a quadruped's
  // hindquarters instead of a round tube end. Front view untouched.
  const haunchL = sph(0.15, -0.3, 0.5, 0.15, MAT.dogDark, 1, 0.9, 0.8); g.add(haunchL);
  const haunchR = sph(0.15, -0.3, 0.5, -0.15, MAT.dogDark, 1, 0.9, 0.8); g.add(haunchR);
  const rump = sph(0.15, -0.42, 0.52, 0, MAT.dogDark, 0.7, 1, 1.2); g.add(rump);
  parts.head = new THREE.Group(); parts.head.position.set(0.52, 0.62, 0); g.add(parts.head);
  // Skull stretched forward and flattened: the round ball head was the
  // toy read. The longer snout below carries the muzzle.
  parts.head.add(sph(0.12, 0, 0, 0, MAT.dog, 1.45, 0.9, 0.85)); // skull
  const snout = cyl(0.055, 0.085, 0.24, 0.16, -0.02, 0, MAT.dogDark, 8); snout.rotation.z = Math.PI / 2 - 0.15; parts.head.add(snout);
  const earGeo = new THREE.ConeGeometry(0.04, 0.1, 6);
  const earL = new THREE.Mesh(earGeo, MAT.dogDark); earL.position.set(-0.02, 0.12, 0.08); parts.head.add(earL);
  const earR = new THREE.Mesh(earGeo, MAT.dogDark); earR.position.set(-0.02, 0.12, -0.08); parts.head.add(earR);
  const eL = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 8), MAT.eye); eL.position.set(0.1, 0.04, 0.08); parts.head.add(eL);
  const eR = eL.clone(); eR.position.z = -0.08; parts.head.add(eR);
  const turret = new THREE.Group(); turret.position.set(-0.05, 0.72, 0); g.add(turret);
  turret.add(box(0.2, 0.12, 0.2, 0, 0, 0, MAT.whiteDark));
  const tBarrel = cyl(0.025, 0.025, 0.42, 0.28, 0.02, 0, MAT.whiteDark); tBarrel.rotation.z = Math.PI / 2; turret.add(tBarrel);
  const sight = new THREE.Mesh(new THREE.SphereGeometry(0.02, 8, 8), MAT.eyeAmber); sight.position.set(0.02, 0.08, 0); turret.add(sight);
  parts.turret = turret;
  const tail = new THREE.Group(); tail.position.set(-0.5, 0.58, 0); g.add(tail);
  // Two-segment tail, thick at the base and tapering to the tip with a
  // visible bend: the single thin rod read as an antenna from behind.
  const tailBase = cyl(0.065, 0.05, 0.2, -0.1, 0.08, 0, MAT.dogDark, 6); tailBase.rotation.z = 0.55; tail.add(tailBase);
  const tailTip = cyl(0.05, 0.03, 0.18, -0.26, 0.2, 0, MAT.dogDark, 6); tailTip.rotation.z = 0.75; tail.add(tailTip);
  parts.tail = tail;
  parts.legs = [];
  [[0.3, 0.13], [0.3, -0.13], [-0.3, 0.13], [-0.3, -0.13]].forEach(([x, z]) => {
    const leg = new THREE.Group(); leg.position.set(x, 0.38, z);
    leg.add(cap(0.055, 0.22, 0, -0.12, 0, MAT.dog)); // upper
    const lower = new THREE.Group(); lower.position.set(0, -0.24, 0);
    lower.add(cap(0.045, 0.16, 0, -0.08, 0, MAT.dogDark));
    leg.add(lower);
    g.add(leg); parts.legs.push(leg);
  });
  return { g, parts };
}

// ---- GLB humanoid ---------------------------------------------------------
// Soldier clone with a mask on the head bone and a rifle in the right hand.
// Arms are posed by code after the mixer runs, so the figure aims at the
// player while the legs play the walk or run clip.
//
// Facing: the Soldier model faces -Z in its own space. Its scene root
// carries a -90 degree X rotation from the Z-up authored file, so the
// authored forward (+Y) lands on -Z in three.js space. The enemy group
// faces its target with +Z (lookAt), so without a wrapper the mercenary
// shows its back to the player while its rifle points at them: measured
// live, group +Z to the player 1.0 while head and spine +Z point away
// (-0.99, -0.97), and the close-up shows the back of the helmet, the
// vest back, and the buttocks. The clone therefore lives inside a
// wrapper rotated 180 degrees, and the wrapper is the enemy group. The
// Xbot does not need this: it is authored Y-up and faces +Z, and its
// close-up shows its face and chest toward the player.
// (The third-person body had the same PI rotation in thirdperson.js
// with the opposite assumption in its comment; round 3 fixed it with
// its own re-measurement: the clone needs no rotation, and its arms use
// the Soldier AIM_POSE below.)
function buildGLBHumanoid(type, tint) {
  const inst = cloneHumanoid('soldier');
  if (!inst) return null;
  const { group, mixer, bones, clips } = inst;
  const wrapper = new THREE.Group();
  group.rotation.y = Math.PI;
  wrapper.add(group);
  const parts = {};
  // Tint the body material per type: wolf dark slate, boar olive brown.
  wrapper.traverse((o) => {
    if (o.isMesh && o.material && o.material.map) o.material.color.set(tint);
  });
  // Mask on the head bone, replacing the visor face. Only wolf and boar
  // wear animal masks; the exo wears its armor plates instead.
  const headBone = findBone(bones, 'Head');
  const mask = type === 'wolf' ? buildWolfMask() : type === 'boar' ? buildBoarMask() : null;
  if (headBone && mask) { headBone.add(mask); mask.position.set(0, 0.02, 0.02); }
  // Tag the visor mesh as head so a shot to the face counts as a headshot.
  wrapper.traverse((o) => { if (o.isMesh && o.name && o.name.toLowerCase().includes('visor')) o.userData.part = 'head'; });
  // Rifle in the right hand, held forward by the code-posed arm.
  // The mount rotates the rifle so its -Z barrel points along the hand
  // bone's +Y: measured live, the hand's +Y points forward (the fingers
  // direction) and its +X points up when the arm is posed forward, so
  // rotation (90, 0, -90) degrees puts the barrel forward and keeps the
  // red dot sight on top. The old Y-90 mount put the barrel on the
  // hand's -X, which points DOWN once the arm is forward, and the rifle
  // read as pointing at the ground. The grip sits at local (0,-0.08,0.16),
  // scaled 1.15, so the rifle is offset the other way to put the grip
  // on the hand.
  // The rifle is built in metres, but the hand bone lives in a
  // centimetre skeleton: its world scale is about 0.01, so a rifle
  // parented to it shrinks to about a centimetre and is invisible.
  // Measure the bone's world scale and scale the mount back up by its
  // inverse so the rifle is full size in the world.
  const hand = findBone(bones, 'RightHand');
  const gunMount = new THREE.Group();
  gunMount.rotation.set(Math.PI / 2, 0, -Math.PI / 2);
  if (hand) {
    group.updateMatrixWorld(true);
    const be = hand.matrixWorld.elements;
    const boneScale = Math.hypot(be[0], be[1], be[2]) || 1;
    gunMount.scale.setScalar(1 / boneScale);
  }
  const rifle = buildWeaponMesh('rifle');
  rifle.scale.setScalar(1.15);
  rifle.position.set(0, 0.09, -0.18);
  gunMount.add(rifle);
  if (hand) hand.add(gunMount);
  parts.gunMount = gunMount;
  parts.headBone = headBone;
  parts.armR = findBone(bones, 'RightArm');
  parts.armL = findBone(bones, 'LeftArm');
  parts.foreR = findBone(bones, 'RightForeArm');
  parts.foreL = findBone(bones, 'LeftForeArm');
  parts.handR = hand;
  parts.handL = findBone(bones, 'LeftHand');
  parts.head = headBone;
  // Spine2 drives the walk compensation in animateEnemy: the clip's
  // spine yaw carries the fixed left-arm pose around.
  parts.spine2 = findBone(bones, 'Spine2') || findBone(bones, 'Spine1');
  return { g: wrapper, parts, mixer, bones, clips, flashMats: collectFlashMats(wrapper) };
}

function collectFlashMats(group) {
  const mats = [];
  group.traverse((o) => {
    if (!o.isMesh) return;
    const list = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of list) {
      if (m && m.emissive && (m.emissiveIntensity || 0) <= 1 && !mats.includes(m)) mats.push(m);
    }
  });
  return mats;
}

function buildGLBRobot() {
  const inst = cloneHumanoid('xbot');
  if (!inst) return null;
  const { group, mixer, bones, clips } = inst;
  const parts = {};
  // White unbranded shell: pale surface, dark joints.
  group.traverse((o) => {
    if (!o.isMesh) return;
    const list = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of list) {
      if (m.name && m.name.toLowerCase().includes('joint')) { m.color.set(0x2a2c30); m.roughness = 0.5; m.metalness = 0.7; }
      else { m.color.set(0xe8e8e6); m.roughness = 0.35; m.metalness = 0.55; }
    }
  });
  // Glowing chest core on the spine bone, the weak point.
  const spine = findBone(bones, 'Spine2') || findBone(bones, 'Spine1');
  const core = buildRobotCore();
  if (spine) { spine.add(core); core.position.set(0, 0.02, 0.12); }
  parts.weak = core;
  // Emissive eye dots on the head bone.
  const headBone = findBone(bones, 'Head');
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0xff5522, emissive: 0xff3300, emissiveIntensity: 2.4, roughness: 0.2 });
  const eL = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 8), eyeMat);
  const eR = eL.clone();
  if (headBone) { eL.position.set(-0.04, 0.02, 0.09); eR.position.set(0.04, 0.02, 0.09); headBone.add(eL); headBone.add(eR); }
  // Rifle in the right hand, same aim pose as the mercenaries.
  // Mount rotation puts the -Z barrel along the hand bone's -X, which
  // points forward (the fingers direction) when the arm is posed
  // forward, and the rifle offset puts the grip on the hand. The
  // rifle is built in metres but the hand bone lives in a centimetre
  // skeleton (world scale about 0.01), so scale the mount back up by
  // the inverse of the bone's world scale or the rifle shrinks to
  // about a centimetre and is invisible.
  const hand = findBone(bones, 'RightHand');
  const gunMount = new THREE.Group();
  gunMount.rotation.y = Math.PI / 2;
  if (hand) {
    group.updateMatrixWorld(true);
    const be = hand.matrixWorld.elements;
    const boneScale = Math.hypot(be[0], be[1], be[2]) || 1;
    gunMount.scale.setScalar(1 / boneScale);
  }
  const rifle = buildWeaponMesh('rifle');
  rifle.scale.setScalar(1.15);
  rifle.position.set(0, 0.09, -0.18);
  gunMount.add(rifle);
  if (hand) hand.add(gunMount);
  parts.gunMount = gunMount;
  parts.armR = findBone(bones, 'RightArm');
  parts.armL = findBone(bones, 'LeftArm');
  parts.foreR = findBone(bones, 'RightForeArm');
  parts.foreL = findBone(bones, 'LeftForeArm');
  parts.handR = hand;
  parts.handL = findBone(bones, 'LeftHand');
  parts.head = headBone;
  return { g: group, parts, mixer, bones, clips, flashMats: collectFlashMats(group) };
}

export function buildEnemy(type, opts) {
  const o = opts || {};
  const e = { type, hp: 100, maxHp: 100, speed: 3.2, damage: 9, attackRange: 26, attackCd: 0, shootTimer: 1 + Math.random(), walkPhase: Math.random() * 6, dead: false, deathT: 0, hitFlash: 0, holdT: 0, state: 'seek', strafeDir: Math.random() > 0.5 ? 1 : -1, strafeT: 0, ffaScore: 0, ffaTarget: null, isBot: !!o.isBot, team: o.team || 0, tactic: 'seek', tacticT: 0, flankDir: Math.random() > 0.5 ? 1 : -1, coverPos: null, flinchT: 0, lungeReady: false, lungeT: 0, formX: (Math.random() - 0.5) * 6, isGLB: false, headLine: 1.6, animState: null };
  let built;
  if (type === 'wolf' || type === 'boar') {
    built = modelStore.soldier ? buildGLBHumanoid(type, type === 'wolf' ? 0x9aa0a8 : 0xb08a5e) : null;
    if (!built) {
      built = humanoidBase(type === 'wolf' ? MAT.black : MAT.olive, MAT.vest);
      const mask = type === 'wolf' ? buildWolfMask() : buildBoarMask();
      built.parts.head.add(mask);
    } else {
      e.isGLB = true; e.rig = 'soldier'; e.mixer = built.mixer; e.bones = built.bones; e.clips = built.clips; e.flashMats = built.flashMats;
    }
    e.hp = e.maxHp = type === 'wolf' ? 100 : 130; e.speed = type === 'wolf' ? 3.6 : 3.1; e.damage = 10;
  } else if (type === 'robot') {
    built = modelStore.xbot ? buildGLBRobot() : null;
    if (!built) {
      built = humanoidBase(MAT.white, MAT.whiteDark);
      const skull = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 12), MAT.white); skull.position.set(0, 0.02, 0); built.parts.head.add(skull);
      const visor = box(0.2, 0.04, 0.06, 0, 0.03, 0.13, MAT.eye); built.parts.head.add(visor);
      const core = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.06, 16), MAT.core); core.rotation.x = Math.PI / 2; core.position.set(0, 1.36, 0.17); built.g.add(core);
      built.parts.weak = core; built.parts.weak.userData = { part: 'weak' };
    } else {
      e.isGLB = true; e.rig = 'xbot'; e.mixer = built.mixer; e.bones = built.bones; e.clips = built.clips; e.flashMats = built.flashMats; e.headLine = 1.65;
    }
    e.hp = e.maxHp = 120; e.speed = 3.4; e.damage = 9;
  } else if (type === 'dog') {
    built = buildDog();
    e.hp = e.maxHp = 70; e.speed = 6.2; e.damage = 12; e.attackRange = 18; e.headLine = 0.6;
  } else { // exo
    built = modelStore.soldier ? buildGLBHumanoid('exo', 0x7a8894) : null;
    if (!built) {
      built = humanoidBase(MAT.exo, MAT.exoDark);
      const helm = new THREE.Mesh(new THREE.SphereGeometry(0.19, 14, 12), MAT.exoDark); helm.scale.y = 1.05; built.parts.head.add(helm);
      const visor = box(0.22, 0.05, 0.08, 0, 0.02, 0.14, MAT.eye); built.parts.head.add(visor);
      const pack = box(0.4, 0.5, 0.18, 0, 1.3, -0.28, MAT.exoDark); built.g.add(pack);
      const core = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.06, 12), MAT.core); core.rotation.x = Math.PI / 2; core.position.set(0, 1.3, -0.38); built.g.add(core);
      built.parts.weak = core; built.parts.weak.userData = { part: 'weak' };
      built.parts.torso.scale.set(1.25, 1.1, 1.3);
      built.parts.vest.scale.set(1.25, 1.1, 1.3);
    } else {
      e.isGLB = true; e.rig = 'soldier'; e.mixer = built.mixer; e.bones = built.bones; e.clips = built.clips; e.flashMats = built.flashMats;
      const plates = buildExoPlates();
      const spine = findBone(built.bones, 'Spine2') || findBone(built.bones, 'Spine1');
      if (spine) spine.add(plates);
      built.parts.weak = plates.userData.weak;
      built.parts.bar = plates.userData.bar;
      e.headLine = 1.67;
    }
    e.hp = e.maxHp = 260; e.speed = 2.2; e.damage = 16; e.attackRange = 30;
  }
  e.group = built.g; e.parts = built.parts;
  e.group.traverse((m) => { if (m.isMesh) { m.userData.enemyRef = e; if (!m.userData.part) m.userData.part = 'body'; } });
  // Mask meshes count as head hits.
  if (e.parts.head && e.isGLB) {
    // Head bone children added after the traverse above are masks; tag them.
    e.parts.head.traverse((m) => { if (m.isMesh && m.userData.part === 'body') m.userData.part = 'head'; });
  } else if (built.parts.head) built.parts.head.traverse((m) => { if (m.isMesh) m.userData.part = 'head'; });
  if (built.parts.weak) built.parts.weak.userData.part = 'weak';
  e.group.position.copy(o.pos || new THREE.Vector3(0, 0, 0));
  e.height = type === 'dog' ? 0.8 : type === 'exo' ? 2.1 : 1.9;
  e.radius = type === 'dog' ? 0.5 : 0.45;
  return e;
}

// Aim pose per skeleton, applied to the arm bones each frame after the
// mixer runs. The Xbot and Soldier rigs have different arm-bone bind
// orientations: the Y swing that points Xbot arms forward points Soldier
// arms backward and down, so one shared rotation cannot aim both (the
// robot fix proved it: robot arms forward 0.96 to 0.99, mercenary arms
// forward -0.7 to 0.44 with the same values). Poses are [x, y, z] Euler
// rotations. The Soldier values were measured live on the Soldier rig.
// The hand bones are posed too, with a fixed rotation, because a
// clip-driven wrist tilts the rifle up to 27 degrees through the walk
// cycle; fixing the wrist keeps the muzzle level at every phase. The
// +0.12 hand pitch levels the Xbot barrel (measured: barrel up 0.14
// with a free wrist, 0.00 to 0.01 with the pitch).
// The Soldier pose is sign-flipped against the pre-wrapper measurement:
// the wrapper rotates the clone 180 degrees, so the local rotation that
// used to point an arm at +Z now points it at -Z. The flipped values
// were re-measured live after the wrapper (probe8): mercenary arms
// forward 0.92 to 0.97, barrel forward 0.98 to 0.99 and up -0.04 to
// -0.09, sight up 0.94 to 0.97, head to player 0.99. The left arm fwd
// dipped to 0.74 in some walk phases (probe12: swinging it further to
// -2.2 made it worse, 0.67); the left hand stays on the rifle at 0.27
// to 0.29 m, so -2.1 stands as the base angle, with a phase-aware
// compensation in animateEnemy that lifts the dips (gain 2.4 with a
// forearm counter-rotation so the hand stays on the grip, fitted and
// re-measured in the 2026-11-11 improvement round; a cycle 3 shoulder
// freeze was tried and reverted as a null result, see animateEnemy).
const AIM_POSE = {
  xbot: {
    armR: [0, 1.25, -0.15], foreR: [-0.35, 0, 0],
    armL: [0, -1.05, 0.15], foreL: [-0.9, 0, 0],
    handR: [0, 0, 0.12], handL: [0, 0, 0],
  },
  soldier: {
    armR: [1.25, 0, 0], foreR: [0.35, 0, 0],
    armL: [-2.1, 0, 0], foreL: [0.5, 0, 0],
    handR: [0, 0, -0.12], handL: [0, 0, 0],
  },
};

export function animateEnemy(e, dt, time) {
  const p = e.parts;
  if (e.dead) {
    if (e.mixer && !e._deathStopped) { e.mixer.stopAllAction(); e._deathStopped = true; }
    e.group.rotation.x = Math.max(e.group.rotation.x - dt * 3, -Math.PI / 2 + 0.08);
    e.group.position.y = Math.max(e.group.position.y - dt * 0.4, -0.1);
    return;
  }
  // Hit flinch: lean away from the blow for a fifth of a second, then ease
  // back upright. Hit-stop alone does not sell a hit; the lean does.
  if (e.flinchT > 0) {
    e.flinchT -= dt;
    e.group.rotation.x = -0.1 * Math.max(0, e.flinchT / 0.18);
  } else e.group.rotation.x = 0;
  const moving = e.moving || false;
  e._deathStopped = false;
  if (e.mixer) {
    // Skinned animation: legs from the clip, arms posed by code so the
    // rifle aims at the player while the figure walks or runs.
    const want = moving ? (e.speed > 5 ? 'run' : 'walk') : 'idle';
    if (want !== e.animState) { playClip(e.mixer, e.clips, want, 0.15); e.animState = want; }
    e.mixer.update(dt);
    // Per-skeleton aim pose, measured live on each rig (probe8).
    const pose = AIM_POSE[e.rig || 'soldier'];
    if (p.armR) p.armR.rotation.set(pose.armR[0], pose.armR[1], pose.armR[2]);
    if (p.foreR) p.foreR.rotation.set(pose.foreR[0], pose.foreR[1], pose.foreR[2]);
    if (p.armL) p.armL.rotation.set(pose.armL[0], pose.armL[1], pose.armL[2]);
    if (p.foreL) p.foreL.rotation.set(pose.foreL[0], pose.foreL[1], pose.foreL[2]);
    if (p.handR) p.handR.rotation.set(pose.handR[0], pose.handR[1], pose.handR[2]);
    if (p.handL) p.handL.rotation.set(pose.handL[0], pose.handL[1], pose.handL[2]);
    if (p.head) p.head.rotation.x = -0.05;
    // Left-arm walk compensation (Soldier rig only). The walk clip drives
    // the spine yaw, and the spine carries the fixed local arm direction
    // around, so the left arm dips to 0.74 forward in some walk phases
    // even though the arm bone itself is posed at a fixed -2.1. Measured
    // over 40 walk samples: armL forward tracks spine2 rotation.y with
    // correlation 0.995 and slope 1.33. The upper arm is corrected by
    // -gain * dip, and the forearm counter-rotates by the same amount, so
    // the hand stays on the rifle grip instead of swinging off it: gain
    // 1.9 without the counter-rotation lifted the dip to 0.83 but let the
    // hand drift to 0.37 m off the barrel line. Gain 2.4 with the
    // counter-rotation, fitted and re-measured in the 2026-11-11
    // improvement round, gives 0.80 with the hand at 0.33 m. One-sided:
    // it only lifts dips, never pushes the peaks down. Cycle 3 tried
    // freezing the left shoulder yaw at 0.10 in walk instead, after a
    // diagnostic showed the shoulder yaw correlating -0.941 with the
    // dip; the freeze held (shoulder yaw exactly 0.10 in all 40
    // samples) but the dip stayed at 0.78, so the correlation was phase
    // correlation, not causation, and the freeze was reverted: the
    // dip is driven by the whole spine and hips yaw chain, not one
    // bone. The target pair (forward 0.85 or better, hand 0.27 to
    // 0.29 m) is not met by any arm-chain rotation tried. Cycle 4,
    // fix round 2, 2026-11-11, tried counter-yawing the left upper
    // arm by the total chest yaw (one-sided, dead zone 0.16): the
    // correction ran (arm rotation.y reached 0.36 at the worst
    // phase) but the numbers did not move, min 0.80 to 0.81, hand
    // max still 0.33, so it was reverted as a null result like the
    // cycle 3 freeze. The reason it cannot work: a yaw about the
    // arm bone's own long axis spins the arm in place and cannot
    // move the shoulder-to-hand chord, so the dip, which is the
    // whole chain yawing the arm frame in the horizontal plane,
    // needs a correction about the world vertical, not a local
    // bone yaw. That is a different mechanism and was not tried.
    // Xbot arms do not dip (0.91 to 1.00), so they are left alone.
    if ((e.rig || 'soldier') === 'soldier' && moving && p.spine2 && p.armL) {
      const dip = Math.min(0, p.spine2.rotation.y + 0.04);
      const corr = -2.4 * dip;
      p.armL.rotation.x = pose.armL[0] + corr;
      if (p.foreL) p.foreL.rotation.x = pose.foreL[0] - corr;
    }
    if (e.lungeReady && e.type === 'dog') { /* dogs use the procedural branch */ }
    // Hit flash: pulse the body materials red on the exact frame of
    // contact, then restore. A scale pulse reads as a toy growing.
    if (e.flashMats) {
      const f = Math.max(0, e.hitFlash);
      for (const m of e.flashMats) { m.emissive.setHex(f > 0 ? 0x881111 : 0x000000); m.emissiveIntensity = f > 0 ? 0.9 : 0; }
    }
    if (e.hitFlash > 0) e.hitFlash -= dt;
  } else {
    const sw = moving ? Math.sin(time * (e.type === 'dog' ? 14 : 9) + e.walkPhase) * 0.55 : 0;
    if (p.legL) { p.legL.rotation.x = sw; p.legR.rotation.x = -sw; p.armL.rotation.x = -sw * 0.7; p.armR.rotation.x = sw * 0.7 - 0.5; }
    if (p.legs) {
      p.legs.forEach((leg, i) => { leg.rotation.x = Math.sin(time * 14 + e.walkPhase + i * Math.PI) * 0.5; });
      if (p.turret) p.turret.rotation.y = Math.sin(time * 2 + e.walkPhase) * 0.4;
      if (p.tail) p.tail.rotation.y = Math.sin(time * 6 + e.walkPhase) * 0.35;
      // Lunge telegraph: crouch low and lock the turret on the target.
      if (e.lungeReady) { e.group.position.y = -0.08; if (p.turret) p.turret.rotation.y = 0; }
      else e.group.position.y = 0;
    }
    if (p.torso) p.torso.position.y = 1.25 + (moving ? Math.abs(Math.sin(time * 9 + e.walkPhase)) * 0.04 : Math.sin(time * 2) * 0.01);
    if (e.hitFlash > 0) { e.hitFlash -= dt; const s = 1 + Math.max(0, e.hitFlash) * 1.5; e.group.scale.setScalar(s); } else e.group.scale.setScalar(e.type === 'exo' ? 1.08 : 1);
  }
  if (p.weak) { const cm = p.weak.material; if (cm.emissiveIntensity !== undefined) cm.emissiveIntensity = 1.4 + Math.sin(time * 5) * 0.7; }
}

function dist2D(a, b) { const dx = a.x - b.x, dz = a.z - b.z; return Math.sqrt(dx * dx + dz * dz); }

// Per-type tactics. Mercenaries flank and use cover. Robots advance in
// formation and fire in volleys. Dogs rush in arcs and telegraph the lunge.
export function updateEnemyAI(e, G, dt) {
  if (e.dead) return null;
  if (e.holdT > 0) { e.holdT -= dt; return null; }
  if (e.flinchT > 0) return null;
  const target = e.isBot && e.ffaTarget ? e.ffaTarget.pos : G.player.pos;
  const d = dist2D(e.group.position, target);
  // Last hostile alive: it must actively seek the player, never hide in
  // cover, flank, or strafe at range. Otherwise the wave cannot be
  // cleared when the final enemy parks behind a container or kites at
  // 7 to 8 m (the mercenary picker never advances a wolf there).
  const lastAlive = G.enemies.filter((o) => !o.dead).length <= 1;
  const dir = new THREE.Vector3(target.x - e.group.position.x, 0, target.z - e.group.position.z);
  if (dir.lengthSq() > 0.001) dir.normalize();
  e.group.lookAt(target.x, e.group.position.y, target.z);
  e.strafeT -= dt;
  if (e.strafeT <= 0) { e.strafeDir *= -1; e.strafeT = 1 + Math.random() * 2; }
  const perp = new THREE.Vector3(-dir.z, 0, dir.x);
  let move = new THREE.Vector3();
  e.attackCd -= dt;
  if (e.type === 'dog') {
    // Arc rush: close on a curve, not a straight line, so the dog is hard
    // to lead. Lunge is telegraphed: 0.45 s crouch before the strike.
    if (d < 3.5) {
      if (!e.lungeReady && e.attackCd <= 0) { e.lungeReady = true; e.lungeT = 0.45; }
      if (e.lungeReady) {
        e.lungeT -= dt;
        if (e.lungeT <= 0) { e.lungeReady = false; e.attackCd = 1.4; return { kind: 'lunge', damage: e.damage }; }
        e.moving = false;
        return null;
      }
    }
    if (d > 2.2) move.add(dir.clone().multiplyScalar(0.85)).addScaledVector(perp, 0.6 * e.strafeDir);
    else { move.add(perp.clone().multiplyScalar(e.strafeDir * 0.5)); if (e.attackCd <= 0) { e.attackCd = 1.1; return { kind: 'lunge', damage: e.damage }; } }
  } else if (e.type === 'robot') {
    // Formation: hold a lateral offset, keep separation from nearby
    // robots, advance together toward the player. The strafe is 0.7,
    // not 0.4: the formation term below is 0.35 along the same axis, so
    // a 0.4 strafe nearly cancels it when they oppose (net 0.05, under
    // the moving threshold) and the robot stands still for a whole
    // strafe period. With 0.7 the worst net is 0.35, a real strafe.
    if (d > e.attackRange * 0.7) move.add(dir);
    else if (d < 6) move.add(dir.clone().multiplyScalar(-1));
    else if (lastAlive) move.add(dir);
    else move.add(perp.clone().multiplyScalar(e.strafeDir * 0.7));
    const wantX = e.formX;
    const side = perp.clone().multiplyScalar(wantX - e.group.position.clone().sub(target).dot(perp));
    move.addScaledVector(side.normalize(), 0.35);
    for (const o of G.enemies) {
      if (o === e || o.dead || o.type !== 'robot') continue;
      const od = dist2D(e.group.position, o.group.position);
      if (od < 3 && od > 0.01) {
        const away = new THREE.Vector3(e.group.position.x - o.group.position.x, 0, e.group.position.z - o.group.position.z).normalize();
        move.addScaledVector(away, (3 - od) * 0.5);
      }
    }
  } else {
    // Mercenaries: pick a tactic on a timer. Flank runs wide around the
    // player. Cover hides behind the nearest tall container between the
    // enemy and the player, then peeks out to shoot.
    e.tacticT -= dt;
    if (e.tacticT <= 0) {
      e.tacticT = 1.5 + Math.random() * 1.5;
      if (d > 18) e.tactic = 'advance';
      // Wolf close-in: a wolf past 8 m closes in instead of flanking,
      // covering, or strafing away. The old picker let the last wolf
      // kite at 7 to 11 m forever, never closing to attack. Wolves only;
      // boars and mercenaries keep the old picker.
      else if (e.type === 'wolf' && d > 8) e.tactic = 'advance';
      else if (d < 7) e.tactic = Math.random() < 0.5 ? 'retreat' : 'cover';
      else { const r = Math.random(); e.tactic = r < 0.35 ? 'flank' : r < 0.6 ? 'cover' : 'strafe'; }
      if (e.tactic === 'flank') e.flankDir = Math.random() > 0.5 ? 1 : -1;
      if (e.tactic === 'cover') {
        let best = null, bestD = 1e9;
        for (const c of G.map.colliders) {
          if (c.h < 2) continue;
          const cd = Math.hypot(c.x - e.group.position.x, c.z - e.group.position.z);
          if (cd < 14 && cd < bestD) { bestD = cd; best = c; }
        }
        if (best) {
          const away = new THREE.Vector3(best.x - target.x, 0, best.z - target.z).normalize();
          e.coverPos = new THREE.Vector3(best.x + away.x * (best.hx + 1.2), 0, best.z + away.z * (best.hz + 1.2));
        } else e.tactic = 'strafe';
      }
    }
    // Last hostile alive: close in on the player instead of hiding or
    // kiting. Forced every frame so it wins over whatever the picker
    // chose; it stops at 2 m, close enough to engage.
    if (lastAlive && d > 2) { e.tactic = 'advance'; e.coverPos = null; }
    if (e.tactic === 'advance') move.add(dir);
    else if (e.tactic === 'retreat') move.add(dir.clone().multiplyScalar(-1));
    else if (e.tactic === 'flank') {
      const flankPoint = new THREE.Vector3(target.x, 0, target.z).addScaledVector(perp, e.flankDir * 11);
      const toFlank = flankPoint.clone().sub(e.group.position); toFlank.y = 0;
      if (toFlank.length() > 1.5) move.add(toFlank.normalize());
      else move.add(perp.clone().multiplyScalar(e.flankDir * 0.6));
    } else if (e.tactic === 'cover' && e.coverPos) {
      const toCover = e.coverPos.clone().sub(e.group.position); toCover.y = 0;
      if (toCover.length() > 1) move.add(toCover.normalize());
      else if (Math.random() < 0.02) e.tactic = 'strafe'; // peek out
    } else move.add(perp.clone().multiplyScalar(e.strafeDir * 0.6));
  }
  // Stuck escape: if the detector below wedged this bot against a
  // container, the escape direction replaces the normal move for a
  // second of game time, sideways out of the wedge. If the chosen step
  // is blocked, re-pick a free direction at once instead of walking
  // into the wall for the rest of the escape; if no direction is free
  // the bot is boxed in, so relocate it.
  if (e.escapeT > 0 && e._escapeDir) {
    e.escapeT -= dt;
    const px = e.group.position.x + e._escapeDir.x * 0.4;
    const pz = e.group.position.z + e._escapeDir.z * 0.4;
    if (hitsCollider(G.map.colliders, px, pz, e.radius)) {
      const d = pickEscapeDir(G, e, dir, perp);
      if (d) e._escapeDir = d;
      else { relocateEnemy(G, e); e.stuckEscapes = (e.stuckEscapes || 0) + 1; }
    }
    if (e.escapeT > 0) move.copy(e._escapeDir);
  }
  // Colliders: slide along boxes. If the direct step is fully blocked, step
  // sideways around the obstacle instead of standing stuck behind cover.
  const nx = e.group.position.x + move.x * e.speed * dt;
  const nz = e.group.position.z + move.z * e.speed * dt;
  let moved = false;
  if (!hitsCollider(G.map.colliders, nx, e.group.position.z, e.radius)) { e.group.position.x = nx; moved = true; }
  if (!hitsCollider(G.map.colliders, e.group.position.x, nz, e.radius)) { e.group.position.z = nz; moved = true; }
  if (!moved && move.lengthSq() > 0.01) {
    const px = e.group.position.x + perp.x * e.speed * dt;
    const pz = e.group.position.z + perp.z * e.speed * dt;
    if (!hitsCollider(G.map.colliders, px, e.group.position.z, e.radius)) { e.group.position.x = px; moved = true; }
    if (!hitsCollider(G.map.colliders, e.group.position.x, pz, e.radius)) { e.group.position.z = pz; moved = true; }
    if (!moved) {
      const qx = e.group.position.x - perp.x * e.speed * dt;
      const qz = e.group.position.z - perp.z * e.speed * dt;
      if (!hitsCollider(G.map.colliders, qx, e.group.position.z, e.radius)) { e.group.position.x = qx; moved = true; }
      if (!hitsCollider(G.map.colliders, e.group.position.x, qz, e.radius)) { e.group.position.z = qz; moved = true; }
    }
    if (moved) { e.strafeT = 0.4; }
  }
  e.group.position.x = THREE.MathUtils.clamp(e.group.position.x, G.map.bounds.minX, G.map.bounds.maxX);
  e.group.position.z = THREE.MathUtils.clamp(e.group.position.z, G.map.bounds.minZ, G.map.bounds.maxZ);
  // A bot whose centre is inside a collider can never walk out by steps:
  // every step destination is still inside the box, so the detector's
  // escapes fire and fail forever. Relocate it at once instead.
  if (hitsCollider(G.map.colliders, e.group.position.x, e.group.position.z, e.radius)) {
    relocateEnemy(G, e);
    e.stuckEscapes = (e.stuckEscapes || 0) + 1;
  }
  e.moving = move.lengthSq() > 0.01;
  // Stuck detector: a bot wedged against a container reports moving while
  // its position never changes, and can sit still for minutes in FFA. If
  // it has not moved in a second of game time, break out sideways and
  // force a fresh tactic pick. Sampled in 0.5 s windows so a slow frame
  // cannot trip it.
  if (e._stuckX === undefined) { e._stuckX = e.group.position.x; e._stuckZ = e.group.position.z; e._stuckClock = 0; e._stuckT = 0; e.escapeT = 0; e.stuckEscapes = 0; }
  e._stuckClock += dt;
  if (e._stuckClock >= 0.5) {
    const dMoved = Math.hypot(e.group.position.x - e._stuckX, e.group.position.z - e._stuckZ);
    if (e.moving && dMoved < 0.1) {
      e._stuckT += e._stuckClock;
      if (e._stuckT > 1.0 && e.escapeT <= 0) {
        e._stuckT = 0; e.stuckEscapes += 1;
        // The escape must head somewhere free: a blind perpendicular
        // fails when the wedge blocks that axis too. If no direction
        // is free the bot is boxed in, so relocate it.
        const d = pickEscapeDir(G, e, dir, perp);
        if (d) { e.escapeT = 1.2; e._escapeDir = d; }
        else relocateEnemy(G, e);
        e.strafeDir *= -1; e.tacticT = 0; e.coverPos = null;
      }
    } else e._stuckT = 0;
    e._stuckX = e.group.position.x; e._stuckZ = e.group.position.z; e._stuckClock = 0;
  }
  // Shooting. Robots fire in volleys: when one fires, nearby robots with a
  // short timer fire with it, so the player reads a volley, not a trickle.
  e.shootTimer -= dt;
  const los = d < e.attackRange && hasLineOfSight(G, e.group.position, target);
  if (los && e.shootTimer <= 0 && e.type !== 'dog') {
    e.shootTimer = e.type === 'exo' ? 1.5 + Math.random() * 0.6 : 0.9 + Math.random() * 0.8;
    if (e.type === 'robot') {
      for (const o of G.enemies) {
        if (o !== e && !o.dead && o.type === 'robot' && dist2D(e.group.position, o.group.position) < 10) o.shootTimer = Math.min(o.shootTimer, 0.25);
      }
    }
    return { kind: 'shoot', damage: e.damage, from: e.group.position.clone().add(new THREE.Vector3(0, 1.35, 0)), spread: e.type === 'exo' ? 0.05 : 0.09 };
  }
  if (los && e.type === 'dog' && d < 10) { e.shootTimer = Math.max(e.shootTimer, 0.4); if (e.shootTimer <= 0) { e.shootTimer = 0.9; return { kind: 'shoot', damage: e.damage * 0.6, from: e.group.position.clone().add(new THREE.Vector3(0, 0.7, 0)), spread: 0.12 }; } }
  return null;
}
export function hitsCollider(colliders, x, z, r) {
  for (const c of colliders) { if (Math.abs(x - c.x) < c.hx + r && Math.abs(z - c.z) < c.hz + r) return true; }
  return false;
}

// Free-spot search: the point itself when it is clear of every collider,
// else the nearest clear point on expanding rings. Spawn jitter used to
// place bots inside container colliders (measured live: 17.6 percent of
// the FFA jitter box around [14,-30], [32,20] and [22,30] is inside an
// inflated collider), and step-based movement can never walk a bot out
// of a box it starts inside, because every single step still lands
// inside. Anything that places an enemy must go through this.
export function findFreeSpot(G, x, z, r) {
  const cs = G.map.colliders, b = G.map.bounds;
  if (!hitsCollider(cs, x, z, r)) return { x, z };
  for (const rad of [0.5, 1, 1.5, 2, 3, 4, 6, 8, 12]) {
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const nx = THREE.MathUtils.clamp(x + Math.cos(a) * rad, b.minX, b.maxX);
      const nz = THREE.MathUtils.clamp(z + Math.sin(a) * rad, b.minZ, b.maxZ);
      if (!hitsCollider(cs, nx, nz, r)) return { x: nx, z: nz };
    }
  }
  return { x, z };
}

// Pick an escape direction that is actually free: probe the 1.2 m step
// and its midpoint against the colliders, perpendicular first, then away,
// toward, and the diagonals. Returns a unit Vector3, or null when every
// direction is blocked.
function pickEscapeDir(G, e, dir, perp) {
  const x = e.group.position.x, z = e.group.position.z, r = e.radius;
  const cands = [
    new THREE.Vector3(perp.x, 0, perp.z),
    new THREE.Vector3(-perp.x, 0, -perp.z),
    new THREE.Vector3(-dir.x, 0, -dir.z),
    new THREE.Vector3(dir.x, 0, dir.z),
  ];
  for (const s of [1, -1]) {
    cands.push(new THREE.Vector3(dir.x + perp.x * s, 0, dir.z + perp.z * s).normalize());
    cands.push(new THREE.Vector3(-dir.x + perp.x * s, 0, -dir.z + perp.z * s).normalize());
  }
  for (const d of cands) {
    if (!hitsCollider(G.map.colliders, x + d.x * 1.2, z + d.z * 1.2, r) && !hitsCollider(G.map.colliders, x + d.x * 0.6, z + d.z * 0.6, r)) return d;
  }
  return null;
}

// Relocate a bot that is inside a collider to the nearest free spot.
// Step-based movement can never free such a bot, so a short teleport is
// the only exit; the ring search keeps the jump as short as the geometry
// allows. Does not touch the escape counter; callers count it.
function relocateEnemy(G, e) {
  const s = findFreeSpot(G, e.group.position.x, e.group.position.z, e.radius);
  e.group.position.x = s.x; e.group.position.z = s.z;
  e._stuckX = s.x; e._stuckZ = s.z; e._stuckClock = 0; e._stuckT = 0; e.escapeT = 0;
  e.tacticT = 0; e.coverPos = null;
}
export function hasLineOfSight(G, from, to) {
  // Cheap check: blocked if a tall collider sits between the two points.
  for (const c of G.map.colliders) {
    if (c.h < 2) continue;
    const dx = to.x - from.x, dz = to.z - from.z;
    const len2 = dx * dx + dz * dz; if (len2 < 0.01) continue;
    let t = ((c.x - from.x) * dx + (c.z - from.z) * dz) / len2; t = Math.max(0, Math.min(1, t));
    const px = from.x + dx * t, pz = from.z + dz * t;
    if (Math.abs(px - c.x) < c.hx && Math.abs(pz - c.z) < c.hz) return false;
  }
  return true;
}
