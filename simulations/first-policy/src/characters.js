// characters.js — real animated 3D characters (glTF) with a primitive fallback.
//
// EVERY character is a Blender-authored GLB on the Quaternius Universal Rig
// (65 joints): females via tools/blender/build_female.py, males via
// tools/blender/build_male.py — body + outfit + modelled hijab/hair/beard,
// flat colours baked in, real face textures, flat brows. The GLBs carry
// meshes/skin only (Blender's exporter corrupts animation), so idle/walk/
// react clips are grafted at runtime from UAL_clips.glb, a donor holding
// just those three Universal Animation Library clips on the same rig
// (tools/extract-clips.mjs). No clip is ever converted between rigs and no
// identity is faked with runtime overlays — the old Mixamo Xbot mannequin
// path (vertex-painted outfits, skin-bound hair/beard masks) is retired.
//
// If loading fails for any reason, a character's make() returns null (or
// loadCharacters() itself resolves null for ?models=off) and the game falls
// back to the built-in primitive people.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { clone as skeletonClone } from 'three/addons/utils/SkeletonUtils.js';

// ---- model hosting ----
// MODELS_BASE is THE knob for where the character GLBs are served from.
// The files it must hold are the 13 compressed GLBs in deploy-models/
// (12 characters + UAL_clips.glb). Default: that folder at the repo root,
// so the game runs standalone from any static server. TO DEPLOY: upload
// deploy-models/ to the static host and point MODELS_BASE at its URL, e.g.
//   const MODELS_BASE = 'https://<host>/first-policy/models/';
// QA pages under tools/ reach the same folder through the '../' fallback
// base. A ?mbase=<base> query param overrides everything (QA / A-B only).
const MODELS_BASE = 'deploy-models/';
const _mbase = new URLSearchParams(location.search).get('mbase');
const CHAR_BASES = _mbase
  ? [_mbase.endsWith('/') ? _mbase : _mbase + '/']
  : (/^(https?:)?\/\//.test(MODELS_BASE) || MODELS_BASE.startsWith('/')
    ? [MODELS_BASE]
    : [MODELS_BASE, '../' + MODELS_BASE]);
const FEMALE_CHARS = ['fatima', 'zainab', 'rahman', 'sana', 'farah', 'hira', 'mrs_sheikh'];
const MALE_CHARS = ['ahmed', 'bilal', 'omar', 'daniyal', 'mr_sheikh'];
// Each body atlas's native skin tone (the "Dark" variant) — per-character
// skin is a material tint relative to this, nothing more. The male value was
// sampled from T_Superhero_Male_Dark at Head-weighted UVs.
const FEMALE_NATIVE_SKIN = new THREE.Color(0xa06a42);
const MALE_NATIVE_SKIN = new THREE.Color(0x9b6749);
// The world height a character with cfg h=1 stands at. Until now this was
// measured live from the Xbot rig (bone span 1.7436 × 1.12); pinning the
// number keeps the approved cast exactly the size it was approved at.
const WORLD_CHAR_H = 1.9528;

function gradientMap() {
  const c = document.createElement('canvas'); c.width = 4; c.height = 1;
  const g = c.getContext('2d');
  [90, 150, 210, 255].forEach((v, i) => { g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(i, 0, 1, 1); });
  const t = new THREE.CanvasTexture(c);
  t.minFilter = t.magFilter = THREE.NearestFilter;
  return t;
}
const GRAD = gradientMap();

function toonify(root) {
  root.traverse(o => {
    if (!o.isMesh) return;
    o.castShadow = true;
    o.frustumCulled = false; // skinned meshes: bind-pose bounds would cull wrongly
    const m = o.material;
    o.material = new THREE.MeshToonMaterial({
      map: m.map || null,
      color: m.color ? m.color.clone() : new THREE.Color(0xffffff),
      gradientMap: GRAD,
    });
  });
}

