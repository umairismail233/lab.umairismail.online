// touch.js. Landscape mobile touch controls: left joystick, right look area, action buttons.
// Layout edit mode: drag any button or the stick to move it, SAVE persists the
// positions to localStorage, RESET restores the CSS defaults.
const LAYOUT_KEY = 'to-touch-layout-v1';
const DRAGGABLE = ['stick', 'btnFire', 'btnJump', 'btnSlide', 'btnWeapon', 'btnAim', 'btnGrenade', 'btnOverdrive', 'btnView', 'btnMelee', 'btnPauseTouch'];
let editMode = false;

function loadLayout() {
  try { return JSON.parse(localStorage.getItem(LAYOUT_KEY) || '{}'); } catch (e) { return {}; }
}
function applyLayout() {
  const saved = loadLayout();
  for (const id of DRAGGABLE) {
    const el = document.getElementById(id);
    if (!el || !saved[id]) continue;
    el.style.right = saved[id].right; el.style.bottom = saved[id].bottom;
    el.style.left = 'auto'; el.style.top = 'auto';
  }
}
function clearLayout() {
  try { localStorage.removeItem(LAYOUT_KEY); } catch (e) { /* private mode */ }
  for (const id of DRAGGABLE) {
    const el = document.getElementById(id);
    if (!el) continue;
    el.style.right = ''; el.style.bottom = ''; el.style.left = ''; el.style.top = '';
  }
}

export function initTouch(G) {
  const wrap = document.getElementById('touch');
  if (!wrap) return;
  const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  if (!isTouch) return;
  document.body.classList.add('touch');
  wrap.style.display = 'block';
  applyLayout();
  const stick = document.getElementById('stick'); const knob = document.getElementById('stickKnob');
  const look = document.getElementById('lookArea');
  let stickId = null, lookId = null, lookLast = null;
  let dragId = null, dragEl = null;
  const stickRect = () => stick.getBoundingClientRect();
  stick.addEventListener('touchstart', (e) => { if (editMode) return; e.preventDefault(); stickId = e.changedTouches[0].identifier; }, { passive: false });
  window.addEventListener('touchmove', (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier === stickId) {
        const r = stickRect(); let dx = (t.clientX - (r.left + r.width / 2)) / (r.width / 2); let dy = (t.clientY - (r.top + r.height / 2)) / (r.height / 2);
        const len = Math.hypot(dx, dy); if (len > 1) { dx /= len; dy /= len; }
        G.player.padMove.x = dx; G.player.padMove.y = dy;
        // Knob travel fits the stick: radius minus knob radius, so the
        // knob never pokes outside the ring on the smaller landscape stick.
        const k = Math.max(0, r.width / 2 - knob.offsetWidth / 2);
        knob.style.transform = 'translate(' + dx * k + 'px,' + dy * k + 'px)';
      } else if (t.identifier === lookId) {
        if (lookLast) { G.player.yaw -= (t.clientX - lookLast.x) * 0.0045; G.player.pitch = Math.max(-1.45, Math.min(1.45, G.player.pitch - (t.clientY - lookLast.y) * 0.0045)); }
        lookLast = { x: t.clientX, y: t.clientY };
      } else if (t.identifier === dragId && dragEl) {
        // Layout edit drag: move the button so its centre follows the finger.
        const r = dragEl.getBoundingClientRect();
        const right = Math.max(0, Math.min(window.innerWidth - r.width, window.innerWidth - t.clientX - r.width / 2));
        const bottom = Math.max(0, Math.min(window.innerHeight - r.height, window.innerHeight - t.clientY - r.height / 2));
        dragEl.style.right = right + 'px'; dragEl.style.bottom = bottom + 'px';
        dragEl.style.left = 'auto'; dragEl.style.top = 'auto';
      }
    }
  }, { passive: true });
  window.addEventListener('touchend', (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier === stickId) { stickId = null; G.player.padMove.x = 0; G.player.padMove.y = 0; knob.style.transform = 'translate(0,0)'; }
      if (t.identifier === lookId) { lookId = null; lookLast = null; }
      if (t.identifier === dragId) { dragId = null; dragEl = null; }
    }
  });
  look.addEventListener('touchstart', (e) => { if (editMode) return; e.preventDefault(); lookId = e.changedTouches[0].identifier; lookLast = { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY }; }, { passive: false });
  const bind = (id, down, up) => { const el = document.getElementById(id); if (!el) return; el.addEventListener('touchstart', (e) => { if (editMode) return; e.preventDefault(); down(); }, { passive: false }); if (up) el.addEventListener('touchend', (e) => { if (editMode) return; e.preventDefault(); up(); }, { passive: false }); };
  bind('btnFire', () => { G.touchFiring = true; }, () => { G.touchFiring = false; });
  bind('btnJump', () => G.jump());
  bind('btnSlide', () => G.startSlide());
  bind('btnWeapon', () => G.cycleWeapon(1));
  bind('btnAim', () => { G.player.aiming = !G.player.aiming; });
  bind('btnGrenade', () => G.throwGrenade());
  bind('btnOverdrive', () => G.activateOverdrive());
  bind('btnView', () => G.toggleView());
  bind('btnMelee', () => G.meleeAttack(true));
  bind('btnPauseTouch', () => G.togglePause());
  // Layout edit: in edit mode a touch on a button or the stick starts a drag
  // instead of the action. The action binds above already return early.
  for (const id of DRAGGABLE) {
    const el = document.getElementById(id);
    if (!el) continue;
    el.addEventListener('touchstart', (e) => {
      if (!editMode) return;
      e.preventDefault(); e.stopPropagation();
      dragId = e.changedTouches[0].identifier; dragEl = el;
    }, { passive: false });
  }
  G.setLayoutEdit = (on) => {
    editMode = !!on;
    document.body.classList.toggle('editing', editMode);
    if (!editMode) { dragId = null; dragEl = null; }
  };
  G.saveLayout = () => {
    const saved = {};
    for (const id of DRAGGABLE) {
      const el = document.getElementById(id);
      if (!el || !el.style.right) continue;
      saved[id] = { right: el.style.right, bottom: el.style.bottom };
    }
    try { localStorage.setItem(LAYOUT_KEY, JSON.stringify(saved)); } catch (e) { /* private mode */ }
  };
  G.resetLayout = () => { clearLayout(); };
}
