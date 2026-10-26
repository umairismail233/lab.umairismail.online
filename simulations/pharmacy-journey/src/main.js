// Pharmacy Journey Sim - greybox viewer (Phase 1 room + Phase 2 cast).
// Loads the Blender-authored room, dresses shelves with InstancedMesh
// (brief section 5), adds text boards, and the Blender-built cast with
// runtime-grafted UAL animation (src/cast.js). No game logic (Phase 3).
import * as THREE from 'three';
import { SimpleOrbit } from './orbit.js';
import { initCast, updateCast, forceGesture } from './cast.js';
import { initJourney } from './journey.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';
import { loadModel, pool } from './pool.js';

const MODEL_REPORT_URL = './tools/qa-greybox/model-report.json';

// ---------------------------------------------------------------- loading screen
// Boot used to be 16 sequential awaits behind a blank pale-gray canvas: the
// render loop only starts at the bottom of this module, so nothing painted
// until every model arrived. The overlay below is static HTML, so it paints
// before any script runs; these 19 steps drive its bar (7 boot items, the
// donor + 8 cast members, 3 scenario files). A failed boot no longer leaves
// a silent blank screen: the rejection surfaces as an error line.
const LOAD_TOTAL = 19;
let loadDone = 0, loaderHidden = false;
function step(label) {
  loadDone++;
  const pct = Math.min(100, Math.round(loadDone / LOAD_TOTAL * 100));
  const fill = document.getElementById('loadfill');
  const pctEl = document.getElementById('loadpct');
  const fileEl = document.getElementById('loadfile');
  if (fill) fill.style.width = pct + '%';
  if (pctEl) pctEl.textContent = pct + '%';
  // Generic line on purpose: raw model filenames mean nothing to a visitor (fix round 2026-10-26).
  if (fileEl) fileEl.textContent = 'Loading…';
}
function hideLoader() {
  if (loaderHidden) return;
  loaderHidden = true;
  const el = document.getElementById('loader');
  if (!el) return;
  el.classList.add('done');
  setTimeout(() => { el.style.display = 'none'; }, 500);
}
window.addEventListener('unhandledrejection', () => {
  if (loaderHidden) return;
  const err = document.getElementById('loaderr');
  if (err) {
    err.hidden = false;
    err.textContent = 'Could not load the pharmacy. Check your connection and reload the page.';
  }
  const fileEl = document.getElementById('loadfile');
  if (fileEl) fileEl.textContent = 'Loading failed';
});

// A synchronous throw during boot (for example, renderer creation failing
// where no 3D context exists) is an error event, not a rejection, so it needs
// its own listener or the loader freezes on "Starting..." with no message.
window.addEventListener('error', () => {
  if (loaderHidden) return;
  const err = document.getElementById('loaderr');
  if (err) {
    err.hidden = false;
    err.textContent = 'Could not load the pharmacy. Check your connection and reload the page.';
  }
  const fileEl = document.getElementById('loadfile');
  if (fileEl) fileEl.textContent = 'Loading failed';
});

// ---------------------------------------------------------------- renderer
const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xe8ece9);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.35;

const camera = new THREE.PerspectiveCamera(46, innerWidth / innerHeight, 0.1, 200);
const controls = new SimpleOrbit(camera, renderer.domElement);

// ---------------------------------------------------------------- lighting (greybox approximation of the brief's bake)
// REAL in the GLB: emissive ceiling panels, green cross + halo, fridge strip,
// POS screen, warm bulb. PLACEHOLDER: this even ambient rig stands in for the
// production lightmap bake; one dim directional grounds the capsules.
scene.add(new THREE.HemisphereLight(0xffffff, 0xb9c4bb, 0.72));
scene.add(new THREE.AmbientLight(0xffffff, 0.15));
const dir = new THREE.DirectionalLight(0xffffff, 0.55);
dir.position.set(4, 9, -3);
scene.add(dir);
const warm = new THREE.PointLight(0xffb45e, 12, 6.5, 2); // consultation corner pool
warm.position.set(6.9, 1.7, -5.3); // three.js: north wall is -Z; corner is NE
scene.add(warm);

