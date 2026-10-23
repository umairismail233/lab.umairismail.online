import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { buildWorld, makePerson, STATION_SPOTS, AVATAR_STYLES } from './world.js';
import { showDialogue, toast, renderHandbook, renderStationsMenu, renderReport, summaryText, totalStars, setStrings as setUiStrings } from './ui.js';
import { missionTimeline, missionMatchClients, missionCovered, missionRedFlags, missionClaimJourney, missionCRM, missionFinale, starsFor, setStrings as setMissionStrings } from './missions.js';
import { loadCharacters } from './characters.js';
import { loadFurniture } from './furniture.js';

const $ = (id) => document.getElementById(id);
const SAVE_KEY = 'firstPolicySaveV1';
const MISSIONS = { 0: missionTimeline, 1: missionMatchClients, 2: missionCovered, 3: missionRedFlags, 4: missionClaimJourney, 5: missionCRM, 6: missionFinale };

let content = null;
let state = freshState();
let sessionStart = null; // Date.now() when active play began
let muted = false;

function freshState() { return { name: '', avatar: 'ahmed', stations: {}, elapsed: 0, started: false }; }
function save() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch (e) { /* private mode */ } }
function load() { try { const s = JSON.parse(localStorage.getItem(SAVE_KEY)); if (s && s.name && s.started) return { ...freshState(), ...s }; } catch (e) {} return null; }
function elapsedNow() { return state.elapsed + (sessionStart ? (Date.now() - sessionStart) / 1000 : 0); }

// ---------- tiny synth sfx ----------
let actx = null;
function sfx(kind) {
  if (muted) return;
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    if (actx.state === 'suspended') actx.resume();
    const notes = kind === 'good' ? [523, 784] : kind === 'bad' ? [196] : [660];
    notes.forEach((f, i) => {
      const o = actx.createOscillator(), g = actx.createGain();
      o.type = 'sine'; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, actx.currentTime + i * 0.09);
      g.gain.exponentialRampToValueAtTime(0.12, actx.currentTime + i * 0.09 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + i * 0.09 + 0.22);
      o.connect(g); g.connect(actx.destination); o.start(actx.currentTime + i * 0.09); o.stop(actx.currentTime + i * 0.09 + 0.25);
    });
  } catch (e) { /* audio unavailable */ }
}

// ---------- celebration (canvas-confetti, if loaded) ----------
function celebrate(big) {
  if (!window.confetti) return;
  const base = { colors: ['#4f46e5', '#f59e0b', '#0f766e', '#ffffff'], zIndex: 200, disableForReducedMotion: true };
  if (big) {
    window.confetti({ ...base, particleCount: 170, spread: 105, origin: { y: 0.7 } });
    setTimeout(() => window.confetti({ ...base, particleCount: 90, angle: 60, spread: 70, origin: { x: 0, y: 0.8 } }), 200);
    setTimeout(() => window.confetti({ ...base, particleCount: 90, angle: 120, spread: 70, origin: { x: 1, y: 0.8 } }), 380);
  } else {
    window.confetti({ ...base, particleCount: 55, spread: 60, startVelocity: 32, origin: { y: 0.75 } });
  }
  // The confetti canvas floats above the HUD; it must never eat a click
  // (a falling-confetti canvas once covered a button for a player, audit B1).
  setTimeout(() => document.querySelectorAll('canvas').forEach(c => { if (c.id !== 'scene') c.style.pointerEvents = 'none'; }), 0);
}

// ---------- three setup ----------
const canvas = $('scene');
const LITE = new URLSearchParams(location.search).has('lite'); // QA-only: lighter rendering for software-GPU test rigs
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(LITE ? 1 : Math.min(devicePixelRatio, 1.5));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = !LITE;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.setClearColor(0x000000, 0); // page gradient sky shows through
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xdfe9f7, 55, 95);
// soft studio-style environment light (Three.js RoomEnvironment) — richer materials
try {
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();
} catch (e) { /* environment is a bonus, never a blocker */ }
const camera = new THREE.PerspectiveCamera(46, innerWidth / innerHeight, 0.1, 200);

