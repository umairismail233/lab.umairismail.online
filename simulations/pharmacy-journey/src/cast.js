// Pharmacy Journey Sim - Phase 2 cast.
// Characters are BUILT in Blender (tools/blender/build_cast.py) from the
// Quaternius Superhero bases + Peasant outfits, with modelled white coats,
// name badges, hijabs and hair. This module only does what the proven First
// Policy runtime does: load the built GLB, retarget the UAL clip donor
// (UAL_clips_plus.glb: Idle / Walk / React / Talk) onto it at runtime, apply
// the clean toon finish, and stage each character at its post. No clip is
// converted or authored here.
//
// The UAL library has NO wave, point or think clip (verified by parsing all
// 43 clips in Superhero_Female_UAL1.glb). Those three gestures are therefore
// synthesized as smooth post-mixer bone-pose layers over the idle loop, in
// the same tradition as First Policy's idle relax-offsets: a bone is rotated
// toward a measured aim pose while a weight envelope is up, then released.
// They are pose layers, NOT library clips - see PROJECT-LOG Phase 2.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { clone as skeletonClone } from 'three/addons/utils/SkeletonUtils.js';
import { loadModel, pool } from './loader.js';

const loader = new GLTFLoader();
loader.setMeshoptDecoder(MeshoptDecoder); // cast GLBs are meshopt-compressed (Phase 4 packaging)