// ---------------------------------------------------------------- helpers
function textBoard(lines, { w = 512, h = 128, bg = '#F7F9F7', fg = '#20302A', accent = '#0F766E', font = 56, urdu = false } = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d');
  x.fillStyle = bg; x.fillRect(0, 0, w, h);
  x.fillStyle = accent; x.fillRect(0, 0, 10, h);
  x.fillStyle = fg; x.textAlign = 'center'; x.textBaseline = 'middle';
  const fam = urdu ? "'Noto Nastaliq Urdu', 'Segoe UI', Arial, sans-serif" : "'Segoe UI', Arial, sans-serif";
  const list = Array.isArray(lines) ? lines : [lines];
  list.forEach((ln, i) => {
    const fs = (i === 0 ? font : font * 0.62) * (urdu ? 0.78 : 1);
    x.font = `${i === 0 ? '700' : '500'} ${fs}px ${fam}`;
    x.fillText(ln, w / 2 + 5, h * (list.length === 1 ? 0.52 : 0.32 + i * 0.38) + (urdu ? fs * 0.12 : 0));
  });
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}
function applyBoard(root, name, lines, opts) {
  const o = root.getObjectByName(name);
  if (!o) { console.warn('missing board', name); return; }
  fullFaceUVs(o.geometry);
  o.material = new THREE.MeshStandardMaterial({ map: textBoard(lines, opts), roughness: 0.85 });
}
// The room's board meshes carry Blender's cube-cross unwrap: each face
// samples a rotated quarter slice of any texture, so canvas sign text
// never showed (a Phase 2/3 latent bug, found in Phase 4 QA). Rewrite the
// UVs from position + normal so every broad face carries the full canvas,
// upright and readable from outside (three.js BoxGeometry convention).
function fullFaceUVs(geo) {
  const pos = geo?.attributes?.position, nor = geo?.attributes?.normal;
  if (!pos || !nor) return;
  geo.computeBoundingBox();
  const bb = geo.boundingBox;
  const sx = (bb.max.x - bb.min.x) || 1, sy = (bb.max.y - bb.min.y) || 1, sz = (bb.max.z - bb.min.z) || 1;
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    const x = (pos.getX(i) - bb.min.x) / sx;
    const y = (pos.getY(i) - bb.min.y) / sy;
    const z = (pos.getZ(i) - bb.min.z) / sz;
    const nx = Math.round(nor.getX(i)), ny = Math.round(nor.getY(i)), nz = Math.round(nor.getZ(i));
    let u, v;
    if (nz !== 0) { u = nz > 0 ? x : 1 - x; v = y; }
    else if (nx !== 0) { u = nx > 0 ? 1 - z : z; v = y; }
    else { u = x; v = ny > 0 ? z : 1 - z; }
    uv[i * 2] = u; uv[i * 2 + 1] = v;
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
}
const blobTex = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(64, 64, 4, 64, 64, 62);
  g.addColorStop(0, 'rgba(20,30,25,0.42)'); g.addColorStop(1, 'rgba(20,30,25,0)');
  x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
})();
function blob(parent, x, z, s = 1) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(0.9 * s, 0.9 * s),
    new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false }));
  m.rotation.x = -Math.PI / 2; m.position.set(x, 0.012, z); m.renderOrder = 1;
  parent.add(m);
}
// B(x, y) converts Blender scene coords (x east, y north) to three.js (x, -y on z)
const B = (x, y) => [x, -y];

// ---------------------------------------------------------------- load room
const loader = new GLTFLoader();
loader.setMeshoptDecoder(MeshoptDecoder); // library GLBs are meshopt-compressed
// Boot fetches used to run one by one (room, then report, then each prop,
// then the lamp, then the donor, then each cast member): with ~1s of server
// response time per file, the latency stacked instead of overlapping. These
// 7 independent items now fly together (cap 6 in flight); the setup code
// below still runs in exactly the original order.
const [room, report, amber, google, jarA, jarB, lamp] = await pool([
  ['pharmacy-room.glb', () => loadModel(loader, 'src/models/pharmacy-room.glb')],
  ['model-report.json', async () => (await fetch(MODEL_REPORT_URL)).json()],
  ['pill-bottle-amber.glb', () => geoFromGLB('./assets/props/pill-bottle-amber.glb', 0.45)],
  ['pill-bottle-google.glb', () => geoFromGLB('./assets/props/pill-bottle-google.glb', 1)],
  ['kaykit-jar-set-a.glb', () => geoFromGLB('./assets/props/vendor/kaykit-jar-set-a.glb', 0.2)],
  ['kaykit-jar-set-b.glb', () => geoFromGLB('./assets/props/vendor/kaykit-jar-set-b.glb', 0.2)],
  ['kaykit-lamp-standing.glb', () => loadModel(loader, 'assets/props/vendor/kaykit-lamp-standing.glb')],
], 6, async ([label, fn]) => { const v = await fn(); step(label); return v; });
scene.add(room.scene);

// The Blender glass material exports opaque-ish white (alpha does not survive
// Principled->glTF alpha reliably); patch the real glass meshes here.
const ceilingParts = []; // hidden only in the Top Down view
function applyCeiling(name) {
  const show = name !== 'topdown';
  ceilingParts.forEach(o => { o.visible = show; });
}
room.scene.traverse(o => {
  if (!o.isMesh) return;
  const n = o.name;
  if (n === 'ceiling' || n === 'ceiling_panels' || n === 'ceiling_panel_frames') ceilingParts.push(o);
  if (n === 'fridge_door') o.material = new THREE.MeshPhysicalMaterial({
    color: 0x9cc8dd, transparent: true, opacity: 0.42, roughness: 0.08, metalness: 0 });
  else if (n.includes('glass')) o.material = new THREE.MeshPhysicalMaterial({
    color: 0xd7e8ec, transparent: true, opacity: 0.24, roughness: 0.06, metalness: 0 });
  if (/^(disp_|bill_|bench_|consult_table|rack_unit|gondola|fridge_body)/.test(n)) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, opacity: 0.5, depthWrite: false }));
    p.rotation.x = -Math.PI / 2; p.renderOrder = 1;
    const bb = new THREE.Box3().setFromObject(o);
    const s = bb.getSize(new THREE.Vector3()), c0 = bb.getCenter(new THREE.Vector3());
    p.scale.set(s.x * 1.15 + 0.2, s.z * 1.15 + 0.2, 1);
    p.position.set(c0.x, 0.008, c0.z);
    scene.add(p);
  }
});

