// player.js. First person viewmodel: arms plus current weapon, with bob, sway, recoil, reload dip.
import * as THREE from 'three';
import { buildArms, buildWeaponMesh, buildBodyShadow, makeFlashTexture } from './weapons.js';

export function createPlayerView(camera, scene) {
  const rig = new THREE.Group();
  camera.add(rig);
  const arms = buildArms();
  rig.add(arms);
  const weapons = {};
  for (const t of ['rifle', 'shotgun', 'rocket', 'grenade', 'melee']) {
    const m = buildWeaponMesh(t);
    m.scale.setScalar(m.userData.viewScale || 0.85);
    m.position.copy(m.userData.hipPos);
    m.visible = false;
    rig.add(m); weapons[t] = m;
  }
  weapons.rifle.visible = true;
  // Muzzle flash: starburst sprite plus point light, hidden by default.
  const flashMat = new THREE.SpriteMaterial({ map: makeFlashTexture(), color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const flash = new THREE.Sprite(flashMat);
  flash.scale.setScalar(0.34);
  flash.visible = false; rig.add(flash);
  const flashLight = new THREE.PointLight(0xffa040, 0, 9, 2); rig.add(flashLight);
  // Fill light on the rig: the sunset is behind the player, so the
  // viewmodel faces away from the sun and reads as a black slab without
  // it. Warm, short range, so it lifts the weapon and hands without
  // washing out the yard.
  const fill = new THREE.PointLight(0xffe0b0, 0.6, 3.5, 2);
  fill.position.set(0.25, 0.25, -0.4); rig.add(fill);
  const shadow = buildBodyShadow(scene);
  return { rig, arms, weapons, flash, flashMat, flashLight, shadow, bobT: 0, kick: 0, reloadT: 0, recoilPitch: 0 };
}

export function updatePlayerView(view, G, dt) {
  const p = G.player;
  const w = view.weapons[p.weapon];
  const moving = p.moveMag > 0.1 && p.onGround;
  view.bobT += dt * (moving ? (p.sprinting ? 13 : 9) : 2);
  const bobY = moving ? Math.sin(view.bobT * 2) * 0.012 : Math.sin(view.bobT) * 0.004;
  const bobX = moving ? Math.cos(view.bobT) * 0.008 : 0;
  // ADS lerp: weapon to optic position, FOV narrow. Fast snap so the red dot
  // is on the aim point within a frame or two, not mid-transition.
  const target = p.aiming ? w.userData.adsPos : w.userData.hipPos;
  const lerpK = 1 - Math.exp(-dt * 26);
  w.position.lerp(target, lerpK);
  // Recoil kick decays.
  view.kick = Math.max(0, view.kick - dt * 0.55);
  view.recoilPitch = Math.max(0, view.recoilPitch - dt * 0.35);
  const kickZ = view.kick * 0.35;
  const kickRot = view.kick * 0.35;
  // Reload dip.
  let dip = 0;
  if (view.reloadT > 0) { view.reloadT -= dt; dip = Math.sin(Math.min(1, (1 - view.reloadT / 1.2)) * Math.PI) * 0.25; }
  w.position.y += bobY - dip * 0.4;
  w.position.x += bobX;
  w.position.z += kickZ;
  // Level sight line in ADS (rotation 0), so the red dot sits exactly on the
  // screen center aim point instead of drifting below it.
  w.rotation.x = kickRot + (p.aiming ? 0 : 0.02) - dip * 0.7;
  // Arms follow the weapon, tucking in and down while aiming.
  const aimK = p.aiming ? 1 : 0;
  view.arms.position.y = bobY * 0.6 - dip * 0.35 - aimK * 0.07;
  view.arms.position.x = bobX * 0.5;
  view.arms.position.z = -aimK * 0.06;
  view.arms.scale.setScalar(1 - aimK * 0.18);
  view.arms.rotation.x = kickRot * 0.5;
  view.arms.visible = p.weapon !== 'grenade' || view.reloadT <= 0;
  // Slide lean and crouch.
  const targetY = p.sliding ? -0.28 : p.crouching ? -0.18 : 0;
  view.rig.position.y += (targetY - view.rig.position.y) * Math.min(1, dt * 10);
  view.rig.rotation.z = p.sliding ? 0.1 : 0;
  // Muzzle flash decay.
  if (view.flash.visible) {
    view.flashMat.opacity = Math.max(0, view.flashMat.opacity - dt * 14);
    view.flashLight.intensity = Math.max(0, view.flashLight.intensity - dt * 60);
    if (view.flashMat.opacity <= 0) view.flash.visible = false;
  }
  // Body shadow follows the player.
  view.shadow.position.x = p.pos.x;
  view.shadow.position.z = p.pos.z;
  const sc = p.sliding || p.crouching ? 1.25 : 1;
  view.shadow.scale.setScalar(sc);
}

export function showMuzzleFlash(view, G) {
  const w = view.weapons[G.player.weapon];
  const anchor = w.getObjectByName('muzzleAnchor');
  if (!anchor) return;
  const wp = new THREE.Vector3(); anchor.getWorldPosition(wp);
  const lp = view.rig.worldToLocal(wp.clone());
  view.flash.position.copy(lp);
  view.flashMat.rotation = Math.random() * Math.PI;
  view.flash.visible = true; view.flashMat.opacity = 0.95;
  view.flashLight.position.copy(lp); view.flashLight.intensity = 6;
  view.kick = Math.min(1, view.kick + (G.weapons[G.player.weapon].kick || 0.05) * 4);
  // Camera recoil pitch: the camera kicks up on every shot and settles
  // back, so each weapon feels different in the hands, not just in the ears.
  view.recoilPitch = Math.min(0.09, view.recoilPitch + (G.weapons[G.player.weapon].kick || 0.05) * 0.45);
}
