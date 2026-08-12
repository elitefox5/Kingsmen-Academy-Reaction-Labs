(function(){
  const TOTAL_TRIALS = 20;
  const RESPONSE_WINDOW = 1300;
  const ISI_MIN = 500, ISI_MAX = 1000;
  const POST_PAUSE = 350;

  const cntDots = document.getElementById('cntDots');
  const cntFeedback = document.getElementById('cntFeedback');
  const cntStartPanel = document.getElementById('cntStartPanel');
  const cntStartBtn = document.getElementById('cntStartBtn');
  const cntResultCard = document.getElementById('cntResultCard');
  const cntNextBtn = document.getElementById('cntNextBtn');
  const cntLog = document.getElementById('cntLog');
  const cntTrialVal = document.getElementById('cntTrialVal');
  const cntScoreVal = document.getElementById('cntScoreVal');
  const zoneEls = {};
  document.querySelectorAll('.cnt-zone').forEach(el => { zoneEls[el.getAttribute('data-count')] = el; });

  let trialIndex, score, results, runHistory = [];
  let armed = false, waiting = false, appearTime = null, currentTrial = null, timers = {};

  function fmtMs(ms){ if (ms === null || ms === undefined) return '—'; return ms.toFixed(0) + ' ms'; }
  function clearTimers(){ clearTimeout(timers.isi); clearTimeout(timers.response); clearTimeout(timers.advance); }
  function clearFeedback(){ cntFeedback.textContent = ''; cntFeedback.className = 'game-feedback'; }
  function showFeedback(msg, kind){ cntFeedback.textContent = msg; cntFeedback.className = 'game-feedback ' + kind; }
  function updateHud(){ cntTrialVal.textContent = trialIndex + ' / ' + TOTAL_TRIALS; cntScoreVal.textContent = score; }

  function buildDots(n){
    cntDots.innerHTML = '';
    const w = 220, h = 170;
    const placed = [];
    for (let i = 0; i < n; i++){
      let x, y, tries = 0;
      do {
        x = 20 + Math.random() * (w - 40);
        y = 20 + Math.random() * (h - 40);
        tries++;
      } while (placed.some(p => Math.hypot(p.x - x, p.y - y) < 40) && tries < 30);
      placed.push({ x, y });
      const dot = document.createElement('div');
      dot.className = 'cnt-dot';
      dot.style.left = x + 'px';
      dot.style.top = y + 'px';
      cntDots.appendChild(dot);
    }
  }

  function startRun(){
    trialIndex = 0; score = 0; results = []; armed = false; waiting = false; clearTimers();
    cntStartPanel.style.display = 'none'; cntResultCard.style.display = 'none';
    clearFeedback(); cntDots.style.display = 'none';
    updateHud();
    nextTrial();
  }

  function nextTrial(){
    if (trialIndex >= TOTAL_TRIALS){ finishRun(); return; }
    trialIndex++;
    updateHud(); clearFeedback();
    cntDots.style.display = 'none';
    const n = 1 + Math.floor(Math.random() * 5);
    currentTrial = { trial: trialIndex, n, rt: null, outcome: null };
    waiting = true;
    const isi = ISI_MIN + Math.random() * (ISI_MAX - ISI_MIN);
    timers.isi = setTimeout(() => showDots(n), isi);
  }

  // Clicking before the dots appear used to be a silent no-op — spamming a zone through
  // the whole wait would land a click the instant the trial armed, banking a near-zero
  // "reaction time" on lucky trials with no accuracy cost. An early click now fails the
  // trial outright instead, same as Split Focus.
  function handleEarlyClick(){
    clearTimeout(timers.isi);
    waiting = false;
    cntDots.style.display = 'none';
    currentTrial.outcome = 'early';
    showFeedback('TOO EARLY', 'bad');
    settleTrial();
  }

  function showDots(n){
    waiting = false;
    buildDots(n);
    cntDots.style.display = 'block';
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        appearTime = performance.now();
        armed = true;
        timers.response = setTimeout(handleTimeout, RESPONSE_WINDOW);
      });
    });
  }

  function handleZoneClick(count){
    if (waiting){ handleEarlyClick(); return; }
    if (!armed) return;
    const rt = window.KA_applyGrace(performance.now() - appearTime);
    armed = false; clearTimeout(timers.response);
    cntDots.style.display = 'none';
    if (count === currentTrial.n){
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
    armed = false; cntDots.style.display = 'none';
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
    clearFeedback(); cntDots.style.display = 'none';
    const correct = results.filter(r => r.outcome === 'correct');
    const wrong = results.filter(r => r.outcome === 'incorrect' || r.outcome === 'early');
    const timeouts = results.filter(r => r.outcome === 'timeout');
    const avgRt = avg(correct.map(r => r.rt));
    const accuracy = results.length ? (correct.length / results.length) * 100 : null;

    document.getElementById('cntRCorrect').textContent = correct.length + ' / ' + results.length;
    document.getElementById('cntRAvgRt').textContent = fmtMs(avgRt);
    document.getElementById('cntRWrong').textContent = wrong.length;
    document.getElementById('cntRTimeout').textContent = timeouts.length;
    document.getElementById('cntRAcc').textContent = accuracy === null ? '—' : accuracy.toFixed(0) + '%';

    const bestCorrect = window.KA_records.get('cnt_best_correct', null);
    const isNewBest = bestCorrect === null || correct.length > bestCorrect;
    if (isNewBest) window.KA_records.set('cnt_best_correct', correct.length);
    window.KA_weekly.record('cnt', correct.length);
    document.getElementById('cntRBest').textContent = (isNewBest ? correct.length : bestCorrect) + ' / ' + results.length;
    document.getElementById('cntRBestRow').classList.toggle('is-new', isNewBest);

    window.KA_scoreRun('cnt', 'cntResultCard', { accuracyPct: accuracy, avgRt });
    cntResultCard.style.display = 'flex';
    runHistory.unshift({ correct: correct.length, wrong: wrong.length, timeouts: timeouts.length, avgRt, accuracy });
    if (runHistory.length > 6) runHistory.pop();
    renderLog();
    window.KA_history.add('Count Rush', `correct ${correct.length}/${results.length} · acc ${accuracy === null ? '—' : accuracy.toFixed(0) + '%'}`);
  }

  function renderLog(){
    cntLog.innerHTML = runHistory.map((h, i) =>
      `<span class="entry">Run ${runHistory.length - i} — correct <b>${h.correct}</b> &middot; wrong <b>${h.wrong}</b> &middot; timeout <b>${h.timeouts}</b> &middot; avg RT <b>${fmtMs(h.avgRt)}</b></span>`
    ).join('<span style="color:var(--grid)">|</span>');
  }

  Object.keys(zoneEls).forEach(count => zoneEls[count].addEventListener('pointerdown', () => handleZoneClick(Number(count))));
  cntStartBtn.addEventListener('click', startRun);
  cntNextBtn.addEventListener('click', startRun);

  window.cntEnterHook = function(){
    clearTimers(); armed = false; waiting = false; cntDots.style.display = 'none';
    cntStartPanel.style.display = ''; cntResultCard.style.display = 'none';
    clearFeedback();
  };
})();