// text boards on the Blender board meshes
// Sign boards are bilingual: the journey's language toggle re-applies them
// in Urdu (bay letters stay Latin, like real rack signage in Pakistan).
const BOARDS = {
  en: [
    ['board_vitamins', 'VITAMINS & CARE', { accent: '#0F766E' }],
    ['board_firstaid', 'FIRST AID', { accent: '#00A651' }],
    ['board_bay_a', 'BAY A', { w: 256, font: 72 }],
    ['board_bay_b', 'BAY B', { w: 256, font: 72 }],
    ['board_bay_c', 'BAY C', { w: 256, font: 72 }],
    ['board_rx', ['Rx', 'PRESCRIPTION'], { w: 512, h: 160, accent: '#E8A13A', font: 64 }],
    ['consult_sign', ['ASK OUR', 'PHARMACIST'], { accent: '#00A651', font: 52 }],
    ['fascia_text_board', 'PHARMACY', { bg: '#00A651', fg: '#FFFFFF', accent: '#00A651', font: 64 }],
    ['poster_1', ['FLU SHOTS HERE', 'Ask at the counter'], { w: 512, h: 704, accent: '#00A651', font: 62 }],
    ['poster_2', ['WASH HANDS', 'Stay healthy'], { w: 512, h: 704, accent: '#0F766E', font: 62 }],
  ],
  ur: [
    ['board_vitamins', ['وٹامنز', 'اور دیکھ بھال'], { accent: '#0F766E', urdu: true }],
    ['board_firstaid', 'ابتدائی طبی امداد', { accent: '#00A651', urdu: true, font: 44 }],
    ['board_bay_a', 'BAY A', { w: 256, font: 72 }],
    ['board_bay_b', 'BAY B', { w: 256, font: 72 }],
    ['board_bay_c', 'BAY C', { w: 256, font: 72 }],
    ['board_rx', ['Rx', 'نسخہ'], { w: 512, h: 160, accent: '#E8A13A', font: 64, urdu: true }],
    ['consult_sign', ['ہمارے فارماسسٹ', 'سے پوچھیں'], { accent: '#00A651', font: 52, urdu: true }],
    ['fascia_text_board', 'فارمیسی', { bg: '#00A651', fg: '#FFFFFF', accent: '#00A651', font: 64, urdu: true }],
    ['poster_1', ['فلو کے ٹیکے یہاں', 'کاؤنٹر پر پوچھیں'], { w: 512, h: 704, accent: '#00A651', font: 62, urdu: true }],
    ['poster_2', ['ہاتھ دھوئیں', 'صحت مند رہیں'], { w: 512, h: 704, accent: '#0F766E', font: 62, urdu: true }],
  ],
};
function applyBoards(lang) {
  for (const [name, lines, opts] of BOARDS[lang] || BOARDS.en) applyBoard(room.scene, name, lines, opts);
}
applyBoards('en');
// ---------------------------------------------------------------- POS screen (dynamic in Phase 3)
// Rows of [label, value] rendered as a till display: dark screen, green text.
function posTexture(rows) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 340;
  const x = c.getContext('2d');
  x.fillStyle = '#12211A'; x.fillRect(0, 0, 512, 340);
  x.fillStyle = '#7BE3A8'; x.textBaseline = 'middle';
  rows.forEach(([l, v], i) => {
    const y = 340 * (rows.length === 1 ? 0.5 : 0.30 + i * 0.38);
    x.font = "700 44px 'Courier New', monospace"; x.textAlign = 'left';
    x.fillText(String(l).slice(0, 16), 28, y);
    x.textAlign = 'right';
    x.fillText(String(v), 484, y);
  });
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}
function setPos(rows) {
  const pos = room.scene.getObjectByName('pos_screen');
  if (!pos) return;
  const tex = posTexture(rows);
  if (!pos.userData.posMat) {
    fullFaceUVs(pos.geometry); // same cube-cross UV fix as the sign boards
    pos.userData.posMat = new THREE.MeshStandardMaterial({ roughness: 0.4 });
    pos.material = pos.userData.posMat;
  }
  pos.userData.posMat.map = tex;
  pos.userData.posMat.emissive = new THREE.Color(0xffffff);
  pos.userData.posMat.emissiveMap = tex;
  pos.userData.posMat.emissiveIntensity = 0.55;
  pos.userData.posMat.needsUpdate = true;
}
setPos([['TOTAL', 'Rs 450']]);

// ---------------------------------------------------------------- stock dressing (rescue 2026-10-22)
// Reference-first rebuild (docs/reference-notes.md): real pack faces from a
// fictional-brand canvas atlas on instanced cartons, real bottle/jar geometry
// from the asset library, everything SITTING on measured board tops.
// Board tops measured from the shelf mesh in Blender (up-face centres,
// native Z x 0.95 unit scale): 0.183 / 0.807 / 1.445 (+ 2.083 rack tops).
// The Phase 3 levels (0.22/0.90/1.58) floated stock up to 13 cm: fixed here.
const dummy = new THREE.Object3D();
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const rng = mulberry32(20261022);
const pick = arr => arr[Math.floor(rng() * arr.length)];

