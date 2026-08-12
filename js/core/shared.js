  window.KA_records = {
    get(key, fallback){
      try{
        const v = localStorage.getItem('ka_record_' + key);
        return v === null ? fallback : JSON.parse(v);
      } catch(e){ return fallback; }
    },
    set(key, value){
      try{ localStorage.setItem('ka_record_' + key, JSON.stringify(value)); } catch(e){}
    }
  };

  // Shared academy-styled directional arrow — a gold double-chevron "blade" icon,
  // rotated per direction instead of relying on plain unicode arrow glyphs.
  window.KA_DIRECTION_DEG = { right: 0, down: 90, left: 180, up: 270 };
  window.KA_arrowIcon = function(direction){
    const deg = window.KA_DIRECTION_DEG[direction] || 0;
    return `<svg class="ka-arrow-svg" viewBox="0 0 100 100" style="transform:rotate(${deg}deg)">
      <path class="ka-arrow-path" d="M18,14 L54,50 L18,86"/>
      <path class="ka-arrow-path" d="M42,14 L78,50 L42,86"/>
    </svg>`;
  };

  // Every reaction-time measurement in the app goes through this. The first
  // KA_INPUT_GRACE_MS after a stimulus appears reads as 0ms, and timing counts up from
  // there — covers the browser's 60fps frame budget, monitor refresh, and mouse polling
  // latency, none of which are the player's fault. Applies uniformly across every game.
  window.KA_INPUT_GRACE_MS = 16;
  window.KA_applyGrace = function(rawRt){
    return Math.max(0, rawRt - window.KA_INPUT_GRACE_MS);
  };

  // Injects (or updates, on a re-run) a "Rank achieved" row into a game's result card,
  // based on that specific run's score — not the all-time best. Creates the row itself
  // the first time, so no per-game HTML changes are needed.
  // Creates (or reuses) a labelled rank row on a result card. Rows are inserted above the
  // buttons, in the order they're first requested.
  function KA_rankRow(card, cls, label){
    let row = card.querySelector('.' + cls);
    if (!row){
      row = document.createElement('div');
      row.className = 'metric game-highlight ' + cls;
      row.innerHTML = '<span class="m-lbl">' + label + '</span><span class="m-val"></span>';
      const firstBtn = card.querySelector('button');
      if (firstBtn) card.insertBefore(row, firstBtn); else card.appendChild(row);
    }
    return row;
  }
  function KA_setRankRow(row, rank){
    const val = row.querySelector('.m-val');
    val.textContent = rank ? rank.name.toUpperCase() : '—';
    val.style.color = rank ? rank.color : '';
  }

  // Accepts either a single rank (rounds/flash games) or {accRank, speedRank, combined}
  // for the dual-ranked games.
  window.KA_renderRunRank = function(resultCardId, ranks){
    const card = document.querySelector('#' + resultCardId + ' .card');
    if (!card || !ranks) return;
    if (ranks.name || ranks.color){
      KA_setRankRow(KA_rankRow(card, 'run-rank-row', 'Rank achieved'), ranks);
      if (window.KA_maybeCelebrate) window.KA_maybeCelebrate(ranks);
      return;
    }
    if (ranks.speedRank){
      KA_setRankRow(KA_rankRow(card, 'run-rank-acc', 'Accuracy rank'), ranks.accRank);
      KA_setRankRow(KA_rankRow(card, 'run-rank-speed', 'Speed rank'), ranks.speedRank);
    }
    KA_setRankRow(KA_rankRow(card, 'run-rank-row', 'Overall rank'), ranks.combined);
    if (window.KA_maybeCelebrate) window.KA_maybeCelebrate(ranks.combined);
  };

  // A run only counts toward the shared/global leaderboard once its accuracy clears this —
  // below it, personal bests and your own rank tier still update as normal, the run just
  // never posts (or overwrites) anything on the board everyone else sees.
  window.KA_GLOBAL_ACCURACY_GATE = 80;

  // Hidden composite used only to decide leaderboard order — never shown to players. Speed
  // alone would let a fast-but-sloppy run outrank a clean one; scaling the speed component
  // by this run's own accuracy fraction means a 95%-accurate run beats an 80%-accurate run
  // at the same speed, without needing a second displayed number. 2000ms is comfortably
  // above every game's realistic slow end, so the speed component stays positive in
  // practice; clamped at 0 as a floor regardless.
  window.KA_computeRankScore = function(avgRt, accuracyPct){
    if (avgRt === null || avgRt === undefined || accuracyPct === null || accuracyPct === undefined) return null;
    const speedComponent = Math.max(0, 2000 - avgRt);
    return speedComponent * (accuracyPct / 100);
  };

  // One call per game at the end of a run: works out the accuracy and speed tiers, keeps
  // the best-ever average response time for that game, and paints the result card.
  // run.mode (optional) suffixes every key this writes — games with Normal/Hard/Easy/Full
  // variants need their bests and leaderboard bundle kept separate per mode, since a Hard
  // score and a Normal score aren't comparable. Adaptive-mode runs should never reach here
  // with a mode at all — those games route Adaptive through their own threshold-recording
  // path instead, deliberately outside ranking altogether.
  window.KA_scoreRun = function(gameId, resultCardId, run){
    const game = window.KA_GAMES.find(g => g.id === gameId);
    const accRank = (run.accuracyPct === null || run.accuracyPct === undefined)
      ? null : window.KA_getAccRank(run.accuracyPct);
    const suffix = run.mode ? '_' + run.mode : '';

    let speedRank = null;
    if (game && game.speedMid && run.avgRt !== null && run.avgRt !== undefined){
      speedRank = window.KA_getSpeedRank(run.avgRt, game);
      // Deliberately NOT mode-suffixed: KA_getGameRank, the Personal leaderboard, and
      // KA_WEEKLY_META all read this key unsuffixed, so splitting it per mode would
      // silently freeze those displays rather than actually separating them. Your
      // personal best/rank tier stays "best across any difficulty", same as before —
      // only the new global-leaderboard bundle below is mode-specific.
      const key = gameId + '_best_avg_rt';
      const best = window.KA_records.get(key, null);
      if (best === null || run.avgRt < best) window.KA_records.set(key, run.avgRt, false);

      // Global bundle: accuracy, speed, and the score they produce together all come from
      // this exact run, not three independently-optimized bests — that's what makes "the
      // combo that provides the highest overall score" meaningful rather than three numbers
      // that never actually happened together.
      if (run.accuracyPct !== null && run.accuracyPct !== undefined && run.accuracyPct >= window.KA_GLOBAL_ACCURACY_GATE){
        const scoreKey = gameId + '_rank_score' + suffix;
        const accKey = gameId + '_rank_acc' + suffix;
        const speedKey = gameId + '_rank_speed' + suffix;
        const rankScore = window.KA_computeRankScore(run.avgRt, run.accuracyPct);
        const bestScore = window.KA_records.get(scoreKey, null);
        if (bestScore === null || rankScore > bestScore){
          window.KA_records.set(scoreKey, rankScore);
          window.KA_records.set(accKey, run.accuracyPct);
          window.KA_records.set(speedKey, run.avgRt, false);
        }
      }
    }

    const combined = window.KA_combineRanks(accRank, speedRank);
    window.KA_renderRunRank(resultCardId, { accRank, speedRank, combined });
    return combined;
  };

  // Recent-activity feed shared across all games — capped, newest first.
  window.KA_history = {
    KEY: 'ka_history_log',
    MAX: 60,
    add(gameName, summary){
      try{
        const list = this.getAll();
        list.unshift({ time: Date.now(), gameName, summary });
        localStorage.setItem(this.KEY, JSON.stringify(list.slice(0, this.MAX)));
      } catch(e){}
    },
    getAll(){
      try{
        const v = localStorage.getItem(this.KEY);
        return v === null ? [] : JSON.parse(v);
      } catch(e){ return []; }
    }
  };

  // Which module was entered most recently, and how many times each module has been
  // entered today — powers the "Last Played" hero tile at the top of the Workouts menu.
  window.KA_lastPlayed = {
    KEY: 'ka_last_played',
    get(){ return localStorage.getItem(this.KEY); },
    set(gameId){ localStorage.setItem(this.KEY, gameId); }
  };
  window.KA_dailyRuns = {
    todayStr(){ return new Date().toDateString(); },
    key(gameId){ return 'ka_daily_runs_' + gameId + '_' + this.todayStr(); },
    get(gameId){ return parseInt(localStorage.getItem(this.key(gameId)) || '0', 10); },
    increment(gameId){
      const v = this.get(gameId) + 1;
      localStorage.setItem(this.key(gameId), String(v));
      return v;
    }
  };

  // Consecutive-day training streak — counts a day once any module is entered that day.
  // Midnight-to-midnight in local time; missing a full calendar day resets it to 1.
  window.KA_streak = {
    KEY_COUNT: 'ka_streak_count',
    KEY_LAST: 'ka_streak_last_date',
    get(){ return parseInt(localStorage.getItem(this.KEY_COUNT) || '0', 10); },
    touch(){
      const now = new Date();
      const todayMid = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const lastStr = localStorage.getItem(this.KEY_LAST);
      let count = this.get();
      if (lastStr){
        const last = new Date(lastStr);
        const diffDays = Math.round((todayMid - last) / 86400000);
        if (diffDays === 0){
          // already trained today — no change
        } else if (diffDays === 1){
          count += 1;
        } else {
          count = 1;
        }
      } else {
        count = 1;
      }
      localStorage.setItem(this.KEY_LAST, todayMid.toISOString());
      localStorage.setItem(this.KEY_COUNT, String(count));
      return count;
    }
  };

  // Rank ladder — tier is set by your best-ever average reaction time on the Base Reflex
  // test (lower is better). Copper is the floor everyone starts at.
  window.KA_RANK_NAMES = ['Copper', 'Bronze', 'Silver', 'Gold', 'Platinum', 'Sapphire', 'Emerald', 'Diamond', 'Legend'];
  window.KA_RANK_COLORS = ['#b8733a', '#cd7f32', '#c4c4cc', '#f0cf82', '#9fd8d8', '#4f8cff', '#3ddc6f', '#7fe7ff', '#c98bff'];

  // Master — a hidden 10th tier, one rung above Legend, that exists nowhere in
  // KA_RANK_NAMES/COLORS and is never listed in a ladder or rank-reference panel. It's
  // computed inline by each ranking function below as "20% better than that ladder's own
  // Legend cut," in whichever direction is better for that measure — there's no explanation
  // shown anywhere in the app; the only way to learn it exists is to actually clear it.
  // Accuracy-based ladders never get one: Legend there is already 100%, a hard ceiling that
  // can't be beaten by 20%.
  window.KA_MASTER_NAME = 'Master';
  window.KA_MASTER_COLOR = '#f2f6ff';
  window.KA_MASTER_MARGIN = 0.2;
  window.KA_maybeMaster = function(value, legendCut, higherIsBetter){
    if (value === null || value === undefined || legendCut === undefined || legendCut === Infinity) return false;
    return higherIsBetter
      ? value >= legendCut * (1 + window.KA_MASTER_MARGIN)
      : value < legendCut * (1 - window.KA_MASTER_MARGIN);
  };
  // Maps a rank object to a linear tier index, with Master sitting one above Legend's index
  // (KA_RANK_NAMES.length) instead of the -1 a plain indexOf would give it — every place that
  // averages or steps through tiers (KA_combineRanks, the category/overall aggregate) goes
  // through this pair instead of touching KA_RANK_NAMES directly, so Master flows through
  // correctly without needing a real slot in that array.
  window.KA_rankIndex = function(rank){
    if (!rank) return null;
    if (rank.name === window.KA_MASTER_NAME) return window.KA_RANK_NAMES.length;
    const i = window.KA_RANK_NAMES.indexOf(rank.name);
    return i === -1 ? null : i;
  };
  window.KA_rankByIndex = function(i){
    if (i >= window.KA_RANK_NAMES.length) return { name: window.KA_MASTER_NAME, color: window.KA_MASTER_COLOR };
    return { name: window.KA_RANK_NAMES[i], color: window.KA_RANK_COLORS[i] };
  };

  // Every ladder below is calibrated the same way: Silver sits on the realistic population
  // average for that measure, Bronze/Copper sit slightly and clearly below it, and Gold
  // through Legend climb toward genuinely elite, rare performance — not just "did the drill."

  // Baseline ladder — average reaction time in ms (lower is better). Simple visual RT via mouse
  // click averages roughly 250-280ms in the general population (slower than lab keyboard studies
  // due to click latency). Drives the Base Reflex test and Colour Flick's averaged split times.
  window.KA_RANKS = window.KA_RANK_NAMES.map((name, i) => ({
    name, color: window.KA_RANK_COLORS[i],
    max: [Infinity, 310, 280, 245, 220, 200, 180, 160, 140][i]
  }));
  window.KA_getRank = function(avgRt){
    if (avgRt === null || avgRt === undefined) return null;
    if (window.KA_maybeMaster(avgRt, window.KA_RANKS[window.KA_RANKS.length - 1].max, false)){
      return { name: window.KA_MASTER_NAME, color: window.KA_MASTER_COLOR };
    }
    for (let i = window.KA_RANKS.length - 1; i >= 0; i--){
      if (avgRt < window.KA_RANKS[i].max) return window.KA_RANKS[i];
    }
    return window.KA_RANKS[0];
  };

  // Accuracy ladder — % correct (higher is better). These are speeded discrimination drills
  // with real interference (Stroop, Anti-Saccade, Simon Effect, etc.) under a ~1-1.5s response
  // window, so an attentive average run lands around 75%, not near-perfect. Legend requires
  // a genuinely flawless run. Drives every fixed-trial accuracy workout.
  window.KA_ACC_RANKS = window.KA_RANK_NAMES.map((name, i) => ({
    name, color: window.KA_RANK_COLORS[i],
    min: [0, 65, 75, 83, 88, 92, 95, 98, 100][i]
  }));
  window.KA_getAccRank = function(pct){
    if (pct === null || pct === undefined) return null;
    for (let i = window.KA_ACC_RANKS.length - 1; i >= 0; i--){
      if (pct >= window.KA_ACC_RANKS[i].min) return window.KA_ACC_RANKS[i];
    }
    return window.KA_ACC_RANKS[0];
  };

  // Memory-span ladder — longest sequence reached (higher is better). Matches the classic
  // working-memory-span literature: average adult span is roughly 6-7 items (Miller's 7±2),
  // so an average completed sequence lands around 6. Reaching into the mid-teens requires
  // real chunking skill. Drives Simon Sequence and Grid Recall.
  window.KA_ROUNDS_RANKS = window.KA_RANK_NAMES.map((name, i) => ({
    name, color: window.KA_RANK_COLORS[i],
    min: [0, 5, 6, 7, 8, 9, 11, 13, 16][i]
  }));
  window.KA_getRoundsRank = function(rounds){
    if (rounds === null || rounds === undefined) return null;
    if (window.KA_maybeMaster(rounds, window.KA_ROUNDS_RANKS[window.KA_ROUNDS_RANKS.length - 1].min, true)){
      return { name: window.KA_MASTER_NAME, color: window.KA_MASTER_COLOR };
    }
    for (let i = window.KA_ROUNDS_RANKS.length - 1; i >= 0; i--){
      if (rounds >= window.KA_ROUNDS_RANKS[i].min) return window.KA_ROUNDS_RANKS[i];
    }
    return window.KA_ROUNDS_RANKS[0];
  };

  // Flash-escalation ladder — rounds survived. Flash duration ramps from 200ms down to its
  // 16.7ms floor over the first 60 rounds; from round 61 on the flash stops shrinking and the
  // response window itself starts closing in 5%/round instead (RESPONSE_WINDOW/
  // WINDOW_SHRINK_FACTOR in flash-reflex.js), which puts the practical ceiling for even a
  // flawless player around round 100-110 — Legend at 85 is a genuinely elite result well into
  // that window-shrink phase, not just clearing the flash ramp. Cuts otherwise spaced evenly
  // through the ramp itself for the lower tiers.
  window.KA_FLASH_RANKS = window.KA_RANK_NAMES.map((name, i) => ({
    name, color: window.KA_RANK_COLORS[i],
    min: [0, 29, 35, 43, 51, 59, 67, 75, 85][i]
  }));
  window.KA_getFlashRank = function(rounds){
    if (rounds === null || rounds === undefined) return null;
    if (window.KA_maybeMaster(rounds, window.KA_FLASH_RANKS[window.KA_FLASH_RANKS.length - 1].min, true)){
      return { name: window.KA_MASTER_NAME, color: window.KA_MASTER_COLOR };
    }
    for (let i = window.KA_FLASH_RANKS.length - 1; i >= 0; i--){
      if (rounds >= window.KA_FLASH_RANKS[i].min) return window.KA_FLASH_RANKS[i];
    }
    return window.KA_FLASH_RANKS[0];
  };

  // Decision-speed ladder. A single fixed ms ladder would be unfair across these games —
  // clicking the bigger circle is inherently faster than verifying arithmetic — so each
  // game carries its own `speedMid` (the realistic average response time for that task,
  // which lands on Silver) and the tiers are multipliers of it. Lower is better.
  // Silver's cut sits just ABOVE speedMid so a dead-average time lands in Silver rather
  // than tipping into Bronze on the boundary.
  window.KA_SPEED_FACTORS = [Infinity, 1.35, 1.05, 0.92, 0.85, 0.78, 0.72, 0.66, 0.58];

  // A game's speed tiers as absolute ms cuts. Nearly all of them derive from speedMid
  // times the factors above, which span a fixed 2.33x from the Copper cut down to Legend.
  // A game whose real spread is wider than that can pin its own cuts with `speedLadder`
  // instead — Peripheral Ping needs it, because the cursor has to physically cross the
  // screen, so its slow and fast ends sit further apart than one midpoint can express.
  // Games carrying an explicit ladder keep speedMid too: it still marks the realistic
  // average, and it's what everything else keys off to know the game is speed-ranked.
  window.KA_speedLadderFor = function(game){
    if (!game) return null;
    const cuts = game.speedLadder || (game.speedMid
      ? window.KA_SPEED_FACTORS.map(f => f === Infinity ? Infinity : Math.round(game.speedMid * f))
      : null);
    if (!cuts) return null;
    return cuts.map((max, i) => ({ name: window.KA_RANK_NAMES[i], color: window.KA_RANK_COLORS[i], max }));
  };

  window.KA_getSpeedRank = function(avgRt, game){
    if (avgRt === null || avgRt === undefined) return null;
    const ladder = window.KA_speedLadderFor(game);
    if (!ladder) return null;
    if (window.KA_maybeMaster(avgRt, ladder[ladder.length - 1].max, false)){
      return { name: window.KA_MASTER_NAME, color: window.KA_MASTER_COLOR };
    }
    for (let i = ladder.length - 1; i >= 0; i--){
      if (avgRt < ladder[i].max) return ladder[i];
    }
    return ladder[0];
  };

  // Overall tier for a dual-ranked game: the midpoint of its accuracy and speed tiers, so
  // neither being fast-and-sloppy nor slow-and-perfect alone carries you to the top. Goes
  // through KA_rankIndex/KA_rankByIndex rather than indexing KA_RANK_NAMES directly, so a
  // Master-tier speed rank still averages correctly instead of landing on -1 — but the
  // result is capped at Legend regardless: this is only ever called with an accuracy rank
  // as one of its two inputs, and accuracy alone can never earn Master (100% is a ceiling),
  // so a flat-out 100%-accurate run should never read as Master just because its speed half
  // did. Master here would only ever come from rounding (8, 9) up to 9 anyway.
  window.KA_combineRanks = function(a, b){
    const idxs = [a, b].filter(Boolean).map(window.KA_rankIndex).filter(i => i !== null);
    if (!idxs.length) return null;
    const legendIdx = window.KA_RANK_NAMES.length - 1;
    const i = Math.min(legendIdx, Math.round(idxs.reduce((x, y) => x + y, 0) / idxs.length));
    return window.KA_rankByIndex(i);
  };

  // ---- Adaptive difficulty (staircase) -------------------------------------------------
  // A 1-up/2-down staircase: two correct in a row makes the drill harder, a single miss
  // makes it easier. That ratio converges on the difficulty where you're right ~71% of the
  // time — your actual edge. The reported threshold is the mean of the last few REVERSALS
  // (points where the direction flipped), which throws away the noisy early hunting.
  //
  // cfg: { min, max, step, startAt, harderIs:'lower'|'higher', missPenalty }
  //   'lower'  — harder means a smaller number (response windows, size deltas)
  //   'higher' — harder means a bigger number (sequence lengths, set sizes)
  //   missPenalty — how many step-sizes a single miss backs off, vs. the 1 step a normal
  //     easier-move takes (default 1). Games that want a miss to hurt more than the standard
  //     1-up/2-down ratio (e.g. Choice Reaction backing off 3 steps — the same distance 3
  //     hard-earned correct answers would have climbed) pass a higher value.
  window.KA_makeStaircase = function(cfg){
    const harderIsLower = cfg.harderIs !== 'higher';
    const lo = Math.min(cfg.min, cfg.max);
    const hi = Math.max(cfg.min, cfg.max);
    return {
      value: cfg.startAt,
      step: cfg.step,
      streak: 0,
      reversals: [],
      lastDir: null,
      _move(dir, mult){
        const towardHard = (dir === 'harder');
        const delta = (towardHard === harderIsLower) ? -this.step : this.step;
        if (this.lastDir && this.lastDir !== dir) this.reversals.push(this.value);
        this.lastDir = dir;
        this.value = Math.min(hi, Math.max(lo, this.value + delta * (mult || 1)));
      },
      record(wasCorrect){
        if (wasCorrect){
          this.streak++;
          if (this.streak >= 2){ this.streak = 0; this._move('harder'); }
        } else {
          this.streak = 0;
          this._move('easier', cfg.missPenalty);
        }
      },
      // Falls back to the current value if the run ended before any reversal happened.
      result(take){
        if (!this.reversals.length) return this.value;
        const tail = this.reversals.slice(-(take || 6));
        return tail.reduce((a, b) => a + b, 0) / tail.length;
      },
      reversalCount(){ return this.reversals.length; }
    };
  };

  // Best-ever threshold per game. Direction matters: a smaller response window is a better
  // result, but a longer sequence is.
  window.KA_recordThreshold = function(gameId, value, harderIs){
    const key = gameId + '_best_threshold';
    const higherIsBetter = harderIs === 'higher';
    const best = window.KA_records.get(key, null);
    const better = best === null || (higherIsBetter ? value > best : value < best);
    if (better) window.KA_records.set(key, value, higherIsBetter);
    return { best: better ? value : best, isNew: better };
  };

  // Adaptive rank ladders — a first-pass estimate, not yet tuned against real playtesting.
  // There's no established population baseline for these never-ending modes the way Silver
  // = population average works for the other ladders, so these follow the same method used
  // to calibrate Flash Reflex's escalation ladder instead: work out roughly which round the
  // difficulty curve starts genuinely testing the relevant limit, put Silver there, and climb
  // Gold-through-Legend toward the rare/elite end. Revisit every cut point once there's
  // actual data on where players land.
  //   siz (rounds, higher better): phase 1 (gap shrink) completes in exactly 15 rounds —
  //     that's the natural "cleared the warm-up" milestone, so Silver sits there. Phase 2's
  //     length is genuinely unpredictable (a random walk between size bounds), so everything
  //     past Silver is a rougher guess than Flanker's below.
  //   flk (rounds, higher better): phase 1 (flash shrink) completes in exactly 20 rounds —
  //     Silver there, same logic. Phase 2 is deterministic (window *= 0.95/round), so the
  //     higher cuts are anchored to roughly what response-window ms they imply.
  //   cr (ms, lower better): existing bounded staircase (400-1500ms), unchanged mode —
  //     ladder spans that same range.
  //   clo (callouts, higher better): existing bounded staircase (2-9 span), unchanged mode —
  //     ladder spans that same range, consistent with Simon Sequence/Grid Recall's
  //     memory-span calibration.
  window.KA_ADAPTIVE_RANKS = {
    siz: { unit: 'rounds',   higherIsBetter: true,  cuts: [0, 6, 15, 25, 40, 60, 85, 115, 150] },
    flk: { unit: 'rounds',   higherIsBetter: true,  cuts: [0, 8, 20, 28, 36, 44, 52, 60, 68] },
    cr:  { unit: 'ms',       higherIsBetter: false, cuts: [Infinity, 1000, 850, 700, 600, 500, 450, 425, 400] },
    clo: { unit: 'callouts', higherIsBetter: true,  cuts: [2, 3, 5, 6, 7, 7.5, 8, 8.5, 9] }
  };
  window.KA_getAdaptiveRank = function(gameId, value){
    const table = window.KA_ADAPTIVE_RANKS[gameId];
    if (!table || value === null || value === undefined) return null;
    if (window.KA_maybeMaster(value, table.cuts[table.cuts.length - 1], table.higherIsBetter)){
      return { name: window.KA_MASTER_NAME, color: window.KA_MASTER_COLOR };
    }
    for (let i = window.KA_RANK_NAMES.length - 1; i >= 0; i--){
      const cut = table.cuts[i];
      const ok = table.higherIsBetter ? value >= cut : value < cut;
      if (ok) return { name: window.KA_RANK_NAMES[i], color: window.KA_RANK_COLORS[i], cut };
    }
    return { name: window.KA_RANK_NAMES[0], color: window.KA_RANK_COLORS[0], cut: table.cuts[0] };
  };
  // Same ladder, reshaped into the {name, color, min|max} form the rank-reference panel and
  // formatRankReq already know how to render, so it doesn't need its own display path.
  window.KA_adaptiveLadderFor = function(gameId){
    const table = window.KA_ADAPTIVE_RANKS[gameId];
    if (!table) return null;
    return table.cuts.map((cut, i) => ({
      name: window.KA_RANK_NAMES[i], color: window.KA_RANK_COLORS[i],
      max: table.higherIsBetter ? undefined : cut,
      min: table.higherIsBetter ? cut : undefined
    }));
  };

  window.KA_renderThreshold = function(resultCardId, label, text, isNew){
    const card = document.querySelector('#' + resultCardId + ' .card');
    if (!card) return;
    let row = card.querySelector('.run-threshold-row');
    if (!row){
      row = document.createElement('div');
      row.className = 'metric game-highlight run-threshold-row';
      row.innerHTML = '<span class="m-lbl"></span><span class="m-val"></span>';
      const firstBtn = card.querySelector('button');
      if (firstBtn) card.insertBefore(row, firstBtn); else card.appendChild(row);
    }
    row.querySelector('.m-lbl').textContent = label;
    row.querySelector('.m-val').textContent = text;
    row.classList.toggle('is-new', !!isNew);
  };

  // Adaptive and ranked runs show different rows — hide whichever set doesn't apply. Games
  // whose adaptive mode has no rank ladder at all (none currently — see KA_setResultModeRanked
  // below for the ones that do) use this to show only the raw threshold, no rank row.
  window.KA_setResultMode = function(resultCardId, adaptive){
    const card = document.querySelector('#' + resultCardId + ' .card');
    if (!card) return;
    ['.run-rank-acc', '.run-rank-speed', '.run-rank-row'].forEach(sel => {
      const el = card.querySelector(sel);
      if (el) el.style.display = adaptive ? 'none' : '';
    });
    const t = card.querySelector('.run-threshold-row');
    if (t) t.style.display = adaptive ? '' : 'none';
  };

  // For adaptive runs that DO have a rank ladder (KA_ADAPTIVE_RANKS): show the raw
  // threshold/rounds number AND the rank it lands on, side by side — no accuracy/speed
  // sub-badges, since an adaptive run only has the one dimension to rank.
  window.KA_setResultModeRanked = function(resultCardId){
    const card = document.querySelector('#' + resultCardId + ' .card');
    if (!card) return;
    ['.run-rank-acc', '.run-rank-speed'].forEach(sel => {
      const el = card.querySelector(sel);
      if (el) el.style.display = 'none';
    });
    ['.run-threshold-row', '.run-rank-row'].forEach(sel => {
      const el = card.querySelector(sel);
      if (el) el.style.display = '';
    });
  };

  // Single source of truth for every game's record key(s) — drives the Stats and Leaderboards screens.
  window.KA_GAMES = [
    // Colour Flick — shelved. Un-comment this entry and its menu tile to bring it back;
    // its stored records under lab_best_* are left untouched in localStorage meanwhile.
    // { id:'lab', name:'Colour Flick', category:'Reaction Speed', tile:'tileReactionLab', type:'time-multi',
    //   metrics:[ {key:'lab_best_A', label:'Color reaction', isTime:true}, {key:'lab_best_Bclick', label:'B click', isTime:true}, {key:'lab_best_Cclick', label:'C click', isTime:true} ] },
    // speedMid = the realistic average response time for that task, which sits on Silver.
    // Games without it are ranked on their primary metric alone (rounds, or accuracy only).
    { id:'gng', name:'Go / No-Go', category:'Reaction Speed', tile:'tileGoNoGo', type:'count', total:20, key:'gng_best_correct', speedMid:400 },
    { id:'frx', name:'Flash Reflex', category:'Reaction Speed', tile:'tileFlashReflex', type:'mixed',
      metrics:[ {key:'frx_best_rounds', label:'Rounds survived', isTime:false}, {key:'frx_best_flash', label:'Fastest flash', isTime:true} ] },
    // Explicit cuts rather than speedMid multipliers: this drill is dominated by cursor
    // travel to a random edge, so its spread from a fumbled run to a clean one is wider
    // than the shared factors can express. speedMid stays as the realistic average (Silver).
    { id:'per', name:'Peripheral Ping', category:'Reaction Speed', tile:'tilePeripheralPing', type:'count', total:20, key:'per_best_correct',
      speedMid:780, speedLadder:[Infinity, 900, 820, 740, 660, 580, 500, 425, 350] },
    { id:'cr', name:'Choice Reaction', category:'Reaction Speed', tile:'tileChoiceReaction', type:'count', total:20, key:'cr_best_correct', speedMid:750,
      modes:['normal','hard'], adaptiveKey:'cr_best_threshold', adaptiveHigherIsBetter:false, adaptiveUnit:'ms' },
    { id:'aud', name:'Audio Reflex', category:'Reaction Speed', tile:'tileAudioReflex', type:'count', total:15, key:'aud_best_correct', speedMid:380 },
    { id:'bfx', name:'Base Reflex', category:'Reaction Speed', tile:'tileBaseReflex', type:'time-multi',
      metrics:[ {key:'rank_best_avg_rt', label:'Best average', isTime:true} ] },
    { id:'flk', name:'Flanker Task', category:'Processing Speed', tile:'tileFlanker', type:'count-multi', speedMid:480,
      metrics:[ {key:'flk_best_correct_easy', label:'Easy', total:20}, {key:'flk_best_correct_full', label:'Full', total:20} ],
      adaptiveKey:'flk_best_threshold', adaptiveHigherIsBetter:true, adaptiveUnit:'rounds' },
    { id:'par', name:'Parity Rush', category:'Processing Speed', tile:'tileParityRush', type:'count', total:20, key:'par_best_correct', speedMid:560, modes:['normal','hard'] },
    { id:'siz', name:'Size Compare', category:'Processing Speed', tile:'tileSizeCompare', type:'count', total:20, key:'siz_best_correct', speedMid:520,
      modes:['normal','hard'], adaptiveKey:'siz_best_threshold', adaptiveHigherIsBetter:true, adaptiveUnit:'rounds' },
    { id:'odd', name:'Odd One Out', category:'Processing Speed', tile:'tileOddOneOut', type:'count', total:20, key:'odd_best_correct', speedMid:700 },
    { id:'mth', name:'Math Sprint', category:'Processing Speed', tile:'tileMathSprint', type:'count', total:20, key:'mth_best_correct', speedMid:850 },
    { id:'cnt', name:'Count Rush', category:'Processing Speed', tile:'tileCountRush', type:'count', total:20, key:'cnt_best_correct', speedMid:620 },
    { id:'str', name:'Stroop Test', category:'Processing Complexity', tile:'tileStroop', type:'count', total:20, key:'str_best_correct', speedMid:720, modes:['normal','hard'] },
    { id:'ant', name:'Anti-Saccade', category:'Processing Complexity', tile:'tileAntiSaccade', type:'count', total:20, key:'ant_best_correct', speedMid:560 },
    { id:'trg', name:'Trigger Discipline', category:'Processing Complexity', tile:'tileTriggerDiscipline', type:'count', total:20, key:'trg_best_correct', speedMid:480 },
    { id:'sme', name:'Simon Effect', category:'Processing Complexity', tile:'tileSimonEffect', type:'count', total:20, key:'sme_best_correct', speedMid:520 },
    { id:'fsr', name:'Feature Search', category:'Processing Complexity', tile:'tileFeatureSearch', type:'count', total:20, key:'fsr_best_correct', speedMid:850 },
    { id:'spl', name:'Split Focus', category:'Processing Complexity', tile:'tileSplitFocus', type:'count', total:20, key:'spl_best_correct', speedMid:420 },
    { id:'sim', name:'Simon Sequence', category:'Memory', tile:'tileSimon', type:'rounds', key:'sim_best_rounds' },
    { id:'nbk', name:'Symbol 1-Back', category:'Memory', tile:'tileSymbolMatch', type:'count', total:20, key:'nbk_best_correct', speedMid:560, modes:['easy','hard'] },
    { id:'grd', name:'Grid Recall', category:'Memory', tile:'tileGridRecall', type:'rounds', key:'grd_best_rounds' },
    { id:'clo', name:'Callout Recall', category:'Memory', tile:'tileCalloutRecall', type:'count', total:12, key:'clo_best_correct',
      adaptiveKey:'clo_best_threshold', adaptiveHigherIsBetter:true, adaptiveUnit:'callouts' },
    { id:'ldr', name:'Loadout Recall', category:'Memory', tile:'tileLoadoutRecall', type:'count', total:12, key:'ldr_best_correct', speedMid:2600 },
    { id:'rev', name:'Sequence Reversal', category:'Memory', tile:'tileSequenceReversal', type:'count', total:12, key:'rev_best_correct' }
  ];

  // Resolves a single workout's rank from whatever its recorded best actually is —
  // accuracy % for fixed-trial drills, longest round for escalating-sequence drills,
  // average ms for raw-time drills. Returns null until that workout has been played.
  window.KA_getGameRank = function(game){
    // Dual-ranked games fold their best accuracy and best average speed into one tier.
    function accPlusSpeed(pct){
      const accRank = window.KA_getAccRank(pct);
      const bestRt = game.speedMid ? window.KA_records.get(game.id + '_best_avg_rt', null) : null;
      const speedRank = window.KA_getSpeedRank(bestRt, game);
      return {
        rank: window.KA_combineRanks(accRank, speedRank),
        value: speedRank ? pct.toFixed(0) + '% · ' + bestRt.toFixed(0) + ' ms' : pct.toFixed(0) + '%'
      };
    }
    if (game.type === 'count'){
      const v = window.KA_records.get(game.key, null);
      if (v === null) return null;
      return accPlusSpeed((v / game.total) * 100);
    }
    if (game.type === 'count-multi'){
      const pcts = game.metrics.map(m => {
        const v = window.KA_records.get(m.key, null);
        return v === null ? null : (v / m.total) * 100;
      }).filter(p => p !== null);
      if (!pcts.length) return null;
      return accPlusSpeed(pcts.reduce((a, b) => a + b, 0) / pcts.length);
    }
    if (game.type === 'rounds'){
      const v = window.KA_records.get(game.key, null);
      if (v === null) return null;
      return { rank: window.KA_getRoundsRank(v), value: v + ' rounds' };
    }
    if (game.type === 'mixed'){
      const roundsMetric = game.metrics.find(m => !m.isTime);
      const v = roundsMetric ? window.KA_records.get(roundsMetric.key, null) : null;
      if (v === null || v === undefined) return null;
      return { rank: window.KA_getFlashRank(v), value: v + ' rounds' };
    }
    if (game.type === 'time-multi'){
      const times = game.metrics.map(m => window.KA_records.get(m.key, null)).filter(t => t !== null);
      if (!times.length) return null;
      const avgMs = times.reduce((a, b) => a + b, 0) / times.length;
      return { rank: window.KA_getRank(avgMs), value: avgMs.toFixed(0) + ' ms' };
    }
    return null;
  };

  function KA_averageTierIndex(games){
    const idxs = games.map(g => {
      const r = window.KA_getGameRank(g);
      return r ? window.KA_rankIndex(r.rank) : null;
    }).filter(i => i !== null);
    if (!idxs.length) return null;
    const avgIdx = Math.round(idxs.reduce((a, b) => a + b, 0) / idxs.length);
    return { idx: avgIdx, played: idxs.length, total: games.length };
  }

  window.KA_getCategoryRank = function(category){
    const games = window.KA_GAMES.filter(g => g.category === category);
    const agg = KA_averageTierIndex(games);
    if (!agg) return null;
    return Object.assign(window.KA_rankByIndex(agg.idx), { played: agg.played, total: agg.total });
  };

  window.KA_getOverallRank = function(){
    const agg = KA_averageTierIndex(window.KA_GAMES);
    if (!agg) return null;
    return Object.assign(window.KA_rankByIndex(agg.idx), { played: agg.played, total: agg.total });
  };

  // Formats a single metric's stored value for display — shared by Stats and Leaderboards.
  window.KA_fmtMetric = function(value, metric){
    if (value === null || value === undefined) return '—';
    if (metric.total) return value + ' / ' + metric.total;
    if (metric.isTime) return value.toFixed(1) + ' ms';
    return String(value);
  };

  // Monday-aligned week boundaries — everything about Weekly Challenge is scoped to this.
  window.KA_getWeekStart = function(d){
    const date = new Date(d);
    date.setHours(0, 0, 0, 0);
    const day = date.getDay(); // 0=Sun..6=Sat
    const diff = (day === 0 ? -6 : 1) - day;
    date.setDate(date.getDate() + diff);
    return date;
  };
  window.KA_getWeekIndex = function(d){
    return Math.floor(window.KA_getWeekStart(d).getTime() / (7 * 24 * 60 * 60 * 1000));
  };

  // This week's best per game — separate from the all-time KA_records best, so Weekly
  // Challenge can show "your best this week" even on weeks you don't set a new record.
  window.KA_weekly = {
    get(gameId, weekIndex, fallback){
      try{
        const v = localStorage.getItem('ka_weekly_' + gameId + '_' + weekIndex);
        return v === null ? fallback : JSON.parse(v);
      } catch(e){ return fallback; }
    },
    set(gameId, weekIndex, value){
      try{ localStorage.setItem('ka_weekly_' + gameId + '_' + weekIndex, JSON.stringify(value)); } catch(e){}
    },
    // Records value as this week's best if it beats what's already stored — higherIsBetter
    // defaults to true (most games); pass false for the rare lower-is-better metric.
    record(gameId, value, higherIsBetter){
      if (higherIsBetter === undefined) higherIsBetter = true;
      const weekIndex = window.KA_getWeekIndex(new Date());
      const current = window.KA_weekly.get(gameId, weekIndex, null);
      const isBetter = current === null || (higherIsBetter ? value > current : value < current);
      if (isBetter) window.KA_weekly.set(gameId, weekIndex, value);
      return isBetter ? value : current;
    }
  };

  // The pool Weekly Challenge rotates through — single-run, single-metric games only
  // (Colour Flick is continuous trials rather than fixed runs, and Flanker has two
  // separate modes, so neither fits a single "this week's best" number cleanly).
  window.KA_WEEKLY_POOL = ['gng', 'frx', 'per', 'cr', 'aud', 'par', 'siz', 'odd', 'mth', 'cnt', 'str', 'ant', 'trg', 'sme', 'fsr', 'spl', 'sim', 'nbk', 'grd', 'clo', 'ldr', 'rev'];

  // The KA_records key + display total for each pool game's single weekly-tracked metric.
  // Kept separate from KA_GAMES because a couple of entries there (Flash Reflex) use a
  // multi-metric shape with no flat top-level key, which the weekly view needs regardless.
  window.KA_WEEKLY_META = {
    gng: { key: 'gng_best_correct', total: 20 },
    frx: { key: 'frx_best_rounds', total: null },
    per: { key: 'per_best_correct', total: 20 },
    cr:  { key: 'cr_best_correct', total: 20 },
    aud: { key: 'aud_best_correct', total: 15 },
    par: { key: 'par_best_correct', total: 20 },
    siz: { key: 'siz_best_correct', total: 20 },
    odd: { key: 'odd_best_correct', total: 20 },
    mth: { key: 'mth_best_correct', total: 20 },
    cnt: { key: 'cnt_best_correct', total: 20 },
    str: { key: 'str_best_correct', total: 20 },
    ant: { key: 'ant_best_correct', total: 20 },
    trg: { key: 'trg_best_correct', total: 20 },
    sme: { key: 'sme_best_correct', total: 20 },
    fsr: { key: 'fsr_best_correct', total: 20 },
    spl: { key: 'spl_best_correct', total: 20 },
    sim: { key: 'sim_best_rounds', total: null },
    nbk: { key: 'nbk_best_correct', total: 20 },
    grd: { key: 'grd_best_rounds', total: null },
    clo: { key: 'clo_best_correct', total: 12 },
    ldr: { key: 'ldr_best_correct', total: 12 },
    rev: { key: 'rev_best_correct', total: 12 }
  };
