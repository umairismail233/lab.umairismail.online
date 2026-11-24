// models.js. Real textured humanoid models for Terminal Overdrive.
// Soldier.glb is the Mixamo "Vanguard" tactical soldier, Xbot.glb is the
// Mixamo robot, both distributed in the three.js examples repo. Both load
// from the jsDelivr CDN first; if that fails (network error or timeout),
// they load from the local copies in assets/models/ instead, so the game
// never fails to start. If both routes fail, the game falls back to detailed
// procedural figures built in enemies.js, so the game never fails to start.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';

export const MODEL_SOURCES = {
  soldier: {
    local: 'assets/models/Soldier.glb',
    cdn: 'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r160/examples/models/gltf/Soldier.glb',
    size: 2160468,
    license: 'Mixamo character distributed in the three.js examples repo; Mixamo assets are royalty-free for use in projects.',
  },
  xbot: {
    local: 'assets/models/Xbot.glb',
    cdn: 'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r160/examples/models/gltf/Xbot.glb',
    size: 2930032,
    license: 'Mixamo character distributed in the three.js examples repo; Mixamo assets are royalty-free for use in projects.',
  },
};

// Loaded templates. Null until loadModels() finishes; enemies and the
// third person body read these and fall back to procedural figures when
// a template is missing.
export const modelStore = { soldier: null, xbot: null };

const loader = new GLTFLoader();

function loadOne(url) {
  return new Promise((resolve, reject) => loader.load(url, resolve, undefined, reject));
}

async function loadWithFallback(key, onProgress) {
  const src = MODEL_SOURCES[key];
  try {
    if (onProgress) onProgress('LOADING ' + key.toUpperCase() + ' MODEL FROM CDN...');
    return await loadOne(src.cdn);
  } catch (e) {
    console.warn('CDN model failed, trying local copy:', key, e && e.message);
    if (onProgress) onProgress('LOADING ' + key.toUpperCase() + ' MODEL (LOCAL)...');
    return await loadOne(src.local);
  }
}

export async function loadModels(onProgress) {
  const out = {};
  for (const key of ['soldier', 'xbot']) {
    try {
      const gltf = await loadWithFallback(key, onProgress);
      out[key] = { scene: gltf.scene, clips: gltf.animations || [] };
      modelStore[key] = out[key];
    } catch (e) {
      console.error('Model failed on both routes, procedural fallback will be used:', key, e && e.message);
      modelStore[key] = null;
      out[key] = null;
    }
  }
  return out;
}

export function clipByName(clips, name) {
  return (clips || []).find((c) => c.name && c.name.toLowerCase() === name.toLowerCase()) || null;
}

// Bone lookup by suffix, not by exact name: the three.js Mixamo GLBs
// name their bones 'mixamorigHips', 'mixamorigHead' (no colon), while
// other Mixamo exports use 'mixamorig:Hips' (with colon). Matching the
// suffix works for both, and an exact-name lookup silently returns
// undefined for the other spelling, which once left every figure
// unmasked and unposed.
export function findBone(bones, suffix) {
  for (const k in bones) if (k.endsWith(suffix)) return bones[k];
  return null;
}

// Clone a skinned template into an independent instance with its own
// materials (so hit flash can pulse per enemy) and its own mixer.
// Returns { group, mixer, bones, clips } or null when the template is missing.
export function cloneHumanoid(key) {
  const tpl = modelStore[key];
  if (!tpl) return null;
  const group = cloneSkinned(tpl.scene);
  const mixer = new THREE.AnimationMixer(group);
  const bones = {};
  group.traverse((o) => {
    if (o.isBone) bones[o.name] = o;
    if (o.isMesh) {
      o.castShadow = true;
      o.material = Array.isArray(o.material) ? o.material.map((m) => m.clone()) : o.material.clone();
    }
  });
  // Normalise height to the game's 1.9 m humanoid so hitboxes, eye lines,
  // and the camera all agree with the procedural figures they replace.
  // Height comes from the skeleton, not from a bounding box: Box3 on a
  // skinned mesh reads the geometry in its local frame (centimetres, Z
  // up), which once measured the depth (0.37) instead of the height and
  // scaled every figure to about 9 metres. The head and foot bones give
  // the true height in the model's own units, whatever they are.
  group.updateMatrixWorld(true);
  const head = findBone(bones, 'Head');
  const foot = findBone(bones, 'LeftFoot') || findBone(bones, 'RightFoot');
  let h = 0;
  if (head && foot) {
    const hv = new THREE.Vector3(), fv = new THREE.Vector3();
    head.getWorldPosition(hv); foot.getWorldPosition(fv);
    h = (hv.y - fv.y) + 0.2;
  }
  const s = h > 0 ? 1.9 / h : 1;
  group.scale.setScalar(s);
  return { group, mixer, bones, clips: tpl.clips };
}

