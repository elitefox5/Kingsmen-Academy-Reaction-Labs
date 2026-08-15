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
  const accountUsernameBtn = document.getElementById('accountUsernameBtn');
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
  const authSignUpUsername = document.getElementById('authSignUpUsername');
  const authUsernameStatus = document.getElementById('authUsernameStatus');
  const authSignUpPassword = document.getElementById('authSignUpPassword');
  const authSignUpConfirm = document.getElementById('authSignUpConfirm');
  const authSignUpBtn = document.getElementById('authSignUpBtn');
  const authForgotEmail = document.getElementById('authForgotEmail');
  const authForgotSendBtn = document.getElementById('authForgotSendBtn');
  const authBackToSignInBtn = document.getElementById('authBackToSignInBtn');
  const authRecoveryPassword = document.getElementById('authRecoveryPassword');
  const authRecoveryConfirm = document.getElementById('authRecoveryConfirm');
  const authRecoverySetBtn = document.getElementById('authRecoverySetBtn');
  const authAccountPanel = document.getElementById('authAccountPanel');
  const authAccountEmail = document.getElementById('authAccountEmail');
  const authAccountUsername = document.getElementById('authAccountUsername');
  const authAccountUsernameStatus = document.getElementById('authAccountUsernameStatus');
  const authAccountSaveBtn = document.getElementById('authAccountSaveBtn');
  const lbPersonalTabBtn = document.getElementById('lbPersonalTabBtn');
  const lbGlobalTabBtn = document.getElementById('lbGlobalTabBtn');
  const lbPersonalPanel = document.getElementById('lbPersonalPanel');
  const lbGlobalPanel = document.getElementById('lbGlobalPanel');
  const lbGlobalSignedOut = document.getElementById('lbGlobalSignedOut');
  const lbGlobalSignedIn = document.getElementById('lbGlobalSignedIn');
  const lbGlobalSections = document.getElementById('lbGlobalSections');

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
    // Baseline rank — from the dedicated Base Reflex ms test. Master requires that best-ever
    // run to have been error-free (see KA_getRank) — an older best with no recorded _clean
    // flag defaults to not-clean, the safe direction.
    const best = window.KA_records.get('rank_best_avg_rt', null);
    const bestClean = window.KA_records.get('rank_best_avg_rt_clean', 0);
    const rank = window.KA_getRank(best, !bestClean);
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
      // idx is -1 for the hidden Master tier (a freshly-built object, never a member of
      // KA_RANKS) — treat it the same as "no next rank" rather than wrapping to Copper.
      const next = idx === -1 ? undefined : window.KA_RANKS[idx + 1];
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

  // Same per-mode breakdown the global leaderboard uses (one row per Normal/Hard/Easy/
  // Adaptive variant, not one blended-best row per game), but reading straight from local
  // KA_records instead of hitting the network, and carrying a computed rank tier instead of
  // a dataKey for a cloud fetch. The per-mode accuracy+speed values only exist locally once
  // a run has cleared the global leaderboard's 80% accuracy gate (that's the only place
  // KA_scoreRun writes a mode-suffixed bundle) — a mode with no qualifying run yet shows as
  // such rather than silently falling back to some other mode's number.
  function personalLeaderboardEntries(){
    const opts = [];
    window.KA_GAMES.forEach(g => {
      if (g.adaptiveKey){
        const v = window.KA_records.get(g.adaptiveKey, null);
        const fmt = ADAPTIVE_UNIT_FMT[g.adaptiveUnit] || msFmt;
        const hadErrors = g.adaptiveAccuracyRelevant && !window.KA_records.get(g.adaptiveKey + '_clean', 0);
        opts.push({
          category: g.category, label: g.name + ' — Adaptive', played: v !== null,
          valueText: v === null ? 'NOT PLAYED' : fmt(v),
          rank: v === null ? null : window.KA_getAdaptiveRank(g.id, v, hadErrors)
        });
      }
      if (g.key){
        const isRounds = g.type === 'rounds';
        if (g.speedMid && !isRounds){
          const modes = g.modes || [null];
          modes.forEach(mode => {
            const suffix = mode ? '_' + mode : '';
            const label = g.name + (mode ? ' — ' + titleCase(mode) : '');
            const acc = window.KA_records.get(g.id + '_rank_acc' + suffix, null);
            const speed = window.KA_records.get(g.id + '_rank_speed' + suffix, null);
            const played = acc !== null && speed !== null;
            const rank = played ? window.KA_combineRanks(window.KA_getAccRank(acc), window.KA_getSpeedRank(speed, g)) : null;
            opts.push({
              category: g.category, label, played,
              valueText: played ? Math.round(acc) + '% · ' + Math.round(speed) + ' ms' : 'NO QUALIFYING RUN YET',
              rank
            });
          });
        } else {
          const v = window.KA_records.get(g.key, null);
          const played = v !== null;
          let rank = null, valueText = 'NOT PLAYED';
          if (played){
            if (isRounds){
              rank = window.KA_getRoundsRank(v);
              valueText = Math.round(v) + ' rounds';
            } else {
              const pct = (v / g.total) * 100;
              rank = window.KA_getAccRank(pct);
              valueText = Math.round(pct) + '%';
            }
          }
          opts.push({ category: g.category, label: g.name, played, valueText, rank });
        }
      } else if (g.metrics){
        if (g.id === 'flk'){
          (g.modes || ['easy', 'full']).forEach(mode => {
            const suffix = '_' + mode;
            const label = g.name + ' — ' + titleCase(mode);
            const acc = window.KA_records.get(g.id + '_rank_acc' + suffix, null);
            const speed = window.KA_records.get(g.id + '_rank_speed' + suffix, null);
            const played = acc !== null && speed !== null;
            const rank = played ? window.KA_combineRanks(window.KA_getAccRank(acc), window.KA_getSpeedRank(speed, g)) : null;
            opts.push({
              category: g.category, label, played,
              valueText: played ? Math.round(acc) + '% · ' + Math.round(speed) + ' ms' : 'NO QUALIFYING RUN YET',
              rank
            });
          });
        } else if (g.type === 'time-multi'){
          const times = g.metrics.map(m => window.KA_records.get(m.key, null)).filter(t => t !== null);
          const played = times.length > 0;
          const avgMs = played ? times.reduce((a, b) => a + b, 0) / times.length : null;
          const anyDirty = g.metrics.some(m => window.KA_records.get(m.key, null) !== null && !window.KA_records.get(m.key + '_clean', 0));
          opts.push({
            category: g.category, label: g.name, played,
            valueText: played ? Math.round(avgMs) + ' ms' : 'NOT PLAYED',
            rank: played ? window.KA_getRank(avgMs, anyDirty) : null
          });
        } else {
          // Flash Reflex: rounds survived + fastest flash beaten.
          const roundsMetric = g.metrics.find(m => !m.isTime);
          const timeMetric = g.metrics.find(m => m.isTime);
          const v = roundsMetric ? window.KA_records.get(roundsMetric.key, null) : null;
          const flash = timeMetric ? window.KA_records.get(timeMetric.key, null) : null;
          const played = v !== null;
          opts.push({
            category: g.category, label: g.name, played,
            valueText: played ? Math.round(v) + ' rounds' + (flash !== null ? ' · ' + Math.round(flash) + ' ms' : '') : 'NOT PLAYED',
            rank: played ? window.KA_getFlashRank(v) : null
          });
        }
      }
    });
    return opts;
  }

  function renderLeaderboards(){
    const entries = personalLeaderboardEntries();
    const categories = ['Reaction Speed', 'Processing Speed', 'Processing Complexity', 'Memory'];
    document.getElementById('lbPersonalSections').innerHTML = categories.map(cat => {
      const rows = entries.filter(e => e.category === cat);
      if (!rows.length) return '';
      const rowsHtml = rows.map(e => {
        const rankName = e.rank ? e.rank.name.toUpperCase() : '—';
        const rankColor = e.rank ? e.rank.color : '';
        return `<div class="leaderboard-row ${e.played ? '' : 'unplayed'}">` +
          `<span class="lr-rank" style="color:${rankColor}">${rankName}</span>` +
          `<span class="lr-game">${e.label}</span>` +
          `<span class="lr-val">${e.valueText}</span>` +
          `</div>`;
      }).join('');
      return `<div class="leaderboard-section"><div class="leaderboard-section-title">${cat}</div><div class="leaderboard-list">${rowsHtml}</div></div>`;
    }).join('');
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

  // Mute toggle — lives next to the Workouts menu's back button. State is read fresh on
  // every load in audio.js itself; this just keeps the button's label in sync with it.
  const muteToggleBtn = document.getElementById('muteToggleBtn');
  function renderMuteToggle(){
    muteToggleBtn.textContent = 'SOUND: ' + (window.KA_sound.isMuted() ? 'OFF' : 'ON');
    muteToggleBtn.classList.toggle('muted', window.KA_sound.isMuted());
  }
  muteToggleBtn.addEventListener('click', () => {
    window.KA_sound.setMuted(!window.KA_sound.isMuted());
    renderMuteToggle();
  });
  renderMuteToggle();

  menuBackBtn.addEventListener('click', returnToHome);
  statsBackBtn.addEventListener('click', returnToHome);
  leaderboardsBackBtn.addEventListener('click', returnToHome);
  theoryBackBtn.addEventListener('click', returnToHome);
  weeklyBackBtn.addEventListener('click', returnToHome);
  rankBackBtn.addEventListener('click', returnToHome);
  document.getElementById('bfxBackBtn').addEventListener('click', exitBfx);
  document.getElementById('bfxReturnRankBtn').addEventListener('click', exitBfx);
  document.getElementById('rankTestBtn').addEventListener('click', enterBfx);

  // RETRY + "RANKS" buttons — sit next to every game's back button so players can restart
  // a run or check tier thresholds without leaving. Wraps the existing back button in a
  // flex row rather than repositioning it, so it works regardless of how long each game's
  // label is. RETRY just clicks that module's own NextBtn — every game wires its Start and
  // Next buttons to the exact same startRun handler, so this restarts cleanly whether a run
  // is mid-flight, finished, or hasn't started yet.
  function addRankRefButton(container, gameId){
    if (!container) return;
    const back = container.querySelector('.backBtn');
    if (!back) return;
    const wrap = document.createElement('div');
    wrap.className = 'back-btn-row';
    back.parentNode.insertBefore(wrap, back);
    wrap.appendChild(back);
    const nextBtn = document.getElementById(gameId + 'NextBtn');
    if (nextBtn){
      const retry = document.createElement('button');
      retry.className = 'ranksRefBtn';
      retry.textContent = 'RETRY';
      retry.addEventListener('click', () => nextBtn.click());
      wrap.appendChild(retry);
    }
    const btn = document.createElement('button');
    btn.className = 'ranksRefBtn';
    btn.textContent = 'RANKS';
    btn.addEventListener('click', () => openRankRef(gameId));
    wrap.appendChild(btn);
  }

  function formatRankReq(r, kind){
    if (kind === 'ms') return r.max === Infinity ? 'Starting rank' : 'Under ' + r.max + ' ms';
    if (kind === 'acc') return r.min === 0 ? 'Starting rank' : r.min + '%+';
    if (kind === 'callouts') return r.min <= 2 ? 'Starting rank' : r.min + '+ callouts';
    return r.min === 0 ? 'Starting rank' : r.min + '+ rounds';
  }

  // What each adaptive game's score actually means — shown instead of a tier ladder, since
  // Adaptive never gets a Copper-through-Legend tier at all (KA_setResultMode hides that row
  // for adaptive runs). Keyed by adaptiveUnit so one line of text covers every game sharing
  // that unit rather than hand-writing one per game.
  const ADAPTIVE_DESC = {
    rounds: 'your score is rounds survived — difficulty escalates automatically and keeps climbing until you make a mistake.',
    ms: 'your score is the response window (in ms) you’d shrunk down to right before you missed — lower is harder, and better.',
    callouts: 'your score is the longest sequence you held before a mistake.',
    px: 'your score is the smallest gap you could still tell apart before you missed — lower is harder, and better.'
  };

  // Returns one or two ladder sections — dual-ranked games show accuracy and speed,
  // with the speed thresholds derived from that game's own speedMid baseline.
  function rankRefInfo(gameId){
    if (gameId === 'bfx'){
      return { title: 'Base Reflex', sections: [{ heading: 'Average reaction time', ladder: window.KA_RANKS, kind: 'ms' }] };
    }
    const game = window.KA_GAMES.find(g => g.id === gameId);
    if (!game) return null;

    // Adaptive mode has no tier ladder — explain what the score means instead of showing
    // the Normal/Hard accuracy+speed ladder, which has nothing to do with an adaptive run.
    const adaptiveBtn = document.getElementById(gameId + 'AdaptiveBtn');
    if (game.adaptiveKey && adaptiveBtn && adaptiveBtn.classList.contains('selected')){
      const desc = ADAPTIVE_DESC[game.adaptiveUnit] || 'your score climbs as difficulty escalates automatically, until you make a mistake.';
      const heading = game.adaptiveUnit === 'ms' ? 'Response window held'
        : game.adaptiveUnit === 'callouts' ? 'Longest sequence held'
        : 'Rounds survived';
      const kind = game.adaptiveUnit === 'ms' ? 'ms' : game.adaptiveUnit === 'callouts' ? 'callouts' : 'rounds';
      return {
        title: game.name + ' — Adaptive',
        sections: [
          { heading, ladder: window.KA_adaptiveLadderFor(gameId), kind },
          { note: 'Adaptive has its own separate leaderboard entry (labeled “— Adaptive”), not the tiers shown for this game’s other modes — ' + desc +
            ' First-pass numbers, not yet tuned against real play.' }
        ]
      };
    }

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
        ladder: window.KA_speedLadderFor(game)
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

  // ---- Show/hide password toggles --------------------------------------------------------
  const EYE_OPEN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
  const EYE_OFF = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a21.8 21.8 0 0 1 5.06-6.06M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 11 8 11 8a21.8 21.8 0 0 1-2.16 3.19M14.12 14.12a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';

  document.querySelectorAll('.auth-eye-btn').forEach(btn => {
    btn.innerHTML = EYE_OPEN;
    btn.addEventListener('click', () => {
      const input = document.getElementById(btn.getAttribute('data-target'));
      const showing = input.type === 'text';
      input.type = showing ? 'password' : 'text';
      btn.innerHTML = showing ? EYE_OPEN : EYE_OFF;
      btn.setAttribute('aria-label', showing ? 'Show password' : 'Hide password');
    });
  });

  function showAuthPanel(which){
    [authSignInPanel, authSignUpPanel, authForgotPanel, authRecoveryPanel, authAccountPanel].forEach(panel => {
      panel.style.display = (panel.id === which) ? '' : 'none';
    });
    const onTabbedPanel = which === 'authSignInPanel' || which === 'authSignUpPanel';
    authModeToggle.style.display = onTabbedPanel ? '' : 'none';
    authSignInTabBtn.classList.toggle('selected', which === 'authSignInPanel');
    authSignUpTabBtn.classList.toggle('selected', which === 'authSignUpPanel');
    authTitle.textContent = which === 'authRecoveryPanel' ? 'Set New Password'
      : which === 'authForgotPanel' ? 'Reset Password'
      : which === 'authAccountPanel' ? 'Change Username' : 'Account';
    authStatus.textContent = '';
    authStatus.className = 'auth-status';
    authUsernameStatus.textContent = '';
    authUsernameStatus.className = 'auth-status';
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

  // Opened instead of an immediate sign-out when an already-signed-in player clicks the
  // account strip — lets them rename themselves before deciding whether to sign out.
  async function openAccountPanel(){
    showAuthPanel('authAccountPanel');
    authModal.classList.add('show');
    const session = window.KA_cloud.session;
    authAccountEmail.textContent = session ? session.user.email : '—';
    authAccountUsername.value = '';
    authAccountUsername.placeholder = 'Loading…';
    authAccountUsername.disabled = true;
    try {
      const profile = await window.KA_cloud.getMyProfile();
      authAccountUsername.value = profile ? profile.username : '';
      authAccountUsername.placeholder = 'Username';
    } catch(e){
      authAccountUsername.placeholder = 'Could not load';
    } finally {
      authAccountUsername.disabled = false;
    }
  }

  function renderAccountStrip(session){
    if (session){
      accountStrip.classList.add('signed-in');
      accountLabel.textContent = session.user.email;
      accountActionBtn.textContent = 'SIGN OUT';
      accountUsernameBtn.style.display = '';
    } else {
      accountStrip.classList.remove('signed-in');
      accountLabel.textContent = 'OFFLINE';
      accountActionBtn.textContent = 'SIGN IN';
      accountUsernameBtn.style.display = 'none';
    }
  }

  accountActionBtn.addEventListener('click', () => {
    if (window.KA_cloud.isSignedIn()){
      window.KA_cloud.signOut();
      closeAuthModal();
    } else {
      openAuthModal();
    }
  });
  accountUsernameBtn.addEventListener('click', openAccountPanel);
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
    const identifier = authSignInEmail.value.trim();
    const password = authSignInPassword.value;
    if (!identifier){ setAuthError('Enter your email or username.'); return; }
    if (!password){ setAuthError('Enter your password.'); return; }
    authSignInBtn.disabled = true;
    setAuthStatus('Signing in…');
    try {
      await window.KA_cloud.signInWithIdentifier(identifier, password);
    } catch (err){
      setAuthError(authErrorMessage(err, 'Sign in failed — check your connection and try again.'));
    } finally {
      authSignInBtn.disabled = false;
    }
  });

  authAccountSaveBtn.addEventListener('click', async () => {
    const newUsername = authAccountUsername.value.trim();
    const fmtErr = usernameFormatError(newUsername);
    if (fmtErr){
      authAccountUsernameStatus.textContent = fmtErr;
      authAccountUsernameStatus.className = 'auth-status error';
      return;
    }
    authAccountSaveBtn.disabled = true;
    authAccountUsernameStatus.textContent = 'Saving…';
    authAccountUsernameStatus.className = 'auth-status';
    try {
      const available = await window.KA_cloud.checkUsernameAvailable(newUsername);
      if (!available){
        authAccountUsernameStatus.textContent = 'That username is taken.';
        authAccountUsernameStatus.className = 'auth-status error';
        return;
      }
      await window.KA_cloud.updateUsername(newUsername);
      authAccountUsernameStatus.textContent = '✓ Username updated.';
      authAccountUsernameStatus.className = 'auth-status';
    } catch (err){
      authAccountUsernameStatus.textContent = authErrorMessage(err, 'Could not update username — check your connection and try again.');
      authAccountUsernameStatus.className = 'auth-status error';
    } finally {
      authAccountSaveBtn.disabled = false;
    }
  });

  // ---- Username: format check, then a live "is it taken" check as they type -------------
  const USERNAME_RE = /^[a-zA-Z0-9_-]{3,20}$/;
  function usernameFormatError(username){
    if (!username) return 'Enter a username.';
    if (!USERNAME_RE.test(username)) return '3-20 characters: letters, numbers, _ and - only.';
    return null;
  }
  let usernameCheckToken = 0;
  authSignUpUsername.addEventListener('input', () => {
    const username = authSignUpUsername.value.trim();
    const myToken = ++usernameCheckToken;
    const fmtErr = usernameFormatError(username);
    if (fmtErr){
      authUsernameStatus.textContent = username ? fmtErr : '';
      authUsernameStatus.className = 'auth-status' + (username ? ' error' : '');
      return;
    }
    authUsernameStatus.textContent = 'Checking…';
    authUsernameStatus.className = 'auth-status';
    window.KA_cloud.checkUsernameAvailable(username).then(available => {
      if (myToken !== usernameCheckToken) return; // a newer keystroke already superseded this check
      authUsernameStatus.textContent = available ? '✓ Available' : 'Already taken.';
      authUsernameStatus.className = 'auth-status' + (available ? '' : ' error');
    }).catch(() => {
      if (myToken !== usernameCheckToken) return;
      authUsernameStatus.textContent = '';
    });
  });

  authSignUpBtn.addEventListener('click', async () => {
    const email = authSignUpEmail.value.trim();
    const username = authSignUpUsername.value.trim();
    const password = authSignUpPassword.value;
    const confirm = authSignUpConfirm.value;
    if (!email || email.indexOf('@') === -1){ setAuthError('Enter a valid email.'); return; }
    const fmtErr = usernameFormatError(username);
    if (fmtErr){ setAuthError(fmtErr); return; }
    if (password.length < 6){ setAuthError('Password must be at least 6 characters.'); return; }
    if (password !== confirm){ setAuthError("Passwords don't match."); return; }
    authSignUpBtn.disabled = true;
    setAuthStatus('Checking username…');
    try {
      const available = await window.KA_cloud.checkUsernameAvailable(username);
      if (!available){
        setAuthError('That username is taken — pick another.');
        return;
      }
      setAuthStatus('Creating account…');
      await window.KA_cloud.signUpWithPassword(email, password, username);
      setAuthStatus('Account created — check your email (and junk/spam folder) to verify it, then sign in.');
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
      setAuthStatus('Check your email (and junk/spam folder) for a reset link.');
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

  // A reset/confirmation link that's already been used, or has simply expired, redirects
  // back here with #error=...&error_code=...&error_description=... instead of the valid
  // link's #access_token=...&type=recovery — Supabase's way of reporting the failure, not a
  // silent no-op. Previously nothing looked at this, so following a dead link landed on the
  // ordinary home page with zero indication anything was even attempted.
  (function checkAuthLinkError(){
    const hash = window.location.hash.indexOf('#') === 0 ? window.location.hash.slice(1) : '';
    const params = new URLSearchParams(hash);
    const error = params.get('error');
    if (!error) return;
    history.replaceState(null, '', window.location.pathname + window.location.search);
    openAuthModal();
    showAuthPanel('authForgotPanel');
    setAuthError(params.get('error_description') || 'That link is invalid or has expired — request a new one below.');
  })();

  // ---- Global leaderboard ---------------------------------------------------------------
  // Every active game shows up here — two rows for any game that tracks both accuracy and
  // speed (the same 18 games KA_scoreRun dual-ranks locally), one row for a game with only
  // one tracked stat. All ~44 rows render at once, grouped by category, rather than being
  // hidden behind a game picker — the whole point is seeing everyone's bests at a glance.
  const pctFmt = total => v => Math.round((v / total) * 100) + '%';
  const msFmt = v => Math.round(v) + ' ms';
  const roundsFmt = v => Math.round(v) + ' rounds';
  const pxFmt = v => Math.round(v) + ' px';
  const calloutsFmt = v => v.toFixed(1) + ' callouts';
  const ADAPTIVE_UNIT_FMT = { ms: msFmt, px: pxFmt, callouts: calloutsFmt, rounds: roundsFmt };
  function titleCase(s){ return s.charAt(0).toUpperCase() + s.slice(1); }

  // Builds one "combo" entry: sorted by a hidden composite score, but the row shows the
  // real stats (accuracy% + speed ms, or rounds + flash time) that produced it — never the
  // score itself. Key construction has to match KA_scoreRun's exactly (gameId + '_rank_score'
  // + suffix, not gameId + suffix + '_rank_score') or this silently reads the wrong records.
  // rankFn(score, extra) computes the rank tier badge shown alongside the row — separate from
  // formatCombo since the tier depends on the underlying acc/speed rank functions, not on how
  // the numbers happen to be displayed.
  function comboEntry(category, label, scoreKey, extraKeys, higherIsBetter, formatCombo, rankFn){
    return { category, label, kind: 'combo', dataKey: scoreKey, scoreKey, extraKeys, higherIsBetter, formatCombo, rankFn };
  }

  // Master is a hidden tier — showing "MASTER" outright on the global leaderboard to a player
  // who's never cleared it themselves would just hand them the answer. Gated on the same
  // account-wide watermark the celebration effect uses (achieving Master in ANY workout
  // unlocks seeing it everywhere), not per-game — the point is "have you found this exists at
  // all," not "did you find it in this specific drill."
  function hasDiscoveredMaster(){
    return window.KA_records.get('celebrated_max_rank_idx', -1) >= window.KA_RANK_NAMES.length;
  }
  function maskedRank(rank){
    if (!rank) return null;
    if (rank.name === window.KA_MASTER_NAME && !hasDiscoveredMaster()){
      return { name: '???', color: 'var(--dim)' };
    }
    return rank;
  }

  function globalLeaderboardEntries(){
    const opts = [];
    window.KA_GAMES.forEach(g => {
      if (g.adaptiveKey){
        // Adaptive-difficulty runs (Choice Reaction, Size Compare, Callout Recall, Flanker)
        // report a single threshold instead of accuracy+speed — no composite needed, it's
        // already one number. Checked before the key/metrics branch below since a game can
        // have both a normal leaderboard entry AND an adaptive one.
        const fmt = ADAPTIVE_UNIT_FMT[g.adaptiveUnit] || msFmt;
        if (g.adaptiveAccuracyRelevant){
          // Needs the companion _clean flag to compute the tier correctly for OTHER players
          // too, which means fetching it from the cloud — routed through comboEntry purely
          // to get that extra-key fetch, not because there's an actual composite score here.
          const cleanKey = g.adaptiveKey + '_clean';
          opts.push(comboEntry(g.category, g.name + ' — Adaptive', g.adaptiveKey, [cleanKey], g.adaptiveHigherIsBetter,
            (score) => fmt(score),
            (score, extra) => window.KA_getAdaptiveRank(g.id, score, !extra[cleanKey])));
        } else {
          opts.push({
            category: g.category, label: g.name + ' — Adaptive', kind: 'simple', dataKey: g.adaptiveKey,
            key: g.adaptiveKey, higherIsBetter: g.adaptiveHigherIsBetter,
            format: fmt,
            rankFn: (value) => window.KA_getAdaptiveRank(g.id, value)
          });
        }
      }
      if (g.key){
        const isRounds = g.type === 'rounds';
        if (g.speedMid && !isRounds){
          // Fixed-trial accuracy+speed game: one combo row per difficulty mode (or just one,
          // for games with no mode toggle), sorted by KA_scoreRun's hidden rank score.
          const modes = g.modes || [null];
          modes.forEach(mode => {
            const suffix = mode ? '_' + mode : '';
            const label = g.name + (mode ? ' — ' + titleCase(mode) : '');
            const accKey = g.id + '_rank_acc' + suffix;
            const speedKey = g.id + '_rank_speed' + suffix;
            opts.push(comboEntry(g.category, label, g.id + '_rank_score' + suffix, [accKey, speedKey], true,
              (score, extra) => {
                const acc = extra[accKey], speed = extra[speedKey];
                return (acc === null || acc === undefined || speed === null || speed === undefined)
                  ? '—' : Math.round(acc) + '% · ' + Math.round(speed) + ' ms';
              },
              (score, extra) => window.KA_combineRanks(window.KA_getAccRank(extra[accKey]), window.KA_getSpeedRank(extra[speedKey], g))));
          });
        } else {
          // Accuracy-only or rounds-only (no speed component) — single value, unchanged.
          opts.push({
            category: g.category, label: g.name, kind: 'simple', dataKey: g.key,
            key: g.key, higherIsBetter: true,
            format: isRounds ? roundsFmt : pctFmt(g.total),
            rankFn: isRounds ? (value) => window.KA_getRoundsRank(value) : (value) => window.KA_getAccRank(value)
          });
        }
      } else if (g.metrics){
        if (g.id === 'flk'){
          // Flanker: metrics ARE its difficulty modes (Easy/Full), each dual-ranked with the
          // same speedMid — one combo row per mode, same as the Normal/Hard games above.
          (g.modes || ['easy', 'full']).forEach(mode => {
            const suffix = '_' + mode;
            const label = g.name + ' — ' + titleCase(mode);
            const accKey = g.id + '_rank_acc' + suffix;
            const speedKey = g.id + '_rank_speed' + suffix;
            opts.push(comboEntry(g.category, label, g.id + '_rank_score' + suffix, [accKey, speedKey], true,
              (score, extra) => {
                const acc = extra[accKey], speed = extra[speedKey];
                return (acc === null || acc === undefined || speed === null || speed === undefined)
                  ? '—' : Math.round(acc) + '% · ' + Math.round(speed) + ' ms';
              },
              (score, extra) => window.KA_combineRanks(window.KA_getAccRank(extra[accKey]), window.KA_getSpeedRank(extra[speedKey], g))));
          });
        } else {
          // Flash Reflex: rounds survived is the real, visible score (not hidden) — sort by
          // it directly and show the fastest-flash time from the same player alongside it,
          // rather than inventing a composite for a game with no accuracy% concept at all.
          const roundsMetric = g.metrics.find(m => !m.isTime);
          const timeMetric = g.metrics.find(m => m.isTime);
          if (roundsMetric && timeMetric){
            opts.push(comboEntry(g.category, g.name, roundsMetric.key, [timeMetric.key], true,
              (score, extra) => {
                const flash = extra[timeMetric.key];
                return Math.round(score) + ' rounds' + (flash === null || flash === undefined ? '' : ' · ' + Math.round(flash) + ' ms');
              },
              (score) => window.KA_getFlashRank(score)));
          }
        }
      }
    });
    return opts;
  }

  // Top-10 lists are fetched lazily (only once a row's actually clicked open) and cached
  // here so re-toggling the same row doesn't re-hit the network every time.
  const globalTop10Cache = new Map();

  async function renderGlobalLeaderboard(){
    const entries = globalLeaderboardEntries();
    const categories = ['Reaction Speed', 'Processing Speed', 'Processing Complexity', 'Memory'];
    globalTop10Cache.clear();

    // Render every row immediately in a loading state, then fill each in as its own query
    // resolves — one game's slow request shouldn't hold up the other rows.
    lbGlobalSections.innerHTML = categories.map(cat => {
      const rows = entries.filter(e => e.category === cat);
      if (!rows.length) return '';
      const rowsHtml = rows.map(e =>
        `<div class="leaderboard-row unplayed" data-key="${e.dataKey}"><span class="lr-rank">—</span><span class="lr-game">${e.label}</span><span class="lr-tier"></span><span class="lr-val">Loading…</span><span class="lr-chevron">&#9656;</span></div>` +
        `<div class="leaderboard-expand" data-expand="${e.dataKey}"></div>`
      ).join('');
      return `<div class="leaderboard-section"><div class="leaderboard-section-title">${cat}</div><div class="leaderboard-list">${rowsHtml}</div></div>`;
    }).join('');

    // The collapsed row shows the signed-in player's own rank and score, not the #1 score —
    // that only appears once they expand it to the top 10.
    entries.forEach(async (e) => {
      const isCombo = e.kind === 'combo';
      const [topRows, mine] = await Promise.all([
        isCombo
          ? window.KA_cloud.fetchComboTop(e.scoreKey, e.extraKeys, e.higherIsBetter, 1)
          : window.KA_cloud.fetchLeaderboard(e.key, e.higherIsBetter, 1),
        isCombo
          ? window.KA_cloud.fetchMyCombo(e.scoreKey, e.extraKeys, e.higherIsBetter)
          : window.KA_cloud.fetchMyRank(e.key, e.higherIsBetter)
      ]);
      const row = lbGlobalSections.querySelector(`[data-key="${CSS.escape(e.dataKey)}"]`);
      if (!row) return;
      if (!topRows.length){
        row.querySelector('.lr-val').textContent = 'No scores yet';
        row.querySelector('.lr-chevron').style.visibility = 'hidden';
        return;
      }
      row.classList.remove('unplayed');
      row.classList.add('expandable');
      if (!mine || !mine.played){
        row.querySelector('.lr-rank').textContent = '—';
        row.querySelector('.lr-val').textContent = "You haven't played";
      } else {
        row.querySelector('.lr-rank').textContent = '#' + (mine.rank || '—');
        row.querySelector('.lr-val').textContent = isCombo ? e.formatCombo(mine.value, mine.extra) : e.format(mine.value);
        row.classList.toggle('lr-first', mine.rank === 1);
        const tierEl = row.querySelector('.lr-tier');
        const rank = e.rankFn ? maskedRank(e.rankFn(mine.value, mine.extra)) : null;
        tierEl.textContent = rank ? rank.name.toUpperCase() : '';
        tierEl.style.color = rank ? rank.color : '';
      }
    });
  }

  // Clicking a played row expands/collapses its top 10 — fetched once per render, on demand,
  // rather than pulling 10 rows for every entry up front when most will never be opened.
  //
  // A per-key token guards against a real race: click once (opens, starts fetching), click
  // again quickly (closes it again) — without this, the first click's fetch can still resolve
  // afterward and write real, correct content into a panel that's since been closed, which
  // looks exactly like "nothing happened" since the content is there but hidden. The token
  // has to advance on every click for the key — including ones that just close it — since a
  // close is exactly what needs to invalidate a fetch already in flight from the open before it.
  const globalTop10Tokens = new Map();
  lbGlobalSections.addEventListener('click', async (e) => {
    const row = e.target.closest('.leaderboard-row.expandable');
    if (!row) return;
    const key = row.getAttribute('data-key');
    const panel = lbGlobalSections.querySelector(`[data-expand="${CSS.escape(key)}"]`);
    if (!panel) return;

    const myToken = (globalTop10Tokens.get(key) || 0) + 1;
    globalTop10Tokens.set(key, myToken);

    const isOpen = row.classList.contains('open');
    row.classList.toggle('open', !isOpen);
    panel.style.display = isOpen ? 'none' : 'block';
    if (isOpen || globalTop10Cache.has(key)){
      if (!isOpen) panel.innerHTML = globalTop10Cache.get(key);
      return;
    }

    panel.innerHTML = '<div class="leaderboard-row unplayed"><span class="lr-game">Loading top 10…</span></div>';
    const entry = globalLeaderboardEntries().find(x => x.dataKey === key);
    const isCombo = entry.kind === 'combo';
    const top10 = isCombo
      ? await window.KA_cloud.fetchComboTop(entry.scoreKey, entry.extraKeys, entry.higherIsBetter, 10)
      : await window.KA_cloud.fetchLeaderboard(entry.key, entry.higherIsBetter, 10);
    if (globalTop10Tokens.get(key) !== myToken) return; // superseded by a later click on this row
    const html = top10.length
      ? top10.map((r, i) => {
          const name = isCombo ? r.username : ((r.profiles && r.profiles.username) || 'Unknown');
          const val = isCombo ? entry.formatCombo(r.score, r.extra) : entry.format(r.value);
          const rank = entry.rankFn ? maskedRank(isCombo ? entry.rankFn(r.score, r.extra) : entry.rankFn(r.value)) : null;
          const tierHtml = rank ? `<span class="lr-tier" style="color:${rank.color}">${rank.name.toUpperCase()}</span>` : '<span class="lr-tier"></span>';
          return `<div class="leaderboard-row"><span class="lr-rank">#${i + 1}</span><span class="lr-game">${name}</span>${tierHtml}<span class="lr-val">${val}</span></div>`;
        }).join('')
      : '<div class="leaderboard-row unplayed"><span class="lr-game">No scores yet</span></div>';
    panel.innerHTML = html;
    globalTop10Cache.set(key, html);
  });

  function showGlobalPanelForAuthState(){
    if (window.KA_cloud.isSignedIn()){
      lbGlobalSignedOut.style.display = 'none';
      lbGlobalSignedIn.style.display = '';
      renderGlobalLeaderboard();
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

  renderLastPlayedHero();
  renderStreak();
})();
