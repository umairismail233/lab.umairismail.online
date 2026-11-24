// augments.js. Stackable between wave augments. Choose 1 of 3.
export const AUGMENTS = [
  { id: 'armor', name: 'REINFORCED PLATING', desc: '+25 max armor, restore 25 armor now', apply(G) { G.player.maxArmor += 25; G.player.armor = Math.min(G.player.maxArmor, G.player.armor + 25); } },
  { id: 'damage', name: 'HOT ROUNDS', desc: '+15 percent weapon damage', apply(G) { G.player.damageMult += 0.15; } },
  { id: 'firerate', name: 'RAPID FIRE', desc: '+20 percent fire rate', apply(G) { G.player.fireRateMult += 0.2; } },
  { id: 'reload', name: 'FAST HANDS', desc: '+30 percent reload speed', apply(G) { G.player.reloadMult += 0.3; } },
  { id: 'grenade', name: 'DEEP POUCHES', desc: '+1 grenade capacity, +2 grenades now', apply(G) { G.player.maxGrenades += 1; G.player.grenades = Math.min(G.player.maxGrenades, G.player.grenades + 2); } },
  { id: 'recharge', name: 'NANO WEAVE', desc: 'Armor recharges 40 percent faster', apply(G) { G.player.rechargeMult += 0.4; } },
  { id: 'speed', name: 'LIGHT FRAME', desc: '+10 percent movement speed', apply(G) { G.player.speedMult += 0.1; } },
  { id: 'lifesteal', name: 'SCAVENGER', desc: 'Kills restore 6 health', apply(G) { G.player.lifesteal += 6; } },
  { id: 'mag', name: 'EXTENDED MAGS', desc: '+50 percent reserve ammo, refill all', apply(G) { for (const k in G.player.ammo) { G.player.ammo[k].reserve = Math.floor(G.player.ammo[k].reserve * 1.5) + 30; G.player.ammo[k].mag = G.player.ammo[k].magSize; } } },
];
export function rollAugments(count) {
  const pool = [...AUGMENTS];
  const out = [];
  while (out.length < count && pool.length) out.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  return out;
}
export function applyAugment(G, id) {
  const a = AUGMENTS.find((x) => x.id === id);
  if (!a) return;
  a.apply(G);
  G.player.augments.push(a.name);
}