// ---- fictional-brand label atlas (4x4 cells of 256 px on a 1024 canvas)
const BRANDS = [
  ['CALMPAR', 'Paracetamol', '500 mg tablets', '#0F766E'], ['MOXIDEL', 'Amoxicillin', '250 mg capsules', '#00A651'],
  ['VITABOOST', 'Multivitamins', '30 tablets', '#E07B24'], ['DERMACALM', 'Skin cream', '50 g tube', '#C65D7B'],
  ['COUGHNIL', 'Cough relief', '120 ml syrup', '#7A5FA0'], ['GASTROGARD', 'Antacid', '20 chewables', '#3E6FB4'],
  ['ALLERFREE', 'Allergy relief', '10 mg tablets', '#4E9BC4'], ['FEBRIL', 'Fever relief', '16 tablets', '#C0392B'],
  ['ZINCOVIT', 'Zinc + Vitamin C', '20 effervescent', '#D9A41B'], ['THROCARE', 'Throat lozenges', '24 lozenges', '#6C4AB0'],
  ['ORSALA', 'Oral rehydration', '6 sachets', '#2A9D8F'], ['BANDEX', 'Adhesive bandages', '40 strips', '#D96C4F'],
];
function makeAtlas() {
  const c = document.createElement('canvas'); c.width = c.height = 1024;
  const x = c.getContext('2d');
  x.fillStyle = '#ffffff'; x.fillRect(0, 0, 1024, 1024);
  BRANDS.forEach((b, i) => {
    const cx = (i % 4) * 256, cy = Math.floor(i / 4) * 256;
    x.fillStyle = '#fdfdfa'; x.fillRect(cx, cy, 256, 256);
    x.fillStyle = b[3]; x.fillRect(cx, cy, 256, 74);
    x.fillStyle = '#ffffff'; x.font = "800 37px 'Segoe UI', Arial"; x.textAlign = 'left';
    x.fillText(b[0], cx + 16, cy + 50);
    x.fillStyle = '#20302a'; x.font = "700 31px 'Segoe UI', Arial";
    x.fillText(b[1], cx + 16, cy + 122);
    x.fillStyle = '#5a6f64'; x.font = "500 25px 'Segoe UI', Arial";
    x.fillText(b[2], cx + 16, cy + 158);
    x.fillStyle = b[3]; x.fillRect(cx + 16, cy + 196, 86, 12);
    x.fillStyle = '#9db3a7'; x.font = "600 19px 'Segoe UI', Arial";
    x.fillText('CarePlus Labs', cx + 16, cy + 234);
  });
  // cell 13: green cross generic; cell 14: Rx dispensary carton; cell 15: plain white (sides)
  let cx = 1 * 256, cy = 3 * 256;
  x.fillStyle = '#f4faf5'; x.fillRect(cx, cy, 256, 256);
  x.fillStyle = '#00A651'; x.fillRect(cx + 103, cy + 48, 50, 160); x.fillRect(cx + 48, cy + 103, 160, 50);
  cx = 2 * 256;
  x.fillStyle = '#fdfdfa'; x.fillRect(cx, cy, 256, 256);
  x.fillStyle = '#E8A13A'; x.fillRect(cx, cy, 256, 74);
  x.fillStyle = '#20302a'; x.font = "800 44px 'Segoe UI', Arial"; x.fillText('Rx', cx + 16, cy + 52);
  x.font = "600 23px 'Segoe UI', Arial"; x.fillStyle = '#5a6f64';
  x.fillText('DISPENSARY', cx + 16, cy + 122); x.fillText('Pharmacist only', cx + 16, cy + 154);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}
const atlasTex = makeAtlas();
const atlasMat = new THREE.MeshStandardMaterial({ map: atlasTex, roughness: 0.82 });
const CELL = i => [ (i % 4) / 4, 1 - (Math.floor(i / 4) + 1) / 4, ((i % 4) + 1) / 4, 1 - Math.floor(i / 4) / 4 ];
function boxGeo(w, h, d, front, back) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv, W = CELL(15), F = CELL(front), B = CELL(back);
  for (let i = 0; i < uv.count; i++) {
    const face = Math.floor(i / 4); // px nx py ny pz nz
    const cell = face === 4 ? F : face === 5 ? B : W;
    uv.setXY(i, cell[0] + uv.getX(i) * (cell[2] - cell[0]), cell[1] + uv.getY(i) * (cell[3] - cell[1]));
  }
  return g;
}
// carton types: [w,h,d], atlas cell front/back
const CARTONS = [
  { s: [0.13, 0.09, 0.05], f: 0, b: 5 }, { s: [0.13, 0.09, 0.05], f: 2, b: 6 },
  { s: [0.10, 0.145, 0.05], f: 1, b: 7 }, { s: [0.10, 0.145, 0.05], f: 3, b: 9 },
  { s: [0.165, 0.115, 0.06], f: 4, b: 8 }, { s: [0.165, 0.115, 0.06], f: 10, b: 11 },
  { s: [0.10, 0.145, 0.05], f: 14, b: 0 }, { s: [0.09, 0.065, 0.04], f: 13, b: 2 },
];
const cartonPlaces = CARTONS.map(() => []);
const bottlePlaces = { amber: [], white: [], google: [], jarA: [], jarB: [] };
const TINTS = [0xffffff, 0xf2f5f2, 0xe9efe9, 0xffffff, 0xf7f3ea].map(h => new THREE.Color(h));