let world = null, player = null;
let characters = null, playerChar = null; // glTF character assets + the player's animated instance (null = primitive fallback)
let furniture = null; // KayKit furniture set (null = box-furniture fallback)
// Language: ?lang= wins, then the saved choice, then English. All game text
// lives in the content file for the chosen language (see applyLanguage).
const LANG = new URLSearchParams(location.search).get('lang') || localStorage.getItem('fpLang') || 'en';
const T = (s, vars) => String(s || '').replace(/\{(\w+)\}/g, (_, k) => (vars && vars[k] !== undefined ? vars[k] : ''));
const LOAD_FAIL = {
  en: { btn: 'Content failed to load', err: '⚠️ The office could not load its content file. If you opened this page by double clicking the file, please run it through a local server instead, or open the live version.' },
  ur: { btn: 'مواد لوڈ نہیں ہو سکا', err: '⚠️ آفس اپنی مواد والی فائل لوڈ نہیں کر سکا۔ اگر آپ نے یہ صفحہ فائل پر ڈبل کلک کر کے کھولا ہے تو براہ کرم اسے لوکل سرور سے چلائیں، یا لائیو ورژن کھولیں۔' },
};
// Spawn on open lobby floor. The old spot (z 2.6) stood the avatar inside
// the coffee table between the couches, at check-in and on Continue alike.
const SPAWN = new THREE.Vector3(-11.6, 0, 1.5);
const playerPos = SPAWN.clone();
// Glide speed matched to the walk clip's stride: the clip's feet only cover
// ~1.0 u/s of ground (measured in-engine: ~85% foot-drag at the old 6.5 u/s),
// so the avatar skated while its legs ambled — the "straining" walk. At
// 3.4 u/s with the clip sped up in characters.js (WALK_TIME_SCALE) the feet
// plant on the ground they cross.
const MOVE_SPEED = 3.4;
let walkTarget = null, pendingStation = null, busy = false;
const kbVec = new THREE.Vector3(), walkVec = new THREE.Vector3(); // walk-loop scratch (no per-frame allocation)
const clock = new THREE.Clock();
// buttery camera state (Pack A): damped position + smoothed look target with velocity look-ahead
const prevPos = playerPos.clone();
const smoothLook = new THREE.Vector3(playerPos.x, 1.0, playerPos.z - 1.6);
const lookGoal = new THREE.Vector3(), tmpVel = new THREE.Vector3();
let mapTimer = 0;

function spawnPlayer(styleKey) {
  if (player) scene.remove(player);
  const style = AVATAR_STYLES.find(a => a.key === styleKey) || AVATAR_STYLES[0];
  playerChar = characters ? characters.make(style.model, style.cfg) : null;
  player = playerChar ? playerChar.group : makePerson(style.cfg);
  player.position.copy(playerPos);
  scene.add(player);
}

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
function onTap(ev) {
  if (busy || !player || !state.started) return;
  const x = (ev.clientX / innerWidth) * 2 - 1, y = -(ev.clientY / innerHeight) * 2 + 1;
  pointer.set(x, y); raycaster.setFromCamera(pointer, camera);
  // interactables first
  for (const it of world.interactables) {
    const hits = raycaster.intersectObject(it.object3D, true);
    if (hits.length) { handleInteract(it); return; }
  }
  const floor = scene.getObjectByName('floor');
  const hit = raycaster.intersectObject(floor)[0];
  if (hit) { walkTarget = new THREE.Vector3(hit.point.x, 0, hit.point.z); pendingStation = null; hideHint(); }
}
function handleInteract(it) {
  if (it.kind === 'locked') {
    const s = content.stations[it.stationId];
    toast(`🔒 ${s.name}. ${content.ui.openingSoon}`);
    return;
  }
  const spot = STATION_SPOTS.find(s => s.id === it.stationId);
  walkTarget = new THREE.Vector3(spot.stand[0], 0, spot.stand[1]);
  pendingStation = it.stationId;
  showHint(content.ui.walkingTo.replace('{name}', content.stations[it.stationId].name));
}
canvas.addEventListener('pointerdown', onTap);

const keys = {};
addEventListener('keydown', e => { keys[e.key.toLowerCase()] = true; });
addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });

function showHint(t) { const h = $('hint'); h.textContent = t; h.classList.remove('hidden'); }
function hideHint() { $('hint').classList.add('hidden'); }
// After a station, the hint re-aims at the next one (it used to keep its
// first-day text for the whole game, audit B2). No next station, no hint.
function refreshHint() {
  const nx = nextStation();
  if (nx && content && content.ui.hintNext) showHint(T(content.ui.hintNext, { name: nx.name }));
  else hideHint();
}

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime;
  if (world) for (const fn of world.animated) fn(t);
  if (world && world.updateCharacters) world.updateCharacters(dt);
  if (playerChar) playerChar.update(dt);
  if (player) {
    // WASD
    const kb = kbVec.set(
      (keys['d'] || keys['arrowright'] ? 1 : 0) - (keys['a'] || keys['arrowleft'] ? 1 : 0), 0,
      (keys['s'] || keys['arrowdown'] ? 1 : 0) - (keys['w'] || keys['arrowup'] ? 1 : 0));
    if (kb.lengthSq() > 0 && !busy) { walkTarget = null; pendingStation = null; kb.normalize(); playerPos.addScaledVector(kb, dt * MOVE_SPEED); clampPos(); faceDir(kb); bob(t, true); }
    else if (walkTarget) {
      const to = walkVec.copy(walkTarget).sub(playerPos); to.y = 0;
      const dist = to.length();
      if (dist < 0.25) {
        walkTarget = null; bob(t, false);
        if (pendingStation !== null) { const id = pendingStation; pendingStation = null; hideHint(); startStation(id); }
      } else { to.normalize(); playerPos.addScaledVector(to, dt * MOVE_SPEED); faceDir(to); bob(t, true); }
    } else bob(t, false);
    player.position.copy(playerPos);
    // buttery follow (Gitlantis-style): frame-rate-independent damping + velocity look-ahead
    tmpVel.copy(playerPos).sub(prevPos).divideScalar(Math.max(dt, 0.001)); prevPos.copy(playerPos);
    const kp = 1 - Math.pow(0.002, dt);
    camera.position.x += (playerPos.x - camera.position.x) * kp;
    camera.position.y += (9.8 - camera.position.y) * kp;
    camera.position.z += (playerPos.z + 11.4 - camera.position.z) * kp;
    lookGoal.set(
      playerPos.x + THREE.MathUtils.clamp(tmpVel.x * 0.22, -1.6, 1.6), 1.0,
      playerPos.z - 1.6 + THREE.MathUtils.clamp(tmpVel.z * 0.22, -1.2, 1.2));
    smoothLook.lerp(lookGoal, 1 - Math.pow(0.0005, dt));
    camera.lookAt(smoothLook);
    mapTimer += dt;
    if (mapTimer > 0.15) { mapTimer = 0; drawMinimap(t); }
  }
  renderer.render(scene, camera);
}

