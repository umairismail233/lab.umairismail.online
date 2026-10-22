// Mission chrome strings come from the active language's content file.
let M = null, U = null;
export function setStrings(content) { M = content.ui.m; U = content.ui; }
const T = (str, vars) => String(str || '').replace(/\{(\w+)\}/g, (_, k) => (vars && vars[k] !== undefined ? vars[k] : ''));

// ---------- Station 3: spot the red flags ----------
export function missionRedFlags(station, sfx) {
  return new Promise((resolve) => {
    openMission(station, T(M.kicker, { id: station.id, name: station.name }));
    let errors = 0, ai = 0;
    const body = $('mission-body');
    function renderApp() {
      const app = station.applications[ai];
      setFeedback(null);
      body.innerHTML = `<div class="mission-progress">${T(M.appProgress, { a: ai + 1, b: station.applications.length })}</div>
        <div class="client-card"><h3>${app.client}</h3><div class="detail-list"></div></div>`;
      const list = body.querySelector('.detail-list');
      for (const det of app.details) {
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'detail-btn'; b.textContent = det.text;
        b.onclick = () => {
          if (det.flag) {
            sfx('good'); b.classList.add('right');
            list.querySelectorAll('.detail-btn').forEach(x => x.disabled = true);
            const last = ai === station.applications.length - 1;
            setFeedback(`<strong>${M.redFlagFound}</strong> ${det.why}`, 'good',
              last ? [{ label: M.collectBadge, primary: true, onClick: () => { closeMission(); resolve({ errors }); } }]
                   : [{ label: M.nextApplication, primary: true, onClick: () => { ai++; renderApp(); } }]);
          } else {
            errors++; setErrors(errors); sfx('bad');
            b.classList.add('wrong'); b.disabled = true;
            setFeedback(station.wrongFeedback, 'coach');
          }
        };
        list.appendChild(b);
      }
    }
    renderApp();
  });
}

// ---------- Station 4: the claim journey (order + judgement) ----------
export function missionClaimJourney(station, sfx) {
  return new Promise((resolve) => {
    openMission(station, T(M.kicker, { id: station.id, name: station.name }));
    let errors = 0;
    const body = $('mission-body');
    // Part A — ordering
    let nextIdx = 0;
    const order = station.steps.map((_, i) => i);
    const shuffled = [...order].sort(() => Math.random() - 0.5);
    if (shuffled.every((v, i) => v === i)) shuffled.reverse();
    const list = document.createElement('div'); list.className = 'timeline-list'; body.appendChild(list);
    for (const idx of shuffled) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'timeline-item';
      b.innerHTML = `<span class="timeline-num">?</span><p>${station.steps[idx]}</p>`;
      b.onclick = () => {
        if (idx === nextIdx) {
          sfx('good'); b.classList.remove('shake'); b.classList.add('picked'); b.disabled = true;
          b.querySelector('.timeline-num').textContent = idx + 1;
          nextIdx++;
          if (nextIdx === station.steps.length) {
            setFeedback(`<strong>${M.journeyInOrder}</strong>`, 'good',
              [{ label: M.takeLive, primary: true, onClick: () => partB() }]);
          } else setFeedback(T(M.correctStep, { n: idx + 1 }), 'good');
        } else {
          errors++; setErrors(errors); sfx('bad');
          b.classList.remove('shake'); void b.offsetWidth; b.classList.add('shake');
          setTimeout(() => b.classList.remove('shake'), 400); // the red border is feedback for a moment, not a stain
          setFeedback(station.wrongFeedback, 'coach');
        }
      };
      list.appendChild(b);
    }
    // Part B — judgement scenarios
    function partB() {
      let si = 0;
      function renderScenario() {
        const sc = station.scenarios[si];
        setFeedback(null);
        body.innerHTML = `<div class="mission-progress">${T(M.liveProgress, { a: si + 1, b: station.scenarios.length })}</div>
          <div class="client-card"><h3>${M.whatDoYouDo}</h3><div class="client-need">${sc.text}</div><div class="detail-list"></div></div>`;
        const list = body.querySelector('.detail-list');
        for (const opt of sc.options) {
          const b = document.createElement('button');
          b.type = 'button'; b.className = 'detail-btn'; b.textContent = opt.text;
          b.onclick = () => {
            if (opt.ok) {
              sfx('good'); b.classList.add('right');
              list.querySelectorAll('.detail-btn').forEach(x => x.disabled = true);
              const last = si === station.scenarios.length - 1;
              setFeedback(`<strong>${M.rightCall}</strong> ${opt.why}`, 'good',
                last ? [{ label: M.collectBadge, primary: true, onClick: () => { closeMission(); resolve({ errors }); } }]
                     : [{ label: M.nextSituation, primary: true, onClick: () => { si++; renderScenario(); } }]);
            } else {
              errors++; setErrors(errors); sfx('bad');
              b.classList.add('wrong'); b.disabled = true;
              setFeedback(opt.feedback, 'coach');
            }
          };
          list.appendChild(b);
        }
      }
      renderScenario();
    }
  });
}