// fill one shelf row with product runs; originX/originZ = unit centre (three.js),
// dirZ = +1 when the row faces +Z (aisle side), level = board top height.
function fillRow(places, cx, cz, dirZ, level, halfW, opts = {}) {
  const frontOff = opts.frontOff ?? 0.19, backOff = opts.backOff ?? 0.03;
  const rotY = dirZ > 0 ? 0 : Math.PI;
  let x = -halfW + 0.02;
  while (x < halfW - 0.06) {
    const r = rng();
    if (r < 0.05) { x += 0.08 + rng() * 0.16; continue; } // breathing gap
    if (r < 0.60) { // carton run of one type
      const ti = opts.cartonPool ? pick(opts.cartonPool) : Math.floor(rng() * 6);
      const t = CARTONS[ti], w = t.s[0];
      const n = 3 + Math.floor(rng() * 6);
      for (let i = 0; i < n && x + w <= halfW - 0.02; i++) {
        const wx = cx + x + w / 2;
        if (!(opts.exclude && opts.exclude(wx, level))) {
          places.cartons[ti].push([wx, level + t.s[1] / 2, cz + dirZ * frontOff, rotY + (rng() - 0.5) * 0.03, pick(TINTS)]);
          if (opts.backRow && rng() < 0.75)
            places.cartons[ti].push([wx, level + t.s[1] / 2, cz + dirZ * backOff, rotY, pick(TINTS)]);
        }
        x += w + 0.004;
      }
      x += 0.015;
    } else if (r < 0.86) { // bottle cluster
      const bt = pick(opts.bottlePool || ['amber', 'white', 'google']);
      const n = 2 + Math.floor(rng() * 4), bw = 0.056;
      for (let i = 0; i < n && x + bw <= halfW - 0.02; i++) {
        const wx = cx + x + bw / 2;
        if (!(opts.exclude && opts.exclude(wx, level))) places[bt].push([wx, level, cz + dirZ * frontOff, rng() * 3]);
        x += bw + 0.004;
      }
      x += 0.015;
    } else { // jars
      const jt = pick(['jarA', 'jarB']);
      const n = 2 + Math.floor(rng() * 2), jw = 0.108;
      for (let i = 0; i < n && x + jw <= halfW - 0.02; i++) {
        const wx = cx + x + jw / 2;
        if (!(opts.exclude && opts.exclude(wx, level))) places[jt].push([wx, level, cz + dirZ * frontOff, rng() * 3]);
        x += jw + 0.006;
      }
      x += 0.015;
    }
  }
}
const places = { cartons: cartonPlaces, ...bottlePlaces };
const LEVELS = [0.183, 0.807, 1.445];
// gondolas: report rows face the central walkway; dirZ = sign(blender row y)
for (const [cx, cy, _f] of report.gondola_units) {
  const cz = -cy, dirZ = Math.sign(cy);
  for (const lv of LEVELS) fillRow(places, cx, cz, dirZ, lv, 0.40, { frontOff: 0.19 });
}
// dispensary racks: denser, carton-heavy, two rows deep, hero slot kept clear
const heroClear = (wx, lv) => Math.abs(wx) < 0.48 && lv > 0.5;
for (let i = 0; i < 6; i++) {
  const cx = -4.05 + i * 1.35, cz = -5.15;
  for (const lv of LEVELS) fillRow(places, cx, cz, 1, lv, 0.62,
    { frontOff: 0.16, backRow: true, cartonPool: [6, 6, 2, 0, 1, 4], exclude: i === 3 ? heroClear : null });
  fillRow(places, cx, cz, 1, 2.083, 0.62, { frontOff: 0.16, cartonPool: [7, 6], bottlePool: ['white'], exclude: i === 3 ? heroClear : null });
}
// fridge: white bottles and jars behind the glass (shelf tops 0.82 / 1.32, floor row 0.17)
for (const lv of [0.17, 0.82, 1.32]) {
  let x = -8.48;
  while (x < -6.78) {
    const bt = pick(['white', 'white', 'jarA', 'jarB', 'google']);
    const bw = bt.startsWith('jar') ? 0.108 : 0.056, n = 2 + Math.floor(rng() * 3);
    for (let i = 0; i < n && x + bw < -6.72; i++) { places[bt].push([x + bw / 2, lv, -5.42, rng() * 3]); x += bw + 0.005; }
    x += 0.03 + rng() * 0.05;
  }
}

