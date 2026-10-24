// Pharmacy Journey Sim - Phase 3 journey engine, Phase 4 bilingual (EN/UR).
// One engine, driven entirely by per-scenario JSON data (src/data/*.json):
// medicine card, category, branch dialogues, checks and scoring are DATA.
// A new scenario is a new JSON file, not new code (PLAN section 7).
//
// Language (Phase 4): every data text field is {en, ur}; tx() picks the
// active one. Engine UI strings live in STRINGS below. The EN/Urdu toggle
// follows the First Policy pattern: a body class swaps the font to Noto
// Nastaliq Urdu, the panel flips to RTL, and the CURRENT step re-renders
// in the new language (panel clicks are delegated, so a pending choice
// survives the re-render).
//
// Safety rules are enforced by construction (PLAN section 2): the engine
// only ever walks the branch the data declares - a POM scenario without a
// prescription has no dispense path at all; a wrong dialogue choice shows
// the pharmacist's professional response, logs a learning moment, lowers
// confidence, and the flow continues down the SAFE branch. The unsafe
// outcome is not reachable from any button in this file.
import * as THREE from 'three';

// ---------------------------------------------------------------- language
let LANG = 'en';
export const tx = o => (o && typeof o === 'object') ? (o[LANG] ?? o.en ?? '') : (o ?? '');
const STATION_NAMES = {
  en: {
    0: 'Entrance', 1: 'Greeting counter', 2: 'The ask', 3: 'Prescription & checks',
    4: 'The dispensary', 5: 'Labelling & final check', 6: 'Counselling corner',
    7: 'Billing counter', 8: 'Exit & report',
  },
  ur: {
    0: 'داخلہ', 1: 'استقبال کاؤنٹر', 2: 'دوا مانگنا', 3: 'نسخہ اور چیک',
    4: 'ڈسپنسری', 5: 'لیبل اور آخری چیک', 6: 'مشورے کا کونا',
    7: 'بل کاؤنٹر', 8: 'رپورٹ',
  },
};
const stationName = n => STATION_NAMES[LANG][n] ?? STATION_NAMES.en[n];
const STRINGS = {
  whoAyesha: { en: 'Ayesha · Pharmacist', ur: 'عائشہ · فارماسسٹ' },
  whoYou: { en: 'You', ur: 'آپ' },
  continueBtn: { en: 'Continue', ur: 'آگے چلیں' },
  learningMoment: { en: 'Learning moment', ur: 'سیکھنے کی بات' },
  refusalBanner: { en: 'Prescription-only medicine, not supplied without a prescription', ur: 'نسخے والی دوا، بغیر نسخے نہیں مل سکتی' },
  yourRequest: { en: 'Your request', ur: 'آپ کی درخواست' },
  directionsLabel: { en: 'Directions', ur: 'طریقہ' },
  priceLabel: { en: 'Price', ur: 'قیمت' },
  askAyesha: { en: 'Ask Ayesha', ur: 'عائشہ سے پوچھیں' },
  rxCardTag: { en: 'Prescription, check it with Ayesha', ur: 'نسخہ، عائشہ کو دکھا کر چیک کریں' },
  rxPatient: { en: 'Patient', ur: 'مریض' },
  rxMedicine: { en: 'Medicine', ur: 'دوا' },
  rxDose: { en: 'Dose', ur: 'ڈوز' },
  rxPrescriber: { en: 'Prescriber', ur: 'ڈاکٹر' },
  rxDate: { en: 'Date', ur: 'تاریخ' },
  rxValid: { en: 'All five present and clear, a valid prescription', ur: 'پانچوں باتیں پوری اور صاف ہیں، نسخہ ٹھیک ہے' },
  rxHand: { en: 'Hand it to Ayesha', ur: 'عائشہ کو دیں' },
  tryBay: { en: 'Try another bay', ur: 'دوسرا خانہ چنیں' },
  pickBoxTitle: { en: 'Pick the box', ur: 'ڈبہ چنیں' },
  pickBoxBody: { en: 'Two boxes sit side by side. A good pharmacist checks the expiry date on every single pick, assembly is dispensing stage three. Which box do you take?', ur: 'دو ڈبے ساتھ ساتھ ہیں۔ اچھا فارماسسٹ ہر ڈبہ اٹھاتے وقت اس کی آخری تاریخ چیک کرتا ہے۔ یہ دوا نکالنے کا تیسرا قدم ہے۔ آپ کون سا ڈبہ لیں گے؟' },
  expiresWord: { en: 'expires', ur: 'آخری تاریخ' },
  pickedLine: { en: 'Box picked. Now I label it for you, and then I check it again against the prescription before it goes anywhere near a bag.', ur: 'ڈبہ لے لیا۔ اب میں اس پر آپ کے نام کا لیبل لگاتی ہوں، پھر تھیلے میں ڈالنے سے پہلے اسے نسخے سے دوبارہ ملا کر دیکھتی ہوں۔' },
  toLabelling: { en: 'To labelling', ur: 'لیبل لگائیں' },
  labelTag: { en: 'Dispensing label, printing…', ur: 'دوا کا لیبل چھپ رہا ہے…' },
  labelFoot: { en: 'Lab Pharmacy · Dispensed 21 October 2026 · Keep out of reach of children', ur: 'Lab Pharmacy · 21 اکتوبر 2026 کو دی گئی · بچوں سے دور رکھیں' },
  labelExplain: { en: "A label always carries: patient name, medicine and strength, directions, dispensing date and the pharmacy's name.", ur: 'لیبل پر ہمیشہ یہ ہوتا ہے: مریض کا نام، دوا اور اس کی طاقت، استعمال کا طریقہ، دینے کی تاریخ اور فارمیسی کا نام۔' },
  watchCheck: { en: 'Watch the final check', ur: 'آخری چیک دیکھیں' },
  fcMedicine: { en: 'Medicine & strength', ur: 'دوا اور طاقت' },
  fcQuantity: { en: 'Quantity', ur: 'مقدار' },
  fcLabelName: { en: 'Label name', ur: 'لیبل پر نام' },
  fcExpiry: { en: 'Expiry date', ur: 'آخری تاریخ' },
  expiredLesson: { en: 'The final check caught an expired box before it reached you. Expiry is checked twice on purpose: once at picking, once here, this is why.', ur: 'آخری چیک نے ایکسپائر ڈبہ آپ تک پہنچنے سے پہلے پکڑ لیا۔ آخری تاریخ جان بوجھ کر دو بار چیک ہوتی ہے: ایک بار اٹھاتے وقت، ایک بار یہاں۔' },
  expiredLine: { en: 'Stop, this box is past its expiry date. Good thing the final check exists: it never leaves this counter. I am replacing it with an in-date box.', ur: 'رکیں، اس ڈبے کی آخری تاریخ گزر چکی ہے۔ اچھا ہے کہ آخری چیک ہے: یہ اس کاؤنٹر سے آگے نہیں جائے گا۔ میں اسے ٹھیک تاریخ والے ڈبے سے بدل رہی ہوں۔' },
  checkedLine: { en: 'Every item checks out. This is the last gate before the medicine is bagged, it happens for every supply, every time.', ur: 'سب کچھ ٹھیک ہے۔ یہ دوا تھیلے میں جانے سے پہلے آخری چیک ہے، اور یہ ہر بار ہوتا ہے۔' },
  toCounselling: { en: 'Continue to counselling', ur: 'مشورے کی طرف چلیں' },
  checkQTag: { en: "Ayesha's check question", ur: 'عائشہ کا سوال' },
  toBilling: { en: 'Continue to billing', ur: 'بل کی طرف چلیں' },
  billTag: { en: 'Billing counter, your bill', ur: 'بل کاؤنٹر، آپ کا بل' },
  billNoteC: { en: 'The amoxicillin was not supplied. This bill is only for the alternative Ayesha suggested.', ur: 'Amoxicillin نہیں دی گئی۔ یہ بل صرف اس دوا کا ہے جو عائشہ نے بتائی تھی۔' },
  payQ: { en: 'Your medicine is in the paper bag. How would you like to pay?', ur: 'آپ کی دوا کاغذ کے تھیلے میں ہے۔ آپ پیسے کیسے دیں گے؟' },
  payCard: { en: 'Pay by card', ur: 'کارڈ سے پیسے دیں' },
  payCash: { en: 'Pay by cash', ur: 'نقد پیسے دیں' },
  receiptTag: { en: 'Receipt', ur: 'رسید' },
  paidByLabel: { en: 'Paid by', ur: 'پیسے کیسے دیے' },
  cardWord: { en: 'Card', ur: 'کارڈ' },
  cashWord: { en: 'Cash', ur: 'نقد' },
  pharmacyLabel: { en: 'Pharmacy', ur: 'فارمیسی' },
  receiptNote: { en: 'Receipt printed and tucked into the bag with your medicine. Keep it, it records what was supplied and when.', ur: 'رسید چھپ کر آپ کی دوا کے ساتھ تھیلے میں رکھ دی گئی ہے۔ اسے سنبھال کر رکھیں، اس پر لکھا ہے کہ کیا دیا گیا اور کب۔' },
  leaveBtn: { en: 'Leave the pharmacy', ur: 'فارمیسی سے جائیں' },
  reportTag: { en: 'Journey report', ur: 'سفر کی رپورٹ' },
  repTime: { en: 'Time taken', ur: 'لگا ہوا وقت' },
  repStations: { en: 'Stations visited', ur: 'دیکھے گئے اسٹیشن' },
  repConfidence: { en: 'Confidence', ur: 'اعتماد' },
  repLearning: { en: 'Learning moments', ur: 'سیکھنے کی باتیں' },
  refusalNote: { en: 'You asked for a prescription-only medicine without a prescription. It was not supplied, that is the rule working exactly as designed, and you left with a plan instead.', ur: 'آپ نے بغیر نسخے کے نسخے والی دوا مانگی۔ وہ نہیں دی گئی، یہی اصول کا صحیح کام ہے، اور آپ اس کے بدلے ایک منصوبہ لے کر گئے۔' },
  cleanNote: { en: 'A clean run, every check done the right way. Well played.', ur: 'صاف کھیل، ہر چیک صحیح طریقے سے ہوا۔ شاباش۔' },
  lessonsTitle: { en: 'What the journey taught', ur: 'اس سفر نے کیا سکھایا' },
  playAnother: { en: 'Play another scenario', ur: 'ایک اور منظر کھیلیں' },
  backToStart: { en: 'Back to start', ur: 'شروع میں واپس' },
  goalLine: { en: "Today's goal: get your medicine the right way, checked, labelled, explained and billed properly.", ur: 'آج کا ہدف: اپنی دوا صحیح طریقے سے لیں، چیک ہوئی ہوئی، لیبل لگی ہوئی، سمجھائی ہوئی اور صحیح بل کے ساتھ۔' },
  walkIn: { en: 'Walk in', ur: 'اندر چلیں' },
  introTitle: { en: 'One visit, done properly.', ur: 'ایک آمد، صحیح طریقے سے۔' },
  introBody: { en: 'Step into a working pharmacy as a customer. Ask for your medicine, live the checks a good pharmacist runs, prescription, expiry, labelling, counselling, and leave with a journey report.', ur: 'گاہک بن کر چلتی ہوئی فارمیسی میں آئیں۔ اپنی دوا مانگیں، وہ چیک خود دیکھیں جو ایک اچھا فارماسسٹ کرتا ہے: نسخہ، آخری تاریخ، لیبل، مشورہ، اور سفر کی رپورٹ لے کر جائیں۔' },
  nameLabel: { en: 'Your name (it goes on your medicine label)', ur: 'آپ کا نام (یہ آپ کی دوا کے لیبل پر لکھا جائے گا)' },
  chooseVisit: { en: 'Choose your visit', ur: 'اپنی آمد چنیں' },
  pickerTitle: { en: 'What brings you to the pharmacy?', ur: 'آپ فارمیسی کیوں آئے ہیں؟' },
  pickerFine: { en: 'Three visits, one pharmacy: an over-the-counter request, a prescription to dispense, and a request the pharmacist must refuse, kindly, and with a plan.', ur: 'تین آمدیں، ایک فارمیسی: بغیر نسخے والی دوا، دینے کے لیے ایک نسخہ، اور ایک مانگ جو فارماسسٹ کو نرمی سے اور ایک منصوبے کے ساتھ منع کرنی ہے۔' },
};
const T = k => STRINGS[k][LANG] ?? STRINGS[k].en;
// formatted strings that carry scenario data
const F = {
  hudStation: n => LANG === 'ur' ? `اسٹیشن ${n} / 8 · ${stationName(n)}` : `Station ${n} of 8 · ${stationName(n)}`,
  hudConf: v => LANG === 'ur' ? `اعتماد ${v}%` : `Confidence ${v}%`,
  rackIntro: g => LANG === 'ur'
    ? `آپ کی ${g} ڈسپنسری کے ریکس میں ہے۔ ریکس خانوں میں بٹے ہیں۔ ${g} کس خانے میں ہے؟`
    : `Your ${g} is in the dispensary racks. The racks are organised in bays. Which bay holds ${g}?`,
  bayBtn: b => LANG === 'ur' ? `خانہ ${b}` : `Bay ${b}`,
  rackWrong: b => LANG === 'ur'
    ? `یہ خانہ نہیں، یہ دوسری دوائیں ہیں۔ ہمارا خانہ ${b} ہے۔`
    : `Not this bay, these are different medicines. Ours is Bay ${b}.`,
  bayLesson: (g, b) => LANG === 'ur'
    ? `${g} خانہ ${b} میں ہے۔ خانے اس لیے بنے ہیں کہ صحیح دوا پہلی بار میں مل جائے۔ غلط خانے میں ڈھونڈنے سے مریض کا وقت ضائع ہوتا ہے۔`
    : `${g} lives in Bay ${b}. Rack bays are organised so the right medicine is found first time, hunting the wrong bay wastes the patient's wait.`,
  finalTag: rx => LANG === 'ur'
    ? `آخری چیک، ڈبہ اور ${rx ? 'نسخہ' : 'مانگ'}، ایک ایک چیز`
    : `Final check, box against ${rx ? 'prescription' : 'request'}, item by item`,
  fcMatches: rx => LANG === 'ur' ? `${rx ? 'نسخے' : 'مانگ'} سے ملتا ہے` : `matches ${rx ? 'the prescription' : 'the request'}`,
  fcExpiredVal: e => LANG === 'ur' ? `${e}، ایکسپائر` : `${e}, EXPIRED`,
  fcInDateVal: e => LANG === 'ur' ? `${e}، تاریخ کے اندر` : `${e}, in date`,
  scenNeeds: (sub, g) => LANG === 'ur' ? `${sub} · چاہیے: ${g}` : `${sub} · needs ${g}`,
  scenTop: id => LANG === 'ur' ? `منظر ${id}` : `Scenario ${id}`,
};