// Play a clip on a mixer, crossfading from whatever is playing. Returns
// the action so the caller can stop it. A null clip is a no-op.
export function playClip(mixer, clips, name, fade) {
  if (!mixer || !clips) return null;
  const clip = clipByName(clips, name);
  if (!clip) return null;
  const next = mixer.clipAction(clip);
  const prev = mixer._current;
  if (prev === next) { if (!next.isRunning()) next.play(); return next; }
  next.reset().setLoop(THREE.LoopRepeat, Infinity).play();
  if (prev) prev.crossFadeTo(next, fade || 0.15, false);
  mixer._current = next;
  return next;
}

// ---- Attachments ---------------------------------------------------------

// Painted fur texture for the masks: dark base with lighter streaks and
// a worn edge, so the mask reads as fur and paint, not flat plastic.
function furTexture(base, streak) {
  const c = document.createElement('canvas'); c.width = 128; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = base; g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 260; i++) {
    g.fillStyle = streak;
    g.globalAlpha = 0.12 + Math.random() * 0.3;
    const x = Math.random() * 128, y = Math.random() * 128;
    g.fillRect(x, y, 2, 6 + Math.random() * 10);
  }
  g.globalAlpha = 1;
  const t = new THREE.CanvasTexture(c);
  return t;
}

function maskMat(base, streak, rough) {
  return new THREE.MeshStandardMaterial({ map: furTexture(base, streak), roughness: rough || 0.9, metalness: 0.05 });
}

// Wolf mask: sculpted muzzle, pointed ears, amber eyes. Built from spheres
// and cones, not boxes, so the silhouette reads as an animal head.
export function buildWolfMask() {
  const g = new THREE.Group();
  const fur = maskMat('#5a5e63', 'rgba(200,205,210,0.5)');
  const dark = maskMat('#33363b', 'rgba(120,125,130,0.4)');
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.115, 16, 12), fur);
  skull.scale.set(1, 0.95, 1.05); g.add(skull);
  const muzzle = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.075, 0.13, 10), dark);
  muzzle.rotation.x = Math.PI / 2 - 0.25; muzzle.position.set(0, -0.035, 0.11); g.add(muzzle);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 8), new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.4 }));
  nose.position.set(0, -0.02, 0.185); g.add(nose);
  const earGeo = new THREE.ConeGeometry(0.04, 0.11, 6);
  const earL = new THREE.Mesh(earGeo, dark); earL.position.set(-0.075, 0.115, -0.01); earL.rotation.z = 0.25; g.add(earL);
  const earR = new THREE.Mesh(earGeo, dark); earR.position.set(0.075, 0.115, -0.01); earR.rotation.z = -0.25; g.add(earR);
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0xffaa00, emissive: 0xff8800, emissiveIntensity: 2.2, roughness: 0.2 });
  const eL = new THREE.Mesh(new THREE.SphereGeometry(0.016, 8, 8), eyeMat); eL.position.set(-0.048, 0.025, 0.095); g.add(eL);
  const eR = eL.clone(); eR.position.x = 0.048; g.add(eR);
  return g;
}