// ---------- minimap (Pack B) ----------
function drawMinimap(t) {
  if (!content || !state.started || $('hud').classList.contains('hidden')) return;
  const cv = $('minimap'); if (!cv) return;
  const ctx = cv.getContext('2d'), W = cv.width, H = cv.height;
  const mx = (x) => (x + 26) / 55 * W, mz = (z) => (z + 8.6) / 18.6 * H;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#f4efe4'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#ddd6fe'; ctx.fillRect(mx(-2.4), 0, (4.8 / 55) * W, H); // carpet aisle
  ctx.strokeStyle = '#cbd5e1'; ctx.strokeRect(1, 1, W - 2, H - 2);
  const nx = nextStation();
  for (const s of STATION_SPOTS) {
    const done = state.stations[s.id]?.done;
    const isNext = nx && nx.id === s.id;
    ctx.beginPath();
    ctx.arc(mx(s.pos[0]), mz(s.pos[1]), isNext ? 5 + Math.sin(t * 4) * 1.4 : 4, 0, Math.PI * 2);
    ctx.fillStyle = done ? '#16a34a' : isNext ? '#f59e0b' : '#4f46e5';
    ctx.fill();
    ctx.lineWidth = 1.6; ctx.strokeStyle = '#ffffff'; ctx.stroke();
  }
  ctx.beginPath(); ctx.arc(mx(playerPos.x), mz(playerPos.z), 4.2, 0, Math.PI * 2);
  ctx.fillStyle = '#1e293b'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = '#ffffff'; ctx.stroke();
}
function clampPos() {
  playerPos.x = THREE.MathUtils.clamp(playerPos.x, -23.4, 26.4);
  playerPos.z = THREE.MathUtils.clamp(playerPos.z, -6.2, 8.2);
}
function faceDir(dir) {
  const target = Math.atan2(dir.x, dir.z);
  player.rotation.y += ((((target - player.rotation.y) % (Math.PI * 2)) + Math.PI * 3) % (Math.PI * 2) - Math.PI) * 0.2;
}
function bob(t, moving) {
  if (!player) return;
  if (playerChar) { playerChar.setMoving(moving); return; }
  const s = moving ? Math.sin(t * 9) : 0;
  player.userData.armL.rotation.x = s * 0.5; player.userData.armR.rotation.x = -s * 0.5;
  player.position.y = moving ? Math.abs(Math.sin(t * 9)) * 0.05 : 0;
}
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// ---------- station flow ----------
async function startStation(id) {
  if (busy) return;
  const station = content.stations[id];
  if (station.locked) { toast(`🔒 ${station.name}. ${content.ui.openingSoon}`); return; }
  busy = true;
  hideHint(); // the hint never sits under a dialogue or mission panel (audit B2)
  if (world && world.setNameTagsVisible) world.setNameTagsVisible(false); // tags must not show through dialogue (audit minor b)
  try {
    if (world && world.npcReact) world.npcReact(id); // the mentor nods along as the conversation opens
    const already = state.stations[id]?.done;
    if (already) {
      await showDialogue([{ speaker: station.intro[0].speaker, text: T(content.ui.replayLine, { name: state.name.split(' ')[0], stars: state.stations[id].stars }) }], sfx);
    } else {
      await showDialogue(station.intro, sfx);
    }
    const { errors } = await MISSIONS[id](station, sfx);
    const stars = starsFor(errors);
    const best = Math.max(stars, state.stations[id]?.stars || 0);
    state.stations[id] = { done: true, stars: best, errors };
    save(); updateHUD();
    sfx('good');
    await showDialogue([{ speaker: station.intro[0].speaker, text: station.success }], sfx);
    toast(`${T(content.ui.badgeToast, { badge: station.badge })} ${'⭐'.repeat(best)}`);
    celebrate(id === 6);
  } catch (e) {
    console.error('station failed', e); // a failed station must never wedge the input lock
  } finally {
    // The busy lock ALWAYS clears and the name tags ALWAYS come back, even
    // if a dialogue or mission threw halfway (audit B1).
    busy = false;
    if (world && world.setNameTagsVisible) world.setNameTagsVisible(true);
  }
  maybeReport();
  refreshHint();
}
function playableDone() { return content.stations.filter(s => !s.locked).every(s => state.stations[s.id]?.done); }
function maybeReport() {
  if (playableDone() && !state.reportShown) {
    state.reportShown = true; save();
    setTimeout(() => openReport(), 600);
  } else if (playableDone()) {
    toast(content.ui.reportReadyToast);
    setTimeout(() => openReport(), 600);
  }
}
function openReport() {
  renderReport(state, content, elapsedNow());
  $('report').classList.remove('hidden');
  popScreen('report');
}
function popScreen(id) {
  if (!window.gsap) return;
  const card = $(id).querySelector('.panel-card, .report-card, .menu-card, .handbook-card') || $(id).firstElementChild;
  if (card) window.gsap.fromTo(card, { y: 18, opacity: 0, scale: .99 }, { y: 0, opacity: 1, scale: 1, duration: .32, ease: 'power3.out' });
}

