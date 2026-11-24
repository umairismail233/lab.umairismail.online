// boss.js. Three phase exoskeleton boss built on the exo enemy.
import * as THREE from 'three';
import { buildEnemy } from './enemies.js';

export function buildBoss(pos) {
  const e = buildEnemy('exo', { pos });
  e.isBoss = true; e.type = 'boss';
  e.hp = e.maxHp = 1400; e.speed = 2.4; e.damage = 20; e.attackRange = 34;
  e.phase = 1; e.chargeT = 0; e.volleyT = 0; e.minionT = 6; e.charging = false; e.chargeDir = new THREE.Vector3();
  e.windingUp = false; e.windupT = 0; e.volleyWarned = false;
  // Scale multiplies the GLB height normalisation (about 1.05), it does
  // not overwrite it: setScalar would throw away the normalisation and
  // leave the boss at the wrong height. The head line scales with the body
  // so headshots by height still land on the head.
  e.group.scale.multiplyScalar(1.35);
  if (e.headLine) e.headLine *= 1.35;
  // Extra armor plates and a crown light bar.
  const plateMat = new THREE.MeshStandardMaterial({ color: 0x6a1a12, roughness: 0.45, metalness: 0.8, emissive: 0x000000 });
  const chest = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.3, 0.1), plateMat); chest.position.set(0, 1.4, 0.22); e.group.add(chest);
  const bar = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.05, 0.05), new THREE.MeshStandardMaterial({ color: 0xff2200, emissive: 0xff2200, emissiveIntensity: 2.5 })); bar.position.set(0, 1.95, 0.1); e.group.add(bar);
  e.parts.bar = bar; e.parts.chest = chest; e.parts.chestMat = plateMat;
  return e;
}

export function updateBoss(boss, G, dt) {
  if (boss.dead) return null;
  const frac = boss.hp / boss.maxHp;
  const newPhase = frac <= 0.33 ? 3 : frac <= 0.66 ? 2 : 1;
  if (newPhase !== boss.phase) {
    boss.phase = newPhase;
    boss.speed = newPhase === 3 ? 3.6 : newPhase === 2 ? 3.0 : 2.4;
    boss.attackCd = 0;
    // Phase-change telegraph: the boss holds still for 0.8 s while the
    // banner shows, so the change is readable before the new behavior
    // starts instead of arriving with no warning.
    boss.holdT = 0.8;
    G.hud.banner(newPhase === 2 ? 'BOSS PHASE 2: REINFORCEMENTS CALLED' : 'BOSS PHASE 3: OVERDRIVE CHARGE');
    G.audio.waveHorn(); G.audio.explosion(true);
    G.fx.explosion(boss.group.position.clone().add(new THREE.Vector3(0, 1, 0)), 3);
    if (G.hud.setBossPhase) G.hud.setBossPhase(newPhase);
  }
  // Phase 2: minion spawns.
  if (boss.phase >= 2) {
    boss.minionT -= dt;
    if (boss.minionT <= 0 && G.enemies.length < 10) {
      boss.minionT = 9;
      G.spawnEnemy('robot', boss.group.position);
      G.spawnEnemy('wolf', boss.group.position);
      G.hud.killfeed('Boss calls reinforcements');
    }
  }
  // Phase 3: charge attack, with a 0.9 s wind-up telegraph first. The boss
  // holds still (holdT freezes its AI), the crown bar strobes, the chest
  // plate glows, and the banner names the attack, so the charge is never
  // a surprise. The charge only starts after the wind-up ends.
  if (boss.phase === 3) {
    if (boss.windingUp) {
      boss.windupT -= dt;
      boss.holdT = Math.max(boss.holdT, 0.1);
      const pulse = 0.5 + 0.5 * Math.sin(G.time * 22);
      if (boss.parts.bar) boss.parts.bar.material.emissiveIntensity = 2.5 + pulse * 4;
      if (boss.parts.chestMat) boss.parts.chestMat.emissive.setHex(0x550000 + Math.floor(pulse * 0x440000));
      if (boss.windupT <= 0) {
        boss.windingUp = false;
        boss.charging = true; boss.chargeTime = 1.1;
        const d = new THREE.Vector3(G.player.pos.x - boss.group.position.x, 0, G.player.pos.z - boss.group.position.z).normalize();
        boss.chargeDir.copy(d);
        if (boss.parts.bar) boss.parts.bar.material.emissiveIntensity = 2.5;
        if (boss.parts.chestMat) boss.parts.chestMat.emissive.setHex(0x000000);
      }
      return null;
    }
    boss.chargeT -= dt;
    if (boss.chargeT <= 0 && !boss.charging) {
      boss.windingUp = true; boss.windupT = 0.9; boss.holdT = 0.9;
      G.hud.banner('BOSS CHARGE INCOMING');
      G.audio.waveHorn();
      return null;
    }
    if (boss.charging) {
      boss.chargeTime -= dt;
      boss.group.position.addScaledVector(boss.chargeDir, 11 * dt);
      boss.moving = true;
      const pd = boss.group.position.distanceTo(G.player.pos);
      if (pd < 1.6) { G.damagePlayer(26, boss.group.position); boss.charging = false; boss.chargeT = 5; G.fx.shake(0.5); }
      if (boss.chargeTime <= 0) { boss.charging = false; boss.chargeT = 4 + Math.random() * 2; }
      return null;
    }
    // Rocket volley, with a 1 s warning before it fires.
    boss.volleyT -= dt;
    if (boss.volleyT <= 1 && !boss.volleyWarned) { boss.volleyWarned = true; G.hud.banner('BOSS VOLLEY INCOMING'); G.audio.waveHorn(); }
    if (boss.volleyT <= 0) { boss.volleyT = 6; boss.volleyWarned = false; return { kind: 'volley', count: 3 }; }
  }
  return null;
}
