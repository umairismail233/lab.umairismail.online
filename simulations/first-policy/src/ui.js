// DOM UI: dialogue, toast, handbook, stations menu, report.
const $ = (id) => document.getElementById(id);

export const MENTOR_STYLE = {
  'Ms. Rahman': { initial: 'R', color: '#b45309', role: 'HR Lead' },
  'Bilal': { initial: 'B', color: '#3730a3', role: 'Senior Advisor, Life' },
  'Sana': { initial: 'S', color: '#0f766e', role: 'Advisor, Health' },
  'Sana & Omar': { initial: 'S', color: '#0f766e', role: 'Advisors, Health & Motor' },
  'Omar': { initial: 'O', color: '#0369a1', role: 'Advisor, Motor' },
  'Farah': { initial: 'F', color: '#7f1d1d', role: 'Compliance Officer' },
  'Daniyal': { initial: 'D', color: '#b45309', role: 'Claims Manager' },
  'Hira': { initial: 'H', color: '#0369a1', role: 'IT Trainer' },
  'Mr. Sheikh': { initial: 'S', color: '#92400e', role: 'Your client' },
  'Mrs. Sheikh': { initial: 'S', color: '#9d6b4f', role: 'Your client' },
  'مس رحمان': { initial: 'ر', color: '#b45309', role: '' },
  'بلال': { initial: 'ب', color: '#3730a3', role: '' },
  'ثنا': { initial: 'ث', color: '#0f766e', role: '' },
  'عمر': { initial: 'ع', color: '#0369a1', role: '' },
  'فرح': { initial: 'ف', color: '#7f1d1d', role: '' },
  'دانیال': { initial: 'د', color: '#b45309', role: '' },
  'حرا': { initial: 'ح', color: '#0369a1', role: '' },
  'مسٹر شیخ': { initial: 'ش', color: '#92400e', role: '' },
  'مسز شیخ': { initial: 'ش', color: '#9d6b4f', role: '' },
};

// The active language's strings, set by main.js once content loads. Speaker
// roles come from the content itself (station mentorRole + ui.speakerRoles),
// so dialogue headers work in both languages.
let S = null;
export function setStrings(content) { S = content; }
const T = (str, vars) => String(str || '').replace(/\{(\w+)\}/g, (_, k) => (vars && vars[k] !== undefined ? vars[k] : ''));
function roleFor(speaker) {
  if (S) {
    const st = S.stations.find(x => x.intro && x.intro.some(l => l.speaker === speaker));
    if (st && st.intro[0].speaker === speaker) return st.mentorRole;
    if (S.ui.speakerRoles && S.ui.speakerRoles[speaker]) return S.ui.speakerRoles[speaker];
    const any = S.stations.find(x => x.mentor === speaker);
    if (any) return any.mentorRole;
  }
  return (MENTOR_STYLE[speaker] || {}).role || '';
}
function fallbackStyle(speaker) {
  const words = String(speaker || '').replace(/^(Mr\.|Mrs\.|Ms\.|Dr\.)\s*/i, '').split(/\s+/).filter(Boolean);
  const initial = (words[words.length - 1] || '?').charAt(0).toUpperCase();
  return { initial, color: '#4f46e5', role: '' };
}

let toastTimer = null;
export function toast(msg, ms = 3400) {
  const t = $('toast'); t.textContent = msg; t.classList.remove('hidden');
  if (window.gsap) window.gsap.fromTo(t, { scale: .85, opacity: 0, y: -8 }, { scale: 1, opacity: 1, y: 0, duration: .32, ease: 'back.out(2.2)' });
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.add('hidden'), ms);
}

// Dialogue: lines = [{speaker, text}] → promise resolves when finished.
export function showDialogue(lines, sfx) {
  return new Promise((resolve) => {
    const wrap = $('dialogue'), nameEl = $('dlg-name'), roleEl = $('dlg-role'),
      avEl = $('dlg-avatar'), textEl = $('dlg-text'), nextBtn = $('dlg-next');
    let i = 0;
    wrap.classList.remove('hidden');
    if (window.gsap) window.gsap.fromTo(wrap, { y: 26, opacity: 0 }, { y: 0, opacity: 1, duration: .38, ease: 'power3.out' });
    function render() {
      const line = lines[i];
      const st = MENTOR_STYLE[line.speaker] || fallbackStyle(line.speaker);
      nameEl.textContent = line.speaker; roleEl.textContent = roleFor(line.speaker) || st.role;
      avEl.textContent = st.initial; avEl.style.setProperty('--av', st.color);
      // typewriter
      textEl.textContent = '';
      let c = 0; const full = line.text;
      clearInterval(render._iv);
      render._iv = setInterval(() => {
        c += 3; textEl.textContent = full.slice(0, c);
        if (c >= full.length) clearInterval(render._iv);
      }, 12);
      textEl.onclick = () => { clearInterval(render._iv); textEl.textContent = full; };
      nextBtn.textContent = i === lines.length - 1 ? (S ? S.ui.dlgDone : 'Done ✓') : (S ? S.ui.dlgContinue : 'Continue ▸');
    }
    nextBtn.onclick = () => {
      if (sfx) sfx('click');
      i++;
      if (i >= lines.length) { wrap.classList.add('hidden'); nextBtn.onclick = null; resolve(); }
      else render();
    };
    render();
  });
}

