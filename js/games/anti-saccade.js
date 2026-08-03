(function(){
  const TOTAL_TRIALS = 20;
  const RESPONSE_WINDOW = 1000;
  const ISI_MIN = 600, ISI_MAX = 1300;
  const POST_PAUSE = 350;

  const antDot = document.getElementById('antDot');
  const antLeftZone = document.getElementById('antLeftZone');
  const antRightZone = document.getElementById('antRightZone');
  const antFeedback = document.getElementById('antFeedback');
  const antStartPanel = document.getElementById('antStartPanel');
  const antStartBtn = document.getElementById('antStartBtn');
  const antResultCard = document.getElementById('antResultCard');
  const antNextBtn = document.getElementById('antNextBtn');
  const antLog = document.getElementById('antLog');
  const antTrialVal = document.getElementById('antTrialVal');
  const antScoreVal = document.getElementById('antScoreVal');

  let trialIndex, score, results, runHistory = [];
  let armed = false, appearTime = null, currentTrial = null, timers = {};

  function fmtMs(ms){ if (ms === null || ms === undefined) return '—'; return ms.toFixed(0) + ' ms'; }
  function clearTimers(){ clearTimeout(timers.isi); clearTimeout(timers.response); clearTimeout(timers.advance); }
  function clearFeedback(){ antFeedback.textContent = ''; antFeedback.className = 'game-feedback'; }
  function showFeedback(msg, kind){ antFeedback.textContent = msg; antFeedback.className = 'game-feedback ' + kind; }
  function updateHud(){ antTrialVal.textContent = trialIndex + ' / ' + TOTAL_TRIALS; antScoreVal.textContent = score; }

  function startRun(){
    trialIndex = 0; score = 0; results = []; armed = false; clearTimers();
    antStartPanel.style.display = 'none'; antResultCard.style.display = 'none';
    clearFeedback(); antDot.style.display = 'none';
    updateHud();
    nextTrial();
  }

  function nextTrial(){
    if (trialIndex >= TOTAL_TRIALS){ finishRun(); return; }
    trialIndex++;
    updateHud(); clearFeedback();
    antDot.style.display = 'none';
    const flashSide = Math.random() < 0.5 ? 'left' : 'right';
    const correctSide = flashSide === 'left' ? 'right' : 'left';
    currentTrial = { trial: trialIndex, flashSide, correctSide, rt: null, outcome: null };
    const isi = ISI_MIN + Math.random() * (ISI_MAX - ISI_MIN);
    timers.isi = setTimeout(() => showDot(flashSide), isi);
  }

  function showDot(flashSide){
    if (flashSide === 'left'){
      antDot.style.left = '90px';
      antDot.style.right = '';
    } else {
      antDot.style.right = '90px';
      antDot.style.left = '';
    }
    antDot.style.display = 'block';
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
    antDot.style.display = 'none';
    if (side === currentTrial.correctSide){
      currentTrial.rt = rt; currentTrial.outcome = 'correct'; score++;
      showFeedback('CORRECT — ' + fmtMs(rt), 'good');
    } else {
      currentTrial.outcome = 'incorrect';
      showFeedback('WRONG SIDE', 'bad');
    }
    settleTrial();
  }

  function handleTimeout(){
    if (!armed) return;
    armed = false; antDot.style.display = 'none';
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
    clearFeedback(); antDot.style.display = 'none';
    const correct = results.filter(r => r.outcome === 'correct');
    const wrong = results.filter(r => r.outcome === 'incorrect');
    const timeouts = results.filter(r => r.outcome === 'timeout');
    const avgRt = avg(correct.map(r => r.rt));
    const accuracy = results.length ? (correct.length / results.length) * 100 : null;

    document.getElementById('antRCorrect').textContent = correct.length + ' / ' + results.length;
    document.getElementById('antRAvgRt').textContent = fmtMs(avgRt);
    document.getElementById('antRWrong').textContent = wrong.length;
    document.getElementById('antRTimeout').textContent = timeouts.length;
    document.getElementById('antRAcc').textContent = accuracy === null ? '—' : accuracy.toFixed(0) + '%';

    const bestCorrect = window.KA_records.get('ant_best_correct', null);
    const isNewBest = bestCorrect === null || correct.length > bestCorrect;
    if (isNewBest) window.KA_records.set('ant_best_correct', correct.length);
    window.KA_weekly.record('ant', correct.length);
    document.getElementById('antRBest').textContent = (isNewBest ? correct.length : bestCorrect) + ' / ' + results.length;
    document.getElementById('antRBestRow').classList.toggle('is-new', isNewBest);

    window.KA_scoreRun('ant', 'antResultCard', { accuracyPct: accuracy, avgRt });
    antResultCard.style.display = 'flex';
    runHistory.unshift({ correct: correct.length, wrong: wrong.length, timeouts: timeouts.length, avgRt, accuracy });
    if (runHistory.length > 6) runHistory.pop();
    renderLog();
    window.KA_history.add('Anti-Saccade', `correct ${correct.length}/${results.length} · acc ${accuracy === null ? '—' : accuracy.toFixed(0) + '%'}`);
  }

  function renderLog(){
    antLog.innerHTML = runHistory.map((h, i) =>
      `<span class="entry">Run ${runHistory.length - i} — correct <b>${h.correct}</b> &middot; wrong <b>${h.wrong}</b> &middot; timeout <b>${h.timeouts}</b> &middot; avg RT <b>${fmtMs(h.avgRt)}</b></span>`
    ).join('<span style="color:var(--grid)">|</span>');
  }

  antLeftZone.addEventListener('pointerdown', () => handleZoneClick('left'));
  antRightZone.addEventListener('pointerdown', () => handleZoneClick('right'));
  antStartBtn.addEventListener('click', startRun);
  antNextBtn.addEventListener('click', startRun);

  window.antEnterHook = function(){
    clearTimers(); armed = false; antDot.style.display = 'none';
    antStartPanel.style.display = ''; antResultCard.style.display = 'none';
    clearFeedback();
  };
})();
