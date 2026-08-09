(function(){
  const TOTAL_TRIALS = 20;
  const RESPONSE_WINDOW = 1500;
  const ISI_MIN = 500, ISI_MAX = 1000;
  const POST_PAUSE = 350;
  const MIN_DIAMETER = 30, MAX_DIAMETER = 110, MIN_DIFF = 8;

  // Adaptive is never-ending: one wrong answer or timeout ends the run outright, no fixed
  // trial count. Difficulty escalates through three phases, in order, and never resets:
  //   1. the size gap between the two circles shrinks each success, down to a hairline
  //   2. once the gap bottoms out, both circles drift together toward tiny or huge (each
  //      success picks a random direction) until they hit a floor or ceiling size
  //   3. once that's maxed out, the response window itself starts closing in — 5% tighter
  //      per success — so the pressure never actually stops even after size stops changing
  // Score is just total rounds survived across all three phases combined.
  const ADAPTIVE_GAP_START = 45, ADAPTIVE_GAP_STEP = 3, ADAPTIVE_GAP_FLOOR = 1;
  const ADAPTIVE_SIZE_START = (MIN_DIAMETER + MAX_DIAMETER) / 2;
  const ADAPTIVE_SIZE_STEP = 6, ADAPTIVE_SIZE_MIN = 14, ADAPTIVE_SIZE_MAX = 160;
  const ADAPTIVE_TIME_FACTOR = 0.95;

  const sizLeftZone = document.getElementById('sizLeftZone');
  const sizRightZone = document.getElementById('sizRightZone');
  const sizLeftCircle = document.getElementById('sizLeftCircle');
  const sizRightCircle = document.getElementById('sizRightCircle');
  const sizFeedback = document.getElementById('sizFeedback');
  const sizStartPanel = document.getElementById('sizStartPanel');
  const sizStartBtn = document.getElementById('sizStartBtn');
  const sizResultCard = document.getElementById('sizResultCard');
  const sizNextBtn = document.getElementById('sizNextBtn');
  const sizLog = document.getElementById('sizLog');
  const sizTrialVal = document.getElementById('sizTrialVal');
  const sizScoreVal = document.getElementById('sizScoreVal');
  const sizRuleVal = document.getElementById('sizRuleVal');
  const sizNormalBtn = document.getElementById('sizNormalBtn');
  const sizHardBtn = document.getElementById('sizHardBtn');
  const sizAdaptiveBtn = document.getElementById('sizAdaptiveBtn');

  let trialIndex, score, results, runHistory = [];
  let armed = false, appearTime = null, currentTrial = null, timers = {};
  let mode = 'normal';
  let switchPoints = [];
  let targetRule = 'bigger';
  let runTotal = TOTAL_TRIALS;

  // Adaptive-only state — reset in startRun, advanced in settleTrial, read in nextTrial.
  let adPhase = 1, adGap = ADAPTIVE_GAP_START, adBaseSize = ADAPTIVE_SIZE_START, adWindow = RESPONSE_WINDOW, adRounds = 0;

  function setMode(m){
    mode = m;
    sizNormalBtn.classList.toggle('selected', m === 'normal');
    sizHardBtn.classList.toggle('selected', m === 'hard');
    sizAdaptiveBtn.classList.toggle('selected', m === 'adaptive');
  }

  function fmtMs(ms){ if (ms === null || ms === undefined) return '—'; return ms.toFixed(0) + ' ms'; }
  function clearTimers(){ clearTimeout(timers.isi); clearTimeout(timers.response); clearTimeout(timers.advance); }
  function clearFeedback(){ sizFeedback.textContent = ''; sizFeedback.className = 'game-feedback'; }
  function showFeedback(msg, kind){ sizFeedback.textContent = msg; sizFeedback.className = 'game-feedback ' + kind; }
  function adaptivePhaseLabel(){
    if (adPhase === 1) return Math.round(adGap) + 'px gap';
    if (adPhase === 2) return Math.round(adBaseSize) + 'px size';
    return Math.round(adWindow) + 'ms window';
  }
  function updateHud(){
    sizTrialVal.textContent = mode === 'adaptive' ? String(adRounds) : (trialIndex + ' / ' + runTotal);
    sizScoreVal.textContent = score;
    sizRuleVal.textContent = mode === 'adaptive' ? adaptivePhaseLabel() : targetRule.toUpperCase();
  }
  function hideCircles(){ sizLeftZone.style.display = 'none'; sizRightZone.style.display = 'none'; }

  function startRun(){
    trialIndex = 0; score = 0; results = []; armed = false; clearTimers();
    targetRule = 'bigger';
    adPhase = 1; adGap = ADAPTIVE_GAP_START; adBaseSize = ADAPTIVE_SIZE_START; adWindow = RESPONSE_WINDOW; adRounds = 0;
    runTotal = TOTAL_TRIALS;
    switchPoints = mode === 'hard' ? [Math.floor(TOTAL_TRIALS / 3) + 1, Math.floor(TOTAL_TRIALS * 2 / 3) + 1] : [];
    sizRuleVal.previousElementSibling.textContent = mode === 'adaptive' ? 'PHASE' : 'RULE';
    window.KA_setResultMode('sizResultCard', mode === 'adaptive');
    sizStartPanel.style.display = 'none'; sizResultCard.style.display = 'none';
    clearFeedback(); hideCircles();
    updateHud();
    nextTrial();
  }

  function nextTrial(){
    // Adaptive has no trial cap — it only ever stops on a failure, handled in settleTrial.
    if (mode !== 'adaptive' && trialIndex >= runTotal){ finishRun(); return; }
    trialIndex++;
    updateHud(); clearFeedback();
    hideCircles();
    if (switchPoints.includes(trialIndex)){
      targetRule = targetRule === 'bigger' ? 'smaller' : 'bigger';
      updateHud();
      showFeedback('RULE FLIPPED — ' + targetRule.toUpperCase(), 'neutral');
    }
    let leftSize, rightSize;
    if (mode === 'adaptive'){
      // Phase 1 shrinks the gap within the normal size range; phases 2-3 hold the gap at
      // its floor and instead drift the shared base size toward the extremes.
      const gap = adPhase === 1 ? adGap : ADAPTIVE_GAP_FLOOR;
      const base = adPhase === 1
        ? MIN_DIAMETER + Math.random() * (MAX_DIAMETER - MIN_DIAMETER - gap)
        : adBaseSize;
      const biggerLeft = Math.random() < 0.5;
      leftSize  = biggerLeft ? base + gap : base;
      rightSize = biggerLeft ? base : base + gap;
    } else {
      leftSize = MIN_DIAMETER + Math.random() * (MAX_DIAMETER - MIN_DIAMETER);
      do { rightSize = MIN_DIAMETER + Math.random() * (MAX_DIAMETER - MIN_DIAMETER); }
      while (Math.abs(rightSize - leftSize) < MIN_DIFF);
    }
    const bigger = rightSize > leftSize ? 'right' : 'left';
    currentTrial = { trial: trialIndex, leftSize, rightSize, bigger, rt: null, outcome: null };
    const isi = ISI_MIN + Math.random() * (ISI_MAX - ISI_MIN);
    timers.isi = setTimeout(() => showCircles(leftSize, rightSize), isi);
  }

  function showCircles(leftSize, rightSize){
    sizLeftCircle.style.width = leftSize + 'px';
    sizLeftCircle.style.height = leftSize + 'px';
    sizRightCircle.style.width = rightSize + 'px';
    sizRightCircle.style.height = rightSize + 'px';
    sizLeftZone.style.display = 'flex';
    sizRightZone.style.display = 'flex';
    const window_ = mode === 'adaptive' ? adWindow : RESPONSE_WINDOW;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        appearTime = performance.now();
        armed = true;
        timers.response = setTimeout(handleTimeout, window_);
      });
    });
  }

  function handleZoneClick(side){
    if (!armed) return;
    const rt = window.KA_applyGrace(performance.now() - appearTime);
    armed = false; clearTimeout(timers.response);
    hideCircles();
    const correctSide = targetRule === 'bigger' ? currentTrial.bigger : (currentTrial.bigger === 'left' ? 'right' : 'left');
    if (side === correctSide){
      currentTrial.rt = rt; currentTrial.outcome = 'correct'; score++;
      showFeedback('CORRECT — ' + fmtMs(rt), 'good');
    } else {
      currentTrial.outcome = 'incorrect';
      showFeedback('WRONG', 'bad');
    }
    settleTrial();
  }

  function handleTimeout(){
    if (!armed) return;
    armed = false; hideCircles();
    currentTrial.outcome = 'timeout';
    showFeedback('TOO SLOW', 'bad');
    settleTrial();
  }

  function settleTrial(){
    results.push(currentTrial);
    if (mode === 'adaptive'){
      if (currentTrial.outcome !== 'correct'){
        // One mistake ends a never-ending run — no next trial to schedule.
        updateHud();
        timers.advance = setTimeout(finishRun, POST_PAUSE);
        return;
      }
      adRounds++;
      if (adPhase === 1){
        adGap -= ADAPTIVE_GAP_STEP;
        if (adGap <= ADAPTIVE_GAP_FLOOR){ adGap = ADAPTIVE_GAP_FLOOR; adPhase = 2; }
      } else if (adPhase === 2){
        adBaseSize += (Math.random() < 0.5 ? 1 : -1) * ADAPTIVE_SIZE_STEP;
        if (adBaseSize <= ADAPTIVE_SIZE_MIN || adBaseSize >= ADAPTIVE_SIZE_MAX){
          adBaseSize = Math.max(ADAPTIVE_SIZE_MIN, Math.min(ADAPTIVE_SIZE_MAX, adBaseSize));
          adPhase = 3;
        }
      } else {
        adWindow *= ADAPTIVE_TIME_FACTOR;
      }
    }
    updateHud();
    timers.advance = setTimeout(nextTrial, POST_PAUSE);
  }

  function avg(arr){ if (!arr.length) return null; return arr.reduce((a,b) => a+b, 0) / arr.length; }

  function finishRun(){
    clearFeedback(); hideCircles();
    const correct = results.filter(r => r.outcome === 'correct');
    const wrong = results.filter(r => r.outcome === 'incorrect');
    const timeouts = results.filter(r => r.outcome === 'timeout');
    const avgRt = avg(correct.map(r => r.rt));
    const accuracy = results.length ? (correct.length / results.length) * 100 : null;

    document.getElementById('sizRCorrect').textContent = correct.length + ' / ' + results.length;
    document.getElementById('sizRAvgRt').textContent = fmtMs(avgRt);
    document.getElementById('sizRWrong').textContent = wrong.length;
    document.getElementById('sizRTimeout').textContent = timeouts.length;
    document.getElementById('sizRAcc').textContent = accuracy === null ? '—' : accuracy.toFixed(0) + '%';

    if (mode === 'adaptive'){
      const { best, isNew } = window.KA_recordThreshold('siz', adRounds, 'higher');
      document.getElementById('sizRBest').textContent = Math.round(best) + ' rounds';
      document.getElementById('sizRBestRow').classList.toggle('is-new', isNew);
      window.KA_renderThreshold('sizResultCard', 'Rounds survived',
        adRounds + ' rounds  (reached phase ' + adPhase + ')', isNew);
      window.KA_renderRunRank('sizResultCard', { combined: window.KA_getAdaptiveRank('siz', adRounds) });
      window.KA_setResultModeRanked('sizResultCard');
      window.KA_history.add('Size Compare', `adaptive · ${adRounds} rounds (phase ${adPhase})`);
    } else {
      const bestCorrect = window.KA_records.get('siz_best_correct', null);
      const isNewBest = bestCorrect === null || correct.length > bestCorrect;
      if (isNewBest) window.KA_records.set('siz_best_correct', correct.length);
      window.KA_weekly.record('siz', correct.length);
      document.getElementById('sizRBest').textContent = (isNewBest ? correct.length : bestCorrect) + ' / ' + results.length;
      document.getElementById('sizRBestRow').classList.toggle('is-new', isNewBest);
      window.KA_scoreRun('siz', 'sizResultCard', { accuracyPct: accuracy, avgRt, mode });
      window.KA_setResultMode('sizResultCard', false);
      window.KA_history.add('Size Compare', `correct ${correct.length}/${results.length} · acc ${accuracy === null ? '—' : accuracy.toFixed(0) + '%'}`);
    }
    sizResultCard.style.display = 'flex';
    runHistory.unshift({ correct: correct.length, wrong: wrong.length, timeouts: timeouts.length, avgRt, accuracy });
    if (runHistory.length > 6) runHistory.pop();
    renderLog();
  }

  function renderLog(){
    sizLog.innerHTML = runHistory.map((h, i) =>
      `<span class="entry">Run ${runHistory.length - i} — correct <b>${h.correct}</b> &middot; wrong <b>${h.wrong}</b> &middot; timeout <b>${h.timeouts}</b> &middot; avg RT <b>${fmtMs(h.avgRt)}</b></span>`
    ).join('<span style="color:var(--grid)">|</span>');
  }

  sizLeftZone.addEventListener('pointerdown', () => handleZoneClick('left'));
  sizRightZone.addEventListener('pointerdown', () => handleZoneClick('right'));
  sizStartBtn.addEventListener('click', startRun);
  sizNextBtn.addEventListener('click', startRun);
  sizNormalBtn.addEventListener('click', () => setMode('normal'));
  sizHardBtn.addEventListener('click', () => setMode('hard'));
  sizAdaptiveBtn.addEventListener('click', () => setMode('adaptive'));

  window.sizEnterHook = function(){
    clearTimers(); armed = false; hideCircles();
    targetRule = 'bigger';
    sizRuleVal.textContent = 'BIGGER';
    sizStartPanel.style.display = ''; sizResultCard.style.display = 'none';
    clearFeedback();
  };
})();