// ---------- Station 5: work the CRM ----------
export function missionCRM(station, sfx) {
  return new Promise((resolve) => {
    openMission(station, T(M.kicker, { id: station.id, name: station.name }));
    let errors = 0, si = 0;
    const body = $('mission-body');
    function renderStep() {
      const step = station.crmSteps[si];
      setFeedback(null);
      const chips = station.stages.map((s, i) => `<span class="stage-chip ${i < si ? 'done' : ''} ${i === si ? 'now' : ''}">${s}</span>`).join('<span class="stage-arrow">→</span>');
      body.innerHTML = `<div class="crm-tracker">${chips}</div>
        <div class="client-card"><h3>${T(M.crmStepOf, { a: si + 1, b: station.crmSteps.length })}</h3>
        <div class="client-need">${step.instruction}</div>
        <p style="font-weight:700;margin:12px 0 8px">${M.yourAction} ${step.action}</p>
        <div class="choice-row crm-actions"></div></div>`;
      const row = body.querySelector('.crm-actions');
      step.options.forEach((label, oi) => {
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'choice-btn'; b.textContent = label;
        b.onclick = () => {
          if (oi === step.correct) {
            sfx('good'); si++;
            if (si >= station.crmSteps.length) {
              body.innerHTML = `<div class="crm-tracker">${station.stages.map(s => `<span class="stage-chip done">${s}</span>`).join('<span class="stage-arrow">→</span>')}</div>`;
              setFeedback(`<strong>${M.journeyComplete}</strong> ${station.success}`, 'good',
                [{ label: M.collectBadge, primary: true, onClick: () => { closeMission(); resolve({ errors }); } }]);
            } else { setFeedback(M.logged, 'good'); setTimeout(renderStep, 600); }
          } else {
            errors++; setErrors(errors); sfx('bad');
            b.classList.add('wrong'); b.disabled = true;
            setFeedback(step.coach, 'coach');
          }
        };
        row.appendChild(b);
      });
    }
    renderStep();
  });
}

// ---------- Station 6: the client meeting (role-play choices) ----------
export function missionFinale(station, sfx) {
  return new Promise((resolve) => {
    openMission(station, T(M.kicker, { id: station.id, name: station.name }));
    let errors = 0, bi = 0;
    const body = $('mission-body');
    function renderBeat() {
      const beat = station.beats[bi];
      setFeedback(null);
      body.innerHTML = `<div class="mission-progress">${T(M.momentOf, { a: bi + 1, b: station.beats.length })}</div>
        <div class="quote-card">${beat.line}</div><div class="detail-list"></div>`;
      const list = body.querySelector('.detail-list');
      for (const opt of beat.options) {
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'detail-btn'; b.textContent = opt.text;
        b.onclick = () => {
          if (opt.ok) {
            sfx('good'); b.classList.add('right');
            list.querySelectorAll('.detail-btn').forEach(x => x.disabled = true);
            const last = bi === station.beats.length - 1;
            setFeedback(`<strong>${M.wellHandled}</strong> ${opt.praise || ''}`, 'good',
              last ? [{ label: M.issuePolicy, primary: true, onClick: () => { closeMission(); resolve({ errors }); } }]
                   : [{ label: M.continueMeeting, primary: true, onClick: () => { bi++; renderBeat(); } }]);
          } else {
            errors++; setErrors(errors); sfx('bad');
            b.classList.add('wrong'); b.disabled = true;
            setFeedback(opt.feedback, 'coach');
          }
        };
        list.appendChild(b);
      }
    }
    renderBeat();
  });
}

