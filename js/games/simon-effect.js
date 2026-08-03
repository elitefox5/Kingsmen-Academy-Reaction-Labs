(function(){
  const TOTAL_TRIALS = 20;
  const RESPONSE_WINDOW = 1000;
  const ISI_MIN = 600, ISI_MAX = 1300;
  const POST_PAUSE = 350;

  const smeArrow = document.getElementById('smeArrow');
  const smeLeftZone = document.getElementById('smeLeftZone');
  const smeRightZone = document.getElementById('smeRightZone');
  const smeFeedback = document.getElementById('smeFeedback');
  const smeStartPanel = document.getElementById('smeStartPanel');
  const smeStartBtn = document.getElementById('smeStartBtn');
  const smeResultCard = document.getElementById('smeResultCard');
  const smeNextBtn = document.getElementById('smeNextBtn');
  const smeLog = document.getElementById('smeLog');
  const smeTrialVal = document.getElementById('smeTrialVal');
  const smeScoreVal = document.getElementById('smeScoreVal');

  let trialIndex, score, results, runHistory = [];
  let armed = false, appearTime = null, currentTrial = null, timers = {};

  function fmtMs(ms){ if (ms === null || ms === undefined) return '—'; return ms.toFixed(0) + ' ms'; }
  function clearTimers(){ clearTimeout(timers.isi); clearTimeout(timers.response); clearTimeout(timers.advance); }
  function clearFeedback(){ smeFeedback.textContent = ''; smeFeedback.className = 'game-feedback'; }
  function showFeedback(msg, kind){ smeFeedback.textContent = msg; smeFeedback.className = 'game-feedback ' + kind; }
  function updateHud(){ smeTrialVal.textContent = trialIndex + ' / ' + TOTAL_TRIALS; smeScoreVal.textContent = score; }

  function startRun(){
    trialIndex = 0; score = 0; results = []; armed = false; clearTimers();
    smeStartPanel.style.display = 'none'; smeResultCard.style.display = 'none';
    clearFeedback(); smeArrow.style.display = 'none';
    updateHud();
    nextTrial();
  }

  function nextTrial(){
    if (trialIndex >= TOTAL_TRIALS){ finishRun(); return; }
    trialIndex++;
    updateHud(); clearFeedback();
    smeArrow.style.display = 'none';
    const position = Math.random() < 0.5 ? 'left' : 'right';
    const direction = Math.random() < 0.5 ? 'left' : 'right';
    currentTrial = { trial: trialIndex, position, direction, rt: null, outcome: null };
    const isi = ISI_MIN + Math.random() * (ISI_MAX - ISI_MIN);
    timers.isi = setTimeout(() => showArrow(position, direction), isi);
  }

  function showArrow(position, direction){
    smeArrow.innerHTML = window.KA_arrowIcon(direction);
    if (position === 'left'){
      smeArrow.style.left = '90px';
      smeArrow.style.right = '';
    } else {
      smeArrow.style.right = '90px';
      smeArrow.style.left = '';
    }
    smeArrow.style.display = 'block';
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        appearTime = performance.now();
        armed = true;
        timers.response = setTimeout(handleTimeout, RESPONSE_WINDOW);
      });
    });
  }

  function handleZoneClick(side){
    if (!armed) return;
    const rt = window.KA_applyGrace(performance.now() - appearTime);
    armed = false; clearTimeout(timers.response);
    smeArrow.style.display = 'none';
    if (side === currentTrial.direction){
      currentTrial.rt = rt; currentTrial.outcome = 'correct'; score++;
      showFeedback('CORRECT — ' + fmtMs(rt), 'good');
    } else {
      currentTrial.outcome = 'incorrect';
      showFeedback('WRONG DIRECTION', 'bad');
    }
    settleTrial();
  }

  function handleTimeout(){
    if (!armed) return;
    armed = false; smeArrow.style.display = 'none';
    currentTrial.outcome = 'timeout';
    showFeedback('TOO SLOW', 'bad');
    settleTrial();
  }

  function settleTrial(){
    results.push(currentTrial);
    updateHud();
    timers.advance = setTimeout(nextTrial, POST_PAUSE);
  }

  function avg(arr){ if (!arr.length) return null; return arr.reduce((a,b) => a+b, 0) / arr.length; }

  function finishRun(){
    clearFeedback(); smeArrow.style.display = 'none';
    const correct = results.filter(r => r.outcome === 'correct');
    const wrong = results.filter(r => r.outcome === 'incorrect');
    const timeouts = results.filter(r => r.outcome === 'timeout');
    const avgRt = avg(correct.map(r => r.rt));
    const accuracy = results.length ? (correct.length / results.length) * 100 : null;

    document.getElementById('smeRCorrect').textContent = correct.length + ' / ' + results.length;
    document.getElementById('smeRAvgRt').textContent = fmtMs(avgRt);
    document.getElementById('smeRWrong').textContent = wrong.length;
    document.getElementById('smeRTimeout').textContent = timeouts.length;
    document.getElementById('smeRAcc').textContent = accuracy === null ? '—' : accuracy.toFixed(0) + '%';

    const bestCorrect = window.KA_records.get('sme_best_correct', null);
    const isNewBest = bestCorrect === null || correct.length > bestCorrect;
    if (isNewBest) window.KA_records.set('sme_best_correct', correct.length);
    window.KA_weekly.record('sme', correct.length);
    document.getElementById('smeRBest').textContent = (isNewBest ? correct.length : bestCorrect) + ' / ' + results.length;
    document.getElementById('smeRBestRow').classList.toggle('is-new', isNewBest);

    window.KA_scoreRun('sme', 'smeResultCard', { accuracyPct: accuracy, avgRt });
    smeResultCard.style.display = 'flex';
    runHistory.unshift({ correct: correct.length, wrong: wrong.length, timeouts: timeouts.length, avgRt, accuracy });
    if (runHistory.length > 6) runHistory.pop();
    renderLog();
    window.KA_history.add('Simon Effect', `correct ${correct.length}/${results.length} · acc ${accuracy === null ? '—' : accuracy.toFixed(0) + '%'}`);
  }

  function renderLog(){
    smeLog.innerHTML = runHistory.map((h, i) =>
      `<span class="entry">Run ${runHistory.length - i} — correct <b>${h.correct}</b> &middot; wrong <b>${h.wrong}</b> &middot; timeout <b>${h.timeouts}</b> &middot; avg RT <b>${fmtMs(h.avgRt)}</b></span>`
    ).join('<span style="color:var(--grid)">|</span>');
  }

  smeLeftZone.addEventListener('pointerdown', () => handleZoneClick('left'));
  smeRightZone.addEventListener('pointerdown', () => handleZoneClick('right'));
  smeStartBtn.addEventListener('click', startRun);
  smeNextBtn.addEventListener('click', startRun);

  window.smeEnterHook = function(){
    clearTimers(); armed = false; smeArrow.style.display = 'none';
    smeStartPanel.style.display = ''; smeResultCard.style.display = 'none';
    clearFeedback();
  };
})();
