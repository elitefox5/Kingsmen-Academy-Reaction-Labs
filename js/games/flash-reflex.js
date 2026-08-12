(function(){
  const DIRECTIONS = ['left', 'right', 'up', 'down'];
  const INITIAL_FLASH = 200; // ms the arrow stays visible on round 1
  const FLASH_FLOOR = 16.7; // ms — 1 frame at 60fps; the fastest the flash will ever get, since anything shorter can't reliably paint at all
  const RAMP_ROUNDS = 60; // correct rounds it takes to go from INITIAL_FLASH down to FLASH_FLOOR — flash hits max speed at round 60
  const FLASH_STEP = (INITIAL_FLASH - FLASH_FLOOR) / RAMP_ROUNDS;
  // Response window starts generous (2s to complete the flick after the arrow's gone) since
  // early rounds are about reacting to a flash you can still see, not being rushed. Once the
  // flash ramp bottoms out at FLASH_FLOOR (round 60), the window itself starts closing in
  // instead — 5% tighter per successful round — so the difficulty never actually stops
  // climbing even after the flash has nothing further to give. That decay puts the practical
  // ceiling for even a flawless player somewhere around round 100-110, which is the point.
  const RESPONSE_WINDOW = 2000;
  const WINDOW_SHRINK_FACTOR = 0.95;
  const MOVE_THRESHOLD = 10; // cumulative px displacement that counts as a directional response
  const GAP_MIN = 200, GAP_MAX = 1000; // random pause between rounds
  const TOTAL_LIVES = 3;

  const frxHud = document.getElementById('frxHud');
  const frxRoundVal = document.getElementById('frxRoundVal');
  const frxLivesVal = document.getElementById('frxLivesVal');
  const frxSpeedVal = document.getElementById('frxSpeedVal');
  const frxScoreVal = document.getElementById('frxScoreVal');
  const frxArrow = document.getElementById('frxArrow');
  const frxFeedback = document.getElementById('frxFeedback');
  const frxStartPanel = document.getElementById('frxStartPanel');
  const frxStartBtn = document.getElementById('frxStartBtn');
  const frxResultCard = document.getElementById('frxResultCard');
  const frxNextBtn = document.getElementById('frxNextBtn');
  const frxLog = document.getElementById('frxLog');

  let round, lives, score, flashDuration, respWindow, results, runHistory = [];
  let phase = 'idle'; // 'flash' | 'response'
  let appearTime = null;
  let sumDX = 0, sumDY = 0;
  let currentTrial = null;
  let timers = {};

  function fmtMs(ms){
    if (ms === null || ms === undefined) return '—';
    return ms.toFixed(0) + ' ms';
  }

  function clearTimers(){
    clearTimeout(timers.flash);
    clearTimeout(timers.response);
    clearTimeout(timers.advance);
    clearInterval(timers.countdown);
  }

  function updateHud(){
    frxRoundVal.textContent = round;
    frxLivesVal.textContent = lives;
    // Once the flash has bottomed out at FLASH_FLOOR, the label/value swap to reporting the
    // shrinking response window instead — that's the dimension still escalating from here on.
    if (flashDuration <= FLASH_FLOOR){
      frxSpeedVal.previousElementSibling.textContent = 'WINDOW';
      frxSpeedVal.textContent = Math.round(respWindow) + ' ms';
    } else {
      frxSpeedVal.previousElementSibling.textContent = 'FLASH';
      frxSpeedVal.textContent = flashDuration.toFixed(1) + ' ms';
    }
    frxScoreVal.textContent = score;
  }

  function clearFeedback(){
    frxFeedback.textContent = '';
    frxFeedback.className = 'frx-feedback';
  }

  function showFeedback(msg, kind){
    frxFeedback.textContent = msg;
    frxFeedback.className = 'frx-feedback ' + kind;
  }

  function hideArrow(){
    frxArrow.style.display = 'none';
    frxArrow.textContent = '';
  }

  function startRun(){
    round = 0;
    lives = TOTAL_LIVES;
    score = 0;
    flashDuration = INITIAL_FLASH;
    respWindow = RESPONSE_WINDOW;
    results = [];
    phase = 'idle';
    clearTimers();
    frxStartPanel.style.display = 'none';
    frxResultCard.style.display = 'none';
    frxHud.style.display = '';
    clearFeedback();
    hideArrow();
    updateHud();
    startCountdown();
  }

  function startCountdown(){
    let n = 3;
    frxArrow.style.fontFamily = 'var(--mono)';
    frxArrow.style.fontSize = '72px';
    frxArrow.style.color = 'var(--amber)';
    frxArrow.textContent = n;
    frxArrow.style.display = 'block';
    timers.countdown = setInterval(() => {
      n--;
      if (n > 0){
        frxArrow.textContent = n;
      } else {
        clearInterval(timers.countdown);
        frxArrow.style.fontFamily = '';
        frxArrow.style.fontSize = '';
        frxArrow.style.color = '';
        hideArrow();
        nextRound();
      }
    }, 700);
  }

  function nextRound(){
    if (lives <= 0){
      finishRun();
      return;
    }
    round++;
    updateHud();
    clearFeedback();

    const direction = DIRECTIONS[Math.floor(Math.random() * DIRECTIONS.length)];
    currentTrial = { round, direction, flashDuration, rt: null, outcome: null };

    frxArrow.innerHTML = window.KA_arrowIcon(direction);
    frxArrow.style.display = 'block';
    window.KA_sound.stimulus();
    phase = 'flash';
    timers.flash = setTimeout(startResponseWindow, flashDuration);
  }

  function startResponseWindow(){
    hideArrow();
    // The reaction is timed from the arrow disappearing, so confirm THAT paint,
    // not the flash's appearance, before arming the response window.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        phase = 'response';
        sumDX = 0; sumDY = 0;
        appearTime = performance.now();
        timers.response = setTimeout(handleTimeout, respWindow);
      });
    });
  }

  function resolveResponse(){
    const rt = window.KA_applyGrace(performance.now() - appearTime);
    phase = 'idle';
    clearTimeout(timers.response);

    const dir = Math.abs(sumDX) > Math.abs(sumDY)
      ? (sumDX > 0 ? 'right' : 'left')
      : (sumDY > 0 ? 'down' : 'up');
    const correct = dir === currentTrial.direction;

    currentTrial.rt = rt;
    if (correct){
      currentTrial.outcome = 'correct';
      score++;
      showFeedback('CAUGHT IT — ' + fmtMs(rt), 'good');
      const atMaxFlash = flashDuration <= FLASH_FLOOR; // already maxed out going into this round
      flashDuration = Math.max(FLASH_FLOOR, flashDuration - FLASH_STEP);
      if (atMaxFlash) respWindow *= WINDOW_SHRINK_FACTOR;
    } else {
      currentTrial.outcome = 'incorrect';
      lives--;
      window.KA_sound.error();
      showFeedback('WRONG DIRECTION', 'bad');
    }
    settleRound();
  }

  function handleTimeout(){
    if (phase !== 'response') return;
    phase = 'idle';
    currentTrial.outcome = 'timeout';
    lives--;
    window.KA_sound.error();
    showFeedback('TOO SLOW', 'bad');
    settleRound();
  }

  function settleRound(){
    results.push(currentTrial);
    updateHud();
    const gap = GAP_MIN + Math.random() * (GAP_MAX - GAP_MIN);
    timers.advance = setTimeout(nextRound, gap);
  }

  function avg(arr){
    if (!arr.length) return null;
    return arr.reduce((a,b) => a+b, 0) / arr.length;
  }

  function finishRun(){
    frxHud.style.display = '';
    clearFeedback();
    hideArrow();

    const correctTrials = results.filter(r => r.outcome === 'correct');
    const missedTrials = results.filter(r => r.outcome !== 'correct');
    const avgRt = avg(correctTrials.map(r => r.rt));
    const bestSpeed = correctTrials.length ? correctTrials[correctTrials.length - 1].flashDuration : null;

    document.getElementById('frxRRounds').textContent = results.length;
    document.getElementById('frxRHits').textContent = correctTrials.length;
    document.getElementById('frxRErrors').textContent = missedTrials.length;
    document.getElementById('frxRAvgRt').textContent = fmtMs(avgRt);
    document.getElementById('frxRBestSpeed').textContent = bestSpeed === null ? '—' : bestSpeed.toFixed(1) + ' ms';

    const bestRounds = window.KA_records.get('frx_best_rounds', null);
    const isNewBestRounds = bestRounds === null || results.length > bestRounds;
    if (isNewBestRounds) window.KA_records.set('frx_best_rounds', results.length);
    window.KA_weekly.record('frx', results.length);
    document.getElementById('frxRBestRounds').textContent = isNewBestRounds ? results.length : bestRounds;
    document.getElementById('frxRBestRoundsRow').classList.toggle('is-new', isNewBestRounds);

    if (bestSpeed !== null){
      const bestFlash = window.KA_records.get('frx_best_flash', null);
      const isNewBestFlash = bestFlash === null || bestSpeed < bestFlash;
      if (isNewBestFlash) window.KA_records.set('frx_best_flash', bestSpeed);
      document.getElementById('frxRBestFlash').textContent = (isNewBestFlash ? bestSpeed : bestFlash).toFixed(1) + ' ms';
      document.getElementById('frxRBestFlashRow').classList.toggle('is-new', isNewBestFlash);
    } else {
      const bestFlash = window.KA_records.get('frx_best_flash', null);
      document.getElementById('frxRBestFlash').textContent = bestFlash === null ? '—' : bestFlash.toFixed(1) + ' ms';
      document.getElementById('frxRBestFlashRow').classList.remove('is-new');
    }

    window.KA_renderRunRank('frxResultCard', window.KA_getFlashRank(results.length));
    frxResultCard.style.display = 'flex';

    runHistory.unshift({ rounds: results.length, correct: correctTrials.length, bestSpeed, avgRt });
    if (runHistory.length > 6) runHistory.pop();
    renderLog();
    window.KA_history.add('Flash Reflex', `rounds ${results.length} · correct ${correctTrials.length} · fastest ${bestSpeed === null ? '—' : bestSpeed.toFixed(1) + ' ms'}`);
  }

  function renderLog(){
    frxLog.innerHTML = runHistory.map((h, i) =>
      `<span class="entry">Run ${runHistory.length - i} — rounds <b>${h.rounds}</b> &middot; correct <b>${h.correct}</b> &middot; fastest flash beaten <b>${h.bestSpeed === null ? '—' : h.bestSpeed.toFixed(1) + ' ms'}</b> &middot; avg RT <b>${fmtMs(h.avgRt)}</b></span>`
    ).join('<span style="color:var(--grid)">|</span>');
  }

  // Shared by real mouse movement (movementX/Y deltas, fired continuously by the browser)
  // and touch (where we compute our own delta between consecutive touchmove points, since
  // touch events carry no movementX/Y of their own).
  function applyMovementDelta(dx, dy){
    if (phase !== 'response') return;
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
    if (phase === 'response') e.preventDefault();
    const t = e.touches[0];
    const dx = t.clientX - lastTouch.x;
    const dy = t.clientY - lastTouch.y;
    lastTouch = { x: t.clientX, y: t.clientY };
    applyMovementDelta(dx, dy);
  }, { passive: false });
  window.addEventListener('touchend', () => { lastTouch = null; });

  frxStartBtn.addEventListener('click', startRun);
  frxNextBtn.addEventListener('click', startRun);

  window.frxEnterHook = function(){
    clearTimers();
    phase = 'idle';
    hideArrow();
    frxArrow.style.fontFamily = '';
    frxArrow.style.fontSize = '';
    frxArrow.style.color = '';
    frxStartPanel.style.display = '';
    frxResultCard.style.display = 'none';
    frxHud.style.display = 'none';
    clearFeedback();
  };
})();
