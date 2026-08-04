(function(){
  const homeView = document.getElementById('homeView');
  const menuView = document.getElementById('menuView');
  const statsView = document.getElementById('statsView');
  const leaderboardsView = document.getElementById('leaderboardsView');
  const theoryView = document.getElementById('theoryView');
  const weeklyView = document.getElementById('weeklyView');
  const app = document.getElementById('app');
  const toast = document.getElementById('toast');
  const lastPlayedHero = document.getElementById('lastPlayedHero');
  const backBtn = document.getElementById('backBtn');
  const menuBackBtn = document.getElementById('menuBackBtn');
  const statsBackBtn = document.getElementById('statsBackBtn');
  const leaderboardsBackBtn = document.getElementById('leaderboardsBackBtn');
  const theoryBackBtn = document.getElementById('theoryBackBtn');
  const weeklyBackBtn = document.getElementById('weeklyBackBtn');
  const homeCardWorkouts = document.getElementById('homeCardWorkouts');
  const homeCardStats = document.getElementById('homeCardStats');
  const homeCardLeaderboards = document.getElementById('homeCardLeaderboards');
  const homeCardTheory = document.getElementById('homeCardTheory');
  const homeCardWeekly = document.getElementById('homeCardWeekly');
  const homeCardRank = document.getElementById('homeCardRank');
  const rankView = document.getElementById('rankView');
  const rankBackBtn = document.getElementById('rankBackBtn');
  const bfxContainer = document.getElementById('bfx');
  const tileLab = document.getElementById('tileReactionLab');

  const accountStrip = document.getElementById('accountStrip');
  const accountLabel = document.getElementById('accountLabel');
  const accountActionBtn = document.getElementById('accountActionBtn');
  const authModal = document.getElementById('authModal');
  const authClose = document.getElementById('authClose');
  const authTitle = document.getElementById('authTitle');
  const authModeToggle = document.getElementById('authModeToggle');
  const authStatus = document.getElementById('authStatus');
  const authSignInTabBtn = document.getElementById('authSignInTabBtn');
  const authSignUpTabBtn = document.getElementById('authSignUpTabBtn');
  const authSignInPanel = document.getElementById('authSignInPanel');
  const authSignUpPanel = document.getElementById('authSignUpPanel');
  const authForgotPanel = document.getElementById('authForgotPanel');
  const authRecoveryPanel = document.getElementById('authRecoveryPanel');
  const authSignInEmail = document.getElementById('authSignInEmail');
  const authSignInPassword = document.getElementById('authSignInPassword');
  const authSignInBtn = document.getElementById('authSignInBtn');
  const authForgotBtn = document.getElementById('authForgotBtn');
  const authSignUpEmail = document.getElementById('authSignUpEmail');
  const authSignUpPassword = document.getElementById('authSignUpPassword');
  const authSignUpConfirm = document.getElementById('authSignUpConfirm');
  const authSignUpBtn = document.getElementById('authSignUpBtn');
  const authForgotEmail = document.getElementById('authForgotEmail');
  const authForgotSendBtn = document.getElementById('authForgotSendBtn');
  const authBackToSignInBtn = document.getElementById('authBackToSignInBtn');
  const authRecoveryPassword = document.getElementById('authRecoveryPassword');
  const authRecoveryConfirm = document.getElementById('authRecoveryConfirm');
  const authRecoverySetBtn = document.getElementById('authRecoverySetBtn');
  const lbPersonalTabBtn = document.getElementById('lbPersonalTabBtn');
  const lbGlobalTabBtn = document.getElementById('lbGlobalTabBtn');
  const lbPersonalPanel = document.getElementById('lbPersonalPanel');
  const lbGlobalPanel = document.getElementById('lbGlobalPanel');
  const lbGlobalSignedOut = document.getElementById('lbGlobalSignedOut');
  const lbGlobalSignedIn = document.getElementById('lbGlobalSignedIn');
  const lbGameSelect = document.getElementById('lbGameSelect');
  const lbGlobalList = document.getElementById('lbGlobalList');

  // Every module after Reaction Lab follows the same pattern: a container div,
  // a back button, a tile in the menu, and an optional window.<id>EnterHook
  // that resets it to its start panel each time it's entered.
  const MODULES = [
    { id: 'gng', tile: 'tileGoNoGo' },
    { id: 'flk', tile: 'tileFlanker' },
    { id: 'cr', tile: 'tileChoiceReaction' },
    { id: 'frx', tile: 'tileFlashReflex' },
    { id: 'sim', tile: 'tileSimon' },
    { id: 'str', tile: 'tileStroop' },
    { id: 'mth', tile: 'tileMathSprint' },
    { id: 'odd', tile: 'tileOddOneOut' },
    { id: 'per', tile: 'tilePeripheralPing' },
    { id: 'par', tile: 'tileParityRush' },
    { id: 'siz', tile: 'tileSizeCompare' },
    { id: 'nbk', tile: 'tileSymbolMatch' },
    { id: 'ant', tile: 'tileAntiSaccade' },
    { id: 'trg', tile: 'tileTriggerDiscipline' },
    { id: 'aud', tile: 'tileAudioReflex' },
    { id: 'cnt', tile: 'tileCountRush' },
    { id: 'sme', tile: 'tileSimonEffect' },
    { id: 'fsr', tile: 'tileFeatureSearch' },
    { id: 'spl', tile: 'tileSplitFocus' },
    { id: 'grd', tile: 'tileGridRecall' },
    { id: 'clo', tile: 'tileCalloutRecall' },
    { id: 'ldr', tile: 'tileLoadoutRecall' },
    { id: 'rev', tile: 'tileSequenceReversal' },
    { id: 'bfx', tile: 'tileBaseReflex' }
  ].map(m => ({
    ...m,
    container: document.getElementById(m.id),
    tileEl: document.getElementById(m.tile),
    backBtnEl: document.getElementById(m.id + 'BackBtn')
  }));

  let toastTimer = null;
  function showToast(msg){
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 2200);
  }

  // Records a module as this session's "last played" and bumps its today-count —
  // powers the dynamic hero tile at the top of the Workouts menu.
  function trackPlay(id){
    window.KA_lastPlayed.set(id);
    window.KA_dailyRuns.increment(id);
    window.KA_streak.touch();
    renderLastPlayedHero();
    renderStreak();
  }

  function renderStreak(){
    const n = window.KA_streak.get();
    const strip = document.getElementById('streakStrip');
    document.getElementById('streakVal').textContent = n + (n === 1 ? ' DAY' : ' DAYS');
    strip.classList.toggle('zero', n === 0);
  }

  function renderLastPlayedHero(){
    const id = window.KA_lastPlayed.get();
    // Fall back to the first listed game rather than a hard-coded id — a shelved module
    // (or a stale id left in localStorage) must never leave this without a game to show.
    const game = window.KA_GAMES.find(g => g.id === id) || window.KA_GAMES[0];
    if (!game) return;
    const tileEl = document.getElementById(game.tile);
    const desc = tileEl ? tileEl.querySelector('.t-desc').textContent : '';
    document.getElementById('lastPlayedEyebrow').textContent = 'LAST PLAYED · ' + game.category.toUpperCase();
    document.getElementById('lastPlayedTitle').textContent = game.name;
    document.getElementById('lastPlayedDesc').textContent = desc;
    const runs = window.KA_dailyRuns.get(game.id);
    document.getElementById('lastPlayedStat').textContent = runs + (runs === 1 ? ' RUN' : ' RUNS');
    lastPlayedHero.dataset.gameId = game.id;
  }

  function enterLab(){
    menuView.style.display = 'none';
    app.style.display = 'block';
    trackPlay('lab');
  }

  function enterModule(mod){
    menuView.style.display = 'none';
    mod.container.style.display = 'block';
    const hook = window[mod.id + 'EnterHook'];
    if (hook) hook();
    if (mod.id === 'bfx') setBfxOrigin('menu');
    trackPlay(mod.id);
  }

  // Base Reflex is reachable from two places — the Workouts menu and the Rank screen —
  // so its exit routes back to whichever one you actually came from.
  let bfxOrigin = 'rank';
  function setBfxOrigin(origin){
    bfxOrigin = origin;
    const fromMenu = origin === 'menu';
    document.getElementById('bfxBackBtn').innerHTML = fromMenu ? '&larr; ACADEMY MENU' : '&larr; RANK';
    document.getElementById('bfxReturnRankBtn').textContent = fromMenu ? 'RETURN TO ACADEMY' : 'RETURN TO RANK';
  }
  function exitBfx(){
    if (bfxOrigin === 'menu') returnToMenu(); else returnToRank();
  }

  // Stops a module's in-flight trial loop and timers by re-running its own reset hook —
  // without this, leaving mid-run just hides the view while timers keep firing in the background.
  function stopModule(mod){
    mod.container.style.display = 'none';
    const hook = window[mod.id + 'EnterHook'];
    if (hook) hook();
  }

  function returnToMenu(){
    app.style.display = 'none';
    MODULES.forEach(stopModule);
    menuView.style.display = 'block';
  }

  function returnToHome(){
    app.style.display = 'none';
    MODULES.forEach(stopModule);
    menuView.style.display = 'none';
    statsView.style.display = 'none';
    leaderboardsView.style.display = 'none';
    theoryView.style.display = 'none';
    weeklyView.style.display = 'none';
    rankView.style.display = 'none';
    homeView.style.display = 'block';
    renderStreak();
  }

  function returnToRank(){
    MODULES.forEach(stopModule);
    rankView.style.display = 'block';
    renderRank();
  }

  function enterWorkouts(){
    homeView.style.display = 'none';
    menuView.style.display = 'block';
    renderLastPlayedHero();
  }

  function enterRank(){
    homeView.style.display = 'none';
    rankView.style.display = 'block';
    renderRank();
  }

  function enterBfx(){
    rankView.style.display = 'none';
    bfxContainer.style.display = 'block';
    const hook = window.bfxEnterHook;
    if (hook) hook();
    setBfxOrigin('rank');
    trackPlay('bfx');
  }

  function renderRank(){
    // Baseline rank — from the dedicated Base Reflex ms test.
    const best = window.KA_records.get('rank_best_avg_rt', null);
    const rank = window.KA_getRank(best);
    const badge = document.getElementById('rankBadge');
    const sub = document.getElementById('rankSub');
    if (!rank){
      badge.textContent = 'UNRANKED';
      badge.style.color = 'var(--dim)';
      sub.textContent = 'Take the Base Reflex test to get placed.';
    } else {
      badge.textContent = rank.name.toUpperCase();
      badge.style.color = rank.color;
      const idx = window.KA_RANKS.indexOf(rank);
      const next = window.KA_RANKS[idx + 1];
      sub.innerHTML = 'Best average: <b>' + best.toFixed(0) + ' ms</b>' +
        (next
          ? '<div class="rc-sub-next">Get ' + Math.max(0, best - next.max).toFixed(0) + ' ms faster to reach ' + next.name + '</div>'
          : '<div class="rc-sub-next">Top rank reached</div>');
    }
    document.getElementById('rankLadder').innerHTML = window.KA_RANKS.map(r => {
      const isCurrent = !!rank && rank.name === r.name;
      const reqText = r.max === Infinity ? 'Starting rank' : 'Avg under ' + r.max + ' ms';
      return `<div class="rank-row ${isCurrent ? 'current' : ''}"><span class="rr-name" style="color:${r.color}">${r.name}</span><span class="rr-req">${reqText}</span></div>`;
    }).join('');

    // Overall rank — aggregate across all 24 workouts.
    const overall = window.KA_getOverallRank();
    const overallBadge = document.getElementById('overallRankBadge');
    const overallSub = document.getElementById('overallRankSub');
    if (!overall){
      overallBadge.textContent = 'UNRANKED';
      overallBadge.style.color = 'var(--dim)';
      overallSub.textContent = 'Play any workout to start building your overall rank.';
    } else {
      overallBadge.textContent = overall.name.toUpperCase();
      overallBadge.style.color = overall.color;
      overallSub.textContent = overall.played + ' / ' + overall.total + ' workouts ranked';
    }

    // Category ranks.
    const categories = ['Reaction Speed', 'Processing Speed', 'Processing Complexity', 'Memory'];
    document.getElementById('categoryRanks').innerHTML = categories.map(cat => {
      const r = window.KA_getCategoryRank(cat);
      const total = window.KA_GAMES.filter(g => g.category === cat).length;
      const name = r ? r.name.toUpperCase() : 'UNRANKED';
      const color = r ? r.color : 'var(--dim)';
      const progress = (r ? r.played : 0) + ' / ' + total + ' ranked';
      return `<div class="cat-rank-card"><div class="crc-cat">${cat.toUpperCase()}</div><div class="crc-rank" style="color:${color}">${name}</div><div class="crc-progress">${progress}</div></div>`;
    }).join('');

    // Every workout, grouped by category.
    document.getElementById('workoutRanks').innerHTML = categories.map(cat => {
      const games = window.KA_GAMES.filter(g => g.category === cat);
      const rows = games.map(g => {
        const gr = window.KA_getGameRank(g);
        const name = gr ? gr.rank.name.toUpperCase() : 'UNRANKED';
        const color = gr ? gr.rank.color : 'var(--dim)';
        const value = gr ? gr.value : '—';
        return `<div class="rank-row workout-row"><span class="rr-name">${g.name}</span><span class="rr-req">${value}</span><span class="rr-tier" style="color:${color}">${name}</span></div>`;
      }).join('');
      return `<div class="workout-rank-group"><div class="wrg-title">${cat}</div>${rows}</div>`;
    }).join('');
  }
  window.__onRankTestComplete = renderRank;

  function enterStats(){
    homeView.style.display = 'none';
    statsView.style.display = 'block';
    renderStats();
  }

  function enterLeaderboards(){
    homeView.style.display = 'none';
    leaderboardsView.style.display = 'block';
    renderLeaderboards();
  }

  function enterTheory(){
    homeView.style.display = 'none';
    theoryView.style.display = 'block';
  }

  function enterWeekly(){
    homeView.style.display = 'none';
    weeklyView.style.display = 'block';
    renderWeekly();
  }

  // Jumps straight into a module from the Weekly Challenge screen, bypassing the Workouts menu.
  function playModuleById(id){
    const mod = MODULES.find(m => m.id === id);
    if (!mod) return;
    weeklyView.style.display = 'none';
    homeView.style.display = 'none';
    mod.container.style.display = 'block';
    const hook = window[id + 'EnterHook'];
    if (hook) hook();
    trackPlay(id);
  }

  function renderWeekly(){
    const now = new Date();
    const weekIndex = window.KA_getWeekIndex(now);
    const weekStart = window.KA_getWeekStart(now);
    const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);
    const msLeft = weekEnd.getTime() - now.getTime();
    const daysLeft = Math.max(0, Math.ceil(msLeft / (24 * 60 * 60 * 1000)));

    document.getElementById('weeklyCountdown').innerHTML =
      'Resets in <b>' + daysLeft + (daysLeft === 1 ? ' day' : ' days') + '</b> (Monday)';

    const pool = window.KA_WEEKLY_POOL;
    const picks = [0, 1, 2].map(i => pool[(weekIndex * 3 + i) % pool.length]);

    let clearedCount = 0;
    const grid = document.getElementById('weeklyGrid');
    grid.innerHTML = picks.map(id => {
      const game = window.KA_GAMES.find(g => g.id === id);
      const meta = window.KA_WEEKLY_META[id];
      const allTimeBest = window.KA_records.get(meta.key, null);
      const weekBest = window.KA_weekly.get(id, weekIndex, null);
      const cleared = weekBest !== null && allTimeBest !== null && weekBest >= allTimeBest;
      if (cleared) clearedCount++;
      const metric = { total: meta.total };

      return `<div class="weekly-card ${cleared ? 'cleared' : ''}">
        <span class="wc-status">${cleared ? 'CLEARED' : 'IN PROGRESS'}</span>
        <div class="wc-eyebrow">${game.category}</div>
        <div class="wc-title">${game.name}</div>
        <div class="wc-row"><span class="wc-lbl">All-time best</span><span class="wc-val">${window.KA_fmtMetric(allTimeBest, metric)}</span></div>
        <div class="wc-row wc-week"><span class="wc-lbl">This week's best</span><span class="wc-val">${window.KA_fmtMetric(weekBest, metric)}</span></div>
        <button data-module-id="${id}">PLAY</button>
      </div>`;
    }).join('');

    document.getElementById('weeklySummary').innerHTML =
      '<b>' + clearedCount + ' / 3</b> cleared this week';

    grid.querySelectorAll('button[data-module-id]').forEach(btn => {
      btn.addEventListener('click', () => playModuleById(btn.getAttribute('data-module-id')));
    });
  }

  function renderStats(){
    const grid = document.getElementById('statsGrid');
    grid.innerHTML = window.KA_GAMES.map(g => {
      let hasAny = false;
      let rows;
      if (g.metrics){
        rows = g.metrics.map(m => {
          const v = window.KA_records.get(m.key, null);
          if (v !== null) hasAny = true;
          return `<div class="sc-row"><span class="sc-lbl">${m.label}</span><span class="sc-val">${window.KA_fmtMetric(v, m)}</span></div>`;
        }).join('');
      } else {
        const v = window.KA_records.get(g.key, null);
        hasAny = v !== null;
        const label = g.type === 'rounds' ? 'Best sequence' : 'Best correct';
        rows = `<div class="sc-row"><span class="sc-lbl">${label}</span><span class="sc-val">${window.KA_fmtMetric(v, g)}</span></div>`;
      }
      return `<div class="stats-card ${hasAny ? '' : 'empty'}"><div class="sc-game">${g.name}</div>${rows}</div>`;
    }).join('');

    const feed = document.getElementById('statsActivityFeed');
    const history = window.KA_history.getAll();
    if (!history.length){
      feed.innerHTML = '<div class="activity-row"><span class="ar-summary">No runs logged yet — play a module to start building history.</span></div>';
    } else {
      feed.innerHTML = history.slice(0, 30).map(h => {
        const d = new Date(h.time);
        const timeStr = d.toLocaleDateString(undefined, { month:'short', day:'numeric' }) + ' ' + d.toLocaleTimeString(undefined, { hour:'numeric', minute:'2-digit' });
        return `<div class="activity-row"><span class="ar-game">${h.gameName}</span><span class="ar-summary">${h.summary}</span><span class="ar-time">${timeStr}</span></div>`;
      }).join('');
    }
  }

  function renderLeaderboards(){
    const accGames = window.KA_GAMES.filter(g => g.type === 'count');
    const accRows = accGames.map(g => {
      const v = window.KA_records.get(g.key, null);
      return { name: g.name, val: v, pct: v === null ? null : (v / g.total * 100) };
    }).sort((a, b) => {
      if (a.pct === null && b.pct === null) return 0;
      if (a.pct === null) return 1;
      if (b.pct === null) return -1;
      return b.pct - a.pct;
    });
    document.getElementById('lbAccuracyList').innerHTML = accRows.map((r, i) =>
      `<div class="leaderboard-row ${r.val === null ? 'unplayed' : ''}"><span class="lr-rank">${r.val === null ? '—' : '#' + (i + 1)}</span><span class="lr-game">${r.name}</span><span class="lr-val">${r.val === null ? 'NOT PLAYED' : r.pct.toFixed(0) + '%'}</span></div>`
    ).join('');

    const specialGames = window.KA_GAMES.filter(g => g.type !== 'count');
    let specialHtml = '';
    specialGames.forEach(g => {
      if (g.metrics){
        g.metrics.forEach(m => {
          const v = window.KA_records.get(m.key, null);
          specialHtml += `<div class="leaderboard-row ${v === null ? 'unplayed' : ''}"><span class="lr-rank">&#9679;</span><span class="lr-game">${g.name} — ${m.label}</span><span class="lr-val">${window.KA_fmtMetric(v, m)}</span></div>`;
        });
      } else {
        const v = window.KA_records.get(g.key, null);
        specialHtml += `<div class="leaderboard-row ${v === null ? 'unplayed' : ''}"><span class="lr-rank">&#9679;</span><span class="lr-game">${g.name}</span><span class="lr-val">${window.KA_fmtMetric(v, g)}</span></div>`;
      }
    });
    document.getElementById('lbSpecialList').innerHTML = specialHtml;
  }

  function openTile(el){
    if (el === lastPlayedHero){
      const id = el.dataset.gameId || 'lab';
      if (id === 'lab'){ enterLab(); return; }
      const lastMod = MODULES.find(m => m.id === id);
      if (lastMod) enterModule(lastMod);
      return;
    }
    if (el === tileLab){
      enterLab();
      return;
    }
    const mod = MODULES.find(m => m.tileEl === el);
    if (mod){
      enterModule(mod);
      return;
    }
    const name = (el.getAttribute('data-name') || 'This module').toUpperCase();
    showToast(name + ' — LOCKED, IN DEVELOPMENT');
  }

  document.querySelectorAll('.tile').forEach(el => {
    el.addEventListener('click', () => openTile(el));
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' '){
        e.preventDefault();
        openTile(el);
      }
    });
  });

  backBtn.addEventListener('click', returnToMenu);
  MODULES.filter(mod => mod.id !== 'bfx').forEach(mod => { mod.backBtnEl.addEventListener('click', returnToMenu); });

  document.querySelectorAll('.returnAcademyBtn').forEach(btn => {
    btn.addEventListener('click', returnToMenu);
  });

  menuBackBtn.addEventListener('click', returnToHome);
  statsBackBtn.addEventListener('click', returnToHome);
  leaderboardsBackBtn.addEventListener('click', returnToHome);
  theoryBackBtn.addEventListener('click', returnToHome);
  weeklyBackBtn.addEventListener('click', returnToHome);
  rankBackBtn.addEventListener('click', returnToHome);
  document.getElementById('bfxBackBtn').addEventListener('click', exitBfx);
  document.getElementById('bfxReturnRankBtn').addEventListener('click', exitBfx);
  document.getElementById('rankTestBtn').addEventListener('click', enterBfx);

  // "RANKS" reference button — sits next to every game's back button so players can check
  // tier thresholds without leaving. Wraps the existing back button in a flex row rather
  // than repositioning it, so it works regardless of how long each game's label is.
  function addRankRefButton(container, gameId){
    if (!container) return;
    const back = container.querySelector('.backBtn');
    if (!back) return;
    const wrap = document.createElement('div');
    wrap.className = 'back-btn-row';
    back.parentNode.insertBefore(wrap, back);
    wrap.appendChild(back);
    const btn = document.createElement('button');
    btn.className = 'ranksRefBtn';
    btn.textContent = 'RANKS';
    btn.addEventListener('click', () => openRankRef(gameId));
    wrap.appendChild(btn);
  }

  function formatRankReq(r, kind){
    if (kind === 'ms') return r.max === Infinity ? 'Starting rank' : 'Under ' + r.max + ' ms';
    if (kind === 'acc') return r.min === 0 ? 'Starting rank' : r.min + '%+';
    return r.min === 0 ? 'Starting rank' : r.min + '+ rounds';
  }

  // Returns one or two ladder sections — dual-ranked games show accuracy and speed,
  // with the speed thresholds derived from that game's own speedMid baseline.
  function rankRefInfo(gameId){
    if (gameId === 'bfx'){
      return { title: 'Base Reflex', sections: [{ heading: 'Average reaction time', ladder: window.KA_RANKS, kind: 'ms' }] };
    }
    const game = window.KA_GAMES.find(g => g.id === gameId);
    if (!game) return null;
    if (game.type === 'rounds'){
      return { title: game.name, sections: [{ heading: 'Longest sequence reached', ladder: window.KA_ROUNDS_RANKS, kind: 'rounds' }] };
    }
    if (game.type === 'mixed'){
      return { title: game.name, sections: [{ heading: 'Rounds survived', ladder: window.KA_FLASH_RANKS, kind: 'rounds' }] };
    }
    if (game.type === 'time-multi'){
      return { title: game.name, sections: [{ heading: 'Average split time', ladder: window.KA_RANKS, kind: 'ms' }] };
    }
    const sections = [{ heading: 'Accuracy', ladder: window.KA_ACC_RANKS, kind: 'acc' }];
    if (game.speedMid){
      sections.push({
        heading: 'Speed (average response)',
        kind: 'ms',
        ladder: window.KA_SPEED_FACTORS.map((f, i) => ({
          name: window.KA_RANK_NAMES[i],
          color: window.KA_RANK_COLORS[i],
          max: f === Infinity ? Infinity : Math.round(game.speedMid * f)
        }))
      });
      sections.push({ note: 'Your overall rank for this drill is the midpoint of these two.' });
    }
    return { title: game.name, sections };
  }

  function openRankRef(gameId){
    const info = rankRefInfo(gameId);
    if (!info) return;
    document.getElementById('rankRefTitle').textContent = info.title;
    document.getElementById('rankRefLadder').innerHTML = info.sections.map(sec => {
      if (sec.note) return `<div class="rank-ref-note">${sec.note}</div>`;
      const rows = sec.ladder.map(r =>
        `<div class="rank-row"><span class="rr-name" style="color:${r.color}">${r.name}</span><span class="rr-req">${formatRankReq(r, sec.kind)}</span></div>`
      ).join('');
      return `<div class="rank-ref-heading">${sec.heading}</div>${rows}`;
    }).join('');
    document.getElementById('rankRefModal').classList.add('show');
  }

  function closeRankRef(){
    document.getElementById('rankRefModal').classList.remove('show');
  }

  addRankRefButton(app, 'lab');
  MODULES.forEach(mod => addRankRefButton(mod.container, mod.id));

  document.getElementById('rankRefClose').addEventListener('click', closeRankRef);
  document.getElementById('rankRefModal').addEventListener('click', (e) => {
    if (e.target.id === 'rankRefModal') closeRankRef();
  });

  [homeCardWorkouts, homeCardStats, homeCardLeaderboards, homeCardTheory, homeCardWeekly, homeCardRank].forEach(card => {
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' '){
        e.preventDefault();
        card.click();
      }
    });
  });
  homeCardWorkouts.addEventListener('click', enterWorkouts);
  homeCardStats.addEventListener('click', enterStats);
  homeCardLeaderboards.addEventListener('click', enterLeaderboards);
  homeCardTheory.addEventListener('click', enterTheory);
  homeCardWeekly.addEventListener('click', enterWeekly);
  homeCardRank.addEventListener('click', enterRank);

  // Backup & restore — everything the app tracks (KA_records, KA_history, KA_weekly)
  // lives only in this browser's localStorage under keys prefixed 'ka_'.
  function exportStatsData(){
    const data = {};
    for (let i = 0; i < localStorage.length; i++){
      const key = localStorage.key(i);
      if (key && key.indexOf('ka_') === 0) data[key] = localStorage.getItem(key);
    }
    const payload = { app: 'Kingsmen Academy Reaction Labs', version: 1, exportedAt: new Date().toISOString(), data };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'kingsmen-academy-stats-' + new Date().toISOString().slice(0, 10) + '.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showToast('STATS EXPORTED');
  }

  function importStatsData(file){
    const reader = new FileReader();
    reader.onload = (e) => {
      let payload;
      try{ payload = JSON.parse(e.target.result); } catch(err){ showToast('IMPORT FAILED — NOT VALID JSON'); return; }
      if (!payload || typeof payload.data !== 'object'){ showToast('IMPORT FAILED — UNRECOGNIZED FILE'); return; }
      const keys = Object.keys(payload.data).filter(k => k.indexOf('ka_') === 0);
      if (!keys.length){ showToast('IMPORT FAILED — NO DATA FOUND'); return; }
      if (!window.confirm('Import ' + keys.length + ' saved entries? This overwrites your current records, history, and weekly progress in this browser.')) return;
      keys.forEach(k => localStorage.setItem(k, payload.data[k]));
      showToast('STATS IMPORTED');
      renderStats();
    };
    reader.readAsText(file);
  }

  const statsExportBtn = document.getElementById('statsExportBtn');
  const statsImportBtn = document.getElementById('statsImportBtn');
  const statsImportInput = document.getElementById('statsImportInput');
  statsExportBtn.addEventListener('click', exportStatsData);
  statsImportBtn.addEventListener('click', () => statsImportInput.click());
  statsImportInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) importStatsData(file);
    e.target.value = '';
  });

  // ---- Account (Supabase auth) ---------------------------------------------------------
  // Four panels sharing one modal: sign in, create account, forgot password, and set-new-
  // password (the last one only ever shown after following a reset-password email link).
  let showingRecovery = false;

  function setAuthStatus(msg){ authStatus.textContent = msg; authStatus.className = 'auth-status'; }
  function setAuthError(msg){ authStatus.textContent = msg; authStatus.className = 'auth-status error'; }

  // `err.message || fallback` looks safe but isn't — a cryptic-but-non-empty message (an
  // empty JSON body stringified to "{}", "[object Object]" from a non-Error throw, a network
  // failure with no useful text) is still truthy, so it slips past `||` and gets shown to the
  // player verbatim instead of falling back. This filters those out before ever displaying one.
  function authErrorMessage(err, fallback){
    const raw = err && typeof err.message === 'string' ? err.message.trim() : '';
    const useless = !raw || raw === '{}' || raw === '[object Object]' || raw.length < 3;
    if (!useless) return raw;
    console.error('auth error (showed fallback message to user):', err);
    return fallback;
  }

  function showAuthPanel(which){
    [authSignInPanel, authSignUpPanel, authForgotPanel, authRecoveryPanel].forEach(panel => {
      panel.style.display = (panel.id === which) ? '' : 'none';
    });
    const onTabbedPanel = which === 'authSignInPanel' || which === 'authSignUpPanel';
    authModeToggle.style.display = onTabbedPanel ? '' : 'none';
    authSignInTabBtn.classList.toggle('selected', which === 'authSignInPanel');
    authSignUpTabBtn.classList.toggle('selected', which === 'authSignUpPanel');
    authTitle.textContent = which === 'authRecoveryPanel' ? 'Set New Password'
      : which === 'authForgotPanel' ? 'Reset Password' : 'Account';
    authStatus.textContent = '';
    authStatus.className = 'auth-status';
  }

  function openAuthModal(){
    showingRecovery = false;
    showAuthPanel('authSignInPanel');
    authModal.classList.add('show');
    authSignInEmail.focus();
  }
  function closeAuthModal(){
    authModal.classList.remove('show');
    showingRecovery = false;
  }

  function renderAccountStrip(session){
    if (session){
      accountStrip.classList.add('signed-in');
      accountLabel.textContent = session.user.email;
      accountActionBtn.textContent = 'SIGN OUT';
    } else {
      accountStrip.classList.remove('signed-in');
      accountLabel.textContent = 'OFFLINE';
      accountActionBtn.textContent = 'SIGN IN';
    }
  }

  accountActionBtn.addEventListener('click', () => {
    if (window.KA_cloud.isSignedIn()) window.KA_cloud.signOut();
    else openAuthModal();
  });
  authClose.addEventListener('click', closeAuthModal);
  authModal.addEventListener('click', (e) => { if (e.target.id === 'authModal') closeAuthModal(); });

  authSignInTabBtn.addEventListener('click', () => showAuthPanel('authSignInPanel'));
  authSignUpTabBtn.addEventListener('click', () => showAuthPanel('authSignUpPanel'));
  authForgotBtn.addEventListener('click', () => showAuthPanel('authForgotPanel'));
  authBackToSignInBtn.addEventListener('click', () => showAuthPanel('authSignInPanel'));

  [authSignInPassword, authSignUpConfirm, authForgotEmail, authRecoveryConfirm].forEach((el, i) => {
    const submitBtns = [authSignInBtn, authSignUpBtn, authForgotSendBtn, authRecoverySetBtn];
    el.addEventListener('keydown', (e) => { if (e.key === 'Enter') submitBtns[i].click(); });
  });

  authSignInBtn.addEventListener('click', async () => {
    const email = authSignInEmail.value.trim();
    const password = authSignInPassword.value;
    if (!email || email.indexOf('@') === -1){ setAuthError('Enter a valid email.'); return; }
    if (!password){ setAuthError('Enter your password.'); return; }
    authSignInBtn.disabled = true;
    setAuthStatus('Signing in…');
    try {
      await window.KA_cloud.signInWithPassword(email, password);
    } catch (err){
      setAuthError(authErrorMessage(err, 'Sign in failed — check your connection and try again.'));
    } finally {
      authSignInBtn.disabled = false;
    }
  });

  authSignUpBtn.addEventListener('click', async () => {
    const email = authSignUpEmail.value.trim();
    const password = authSignUpPassword.value;
    const confirm = authSignUpConfirm.value;
    if (!email || email.indexOf('@') === -1){ setAuthError('Enter a valid email.'); return; }
    if (password.length < 6){ setAuthError('Password must be at least 6 characters.'); return; }
    if (password !== confirm){ setAuthError("Passwords don't match."); return; }
    authSignUpBtn.disabled = true;
    setAuthStatus('Creating account…');
    try {
      await window.KA_cloud.signUpWithPassword(email, password);
      setAuthStatus('Account created — check your email to verify it, then sign in.');
    } catch (err){
      setAuthError(authErrorMessage(err, 'Could not create account — check your connection and try again.'));
    } finally {
      authSignUpBtn.disabled = false;
    }
  });

  authForgotSendBtn.addEventListener('click', async () => {
    const email = authForgotEmail.value.trim();
    if (!email || email.indexOf('@') === -1){ setAuthError('Enter a valid email.'); return; }
    authForgotSendBtn.disabled = true;
    setAuthStatus('Sending…');
    try {
      await window.KA_cloud.sendPasswordReset(email);
      setAuthStatus('Check your email for a reset link.');
    } catch (err){
      setAuthError(authErrorMessage(err, 'Something went wrong — check your connection and try again.'));
    } finally {
      authForgotSendBtn.disabled = false;
    }
  });

  authRecoverySetBtn.addEventListener('click', async () => {
    const pw = authRecoveryPassword.value;
    const confirm = authRecoveryConfirm.value;
    if (pw.length < 6){ setAuthError('Password must be at least 6 characters.'); return; }
    if (pw !== confirm){ setAuthError("Passwords don't match."); return; }
    authRecoverySetBtn.disabled = true;
    setAuthStatus('Updating…');
    try {
      await window.KA_cloud.updatePassword(pw);
      showingRecovery = false;
      setAuthStatus("Password updated — you're signed in.");
      setTimeout(closeAuthModal, 1500);
    } catch (err){
      setAuthError(authErrorMessage(err, 'Could not update password — check your connection and try again.'));
    } finally {
      authRecoverySetBtn.disabled = false;
    }
  });

  // Reflects auth state on every load, including a silently-restored session — must not
  // have side effects like a toast, or reloading the page while signed in would show one
  // every time.
  window.KA_cloud.onAuthChange(renderAccountStrip);

  // Fires only for an actual sign-in moment (not a restored session on page load).
  window.KA_cloud.onSignedIn(() => {
    if (!showingRecovery){
      closeAuthModal();
      showToast('SIGNED IN');
    }
  });

  // The reset-password email link lands back here with a recovery session already active —
  // show the "set new password" panel instead of treating it like a normal sign-in.
  window.KA_cloud.onPasswordRecovery(() => {
    showingRecovery = true;
    authModal.classList.add('show');
    showAuthPanel('authRecoveryPanel');
  });

  // ---- Global leaderboard ---------------------------------------------------------------
  // Every active game gets a dropdown entry — two of them, accuracy and speed, for any game
  // that actually tracks both (the same 18 games KA_scoreRun ranks locally). A game with only
  // one tracked stat gets one entry. Grouped by category to keep ~40 options navigable.
  const pctFmt = total => v => Math.round((v / total) * 100) + '%';
  const msFmt = v => Math.round(v) + ' ms';
  const roundsFmt = v => Math.round(v) + ' rounds';

  function globalLeaderboardOptions(){
    const opts = [];
    window.KA_GAMES.forEach(g => {
      if (g.key){
        // Fixed-trial games: one flat accuracy key, plus a speed key if this game also
        // tracks average reaction time (same games KA_scoreRun dual-ranks locally).
        const isRounds = g.type === 'rounds';
        opts.push({
          category: g.category,
          label: g.name + (g.speedMid ? ' — Accuracy' : ''),
          key: g.key,
          higherIsBetter: true,
          format: isRounds ? roundsFmt : pctFmt(g.total)
        });
        if (g.speedMid){
          opts.push({
            category: g.category,
            label: g.name + ' — Speed',
            key: g.id + '_best_avg_rt',
            higherIsBetter: false,
            format: msFmt
          });
        }
      } else if (g.metrics){
        // Multi-metric games (Flanker's easy/full accuracy, Flash Reflex's rounds+flash time).
        g.metrics.forEach(m => {
          opts.push({
            category: g.category,
            label: g.name + ' — ' + m.label,
            key: m.key,
            higherIsBetter: !m.isTime,
            format: m.isTime ? msFmt : (m.total ? pctFmt(m.total) : roundsFmt)
          });
        });
        if (g.speedMid){
          opts.push({
            category: g.category,
            label: g.name + ' — Speed',
            key: g.id + '_best_avg_rt',
            higherIsBetter: false,
            format: msFmt
          });
        }
      }
    });
    return opts;
  }

  function renderGlobalGameOptions(){
    const opts = globalLeaderboardOptions();
    const categories = ['Reaction Speed', 'Processing Speed', 'Processing Complexity', 'Memory'];
    lbGameSelect.innerHTML = categories.map(cat => {
      const rows = opts.map((o, i) => ({ o, i })).filter(({ o }) => o.category === cat);
      if (!rows.length) return '';
      const options = rows.map(({ o, i }) => `<option value="${i}">${o.label}</option>`).join('');
      return `<optgroup label="${cat}">${options}</optgroup>`;
    }).join('');
  }

  async function loadGlobalLeaderboard(){
    const opt = globalLeaderboardOptions()[parseInt(lbGameSelect.value, 10)];
    if (!opt) return;
    lbGlobalList.innerHTML = '<div class="leaderboard-row"><span class="lr-game">Loading…</span></div>';
    const rows = await window.KA_cloud.fetchLeaderboard(opt.key, opt.higherIsBetter, 20);
    if (!rows.length){
      lbGlobalList.innerHTML = '<div class="leaderboard-row unplayed"><span class="lr-game">No scores yet — be the first.</span></div>';
      return;
    }
    lbGlobalList.innerHTML = rows.map((r, i) => {
      const name = (r.profiles && r.profiles.username) || 'Unknown';
      return `<div class="leaderboard-row"><span class="lr-rank">#${i + 1}</span><span class="lr-game">${name}</span><span class="lr-val">${opt.format(r.value)}</span></div>`;
    }).join('');
  }

  function showGlobalPanelForAuthState(){
    if (window.KA_cloud.isSignedIn()){
      lbGlobalSignedOut.style.display = 'none';
      lbGlobalSignedIn.style.display = '';
      if (!lbGameSelect.options.length) renderGlobalGameOptions();
      loadGlobalLeaderboard();
    } else {
      lbGlobalSignedOut.style.display = '';
      lbGlobalSignedIn.style.display = 'none';
    }
  }

  lbPersonalTabBtn.addEventListener('click', () => {
    lbPersonalTabBtn.classList.add('selected');
    lbGlobalTabBtn.classList.remove('selected');
    lbPersonalPanel.style.display = '';
    lbGlobalPanel.style.display = 'none';
  });
  lbGlobalTabBtn.addEventListener('click', () => {
    lbGlobalTabBtn.classList.add('selected');
    lbPersonalTabBtn.classList.remove('selected');
    lbPersonalPanel.style.display = 'none';
    lbGlobalPanel.style.display = '';
    showGlobalPanelForAuthState();
  });
  lbGameSelect.addEventListener('change', loadGlobalLeaderboard);

  renderLastPlayedHero();
  renderStreak();
})();
