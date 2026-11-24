// weapons.js. Weapon stats and detailed first person viewmodels.
// Rifle optic is a real 3D object: housing, glass lens, emissive dot. No overlay icon.
// Surfaces use painted canvas textures (worn gunmetal, camo, wood grain,
// hazard stripes) so the weapons read as manufactured objects, not plastic.
import * as THREE from 'three';

export const WEAPONS = {
  rifle: { name: 'AR-7 VANGUARD', damage: 34, headMult: 2, rof: 9, mag: 30, reserve: 180, reload: 1.7, spread: 0.011, auto: true, kick: 0.07, range: 120, pellets: 1, sfx: 'rifle' },
  shotgun: { name: 'BREACH-12', damage: 13, headMult: 1.6, rof: 2.4, mag: 6, reserve: 42, reload: 2.2, spread: 0.045, auto: false, kick: 0.18, range: 40, pellets: 8, sfx: 'shotgun' },
  rocket: { name: 'LONGSHOT RL', damage: 120, headMult: 1, rof: 0.8, mag: 1, reserve: 8, reload: 2.4, spread: 0.004, auto: false, kick: 0.3, range: 200, pellets: 1, sfx: 'rocket' },
  grenade: { name: 'FRAG GRENADE', damage: 110, headMult: 1, rof: 1.2, mag: 1, reserve: 4, reload: 0.9, spread: 0, auto: false, kick: 0.03, range: 60, pellets: 1, sfx: 'rocket' },
  melee: { name: 'COMBAT KNIFE', damage: 55, headMult: 1.5, rof: 2.2, mag: Infinity, reserve: Infinity, reload: 0, spread: 0, auto: false, kick: 0.04, range: 2.4, pellets: 1, sfx: 'melee' },
};
export const WEAPON_ORDER = ['rifle', 'shotgun', 'rocket', 'grenade', 'melee'];

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
const gunmetalTex = canvasTex(128, 128, (g, w, h) => {
  g.fillStyle = '#26282c'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 500; i++) { g.fillStyle = `rgba(255,255,255,${Math.random() * 0.06})`; g.fillRect(Math.random() * w, Math.random() * h, 1, 1); }
  for (let i = 0; i < 40; i++) { g.strokeStyle = `rgba(0,0,0,${0.2 + Math.random() * 0.3})`; g.lineWidth = 1; g.beginPath(); const x = Math.random() * w, y = Math.random() * h; g.moveTo(x, y); g.lineTo(x + (Math.random() - 0.5) * 30, y + (Math.random() - 0.5) * 8); g.stroke(); }
  g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(0, h - 6, w, 6);
});
const camoTex = canvasTex(128, 128, (g, w, h) => {
  g.fillStyle = '#4a4d38'; g.fillRect(0, 0, w, h);
  const blobs = ['#2e2a22', '#5d6146', '#3d4436', '#6b6a4a'];
  for (let i = 0; i < 26; i++) { g.fillStyle = blobs[i % blobs.length]; g.globalAlpha = 0.75; g.beginPath(); g.ellipse(Math.random() * w, Math.random() * h, 8 + Math.random() * 22, 6 + Math.random() * 14, Math.random() * 3, 0, 7); g.fill(); }
  g.globalAlpha = 1;
});
const woodTex = canvasTex(128, 128, (g, w, h) => {
  g.fillStyle = '#4a3220'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 22; i++) { g.strokeStyle = `rgba(${20 + Math.random() * 40 | 0},${12 + Math.random() * 20 | 0},8,0.5)`; g.lineWidth = 1 + Math.random() * 2; g.beginPath(); const y = Math.random() * h; g.moveTo(0, y); g.bezierCurveTo(w * 0.3, y + (Math.random() - 0.5) * 10, w * 0.7, y + (Math.random() - 0.5) * 10, w, y); g.stroke(); }
});
const hazardTex = canvasTex(128, 32, (g, w, h) => {
  g.fillStyle = '#d8a020'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#1a1a1a';
  for (let x = -h; x < w; x += 16) { g.beginPath(); g.moveTo(x, h); g.lineTo(x + 8, 0); g.lineTo(x + 16, 0); g.lineTo(x + 8, h); g.fill(); }
});