const STATION_CAM = {
  0: 'entrance', 1: 'counter', 2: 'counter', 3: 'counter', 4: 'racks',
  5: 'counterClose', 6: 'consultJourney', 7: 'billingCam', 8: 'entrance',
};
// scoring defaults (a beat choice may override with its own "penalty")
const PEN = { choice: 10, bay: 8, expired: 10, question: 15 };

const el = id => document.getElementById(id);
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const wait = ms => new Promise(r => setTimeout(r, ms));
const fmtTime = s => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

// ---------------------------------------------------------------- confetti
// Tiny built-in burst (canvas-confetti was in the PLAN stack but never got
// vendored in Phases 1-2; this keeps the sim dependency-free and honest).
function burstConfetti() {
  const c = document.createElement('canvas');
  c.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:60';
  c.width = innerWidth; c.height = innerHeight;
  document.body.appendChild(c);
  const x = c.getContext('2d');
  const cols = ['#00a651', '#0f766e', '#e8a13a', '#6f9fd8', '#e57373', '#9a86d8'];
  const ps = Array.from({ length: 150 }, () => ({
    x: innerWidth / 2 + (Math.random() - 0.5) * innerWidth * 0.5,
    y: innerHeight * 0.28, vx: (Math.random() - 0.5) * 9, vy: -Math.random() * 9 - 4,
    w: 5 + Math.random() * 6, h: 8 + Math.random() * 8, r: Math.random() * Math.PI,
    vr: (Math.random() - 0.5) * 0.25, col: cols[Math.floor(Math.random() * cols.length)],
  }));
  const t0 = performance.now();
  (function tick(now) {
    const t = (now - t0) / 1000;
    x.clearRect(0, 0, c.width, c.height);
    for (const p of ps) {
      p.x += p.vx; p.y += p.vy; p.vy += 0.22; p.r += p.vr;
      x.save(); x.translate(p.x, p.y); x.rotate(p.r);
      x.globalAlpha = Math.max(0, 1 - t / 2.4);
      x.fillStyle = p.col; x.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      x.restore();
    }
    if (t < 2.5) requestAnimationFrame(tick); else c.remove();
  })(t0);
}

