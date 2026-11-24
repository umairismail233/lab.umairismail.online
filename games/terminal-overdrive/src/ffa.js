// ffa.js. Offline six bot free for all. Mercenaries and robots fight each other and the player.
import * as THREE from 'three';
import { buildEnemy, findFreeSpot } from './enemies.js';

const BOT_TYPES = ['wolf', 'boar', 'robot', 'wolf', 'robot', 'boar'];
const BOT_NAMES = ['VEX', 'HOUND', 'GHOST', 'TUSK', 'NULL', 'BRUTE'];

export function startFFA(G) {
  G.mode = 'ffa'; G.ffaBots = []; G.ffaOver = false; G.score = 0; G.kills = 0;
  G.enemies.forEach((e) => G.scene.remove(e.group)); G.enemies = [];
  for (let i = 0; i < 6; i++) {
    const sp = G.map.spawnPoints[(i * 2 + 1) % G.map.spawnPoints.length];
    // Jittered spawn points can land inside a container collider (measured:
    // 17.6 percent of the jitter box around [14,-30] is inside one), and a
    // bot that starts inside a box can never walk out by steps. Route the
    // jittered spot through the free-spot search first.
    const raw = { x: sp.x + (Math.random() - 0.5) * 6, z: sp.z + (Math.random() - 0.5) * 6 };
    const free = findFreeSpot(G, raw.x, raw.z, 0.45);
    const pos = new THREE.Vector3(free.x, 0, free.z);
    const bot = buildEnemy(BOT_TYPES[i], { pos, isBot: true, team: i + 1 });
    bot.name = BOT_NAMES[i]; bot.hp = bot.maxHp = 120; bot.damage = 8; bot.shootTimer = 1 + Math.random() * 2;
    G.scene.add(bot.group); G.enemies.push(bot); G.ffaBots.push(bot);
  }
  G.hud.banner('FREE FOR ALL', 'First to 10 eliminations wins');
  G.audio.startMusic('combat');
}

export function updateFFA(G, dt) {
  if (G.mode !== 'ffa' || G.ffaOver) return;
  // Each bot picks the nearest other bot or the player as target.
  for (const bot of G.ffaBots) {
    if (bot.dead) continue;
    let best = null, bestD = 1e9;
    const pd = bot.group.position.distanceTo(G.player.pos);
    if (G.player.health > 0 && pd < bestD) { bestD = pd; best = { pos: G.player.pos, isPlayer: true }; }
    for (const other of G.ffaBots) {
      if (other === bot || other.dead) continue;
      const d = bot.group.position.distanceTo(other.group.position);
      if (d < bestD) { bestD = d; best = { pos: other.group.position, isPlayer: false, enemy: other }; }
    }
    bot.ffaTarget = best;
    // Bot vs bot damage is resolved in main loop through the shoot result.
    bot.ffaTargetEnemy = best && !best.isPlayer ? best.enemy : null;
  }
  // Respawn dead bots after a delay, so the arena stays full.
  for (const bot of G.ffaBots) {
    if (bot.dead && bot.respawnT !== undefined) {
      bot.respawnT -= dt;
      if (bot.respawnT <= 0) {
        const sp = G.map.spawnPoints[Math.floor(Math.random() * G.map.spawnPoints.length)];
        const free = findFreeSpot(G, sp.x, sp.z, 0.45);
        bot.group.position.set(free.x, 0, free.z); bot.group.rotation.set(0, 0, 0);
        bot.hp = bot.maxHp; bot.dead = false; bot.respawnT = undefined;
        G.scene.add(bot.group);
        // A respawned bot must rejoin G.enemies, or the main loop never
        // animates it, never runs its AI, and never lets the player hit it:
        // it stands in the scene in its bind pose forever. Its mixer was
        // stopped on death and animState is stale, so reset both or
        // animateEnemy skips playClip and the mixer stays stopped.
        if (!G.enemies.includes(bot)) G.enemies.push(bot);
        bot.animState = null; bot._deathStopped = false; bot.deathT = 0;
      }
    } else if (bot.dead && bot.respawnT === undefined) bot.respawnT = 4;
  }
  // Win check.
  if (G.kills >= 10) { G.ffaOver = true; G.gameOver(true, 'FREE FOR ALL CHAMPION. 10 eliminations.'); }
  const botTop = Math.max(...G.ffaBots.map((b) => b.ffaScore || 0));
  if (botTop >= 10) { G.ffaOver = true; const w = G.ffaBots.find((b) => b.ffaScore >= 10); G.gameOver(false, (w ? w.name : 'A bot') + ' reached 10 eliminations first.'); }
}