const gunmetal = new THREE.MeshStandardMaterial({ map: gunmetalTex, roughness: 0.5, metalness: 0.6, envMapIntensity: 0.35 });
const gunDark = new THREE.MeshStandardMaterial({ color: 0x141518, roughness: 0.55, metalness: 0.7 });
const camoMat = new THREE.MeshStandardMaterial({ map: camoTex, roughness: 0.85, metalness: 0.1 });
const gripMat = new THREE.MeshStandardMaterial({ color: 0x3a332a, roughness: 0.9, metalness: 0.1 });
const woodMat = new THREE.MeshStandardMaterial({ map: woodTex, roughness: 0.8, metalness: 0.1 });
const gloveMat = new THREE.MeshStandardMaterial({ color: 0x9a7b52, roughness: 0.95, metalness: 0.05 });
const sleeveMat = new THREE.MeshStandardMaterial({ map: camoTex, roughness: 0.9, metalness: 0.05 });

function box(w, h, d, x, y, z, mat) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat || gunmetal); m.position.set(x, y, z); return m; }
function cyl(rt, rb, h, x, y, z, mat, seg) { const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg || 12), mat || gunmetal); m.position.set(x, y, z); return m; }

// Starburst muzzle flash texture, drawn once on a canvas: a bright core
// fading to transparent, with four long rays and four short diagonal rays.
// A plain colour sprite reads as a flat card; this reads as a flash.
export function makeFlashTexture() {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 128;
  const ctx = c.getContext('2d');
  const cx = 64, cy = 64;
  const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, 64);
  core.addColorStop(0, 'rgba(255,255,240,1)');
  core.addColorStop(0.22, 'rgba(255,214,110,0.95)');
  core.addColorStop(0.5, 'rgba(255,140,40,0.5)');
  core.addColorStop(1, 'rgba(255,120,20,0)');
  ctx.fillStyle = core;
  ctx.fillRect(0, 0, 128, 128);
  ctx.globalCompositeOperation = 'lighter';
  const ray = (angle, len, width) => {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    const g = ctx.createLinearGradient(0, 0, len, 0);
    g.addColorStop(0, 'rgba(255,240,180,0.95)');
    g.addColorStop(0.6, 'rgba(255,170,60,0.45)');
    g.addColorStop(1, 'rgba(255,140,30,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(0, -width / 2);
    ctx.lineTo(len, 0);
    ctx.lineTo(0, width / 2);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  };
  for (let i = 0; i < 4; i++) ray(i * Math.PI / 2, 62, 13);
  for (let i = 0; i < 4; i++) ray(i * Math.PI / 2 + Math.PI / 4, 38, 9);
  const tex = new THREE.CanvasTexture(c);
  return tex;
}

// Gloved hand gripping a grip: rounded palm, four curled finger capsules,
// thumb across the grip, knuckle plate. Sized to read as a hand at normal
// play distance, not a thin tube.
function gripHand() {
  const h = new THREE.Group();
  const palm = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), gloveMat);
  palm.scale.set(1.15, 0.75, 1.4); h.add(palm);
  h.add(box(0.075, 0.02, 0.05, 0, 0.032, -0.02, gloveMat)); // knuckle plate
  for (let i = 0; i < 4; i++) { // four fingers curled around the grip
    const f = cyl(0.013, 0.013, 0.06, -0.027 + i * 0.018, -0.03, -0.028, gloveMat, 8);
    f.rotation.z = Math.PI / 2; h.add(f);
    const tip = box(0.016, 0.016, 0.03, -0.027 + i * 0.018, -0.032, -0.055, gloveMat); h.add(tip);
  }
  const thumb = box(0.018, 0.04, 0.05, 0.045, 0.01, 0.015, gloveMat); thumb.rotation.z = -0.5; h.add(thumb);
  return h;
}
// Sleeve segment between two weapon-local points. It runs from the hand down
// toward the bottom edge of the screen, so the arm reads as connected.
function sleeveBetween(ax, ay, az, bx, by, bz) {
  const a = new THREE.Vector3(ax, ay, az), b = new THREE.Vector3(bx, by, bz);
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = dir.length();
  const m = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.058, len, 10), sleeveMat);
  m.position.copy(a).addScaledVector(dir, 0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  return m;
}
function addHands(g, grip, fore, gripSleeve, foreSleeve) {
  // Third-person weapons opt out (userData.noHands): the operator's own
  // arms hold the rifle there, so these floating grip hands and sleeve
  // tubes would hang detached in the middle of the aim view.
  if (g.userData.noHands) return;
  const right = gripHand(); right.position.set(grip[0], grip[1], grip[2]); g.add(right);
  g.add(sleeveBetween(grip[0] + 0.01, grip[1] - 0.01, grip[2] + 0.02, gripSleeve[0], gripSleeve[1], gripSleeve[2]));
  if (fore) {
    const left = gripHand(); left.position.set(fore[0], fore[1], fore[2]); left.rotation.y = Math.PI; g.add(left);
    g.add(sleeveBetween(fore[0] - 0.01, fore[1] - 0.01, fore[2] + 0.02, foreSleeve[0], foreSleeve[1], foreSleeve[2]));
  }
}