function fillSimple(geo, mat, list, scale = 1) {
  const im = new THREE.InstancedMesh(geo, mat, Math.max(1, list.length));
  list.forEach((p, i) => {
    dummy.position.set(p[0], p[1], p[2]);
    dummy.rotation.set(0, p[3] || 0, 0);
    dummy.scale.setScalar(typeof p[4] === 'number' ? p[4] : scale);
    dummy.updateMatrix();
    im.setMatrixAt(i, dummy.matrix);
    if (p[4] && p[4].isColor) im.setColorAt(i, p[4]);
  });
  im.count = list.length;
  im.instanceMatrix.needsUpdate = true;
  if (im.instanceColor) im.instanceColor.needsUpdate = true;
  scene.add(im);
  return im;
}
CARTONS.forEach((t, ti) => fillSimple(boxGeo(...t.s, t.f, t.b), atlasMat, cartonPlaces[ti]));
// bottle + jar geometries from the library GLBs; origin moved to the base
async function geoFromGLB(url, wantScale) {
  // Bake the node's world transform into the geometry and take the LARGEST
  // mesh: library GLBs carry node scales (x100, x0.325) and multi-part
  // scenes (the Google bottle ships with loose pills) - raw geometry lies.
  const g = await loadModel(loader, url);
  g.scene.updateMatrixWorld(true);
  let mesh = null, best = -1;
  g.scene.traverse(o => {
    if (!o.isMesh) return;
    o.geometry.computeBoundingBox();
    const s = o.geometry.boundingBox.getSize(new THREE.Vector3());
    const v = s.x * s.y * s.z * Math.abs(o.matrixWorld.determinant());
    if (v > best) { best = v; mesh = o; }
  });
  const geo = mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);
  geo.computeBoundingBox();
  const bb = geo.boundingBox, size = bb.getSize(new THREE.Vector3());
  geo.translate(-(bb.min.x + bb.max.x) / 2, -bb.min.y, -(bb.min.z + bb.max.z) / 2);
  return { geo, mat: mesh.material, h: size.y * wantScale, scale: wantScale };
}
fillSimple(amber.geo, amber.mat, bottlePlaces.amber, amber.scale);
fillSimple(amber.geo, new THREE.MeshStandardMaterial({ color: 0xf2f5f2, roughness: 0.35 }), bottlePlaces.white, amber.scale);
fillSimple(google.geo, google.mat, bottlePlaces.google, 1);
fillSimple(jarA.geo, jarA.mat, bottlePlaces.jarA, jarA.scale);
fillSimple(jarB.geo, jarB.mat, bottlePlaces.jarB, jarB.scale);

// shelf-edge price strips along every stocked board front
function stripTexture() {
  const c = document.createElement('canvas'); c.width = 512; c.height = 32;
  const x = c.getContext('2d');
  x.fillStyle = '#f7f9f7'; x.fillRect(0, 0, 512, 32);
  x.fillStyle = '#40534a'; x.font = "700 19px 'Segoe UI', Arial"; x.textAlign = 'center';
  for (let i = 0; i < 4; i++) x.fillText('Rs ' + (60 + i * 70) + '  ·', 64 + i * 128, 22);
  x.fillStyle = '#00A651'; x.fillRect(0, 28, 512, 4);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  t.wrapS = THREE.RepeatWrapping;
  return t;
}
const stripMat = new THREE.MeshStandardMaterial({ map: stripTexture(), roughness: 0.7 });
const strips = [];
for (const [cx, cy] of report.gondola_units) for (const lv of LEVELS)
  strips.push([cx, lv - 0.018, -cy + Math.sign(cy) * 0.287, Math.sign(cy) > 0 ? 0 : Math.PI, 0.86]);
for (let i = 0; i < 6; i++) for (const lv of LEVELS)
  strips.push([-4.05 + i * 1.35, lv - 0.018, -5.15 + 0.257, 0, 1.28]);
{
  const g86 = new THREE.BoxGeometry(0.86, 0.03, 0.014), g128 = new THREE.BoxGeometry(1.28, 0.03, 0.014);
  fillSimple(g86, stripMat, strips.filter(s => s[4] === 0.86).map(s => [s[0], s[1], s[2], s[3]]));
  fillSimple(g128, stripMat, strips.filter(s => s[4] === 1.28).map(s => [s[0], s[1], s[2], s[3]]));
}

// counter dressing: jars and bottles where the pharmacist works (counter top y = 1.05)
function counterProp(geo, mat, x, y, z, scale = 1, rotY = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z); m.scale.setScalar(scale); m.rotation.y = rotY;
  scene.add(m); return m;
}
counterProp(jarA.geo, jarA.mat, -3.35, 1.05, -3.0, jarA.scale);
counterProp(jarB.geo, jarB.mat, -3.12, 1.05, -3.02, jarB.scale);
counterProp(jarA.geo, jarA.mat, -2.9, 1.05, -2.98, jarA.scale, 1.2);
counterProp(amber.geo, new THREE.MeshStandardMaterial({ color: 0xf2f5f2, roughness: 0.35 }), 2.15, 1.05, -3.0, amber.scale);
counterProp(amber.geo, amber.mat, 2.32, 1.05, -2.95, amber.scale, 0.7);
counterProp(boxGeo(...CARTONS[0].s, CARTONS[0].f, CARTONS[0].b), atlasMat, -4.3, 1.05 + CARTONS[0].s[1] / 2, -2.95, 1, 0.15);
counterProp(boxGeo(...CARTONS[0].s, CARTONS[0].f, CARTONS[0].b), atlasMat, -4.3, 1.05 + CARTONS[0].s[1] * 1.5, -2.95, 1, 0.5);
counterProp(boxGeo(...CARTONS[2].s, CARTONS[2].f, CARTONS[2].b), atlasMat, 6.45, 1.05 + CARTONS[2].s[1] / 2, 4.15, 1, -0.4);
counterProp(jarB.geo, jarB.mat, 7.1, 0.395, -4.55, jarB.scale); // consultation table
counterProp(boxGeo(...CARTONS[3].s, CARTONS[3].f, CARTONS[3].b), atlasMat, 6.85, 0.395 + CARTONS[3].s[1] / 2, -4.5, 1, 0.3);