// Design rule: every interaction makes the player decide / sort / spot / assemble.
const $ = (id) => document.getElementById(id);

function openMission(station, kicker) {
  $('mission').classList.remove('hidden');
  if (window.gsap) window.gsap.fromTo('#mission .mission-card', { y: 22, opacity: 0, scale: .985 }, { y: 0, opacity: 1, scale: 1, duration: .34, ease: 'power3.out' });
  $('mission-kicker').textContent = kicker;
  $('mission-title').textContent = station.missionTitle;
  $('mission-intro').textContent = station.missionIntro;
  $('mission-body').innerHTML = '';
  setFeedback(null);
  setErrors(0);
}
function closeMission() { $('mission').classList.add('hidden'); }
function setErrors(n) { $('mission-errors').textContent = (U ? U.mistakes : 'Mistakes') + ': ' + n; }
function setFeedback(html, kind, actions) {
  const f = $('mission-feedback');
  if (!html) { f.classList.add('hidden'); f.innerHTML = ''; return; }
  f.className = 'mission-feedback ' + (kind || 'coach');
  f.innerHTML = html + (actions ? `<div class="feedback-actions"></div>` : '');
  if (actions) {
    const box = f.querySelector('.feedback-actions');
    for (const a of actions) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = a.primary ? 'btn-primary' : 'btn-secondary'; b.textContent = a.label;
      b.onclick = a.onClick; box.appendChild(b);
    }
  }
}
export function starsFor(errors) { return errors === 0 ? 3 : errors <= 2 ? 2 : 1; }

// ---------- Station 0: timeline ordering ----------
export function missionTimeline(station, sfx) {
  return new Promise((resolve) => {
    openMission(station, T(M.kicker, { id: station.id, name: station.name }));
    let errors = 0, nextIdx = 0;
    const order = station.timeline.map((_, i) => i);
    const shuffled = [...order].sort(() => Math.random() - 0.5);
    // guard: never present already-solved
    if (shuffled.every((v, i) => v === i)) shuffled.reverse();
    const body = $('mission-body');
    const list = document.createElement('div'); list.className = 'timeline-list'; body.appendChild(list);
    for (const idx of shuffled) {
      const item = station.timeline[idx];
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'timeline-item';
      b.innerHTML = `<span class="timeline-num">?</span><p>${item.text}</p>`;
      b.onclick = () => {
        if (idx === nextIdx) {
          sfx('good');
          b.classList.remove('shake'); b.classList.add('picked'); b.disabled = true;
          b.querySelector('.timeline-num').textContent = station.timeline[idx].year;
          nextIdx++;
          if (nextIdx === station.timeline.length) {
            setFeedback(`<strong>${M.timelineComplete}</strong> ${station.success}`, 'good',
              [{ label: M.collectBadge, primary: true, onClick: () => { closeMission(); resolve({ errors }); } }]);
          } else setFeedback(T(M.correctYear, { year: station.timeline[idx].year, left: station.timeline.length - nextIdx }), 'good');
        } else {
          errors++; setErrors(errors); sfx('bad');
          b.classList.remove('shake'); void b.offsetWidth; b.classList.add('shake');
          setTimeout(() => b.classList.remove('shake'), 400); // the red border is feedback for a moment, not a stain
          setFeedback(station.wrongFeedback, 'coach');
        }
      };
      list.appendChild(b);
    }
  });
}