// ---------------------------------------------------------------- engine
export function initJourney(world) {
  const { cast, props } = world;
  const panel = el('jpanel'), hud = el('hud'), fade = el('fade');
  const S = {
    mode: 'intro', // intro | picker | playing | report
    scenario: null, confidence: 100, learning: [], stationsDone: new Set(),
    startTime: 0, timerInt: null, expiredPicked: false, refusal: false,
    playerName: 'Alex', paidMethod: null, busy: false,
    station: null, rerender: null,
  };

  // ------------------------------------------------------------ movement
  function place(key, x, z, ry) {
    const m = cast.members[key]; if (!m) return;
    m.root.position.x = x; m.root.position.z = z; m.root.rotation.y = ry;
  }
  async function travel(key, x, z, ry) {
    fade.classList.add('on');
    await wait(260);
    place(key, x, z, ry);
    fade.classList.remove('on');
    await wait(120);
  }
  const POSTS = {
    playerHome: () => place('player', -1.55, -1.7, Math.PI),
    ayeshaHome: () => place('ayesha', -1.5, -3.75, 0),
  };
  async function stageFor(station) {
    if (station <= 3 || station === 5) { POSTS.playerHome(); POSTS.ayeshaHome(); }
    // Station 4 story rule: the customer NEVER enters the dispensary.
    // They wait at the counter while Ayesha fetches alone; only she crosses
    // the counter line. playRack drives the full fetch-and-return sequence.
    if (station === 4) {
      await travel('ayesha', -2.45, -4.3, Math.PI);
    }
    if (station === 6) {
      await travel('player', 6.6, -4.9, -0.9);
      place('ayesha', 5.9, -4.3, 2.24);
    }
    if (station === 7) { await travel('player', 5.9, 3.5, Math.PI); POSTS.ayeshaHome(); }
    if (station === 8) { await travel('player', 5, 4.9, Math.PI); POSTS.ayeshaHome(); }
  }

  // ------------------------------------------------------------ HUD
  function drawHudStation() {
    if (S.station == null) return;
    el('hud-station').textContent = F.hudStation(S.station);
    el('hud-dots').innerHTML = Array.from({ length: 9 }, (_, i) =>
      `<i class="${i < S.station ? 'done' : i === S.station ? 'now' : ''}"></i>`).join('');
  }
  function setStation(n) {
    S.station = n;
    S.stationsDone.add(n);
    drawHudStation();
    world.goView(STATION_CAM[n]);
  }
  function setConfidence() {
    el('hud-conf').textContent = F.hudConf(S.confidence);
    el('hud-conf').classList.toggle('low', S.confidence < 70);
  }
  function penalize(kind, lesson, where) {
    const p = PEN[kind] || 10;
    S.confidence = Math.max(0, S.confidence - p);
    S.learning.push({ lesson, where });
    setConfidence();
  }
  function startTimer() {
    S.startTime = performance.now();
    clearInterval(S.timerInt);
    S.timerInt = setInterval(() => {
      el('hud-timer').textContent = fmtTime((performance.now() - S.startTime) / 1000);
    }, 400);
    el('hud-timer').textContent = '00:00';
  }
  function stopTimer() {
    clearInterval(S.timerInt);
    return Math.round((performance.now() - S.startTime) / 1000);
  }

  // ------------------------------------------------------------ panel kit
  function showPanel(html) { panel.innerHTML = html; panel.classList.add('open'); }
  // draw(build): render a CARD now, and remember how to re-render this
  // exact step (the language toggle calls S.rerender so the step survives
  // a switch). Cards hide the bubble UI: only one voice is on screen.
  function draw(build) { hideBubbleUI(); S.rerender = () => showPanel(build()); showPanel(build()); }
  function bubble(speaker, text) {
    return `<div class="bubble ${speaker === 'ayesha' ? 'pharm' : 'you'}">
      <div class="who">${speaker === 'ayesha' ? T('whoAyesha') : T('whoYou')}</div>
      <div class="txt">${esc(text)}</div></div>`;
  }
  // Clicks are delegated on #journey-ui (panel cards AND the speech-bubble
  // choice bar): one listener routes the click to whichever step is
  // currently awaiting one, so re-rendering (language toggle) can never
  // orphan a pending choice.
  let clickWaiter = null;
  el('journey-ui').addEventListener('click', e => {
    const b = e.target.closest('button[data-i]');
    if (!b || !clickWaiter) return;
    const { sel, res } = clickWaiter; clickWaiter = null;
    document.querySelectorAll('#journey-ui ' + sel).forEach(x => x.disabled = true);
    res(b.dataset.i);
  });
  function awaitClick(selector) {
    return new Promise(res => { clickWaiter = { sel: selector, res }; });
  }

  // ------------------------------------------------------------ speech bubbles
  // Dialogue no longer lives in the side panel: the speaking character gets
  // a bubble anchored above their head, typed out character by character,
  // held for reading, then replaced by the next line. Choices and Continue
  // live in a bottom choice bar. Cards (medicine, prescription, labelling,
  // billing, report, intro, picker) stay in the panel: they are documents,
  // not speech.
  const bubblesEl = el('bubbles'), choicebar = el('choicebar');
  const _pv = new THREE.Vector3();
  let bubbleToken = 0, bubbleDiv = null, bubbleCurrent = null, choiceItems = null;
  function headWorld(key) {
    const m = cast.members[key];
    const head = m && m.bones && m.bones.Head;
    if (!head) return null;
    head.getWorldPosition(_pv);
    return { x: _pv.x, y: _pv.y + 0.34, z: _pv.z };
  }
  function trackBubble(div, key, token) {
    (function frame() {
      if (token !== bubbleToken || !div.isConnected) return;
      const hw = headWorld(key);
      if (hw) {
        _pv.set(hw.x, hw.y, hw.z).project(world.camera);
        if (_pv.z <= 1) {
          const sx = (_pv.x * 0.5 + 0.5) * innerWidth;
          const sy = (-_pv.y * 0.5 + 0.5) * innerHeight;
          const w = div.offsetWidth, h = div.offsetHeight;
          const x = Math.min(Math.max(sx, w / 2 + 8), innerWidth - w / 2 - 8);
          let y = sy - 14, below = false;
          if (y - h < 70) { y = sy + 14; below = true; }
          div.style.left = x + 'px';
          div.style.top = y + 'px';
          div.classList.toggle('below', below);
        }
      }
      requestAnimationFrame(frame);
    })();
  }
  function showBubble(key, speaker, getText) {
    bubbleToken++;
    const token = bubbleToken;
    bubbleCurrent = { key, speaker, getText };
    if (bubbleDiv) bubbleDiv.remove();
    const div = document.createElement('div');
    div.className = 'sbubble ' + (speaker === 'ayesha' ? 'pharm' : 'you');
    div.innerHTML = `<div class="who">${speaker === 'ayesha' ? T('whoAyesha') : T('whoYou')}</div>` +
      `<div class="sb-txt"></div><div class="tail"></div>`;
    bubblesEl.appendChild(div);
    bubbleDiv = div;
    requestAnimationFrame(() => div.classList.add('show'));
    trackBubble(div, key, token);
    return { div, token };
  }
  function hideBubble() {
    bubbleToken++;
    bubbleCurrent = null;
    if (bubbleDiv) { bubbleDiv.remove(); bubbleDiv = null; }
  }
  function showChoicebar(items, note) {
    choiceItems = items;
    let html = '';
    if (note) html += `<div class="${note.cls}">${note.title ? `<b>${note.title}</b>` : ''}${esc(note.text)}</div>`;
    html += items.map(it =>
      `<button class="${it.cls}" data-i="${it.i}">${esc(it.getLabel())}</button>`).join('');
    choicebar.innerHTML = html;
    choicebar.classList.add('open');
  }
  function hideChoicebar() { choiceItems = null; choicebar.classList.remove('open'); choicebar.innerHTML = ''; }
  function hideBubbleUI() { hideBubble(); hideChoicebar(); }
  // Language toggle during a bubble step: finish the current bubble instantly
  // in the new language and re-label the choice bar; the in-flight line
  // sequence continues in the new language from the next line.
  function refreshBubbleUI() {
    if (!bubbleCurrent) return;
    bubbleToken++;
    const token = bubbleToken;
    if (bubbleDiv) {
      bubbleDiv.querySelector('.who').textContent =
        bubbleCurrent.speaker === 'ayesha' ? T('whoAyesha') : T('whoYou');
      const txt = bubbleDiv.querySelector('.sb-txt');
      txt.classList.remove('caret');
      txt.textContent = bubbleCurrent.getText();
      trackBubble(bubbleDiv, bubbleCurrent.key, token);
    }
    if (choiceItems) {
      choicebar.querySelectorAll('button[data-i]').forEach(b => {
        const it = choiceItems.find(x => String(x.i) === b.dataset.i && x.cls === b.className);
        if (it) b.textContent = it.getLabel();
      });
    }
  }
  function typeCurrent(text, token) {
    return new Promise(res => {
      if (!bubbleDiv) { res(); return; }
      const txtEl = bubbleDiv.querySelector('.sb-txt');
      txtEl.classList.add('caret');
      txtEl.textContent = '';
      let i = 0;
      const iv = Math.max(12, Math.min(24, Math.floor(2800 / Math.max(1, text.length))));
      const timer = setInterval(() => {
        if (token !== bubbleToken || !bubbleDiv) { clearInterval(timer); res(); return; }
        i++;
        txtEl.textContent = text.slice(0, i);
        if (i >= text.length) {
          clearInterval(timer);
          txtEl.classList.remove('caret');
          res();
        }
      }, iv);
    });
  }
  const readHold = text => Math.min(3200, Math.max(1400, 900 + 40 * text.length));
  // Play lines in turn: type, hold, next. The last line's bubble stays up
  // for the choices that follow. Each line is {speaker, en, ur} or
  // {speaker, getText}.
  async function playLines(lines) {
    for (let li = 0; li < lines.length; li++) {
      const line = lines[li];
      const getText = line.getText || (() => tx(line));
      const key = line.speaker === 'ayesha' ? 'ayesha' : 'player';
      const { token } = showBubble(key, line.speaker, getText);
      await typeCurrent(getText(), token);
      if (li < lines.length - 1) {
        await wait(readHold(getText()));
        hideBubble();
      }
    }
    S.rerender = refreshBubbleUI;
  }
  function closePanelForDialogue() {
    panel.classList.remove('open');
    S.rerender = refreshBubbleUI;
  }

  async function playDialogue(beat, opts = {}) {
    setStation(beat.station);
    if (beat.id === 'greeting') world.gesture('ayesha', 'wave');
    closePanelForDialogue();
    await playLines(beat.lines);
    showChoicebar(
      beat.choices.map((c, i) => ({ getLabel: () => tx(c), cls: 'choice', i })),
      opts.refusal ? { cls: 'refusal-note', title: '', text: T('refusalBanner') } : null);
    const pick = Number(await awaitClick('.choice'));
    const c = beat.choices[pick];
    hideChoicebar();
    await playLines([{ speaker: 'you', en: c.en, ur: c.ur }, { speaker: 'ayesha', en: c.response.en, ur: c.response.ur }]);
    if (!c.ok) penalize('choice', tx(c.lesson), stationName(beat.station));
    showChoicebar([{ getLabel: () => T('continueBtn'), cls: 'primary', i: 0 }],
      !c.ok ? { cls: 'lesson-note', title: T('learningMoment'), text: tx(c.lesson) } : null);
    await awaitClick('.primary');
    hideBubbleUI();
  }

  // ------------------------------------------------------------ cards
  async function showMedicineCard(sc) {
    const m = sc.medicine;
    draw(() => `<div class="card med">
      <div class="card-tag">${T('yourRequest')}</div>
      <h3>${esc(tx(m.generic))} ${esc(tx(m.strength))}</h3>
      <div class="card-sub">${esc(tx(m.brand))} · ${esc(tx(m.pack))}</div>
      <div class="card-cat">${esc(tx(m.categoryLabel))}</div>
      <div class="rx-row"><span>${T('directionsLabel')}</span><b>${esc(tx(m.directions))}</b></div>
      <div class="rx-row"><span>${T('priceLabel')}</span><b>Rs ${m.price}</b></div>
      <button class="primary" data-i="0">${T('askAyesha')}</button></div>`);
    await awaitClick('.primary');
  }

  async function showPrescriptionCard(sc) {
    const rx = sc.prescription;
    draw(() => `<div class="card rx">
      <div class="card-tag">${T('rxCardTag')}</div>
      <div class="rx-row"><span>${T('rxPatient')}</span><b>${esc(tx(rx.patient))}</b></div>
      <div class="rx-row"><span>${T('rxMedicine')}</span><b>${esc(tx(rx.medicine))}</b></div>
      <div class="rx-row"><span>${T('rxDose')}</span><b>${esc(tx(rx.dose))}</b></div>
      <div class="rx-row"><span>${T('rxPrescriber')}</span><b>${esc(tx(rx.prescriber))}</b></div>
      <div class="rx-row"><span>${T('rxDate')}</span><b>${esc(tx(rx.date))}</b></div>
      <div class="rx-valid">${T('rxValid')}</div>
      <button class="primary" data-i="0">${T('rxHand')}</button></div>`);
    await awaitClick('.primary');
  }

  // ------------------------------------------------------------ dispensary
  async function playRack(sc) {
    setStation(4);
    // The customer waits at the counter; Ayesha goes into the dispensary
    // alone. The camera watches her at the racks, never the customer.
    await travel('ayesha', -2.45, -4.3, Math.PI);
    world.goView('racks');
    const m = sc.medicine;
    let bayOk = false;
    while (!bayOk) {
      closePanelForDialogue();
      await playLines([{ speaker: 'ayesha', getText: () => F.rackIntro(tx(m.generic)) }]);
      showChoicebar(['A', 'B', 'C'].map((b, i) => ({ getLabel: () => F.bayBtn(b), cls: 'choice', i })));
      const pick = ['A', 'B', 'C'][Number(await awaitClick('.choice'))];
      hideChoicebar();
      if (pick === m.bay) { bayOk = true; }
      else {
        penalize('bay', F.bayLesson(tx(m.generic), m.bay), stationName(4));
        await playLines([{ speaker: 'ayesha', getText: () => F.rackWrong(m.bay) }]);
        showChoicebar([{ getLabel: () => T('tryBay'), cls: 'primary', i: 0 }]);
        await awaitClick('.primary');
        hideBubbleUI();
      }
    }
    // Ayesha returns behind the counter with the boxes; the pick happens
    // across the counter, in front of the waiting customer.
    await travel('ayesha', -1.5, -3.75, 0);
    world.goView('counter');
    draw(() => `<div class="card">
      <div class="card-tag">${F.bayBtn(m.bay)} · ${esc(tx(m.generic))} ${esc(tx(m.strength))}</div>
      <h3>${T('pickBoxTitle')}</h3>
      <p>${T('pickBoxBody')}</p>
      <div class="choices col">
        <button class="choice" data-i="0">${esc(tx(m.brand))} ${esc(tx(m.strength))}, ${T('expiresWord')} ${esc(tx(m.validExpiry))}</button>
        <button class="choice" data-i="1">${esc(tx(m.brand))} ${esc(tx(m.strength))}, ${T('expiresWord')} ${esc(tx(m.expiredExpiry))}</button>
      </div></div>`);
    const boxPick = Number(await awaitClick('.choice'));
    S.expiredPicked = boxPick === 1;
    props.createJourneyBox(m);
    props.journeyBox.position.set(-1.5, 1.145, -3.0);
    props.journeyBox.visible = true;
    closePanelForDialogue();
    await playLines([{ speaker: 'ayesha', getText: () => T('pickedLine') }]);
    showChoicebar([{ getLabel: () => T('toLabelling'), cls: 'primary', i: 0 }]);
    await awaitClick('.primary');
    hideBubbleUI();
  }

  // ------------------------------------------------------------ labelling + final check
  async function playLabelling(sc) {
    setStation(5);
    await stageFor(5);
    const m = sc.medicine;
    draw(() => `<div class="card label">
      <div class="card-tag">${T('labelTag')}</div>
      <div class="label-paper">
        <div class="lp-name">${esc(S.playerName)}</div>
        <div class="lp-med">${esc(tx(m.generic))} ${esc(tx(m.strength))} · ${esc(tx(m.pack))}</div>
        <div class="lp-dir">${esc(tx(m.directions))}</div>
        <div class="lp-foot">${T('labelFoot')}</div>
      </div>
      <p>${T('labelExplain')}</p>
      <button class="primary" data-i="0">${T('watchCheck')}</button></div>`);
    await awaitClick('.primary');

    // final check, item by item
    const items = [
      [T('fcMedicine'), `${tx(m.generic)} ${tx(m.strength)}, ${F.fcMatches(!!sc.prescription)}`, true],
      [T('fcQuantity'), tx(m.pack), true],
      [T('fcLabelName'), S.playerName, true],
    ];
    if (S.expiredPicked) {
      items.push([T('fcExpiry'), F.fcExpiredVal(tx(m.expiredExpiry)), false]);
    } else {
      items.push([T('fcExpiry'), F.fcInDateVal(tx(m.validExpiry)), true]);
    }
    if (S.expiredPicked) penalize('expired', T('expiredLesson'), stationName(5));
    draw(() => {
      let html = `<div class="card"><div class="card-tag">${F.finalTag(!!sc.prescription)}</div><div class="checks">`;
      items.forEach(([k, v, ok]) => {
        html += `<div class="check ${ok ? 'ok' : 'bad'}"><span class="ck">${ok ? '✓' : '✕'}</span><div><b>${esc(k)}</b><div>${esc(v)}</div></div></div>`;
      });
      html += '</div>';
      if (S.expiredPicked) {
        html += `<div class="beat">${bubble('ayesha', T('expiredLine'))}</div>`;
      } else {
        html += `<div class="beat">${bubble('ayesha', T('checkedLine'))}</div>`;
      }
      return html + `<button class="primary" data-i="0">${T('toCounselling')}</button></div>`;
    });
    if (S.expiredPicked) props.journeyBox.visible = false;
    props.bagOnCounter(true);
    await awaitClick('.primary');
  }

  // ------------------------------------------------------------ counselling
  async function playCounselling(sc) {
    setStation(6);
    await stageFor(6);
    const c = sc.counselling;
    closePanelForDialogue();
    // counselling lines, then Ayesha's check question, all as speech
    await playLines([...c.lines, { speaker: 'ayesha', en: c.question.en, ur: c.question.ur }]);
    showChoicebar(c.question.choices.map((ch, i) => ({ getLabel: () => tx(ch), cls: 'choice', i })));
    const pick = Number(await awaitClick('.choice'));
    const ch = c.question.choices[pick];
    hideChoicebar();
    await playLines([{ speaker: 'you', en: ch.en, ur: ch.ur }, { speaker: 'ayesha', en: ch.response.en, ur: ch.response.ur }]);
    if (!ch.ok) penalize('question', tx(ch.lesson), stationName(6));
    showChoicebar([{ getLabel: () => T('toBilling'), cls: 'primary', i: 0 }],
      !ch.ok ? { cls: 'lesson-note', title: T('learningMoment'), text: tx(ch.lesson) } : null);
    await awaitClick('.primary');
    hideBubbleUI();
  }

  // ------------------------------------------------------------ billing
  async function playBilling(sc, med, note) {
    setStation(7);
    await stageFor(7);
    props.billBag.visible = true;
    // the till screen itself stays English, like real POS terminals
    props.setPos([[`${med.generic.en} ${med.strength.en}`, `Rs ${med.price}`], ['TOTAL', `Rs ${med.price}`]]);
    world.gesture('daniyal', 'React');
    draw(() => `<div class="card pos">
      <div class="card-tag">${T('billTag')}</div>
      <div class="bill-row"><span>${esc(tx(med.generic))} ${esc(tx(med.strength))}<br><small>${esc(tx(med.brand))} · ${esc(tx(med.pack))}</small></span><b>Rs ${med.price}</b></div>
      <div class="bill-total"><span>TOTAL</span><b>Rs ${med.price}</b></div>
      ${note ? `<p>${esc(note)}</p>` : ''}
      <p>${T('payQ')}</p>
      <div class="choices">
        <button class="choice" data-i="0">${T('payCard')}</button>
        <button class="choice" data-i="1">${T('payCash')}</button>
      </div></div>`);
    const pay = Number(await awaitClick('.choice'));
    S.paidMethod = pay === 0 ? 'card' : 'cash';
    props.setPos([[`PAID BY ${S.paidMethod.toUpperCase()}`, `Rs ${med.price}`], ['RECEIPT PRINTED', '']]);
    draw(() => `<div class="card pos">
      <div class="card-tag">${T('receiptTag')}</div>
      <div class="bill-row"><span>${esc(tx(med.generic))} ${esc(tx(med.strength))}</span><b>Rs ${med.price}</b></div>
      <div class="bill-row"><span>${T('paidByLabel')}</span><b>${S.paidMethod === 'card' ? T('cardWord') : T('cashWord')}</b></div>
      <div class="bill-row"><span>${T('pharmacyLabel')}</span><b>Lab Pharmacy</b></div>
      <p>${T('receiptNote')}</p>
      <button class="primary" data-i="0">${T('leaveBtn')}</button></div>`);
    await awaitClick('.primary');
  }

  // ------------------------------------------------------------ report
  async function playReport(sc, seconds) {
    setStation(8);
    await stageFor(8);
    const clean = S.learning.length === 0;
    const mins = fmtTime(seconds);
    draw(() => {
      let html = `<div class="card report">
      <div class="card-tag">${T('reportTag')}</div>
      <h3>${esc(tx(sc.title))}</h3>
      <div class="rep-grid">
        <div><b>${mins}</b><span>${T('repTime')}</span></div>
        <div><b>${S.stationsDone.size} / 9</b><span>${T('repStations')}</span></div>
        <div><b>${S.confidence}%</b><span>${T('repConfidence')}</span></div>
        <div><b>${S.learning.length}</b><span>${T('repLearning')}</span></div>
      </div>`;
      if (S.refusal) {
        html += `<div class="rep-note">${T('refusalNote')}</div>`;
      }
      if (clean) {
        html += `<div class="rep-clean">${T('cleanNote')}</div>`;
      } else {
        html += `<div class="rep-lessons"><b>${T('lessonsTitle')}</b>${S.learning.map(l =>
          `<div class="rep-lesson"><span>${esc(l.where)}</span>${esc(l.lesson)}</div>`).join('')}</div>`;
      }
      return html + `<p>${esc(tx(sc.ending))}</p>
      <div class="choices">
        <button class="choice primary-like" data-i="0">${T('playAnother')}</button>
        <button class="choice" data-i="1">${T('backToStart')}</button>
      </div></div>`;
    });
    if (clean) burstConfetti();
    const pick = Number(await awaitClick('.choice'));
    resetWorld();
    if (pick === 0) showPicker(); else showIntro();
  }

  function resetWorld() {
    props.billBag.visible = false;
    props.bagOnCounter(false);
    if (props.journeyBox) props.journeyBox.visible = false;
    props.setPos([['TOTAL', 'Rs 0']]);
    POSTS.playerHome(); POSTS.ayeshaHome();
    hud.classList.remove('on');
    hideBubbleUI();
    S.mode = 'intro';
    S.rerender = null;
  }

  // ------------------------------------------------------------ flows
  async function runScenario(sc) {
    S.scenario = sc; S.confidence = 100; S.learning = []; S.stationsDone = new Set();
    S.expiredPicked = false; S.refusal = false; S.paidMethod = null;
    setConfidence();
    el('hud-timer').textContent = '00:00';
    hud.classList.add('on');
    S.mode = 'playing';

    // Station 0 - entrance & orientation
    setStation(0);
    world.goView('entrance');
    draw(() => `<div class="card">
      <div class="card-tag">${F.hudStation(0)}</div>
      <h3>${esc(tx(sc.title))}</h3>
      <div class="card-sub">${esc(tx(sc.subtitle))}</div>
      <p>${esc(tx(sc.intro))}</p>
      <p>${T('goalLine')}</p>
      <button class="primary" data-i="0">${T('walkIn')}</button></div>`);
    await awaitClick('.primary');
    startTimer();

    // Beats up to the ask (stations 1-2), then the branch card, then the
    // station-3 checks - so in B the prescription is on screen BEFORE
    // Ayesha reads it aloud in the rx-check dialogue.
    for (const beat of sc.beats.filter(b => b.station <= 2)) await playDialogue(beat);
    if (sc.id === 'A') await showMedicineCard(sc);
    if (sc.prescription) await showPrescriptionCard(sc);
    for (const beat of sc.beats.filter(b => b.station === 3)) {
      await playDialogue(beat, { refusal: beat.type === 'refusal' });
    }

    if (sc.id === 'C') {
      // Refusal path: the POM is NEVER dispensed. No rack, no labelling.
      S.refusal = true;
      await playCounselling(sc);
      await playBilling(sc, sc.alternative, T('billNoteC'));
      const secs = stopTimer();
      await playReport(sc, secs);
      return;
    }

    await playRack(sc);
    await playLabelling(sc);
    await playCounselling(sc);
    await playBilling(sc, sc.medicine, null);
    const secs = stopTimer();
    await playReport(sc, secs);
  }

  // ------------------------------------------------------------ intro & picker
  const SCEN = {};
  const onProgress = world.onProgress || null;
  async function loadData() {
    // The three scenario files are independent; fetch together, not one by one.
    const ids = ['a', 'b', 'c'];
    const datas = await Promise.all(ids.map(async id => {
      const d = await (await fetch(`./src/data/scenario-${id}.json`)).json();
      if (onProgress) onProgress(`scenario-${id}.json`);
      return d;
    }));
    ids.forEach((id, i) => { SCEN[id.toUpperCase()] = datas[i]; });
  }
  function showIntro() {
    S.mode = 'intro';
    S.rerender = null;
    hud.classList.remove('on');
    showPanel(`<div class="card intro">
      <div class="card-tag">Pharmacy Journey Sim</div>
      <h3>${T('introTitle')}</h3>
      <p>${T('introBody')}</p>
      <label class="name-label">${T('nameLabel')}
        <input id="pname" type="text" maxlength="24" value="${esc(S.playerName)}"></label>
      <button class="primary" data-i="0">${T('chooseVisit')}</button></div>`);
    panel.querySelector('.primary').addEventListener('click', () => {
      const v = el('pname').value.trim();
      if (v) S.playerName = v;
      showPicker();
    }, { once: true });
  }
  function showPicker() {
    S.mode = 'picker';
    S.rerender = null;
    const cards = Object.values(SCEN).map(sc => `
      <button class="scen" data-id="${sc.id}">
        <div class="scen-top"><b>${F.scenTop(sc.id)}</b><span>${esc(tx(sc.medicine.categoryLabel))}</span></div>
        <div class="scen-title">${esc(tx(sc.title))}</div>
        <div class="scen-sub">${F.scenNeeds(esc(tx(sc.subtitle)), esc(tx(sc.medicine.generic)))}</div>
      </button>`).join('');
    showPanel(`<div class="card">
      <div class="card-tag">${T('chooseVisit')}</div>
      <h3>${T('pickerTitle')}</h3>
      <div class="scen-list">${cards}</div>
      <p class="fineprint">${T('pickerFine')}</p>
    </div>`);
    panel.querySelectorAll('.scen').forEach(b => b.addEventListener('click', () => {
      runScenario(SCEN[b.dataset.id]);
    }, { once: true }));
  }

  // ------------------------------------------------------------ language switch
  function setLang(l) {
    if (l !== 'en' && l !== 'ur') return;
    if (S.mode === 'intro') { const v = el('pname')?.value.trim(); if (v) S.playerName = v; }
    LANG = l;
    document.body.classList.toggle('lang-ur', l === 'ur');
    panel.dir = l === 'ur' ? 'rtl' : 'ltr';
    hud.dir = l === 'ur' ? 'rtl' : 'ltr';
    drawHudStation();
    setConfidence();
    if (world.onLang) world.onLang(l);
    if (S.mode === 'intro') showIntro();
    else if (S.mode === 'picker') showPicker();
    else if (S.rerender) S.rerender();
  }

  return {
    state: S,
    async start() { await loadData(); showIntro(); },
    setLang,
    lang: () => LANG,
    // QA / external drivers
    begin(id) { const sc = SCEN[id]; if (sc) runScenario(sc); },
    scenarios: SCEN,
  };
}
