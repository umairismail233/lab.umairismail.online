// thirdperson.js. Third person operator body.
// The main body is the real Mixamo Soldier GLB (see src/models.js): a
// textured tactical operator with skinned walk and run animation. The arms
// are posed by code after the mixer runs, so the figure aims its rifle at
// the crosshair while the legs play the walk or run clip. If the model
// fails to load, a detailed procedural body (capsules, sphere helmet,
// plate carrier) is used instead, so the player is never invisible.
import * as THREE from 'three';
import { buildWeaponMesh, makeFlashTexture } from './weapons.js';
import { modelStore, cloneHumanoid, playClip, findBone } from './models.js';

const cloth = new THREE.MeshStandardMaterial({ color: 0x5d6146, roughness: 0.9, metalness: 0.05 });
const dark = new THREE.MeshStandardMaterial({ color: 0x3a352c, roughness: 0.95, metalness: 0.05 });
const bootMat = new THREE.MeshStandardMaterial({ color: 0x2a2521, roughness: 0.85, metalness: 0.1 });
const helmetMat = new THREE.MeshStandardMaterial({ color: 0x4d5346, roughness: 0.7, metalness: 0.25 });
const gloveMat = new THREE.MeshStandardMaterial({ color: 0x6b5a44, roughness: 0.95, metalness: 0.05 });
const packMat = new THREE.MeshStandardMaterial({ color: 0x4d4636, roughness: 0.9, metalness: 0.05 });

function box(w, h, d, x, y, z, mat) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z); m.castShadow = true;
  return m;
}
function cap(r, len, x, y, z, mat) {
  const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 4, 10), mat);
  m.position.set(x, y, z); m.castShadow = true;
  return m;
}
function gloveHand() {
  const h = new THREE.Group();
  h.add(box(0.075, 0.06, 0.1, 0, 0, 0, gloveMat)); // palm
  for (let i = 0; i < 3; i++) {
    const f = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.013, 0.055, 8), gloveMat);
    f.rotation.z = Math.PI / 2; f.position.set(-0.022 + i * 0.022, -0.032, -0.02); f.castShadow = true; h.add(f);
  }
  const thumb = box(0.016, 0.035, 0.045, 0.045, 0.01, 0.01, gloveMat); thumb.rotation.z = -0.4; h.add(thumb);
  return h;
}
function makeLeg(side) {
  const leg = new THREE.Group();
  leg.position.set(0.12 * side, 0.98, 0);
  leg.add(cap(0.085, 0.42, 0, -0.25, 0, cloth)); // thigh
  leg.add(cap(0.075, 0.38, 0, -0.7, 0, cloth)); // shin
  leg.add(box(0.15, 0.1, 0.3, 0, -0.93, 0.05, bootMat)); // boot
  return leg;
}
function makeArm(side) {
  const shoulder = new THREE.Group();
  shoulder.position.set(0.32 * side, 0.55, 0);
  shoulder.add(cap(0.065, 0.36, 0, -0.22, 0, cloth)); // upper arm
  const elbow = new THREE.Group();
  elbow.position.set(0, -0.45, 0);
  elbow.add(cap(0.055, 0.34, 0, -0.2, 0, cloth)); // forearm
  const hand = gloveHand();
  hand.position.set(0, -0.46, 0.02);
  elbow.add(hand);
  shoulder.add(elbow);
  return { shoulder, elbow };
}