// consultation lamp: KayKit floor lamp replaces the ToxSam street-lamp form
// (fetched in the parallel boot pool above; placed here, in the original spot)
{
  lamp.scene.position.set(5.9, 0, -5.55);
  lamp.scene.scale.setScalar(0.615);
  scene.add(lamp.scene);
  const shade = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 8),
    new THREE.MeshStandardMaterial({ color: 0xffd9a0, emissive: 0xffb45e, emissiveIntensity: 1.6 }));
  shade.position.set(5.9, 1.38, -5.55);
  scene.add(shade);
}

// ---------------------------------------------------------------- cast (Phase 2)
// Blender-built characters at the Phase 1 posts; posts/roles/clips in cast.js.
const cast = await initCast(scene, blob, label => step(label));
const figures = cast.group; // kept for the ?nofigures=1 toggle

// ---------------------------------------------------------------- Phase 3 journey props
// The room GLB already carries a paper-bag prop at billing (bill_bag) and a
// bagging area at the dispensing counter. Phase 3 drives their visibility:
// the dispensary bag appears once the medicine is labelled + checked, the
// billing bag appears when the player reaches the till. The hero medicine
// box is generated per scenario from its data (brand / strength / expiry).
function anchorOf(name) {
  const o = room.scene.getObjectByName(name);
  if (!o) return null;
  const p = new THREE.Vector3();
  o.getWorldPosition(p);
  return { obj: o, pos: p };
}
const billBagAnchor = anchorOf('bill_bag');
const dispBagAnchor = anchorOf('disp_tray');
if (billBagAnchor) billBagAnchor.obj.visible = false;
let dispBag = null;
if (dispBagAnchor) {
  dispBag = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.24, 0.20),
    new THREE.MeshStandardMaterial({ color: 0xd9b98c, roughness: 0.95 }));
  dispBag.position.copy(dispBagAnchor.pos).add(new THREE.Vector3(0, 0.13, 0));
  dispBag.visible = false;
  scene.add(dispBag);
}
function boxTexture(med, expiry) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 320;
  const x = c.getContext('2d');
  x.fillStyle = '#ffffff'; x.fillRect(0, 0, 512, 320);
  x.fillStyle = '#0f766e'; x.fillRect(0, 0, 512, 74);
  x.fillStyle = '#ffffff'; x.font = "800 40px 'Segoe UI', Arial"; x.textAlign = 'left';
  x.fillText(med.brand.en.toUpperCase(), 26, 50);
  x.fillStyle = '#12211a'; x.font = "700 46px 'Segoe UI', Arial";
  x.fillText(med.generic.en, 26, 140);
  x.font = "500 36px 'Segoe UI', Arial"; x.fillStyle = '#40534a';
  x.fillText(med.strength.en, 26, 190);
  x.fillText(med.pack.en, 26, 238);
  x.fillStyle = '#b3261e'; x.font = "800 34px 'Segoe UI', Arial";
  x.fillText('EXP ' + expiry, 26, 292);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}
let journeyBox = null;
function createJourneyBox(med) {
  if (journeyBox) { scene.remove(journeyBox); journeyBox.geometry.dispose(); }
  const texV = boxTexture(med, med.validExpiry.en), texE = boxTexture(med, med.expiredExpiry.en);
  // face order: +x -x +y -y +z -z ; front (+z) valid, back (-z) carries the trap date
  const side = new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.85 });
  const mats = [side, side, side, side,
    new THREE.MeshStandardMaterial({ map: texV, roughness: 0.85 }),
    new THREE.MeshStandardMaterial({ map: texE, roughness: 0.85 })];
  journeyBox = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.19, 0.10), mats);
  journeyBox.visible = false;
  scene.add(journeyBox);
  return journeyBox;
}

