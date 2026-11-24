// hud.js. DOM HUD updates, banners, killfeed, hit markers, damage arcs, vignette.
import * as THREE from 'three';

export class HUD {
  constructor() {
    this.el = {};
    ['healthFill', 'healthNum', 'armorFill', 'armorNum', 'ammoMag', 'ammoRes', 'weaponName', 'waveNum', 'enemiesLeft', 'scoreNum', 'killsNum', 'styleRank', 'styleFill', 'overdriveWrap', 'overdriveFill', 'overdriveText', 'grenadeNum', 'crosshair', 'hitmarker', 'killfeed', 'banner', 'vignette', 'bossWrap', 'bossFill', 'bossLabel', 'damageArc', 'accuracyNum', 'waveBanner', 'reloadPrompt'].forEach((id) => { this.el[id] = document.getElementById(id); });
    this.arcT = 0;
    this.dmgMap = new Map();
    this.dmgLayer = document.getElementById('dmgLayer');
    this.minimap = document.getElementById('minimap');
    this.mmCtx = this.minimap ? this.minimap.getContext('2d') : null;
    this.compass = document.getElementById('compassCanvas');
    this.cpCtx = this.compass ? this.compass.getContext('2d') : null;
    // Enemy direction marker pool: edge arrows for off-screen attackers.
    this.markerPool = [];
    const wrap = document.getElementById('enemyMarkers');
    if (wrap) {
      for (let i = 0; i < 8; i++) {
        const d = document.createElement('div');
        d.className = 'enemy-marker';
        d.innerHTML = '<span class="em-arrow">\u27a4</span><span class="em-dist"></span>';
        d.style.display = 'none';
        wrap.appendChild(d);
        this.markerPool.push(d);
      }
    }
    this._projV = new THREE.Vector3();
  }
  update(G) {
    const p = G.player;
    if (this.el.healthFill) { this.el.healthFill.style.width = Math.max(0, p.health) + '%'; this.el.healthNum.textContent = Math.ceil(Math.max(0, p.health)); }
    if (this.el.armorFill) { this.el.armorFill.style.width = (100 * p.armor / p.maxArmor) + '%'; this.el.armorNum.textContent = Math.ceil(Math.max(0, p.armor)); }
    const w = G.weapons[p.weapon];
    if (this.el.ammoMag) this.el.ammoMag.textContent = p.ammo[p.weapon].mag === Infinity ? '--' : p.ammo[p.weapon].mag;
    if (this.el.ammoRes) this.el.ammoRes.textContent = p.ammo[p.weapon].reserve === Infinity ? '--' : p.ammo[p.weapon].reserve;
    if (this.el.weaponName) this.el.weaponName.textContent = w.name;
    if (this.el.waveNum) this.el.waveNum.textContent = G.mode === 'ffa' ? 'FREE FOR ALL' : 'WAVE ' + G.wave;
    if (this.el.enemiesLeft) {
      const n = G.enemies.filter((e) => !e.dead).length;
      this.el.enemiesLeft.textContent = G.mode === 'ffa' ? 'TARGET 10' : n + (n === 1 ? ' HOSTILE' : ' HOSTILES');
    }
    if (this.el.scoreNum) this.el.scoreNum.textContent = G.score;
    if (this.el.killsNum) this.el.killsNum.textContent = G.kills;
    if (this.el.styleRank) this.el.styleRank.textContent = G.style.rank;
    if (this.el.styleFill) this.el.styleFill.style.width = Math.min(100, G.style.points / 9) + '%';
    if (this.el.grenadeNum) this.el.grenadeNum.textContent = document.body.classList.contains('touch') ? 'GRENADES: ' + p.grenades : 'GRENADES: ' + p.grenades + ' [G]';
    if (this.el.accuracyNum) {
      // No shots yet is an empty state, not missing data: hide the line
      // until the first shot is fired.
      this.el.accuracyNum.style.display = G.shots > 0 ? '' : 'none';
      if (G.shots > 0) this.el.accuracyNum.textContent = 'ACC ' + Math.round(100 * G.hits / G.shots) + '%';
    }
    if (this.el.overdriveWrap) {
      const touch = document.body.classList.contains('touch');
      if (p.overdriveT > 0) { this.el.overdriveWrap.style.display = 'block'; this.el.overdriveFill.style.width = (100 * p.overdriveT / 8) + '%'; this.el.overdriveText.textContent = 'OVERDRIVE ' + p.overdriveT.toFixed(1) + 's'; }
      else if (p.overdriveCd > 0) { this.el.overdriveWrap.style.display = 'block'; this.el.overdriveFill.style.width = (100 * (1 - p.overdriveCd / 25)) + '%'; this.el.overdriveText.textContent = 'OVERDRIVE READY IN ' + Math.ceil(p.overdriveCd) + 's'; }
      else { this.el.overdriveWrap.style.display = 'block'; this.el.overdriveFill.style.width = '100%'; this.el.overdriveText.textContent = touch ? 'OVERDRIVE READY [OD]' : 'OVERDRIVE READY [F]'; }
    }
    // Low health vignette. Blood red edge only. No blur. Ramp starts at 55 HP
    // so it is clearly visible at 30 HP against the red sunset.
    if (this.el.vignette) {
      const low = p.health < 55 ? (55 - p.health) / 55 : 0;
      const hurt = Math.max(0, this.hurtFlash || 0);
      const a = Math.min(0.9, low * 1.4 + hurt * 0.6);
      this.el.vignette.style.opacity = a.toFixed(2);
    }
    if (this.el.crosshair) {
      this.el.crosshair.style.opacity = p.aiming ? '0' : '1';
      // Dynamic gap: opens while moving and while firing, so the crosshair
      // reads spread at a glance. Firing bloom comes from G.bloom (0 to 1).
      const gap = 6 + p.moveMag * 7 + (G.bloom || 0) * 14;
      this.el.crosshair.style.setProperty('--gap', gap.toFixed(1) + 'px');
    }
    this.updateMarkers(G);
    this.updateMinimap(G);
    this.updateCompass(G);
    this.updateReloadPrompt(G);
  }
  // Minimap radar, top-left. North-up: world -Z is up, +X is right. The
  // player arrow points up at yaw 0 and rotates by -yaw, the same sign as
  // the compass heading, so the two never disagree.
  updateMinimap(G) {
    if (!this.mmCtx || !G.camera || G.state !== 'playing') return;
    const ctx = this.mmCtx, S = 148, c = S / 2, R = 70;
    const p = G.player;
    ctx.clearRect(0, 0, S, S);
    ctx.strokeStyle = 'rgba(255,255,255,0.14)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(c, c, c * 0.5, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(c, c, c - 2, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#ffb347'; ctx.font = '700 11px Oswald, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('N', c, 13);
    const scale = (c - 6) / R;
    const colors = { wolf: '#c8ccd2', boar: '#d8a060', robot: '#ffffff', dog: '#ffb347', exo: '#ff5340', boss: '#ff2222' };
    for (const e of G.enemies) {
      if (e.dead || !e.group) continue;
      let dx = e.group.position.x - p.pos.x, dz = e.group.position.z - p.pos.z;
      const d = Math.hypot(dx, dz);
      if (d > R) { dx *= R / d; dz *= R / d; }
      const x = c + dx * scale, y = c + dz * scale;
      ctx.fillStyle = colors[e.type] || '#ff5340';
      if (e.type === 'boss' || e.type === 'exo') {
        ctx.save(); ctx.translate(x, y); ctx.rotate(Math.PI / 4); ctx.fillRect(-4, -4, 8, 8); ctx.restore();
      } else {
        ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.save(); ctx.translate(c, c); ctx.rotate(-p.yaw);
    ctx.fillStyle = '#ffb347'; ctx.beginPath();
    ctx.moveTo(0, -8); ctx.lineTo(5.5, 6); ctx.lineTo(0, 2.5); ctx.lineTo(-5.5, 6); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  // Compass strip, top-centre. Heading 0 is north (-Z). Ticks every 5
  // degrees, labels every 45. The red diamond marks the nearest living
  // enemy, clamped to the strip edge when it is behind the player.
  updateCompass(G) {
    if (!this.cpCtx || !G.camera || G.state !== 'playing') return;
    const ctx = this.cpCtx, W = 320, H = 30, cx = W / 2, pxPerDeg = 2.2;
    const heading = ((-G.player.yaw * 180 / Math.PI) % 360 + 360) % 360;
    ctx.clearRect(0, 0, W, H);
    const labels = { 0: 'N', 45: 'NE', 90: 'E', 135: 'SE', 180: 'S', 225: 'SW', 270: 'W', 315: 'NW' };
    ctx.textAlign = 'center';
    const start = Math.ceil((heading - 75) / 5) * 5;
    for (let deg = start; deg <= heading + 75; deg += 5) {
      const norm = ((deg % 360) + 360) % 360;
      const rel = deg - heading;
      const x = cx + rel * pxPerDeg;
      if (x < 2 || x > W - 2) continue;
      const major = norm % 45 === 0, mid = norm % 15 === 0;
      ctx.strokeStyle = major ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.35)';
      ctx.beginPath(); ctx.moveTo(x, major ? 8 : mid ? 12 : 16); ctx.lineTo(x, 20); ctx.stroke();
      if (major) { ctx.fillStyle = '#ffb347'; ctx.font = '700 11px Oswald, sans-serif'; ctx.fillText(labels[norm], x, 29); }
    }
    ctx.fillStyle = '#ffb347'; ctx.beginPath(); ctx.moveTo(cx - 5, 0); ctx.lineTo(cx + 5, 0); ctx.lineTo(cx, 6); ctx.closePath(); ctx.fill();
    let best = null, bestD = Infinity;
    for (const e of G.enemies) {
      if (e.dead || !e.group) continue;
      const dx = e.group.position.x - G.player.pos.x, dz = e.group.position.z - G.player.pos.z;
      const d = Math.hypot(dx, dz);
      if (d < bestD) { bestD = d; best = { dx, dz }; }
    }
    if (best) {
      const bearing = (Math.atan2(best.dx, -best.dz) * 180 / Math.PI + 360) % 360;
      let rel = bearing - heading; if (rel > 180) rel -= 360; if (rel < -180) rel += 360;
      const x = cx + Math.max(-1, Math.min(1, rel / 70)) * (W / 2 - 8);
      ctx.fillStyle = '#ff5340';
      ctx.save(); ctx.translate(x, 5); ctx.rotate(Math.PI / 4); ctx.fillRect(-3.5, -3.5, 7, 7); ctx.restore();
    }
  }
  // Yellow RELOAD pill under the crosshair: empty magazine, or reloading.
  updateReloadPrompt(G) {
    if (!this.el.reloadPrompt) return;
    const p = G.player;
    const show = G.state === 'playing' && p.weapon !== 'melee' && (p.ammo[p.weapon].mag === 0 || G.reloading);
    this.el.reloadPrompt.style.display = show ? 'block' : 'none';
    if (show) {
      const touch = document.body.classList.contains('touch');
      this.el.reloadPrompt.textContent = G.reloading ? 'RELOADING' : (touch ? 'RELOAD' : 'RELOAD [R]');
    }
  }
  // Edge arrows for living enemies that are off screen, so an attacker is
  // never invisible. On-screen enemies get no marker: they are visible.
  // Markers are spread after layout so two at similar bearings never stack
  // on each other or on HUD labels (score panel top right, grenades label
  // bottom right).
  updateMarkers(G) {
    if (!this.markerPool.length || !G.camera) return;
    const show = G.state === 'playing';
    const w = window.innerWidth, h = window.innerHeight;
    const alive = show ? G.enemies.filter((e) => !e.dead).slice(0, 8) : [];
    const colors = { wolf: '#c8ccd2', boar: '#d8a060', robot: '#ffffff', dog: '#ffb347', exo: '#ff5340', boss: '#ff2222' };
    const placed = [];
    for (let i = 0; i < this.markerPool.length; i++) {
      const m = this.markerPool[i];
      const e = alive[i];
      if (!e) { m.style.display = 'none'; continue; }
      this._projV.set(e.group.position.x, e.group.position.y + 1.4, e.group.position.z).project(G.camera);
      let nx = this._projV.x, ny = this._projV.y;
      const behind = this._projV.z > 1;
      if (behind) { nx = -nx; ny = -ny; }
      const onScreen = !behind && Math.abs(nx) < 0.92 && Math.abs(ny) < 0.88;
      if (onScreen) { m.style.display = 'none'; continue; }
      const cx = Math.max(-0.94, Math.min(0.94, nx));
      const cy = Math.max(-0.9, Math.min(0.9, ny));
      let left = (cx * 0.5 + 0.5) * w;
      let top = (0.5 - cy * 0.5) * h;
      const ang = Math.atan2(-cy, cx) * 180 / Math.PI;
      const dist = Math.round(Math.hypot(e.group.position.x - G.player.pos.x, e.group.position.z - G.player.pos.z));
      placed.push({ m, e, left, top, ang, dist });
    }
    // Spread and exclusion run in passes (up to 3): pushing a marker out
    // of a button can stack it on another marker, and spreading can push
    // it back toward a button. One pass of each is not enough to settle.
    for (let pass = 0; pass < 3; pass++) {
    // Spread: sort by height, force a 28 px vertical gap between markers
    // that sit close together horizontally, then keep every marker out of
    // the score panel (top right) and the grenades label (bottom right).
    placed.sort((a, b) => a.top - b.top);
    for (let i = 0; i < placed.length; i++) {
      for (let j = 0; j < i; j++) {
        if (Math.abs(placed[i].left - placed[j].left) < 90 && placed[i].top - placed[j].top < 28) {
          placed[i].top = placed[j].top + 28;
        }
      }
      if (placed[i].top < 180 && placed[i].left > w - 280) placed[i].top = 180;
      if (placed[i].top > h - 170 && placed[i].left > w - 280) placed[i].top = h - 170;
      placed[i].top = Math.max(40, Math.min(h - 40, placed[i].top));
      placed[i].left = Math.max(30, Math.min(w - 60, placed[i].left));
    }
    // Touch mode: also keep every marker out of the touch controls and the
    // compact HUD panels. The earlier spread only avoided the desktop
    // score panel and grenades label, so a marker could still sit behind
    // a touch button (for example the GUN button). Zones are read live
    // from the buttons, so both orientations are covered. A push is only
    // accepted if the new spot clears EVERY zone: pushing above one button
    // can land a marker behind another panel, and the old code accepted
    // the first push blindly, so two markers oscillated between the score
    // panel and the OD button and never moved.
    if (document.body.classList.contains('touch')) {
      const zones = [];
      for (const sel of ['#stick', '#btnFire', '#btnJump', '#btnSlide', '#btnWeapon', '#btnAim', '#btnGrenade', '#btnOverdrive', '#btnView', '#btnMelee', '#btnPauseTouch', '#viewBtn', '#minimapWrap', '#compass', '#tl', '#tr', '#br', '#bl', '#killfeed', '#bossWrap']) {
        const el = document.querySelector(sel);
        if (!el) continue;
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) zones.push(r);
      }
      const mw = 56, mh = 30;
      const hitsZone = (left, top, z) => left + mw / 2 > z.left - 6 && left - mw / 2 < z.right + 6 && top + mh / 2 > z.top - 6 && top - mh / 2 < z.bottom + 6;
      const clearOfZones = (left, top) => zones.every((z) => !hitsZone(left, top, z));
      const done = [];
      const clearOfDone = (left, top) => done.every((d) => Math.abs(left - d.left) >= 90 || Math.abs(top - d.top) >= 28);
      const trySpot = (left, top, ignoreDone) => {
        const cl = Math.max(30, Math.min(w - 60, left));
        const ct = Math.max(40, Math.min(h - 40, top));
        if (!clearOfZones(cl, ct)) return null;
        if (!ignoreDone && !clearOfDone(cl, ct)) return null;
        return [cl, ct];
      };
      for (const pm of placed) {
        if (!clearOfZones(pm.left, pm.top)) {
          const cands = [];
          for (const z of zones) {
            if (!hitsZone(pm.left, pm.top, z)) continue;
            cands.push([pm.left, z.top - mh / 2 - 8]);
            cands.push([pm.left, z.bottom + mh / 2 + 8]);
            cands.push([z.left - mw / 2 - 8, pm.top]);
            cands.push([z.right + mw / 2 + 8, pm.top]);
          }
          let best = null;
          for (const [cl, ct] of cands) {
            const spot = trySpot(cl, ct, false);
            if (spot) { best = spot; break; }
          }
          // Fallback: no side-of-zone candidate cleared every zone. The
          // old code left the marker where it was, on the button. A marker
          // must never overlap a touch button, HUD panel, or the VIEW
          // button, so keep searching: vertical offsets in 12 px steps,
          // then horizontal offsets, then a dedicated lane scanned row by
          // row below the top HUD, then stacking in that lane. Hiding
          // beats covering a control, so a marker with no clear spot
          // anywhere is hidden for this frame instead of left on a button.
          if (!best) {
            for (let d = 12; d <= 240 && !best; d += 12) best = trySpot(pm.left, pm.top - d, false) || trySpot(pm.left, pm.top + d, false);
            for (let d = 12; d <= 240 && !best; d += 12) best = trySpot(pm.left - d, pm.top, false) || trySpot(pm.left + d, pm.top, false);
            for (let y = 44; y <= h - 44 && !best; y += 12) for (let x = 40; x <= w - 60 && !best; x += 30) best = trySpot(x, y, false);
            for (let y = 44; y <= h - 44 && !best; y += 12) for (let x = 40; x <= w - 60 && !best; x += 30) best = trySpot(x, y, true);
          }
          if (best) { pm.left = best[0]; pm.top = best[1]; pm.hide = false; }
          else { pm.hide = true; }
        } else { pm.hide = false; }
        pm.top = Math.max(40, Math.min(h - 40, pm.top));
        pm.left = Math.max(30, Math.min(w - 60, pm.left));
        if (!pm.hide) done.push(pm);
      }
    }
    }
    for (const p of placed) {
      if (p.hide) { p.m.style.display = 'none'; continue; }
      p.m.style.display = 'flex';
      p.m.style.left = p.left + 'px';
      p.m.style.top = p.top + 'px';
      p.m.style.color = colors[p.e.type] || '#ff5340';
      p.m.children[0].style.transform = 'rotate(' + p.ang.toFixed(0) + 'deg)';
      p.m.children[1].textContent = p.dist + 'm';
    }
  }
  hurtFlashSet(v) { this.hurtFlash = v; }
  // Floating damage numbers. Shotgun pellets landing in one burst are
  // aggregated per enemy for 150 ms, so one shot shows one number instead
  // of eight, and the number is readable at a glance.
  damage(enemy, amount, isHead, G) {
    if (!this.dmgLayer || !G.camera) return;
    let rec = this.dmgMap.get(enemy);
    if (!rec) { rec = { total: 0, head: false, timer: null }; this.dmgMap.set(enemy, rec); }
    rec.total += amount; rec.head = rec.head || isHead;
    clearTimeout(rec.timer);
    rec.timer = setTimeout(() => { this._flushDmg(enemy, rec, G); this.dmgMap.delete(enemy); }, 150);
  }
  _flushDmg(enemy, rec, G) {
    if (!enemy.group) return;
    this._projV.set(enemy.group.position.x, enemy.group.position.y + (rec.head ? 1.75 : 1.3), enemy.group.position.z).project(G.camera);
    if (this._projV.z > 1) return;
    const d = document.createElement('div');
    d.className = 'dmg-num' + (rec.head ? ' head' : '');
    d.textContent = Math.round(rec.total);
    d.style.left = ((this._projV.x * 0.5 + 0.5) * window.innerWidth) + 'px';
    d.style.top = ((0.5 - this._projV.y * 0.5) * window.innerHeight) + 'px';
    this.dmgLayer.appendChild(d);
    setTimeout(() => { if (d.parentNode) d.remove(); }, 800);
  }
  // Floating score popup at a kill: the points earned, shown where the
  // enemy fell, so the reward is tied to the action that earned it.
  scorePopup(worldPos, text, G) {
    if (!this.dmgLayer || !G.camera) return;
    this._projV.copy(worldPos).project(G.camera);
    if (this._projV.z > 1) return;
    const d = document.createElement('div');
    d.className = 'score-pop';
    d.textContent = text;
    d.style.left = ((this._projV.x * 0.5 + 0.5) * window.innerWidth) + 'px';
    d.style.top = ((0.5 - this._projV.y * 0.5) * window.innerHeight) + 'px';
    this.dmgLayer.appendChild(d);
    setTimeout(() => { if (d.parentNode) d.remove(); }, 1000);
  }
  hitmarker(kind) {
    if (!this.el.hitmarker) return;
    this.el.hitmarker.textContent = kind === 'head' ? 'X' : kind === 'weak' ? 'O' : '+';
    this.el.hitmarker.style.color = kind === 'head' ? '#ffdd33' : kind === 'weak' ? '#ff7a1a' : '#ffffff';
    this.el.hitmarker.style.opacity = '1'; this.el.hitmarker.style.transform = 'translate(-50%,-50%) scale(1.35)';
    setTimeout(() => { this.el.hitmarker.style.opacity = '0'; this.el.hitmarker.style.transform = 'translate(-50%,-50%) scale(1)'; }, 120);
  }
  killfeed(text) {
    if (!this.el.killfeed) return;
    const d = document.createElement('div'); d.textContent = text; this.el.killfeed.prepend(d);
    while (this.el.killfeed.children.length > 5) this.el.killfeed.lastChild.remove();
    setTimeout(() => { if (d.parentNode) d.remove(); }, 5000);
  }
  banner(text, sub) {
    if (!this.el.banner) return;
    // A repeated identical warning does not restart the hide timer: each
    // armor break re-showing the banner kept pushing its hide 2.6 s out,
    // so during sustained fire it looked stuck on screen.
    if (this._bannerText === text && this.el.banner.style.opacity === '1') return;
    this._bannerText = text;
    this.el.banner.innerHTML = '<div class="banner-title">' + text + '</div>' + (sub ? '<div class="banner-sub">' + sub + '</div>' : '');
    this.el.banner.style.opacity = '1';
    clearTimeout(this._bt);
    this._bt = setTimeout(() => { this.el.banner.style.opacity = '0'; this._bannerText = ''; }, 2600);
  }
  // Hide the armor warning once armor has recharged. Only touches the
  // banner when it is showing the armor warning, never a wave banner.
  hideArmorBanner() {
    if (!this.el.banner || this._bannerText !== 'ARMOR BROKEN') return;
    clearTimeout(this._bt);
    this._bannerText = '';
    this.el.banner.style.opacity = '0';
  }
  damageArc(angleDeg) {
    if (!this.el.damageArc) return;
    this.el.damageArc.style.transform = 'translate(-50%,-50%) rotate(' + angleDeg + 'deg)';
    this.el.damageArc.style.opacity = '1';
    clearTimeout(this._at);
    this._at = setTimeout(() => { this.el.damageArc.style.opacity = '0'; }, 700);
  }
  setBoss(on, frac, label) {
    if (!this.el.bossWrap) return;
    this.el.bossWrap.style.display = on ? 'block' : 'none';
    if (on) { this.el.bossFill.style.width = (100 * frac) + '%'; if (label) this.el.bossLabel.textContent = label; }
  }
  setBossPhase(p) {
    if (this.el.bossLabel) this.el.bossLabel.textContent = 'EXOSKELETON PRIME. PHASE ' + p;
    const pips = document.querySelectorAll('#bossPips .boss-pip');
    pips.forEach((el, i) => el.classList.toggle('on', i < p));
  }
}