// Detailed procedural operator, used only when the Soldier model fails to
// load. Capsule limbs, sphere helmet, plate carrier, backpack, gloves.
function buildProceduralBody(scene) {
  const group = new THREE.Group();
  const legL = makeLeg(-1), legR = makeLeg(1);
  group.add(legL); group.add(legR);
  const upper = new THREE.Group();
  upper.position.set(0, 1.0, 0);
  group.add(upper);
  const torso = cap(0.27, 0.32, 0, 0.31, 0, cloth); torso.scale.set(1, 1, 0.6); upper.add(torso);
  const vestMat = new THREE.MeshStandardMaterial({ color: 0x2f2b24, roughness: 0.95, metalness: 0.05, emissive: 0x000000 });
  upper.add(box(0.54, 0.5, 0.08, 0, 0.33, -0.17, vestMat)); // plate carrier front
  upper.add(box(0.54, 0.5, 0.08, 0, 0.33, 0.17, vestMat)); // plate carrier back
  upper.add(box(0.14, 0.14, 0.05, -0.16, 0.28, -0.22, dark)); // pouches
  upper.add(box(0.14, 0.14, 0.05, 0.16, 0.28, -0.22, dark));
  upper.add(box(0.2, 0.12, 0.05, 0, 0.12, -0.22, dark));
  upper.add(box(0.4, 0.55, 0.2, 0, 0.35, 0.27, packMat)); // backpack
  upper.add(box(0.3, 0.08, 0.16, 0, 0.62, 0.27, dark)); // pack top
  const padL = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), vestMat); padL.position.set(-0.3, 0.58, 0); padL.castShadow = true; upper.add(padL);
  const padR = padL.clone(); padR.position.x = 0.3; upper.add(padR);
  const head = new THREE.Group();
  head.position.set(0, 0.68, 0);
  upper.add(head);
  const helm = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 12), helmetMat);
  helm.scale.y = 0.92; helm.position.y = 0.08; helm.castShadow = true; head.add(helm);
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.03, 16), helmetMat);
  brim.position.y = 0.02; head.add(brim);
  head.add(box(0.1, 0.08, 0.06, 0, 0.06, -0.17, dark)); // NVG mount
  head.add(box(0.34, 0.03, 0.05, 0, 0.1, 0, dark)); // headset band
  head.add(box(0.05, 0.1, 0.08, -0.17, 0.02, 0, dark)); // ear cup L
  head.add(box(0.05, 0.1, 0.08, 0.17, 0.02, 0, dark)); // ear cup R
  const armL = makeArm(-1), armR = makeArm(1);
  upper.add(armL.shoulder); upper.add(armR.shoulder);
  const weapons = {};
  for (const t of ['rifle', 'shotgun', 'rocket', 'grenade', 'melee']) {
    // No hands or sleeves on the third-person weapon: the operator's own
    // arms hold the rifle, and the viewmodel hands would hang detached
    // in the centre of the third-person ADS sight picture (blocker S3).
    const m = buildWeaponMesh(t, { hands: false });
    m.position.set(0.36, 0.42, -0.05);
    m.visible = false;
    upper.add(m); weapons[t] = m;
  }
  weapons.rifle.visible = true;
  const flashMat = new THREE.SpriteMaterial({ map: makeFlashTexture(), color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const flash = new THREE.Sprite(flashMat);
  flash.scale.setScalar(0.55);
  upper.add(flash);
  const flashLight = new THREE.PointLight(0xffa040, 0, 9, 2);
  upper.add(flashLight);
  group.visible = false;
  scene.add(group);
  return { group, upper, head, legL, legR, armL, armR, weapons, flash, flashMat, flashLight, vestMat, phase: 0, kick: 0, hitT: 0, mixer: null, flashParent: upper };
}

// GLB operator: the Soldier clone faces -Z in its own space (measured:
// head +Z to player forward +0.98 with no rotation), and the wrapper
// faces -Z at yaw 0 like the old procedural body, whose plate carrier
// front is at -Z. So the clone needs no rotation. The earlier
// rotation.y = Math.PI turned the body to face the camera while the
// rifle still pointed forward, so the operator showed its front to the
// player. Weapons stay parented to the wrapper at the old offsets, so
// the over-shoulder camera, ADS, and muzzle math do not change.
function buildGLBBody(scene, inst) {
  const wrapper = new THREE.Group();
  const clone = inst.group;
  clone.rotation.y = 0;
  wrapper.add(clone);
  const bones = inst.bones;
  const spine = findBone(bones, 'Spine2') || findBone(bones, 'Spine1');
  const head = findBone(bones, 'Head');
  // Vest flash: pulse the body material on a hit.
  let vestMat = null;
  clone.traverse((o) => { if (!vestMat && o.isMesh && o.material && o.material.map) vestMat = o.material; });
  const weapons = {};
  for (const t of ['rifle', 'shotgun', 'rocket', 'grenade', 'melee']) {
    // No hands or sleeves on the third-person weapon: the operator's own
    // arms hold the rifle, and the viewmodel hands would hang detached
    // in the centre of the third-person ADS sight picture (blocker S3).
    const m = buildWeaponMesh(t, { hands: false });
    m.scale.setScalar(1.15);
    // Chest height in wrapper space: the wrapper sits at the player's
    // feet, so the weapon sits at 1.42 m, not 0.42 m. At 0.42 m it hung
    // at knee height, hidden behind the legs, and the third-person ADS
    // dot projected to the bottom of the screen.
    m.position.set(0.36, 1.42, -0.05);
    m.visible = false;
    wrapper.add(m); weapons[t] = m;
  }
  weapons.rifle.visible = true;
  const flashMat = new THREE.SpriteMaterial({ map: makeFlashTexture(), color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const flash = new THREE.Sprite(flashMat);
  flash.scale.setScalar(0.55);
  wrapper.add(flash);
  const flashLight = new THREE.PointLight(0xffa040, 0, 9, 2);
  wrapper.add(flashLight);
  wrapper.visible = false;
  scene.add(wrapper);
  return { group: wrapper, upper: spine, head, legL: null, legR: null, armL: null, armR: null, weapons, flash, flashMat, flashLight, vestMat: vestMat || new THREE.MeshStandardMaterial({ color: 0x2f2b24 }), phase: 0, kick: 0, hitT: 0, mixer: inst.mixer, bones, clips: inst.clips, animState: null, flashParent: wrapper };
}

export function buildThirdPersonBody(scene) {
  const inst = modelStore.soldier ? cloneHumanoid('soldier') : null;
  if (inst) return buildGLBBody(scene, inst);
  return buildProceduralBody(scene);
}

export function updateThirdPersonBody(tp, G, dt) {
  const p = G.player;
  tp.group.position.set(p.pos.x, p.pos.y - (p.sliding ? 0.4 : p.crouching ? 0.25 : 0), p.pos.z);
  tp.group.rotation.y = p.yaw;
  const moving = p.moveMag > 0.1 && p.onGround;
  tp.phase += dt * (moving ? (p.sprinting ? 13 : 9) : 2);
  // Torso lean: slide leans back, crouch leans forward, pitch aims the chest.
  const baseLean = p.sliding ? 0.45 : p.crouching ? 0.18 : 0;
  const lean = baseLean - p.pitch * 0.5;
  if (tp.mixer) {
    // Skinned locomotion from the clip, arms posed by code so the rifle
    // stays aimed at the crosshair while the legs walk or run.
    const want = moving ? (p.sprinting ? 'run' : 'walk') : 'idle';
    if (want !== tp.animState) { playClip(tp.mixer, tp.clips, want, 0.15); tp.animState = want; }
    tp.mixer.update(dt);
    const aimK = p.aiming ? 1 : 0;
    const b = tp.bones;
    // Aim pose: the Soldier AIM_POSE measured on the enemy rig
    // (src/enemies.js), where it holds the arms forward 0.90 to 0.98
    // and the muzzle forward 0.96 to 1.00. The pose is body-relative,
    // so it transfers across the facing fix. The old values here
    // (-1.15 with a z tuck) pointed the right arm backward and up
    // (hand 0.68 m off the barrel line) and bent the left forearm
    // backward, so the left arm hung down at the side. Aiming tightens
    // each arm 0.15 further in its forward direction.
    const rArm = findBone(b, 'RightArm'), rFore = findBone(b, 'RightForeArm'), lArm = findBone(b, 'LeftArm'), lFore = findBone(b, 'LeftForeArm');
    const handR = findBone(b, 'RightHand'), handL = findBone(b, 'LeftHand');
    if (rArm) rArm.rotation.set(1.25 + aimK * 0.15, 0, 0);
    if (rFore) rFore.rotation.set(0.35, 0, 0);
    if (lArm) lArm.rotation.set(-2.1 - aimK * 0.05, 0, 0);
    if (lFore) lFore.rotation.set(0.5, 0, 0);
    if (handR) handR.rotation.set(0, 0, -0.12);
    if (handL) handL.rotation.set(0, 0, 0);
    // Walk compensation, same as the enemy Soldier rig (src/enemies.js):
    // the walk clip's spine yaw carries the fixed left-arm pose around,
    // so the arm dips in some walk phases. One-sided, walk only, gain
    // 2.4, with the forearm counter-rotating so the hand stays on the
    // rifle grip. The left arm tightens only 0.05 when aiming, not 0.15:
    // -2.25 sits 45 degrees past the forward peak and reads 0.71 forward,
    // while -2.15 reads about 0.77 with the hand still on the raised
    // weapon.
    if (moving && tp.upper && lArm) {
      const dip = Math.min(0, tp.upper.rotation.y + 0.04);
      const corr = -2.4 * dip;
      lArm.rotation.x = -2.1 - aimK * 0.05 + corr;
      if (lFore) lFore.rotation.x = 0.5 - corr;
    }
    if (tp.upper) tp.upper.rotation.x = lean;
    if (tp.head) tp.head.rotation.x = -p.pitch * 0.3;
  } else {
    const swing = moving ? Math.sin(tp.phase) * 0.55 : 0;
    if (p.sliding) {
      tp.legL.rotation.x = -1.0; tp.legR.rotation.x = -0.85;
    } else if (!p.onGround) {
      tp.legL.rotation.x = -0.5; tp.legR.rotation.x = 0.35;
    } else if (p.crouching) {
      tp.legL.rotation.x = -0.8; tp.legR.rotation.x = -0.3;
    } else {
      tp.legL.rotation.x = swing; tp.legR.rotation.x = -swing;
    }
    tp.upper.rotation.x = lean;
    tp.head.rotation.x = -p.pitch * 0.3;
    // Arms point forward to the weapon. Aiming tucks them tighter.
    const aimK = p.aiming ? 1 : 0;
    const shoulderX = -1.15 - aimK * 0.15;
    tp.armR.shoulder.rotation.set(shoulderX, 0, -0.35);
    tp.armL.shoulder.rotation.set(shoulderX, 0, 0.35);
    const reloading = G.view && G.view.reloadT > 0;
    tp.armR.elbow.rotation.x = reloading ? -0.3 : -0.7;
    tp.armL.elbow.rotation.x = reloading ? -1.3 : -0.9;
    // Breathing idle.
    if (!moving) tp.upper.position.y = 1.0 + Math.sin(tp.phase) * 0.008;
    else tp.upper.position.y = 1.0;
  }
  // Weapon visibility, recoil kick, reload dip.
  for (const t in tp.weapons) tp.weapons[t].visible = t === p.weapon;
  const w = tp.weapons[p.weapon];
  tp.kick = Math.max(0, tp.kick - dt * 3);
  let dip = 0;
  const reloading = G.view && G.view.reloadT > 0;
  if (reloading) dip = Math.sin(Math.min(1, (1 - G.view.reloadT / 1.2)) * Math.PI) * 0.35;
  w.position.z = -0.05 + tp.kick * 0.1;
  // Aiming raises the weapon to the camera's sight line. The third-person
  // ADS camera sits 1.8 m behind and 0.70 m right of the operator at eye
  // height, so the sight must come up to eye height (1.72 m weapon
  // origin, sight at 1.82 m) and across to the camera's right offset, or
  // the red dot projects below the crosshair and the player aims low.
  // The GLB weapon is parented to the wrapper (feet at y 0); the
  // procedural weapon is parented to the waist group (y 1.0), so the
  // local heights differ by 1.0 m for the same world height.
  const isGLB = !!tp.mixer;
  w.position.x = p.aiming ? (isGLB ? 0.70 : 0.57) : 0.36;
  w.position.y = p.aiming ? (isGLB ? 1.72 : 0.72) : (isGLB ? 1.42 : 0.42);
  w.rotation.x = tp.kick * 0.15 + dip + lean * 0.4;
  // Take-hit flash on the plate carrier.
  if (G.time - p.lastDamageT < 0.18) tp.hitT = 0.18;
  tp.hitT = Math.max(0, tp.hitT - dt);
  if (tp.vestMat && tp.vestMat.emissive) tp.vestMat.emissive.setHex(tp.hitT > 0 ? 0x771111 : 0x000000);
  // Muzzle flash decay.
  if (tp.flash.visible) {
    tp.flashMat.opacity = Math.max(0, tp.flashMat.opacity - dt * 12);
    tp.flashLight.intensity = Math.max(0, tp.flashLight.intensity - dt * 50);
    if (tp.flashMat.opacity <= 0) tp.flash.visible = false;
  }
}

export function showThirdPersonFlash(tp, G) {
  const w = tp.weapons[G.player.weapon];
  const anchor = w.getObjectByName('muzzleAnchor');
  if (!anchor) return;
  // Flash lives under the flash parent, so express the muzzle in its space.
  const lp = tp.flashParent.worldToLocal(anchor.getWorldPosition(new THREE.Vector3()));
  tp.flash.position.copy(lp);
  tp.flash.visible = true;
  tp.flashMat.opacity = 0.95;
  tp.flash.scale.setScalar(0.45 + Math.random() * 0.25);
  tp.flashLight.position.copy(lp);
  tp.flashLight.intensity = 5;
  tp.kick = Math.min(1, tp.kick + 0.3);
}

export function thirdPersonMuzzleWorld(tp, type) {
  const w = tp.weapons[type || 'rifle'];
  const anchor = w && w.getObjectByName('muzzleAnchor');
  if (!anchor) return null;
  return anchor.getWorldPosition(new THREE.Vector3());
}