export function buildWeaponMesh(type, opts) {
  const g = new THREE.Group();
  // opts.hands === false builds the bare weapon, no grip hands or sleeve
  // tubes. Only the third-person body uses this; the first-person
  // viewmodel and enemy weapons keep their hands by default.
  if (opts && opts.hands === false) g.userData.noHands = true;
  if (type === 'rifle') {
    g.add(box(0.07, 0.09, 0.62, 0, 0, -0.1)); // receiver
    const barrel = cyl(0.02, 0.02, 0.34, 0, 0.01, -0.55, gunDark); barrel.rotation.x = Math.PI / 2; g.add(barrel);
    g.add(box(0.06, 0.06, 0.22, 0, 0.01, -0.42, camoMat)); // camo handguard
    for (let i = 0; i < 5; i++) g.add(box(0.07, 0.015, 0.02, 0, 0.048, -0.34 - i * 0.035, gunDark)); // rail slots
    const mag = box(0.05, 0.16, 0.09, 0, -0.11, -0.05, gunDark); mag.rotation.x = 0.15; g.add(mag);
    g.add(box(0.052, 0.02, 0.09, 0, -0.16, -0.03, gripMat)); // mag base plate
    g.add(box(0.05, 0.1, 0.06, 0, -0.08, 0.16, gripMat)); // grip
    g.add(box(0.05, 0.08, 0.1, 0, -0.01, 0.22, gunDark)); // stock
    g.add(box(0.055, 0.1, 0.02, 0, -0.01, 0.27, gripMat)); // butt pad
    g.add(box(0.02, 0.03, 0.08, 0.045, -0.02, -0.02, gunDark)); // ejection port
    const sel = cyl(0.012, 0.012, 0.01, 0.04, 0.01, 0.08, gunDark, 8); sel.rotation.z = Math.PI / 2; g.add(sel); // selector
    g.add(box(0.012, 0.03, 0.012, 0, 0.06, -0.36, gunDark)); // front post
    const muzzle = cyl(0.028, 0.028, 0.05, 0, 0.01, -0.72, gunDark); muzzle.rotation.x = Math.PI / 2; g.add(muzzle);
    // Real red dot optic: housing, glass lens, emissive dot inside.
    const housing = cyl(0.028, 0.028, 0.06, 0, 0.085, -0.08, gunDark, 16); housing.rotation.x = Math.PI / 2; g.add(housing);
    const lens = new THREE.Mesh(new THREE.CircleGeometry(0.022, 20), new THREE.MeshStandardMaterial({ color: 0x223344, roughness: 0.08, metalness: 0.9, transparent: true, opacity: 0.55, envMapIntensity: 1.2 }));
    lens.position.set(0, 0.085, -0.043); g.add(lens);
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.006, 8, 8), new THREE.MeshBasicMaterial({ color: 0xff2a1a }));
    dot.position.set(0, 0.085, -0.046); dot.name = 'redDot'; g.add(dot);
    addHands(g, [0, -0.08, 0.16], [0, -0.005, -0.42], [0.08, -0.34, 0.48], [-0.16, -0.34, 0.02]);
    g.userData.muzzle = new THREE.Vector3(0, 0.01, -0.75);
    // ADS height is sight height times the viewmodel scale: the group is
    // scaled 0.85 in createPlayerView, so the sight (local y 0.085) lands
    // at 0.07225 above the group origin, and adsPos y must match it, or
    // the red dot sits below the true aim point.
    g.userData.adsPos = new THREE.Vector3(0, -0.07225, -0.56);
    g.userData.hipPos = new THREE.Vector3(0.24, -0.28, -0.70);
  } else if (type === 'shotgun') {
    g.add(box(0.08, 0.09, 0.5, 0, 0, -0.05, gunmetal));
    const barrel = cyl(0.028, 0.028, 0.5, 0, 0.02, -0.5, gunDark); barrel.rotation.x = Math.PI / 2; g.add(barrel);
    const tube = cyl(0.022, 0.022, 0.44, 0, -0.03, -0.48, gunmetal); tube.rotation.x = Math.PI / 2; g.add(tube);
    g.add(box(0.07, 0.09, 0.26, 0, -0.01, 0.14, woodMat)); // pump
    for (let i = 0; i < 3; i++) g.add(box(0.072, 0.02, 0.03, 0, 0.02, 0.06 + i * 0.07, woodMat)); // pump ribs
    g.add(box(0.06, 0.1, 0.12, 0, -0.01, 0.24, woodMat)); // stock
    g.add(box(0.065, 0.11, 0.02, 0, -0.01, 0.3, gripMat)); // butt pad
    // Side saddle shell holder with red shells on the receiver.
    g.add(box(0.02, 0.07, 0.2, 0.05, 0.02, -0.05, gunDark));
    for (let i = 0; i < 4; i++) {
      const sh = cyl(0.011, 0.011, 0.05, 0.062, 0.02, -0.12 + i * 0.045, new THREE.MeshStandardMaterial({ color: 0xaa2211, roughness: 0.5 }), 8);
      sh.rotation.x = Math.PI / 2; g.add(sh);
    }
    // Aligned iron sights: rear notch ring and front post, same sight line.
    const rear = new THREE.Mesh(new THREE.TorusGeometry(0.02, 0.005, 8, 20), gunDark); rear.position.set(0, 0.075, 0.14); rear.name = 'sightAnchor'; g.add(rear);
    g.add(box(0.008, 0.035, 0.008, 0, 0.07, -0.32, gunDark)); // front post
    g.add(box(0.03, 0.012, 0.008, 0, 0.055, -0.32, gunDark)); // front wings
    const bead = new THREE.Mesh(new THREE.SphereGeometry(0.006, 8, 8), new THREE.MeshBasicMaterial({ color: 0xffcc33 })); bead.position.set(0, 0.09, -0.32); g.add(bead);
    addHands(g, [0, -0.05, 0.2], [0, -0.01, 0.14], [0.08, -0.32, 0.48], [-0.15, -0.32, 0.55]);
    g.userData.muzzle = new THREE.Vector3(0, 0.02, -0.78);
    // ADS height is sight height (rear ring local y 0.075) times the 0.85
    // viewmodel scale, so the ring centres on the true aim point.
    g.userData.adsPos = new THREE.Vector3(0, -0.06375, -0.54);
    g.userData.hipPos = new THREE.Vector3(0.24, -0.28, -0.70);
  } else if (type === 'rocket') {
    const tubeMat = new THREE.MeshStandardMaterial({ color: 0x4a5240, roughness: 0.6, metalness: 0.5 });
    const tube = cyl(0.07, 0.07, 0.95, 0, 0, -0.2, tubeMat); tube.rotation.x = Math.PI / 2; g.add(tube);
    for (const z of [-0.55, -0.2, 0.15]) { // tube rings
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.072, 0.008, 8, 20), gunDark);
      ring.position.set(0, 0, z); g.add(ring);
    }
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.072, 0.072, 0.1, 16, 1, true), new THREE.MeshStandardMaterial({ map: hazardTex, roughness: 0.6 }));
    band.rotation.x = Math.PI / 2; band.position.set(0, 0, -0.62); g.add(band);
    const warhead = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.22, 12), new THREE.MeshStandardMaterial({ color: 0x8a2a1a, roughness: 0.5, metalness: 0.4 })); warhead.rotation.x = -Math.PI / 2; warhead.position.set(0, 0, -0.78); g.add(warhead);
    const cone = cyl(0.05, 0.07, 0.12, 0, 0, 0.3, gunDark); cone.rotation.x = Math.PI / 2; g.add(cone); // rear venturi
    g.add(box(0.05, 0.09, 0.12, 0, -0.1, 0.05, gripMat));
    const sight = box(0.04, 0.05, 0.1, 0, 0.1, -0.1, gunDark); sight.name = 'sightAnchor'; g.add(sight);
    const sightLens = new THREE.Mesh(new THREE.CircleGeometry(0.014, 14), new THREE.MeshStandardMaterial({ color: 0x223344, roughness: 0.1, metalness: 0.9, transparent: true, opacity: 0.6 }));
    sightLens.position.set(0, 0.1, -0.045); g.add(sightLens);
    addHands(g, [0, -0.1, 0.05], [0, 0.02, -0.45], [0.08, -0.32, 0.45], [-0.15, -0.32, 0.0]);
    g.userData.viewScale = 0.62;
    g.userData.muzzle = new THREE.Vector3(0, 0, -0.85);
    // ADS height is sight height (sight box local y 0.1) times the 0.62
    // viewmodel scale, so the sight centres on the true aim point.
    g.userData.adsPos = new THREE.Vector3(0, -0.062, -0.34);
    g.userData.hipPos = new THREE.Vector3(0.24, -0.27, -0.68);
  } else if (type === 'grenade') {
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.055, 14, 12), new THREE.MeshStandardMaterial({ color: 0x3d4a2a, roughness: 0.6, metalness: 0.6 }));
    body.scale.y = 1.15; g.add(body);
    for (const y of [-0.03, 0.01, 0.05]) { // body ridges
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.056, 0.004, 6, 18), gunDark);
      ring.rotation.x = Math.PI / 2; ring.position.y = y; ring.scale.y = 1.1; g.add(ring);
    }
    const lever = box(0.015, 0.09, 0.02, 0.045, 0.05, 0, gunDark); lever.rotation.z = -0.2; g.add(lever);
    const pin = new THREE.Mesh(new THREE.TorusGeometry(0.02, 0.005, 8, 16), gunmetal); pin.position.set(0.05, 0.09, 0); g.add(pin);
    addHands(g, [0, -0.055, 0], null, [0.07, -0.3, 0.42], null);
    g.userData.muzzle = new THREE.Vector3(0, 0, -0.2);
    g.userData.adsPos = new THREE.Vector3(0, -0.05, -0.3);
    g.userData.hipPos = new THREE.Vector3(0.22, -0.26, -0.62);
  } else { // melee knife
    const blade = box(0.012, 0.02, 0.24, 0, 0.01, -0.2, new THREE.MeshStandardMaterial({ color: 0xb8bcc2, roughness: 0.2, metalness: 0.95, envMapIntensity: 1 }));
    g.add(blade);
    g.add(box(0.004, 0.012, 0.16, 0, 0.012, -0.2, gunDark)); // fuller groove
    for (let i = 0; i < 4; i++) g.add(box(0.014, 0.008, 0.012, 0, 0.005, -0.28 + i * 0.018, gunDark)); // serrations
    g.add(box(0.025, 0.03, 0.12, 0, 0, -0.03, gripMat));
    g.add(box(0.03, 0.035, 0.015, 0, 0, -0.1, gunDark)); // guard
    const pommel = cyl(0.012, 0.012, 0.02, 0, 0, 0.035, gunDark, 8); pommel.rotation.x = Math.PI / 2; g.add(pommel);
    addHands(g, [0, 0, -0.03], null, [0.07, -0.3, 0.42], null);
    g.userData.muzzle = new THREE.Vector3(0, 0.01, -0.32);
    g.userData.adsPos = new THREE.Vector3(0, -0.02, -0.3);
    g.userData.hipPos = new THREE.Vector3(0.22, -0.26, -0.62);
  }
  // Muzzle flash anchor.
  const flashAnchor = new THREE.Object3D(); flashAnchor.position.copy(g.userData.muzzle); flashAnchor.name = 'muzzleAnchor'; g.add(flashAnchor);
  return g;
}

// First person arms: the gloved hands and sleeves now live on each weapon
// mesh (see addHands in buildWeaponMesh), so they track ADS, bob, kick, and
// reload exactly. This group stays as an empty anchor for the rig; a
// standalone arm pair here used to float detached from the weapon.
export function buildArms() {
  return new THREE.Group();
}

// Body shadow blob that follows the player on the ground. A soft radial
// gradient, not a hard disc, so it reads as a shadow, not a painted circle.
export function buildBodyShadow(scene) {
  const c = document.createElement('canvas'); c.width = 128; c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 4, 64, 64, 62);
  grad.addColorStop(0, 'rgba(0,0,0,0.55)');
  grad.addColorStop(0.55, 'rgba(0,0,0,0.28)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  const m = new THREE.Mesh(new THREE.CircleGeometry(0.55, 20), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
  m.rotation.x = -Math.PI / 2; m.position.y = 0.03; scene.add(m);
  return m;
}