// ---------------------------------------------------------------- viewpoints
const VIEWS = {
  entrance:   { pos: [5.0, 1.55, 5.55], tgt: [0.3, 1.0, -3.2] },
  dispensing: { pos: [-4.8, 1.75, 2.2], tgt: [-1.2, 0.95, -3.6] },
  aisle:      { pos: [-3.4, 1.55, 3.8], tgt: [-5.0, 0.9, -3.8] },
  consult:    { pos: [4.1, 1.95, -2.1], tgt: [6.9, 0.8, -5.3] },
  topdown:    { pos: [0, 16.5, 0.5], tgt: [0, 0, 0.4] },
  // Phase 2 QA views (not button-bound): faces + the wave action shot
  'face-ayesha': { pos: [-1.5, 1.5, -2.45], tgt: [-1.5, 1.42, -3.75] },
  'face-sara':   { pos: [-2.7, 1.52, -3.2], tgt: [-2.7, 1.44, -4.45] },
  'action-wave': { pos: [-0.35, 1.45, -1.55], tgt: [-1.5, 1.15, -3.75] },
  // Phase 2.1 coat QA views (not button-bound): per-pharmacist action framing
  'coat-bilal':   { pos: [-3.85, 1.45, 3.35], tgt: [-5.05, 1.05, 1.5] },
  'coat-sara':    { pos: [-0.9, 1.45, -4.55], tgt: [-2.7, 1.05, -4.45] },
  'coat-daniyal': { pos: [5.6, 1.95, 4.7], tgt: [7.7, 0.95, 3.5] },
  // Phase 3 journey cameras
  // Counter view sits east of the gondola rows (which end at x=-0.07) so
  // the sightline to the pharmacist clears the easternmost gondola unit
  // (sightline x=+0.77 at the gondola row) and the customer stands far
  // left instead of hiding the speaker. A dead-behind angle hid her
  // behind the player, which breaks the speech-bubble presentation.
  counter:        { pos: [1.6, 1.58, 0.6], tgt: [-1.5, 1.15, -3.9] },
  counterClose:   { pos: [-0.55, 1.5, -2.35], tgt: [-1.6, 1.1, -3.9] },
  racks:          { pos: [0.9, 1.6, -2.2], tgt: [-1.7, 1.05, -4.9] },
  racksClose:     { pos: [-0.6, 1.35, -3.9], tgt: [-1.5, 1.0, -4.85] },
  consultJourney: { pos: [4.6, 1.6, -2.6], tgt: [6.6, 0.9, -4.9] },
  billingCam:     { pos: [5.6, 1.7, 2.6], tgt: [6.7, 1.1, 4.15] },
};
function goView(name, instant = false) {
  applyCeiling(name);
  const v = VIEWS[name]; if (!v) return;
  if (window.__camTween) { window.__camTween.kill(); window.__camTween = null; }
  if (instant || !window.gsap) {
    if (window.__camTween) { window.__camTween.kill(); window.__camTween = null; }
    camera.position.set(...v.pos); controls.target.set(...v.tgt);
  } else {
    const tw = gsap.to(camera.position, { x: v.pos[0], y: v.pos[1], z: v.pos[2], duration: 1.1, ease: 'power2.inOut' });
    gsap.to(controls.target, { x: v.tgt[0], y: v.tgt[1], z: v.tgt[2], duration: 1.1, ease: 'power2.inOut' });
    window.__camTween = tw;
  }
  document.querySelectorAll('#views button[data-view]').forEach(b =>
    b.classList.toggle('active', b.dataset.view === name));
}
document.querySelectorAll('#views button[data-view]').forEach(b =>
  b.addEventListener('click', () => goView(b.dataset.view)));
window.__setView = name => { // instant switch for QA screenshots
  applyCeiling(name);
  const v = VIEWS[name]; if (!v) return;
  camera.position.set(...v.pos); controls.target.set(...v.tgt);
  document.querySelectorAll('#views button[data-view]').forEach(b =>
    b.classList.toggle('active', b.dataset.view === name));
};
window.__setPose = (key, gesture) => forceGesture(cast, key, gesture); // QA: hold a gesture

const params = new URLSearchParams(location.search);
const startView = params.get('view');
if (startView) applyCeiling(startView);
if (startView && VIEWS[startView]) {
  camera.position.set(...VIEWS[startView].pos);
  controls.target.set(...VIEWS[startView].tgt);
  document.querySelector(`#views button[data-view="${startView}"]`)?.classList.add('active');
} else {
  camera.position.set(...VIEWS.entrance.pos);
  controls.target.set(...VIEWS.entrance.tgt);
}
if (params.get('nofigures') === '1') figures.visible = false;

// ---------------------------------------------------------------- loop
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05);
  updateCast(cast, dt, clock.elapsedTime);
  controls.update();
  renderer.render(scene, camera);
});
// ---------------------------------------------------------------- Phase 3 journey
// The journey engine (src/journey.js) drives stations 0-8 from scenario
// data. The free-orbit viewer stays live behind the picker; once a visit
// starts, the engine owns the camera and the cast posts.
const journey = initJourney({
  scene, camera, controls, cast,
  goView: (n, i) => goView(n, i),
  gesture: (k, g) => forceGesture(cast, k, g),
  onLang: lang => applyBoards(lang),
  onProgress: label => step(label),
  anchors: {},
  props: {
    billBag: billBagAnchor ? billBagAnchor.obj : { visible: false },
    bagOnCounter: on => { if (dispBag) dispBag.visible = !!on; },
    setPos,
    createJourneyBox,
    get journeyBox() { return journeyBox; },
  },
});
window.__journey = journey;
journey.start().then(hideLoader); // overlay lifts once the intro is on screen
window.__rendererInfo = () => { // QA: draw calls + instanced stock count
  let inst = 0;
  scene.traverse(o => { if (o.isInstancedMesh) inst += o.count; });
  return { calls: renderer.info.render.calls, tris: renderer.info.render.triangles, instanced: inst };
};
window.__boardInfo = name => { // QA: what material does a named node carry?
  const o = scene.getObjectByName(name);
  if (!o) return null;
  return { type: o.type, mat: o.material?.type, hasMap: !!o.material?.map, color: o.material?.color?.getHexString?.() };
};
window.__scene = scene; // QA hook

// EN/Urdu toggle (top bar). The engine re-renders the current step and
// re-applies the sign boards; the 3D medicine packaging stays printed
// English, exactly like real packs on Pakistani shelves.
let curLang = 'en';
function setLangUI(l) {
  curLang = l;
  journey.setLang(l);
  document.getElementById('langbtn').textContent = l === 'en' ? 'اردو' : 'EN';
}
document.getElementById('langbtn').addEventListener('click', () => setLangUI(curLang === 'en' ? 'ur' : 'en'));
window.__setLang = setLangUI;

window.__ready = true;