// ---------- HUD ----------
function nextStation() {
  if (!content) return null;
  return content.stations.find(s => !s.locked && !state.stations[s.id]?.done) || null;
}
function updateHUD() {
  const done = content.stations.filter(s => !s.locked && state.stations[s.id]?.done).length;
  const total = content.stations.filter(s => !s.locked).length;
  $('hud-progress').textContent = T(content.ui.progressOfDay, { pct: Math.round(done / total * 100) });
  $('hud-stars').textContent = `⭐ ${totalStars(state)}`;
  // objective pill (Pack B): always answers "what next?"
  const nx = nextStation(), pill = $('objective-pill');
  if (nx) {
    pill.classList.remove('hidden');
    pill.textContent = T(content.ui.nextPill, { name: nx.name, mentor: nx.mentor });
    pill.dataset.station = nx.id;
  } else {
    pill.classList.remove('hidden');
    pill.textContent = content.ui.dayCompletePill;
    pill.dataset.station = '';
  }
  if (world && world.setNextStation) world.setNextStation(nx ? nx.id : null);
}
$('objective-pill').onclick = () => {
  if (busy) { if (content && content.ui.busyToast) toast(content.ui.busyToast); return; } // say why, never refuse silently (audit B1)
  const v = $('objective-pill').dataset.station;
  sfx('click');
  if (v === '') { openReport(); return; }
  const id = Number(v);
  const spot = STATION_SPOTS.find(s => s.id === id);
  playerPos.set(spot.stand[0], 0, spot.stand[1]); walkTarget = null;
  startStation(id);
};
setInterval(() => {
  if (!state.started) return;
  const e = Math.floor(elapsedNow());
  $('hud-timer').textContent = `⏱ ${Math.floor(e / 60)}:${String(e % 60).padStart(2, '0')}`;
  state.elapsed = e; sessionStart = Date.now(); save();
}, 5000);

// ---------- boot ----------
function setLoad(p, label) {
  const bar = $('load-bar'), pct = $('load-pct'), lt = $('load-label-text');
  if (bar) bar.style.width = p + '%';
  if (pct) pct.textContent = p + '%';
  if (lt && label) lt.textContent = label;
}
function applyLanguage() {
  const U = content.ui, ur = content.lang === 'ur';
  document.documentElement.lang = content.lang;
  document.body.classList.toggle('lang-ur', ur);
  for (const id of ['dialogue', 'mission', 'handbook', 'stations-menu', 'report', 'checkin-screen', 'start-screen', 'toast', 'hint', 'objective-pill'])
    { const el = $(id); if (el) el.setAttribute('dir', ur ? 'rtl' : 'ltr'); }
  document.querySelector('.start-sub').textContent = U.subtitle;
  document.querySelector('.start-desc').innerHTML = U.startDesc;
  document.querySelector('.start-note').textContent = U.startNote;
  document.querySelectorAll('.key-chip').forEach((c, i) => { if (U.chips[i]) c.textContent = U.chipIcons[i] + ' ' + U.chips[i]; });
  $('btn-start').textContent = U.loadingOffice;
  $('btn-continue').textContent = U.continueDay;
  $('btn-stations').textContent = U.stationsBtn;
  $('btn-handbook').textContent = U.handbookBtn;
  $('hud-timer').title = U.timerTitle; $('hud-stars').title = U.starsTitle; $('btn-mute').title = U.muteTitle;
  $('objective-pill').title = U.pillTitle;
  document.querySelector('.minimap-label').textContent = U.minimapLabel;
  document.querySelector('#handbook .panel-head h2').textContent = U.handbookTitle;
  document.querySelectorAll('#handbook h3').forEach((h, i) => { h.textContent = [U.handbookObjectives, U.handbookBadges, U.handbookGlossary][i] || h.textContent; });
  document.querySelector('#stations-menu .panel-head h2').textContent = U.stationsTitle;
  document.querySelector('#stations-menu .panel-sub').textContent = U.stationsSub;
  document.querySelectorAll('[data-close]').forEach(b => { b.textContent = U.close; });
  $('report-title').textContent = U.reportTitle;
  $('btn-print').textContent = U.print; $('btn-copy').textContent = U.copySummary; $('btn-roam').textContent = U.keepExploring;
  const m0 = content.stations[0];
  document.querySelector('#checkin-screen .dlg-name').textContent = m0.mentor;
  document.querySelector('#checkin-screen .dlg-role').textContent = m0.mentorRole;
  const w = m0.mentor.split(/\s+/);
  document.querySelector('#checkin-screen .dlg-avatar').textContent = (w[w.length - 1] || '?').charAt(0);
  for (const id of ['btn-lang', 'btn-lang-hud']) { const b = $(id); if (b) b.textContent = U.langToggle; }
  setUiStrings(content); setMissionStrings(content);
}
function switchLanguage() {
  const next = LANG === 'ur' ? 'en' : 'ur';
  try { localStorage.setItem('fpLang', next); } catch (e) { /* private mode */ }
  const u = new URL(location.href); u.searchParams.delete('lang');
  location.href = u.toString();
}