function withTimeout(promise, ms) {
  return Promise.race([promise, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);
}

// Height of a loaded rig measured from its bones (Box3 lies on skinned
// GLBs): crown ≈ head joint + 1.5× the neck→head distance.
function measureRig(scene, headName, neckName) {
  scene.updateMatrixWorld(true);
  const head = scene.getObjectByName(headName);
  const neck = scene.getObjectByName(neckName);
  if (!head || !neck) return null;
  const hv = new THREE.Vector3(); head.getWorldPosition(hv);
  const nv = new THREE.Vector3(); neck.getWorldPosition(nv);
  let minY = Infinity;
  scene.traverse(o => { if (o.isBone) { const p = new THREE.Vector3(); o.getWorldPosition(p); if (p.y < minY) minY = p.y; } });
  return { headY: hv.y, topY: hv.y + (hv.y - nv.y) * 1.5, baseY: minY };
}

// ---- relaxed-idle pose offset ----
// UAL's only neutral standing idle (Idle_Loop) is a wide superhero stance:
// measured in-engine, feet 0.357 apart and hands floating 0.63 apart — the
// whole cast read as a gym lineup ("akar akar"). UAL1 holds no relaxed
// standing idle (Idle_Talking_Loop shares the same leg stance and gestures
// nonstop; the rest are crouch/sit/swim/weapon clips). So the idle gets a
// small constant pose offset, applied post-mixer and weighted by a relax
// factor that is 1 only in idle: thighs swing inward 9° about the bone-local
// Z axis (feet end under the hips), upper arms tuck in 12° (hands hang beside
// the thighs). Signs were found empirically per bone (upper arms mirror the
// thighs). Walk and react run at relax = 0 — byte-identical to the raw clips.
const RELAX_RATE = 4.5; // per second — ≈ the 0.22 s action crossfade
const _zAxis = new THREE.Vector3(0, 0, 1);
const _tmpQ = new THREE.Quaternion();
const _identQ = new THREE.Quaternion();
function relaxOffsets(group) {
  const deg = Math.PI / 180;
  const defs = [
    ['thigh_l', 9], ['thigh_r', -9],
    ['upperarm_l', -12], ['upperarm_r', 12],
  ];
  const out = [];
  for (const [name, angle] of defs) {
    const bone = group.getObjectByName(name);
    if (bone) out.push([bone, new THREE.Quaternion().setFromAxisAngle(_zAxis, angle * deg)]);
  }
  return out;
}

// Shared animation controller: idle/walk crossfade + one-shot react.
function makeController(group, clips, labelY) {
  const mixer = new THREE.AnimationMixer(group);
  const idle = mixer.clipAction(clips.idle);
  const walk = mixer.clipAction(clips.walk);
  const agree = mixer.clipAction(clips.agree);
  agree.setLoop(THREE.LoopOnce); agree.clampWhenFinished = true;
  idle.play(); idle.time = Math.random() * idle.getClip().duration;
  let mode = 'idle', reactT = -1;
  const offsets = relaxOffsets(group);
  let relax = 0;
  function fadeTo(action, dur = 0.22) {
    for (const a of [idle, walk, agree]) if (a !== action && a.isRunning()) a.fadeOut(dur);
    action.enabled = true; action.setEffectiveWeight(1);
    if (!action.isRunning()) action.play();
    action.fadeIn(dur);
  }
  return {
    group,
    labelY,
    update(dt) {
      mixer.update(dt);
      if (reactT >= 0) { reactT -= dt; if (reactT <= 0) { reactT = -1; fadeTo(mode === 'walk' ? walk : idle, 0.25); } }
      // relaxed-idle offset: ease toward 1 in plain idle, 0 otherwise
      const target = (mode === 'idle' && reactT < 0) ? 1 : 0;
      if (relax !== target) {
        const step = RELAX_RATE * dt;
        relax = target > relax ? Math.min(target, relax + step) : Math.max(target, relax - step);
      }
      if (relax > 0.0001) {
        for (const [bone, offQ] of offsets) {
          _tmpQ.copy(_identQ).slerp(offQ, relax);
          bone.quaternion.multiply(_tmpQ);
        }
      }
    },
    setMoving(m) {
      const nm = m ? 'walk' : 'idle';
      if (nm === mode) return;
      mode = nm;
      if (reactT < 0) fadeTo(m ? walk : idle);
    },
    react() {
      if (reactT >= 0) return;
      reactT = Math.max(agree.getClip().duration - 0.2, 0.5);
      agree.reset(); fadeTo(agree, 0.18);
    },
  };
}

export async function loadCharacters(onProgress) {
  const mode = new URLSearchParams(location.search).get('models');
  if (mode === 'off') return null;
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder); // deploy-models/ GLBs are EXT_meshopt_compression + KHR_mesh_quantization
  async function loadFrom(file) {
    for (const b of CHAR_BASES) {
      try { return await withTimeout(loader.loadAsync(b + file), 15000); } catch (e) { /* try next base */ }
    }
    throw new Error('could not load ' + file);
  }

  // ---- shared UAL clip donor (idle/walk/react on the Universal Rig) ----
  let clips = null;
  try {
    const donor = await loadFrom('UAL_clips.glb');
    const pick = (n) => donor.animations.find(a => a.name === n);
    // the donor's head bone is lowercase 'head'; the Blender-authored
    // bodies call it 'Head' — the one rename the graft needs
    for (const c of donor.animations) for (const t of c.tracks) if (t.name.startsWith('head.')) t.name = 'Head' + t.name.slice(4);
    clips = { idle: pick('Idle'), walk: pick('Walk'), agree: pick('React') };
    if (!clips.idle || !clips.walk || !clips.agree) throw new Error('donor clips incomplete');
  } catch (e) { clips = null; }
  if (onProgress) onProgress(0.4);

  // ---- per-character GLBs ----
  // Any single failure only costs that character its GLB form (its make()
  // returns null and the primitive person steps in), never the whole cast.
  // All files load in PARALLEL: fetched one by one, a slow host kept the
  // start screen locked for half a minute or more (audit SF4/B1).
  const sources = {}; // char key -> {kind, scene, meas, bodyName, native}
  const totalChars = FEMALE_CHARS.length + MALE_CHARS.length;
  let charsDone = 0;
  async function loadChar(kind, key, file, bodyName, native) {
    try {
      const g = await loadFrom(file);
      toonify(g.scene);
      const meas = measureRig(g.scene, 'Head', 'neck_01');
      if (meas) sources[key] = { kind, scene: g.scene, meas, bodyName, native };
    } catch (e) { /* that character falls back to primitives */ }
    charsDone++;
    if (onProgress) onProgress(0.4 + 0.55 * (charsDone / totalChars));
  }
  await Promise.all([
    ...FEMALE_CHARS.map(key => loadChar('female', key, `female_${key}.glb`, 'Superhero_Female', FEMALE_NATIVE_SKIN)),
    ...MALE_CHARS.map(key => loadChar('male', key, `male_${key}.glb`, 'SuperHero_Male', MALE_NATIVE_SKIN)),
  ]);
  if (onProgress) onProgress(0.95);

  function makeChar(kind, cfg) {
    const src = cfg && cfg.char ? sources[cfg.char] : null;
    if (!src || src.kind !== kind || !clips) return null;
    const group = skeletonClone(src.scene);
    const hF = cfg.h ? cfg.h : 1, bF = cfg.b ? cfg.b : 1;
    const H = src.meas.topY - src.meas.baseY;
    const k = WORLD_CHAR_H / H;
    group.scale.set(k * bF, k * hF, k * bF);
    group.position.y = -src.meas.baseY * k * hF;
    // per-character skin: tint the (textured) body mesh relative to the
    // atlas's native tone; outfit/hijab/hair colours are baked into the GLB
    if (cfg.skin !== undefined) {
      const tint = new THREE.Color(cfg.skin);
      tint.r /= src.native.r; tint.g /= src.native.g; tint.b /= src.native.b;
      // clamp the lift: >1 ratios blow out the atlas's lighter face areas
      // into a pale two-tone (seen on Hira, the lightest cfg skin)
      tint.r = Math.min(tint.r, 1.15); tint.g = Math.min(tint.g, 1.15); tint.b = Math.min(tint.b, 1.15);
      group.traverse(o => {
        if (o.isMesh && o.name === src.bodyName) {
          o.material = o.material.clone();
          o.material.color.multiply(tint);
        }
      });
    }
    const labelY = src.meas.headY - src.meas.baseY + 0.5 / (k * hF);
    return makeController(group, clips, labelY);
  }

  if (onProgress) onProgress(1);
  return { make: (kind, cfg = null) => (kind === 'female' || kind === 'male' ? makeChar(kind, cfg) : null) };
}
