(function(){
  const TOTAL_TRIALS = 20;
  const RESPONSE_WINDOW = 1200;
  const ISI_MIN = 600, ISI_MAX = 1400;
  const POST_PAUSE = 350;
  const EDGE_MARGIN = 50; // how close to the border the ping is placed
  const CENTER_RADIUS = 24; // how close the mouse must be to the fixation dot to re-arm

  const perPlayfield = document.querySelector('#per .game-playfield');
  const perFixation = document.getElementById('perFixation');
  const perPing = document.getElementById('perPing');
  const perFeedback = document.getElementById('perFeedback');
  const perStartPanel = document.getElementById('perStartPanel');
  const perStartBtn = document.getElementById('perStartBtn');
  const perResultCard = document.getElementById('perResultCard');
  const perNextBtn = document.getElementById('perNextBtn');
  const perLog = document.getElementById('perLog');
  const perTrialVal = document.getElementById('perTrialVal');
  const perScoreVal = document.getElementById('perScoreVal');

  let trialIndex, score, results, runHistory = [];
  let armed = false, appearTime = null, currentTrial = null, timers = {};
  let recentering = false;

  function fmtMs(ms){ if (ms === null || ms === undefined) return '—'; return ms.toFixed(0) + ' ms'; }
  function clearTimers(){ clearTimeout(timers.isi); clearTimeout(timers.response); clearTimeout(timers.advance); }
  function clearFeedback(){ perFeedback.textContent = ''; perFeedback.className = 'game-feedback'; }
  function showFeedback(msg, kind){ perFeedback.textContent = msg; perFeedback.className = 'game-feedback ' + kind; }
  function updateHud(){ perTrialVal.textContent = trialIndex + ' / ' + TOTAL_TRIALS; perScoreVal.textContent = score; }

  // Gates the next trial behind the mouse actually returning to the fixation
  // dot, so a ping can't be caught by a cursor that never left the last one.
  function waitForRecenter(){
    recentering = true;
    perFixation.classList.add('waiting');
    showFeedback('RETURN TO CENTER', 'neutral');
  }

  function checkRecenter(e){
    if (!recentering) return;
    const r = perFixation.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const dist = Math.hypot(e.clientX - cx, e.clientY - cy);
    if (dist <= CENTER_RADIUS){
      recentering = false;
      perFixation.classList.remove('waiting');
      clearFeedback();
      nextTrial();
    }
  }

  // Picks a point near one of the four edges so the ping lands in peripheral vision.
  function randomPeripheralPos(){
    const w = perPlayfield.clientWidth;
    const h = perPlayfield.clientHeight;
    const edge = Math.floor(Math.random() * 4);
    if (edge === 0) return { x: EDGE_MARGIN + Math.random() * (w - EDGE_MARGIN*2), y: EDGE_MARGIN };
    if (edge === 1) return { x: EDGE_MARGIN + Math.random() * (w - EDGE_MARGIN*2), y: h - EDGE_MARGIN };
    if (edge === 2) return { x: EDGE_MARGIN, y: EDGE_MARGIN + Math.random() * (h - EDGE_MARGIN*2) };
    return { x: w - EDGE_MARGIN, y: EDGE_MARGIN + Math.random() * (h - EDGE_MARGIN*2) };
  }

  function startRun(){
    trialIndex = 0; score = 0; results = []; armed = false; recentering = false; clearTimers();
    perStartPanel.style.display = 'none'; perResultCard.style.display = 'none';
    clearFeedback(); perPing.style.display = 'none';
    updateHud();
    waitForRecenter();
  }

  function nextTrial(){
    if (trialIndex >= TOTAL_TRIALS){ finishRun(); return; }
    trialIndex++;
    updateHud(); clearFeedback();
    perPing.style.display = 'none';
    currentTrial = { trial: trialIndex, rt: null, outcome: null };
    const isi = ISI_MIN + Math.random() * (ISI_MAX - ISI_MIN);
    timers.isi = setTimeout(showPing, isi);
  }

  function showPing(){
    const pos = randomPeripheralPos();
    perPing.style.left = pos.x + 'px';
    perPing.style.top = pos.y + 'px';
    perPing.style.display = 'block';
    window.KA_sound.stimulus();
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        appearTime = performance.now();
        armed = true;
        timers.response = setTimeout(handleTimeout, RESPONSE_WINDOW);
      });
    });
  }

  function handlePingClick(){
    if (!armed) return;
    const rt = window.KA_applyGrace(performance.now() - appearTime);
    armed = false; clearTimeout(timers.response);
    perPing.style.display = 'none';
    currentTrial.rt = rt; currentTrial.outcome = 'correct'; score++;
    showFeedback('CAUGHT IT — ' + fmtMs(rt), 'good');
    settleTrial();
  }

  function handleTimeout(){
    if (!armed) return;
    armed = false; perPing.style.display = 'none';
    currentTrial.outcome = 'timeout';
    window.KA_sound.error();
    showFeedback('MISSED', 'bad');
    settleTrial();
  }

  function settleTrial(){
    results.push(currentTrial);
    updateHud();
    timers.advance = setTimeout(waitForRecenter, POST_PAUSE);
  }

  function avg(arr){ if (!arr.length) return null; return arr.reduce((a,b) => a+b, 0) / arr.length; }

  function finishRun(){
    recentering = false;
    perFixation.classList.remove('waiting');
    clearFeedback(); perPing.style.display = 'none';
    const correct = results.filter(r => r.outcome === 'correct');
    const timeouts = results.filter(r => r.outcome === 'timeout');
    const avgRt = avg(correct.map(r => r.rt));
    const accuracy = results.length ? (correct.length / results.length) * 100 : null;

    document.getElementById('perRCorrect').textContent = correct.length + ' / ' + results.length;
    document.getElementById('perRAvgRt').textContent = fmtMs(avgRt);
    document.getElementById('perRTimeout').textContent = timeouts.length;
    document.getElementById('perRAcc').textContent = accuracy === null ? '—' : accuracy.toFixed(0) + '%';

    const bestCorrect = window.KA_records.get('per_best_correct', null);
    const isNewBest = bestCorrect === null || correct.length > bestCorrect;
    if (isNewBest) window.KA_records.set('per_best_correct', correct.length);
    window.KA_weekly.record('per', correct.length);
    document.getElementById('perRBest').textContent = (isNewBest ? correct.length : bestCorrect) + ' / ' + results.length;
    document.getElementById('perRBestRow').classList.toggle('is-new', isNewBest);

    window.KA_scoreRun('per', 'perResultCard', { accuracyPct: accuracy, avgRt });
    perResultCard.style.display = 'flex';
    runHistory.unshift({ correct: correct.length, timeouts: timeouts.length, avgRt, accuracy });
    if (runHistory.length > 6) runHistory.pop();
    renderLog();
    window.KA_history.add('Peripheral Ping', `correct ${correct.length}/${results.length} · acc ${accuracy === null ? '—' : accuracy.toFixed(0) + '%'}`);
  }

  function renderLog(){
    perLog.innerHTML = runHistory.map((h, i) =>
      `<span class="entry">Run ${runHistory.length - i} — correct <b>${h.correct}</b> &middot; missed <b>${h.timeouts}</b> &middot; avg RT <b>${fmtMs(h.avgRt)}</b></span>`
    ).join('<span style="color:var(--grid)">|</span>');
  }

  perPing.addEventListener('pointerdown', handlePingClick);
  perPlayfield.addEventListener('mousemove', checkRecenter);
  perStartBtn.addEventListener('click', startRun);
  perNextBtn.addEventListener('click', startRun);

  window.perEnterHook = function(){
    clearTimers(); armed = false; recentering = false; perPing.style.display = 'none';
    perFixation.classList.remove('waiting');
    perStartPanel.style.display = ''; perResultCard.style.display = 'none';
    clearFeedback();
  };
})();