// ---------- Station 1: match client -> product -> reason ----------
export function missionMatchClients(station, sfx) {
  return new Promise((resolve) => {
    openMission(station, T(M.kicker, { id: station.id, name: station.name }));
    let errors = 0, ci = 0;
    const body = $('mission-body');
    function renderClient() {
      const c = station.clients[ci];
      setFeedback(null);
      body.innerHTML = `<div class="mission-progress">${T(M.clientOf, { a: ci + 1, b: station.clients.length })}</div>
        <div class="client-card"><h3>${c.name}</h3><div class="client-need">${c.need}</div>
        <div class="choice-row">
          <button type="button" class="choice-btn" data-pick="term">${M.termLifeBtn}<br><small>${M.termLifeSub}</small></button>
          <button type="button" class="choice-btn" data-pick="whole">${M.wholeLifeBtn}<br><small>${M.wholeLifeSub}</small></button>
        </div><div class="reason-zone"></div></div>`;
      body.querySelectorAll('[data-pick]').forEach(btn => btn.onclick = () => {
        const pick = btn.dataset.pick;
        if (pick !== c.answer) {
          errors++; setErrors(errors); sfx('bad');
          btn.classList.add('wrong');
          setFeedback(station.productFeedback.wrongTerm, 'coach');
          return;
        }
        sfx('good'); btn.classList.add('right');
        body.querySelectorAll('[data-pick]').forEach(x => x.disabled = true);
        renderReasons(c);
      });
    }
    function renderReasons(c) {
      const zone = body.querySelector('.reason-zone');
      zone.innerHTML = `<p style="font-weight:700;margin:12px 0 8px">${M.whyFit}</p>`;
      const row = document.createElement('div'); row.className = 'choice-row';
      for (const r of c.reasons) {
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'choice-btn'; b.textContent = r.text;
        b.onclick = () => {
          if (r.ok) {
            sfx('good');
            ci++;
            if (ci >= station.clients.length) {
              setFeedback(`<strong>${M.allMatched}</strong> ${station.success}`, 'good',
                [{ label: M.collectBadge, primary: true, onClick: () => { closeMission(); resolve({ errors }); } }]);
              body.innerHTML = '';
            } else { setFeedback(M.exactlyRight, 'good'); setTimeout(renderClient, 650); }
          } else {
            errors++; setErrors(errors); sfx('bad'); b.classList.add('wrong'); b.disabled = true;
            setFeedback(r.feedback, 'coach');
          }
        };
        row.appendChild(b);
      }
      zone.appendChild(row);
    }
    renderClient();
  });
}

// ---------- Station 2: covered or not ----------
export function missionCovered(station, sfx) {
  return new Promise((resolve) => {
    openMission(station, T(M.kicker, { id: station.id, name: station.name }));
    let errors = 0, si = 0, correctFirst = 0;
    const body = $('mission-body');
    function renderScenario() {
      const sc = station.scenarios[si];
      setFeedback(null);
      body.innerHTML = `<div class="mission-progress">${T(M.scenarioOf, { a: si + 1, b: station.scenarios.length })}</div>
        <div class="client-card"><h3>${M.isItCovered}</h3><div class="client-need">${sc.text}</div>
        <div class="choice-row">
          <button type="button" class="choice-btn" data-a="true">✓ ${station.coverLabel}</button>
          <button type="button" class="choice-btn" data-a="false">✕ ${station.notCoverLabel}</button>
        </div></div>`;
      let tried = false;
      body.querySelectorAll('[data-a]').forEach(btn => btn.onclick = () => {
        const val = btn.dataset.a === 'true';
        if (val === sc.answer) {
          sfx('good');
          if (!tried) correctFirst++;
          body.querySelectorAll('[data-a]').forEach(x => x.disabled = true);
          btn.classList.add('right');
          const last = si === station.scenarios.length - 1;
          setFeedback(`<strong>${sc.answer ? station.coverLabel : station.notCoverLabel}.</strong> ${sc.why}`, 'good',
            last ? [{ label: M.collectBadge, primary: true, onClick: () => { closeMission(); resolve({ errors }); } }]
                 : [{ label: M.nextScenario, primary: true, onClick: () => { si++; renderScenario(); } }]);
        } else {
          tried = true; errors++; setErrors(errors); sfx('bad');
          btn.classList.add('wrong'); btn.disabled = true;
          setFeedback(`${M.notThisOne} ${sc.why}`, 'coach');
        }
      });
    }
    renderScenario();
  });
}
