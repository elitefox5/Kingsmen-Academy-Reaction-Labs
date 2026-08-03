(function(){
  const TOTAL_TRIALS = 20;
  const RESPONSE_WINDOW = 1100;
  const ISI_MIN = 600, ISI_MAX = 1400;
  const POST_PAUSE = 350;
  const DECOY_PROB = 0.45;
  const EDGE_MARGIN = 50;
  const CENTER_JITTER = 16; // max px the center target can drift from true center between trials

  const splPlayfield = document.querySelector('#spl .game-playfield');
  const splCenter = document.getElementById('splCenter');
  const splDecoy = document.getElementById('splDecoy');
  const splFeedback = document.getElementById('splFeedback');
  const splStartPanel = document.getElementById('splStartPanel');
  const splStartBtn = document.getElementById('splStartBtn');
  const splResultCard = document.getElementById('splResultCard');
  const splNextBtn = document.getElementById('splNextBtn');
  const splLog = document.getElementById('splLog');
  const splTrialVal = document.getElementById('splTrialVal');
  const splScoreVal = document.getElementById('splScoreVal');

  let trialIndex, score, results, runHistory = [];
  let armed = false, appearTime = null, currentTrial = null, timers = {};

  function fmtMs(ms){ if (ms === null || ms === undefined) return '—'; return ms.toFixed(0) + ' ms'; }
  function clearTimers(){ clearTimeout(timers.isi); clearTimeout(timers.response); clearTimeout(timers.advance); }
  function clearFeedback(){ splFeedback.textContent = ''; splFeedback.className = 'game-feedback'; }
  function showFeedback(msg, kind){ splFeedback.textContent = msg; splFeedback.className = 'game-feedback ' + kind; }
  function updateHud(){ splTrialVal.textContent = trialIndex + ' / ' + TOTAL_TRIALS; splScoreVal.textContent = score; }

  function randomEdgePos(){
    const w = splPlayfield.clientWidth;
    const h = splPlayfield.clientHeight;
    const edge = Math.floor(Math.random() * 4);
    if (edge === 0) return { x: EDGE_MARGIN + Math.random() * (w - EDGE_MARGIN*2), y: EDGE_MARGIN };
    if (edge === 1) return { x: EDGE_MARGIN + Math.random() * (w - EDGE_MARGIN*2), y: h - EDGE_MARGIN };
    if (edge === 2) return { x: EDGE_MARGIN, y: EDGE_MARGIN + Math.random() * (h - EDGE_MARGIN*2) };
    return { x: w - EDGE_MARGIN, y: EDGE_MARGIN + Math.random() * (h - EDGE_MARGIN*2) };
  }

  // Drifts the center target a little each trial — enough that you can't just park your
  // cursor on one fixed pixel and passively wait, without wandering anywhere near the decoys.
  function repositionCenter(){
    const cx = splPlayfield.clientWidth / 2;
    const cy = splPlayfield.clientHeight / 2;
    const angle = Math.random() * Math.PI * 2;
    const dist = Math.random() * CENTER_JITTER;
    splCenter.style.left = (cx + Math.cos(angle) * dist) + 'px';
    splCenter.style.top = (cy + Math.sin(angle) * dist) + 'px';
  }

  function resetCenterPos(){
    splCenter.style.left = '';
    splCenter.style.top = '';
  }

  function startRun(){
    trialIndex = 0; score = 0; results = []; armed = false; clearTimers();
    splStartPanel.style.display = 'none'; splResultCard.style.display = 'none';
    clearFeedback(); splCenter.classList.remove('lit'); splDecoy.style.display = 'none';
    updateHud();
    nextTrial();
  }

  function nextTrial(){
    if (trialIndex >= TOTAL_TRIALS){ finishRun(); return; }
    trialIndex++;
    updateHud(); clearFeedback();
    splCenter.classList.remove('lit'); splDecoy.style.display = 'none';
    repositionCenter();
    const hasDecoy = Math.random() < DECOY_PROB;
    currentTrial = { trial: trialIndex, hasDecoy, rt: null, outcome: null };
    const isi = ISI_MIN + Math.random() * (ISI_MAX - ISI_MIN);
    timers.isi = setTimeout(showTrial, isi);
  }

  function showTrial(){
    splCenter.classList.add('lit');
    if (currentTrial.hasDecoy){
      const pos = randomEdgePos();
      splDecoy.style.left = pos.x + 'px';
      splDecoy.style.top = pos.y + 'px';
      splDecoy.style.display = 'block';
    }
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        appearTime = performance.now();
        armed = true;
        timers.response = setTimeout(handleTimeout, RESPONSE_WINDOW);
      });
    });
  }

  function handleCenterClick(){
    if (!armed) return;
    const rt = window.KA_applyGrace(performance.now() - appearTime);
    armed = false; clearTimeout(timers.response);
    splCenter.classList.remove('lit'); splDecoy.style.display = 'none';
    currentTrial.rt = rt; currentTrial.outcome = 'correct'; score++;
    showFeedback('CORRECT — ' + fmtMs(rt), 'good');
    settleTrial();
  }

  function handleDecoyClick(){
    if (!armed) return;
    armed = false; clearTimeout(timers.response);
    splCenter.classList.remove('lit'); splDecoy.style.display = 'none';
    currentTrial.outcome = 'distracted';
    showFeedback('DISTRACTED', 'bad');
    settleTrial();
  }

  function handleTimeout(){
    if (!armed) return;
    armed = false; splCenter.classList.remove('lit'); splDecoy.style.display = 'none';
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
    clearFeedback(); splCenter.classList.remove('lit'); splDecoy.style.display = 'none';
    const correct = results.filter(r => r.outcome === 'correct');
    const wrong = results.filter(r => r.outcome === 'distracted');
    const timeouts = results.filter(r => r.outcome === 'timeout');
    const avgRt = avg(correct.map(r => r.rt));
    const accuracy = results.length ? (correct.length / results.length) * 100 : null;

    document.getElementById('splRCorrect').textContent = correct.length + ' / ' + results.length;
    document.getElementById('splRAvgRt').textContent = fmtMs(avgRt);
    document.getElementById('splRWrong').textContent = wrong.length;
    document.getElementById('splRTimeout').textContent = timeouts.length;
    document.getElementById('splRAcc').textContent = accuracy === null ? '—' : accuracy.toFixed(0) + '%';

    const bestCorrect = window.KA_records.get('spl_best_correct', null);
    const isNewBest = bestCorrect === null || correct.length > bestCorrect;
    if (isNewBest) window.KA_records.set('spl_best_correct', correct.length);
    window.KA_weekly.record('spl', correct.length);
    document.getElementById('splRBest').textContent = (isNewBest ? correct.length : bestCorrect) + ' / ' + results.length;
    document.getElementById('splRBestRow').classList.toggle('is-new', isNewBest);

    window.KA_scoreRun('spl', 'splResultCard', { accuracyPct: accuracy, avgRt });
    splResultCard.style.display = 'flex';
    runHistory.unshift({ correct: correct.length, wrong: wrong.length, timeouts: timeouts.length, avgRt, accuracy });
    if (runHistory.length > 6) runHistory.pop();
    renderLog();
    window.KA_history.add('Split Focus', `correct ${correct.length}/${results.length} · acc ${accuracy === null ? '—' : accuracy.toFixed(0) + '%'}`);
  }

  function renderLog(){
    splLog.innerHTML = runHistory.map((h, i) =>
      `<span class="entry">Run ${runHistory.length - i} — correct <b>${h.correct}</b> &middot; distracted <b>${h.wrong}</b> &middot; timeout <b>${h.timeouts}</b> &middot; avg RT <b>${fmtMs(h.avgRt)}</b></span>`
    ).join('<span style="color:var(--grid)">|</span>');
  }

  splCenter.addEventListener('pointerdown', handleCenterClick);
  splDecoy.addEventListener('pointerdown', handleDecoyClick);
  splStartBtn.addEventListener('click', startRun);
  splNextBtn.addEventListener('click', startRun);

  window.splEnterHook = function(){
    clearTimers(); armed = false; splCenter.classList.remove('lit'); splDecoy.style.display = 'none';
    resetCenterPos();
    splStartPanel.style.display = ''; splResultCard.style.display = 'none';
    clearFeedback();
  };
})();
