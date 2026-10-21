// furniture.js — real low-poly furniture (glTF) with the primitive office as fallback.
//
// Models: KayKit "Furniture Bits" (CC0, by Kay Lousberg) from the official
// KayKit-Game-Assets GitHub repo, streamed from CDN like the characters
// (binary assets can't travel the text-only repo push route). One shared
// palette texture serves the whole set; each model is only a few KB.
// If loading fails, loadFurniture() resolves null and world.js builds the
// original box furniture instead — the office opens either way.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const CDN_BASES = [
  'https://cdn.jsdelivr.net/gh/KayKit-Game-Assets/KayKit-Furniture-Bits-1.0@main/addons/kaykit_furniture_bits/Assets/gltf/',
  'https://cdn.statically.io/gh/KayKit-Game-Assets/KayKit-Furniture-Bits-1.0/main/addons/kaykit_furniture_bits/Assets/gltf/',
];

export const FURNITURE_MODELS = [
  'table_medium_long', 'chair_A', 'couch', 'armchair', 'table_low',
  'cabinet_medium', 'shelf_B_large_decorated', 'lamp_standing',
  'cactus_medium_A', 'book_set', 'rug_rectangle_A',
];

const GRAD = (() => {
  const c = document.createElement('canvas'); c.width = 4; c.height = 1;
  const g = c.getContext('2d');
  [90, 150, 210, 255].forEach((v, i) => { g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(i, 0, 1, 1); });
  const t = new THREE.CanvasTexture(c);
  t.minFilter = t.magFilter = THREE.NearestFilter;
  return t;
})();

function toonify(root) {
  root.traverse(o => {
    if (!o.isMesh) return;
    o.castShadow = true;
    o.receiveShadow = true;
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

export async function loadFurniture(onProgress) {
  const mode = new URLSearchParams(location.search).get('models');
  if (mode === 'off') return null;
  const bases = mode === 'local' ? ['tools/models/furniture/'] : CDN_BASES;
  const loader = new GLTFLoader();
  async function load(file) {
    for (const b of bases) {
      try { return await withTimeout(loader.loadAsync(b + file), 20000); } catch (e) { /* try next base */ }
    }
    throw new Error('could not load ' + file);
  }
  const sources = {};
  let done = 0;
  for (const name of FURNITURE_MODELS) {
    const g = await load(name + '.gltf');
    toonify(g.scene);
    sources[name] = g.scene;
    done++;
    if (onProgress) onProgress(done / FURNITURE_MODELS.length);
  }
  return {
    // place(name, x, z, rotY, scale) -> a fresh clone positioned in the world
    make(name) {
      const src = sources[name];
      if (!src) return null;
      return src.clone(true);
    },
  };
}