export function starsStr(n) { return '⭐'.repeat(n) + '☆'.repeat(3 - n); }

export function renderHandbook(state, content) {
  const done = content.stations.filter(s => state.stations[s.id]?.done).length;
  const playable = content.stations.filter(s => !s.locked).length;
  $('handbook-progress').textContent = T(content.ui.missionsComplete, { done, total: playable, stars: totalStars(state) });
  $('handbook-stations').innerHTML = content.stations.map(s => {
    const st = state.stations[s.id];
    const cls = s.locked ? 'locked' : (st?.done ? 'done' : '');
    const right = s.locked ? content.ui.soon : (st?.done ? `<span class="st-stars">${starsStr(st.stars)}</span>` : content.ui.notYet);
    return `<div class="station-row ${cls}"><div class="st-main"><div class="st-name">${s.id}. ${s.name}</div><div class="st-obj">${s.objective} ${content.ui.mentorPrefix}: ${s.mentor}</div></div>${right}</div>`;
  }).join('');
  $('handbook-badges').innerHTML = content.stations.map(s => {
    const earned = state.stations[s.id]?.done;
    return `<span class="badge-chip ${earned ? 'earned' : 'locked'}">${earned ? '🏅' : '🔒'} ${s.badge}</span>`;
  }).join('');
  $('handbook-glossary').innerHTML = content.glossary.map(g =>
    `<div class="gloss-row"><strong>${g.term}:</strong> ${g.def}</div>`).join('');
}

export function renderStationsMenu(state, content, onGo) {
  $('stations-list').innerHTML = '';
  for (const s of content.stations) {
    const st = state.stations[s.id];
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'station-row' + (s.locked ? ' locked' : st?.done ? ' done' : '');
    b.innerHTML = `<div class="st-main"><div class="st-name">${s.id}. ${s.name}</div><div class="st-obj">${s.locked ? content.ui.openingSoon : s.objective}</div></div>` +
      (s.locked ? '🔒' : st?.done ? `<span class="st-stars">${starsStr(st.stars)}</span>` : `<span class="st-go">${content.ui.go}</span>`);
    if (!s.locked) b.onclick = () => { $('stations-menu').classList.add('hidden'); onGo(s.id); };
    $('stations-list').appendChild(b);
  }
}

export function totalStars(state) {
  return Object.values(state.stations).reduce((a, s) => a + (s.stars || 0), 0);
}

export function renderReport(state, content, elapsedSec) {
  const mins = Math.floor(elapsedSec / 60), secs = Math.floor(elapsedSec % 60);
  const rows = content.stations.filter(s => !s.locked).map(s => {
    const st = state.stations[s.id];
    return `<tr><td>${s.name}</td><td>${st?.done ? content.ui.complete : content.ui.notComplete}</td><td>${st ? starsStr(st.stars) : ''}</td><td>${s.objective}</td></tr>`;
  }).join('');
  $('report-name-line').textContent = `${state.name} · ${new Date().toLocaleDateString(content.lang === 'ur' ? 'ur-PK' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' })} · ${T(content.ui.timeAt, { company: content.company.short })}: ${mins}m ${secs}s · ${content.ui.totalStarsLine}: ${totalStars(state)}`;
  $('report-body').innerHTML = `<p style="line-height:1.55;margin-bottom:10px">${content.report.intro}</p>
    <table class="report-table"><tr><th>${content.ui.tableStation}</th><th>${content.ui.tableStatus}</th><th>${content.report.starsLabel}</th><th>${content.ui.tableObjective}</th></tr>${rows}</table>`;
  $('report-disclaimer').textContent = content.report.disclaimer;
}
export function summaryText(state, content, elapsedSec) {
  const mins = Math.floor(elapsedSec / 60), secs = Math.floor(elapsedSec % 60);
  const lines = [content.ui.summaryTitle, `${content.ui.summaryName}: ${state.name}`, `${content.ui.summaryTime}: ${mins}m ${secs}s. ${content.report.starsLabel}: ${totalStars(state)}/${content.stations.filter(x => !x.locked).length * 3}`];
  for (const s of content.stations.filter(x => !x.locked)) {
    const st = state.stations[s.id];
    lines.push(`${s.name}: ${st?.done ? content.ui.complete + ' ' + starsStr(st.stars) : content.ui.notComplete}`);
  }
  lines.push(content.report.disclaimer);
  return lines.join('\n');
}
