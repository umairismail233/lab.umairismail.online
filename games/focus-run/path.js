(function(){
  "use strict";

  /* ================= Career Path + The Ladder =================
     Loaded after game.js. Everything here drives the game through
     window.FocusRunAPI only; free runs never touch this code path.
     Memory stays the engine: a level is complete when the player
     finishes its required sets. The player's TIME is the score, and
     the Ladder (named climbers, this device) is the competition.
     There are no rivals and no race economy any more. */

  var API = window.FocusRunAPI;
  if (!API) return;
  function $(id){ return document.getElementById(id); }
  function clamp(v, a, b){ return Math.max(a, Math.min(b, v)); }

  var GLB_URL = "https://cdn.jsdelivr.net/gh/umairismail233/3d-asset-library@main/01-characters/quaternius-ultimate-animated-character-suit-male.glb";

  /* ---------- Level table: the office career climb ----------
     Every lever tightens monotonically as the levels rise, so each
     promotion is provably tougher than the last:
       sizes:     checklist sizes of the sets to finish (items grow)
       flash:     checklist flash seconds for a 3-item set (shrinks;
                  +0.25 s per extra item in the set)
       speed:     item approach multiplier (rises)
       decoy:     added decoy probability on the 0.38 base (rises)
       barrierP:  barrier share of hazard spawns (rises)
       spawnMul:  spawn interval multiplier (falls: denser spawns)
       distracts: scheduled distraction events per level (rises)
       target:    target time in seconds. Measured clean bot times
                  (office round, 2026-10-24, best of two clean runs per
                  level): 6.4, 13.4, 17.6, 16.1, 15.7, 19.0, 17.8, 17.4,
                  19.8, 15.0 s. Targets are those times x a margin that
                  tightens level by level: x2.03, x1.94, x1.93, x1.86,
                  x1.85, x1.79, x1.74, x1.67, x1.62, x1.60. Absolute
                  seconds track real level length (higher speed shortens
                  later levels); the tightening margin is the lever. */
  var LEVELS = [
    { n: 1,  title: "Intern",            sizes: [3],    flash: 2.6, speed: 0.95, decoy: 0.00, barrierP: 0.30, spawnMul: 1.00, distracts: 1,  target: 13 },
    { n: 2,  title: "Junior Associate",  sizes: [3, 3], flash: 2.5, speed: 1.00, decoy: 0.02, barrierP: 0.34, spawnMul: 0.97, distracts: 2,  target: 26 },
    { n: 3,  title: "Associate",         sizes: [3, 4], flash: 2.4, speed: 1.03, decoy: 0.04, barrierP: 0.38, spawnMul: 0.95, distracts: 3,  target: 34 },
    { n: 4,  title: "Senior Associate",  sizes: [4, 4], flash: 2.3, speed: 1.06, decoy: 0.06, barrierP: 0.42, spawnMul: 0.93, distracts: 4,  target: 30 },
    { n: 5,  title: "Team Lead",         sizes: [4, 5], flash: 2.2, speed: 1.09, decoy: 0.08, barrierP: 0.46, spawnMul: 0.91, distracts: 5,  target: 29 },
    { n: 6,  title: "Assistant Manager", sizes: [5, 5], flash: 2.1, speed: 1.12, decoy: 0.10, barrierP: 0.50, spawnMul: 0.89, distracts: 6,  target: 34 },
    { n: 7,  title: "Manager",           sizes: [5, 5], flash: 2.0, speed: 1.15, decoy: 0.12, barrierP: 0.54, spawnMul: 0.87, distracts: 7,  target: 31 },
    { n: 8,  title: "Senior Manager",    sizes: [5, 5], flash: 1.9, speed: 1.18, decoy: 0.14, barrierP: 0.58, spawnMul: 0.85, distracts: 8,  target: 29 },
    { n: 9,  title: "Director",          sizes: [5, 5], flash: 1.8, speed: 1.21, decoy: 0.16, barrierP: 0.62, spawnMul: 0.83, distracts: 9,  target: 32 },
    { n: 10, title: "CEO",               sizes: [5, 5], flash: 1.7, speed: 1.25, decoy: 0.18, barrierP: 0.66, spawnMul: 0.80, distracts: 10, target: 24 }
  ];
  function targetTime(L){ return L.target; }
  function setsNeeded(L){ return L.sizes.length; }

  /* ---------- House records: fixed lines to chase, tagged as house ----------
     Per-level times are theirs; totals are strong but beatable (a player
     finishing every level exactly on target totals less than the top
     house record). They are never presented as real players. */
  var HOUSE = [
    { name: "Mahnoor Fatima", times: { 1: 49, 2: 84, 3: 54, 4: 86, 5: 92, 6: 63, 7: 107, 8: 118, 9: 119, 10: 106 } },
    { name: "Hamza Sheikh",   times: { 1: 50, 2: 86, 3: 55, 4: 88, 5: 94, 6: 64, 7: 108, 8: 99 } },
    { name: "Zainab Bukhari", times: { 1: 52, 2: 88, 3: 57, 4: 90, 5: 72, 6: 66 } }
  ];

  /* ---------- Persistence (this browser only, nothing leaves it) ----------
     focusRunPathV1 is now v2: { v: 2, players: { key: record },
     pendingLegacy }. A v1 save ({unlocked, stars, best}) is kept as
     pendingLegacy and adopted by the first climber who registers a
     name on this device, so old progress is never corrupted or lost.
     focusRunPlayerV1 holds the current climber: { name }. */
  var PKEY = "focusRunPathV1";
  var PLAYER_KEY = "focusRunPlayerV1";
  function freshRec(name){
    return { name: name, unlocked: 1, stars: {}, best: {}, times: {} };
  }
  function loadStore(){
    var s = null;
    try{ s = JSON.parse(localStorage.getItem(PKEY)); }catch(e){}
    if (s && s.v === 2 && s.players){
      return { v: 2, players: s.players, pendingLegacy: s.pendingLegacy || null };
    }
    var legacy = null;
    if (s && typeof s.unlocked === "number"){
      legacy = { unlocked: clamp(s.unlocked, 1, 10), stars: s.stars || {}, best: s.best || {} };
    }
    return { v: 2, players: {}, pendingLegacy: legacy };
  }
  var store = loadStore();
  function saveStore(){
    try{ localStorage.setItem(PKEY, JSON.stringify(store)); }catch(e){}
  }
  function nameKey(n){ return String(n || "").trim().replace(/\s+/g, " ").toLowerCase(); }
  var playerName = null;
  try{
    var pj = JSON.parse(localStorage.getItem(PLAYER_KEY));
    if (pj && pj.name) playerName = String(pj.name);
  }catch(e){}
  var prog = null; /* the current climber's record: {unlocked, stars, best, times} */
  function currentRec(){
    if (!playerName) return null;
    return store.players[nameKey(playerName)] || null;
  }
  function ensurePlayer(rawName){
    var display = String(rawName || "").trim().replace(/\s+/g, " ");
    var k = nameKey(display);
    if (!k) return;
    if (!store.players[k]){
      var rec = freshRec(display);
      if (store.pendingLegacy){
        rec.unlocked = store.pendingLegacy.unlocked;
        rec.stars = store.pendingLegacy.stars;
        rec.best = store.pendingLegacy.best;
        store.pendingLegacy = null;
      }
      store.players[k] = rec;
    }
    playerName = store.players[k].name;
    try{ localStorage.setItem(PLAYER_KEY, JSON.stringify({ name: playerName })); }catch(e){}
    saveStore();
    prog = store.players[k];
  }
  if (playerName) ensurePlayer(playerName);

  function totalStars(){
    if (!prog) return 0;
    var t = 0;
    for (var k in prog.stars) t += prog.stars[k] || 0;
    return t;
  }
  function starsStr(n){
    var s = "";
    for (var i = 0; i < 3; i++) s += i < n ? "★" : '<span class="off">★</span>';
    return s;
  }
  function fmtTime(s){
    if (s == null) return "—";
    var m = Math.floor(s / 60), ss = s % 60;
    return m + ":" + (ss < 10 ? "0" : "") + ss;
  }

  /* ---------- The Ladder: ranking math ----------
     Entries are every climber recorded on this device plus the three
     house records. Sort: levels completed descending, then total time
     across completed levels ascending (fastest climb first). A
     climber's total is the sum of their best time per completed
     level, so improving any level time improves the total. */
  function statsOf(times){
    var lv = 0, tot = 0;
    for (var k in times){ lv++; tot += times[k]; }
    return { levels: lv, total: lv ? tot : null };
  }
  function ladderEntries(){
    var list = [];
    HOUSE.forEach(function(h, i){
      var st = statsOf(h.times);
      list.push({ name: h.name, levels: st.levels, total: st.total, times: h.times, house: true, key: "house-" + i });
    });
    Object.keys(store.players).forEach(function(k){
      var rec = store.players[k];
      var st = statsOf(rec.times || {});
      list.push({ name: rec.name, levels: st.levels, total: st.total, times: rec.times || {}, house: false, key: k });
    });
    list.sort(function(a, b){
      if (b.levels !== a.levels) return b.levels - a.levels;
      var ta = a.total == null ? Infinity : a.total;
      var tb = b.total == null ? Infinity : b.total;
      if (ta !== tb) return ta - tb;
      return a.name < b.name ? -1 : 1;
    });
    list.forEach(function(e, i){ e.rank = i + 1; });
    return list;
  }
  function myEntry(){
    if (!playerName) return null;
    var k = nameKey(playerName);
    var list = ladderEntries();
    for (var i = 0; i < list.length; i++) if (list[i].key === k) return list[i];
    return null;
  }
  function gapText(me, top){
    if (!me || !top) return "";
    if (me.rank === 1) return "You are holding the top spot.";
    var lvGap = top.levels - me.levels;
    var parts = [];
    if (lvGap > 0) parts.push(lvGap + (lvGap === 1 ? " level" : " levels"));
    var secGap = 0;
    if (lvGap === 0){
      secGap = (top.total || 0) - (me.total || 0);
    } else {
      /* Seconds measured on shared ground: the top's best times on the
         levels I have finished, against my best times there. */
      var sg = 0, any = false;
      for (var k in me.times){
        if (top.times && top.times[k] != null){ sg += top.times[k] - me.times[k]; any = true; }
      }
      if (any && sg > 0) secGap = sg;
    }
    if (secGap > 0) parts.push(secGap + (secGap === 1 ? " second" : " seconds"));
    if (!parts.length) return "You are level with the top spot. One faster finish takes it.";
    return "The top spot is " + parts.join(" and ") + " ahead of you.";
  }

  /* ---------- Navigation for the custom screens (6 Path, 7 Result, 8 Name, 9 Ladder) ---------- */
  var CUSTOM = [6, 7, 8, 9];
  function hideCustomScreens(){
    CUSTOM.forEach(function(n){ $("screen-" + n).classList.remove("active"); });
  }
  function showCustom(n){
    for (var k = 1; k <= 5; k++) $("screen-" + k).classList.remove("active");
    hideCustomScreens();
    $("screen-" + n).classList.add("active");
    placeChar();
    window.dispatchEvent(new Event("resize"));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function goTitle(){
    hideCustomScreens();
    API.showScreen(1);
    placeChar();
  }
  /* If the player navigates with an in-game button while a custom
     screen is up, keep exactly one screen visible. */
  document.addEventListener("click", function(e){
    var t = e.target && e.target.closest && e.target.closest("[data-go]");
    if (t) hideCustomScreens();
  }, true);

  /* ---------- Name gate ----------
     No run (Free Run or Path) starts without a complete name on this
     device. The gate intercepts the game's own run buttons in the
     capture phase, before game.js sees the click. */
  function validName(v){
    var words = String(v || "").trim().split(/\s+/).filter(Boolean);
    var letters = (String(v || "").match(/[A-Za-zÀ-ɏ]/g) || []).length;
    return { ok: words.length >= 2 && letters >= 5, words: words.length, letters: letters };
  }
  function showName(){
    $("name-input").value = playerName || "";
    $("name-error").classList.remove("show");
    $("btn-name-back").hidden = !playerName;
    showCustom(8);
    setTimeout(function(){ try{ $("name-input").focus(); }catch(e){} }, 60);
  }
  function renderTitlePlayer(){
    var el = $("playing-as");
    if (playerName){
      el.hidden = false;
      $("playing-name").textContent = playerName;
    } else {
      el.hidden = true;
    }
    renderPathNote();
  }
  $("btn-name-go").addEventListener("click", function(){
    var v = $("name-input").value;
    var chk = validName(v);
    var err = $("name-error");
    if (!chk.ok){
      err.textContent = chk.words < 2
        ? "Please enter your complete name: first name and last name."
        : "That name looks too short. Please enter your complete name.";
      err.classList.add("show");
      return;
    }
    ensurePlayer(v);
    renderTitlePlayer();
    goTitle();
  });
  $("name-input").addEventListener("keydown", function(e){
    if (e.key === "Enter"){ e.preventDefault(); $("btn-name-go").click(); }
  });
  $("btn-name-back").addEventListener("click", goTitle);
  $("btn-change-name").addEventListener("click", showName);
  document.addEventListener("click", function(e){
    if (playerName) return;
    var t = e.target && e.target.closest && e.target.closest("#btn-run, #btn-how-run, #btn-again");
    if (t){
      e.preventDefault();
      e.stopPropagation();
      showName();
    }
  }, true);

  /* ---------- Path screen ---------- */
  function renderPathNote(){
    var el = $("path-note");
    if (!el) return;
    if (!prog){
      el.textContent = "10 levels, Intern to CEO. Set your name to start the climb.";
      return;
    }
    var done = Object.keys(prog.stars).length;
    if (!done && prog.unlocked === 1){
      el.textContent = "10 levels, Intern to CEO. Finish sets, set times, climb the Ladder.";
    } else if (done >= 10){
      el.textContent = "CEO reached. " + totalStars() + " of 30 stars. Replay levels to cut your total time.";
    } else {
      el.textContent = "Next: Level " + prog.unlocked + " · " + LEVELS[prog.unlocked - 1].title + " · " + totalStars() + " of 30 stars";
    }
  }
  function renderPath(){
    var track = $("path-track");
    track.innerHTML = "";
    LEVELS.forEach(function(L){
      var done = !!prog.stars[L.n];
      var open = L.n <= prog.unlocked;
      var btn = document.createElement("button");
      btn.className = "path-node " + (done ? "state-done" : open ? "state-open" : "state-locked");
      btn.setAttribute("data-level", L.n);
      if (!open) btn.disabled = true;
      var sub = setsNeeded(L) + (setsNeeded(L) === 1 ? " set" : " sets") + " · Target ~" + targetTime(L) + " s";
      if (prog.times[L.n]) sub += " · Your best " + prog.times[L.n] + " s";
      btn.innerHTML =
        '<span class="pn-badge">' + (open ? L.n : "🔒") + '</span>' +
        '<span class="pn-main">' +
          '<span class="pn-title">' + L.title + '</span>' +
          '<span class="pn-sub">' + sub + '</span>' +
          (done ? '<span class="pn-stars">' + starsStr(prog.stars[L.n]) + '</span>' : '') +
        '</span>';
      if (open){
        btn.addEventListener("click", function(){ startLevel(L.n); });
      }
      track.appendChild(btn);
    });
    $("path-stars").innerHTML = 'Stars earned: <span class="star-count">' + totalStars() + " / 30</span>" +
      " · Level " + prog.unlocked + " of 10";
  }
  $("btn-path").addEventListener("click", function(){
    if (!playerName){ showName(); return; }
    renderPath();
    showCustom(6);
  });
  $("btn-path-home").addEventListener("click", goTitle);
  $("btn-reset-progress").addEventListener("click", function(){
    if (!prog) return;
    if (!window.confirm("Reset " + prog.name + "'s Career Path progress? Their stars, unlocks and best times will be cleared.")) return;
    prog.unlocked = 1;
    prog.stars = {};
    prog.best = {};
    prog.times = {};
    saveStore();
    renderPath();
    renderPathNote();
  });

  /* ---------- Ladder screen ---------- */
  function entryLine(e){
    return e.levels + " of 10 · " + fmtTime(e.total);
  }
  function renderLadder(){
    var entries = ladderEntries();
    var myKey = playerName ? nameKey(playerName) : null;
    var podium = $("ladder-podium");
    podium.innerHTML = "";
    var podOrder = [entries[1], entries[0], entries[2]];
    podOrder.forEach(function(e, idx){
      var rank = idx === 0 ? 2 : idx === 1 ? 1 : 3;
      var d = document.createElement("div");
      d.className = "pod" + (rank === 1 ? " first" : "") + (e && e.key === myKey ? " me" : "");
      if (!e){
        d.innerHTML = '<span class="pod-rank">' + rank + '</span>' +
          '<span class="pod-name">Open spot</span>' +
          '<span class="pod-line">Be the first to claim it</span>';
      } else {
        d.innerHTML = '<span class="pod-rank">' + rank + '</span>' +
          '<span class="pod-name">' + e.name + '</span>' +
          '<span class="pod-line">' + entryLine(e) + '</span>' +
          (e.house ? '<span class="house-tag">House record</span>' : '');
      }
      podium.appendChild(d);
    });
    var list = $("ladder-list");
    list.innerHTML = "";
    for (var r = 4; r <= 13; r++){
      var e2 = entries[r - 1];
      var row = document.createElement("div");
      if (!e2){
        row.className = "ladder-row open-slot";
        row.innerHTML = '<span class="lr-rank">' + r + '</span>' +
          '<span class="lr-name">Open. Be the first to claim this spot.</span>';
      } else {
        row.className = "ladder-row" + (e2.key === myKey ? " me" : "");
        row.innerHTML = '<span class="lr-rank">' + r + '</span>' +
          '<span class="lr-name">' + e2.name + (e2.house ? ' <span class="house-tag">House record</span>' : '') + '</span>' +
          '<span class="lr-line">' + entryLine(e2) + '</span>';
      }
      list.appendChild(row);
    }
  }
  function openLadder(opts){
    if (!playerName){ showName(); return; }
    renderLadder();
    var line = $("ladder-climb-line");
    if (line){
      if (opts && opts.climbMsg){ line.textContent = opts.climbMsg; line.classList.add("show"); }
      else { line.textContent = ""; line.classList.remove("show"); }
    }
    showCustom(9);
    if (opts && opts.focusMe){
      setTimeout(function(){
        var me = document.querySelector("#screen-9 .pod.me, #screen-9 .ladder-row.me");
        if (me){
          me.classList.add("pulse");
          try{ me.scrollIntoView({ block: "center", behavior: "smooth" }); }catch(e){}
        }
      }, 90);
    }
  }
  $("btn-ladder").addEventListener("click", openLadder);
  $("btn-ladder-path").addEventListener("click", openLadder);
  $("btn-ladder-path2").addEventListener("click", function(){
    renderPath();
    showCustom(6);
  });
  $("btn-ladder-home").addEventListener("click", goTitle);

  /* ---------- Level flow (no rivals: sets + time are the whole story) ---------- */
  var race = null;

  function onGameEndRun(reason){
    if (!race || race.finished) return false;
    if (reason === "win"){ finishLevel(true, "win"); return true; }
    if (reason === "crash"){ finishLevel(false, "crash"); return true; }
    if (reason === "strikes"){ finishLevel(false, "strikes"); return true; }
    if (reason === "ended"){ openQuit(); return true; }
    return false;
  }

  function startLevel(n){
    clearRace();
    var L = LEVELS[n - 1];
    race = {
      level: L, finished: false, started: false, startStamp: 0,
      errors: 0, prevStrikes: 0, prevSlow: 0, win: false, reason: null, stars: 0,
      sheetOpen: false, pausedTotal: 0, pauseStart: 0,
      finalScore: 0, finalSets: 0, finalTime: 0, ladderFrom: null, ladderTo: null,
      autoTimer: null
    };
    API.setPace(L.speed, L.decoy);
    API.setLevel({ flashMs: Math.round(L.flash * 1000), barrierP: L.barrierP, spawnMul: L.spawnMul, distracts: L.distracts });
    API.setEndHook(onGameEndRun);
    $("btn-end").textContent = "Quit";
    hideCustomScreens();
    API.startRaceRun(L.sizes);
  }

  function clearRace(){
    cancelAuto();
    API.setEndHook(null);
    API.setPace(1, 0);
    API.setLevel(null);
    API.setPaused(false);
    $("quit-sheet").classList.remove("show");
    $("btn-end").textContent = "End";
    race = null;
  }

  function finishLevel(win, reason){
    if (!race || race.finished) return;
    var before = myEntry();
    race.finished = true;
    race.win = win;
    race.reason = reason;
    race.ladderFrom = before ? before.rank : null;
    var g = API.game();
    var now = performance.now();
    race.finalScore = g ? g.score : 0;
    race.finalSets = g ? g.setsDone : 0;
    race.finalTime = race.startStamp
      ? Math.max(1, Math.round((now - race.startStamp - race.pausedTotal) / 1000))
      : 0;
    if (g && g.running) API.stopRun();
    var n = race.level.n;
    if (win){
      race.stars = race.errors === 0 ? 3 : (race.errors <= 2 ? 2 : 1);
      if (!prog.stars[n] || prog.stars[n] < race.stars) prog.stars[n] = race.stars;
      if (n >= prog.unlocked && n < 10) prog.unlocked = n + 1;
      if (!prog.times[n] || race.finalTime < prog.times[n]) prog.times[n] = race.finalTime;
    }
    if (!prog.best[n] || race.finalScore > prog.best[n]) prog.best[n] = race.finalScore;
    saveStore();
    var after = myEntry();
    race.ladderTo = after ? after.rank : null;
    renderPathNote();
    API.setEndHook(null);
    API.setPace(1, 0);
    API.setLevel(null);
    $("btn-end").textContent = "End";
    var delay = reason === "sets" ? 1200 : (reason === "win" ? 900 : 650);
    var r = race;
    setTimeout(function(){ if (race === r) showResult(); }, delay);
  }

  /* ---------- Auto-Ladder after a win ----------
     A completed level shows its result first; after a short beat the
     game itself takes the player to the Ladder so they see where the
     finish put them. Any button cancels the wait; a tap elsewhere on
     the result skips it. Fails and Free Runs never auto-advance. */
  function cancelAuto(){
    if (race && race.autoTimer){ clearTimeout(race.autoTimer); race.autoTimer = null; }
  }
  function advanceToLadder(r){
    if (race !== r || !r.finished || !r.win) return;
    r.autoTimer = null;
    if (!$("screen-7").classList.contains("active")) return;
    var msg = (r.ladderTo != null && r.ladderFrom != null && r.ladderTo < r.ladderFrom)
      ? "You climbed to #" + r.ladderTo + " on the Ladder." : null;
    openLadder({ focusMe: true, climbMsg: msg });
  }

  function showResult(){
    if (!race || !race.finished) return;
    var onRunScreens = $("screen-2").classList.contains("active") || $("screen-3").classList.contains("active");
    if (!onRunScreens && !$("screen-7").classList.contains("active")) return; /* user navigated away */
    var L = race.level, win = race.win;
    var titles = {
      sets: "Level complete!",
      win: "Level complete!",
      strikes: "Three strikes",
      crash: "Crash",
      quit: "Level quit",
      ended: "Level quit"
    };
    $("race-title").textContent = titles[race.reason] || "Level over";
    var sub;
    if (win){
      sub = "Level " + L.n + " · " + L.title + " complete. Every set landed from memory.";
    } else if (race.reason === "strikes"){
      sub = "Three list items slipped past. Finish the sets to complete this level.";
    } else if (race.reason === "crash"){
      sub = "You hit a barrier. Dodge the red cards and finish the sets to complete this level.";
    } else {
      sub = "You quit this level. It counts as a fail. Your finished levels and times are safe.";
    }
    $("race-sub").textContent = sub;
    $("race-stars").innerHTML = win ? starsStr(race.stars) : '<span class="off">★★★</span>';
    $("race-score").textContent = race.finalScore;
    $("race-time").textContent = race.finalTime + " s";
    $("race-sets").textContent = race.finalSets + " of " + setsNeeded(L);
    $("race-errors").textContent = race.errors + (race.errors === 1 ? " slip" : " slips");
    var target = targetTime(L);
    $("race-target").textContent = "Level target time: " + target + " s." +
      (win ? (race.finalTime <= target ? " You beat it." : " Beat it on the replay to climb faster.") : "");
    var line = $("race-ladder-line");
    if (win && race.ladderTo != null && race.ladderFrom != null && race.ladderTo < race.ladderFrom){
      line.textContent = "You climbed to #" + race.ladderTo + " on the Ladder.";
      line.classList.add("show");
    } else {
      line.textContent = "";
      line.classList.remove("show");
    }
    var nextBtn = $("btn-next-level");
    if (win && L.n < 10){
      nextBtn.style.display = "";
      nextBtn.textContent = "Next Level · " + LEVELS[L.n].title;
    } else {
      nextBtn.style.display = "none";
    }
    showCustom(7);
    if (win){
      var r = race;
      cancelAuto();
      r.autoTimer = setTimeout(function(){ advanceToLadder(r); }, 2800);
    }
  }
  /* A tap on the result: buttons cancel the auto-advance (their own
     handlers run), a tap anywhere else skips the wait. */
  $("screen-7").addEventListener("click", function(e){
    if (!race || !race.finished || !race.win || !race.autoTimer) return;
    if (e.target.closest("button")){ cancelAuto(); return; }
    clearTimeout(race.autoTimer);
    race.autoTimer = null;
    advanceToLadder(race);
  });
  $("btn-next-level").addEventListener("click", function(){
    if (race && race.level.n < 10) startLevel(race.level.n + 1);
  });
  $("btn-replay").addEventListener("click", function(){
    if (race) startLevel(race.level.n);
  });
  $("btn-to-path").addEventListener("click", function(){
    clearRace();
    renderPath();
    showCustom(6);
  });
  $("btn-to-ladder").addEventListener("click", openLadder);

  /* ---------- Quit sheet: your standing, before you give up the level ---------- */
  var quitSheet = $("quit-sheet");
  function openQuit(){
    if (!race || race.finished || race.sheetOpen) return;
    if (!API.game()) return;
    race.sheetOpen = true;
    race.pauseStart = performance.now();
    API.setPaused(true);
    var me = myEntry();
    var top = ladderEntries()[0];
    $("quit-pos").textContent = me
      ? "You are #" + me.rank + " on the Ladder right now."
      : "You are not on the Ladder yet.";
    $("quit-gap").textContent = me && top ? gapText(me, top) : "";
    quitSheet.classList.add("show");
  }
  function closeQuitSheet(){
    if (!race || !race.sheetOpen) return;
    race.sheetOpen = false;
    quitSheet.classList.remove("show");
    race.pausedTotal += performance.now() - race.pauseStart;
    var g = API.game();
    if (g && g.phaseUntil) g.phaseUntil += performance.now() - race.pauseStart;
    API.setPaused(false);
  }
  $("btn-keep-playing").addEventListener("click", function(){ closeQuitSheet(); });
  $("btn-quit-level").addEventListener("click", function(){
    if (!race || !race.sheetOpen) return;
    race.sheetOpen = false;
    quitSheet.classList.remove("show");
    race.pausedTotal += performance.now() - race.pauseStart;
    API.setPaused(false);
    finishLevel(false, "quit");
  });

  /* ---------- Level poll: errors, set completion, navigate-away ---------- */
  var lastPoll = 0;
  function poll(ts){
    requestAnimationFrame(poll);
    if (!race || race.finished){ lastPoll = ts; return; }
    var g = API.game();
    if (!g){ lastPoll = ts; return; }
    lastPoll = ts;
    var now = performance.now();

    /* Navigated away mid-level (in-game navigation, Home): cancel
       quietly so no hook or pace knob leaks into a later free run. */
    var onRunScreens = $("screen-2").classList.contains("active") || $("screen-3").classList.contains("active");
    if (!onRunScreens){ clearRace(); return; }

    if (!race.started){
      if (g.running){ race.started = true; race.startStamp = now; }
      else return;
    }
    if (race.sheetOpen) return;

    /* Error accounting: strikes and decoy slow-beats are the slips. */
    if (g.strikes !== race.prevStrikes){
      var d = g.strikes - race.prevStrikes;
      if (d > 0) race.errors += d;
      race.prevStrikes = g.strikes;
    }
    if (g.slowUntil !== race.prevSlow){
      if (g.slowUntil > now) race.errors += 1;
      race.prevSlow = g.slowUntil;
    }

    /* Completion: the required sets are done. Time is the score. */
    if (g.setsDone >= setsNeeded(race.level)){ finishLevel(true, "sets"); return; }
  }
  requestAnimationFrame(poll);

  /* ---------- One character everywhere: the suit runner ----------
     A single stage element moves between the slots on the Title, Name,
     Result, Summary and Ladder screens. It shows a rendered still of
     the exact GLB character first, then upgrades to a small live 3D
     canvas (same GLB, Idle clip) when WebGL allows. If it cannot go
     live, the still stays: the same face everywhere either way. The
     2D sprite survives only as the in-run WebGL fallback in game.js. */
  var charStage = null, char3 = null;
  /* Same dress shoes as the in-game runner (game.js addShoes): real
     shells on the foot bones, because the GLB's feet are a near-black
     stub on the suit's shared palette cell. Fit boxes measured off the
     exact GLB; keep the two copies in step. */
  var SHOE_FIT = {
    FootL: { min: [-0.0477, -0.0604, -0.0532], max: [0.0536, 0.0316, 0.0451] },
    FootR: { min: [-0.0536, -0.0500, -0.0423], max: [0.0478, 0.0311, 0.0684] }
  };
  function addShoes(root){
    if (!window.THREE) return;
    ["FootL", "FootR"].forEach(function(name){
      var bone = root.getObjectByName(name);
      var fit = SHOE_FIT[name];
      if (!bone || !fit) return;
      var bq = new THREE.Quaternion();
      bone.getWorldQuaternion(bq);
      var relMin = fit.min, relMax = fit.max;
      var W = (relMax[0] - relMin[0]) + 0.036;
      var L = (relMax[2] - relMin[2]) + 0.046;
      var cx = (relMin[0] + relMax[0]) / 2;
      var cz = (relMin[2] + relMax[2]) / 2 + 0.012;
      var soleH = 0.036, soleBot = relMin[1] - 0.006;
      var upH = (relMax[1] - soleBot - soleH) + 0.030;
      var grp = new THREE.Group();
      grp.quaternion.copy(bq).invert();
      var soleMat = new THREE.MeshLambertMaterial({ color: 0xE7DFC9 });
      var upMat = new THREE.MeshLambertMaterial({ color: 0x503018 });
      var toeSole = new THREE.Mesh(new THREE.BoxGeometry(W, soleH, L * 0.56), soleMat);
      toeSole.position.set(cx, soleBot + soleH / 2, cz + L * 0.20);
      grp.add(toeSole);
      var heelSole = new THREE.Mesh(new THREE.BoxGeometry(W, soleH, L * 0.32), soleMat);
      heelSole.position.set(cx, soleBot + soleH / 2, cz - L * 0.32);
      grp.add(heelSole);
      var upper = new THREE.Mesh(new THREE.BoxGeometry(W * 0.96, upH, L * 0.78), upMat);
      upper.position.set(cx, soleBot + soleH + upH / 2, cz - L * 0.09);
      grp.add(upper);
      var toe = new THREE.Mesh(new THREE.BoxGeometry(W * 0.90, upH * 0.52, L * 0.36), upMat);
      toe.position.set(cx, soleBot + soleH + upH * 0.26, cz + L * 0.30);
      grp.add(toe);
      bone.add(grp);
    });
  }
  function buildCharStage(){
    charStage = document.createElement("div");
    charStage.className = "char-stage";
    var img = document.createElement("img");
    img.src = "data:image/webp;base64,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";
    img.alt = "Focus Run runner in his suit";
    charStage.appendChild(img);
    placeChar();
    var obs = new MutationObserver(function(){ placeChar(); });
    document.querySelectorAll(".screen").forEach(function(s){
      obs.observe(s, { attributes: true, attributeFilter: ["class"] });
    });
  }
  function placeChar(){
    if (!charStage) return;
    var slot = document.querySelector(".screen.active [data-char-slot]");
    if (slot && charStage.parentElement !== slot) slot.appendChild(charStage);
  }
  function initChar3D(){
    if (char3 || !charStage || !window.THREE || !THREE.GLTFLoader) return;
    var renderer;
    try{
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    }catch(e){ return; }
    if (!renderer) return;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(240, 240, false);
    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(40, 1, 0.1, 50);
    camera.position.set(0, 1.25, 3.6);
    camera.lookAt(0, 0.98, 0);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x8a6d3b, 1.15));
    var dl = new THREE.DirectionalLight(0xffffff, 0.9);
    dl.position.set(3, 7, 5);
    scene.add(dl);
    var rim = new THREE.DirectionalLight(0xdfe8ff, 0.7);
    rim.position.set(-2, 4, -6);
    scene.add(rim);
    var fill = new THREE.DirectionalLight(0xffffff, 0.35);
    fill.position.set(0, 2, 6);
    scene.add(fill);
    var mgr = new THREE.LoadingManager();
    var loader = new THREE.GLTFLoader(mgr);
    try{ loader.setMeshoptDecoder(window.MeshoptDecoder); }catch(e){}
    loader.load(GLB_URL, function(gltf){
      try{
        var obj = gltf.scene;
        addShoes(obj);
        obj.rotation.y = Math.PI;
        obj.traverse(function(o){ if (o.isMesh) o.frustumCulled = false; });
        scene.add(obj);
        var mixer = new THREE.AnimationMixer(obj);
        var clip = null, i;
        for (i = 0; i < gltf.animations.length; i++) if (gltf.animations[i].name === "Idle") clip = gltf.animations[i];
        if (!clip) for (i = 0; i < gltf.animations.length; i++) if (gltf.animations[i].name === "Run") clip = gltf.animations[i];
        if (clip) mixer.clipAction(clip).play();
        /* Normalize on the POSED skinned meshes: Box3.setFromObject
           under-measures this rig (same framing as the still). */
        mixer.update(0.05);
        obj.updateMatrixWorld(true);
        var box = new THREE.Box3(), tmp = new THREE.Box3(), any = false;
        obj.traverse(function(o){
          if (o.isSkinnedMesh && o.computeBoundingBox){
            o.computeBoundingBox();
            tmp.copy(o.boundingBox).applyMatrix4(o.matrixWorld);
            if (any) box.union(tmp); else { box.copy(tmp); any = true; }
          }
        });
        if (!any) box.setFromObject(obj);
        var height = Math.max(0.5, box.max.y - box.min.y);
        var s = 2.0 / height;
        var cx = (box.max.x + box.min.x) / 2, cz = (box.max.z + box.min.z) / 2;
        obj.scale.setScalar(s);
        obj.position.set(-cx * s, -box.min.y * s, -cz * s);
        charStage.appendChild(renderer.domElement);
        charStage.classList.add("live");
        char3 = { mixer: mixer, renderer: renderer, scene: scene, camera: camera, last: 0 };
        requestAnimationFrame(charTick);
      }catch(e){ /* the still stays */ }
    }, undefined, function(){ /* the still stays */ });
  }
  function charTick(ts){
    if (!char3) return;
    requestAnimationFrame(charTick);
    var scr = charStage.closest(".screen");
    if (document.hidden || !scr || !scr.classList.contains("active")){ char3.last = ts; return; }
    var dt = Math.min(0.05, char3.last ? (ts - char3.last) / 1000 : 0.016);
    char3.last = ts;
    char3.mixer.update(dt);
    char3.renderer.render(char3.scene, char3.camera);
  }

  /* ---------- QA / debug handle (mirrors window.FocusRun3D) ---------- */
  window.FocusRunPath = {
    levels: LEVELS,
    progress: function(){ return prog; },
    store: function(){ return store; },
    player: function(){ return playerName; },
    ladder: ladderEntries,
    myRank: function(){ var e = myEntry(); return e ? e.rank : null; },
    state: function(){
      if (!race) return null;
      return {
        level: race.level.n, started: race.started, finished: race.finished,
        win: race.win, reason: race.reason, errors: race.errors,
        sheetOpen: race.sheetOpen, time: race.finalTime || null
      };
    },
    startLevel: startLevel,
    openQuit: openQuit
  };

  buildCharStage();
  renderTitlePlayer();
  if (!playerName) showName();
  else placeChar();
  setTimeout(initChar3D, 1200);
})();
