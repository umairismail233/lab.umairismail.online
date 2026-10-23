import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

// ---------- helpers ----------
function canvasTexture(draw, w = 512, h = 256) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.anisotropy = 4; t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
// Sign and label fonts follow the content language: Urdu text needs a
// Nastaliq face and smaller sizes (Nastaliq glyphs run tall).
let SIGN_FONT = 'Segoe UI, Arial';
let SERIF_FONT = 'Georgia';
let UR_SIGNS = false;
const NAME_UR = { 'Ms. Rahman': 'مس رحمان', 'Bilal': 'بلال', 'Sana': 'ثنا', 'Omar': 'عمر', 'Farah': 'فرح', 'Daniyal': 'دانیال', 'Hira': 'حرا', 'Mr. Sheikh': 'مسٹر شیخ', 'Mrs. Sheikh': 'مسز شیخ' };
function signTexture(lines, { bg = '#3730a3', fg = '#ffffff', sub = '#c7d2fe' } = {}) {
  return canvasTexture((g, w, h) => {
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
    const fit = (txt, start) => { let s = start; g.font = `bold ${s}px ${SIGN_FONT}`; while (g.measureText(txt).width > w - 36 && s > 16) { s -= 3; g.font = `bold ${s}px ${SIGN_FONT}`; } };
    if (lines.length === 1) { fit(lines[0], UR_SIGNS ? 40 : 64); g.fillText(lines[0], w / 2, h / 2); }
    else {
      fit(lines[0], UR_SIGNS ? 38 : 58); g.fillText(lines[0], w / 2, h / 2 - 38);
      g.fillStyle = sub; g.font = `${UR_SIGNS ? 25 : 36}px ${SIGN_FONT}`; g.fillText(lines[1], w / 2, h / 2 + 42);
    }
  });
}
function labelSprite(text, color = '#3730a3') {
  const tex = canvasTexture((g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,255,255,0.92)';
    const tw = Math.min(w - 20, 26 + text.length * (UR_SIGNS ? 30 : 21));
    g.beginPath(); g.roundRect((w - tw) / 2, h / 2 - 30, tw, 60, 30); g.fill();
    g.fillStyle = color; g.font = `bold ${UR_SIGNS ? 26 : 34}px ${SIGN_FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, w / 2, h / 2 + 2);
  }, 512, 128);
  const m = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
  const s = new THREE.Sprite(m); s.scale.set(3.3, 0.83, 1); return s;
}
const mat = (color, opts = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.9, metalness: 0.02, envMapIntensity: 0.55, ...opts });
function box(w, h, d, color, x = 0, y = 0, z = 0, opts) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color, opts));
  m.position.set(x, y, z); m.castShadow = false; m.receiveShadow = true; return m;
}
function rbox(w, h, d, r, color, x = 0, y = 0, z = 0, opts) {
  const m = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, r), mat(color, opts));
  m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; return m;
}

// ---------- people ----------
export function makePerson({ skin = 0xc68863, shirt = 0x4f46e5, pants = 0x334155, hair = 0x1f2937, hijab = null, beard = null, hairStyle = 'cap', shoes = 0x292524 } = {}) {
  const g = new THREE.Group();
  // soft contact shadow — grounds the figure on the floor
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.58, 24), new THREE.MeshBasicMaterial({ color: 0x292524, transparent: true, opacity: 0.16, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.02; g.add(shadow);
  // two legs + shoes
  for (const side of [-1, 1]) {
    g.add(box(0.26, 0.72, 0.32, pants, side * 0.17, 0.42, 0));
    g.add(box(0.28, 0.13, 0.5, shoes, side * 0.17, 0.065, 0.07));
  }
  // torso (rounded) + waist band
  g.add(rbox(0.8, 0.88, 0.44, 0.1, shirt, 0, 1.2, 0));
  g.add(box(0.82, 0.1, 0.46, pants, 0, 0.8, 0));
  // arms with hands (pivot at the shoulder)
  const armGeo = new THREE.BoxGeometry(0.19, 0.74, 0.21); armGeo.translate(0, -0.31, 0);
  const mkArm = (side) => {
    const a = new THREE.Mesh(armGeo, mat(shirt)); a.position.set(side * 0.52, 1.56, 0); a.rotation.z = side * -0.06;
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.095, 12, 10), mat(skin)); hand.position.set(0, -0.66, 0); a.add(hand);
    g.add(a); return a;
  };
  const armL = mkArm(-1), armR = mkArm(1);
  // neck + head
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.12, 0.16, 12), mat(skin)); neck.position.y = 1.68; g.add(neck);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.31, 24, 18), mat(skin)); head.position.y = 1.97; g.add(head);
  // face: eyes + gentle smile
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), mat(0x1f2937, { roughness: 0.4 }));
    eye.position.set(side * 0.115, 2.01, 0.275); g.add(eye);
  }
  const smile = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.017, 8, 20, Math.PI), mat(0x7c2d12, { roughness: 0.6 }));
  smile.position.set(0, 1.93, 0.285); smile.rotation.z = Math.PI; g.add(smile);
  if (beard !== null) {
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.21, 16, 12), mat(beard));
    b.scale.set(1.12, 0.78, 0.62); b.position.set(0, 1.83, 0.16); g.add(b);
  }
  if (hijab !== null) {
    const wrap = new THREE.Mesh(new THREE.SphereGeometry(0.355, 24, 18, 0, Math.PI * 2, 0, Math.PI * 0.64), mat(hijab));
    wrap.position.y = 2.02; g.add(wrap);
    g.add(box(0.72, 0.5, 0.54, hijab, 0, 1.62, -0.03));
  } else if (hairStyle === 'cap' || hairStyle === 'bun' || hairStyle === 'grey') {
    const hairM = new THREE.Mesh(new THREE.SphereGeometry(0.325, 24, 18, 0, Math.PI * 2, 0, Math.PI * 0.52), mat(hair));
    hairM.position.y = 2.03; g.add(hairM);
    if (hairStyle === 'bun') {
      const bun = new THREE.Mesh(new THREE.SphereGeometry(0.13, 14, 10), mat(hair));
      bun.position.set(0, 2.3, -0.16); g.add(bun);
    }
  }
  // real-time shadows for body-scale parts (not eyes/smile/contact disc)
  g.traverse(o => {
    if (!o.isMesh) return;
    const p = o.geometry && o.geometry.parameters;
    o.castShadow = !(p && p.radius !== undefined && p.radius < 0.09);
  });
  shadow.castShadow = false;
  g.userData.armL = armL; g.userData.armR = armR; g.userData.head = head;
  return g;
}

// ---------- world ----------
export const STATION_SPOTS = [
  { id: 0, pos: [-13.5, -3.2], stand: [-13.5, 0.8] },   // Lobby - Ms Rahman
  { id: 1, pos: [7.5, -3.4], stand: [7.5, 0.6] },      // Life desk - Bilal
  { id: 2, pos: [19.5, -3.4], stand: [19.5, 0.6] },    // Health & Motor - Sana/Omar
  { id: 3, pos: [-16, 7.6], stand: [-16, 5.0] },       // Compliance - Farah (stand pulled south: the old spot clipped the lobby couch)
  { id: 4, pos: [-5.5, 7.6], stand: [-5.5, 4.4] },     // Claims - Daniyal
  { id: 5, pos: [5, 7.6], stand: [5, 4.4] },           // CRM Lab - Hira
  { id: 6, pos: [15.5, 7.6], stand: [15.5, 4.4], mark: [15.5, 6.8] }, // Finale - Sheikh family (arrow belongs over the meeting desk, not the stand)
];
export const AVATAR_STYLES = [
  { key: 'ahmed', label: 'Ahmed', model: 'male', tint: 0x3d5a80, cfg: { char: 'ahmed', skin: 0xc68863, shirt: 0x4f46e5, pants: 0x334155, hair: 0x1f2937, beard: 0x1f2937, h: 1.03, b: 1.0 } },
  { key: 'fatima', label: 'Fatima · Hijab', model: 'female', tint: null, cfg: { char: 'fatima', skin: 0xa06a42, shirt: 0x0f766e, pants: 0x134e4a, hijab: 0xf59e0b, h: 0.98, b: 1.0 } },
  { key: 'zainab', label: 'Zainab', model: 'female', tint: 0x9a4a38, cfg: { char: 'zainab', skin: 0x8d5a33, shirt: 0xbe185d, pants: 0x1e293b, hair: 0x111827, hairStyle: 'bun', h: 1.0, b: 0.95 } },
];

export function buildWorld(scene, content, characters = null, furniture = null) {
  UR_SIGNS = content.lang === 'ur';
  SIGN_FONT = UR_SIGNS ? '"Noto Nastaliq Urdu", "Urdu Typesetting", serif' : 'Segoe UI, Arial';
  SERIF_FONT = UR_SIGNS ? SIGN_FONT : 'Georgia';
  const dispName = (n) => (UR_SIGNS ? (NAME_UR[n] || n) : n);
  // furniture helper: place a KayKit model (or nothing, when the set didn't load)
  function furn(name, x, z, rotY = 0, sx = 1, sy = null, sz = null, y = 0) {
    if (!furniture) return null;
    const m = furniture.make(name);
    if (!m) return null;
    m.position.set(x, y, z); m.rotation.y = rotY;
    m.scale.set(sx, sy === null ? sx : sy, sz === null ? sx : sz);
    scene.add(m);
    return m;
  }
  const interactables = []; // {kind:'npc', stationId, object3D, label}
  const animated = [];      // update fns (t)

  // lights (environment map in main.js adds soft ambient; these give shape + shadows)
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8a7f70, 0.45));
  const sun = new THREE.DirectionalLight(0xfff2df, 1.5);
  sun.position.set(12, 22, 10);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024); // the map re-renders every frame; 2048 cost ~2x the frame's render work in profiling for no visible gain at this camera distance
  sun.shadow.camera.left = -34; sun.shadow.camera.right = 34;
  sun.shadow.camera.top = 30; sun.shadow.camera.bottom = -30;
  sun.shadow.camera.far = 70; sun.shadow.bias = -0.0004; sun.shadow.radius = 2;
  scene.add(sun);

  // floor: warm office carpet + lobby tile inlay
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(220, 220), mat(0xaebfa4));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -0.03; scene.add(ground); // diorama base
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(64, 22), mat(0xd8cfc0));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; floor.name = 'floor'; scene.add(floor);
  const lobbyFloor = box(17, 0.04, 15, 0xf3ead8, -13.5, 0.02, 0); scene.add(lobbyFloor);
  const hallRunner = box(24, 0.03, 3.2, 0x4f46e5, 13.5, 0.015, 2.6); scene.add(hallRunner);

  // walls
  const wallMat = 0xf5efe3;
  scene.add(box(64, 5.4, 0.4, wallMat, 0, 2.7, -7.2));
  scene.add(box(64, 2.6, 0.4, wallMat, 0, 1.3, 9.2)); // front wall is a low cutaway so south stations stay visible from the camera
  scene.add(box(0.4, 5.4, 17, wallMat, -24.2, 2.7, 1));
  scene.add(box(0.4, 5.4, 17, wallMat, 27.2, 2.7, 1));

  // ==== LOBBY ====
  // reception desk
  scene.add(rbox(5.4, 1.15, 1.5, 0.07, 0x8a6642, -13.5, 0.58, -3.4));
  scene.add(rbox(5.7, 0.12, 1.7, 0.05, 0x5f4630, -13.5, 1.2, -3.4));
  // logo sign on back wall
  const logo = new THREE.Mesh(new THREE.PlaneGeometry(7.6, 2.3), new THREE.MeshBasicMaterial({ map: signTexture([content.company.name, content.company.tagline]) }));
  logo.position.set(-13.2, 3.35, -6.95); scene.add(logo);
  // timeline wall (milestones board, left of lobby)
  const board = new THREE.Mesh(new THREE.PlaneGeometry(6.2, 2.15), new THREE.MeshBasicMaterial({ map: canvasTexture((g, w, h) => {
    g.fillStyle = '#fffdf8'; g.fillRect(0, 0, w, h); g.strokeStyle = '#b45309'; g.lineWidth = 10; g.strokeRect(8, 8, w - 16, h - 16);
    g.fillStyle = '#92400e'; g.textAlign = 'center'; g.font = `bold ${UR_SIGNS ? 34 : 52}px ${SIGN_FONT}`;
    g.fillText(content.signs.journey[0], w / 2, 84);
    g.fillStyle = '#57534e'; g.font = `${UR_SIGNS ? 22 : 34}px ${SIGN_FONT}`;
    g.fillText(content.signs.journey[1], w / 2, 150);
    g.fillText(content.signs.journey[2], w / 2, 205);
  }, 640, 220) }));
  board.position.set(-20.7, 2.7, -6.95); scene.add(board);
  // framed first policy (gold frame box + paper)
  scene.add(box(1.7, 2.1, 0.08, 0xb45309, -6.8, 2.5, -6.95));
  const paper = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 1.7), new THREE.MeshBasicMaterial({ map: canvasTexture((g, w, h) => {
    g.fillStyle = '#fffbe8'; g.fillRect(0, 0, w, h); g.fillStyle = '#78350f'; g.textAlign = 'center';
    g.font = `bold ${UR_SIGNS ? 21 : 30}px ${SERIF_FONT}`; g.fillText(content.signs.policy[0], w / 2, 60);
    g.font = `${UR_SIGNS ? 16 : 22}px ${SERIF_FONT}`; g.fillText(content.company.name, w / 2, 105); g.fillText(content.signs.policy[1], w / 2, 140);
    g.strokeStyle = '#b45309'; g.beginPath(); g.moveTo(30, h - 60); g.lineTo(w - 30, h - 60); g.stroke();
  }, 260, 340) }));
  paper.position.set(-6.8, 2.5, -6.89); scene.add(paper);
  // lobby seating + plant
  if (furniture) {
    furn('rug_rectangle_A', -13.5, 3.35, 0, 1.6, 1, 1.6, 0.05);
    furn('couch', -17.1, 3.55, Math.PI, 0.95);
    furn('couch', -9.9, 3.55, Math.PI, 0.95);
    furn('table_low', -13.5, 3.3, 0, 0.8);
    furn('book_set', -14.9, -3.35, 0.5, 1, 1, 1, 1.51); // on the reception counter (book_set origin is centered)
    furn('lamp_standing', -19.9, -5.3, 0.4, 1);
    furn('cabinet_medium', -21.4, -6.35, 0, 1);
    scene.add(box(0.6, 0.8, 0.6, 0x92400e, -19.5, 0.4, 3.6));
    furn('cactus_medium_A', -19.5, 3.6, 0, 1, 1, 1, 0.78);
  } else {
    for (const dx of [-3.6, 3.6]) {
      scene.add(rbox(2.6, 0.55, 1.1, 0.12, 0x0f766e, -13.5 + dx, 0.45, 3.4));
      scene.add(rbox(2.6, 0.75, 0.28, 0.12, 0x0f766e, -13.5 + dx, 0.95, 3.9));
    }
    scene.add(box(0.6, 0.8, 0.6, 0x92400e, -19.5, 0.4, 3.6));
    const plant = new THREE.Mesh(new THREE.ConeGeometry(0.75, 1.6, 8), mat(0x15803d)); plant.position.set(-19.5, 1.6, 3.6); scene.add(plant);
  }

  // ==== PRODUCT HALL ====
  const hallSign = new THREE.Mesh(new THREE.PlaneGeometry(8.4, 2.1), new THREE.MeshBasicMaterial({ map: signTexture(content.signs.hall, { bg: '#0f766e', sub: '#99f6e4' }) }));
  hallSign.position.set(13.5, 3.9, -6.95); scene.add(hallSign);
  function desk(x, color, title, subtitle) {
    const topY = furniture ? 1.0 : 1.19; // KayKit table top vs box-desk top
    if (furniture) {
      furn('table_medium_long', x, -3.6, 0, 1.35, 1, 0.72);
      furn('chair_A', x + 0.9, -4.42, 0, 1);
    } else {
      scene.add(rbox(4.6, 1.1, 1.5, 0.07, 0x9a7b4f, x, 0.55, -3.6));
      scene.add(rbox(4.9, 0.1, 1.7, 0.05, 0x6d5636, x, 1.14, -3.6));
    }
    const s = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 1.5), new THREE.MeshBasicMaterial({ map: signTexture([title, subtitle], { bg: color }) }));
    s.position.set(x, 2.9, -6.95); scene.add(s);
    // desk props: monitor + file stack
    scene.add(box(0.95, 0.62, 0.06, 0x1e293b, x - 1.2, topY + 0.36, -3.75));
    scene.add(box(0.7, 0.16, 0.5, 0xfef3c7, x + 1.1, topY + 0.08, -3.5));
    scene.add(box(0.6, 0.12, 0.45, 0xdbeafe, x + 1.15, topY + 0.23, -3.5));
  }
  desk(7.5, '#3730a3', content.signs.lifeDesk[0], content.signs.lifeDesk[1]);
  desk(19.5, '#0f766e', content.signs.healthDesk[0], content.signs.healthDesk[1]);
  if (furniture) furn('shelf_B_large_decorated', 13.5, -6.68, 0, 1.15, 1.15, 1.15, 0.1); // low storage shelf on the hall's back wall

  // ==== SOUTH DEPARTMENTS (stations 3-6, front wall) ====
  const southStations = [
    { id: 3, x: -16, color: '#7f1d1d', title: content.signs.south['3'][0], sub: content.signs.south['3'][1] },
    { id: 4, x: -5.5, color: '#b45309', title: content.signs.south['4'][0], sub: content.signs.south['4'][1] },
    { id: 5, x: 5, color: '#0369a1', title: content.signs.south['5'][0], sub: content.signs.south['5'][1] },
    { id: 6, x: 15.5, color: '#0f766e', title: content.signs.south['6'][0], sub: content.signs.south['6'][1] },
  ];
  for (const S of southStations) {
    scene.add(box(4.6, 2.5, 0.25, 0xe7ded0, S.x, 1.25, 9.0)); // doorway backdrop
    const s = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 1.25), new THREE.MeshBasicMaterial({ map: signTexture([S.title, S.sub], { bg: S.color }) }));
    s.position.set(S.x, 1.85, 8.85); s.rotation.y = Math.PI; scene.add(s);
    // desk facing the hall
    const topY = furniture ? 1.0 : 1.19;
    if (furniture) {
      furn('table_medium_long', S.x, 6.8, 0, 1.3, 1, 0.7);
      if (S.id === 4 || S.id === 5) furn('book_set', S.x - 1.5, 6.65, S.id, 1, 1, 1, topY + 0.25);
      if (S.id === 6) { // client armchairs facing the Sheikhs' desk
        furn('armchair', S.x - 1.7, 5.5, 0, 0.55);
        furn('armchair', S.x + 1.7, 5.5, 0, 0.55);
      }
    } else {
      scene.add(rbox(4.4, 1.1, 1.4, 0.07, 0x9a7b4f, S.x, 0.55, 6.8));
      scene.add(rbox(4.7, 0.1, 1.6, 0.05, 0x6d5636, S.x, 1.14, 6.8));
    }
    scene.add(box(0.95, 0.62, 0.06, 0x1e293b, S.x - 1.2, topY + 0.36, 6.95));
    scene.add(box(0.7, 0.16, 0.5, 0xfef3c7, S.x + 1.1, topY + 0.08, 6.7));
  }

  // ==== NPCs ====
  const npcDefs = [
    { stationId: 0, name: 'Ms. Rahman', model: 'female', tint: null, cfg: { char: 'rahman', skin: 0xa06a42, shirt: 0xb45309, pants: 0x3730a3, hijab: 0x3730a3, h: 1.02, b: 1.0 }, pos: [-13.5, -4.6], rotY: 0 },
    { stationId: 1, name: 'Bilal', model: 'male', tint: 0x3d5a80, cfg: { char: 'bilal', skin: 0xc68863, shirt: 0x3730a3, pants: 0x1e293b, hair: 0x111827, beard: 0x111827, h: 1.05, b: 1.03 }, pos: [7.5, -4.8], rotY: 0 },
    { stationId: 2, name: 'Sana', model: 'female', tint: null, cfg: { char: 'sana', skin: 0x8d5a33, shirt: 0x0f766e, pants: 0x44403c, hijab: 0xbe185d, h: 0.97, b: 0.97 }, pos: [18.2, -4.8], rotY: 0 },
    { stationId: 2, name: 'Omar', model: 'male', tint: 0x2a9d8f, cfg: { char: 'omar', skin: 0xd9a066, shirt: 0x0369a1, pants: 0x334155, hair: 0x1f2937, h: 1.0, b: 1.01 }, pos: [20.9, -4.8], rotY: 0 },
    { stationId: 3, name: 'Farah', model: 'female', tint: null, cfg: { char: 'farah', skin: 0xa06a42, shirt: 0x7f1d1d, pants: 0x292524, hijab: 0x991b1b, h: 1.03, b: 0.98 }, pos: [-16, 7.7], rotY: Math.PI },
    { stationId: 4, name: 'Daniyal', model: 'male', tint: 0x78716c, cfg: { char: 'daniyal', skin: 0x8d5a33, shirt: 0x334155, pants: 0x1e293b, hair: 0x111827, beard: 0x111827, h: 0.96, b: 1.04 }, pos: [-5.5, 7.7], rotY: Math.PI },
    { stationId: 5, name: 'Hira', model: 'female', tint: null, cfg: { char: 'hira', skin: 0xc68863, shirt: 0x0369a1, pants: 0x334155, hair: 0x111827, hairStyle: 'bun', h: 0.99, b: 0.96 }, pos: [5, 7.7], rotY: Math.PI },
    { stationId: 6, name: 'Mr. Sheikh', model: 'male', tint: 0xb8a88f, cfg: { char: 'mr_sheikh', skin: 0xd9a066, shirt: 0xe7e0cf, pants: 0xe7e0cf, hair: 0xd6d3d1, hairStyle: 'grey', beard: 0xd6d3d1, h: 0.98, b: 1.02 }, pos: [14.2, 7.7], rotY: Math.PI },
    { stationId: 6, name: 'Mrs. Sheikh', model: 'female', tint: null, cfg: { char: 'mrs_sheikh', skin: 0xa06a42, shirt: 0x9d6b4f, pants: 0x713f12, hijab: 0xd6c9a8, h: 0.94, b: 1.02 }, pos: [16.9, 7.7], rotY: Math.PI },
  ];
  const charInstances = [];
  const npcChars = {}; // stationId -> [character instances]
  const nameTags = []; // every NPC name sprite, so dialogue can hide them all
  for (const d of npcDefs) {
    let p, charInst = null;
    if (characters) { charInst = characters.make(d.model, d.cfg); if (charInst) p = charInst.group; }
    if (!p) p = makePerson(d.cfg);
    p.position.set(d.pos[0], 0, d.pos[1]); p.rotation.y = d.rotY; // face the player area
    const tag = labelSprite(dispName(d.name)); tag.position.y = charInst ? charInst.labelY : 2.55; p.add(tag);
    nameTags.push(tag);
    scene.add(p);
    interactables.push({ kind: 'npc', stationId: d.stationId, object3D: p });
    if (charInst) {
      charInstances.push(charInst);
      (npcChars[d.stationId] = npcChars[d.stationId] || []).push(charInst);
    } else {
      const phase = Math.random() * Math.PI * 2;
      p.userData.headBaseY = p.userData.head.position.y;
      animated.push((t) => {
        const s = Math.sin(t * 1.6 + phase);
        p.userData.armL.rotation.x = s * 0.07; p.userData.armR.rotation.x = -s * 0.07;
        p.userData.head.position.y = p.userData.headBaseY + Math.sin(t * 1.3 + phase) * 0.022; // gentle idle head-bob — the office feels alive
        p.position.y = Math.abs(Math.sin(t * 1.6 + phase)) * 0.02;
      });
    }
  }
  // NPC mixers step at half rate (every other frame, dt accumulated): nine
  // idle rigs do not need 60 Hz bone updates, and this halves their CPU cost.
  // The player's own mixer stays full-rate in main.js.
  let npcAcc = 0, npcHalf = false;
  function updateCharacters(dt) {
    npcAcc += dt; npcHalf = !npcHalf;
    if (npcHalf) return;
    const step = npcAcc; npcAcc = 0;
    for (const c of charInstances) c.update(step);
  }
  function npcReact(stationId) { const arr = npcChars[stationId]; if (arr && arr[0]) arr[0].react(); }

  // interaction rings at station stands
  const rings = {}; const nextRef = { id: null };
  for (const s of STATION_SPOTS) {
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.65, 0.85, 32), new THREE.MeshBasicMaterial({ color: 0xf59e0b, transparent: true, opacity: 0.85, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2; ring.position.set(s.stand[0], 0.06, s.stand[1]); ring.name = 'ring-' + s.id;
    scene.add(ring); rings[s.id] = ring;
    animated.push((t) => {
      const isNext = nextRef.id === s.id;
      const k = isNext ? 1 + Math.sin(t * 3.4) * 0.2 : 1 + Math.sin(t * 2.4) * 0.08;
      ring.scale.set(k, k, 1);
      ring.material.opacity = isNext ? 0.75 + Math.sin(t * 3.4) * 0.25 : 0.85;
    });
  }

  // guided NEXT chevron — bobs above the next recommended station
  const chevron = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.85, 4), new THREE.MeshBasicMaterial({ color: 0xf59e0b }));
  chevron.rotation.x = Math.PI; chevron.visible = false; scene.add(chevron);
  animated.push((t) => { if (chevron.visible) { chevron.position.y = 3.7 + Math.sin(t * 2.2) * 0.22; chevron.rotation.y = t * 1.4; } });
  function setNextStation(id) {
    nextRef.id = id;
    const s = STATION_SPOTS.find(x => x.id === id);
    if (!s) { chevron.visible = false; return; }
    const m = s.mark || s.stand; // a station may mark its desk instead of its stand spot
    chevron.position.set(m[0], 3.7, m[1]); chevron.visible = true;
  }
  // Name tags are translucent sprites: while a dialogue panel fades in they
  // show through it and confuse the eye (audit minor b). main.js hides them
  // for the length of a station visit and restores them after.
  function setNameTagsVisible(v) { for (const t of nameTags) t.visible = v; }

  return { interactables, animated, floorName: 'floor', setNextStation, updateCharacters, npcReact, setNameTagsVisible };
}