// Boar mask: broad snout, tusks, floppy ears, red eyes.
export function buildBoarMask() {
  const g = new THREE.Group();
  const hide = maskMat('#4a3428', 'rgba(190,150,110,0.45)');
  const snout = maskMat('#8a6a58', 'rgba(220,190,160,0.4)');
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.125, 16, 12), hide);
  skull.scale.set(1.08, 0.95, 1); g.add(skull);
  const nose = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.07, 0.1, 10), snout);
  nose.rotation.x = Math.PI / 2 - 0.15; nose.position.set(0, -0.045, 0.12); g.add(nose);
  const tuskMat = new THREE.MeshStandardMaterial({ color: 0xe8e0c8, roughness: 0.5 });
  const tL = new THREE.Mesh(new THREE.ConeGeometry(0.016, 0.09, 6), tuskMat);
  tL.position.set(-0.055, -0.02, 0.15); tL.rotation.x = -0.5; g.add(tL);
  const tR = tL.clone(); tR.position.x = 0.055; g.add(tR);
  const earGeo = new THREE.ConeGeometry(0.045, 0.1, 6);
  const earL = new THREE.Mesh(earGeo, hide); earL.position.set(-0.105, 0.1, 0); earL.rotation.z = 0.9; g.add(earL);
  const earR = new THREE.Mesh(earGeo, hide); earR.position.set(0.105, 0.1, 0); earR.rotation.z = -0.9; g.add(earR);
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0xff2211, emissive: 0xff2200, emissiveIntensity: 2.2, roughness: 0.2 });
  const eL = new THREE.Mesh(new THREE.SphereGeometry(0.015, 8, 8), eyeMat); eL.position.set(-0.05, 0.03, 0.1); g.add(eL);
  const eR = eL.clone(); eR.position.x = 0.05; g.add(eR);
  return g;
}

// Glowing chest core for the white robot, attached to the spine bone.
export function buildRobotCore() {
  const core = new THREE.Mesh(
    new THREE.CylinderGeometry(0.075, 0.075, 0.05, 16),
    new THREE.MeshStandardMaterial({ color: 0xff5a1a, roughness: 0.3, metalness: 0.2, emissive: 0xff4400, emissiveIntensity: 1.6 })
  );
  core.rotation.x = Math.PI / 2;
  core.userData.part = 'weak';
  return core;
}

// Exo armor plates for the boss: rounded chest plate, shoulder pauldrons,
// backpack core. Attached to the soldier clone, scaled with it.
export function buildExoPlates() {
  const g = new THREE.Group();
  const plateMat = new THREE.MeshStandardMaterial({ color: 0x6a1a12, roughness: 0.45, metalness: 0.8 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x1e242b, roughness: 0.5, metalness: 0.8 });
  const chest = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.3, 0.08), plateMat);
  chest.position.set(0, 0.06, 0.16); chest.castShadow = true; g.add(chest);
  const sL = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 10), plateMat);
  sL.position.set(-0.26, 0.22, 0); sL.castShadow = true; g.add(sL);
  const sR = sL.clone(); sR.position.x = 0.26; g.add(sR);
  const pack = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.36, 0.14), darkMat);
  pack.position.set(0, 0.05, -0.2); pack.castShadow = true; g.add(pack);
  const core = new THREE.Mesh(
    new THREE.CylinderGeometry(0.07, 0.07, 0.05, 12),
    new THREE.MeshStandardMaterial({ color: 0xff5a1a, roughness: 0.3, metalness: 0.2, emissive: 0xff4400, emissiveIntensity: 1.6 })
  );
  core.rotation.x = Math.PI / 2; core.position.set(0, 0.05, -0.28);
  core.userData.part = 'weak';
  g.add(core);
  const bar = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.035, 0.035), new THREE.MeshStandardMaterial({ color: 0xff2200, emissive: 0xff2200, emissiveIntensity: 2.5 }));
  bar.position.set(0, 0.42, 0.08); g.add(bar);
  g.userData.weak = core;
  g.userData.bar = bar;
  return g;
}