async function boot() {
  setLoad(14, LANG === 'ur' ? 'آفس لوڈ ہو رہا ہے…' : 'Loading the office…');
  try {
    const res = await fetch(LANG === 'ur' ? 'content/game-content.ur.json' : 'content/game-content.json');
    if (!res.ok) throw new Error('HTTP ' + res.status);
    content = await res.json();
  } catch (e) {
    $('start-error').classList.remove('hidden');
    $('start-error').innerHTML = (LOAD_FAIL[LANG] || LOAD_FAIL.en).err;
    $('btn-start').textContent = (LOAD_FAIL[LANG] || LOAD_FAIL.en).btn;
    return;
  }
  applyLanguage();
  const LS = content.ui.loadSteps;
  setLoad(40, LS.team);
  // Characters and furniture load at the same time, and each loader fetches
  // its files in parallel now. The old chain (team, then furniture, every
  // file one by one) kept Start locked for 30 s or more on real hosting,
  // and for minutes after a language switch if the CDN hiccuped (SF4/B1).
  let cp = 0, fp = 0;
  const updLoad = () => setLoad(40 + Math.round((cp + fp) / 2 * 36), cp < 1 ? LS.team : LS.furniture);
  const charsP = loadCharacters(p => { cp = p; updLoad(); }).catch(() => null); // models unreachable: primitive people step in
  const furnP = loadFurniture(p => { fp = p; updLoad(); }).catch(() => null); // furniture unreachable: the box furniture stays
  [characters, furniture] = await Promise.all([charsP, furnP]);
  setLoad(80, LS.desks);
  world = buildWorld(scene, content, characters, furniture);
  camera.position.set(playerPos.x, 9.8, playerPos.z + 11.4);
  camera.lookAt(playerPos.x, 1.0, playerPos.z - 1.6);
  animate();
  setLoad(88, LS.lobby);

  const qa = new URLSearchParams(location.search).get('screen');
  if (qa) return qaMode(qa);

  const existing = load();
  if (existing) { $('btn-continue').classList.remove('hidden'); }
  // Penthouse-style reveal: the CTA appears only when everything is truly ready
  requestAnimationFrame(() => setTimeout(() => {
    setLoad(100, T(content.ui.loadSteps.ready, { company: content.company.short }));
    setTimeout(() => $('load-wrap').classList.add('hidden'), 500);
    $('btn-start').disabled = false; $('btn-start').textContent = content.ui.startBtn;
    window.__FP_READY = true;
    if (window.gsap) window.gsap.fromTo('#btn-start', { scale: .9, opacity: .4 }, { scale: 1, opacity: 1, duration: .45, ease: 'back.out(2)' });
  }, 120));
  $('btn-start').onclick = () => { sfx('click'); startCheckin(); };
  $('btn-continue').onclick = () => {
    sfx('click'); state = existing; sessionStart = Date.now();
    $('start-screen').classList.add('hidden');
    spawnPlayer(state.avatar); $('hud').classList.remove('hidden'); updateHUD();
    toast(T(content.ui.welcomeBack, { name: state.name.split(' ')[0] }));
    showHint(content.ui.hintContinue);
  };
}
function startCheckin() {
  $('start-screen').classList.add('hidden');
  $('checkin-screen').classList.remove('hidden');
  $('checkin-ask').textContent = content.checkin.askName;
  $('checkin-ask2').textContent = content.checkin.askAvatar;
  $('checkin-name').placeholder = content.checkin.namePlaceholder;
  $('btn-checkin').textContent = content.checkin.confirm;
  const row = $('avatar-row'); row.innerHTML = '';
  AVATAR_STYLES.forEach((a, i) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'avatar-pick'; b.setAttribute('role', 'radio');
    b.setAttribute('aria-checked', i === 0 ? 'true' : 'false');
    b.innerHTML = `<span class="avatar-swatch" style="background:#${a.cfg.shirt.toString(16).padStart(6, '0')}"></span>${content.ui.avatarLabels[i] || a.label}`;
    b.onclick = () => { row.querySelectorAll('.avatar-pick').forEach(x => x.setAttribute('aria-checked', 'false')); b.setAttribute('aria-checked', 'true'); row.dataset.pick = a.key; sfx('click'); };
    row.appendChild(b);
  });
  row.dataset.pick = AVATAR_STYLES[0].key;
  $('btn-checkin').onclick = () => {
    const name = $('checkin-name').value.trim();
    if (!name) { $('checkin-name').focus(); $('checkin-name').style.borderColor = '#dc2626'; return; }
    state = freshState(); state.name = name; state.avatar = row.dataset.pick; state.started = true;
    sessionStart = Date.now(); save();
    $('checkin-screen').classList.add('hidden');
    spawnPlayer(state.avatar); $('hud').classList.remove('hidden'); updateHUD();
    sfx('good');
    toast(T(content.ui.badgePrinted, { name, company: content.company.name }));
    showHint(content.ui.hintStart);
  };
}

