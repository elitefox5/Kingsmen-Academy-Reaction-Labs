(function(){
  const EASY_DIRS = ['left', 'right'];
  const FULL_DIRS = ['left', 'right', 'up', 'down'];
  const TOTAL_TRIALS = 20;
  const RESPONSE_WINDOW = 1000; // ms to complete the directional flick
  const MOVE_THRESHOLD = 30; // cumulative px displacement that counts as a directional response
  // The old version only ignored movement before `armed` became true — which did nothing
  // to stop a player continuously swinging their mouse through the whole wait and simply
  // being mid-swing when the arrows appeared, banking a near-zero "reaction time" on pure
  // luck regardless of the target. RECENTER_MS gives an explicit, movement-allowed window
  // right after a trial to return the mouse to a neutral position; STILL_THRESHOLD then
  // requires genuine stillness for the remainder of the wait, with any real movement in
  // that window failing the trial outright as a false start.
  const RECENTER_MS = 500;
  const STILL_THRESHOLD = 8; // cumulative px allowed during the required-still window (sensor jitter tolerance)
  const ISI_MIN = 1100, ISI_MAX = 2000; // total wait; RECENTER_MS of this is movement-free, the rest requires stillness
  const POST_TRIAL_PAUSE = 400;

  // Adaptive is never-ending: one wrong answer, timeout, or false start ends the run outright.
  // Phase 1: the arrows flash then vanish, for less time each success, down to a single
  // frame — you're completing the flick from a near-instant glimpse rather than a held view.
  // Phase 2: once the flash bottoms out, the response window itself starts closing in from a
  // generous 2s, 5% tighter per success, same escalation Flash Reflex uses once its own flash
  // ramp maxes out. Score is total rounds survived across both phases.
  const ADAPTIVE_FLASH_START = 600, ADAPTIVE_FLASH_STEP = 30, ADAPTIVE_FLASH_FLOOR = 17;
  const ADAPTIVE_WINDOW_START = 2000;
  const ADAPTIVE_TIME_FACTOR = 0.95;

  const flkHud = document.getElementById('flkHud');
  const flkModeVal = document.getElementById('flkModeVal');
  const flkTrialVal = document.getElementById('flkTrialVal');
  const flkScoreVal = document.getElementById('flkScoreVal');
  const flkStreakVal = document.getElementById('flkStreakVal');
  const flkArrows = document.getElementById('flkArrows');
  const flkFeedback = document.getElementById('flkFeedback');
  const flkStartPanel = document.getElementById('flkStartPanel');
  const flkEasyBtn = document.getElementById('flkEasyBtn');
  const flkFullBtn = document.getElementById('flkFullBtn');
  const flkAdaptiveBtn = document.getElementById('flkAdaptiveBtn');
  const flkStartBtn = document.getElementById('flkStartBtn');
  const flkResultCard = document.getElementById('flkResultCard');
  const flkNextBtn = document.getElementById('flkNextBtn');
  const flkLog = document.getElementById('flkLog');

  let mode = 'easy';
  let trialIndex, score, streak, results, runHistory = [];
  let armed = false, waiting = false;
  let appearTime = null;
  let sumDX = 0, sumDY = 0;
  let stillDX = 0, stillDY = 0;
  let currentTrial = null;
  let timers = {};

  // Adaptive-only state — reset in startRun, advanced in settleTrial, read in showArrows.
  let adPhase = 1, adFlash = ADAPTIVE_FLASH_START, adWindow = ADAPTIVE_WINDOW_START, adRounds = 0;

  function axisOf(dir){ return (dir === 'left' || dir === 'right') ? 'horizontal' : 'vertical'; }
  function oppositeOnAxis(dir){
    if (dir === 'left') return 'right';
    if (dir === 'right') return 'left';
    if (dir === 'up') return 'down';
    return 'up';
  }

  function fmtMs(ms){
    if (ms === null || ms === undefined) return '—';
    return ms.toFixed(0) + ' ms';
  }

  function clearTimers(){
    clearTimeout(timers.isi);
    clearTimeout(timers.recenter);
    clearTimeout(timers.response);
    clearTimeout(timers.flashHide);
    clearTimeout(timers.advance);
  }

  function setMode(m){
    mode = m;
    flkEasyBtn.classList.toggle('selected', m === 'easy');
    flkFullBtn.classList.toggle('selected', m === 'full');
    flkAdaptiveBtn.classList.toggle('selected', m === 'adaptive');
  }

  function adaptivePhaseLabel(){
    return adPhase === 1 ? Math.round(adFlash) + 'ms flash' : Math.round(adWindow) + 'ms window';
  }
  function updateHud(){
    flkModeVal.textContent = mode.toUpperCase();
    flkTrialVal.textContent = mode === 'adaptive' ? String(adRounds) : (trialIndex + ' / ' + TOTAL_TRIALS);
    flkScoreVal.textContent = score;
    flkStreakVal.textContent = mode === 'adaptive' ? adaptivePhaseLabel() : streak;
  }

  function clearFeedback(){
    flkFeedback.textContent = '';
    flkFeedback.className = 'flk-feedback';
  }

  function showFeedback(msg, kind){
    flkFeedback.textContent = msg;
    flkFeedback.className = 'flk-feedback ' + kind;
  }

  function hideArrows(){
    flkArrows.style.display = 'none';
    flkArrows.innerHTML = '';
  }

  function renderArrows(target, flankerDir){
    const axis = axisOf(target);
    flkArrows.className = axis === 'horizontal' ? 'horizontal' : 'vertical';
    let html = '';
    for (let i = 0; i < 5; i++){
      const dir = (i === 2) ? target : flankerDir;
      html += `<span class="flk-arrow">${window.KA_arrowIcon(dir)}</span>`;
    }
    flkArrows.innerHTML = html;
    flkArrows.style.display = 'flex';
  }

  function startRun(){
    trialIndex = 0;
    score = 0;
    streak = 0;
    results = [];
    armed = false;
    waiting = false;
    adPhase = 1; adFlash = ADAPTIVE_FLASH_START; adWindow = ADAPTIVE_WINDOW_START; adRounds = 0;
    clearTimers();
    flkStartPanel.style.display = 'none';
    flkResultCard.style.display = 'none';
    flkHud.style.display = '';
    flkStreakVal.previousElementSibling.textContent = mode === 'adaptive' ? 'PHASE' : 'STREAK';
    clearFeedback();
    hideArrows();
    updateHud();
    nextTrial();
  }

  function nextTrial(){
    // Adaptive has no trial cap — it only ever stops on a failure, handled in settleTrial.
    if (mode !== 'adaptive' && trialIndex >= TOTAL_TRIALS){
      finishRun();
      return;
    }
    trialIndex++;
    updateHud();
    clearFeedback();

    const dirs = mode === 'easy' ? EASY_DIRS : FULL_DIRS;
    const target = dirs[Math.floor(Math.random() * dirs.length)];
    const congruent = Math.random() < 0.5;
    const flankerDir = congruent ? target : oppositeOnAxis(target);
    currentTrial = { trial: trialIndex, target, congruent, rt: null, outcome: null };

    const isi = ISI_MIN + Math.random() * (ISI_MAX - ISI_MIN);
    // First RECENTER_MS of the wait: movement is free, so a flick response on the previous
    // trial can be walked back to a neutral position. After that, `waiting` goes true and
    // any real movement before the arrows actually appear fails the trial as a false start.
    timers.recenter = setTimeout(() => {
      waiting = true;
      stillDX = 0; stillDY = 0;
    }, RECENTER_MS);
    timers.isi = setTimeout(() => showArrows(target, flankerDir), isi);
  }

  function handleFalseStart(){
    clearTimeout(timers.isi);
    waiting = false;
    hideArrows();
    currentTrial.outcome = 'early';
    streak = 0;
    window.KA_sound.error();
    showFeedback('TOO EARLY — HOLD STILL', 'bad');
    settleTrial();
  }

  function showArrows(target, flankerDir){
    waiting = false;
    renderArrows(target, flankerDir);
    window.KA_sound.stimulus();
    sumDX = 0; sumDY = 0;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        appearTime = performance.now();
        armed = true;
        const respWindow = mode === 'adaptive' ? adWindow : RESPONSE_WINDOW;
        timers.response = setTimeout(handleTimeout, respWindow);
        if (mode === 'adaptive'){
          // Arrows vanish after the flash duration regardless of whether the player has
          // responded yet — armed stays true and the response window keeps running, so the
          // flick has to be completed from what they already saw, not what's still on screen.
          timers.flashHide = setTimeout(() => { if (armed) hideArrows(); }, adFlash);
        }
      });
    });
  }

  function resolveResponse(){
    const rt = window.KA_applyGrace(performance.now() - appearTime);
    armed = false;
    clearTimeout(timers.response);
    clearTimeout(timers.flashHide);
    hideArrows();

    const dir = Math.abs(sumDX) > Math.abs(sumDY)
      ? (sumDX > 0 ? 'right' : 'left')
      : (sumDY > 0 ? 'down' : 'up');
    const correct = dir === currentTrial.target;

    currentTrial.rt = rt;
    currentTrial.outcome = correct ? 'correct' : 'incorrect';
    if (correct){ score++; streak++; showFeedback('CORRECT — ' + fmtMs(rt), 'good'); }
    else { streak = 0; window.KA_sound.error(); showFeedback('WRONG DIRECTION', 'bad'); }
    settleTrial();
  }

  function handleTimeout(){
    if (!armed) return;
    armed = false;
    clearTimeout(timers.flashHide);
    hideArrows();
    currentTrial.outcome = 'timeout';
    streak = 0;
    window.KA_sound.error();
    showFeedback('NO RESPONSE', 'bad');
    settleTrial();
  }

  function settleTrial(){
    results.push(currentTrial);
    if (mode === 'adaptive'){
      if (currentTrial.outcome !== 'correct'){
        // One mistake ends a never-ending run — no next trial to schedule.
        updateHud();
        timers.advance = setTimeout(finishRun, POST_TRIAL_PAUSE);
        return;
      }
      adRounds++;
      if (adPhase === 1){
        adFlash -= ADAPTIVE_FLASH_STEP;
        if (adFlash <= ADAPTIVE_FLASH_FLOOR){ adFlash = ADAPTIVE_FLASH_FLOOR; adPhase = 2; }
      } else {
        adWindow *= ADAPTIVE_TIME_FACTOR;
      }
    }
    updateHud();
    timers.advance = setTimeout(nextTrial, POST_TRIAL_PAUSE);
  }

  function avg(arr){
    if (!arr.length) return null;
    return arr.reduce((a,b) => a+b, 0) / arr.length;
  }

  function finishRun(){
    flkHud.style.display = '';
    clearFeedback();
    hideArrows();

    const correctTrials = results.filter(r => r.outcome === 'correct');
    const errors = results.filter(r => r.outcome === 'incorrect');
    const timeouts = results.filter(r => r.outcome === 'timeout');
    const early = results.filter(r => r.outcome === 'early');

    const avgRt = avg(correctTrials.map(r => r.rt));
    const accuracy = results.length ? (correctTrials.length / results.length) * 100 : null;

    const congruentAvg = avg(correctTrials.filter(r => r.congruent).map(r => r.rt));
    const incongruentAvg = avg(correctTrials.filter(r => !r.congruent).map(r => r.rt));
    const flankerEffect = (congruentAvg !== null && incongruentAvg !== null) ? incongruentAvg - congruentAvg : null;

    document.getElementById('flkRHits').textContent = correctTrials.length + ' / ' + results.length;
    document.getElementById('flkRAvgRt').textContent = fmtMs(avgRt);
    document.getElementById('flkRErrors').textContent = errors.length;
    document.getElementById('flkRMisses').textContent = timeouts.length;
    document.getElementById('flkREarly').textContent = early.length;
    document.getElementById('flkRAcc').textContent = accuracy === null ? '—' : accuracy.toFixed(0) + '%';
    document.getElementById('flkRCost').textContent = flankerEffect === null ? '—' : (flankerEffect >= 0 ? '+' : '') + flankerEffect.toFixed(0) + ' ms';

    if (mode === 'adaptive'){
      const { best, isNew } = window.KA_recordThreshold('flk', adRounds, 'higher');
      document.getElementById('flkRBest').textContent = Math.round(best) + ' rounds';
      document.getElementById('flkRBestRow').classList.toggle('is-new', isNew);
      window.KA_renderThreshold('flkResultCard', 'Rounds survived',
        adRounds + ' rounds  (reached phase ' + adPhase + ')', isNew);
      window.KA_renderRunRank('flkResultCard', { combined: window.KA_getAdaptiveRank('flk', adRounds) });
      window.KA_setResultModeRanked('flkResultCard');
      window.KA_history.add('Flanker Task', `adaptive · ${adRounds} rounds (phase ${adPhase})`);
    } else {
      const bestKey = 'flk_best_correct_' + mode;
      const bestCorrect = window.KA_records.get(bestKey, null);
      const isNewBest = bestCorrect === null || correctTrials.length > bestCorrect;
      if (isNewBest) window.KA_records.set(bestKey, correctTrials.length);
      document.getElementById('flkRBest').textContent = (isNewBest ? correctTrials.length : bestCorrect) + ' / ' + results.length;
      document.getElementById('flkRBestRow').classList.toggle('is-new', isNewBest);

      window.KA_scoreRun('flk', 'flkResultCard', { accuracyPct: accuracy, avgRt, mode });
      window.KA_setResultMode('flkResultCard', false);
      window.KA_history.add('Flanker Task', `${mode} · correct ${correctTrials.length}/${results.length} · acc ${accuracy === null ? '—' : accuracy.toFixed(0) + '%'}`);
    }
    flkResultCard.style.display = 'flex';

    runHistory.unshift({ mode, correct: correctTrials.length, errors: errors.length, timeouts: timeouts.length, avgRt, accuracy });
    if (runHistory.length > 6) runHistory.pop();
    renderLog();
  }

  function renderLog(){
    flkLog.innerHTML = runHistory.map((h, i) =>
      `<span class="entry">Run ${runHistory.length - i} (${h.mode}) — correct <b>${h.correct}</b> &middot; wrong <b>${h.errors}</b> &middot; no-response <b>${h.timeouts}</b> &middot; avg RT <b>${fmtMs(h.avgRt)}</b> &middot; acc <b>${h.accuracy === null ? '—' : h.accuracy.toFixed(0) + '%'}</b></span>`
    ).join('<span style="color:var(--grid)">|</span>');
  }

  // Shared by real mouse movement (movementX/Y deltas, fired continuously by the browser)
  // and touch (where we compute our own delta between consecutive touchmove points, since
  // touch events carry no movementX/Y of their own).
  function applyMovementDelta(dx, dy){
    if (waiting){
      stillDX += dx;
      stillDY += dy;
      if (Math.hypot(stillDX, stillDY) >= STILL_THRESHOLD){
        handleFalseStart();
      }
      return;
    }
    if (!armed) return;
    sumDX += dx;
    sumDY += dy;
    if (Math.hypot(sumDX, sumDY) >= MOVE_THRESHOLD){
      resolveResponse();
    }
  }

  window.addEventListener('mousemove', (e) => {
    applyMovementDelta(e.movementX || 0, e.movementY || 0);
  });

  // Touch has no movementX/Y, so we track the previous touch point ourselves and diff
  // against it on each touchmove — same delta shape the mouse path already expects.
  let lastTouch = null;
  window.addEventListener('touchstart', (e) => {
    if (!e.touches.length) return;
    lastTouch = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }, { passive: true });
  window.addEventListener('touchmove', (e) => {
    if (!e.touches.length || !lastTouch) return;
    if (waiting || armed) e.preventDefault();
    const t = e.touches[0];
    const dx = t.clientX - lastTouch.x;
    const dy = t.clientY - lastTouch.y;
    lastTouch = { x: t.clientX, y: t.clientY };
    applyMovementDelta(dx, dy);
  }, { passive: false });
  window.addEventListener('touchend', () => { lastTouch = null; });

  flkEasyBtn.addEventListener('click', () => setMode('easy'));
  flkFullBtn.addEventListener('click', () => setMode('full'));
  flkAdaptiveBtn.addEventListener('click', () => setMode('adaptive'));
  flkStartBtn.addEventListener('click', startRun);
  flkNextBtn.addEventListener('click', startRun);

  window.flkEnterHook = function(){
    clearTimers();
    armed = false;
    waiting = false;
    hideArrows();
    flkStartPanel.style.display = '';
    flkResultCard.style.display = 'none';
    flkHud.style.display = 'none';
    clearFeedback();
  };
})();