// ------------------------------------------------------------ toon finish
// FP look, verbatim approach: 4-step gradient map + MeshToonMaterial.
const grad = (() => {
  const t = new THREE.DataTexture(new Uint8Array([90, 160, 215, 255]), 4, 1, THREE.RedFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter;
  t.needsUpdate = true;
  return t;
})();
function toonify(root) {
  root.traverse(o => {
    if (!o.isMesh) return;
    const m = o.material;
    if (!m || !m.map) {
      if (m && m.color) o.material = new THREE.MeshToonMaterial({ color: m.color, gradientMap: grad });
      return;
    }
    // Clone before mutating: several meshes share the atlas material and
    // BOTH characters share the donor's... each GLB load is independent, but
    // clone anyway - the FP pipeline painted per-character colours this way.
    const tex = m.map.clone();
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    o.material = new THREE.MeshToonMaterial({ map: tex, gradientMap: grad });
    o.material.color.copy(m.color);
  });
}

// ------------------------------------------------------------ rig measure
// Scale from the measured rest-pose bounding box. NOTE: FP's bone-ratio
// method (Head-to-neck distance vs a 0.2143 constant) does NOT transfer to
// these Blender exports - their Head/neck_01 origins sit 0.065 apart, which
// produced a 2.85x scale (5.1 m giants) in the first QA round. The exported
// rig stands 1.80 m in rest pose, so Box3 height is the honest measure.
function measureHeight(root) {
  root.updateMatrixWorld(true);
  const bb = new THREE.Box3().setFromObject(root);
  return { h: bb.max.y - bb.min.y, minY: bb.min.y };
}

// ------------------------------------------------------------ cast loader
export async function loadCastMember(url, donorClips, targetH) {
  const gltf = await loadModel(loader, url);
  const root = skeletonClone(gltf.scene);
  toonify(root);
  const { h, minY } = measureHeight(root);
  root.scale.setScalar(targetH / h);
  root.position.y = -minY * (targetH / h); // feet exactly on the floor
  const mixer = new THREE.AnimationMixer(root);
  const actions = {};
  for (const [name, clip] of Object.entries(donorClips)) {
    const a = mixer.clipAction(clip, root);
    a.setLoop(name === 'React' ? THREE.LoopOnce : THREE.LoopRepeat);
    if (name === 'React') a.clampWhenFinished = true;
    actions[name] = a;
  }
  const bones = {};
  root.traverse(o => { if (o.isBone) bones[o.name] = o; });
  return { root, mixer, actions, bones, current: null };
}

function play(m, name, fade = 0.35) {
  if (m.current === name) return;
  const next = m.actions[name];
  if (!next) return;
  if (m.current && m.actions[m.current]) m.actions[m.current].fadeOut(fade);
  next.reset().setEffectiveWeight(1).fadeIn(fade).play();
  m.current = name;
}

// ------------------------------------------------------------ pose layers
// Upper-arm forward is judged in each bone's LOCAL X (authoring convention
// proved in the gesture probes): X+ swings the arm forward/up on both sides.
const LAYERS = {
  wave:  { bone: 'upperarm_l', axis: 'z', aim: 2.0, wagAmp: 0.38, wagHz: 5.5, aux: { bone: 'lowerarm_l', axis: 'z', aim: 0.5 } },
  point: { bone: 'upperarm_r', axis: 'x', aim: 1.6 },
  think: { bone: 'upperarm_r', axis: 'x', aim: 0.5, aux: { bone: 'lowerarm_r', axis: 'x', aim: 2.0 } },
};
const _q = new THREE.Quaternion(), _e = new THREE.Euler();
function applyLayer(m, name, w, t) {
  const L = LAYERS[name];
  if (!L || w <= 0) return;
  const b = m.bones[L.bone];
  if (b) {
    const wag = L.wagAmp ? Math.sin(t * L.wagHz) * L.wagAmp : 0;
    _e.set(0, 0, 0); _e[L.axis] = (L.aim + wag) * w;
    _q.setFromEuler(_e);
    b.quaternion.multiply(_q);
  }
  if (L.aux) {
    const ab = m.bones[L.aux.bone];
    if (ab) { _e.set(0, 0, 0); _e[L.aux.axis] = L.aux.aim * w; _q.setFromEuler(_e); ab.quaternion.multiply(_q); }
  }
}
// smooth in/out weight for a one-shot gesture window
function envelope(t, start, dur) {
  if (t < start || t > start + dur) return 0;
  const u = (t - start) / dur;
  const a = Math.min(1, u / 0.22), b = Math.min(1, (1 - u) / 0.25);
  return Math.min(a, b);
}

// ------------------------------------------------------------ the cast
// posts in three.js coords (x, z) - see PROJECT-LOG Phase 2 placement table
const POSTS = [
  { key: 'ayesha',  file: 'pharmacist_ayesha',  h: 1.68, pos: [-1.5, -3.75], ry: 0,            base: 'Idle', cycle: 11, gestures: ['wave'] },
  { key: 'player',  file: 'customer_player',    h: 1.76, pos: [-1.55, -1.7], ry: Math.PI,      base: 'Idle', cycle: 13, gestures: ['think'] },
  { key: 'bilal',   file: 'pharmacist_bilal',   h: 1.76, pos: [-5.0, 1.55],  ry: -0.74,         base: 'Talk', cycle: 9,  gestures: ['React'] },
  { key: 'cust_a',  file: 'customer_a',         h: 1.66, pos: [-5.62, 2.18], ry: 2.40,          base: 'Idle', cycle: 14, gestures: ['think', 'point'] },
  { key: 'sara',    file: 'pharmacist_sara',    h: 1.68, pos: [-2.7, -4.45], ry: Math.PI,       base: 'Idle', cycle: 10, gestures: ['point', 'React'] },
  { key: 'daniyal', file: 'pharmacist_daniyal', h: 1.76, pos: [7.7, 3.5],    ry: -Math.PI / 2,  base: 'Idle', cycle: 12, gestures: ['React'] },
  { key: 'cust_b',  file: 'customer_b',         h: 1.74, pos: [7.62, -4.82], ry: -1.47,         base: 'Idle', cycle: 15, gestures: ['think'] },
  { key: 'cust_c',  file: 'customer_c',         h: 1.66, pos: [8.08, -0.62], ry: -Math.PI / 2,  base: 'Idle', cycle: 16, gestures: [] },
];

export async function initCast(scene, blobFn, onProgress) {
  const donor = await loadModel(loader, './src/models/UAL_clips_plus.glb');
  if (onProgress) onProgress('UAL_clips_plus.glb');
  const clips = {};
  for (const c of donor.animations) clips[c.name] = c;
  const group = new THREE.Group();
  scene.add(group);
  // Members used to load one by one after the donor: 8 more sequential
  // fetches on top of the boot chain. They only need the donor clips, so
  // they now load together (cap 6) and are staged in post order below,
  // which keeps positions, blobs and gesture cycles exactly as before.
  const loaded = await pool(POSTS, 6, async p => {
    const m = await loadCastMember(`./src/models/${p.file}.glb`, clips, p.h);
    if (onProgress) onProgress(`${p.file}.glb`);
    return { p, m };
  });
  const members = {};
  for (const { p, m } of loaded) {
    m.root.position.x = p.pos[0];
    m.root.position.z = p.pos[1];
    m.root.rotation.y = p.ry;
    group.add(m.root);
    blobFn(group, p.pos[0], p.pos[1], 1.05);
    Object.assign(m, { key: p.key, base: p.base, cycle: p.cycle, gestures: p.gestures,
                       phase: Math.random() * p.cycle, forced: null, forcedUntil: 0 });
    play(m, p.base, 0);
    m.mixer.setTime(Math.random() * 2); // desync identical loops
    members[p.key] = m;
  }
  return { group, members };
}

const GESTURE_DUR = { wave: 2.4, point: 2.2, think: 2.8, React: 2.0 };
let clockNow = 0; // shared time base: advanced by updateCast, read by forceGesture

export function updateCast(cast, dt, t) {
  clockNow = t;
  for (const m of Object.values(cast.members)) {
    // decide the active gesture: forced (QA) beats scheduled
    let gesture = null, gw = 0;
    if (m.forced && t < m.forcedUntil) {
      gesture = m.forced;
      gw = envelope(t, m.forcedUntil - GESTURE_DUR[gesture], GESTURE_DUR[gesture]);
      if (gesture === 'React' && m.current !== 'React') play(m, 'React', 0.15);
    } else {
      if (m.current === 'React') play(m, m.base, 0.3);
      const lt = (t + m.phase) % m.cycle;
      if (m.gestures.length && lt < 3.2) {
        const gi = Math.floor((t + m.phase) / m.cycle) % m.gestures.length;
        gesture = m.gestures[gi];
        if (gesture === 'React') { if (m.current !== 'React') play(m, 'React', 0.15); }
        else gw = envelope(lt, 0.3, GESTURE_DUR[gesture]);
      }
    }
    m.mixer.update(dt);
    if (gesture && gw > 0) applyLayer(m, gesture, gw, t);
  }
}

export function forceGesture(cast, key, gesture) {
  const m = cast.members[key];
  if (!m) return;
  m.forced = gesture;
  m.forcedUntil = clockNow + GESTURE_DUR[gesture];
  if (gesture === 'React') play(m, 'React', 0.1);
}