// header/panel wiring
$('btn-handbook').onclick = () => { renderHandbook(state, content); $('handbook').classList.remove('hidden'); popScreen('handbook'); sfx('click'); };
$('btn-stations').onclick = () => {
  renderStationsMenu(state, content, (id) => {
    if (busy) { toast(content.ui.busyToast || 'Finish this conversation first, then we will go.'); return; } // a station cannot start mid-conversation; say so instead of a silent no-op (audit B1)
    const spot = STATION_SPOTS.find(s => s.id === id);
    playerPos.set(spot.stand[0], 0, spot.stand[1]); walkTarget = null;
    startStation(id);
  });
  $('stations-menu').classList.remove('hidden'); popScreen('stations-menu'); sfx('click');
};
$('btn-mute').onclick = (e) => { muted = !muted; e.target.textContent = muted ? '🔇' : '🔊'; };
document.querySelectorAll('[data-close]').forEach(b => b.onclick = () => $(b.dataset.close).classList.add('hidden'));
$('btn-print').onclick = () => window.print();
$('btn-copy').onclick = async () => { try { await navigator.clipboard.writeText(summaryText(state, content, elapsedNow())); toast(content.ui.copyOk); } catch (e) { toast(content.ui.copyBlocked); } };
$('btn-lang').onclick = switchLanguage;
$('btn-lang-hud').onclick = switchLanguage;
$('btn-roam').onclick = () => $('report').classList.add('hidden');

// ---------- QA / screenshot mode ----------
function qaMode(screen) {
  $('start-screen').classList.add('hidden');
  state = freshState(); state.name = 'Ayesha Khan'; state.avatar = 'fatima'; state.started = true;
  state.elapsed = 754; sessionStart = null;
  spawnPlayer(state.avatar); $('hud').classList.remove('hidden');
  window.__FP_READY = true;
  if (screen === 'checkin') { $('hud').classList.add('hidden'); startCheckin(); $('checkin-name').value = 'Ayesha Khan'; return; }
  if (screen === 'south') { // free-roam view of the south departments row
    playerPos.set(STATION_SPOTS[6].stand[0], 0, STATION_SPOTS[6].stand[1]); if (player) player.position.copy(playerPos);
    showHint('The south departments: Compliance · Claims · CRM Lab · Client Meetings.');
    return;
  }
  if (screen === 'game' || screen === 'dialogue') {
    playerPos.copy(SPAWN); if (player) player.position.copy(playerPos);
    updateHUD(); // shows objective pill + NEXT chevron exactly as real play does
    if (screen === 'dialogue') showDialogue(content.stations[0].intro, sfx);
    showHint(content.ui.hintMission);
    return;
  }
  if (screen.startsWith('mission')) {
    const id = Number(screen.slice(-1));
    playerPos.set(STATION_SPOTS[id].stand[0], 0, STATION_SPOTS[id].stand[1]); if (player) player.position.copy(playerPos);
    MISSIONS[id](content.stations[id], () => {});
    return;
  }
  if (screen === 'handbook' || screen === 'report') {
    state.stations = { 0: { done: true, stars: 3 }, 1: { done: true, stars: 2 }, 2: { done: true, stars: 3 }, 3: { done: true, stars: 3 }, 4: { done: true, stars: 2 }, 5: { done: true, stars: 3 }, 6: { done: true, stars: 3 } };
    updateHUD();
    if (screen === 'handbook') { renderHandbook(state, content); $('handbook').classList.remove('hidden'); }
    else openReport();
    return;
  }
}

boot();
