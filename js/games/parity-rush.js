(function(){
  const TOTAL_TRIALS = 20;
  const RESPONSE_WINDOW = 1200;
  const ISI_MIN = 500, ISI_MAX = 1000;
  const POST_PAUSE = 350;

  const parNumber = document.getElementById('parNumber');
  const parFeedback = document.getElementById('parFeedback');
  const parStartPanel = document.getElementById('parStartPanel');
  const parStartBtn = document.getElementById('parStartBtn');
  const parResultCard = document.getElementById('parResultCard');
  const parNextBtn = document.getElementById('parNextBtn');
  const parLog = document.getElementById('parLog');
  const parTrialVal = document.getElementById('parTrialVal');
  const parScoreVal = document.getElementById('parScoreVal');
  const parNormalBtn = document.getElementById('parNormalBtn');
  const parHardBtn = document.getElementById('parHardBtn');
  const zoneEls = {};
  document.querySelectorAll('.par-zone').forEach(el => { zoneEls[el.getAttribute('data-parity')] = el; });

  let trialIndex, score, results, runHistory = [];
  let armed = false, appearTime = null, currentTrial = null, timers = {};
  let mode = 'normal';
  let switchPoints = [];

  function setMode(m){
    mode = m;
    parNormalBtn.classList.toggle('selected', m === 'normal');
    parHardBtn.classList.toggle('selected', m === 'hard');
  }

  function flipLabels(){
    const zones = Array.from(document.querySelectorAll('.par-zone'));
    const a = zones[0], b = zones[1];
    const aParity = a.getAttribute('data-parity'), bParity = b.getAttribute('data-parity');
    a.setAttribute('data-parity', bParity); a.textContent = bParity.toUpperCase();
    b.setAttribute('data-parity', aParity); b.textContent = aParity.toUpperCase();
  }

  function fmtMs(ms){ if (ms === null || ms === undefined) return '—'; return ms.toFixed(0) + ' ms'; }
  function clearTimers(){ clearTimeout(timers.isi); clearTimeout(timers.response); clearTimeout(timers.advance); }
  function clearFeedback(){ parFeedback.textContent = ''; parFeedback.className = 'game-feedback'; }
  function showFeedback(msg, kind){ parFeedback.textContent = msg; parFeedback.className = 'game-feedback ' + kind; }
  function updateHud(){ parTrialVal.textContent = trialIndex + ' / ' + TOTAL_TRIALS; parScoreVal.textContent = score; }

  function startRun(){
    trialIndex = 0; score = 0; results = []; armed = false; clearTimers();
    if (zoneEls.even.getAttribute('data-parity') !== 'even') flipLabels();
    switchPoints = mode === 'hard' ? [Math.floor(TOTAL_TRIALS / 3) + 1, Math.floor(TOTAL_TRIALS * 2 / 3) + 1] : [];
    parStartPanel.style.display = 'none'; parResultCard.style.display = 'none';
    clearFeedback(); parNumber.style.display = 'none';
    updateHud();
    nextTrial();
  }

  function nextTrial(){
    if (trialIndex >= TOTAL_TRIALS){ finishRun(); return; }
    trialIndex++;
    updateHud(); clearFeedback();
    parNumber.style.display = 'none';
    if (switchPoints.includes(trialIndex)){
      flipLabels();
      showFeedback('LABELS FLIPPED', 'neutral');
    }
    const n = 1 + Math.floor(Math.random() * 98);
    const parity = (n % 2 === 0) ? 'even' : 'odd';
    currentTrial = { trial: trialIndex, n, parity, rt: null, outcome: null };
    const isi = ISI_MIN + Math.random() * (ISI_MAX - ISI_MIN);
    timers.isi = setTimeout(() => showNumber(n), isi);
  }

  function showNumber(n){
    parNumber.textContent = n;
    parNumber.style.display = 'block';
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        appearTime = performance.now();
        armed = true;
        timers.response = setTimeout(handleTimeout, RESPONSE_WINDOW);
      });
    });
  }

  function handleZoneClick(parity){
    if (!armed) return;
    const rt = window.KA_applyGrace(performance.now() - appearTime);
    armed = false; clearTimeout(timers.response);
    parNumber.style.display = 'none';
    if (parity === currentTrial.parity){
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
    armed = false; parNumber.style.display = 'none';
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
    clearFeedback(); parNumber.style.display = 'none';
    const correct = results.filter(r => r.outcome === 'correct');
    const wrong = results.filter(r => r.outcome === 'incorrect');
    const timeouts = results.filter(r => r.outcome === 'timeout');
    const avgRt = avg(correct.map(r => r.rt));
    const accuracy = results.length ? (correct.length / results.length) * 100 : null;

    document.getElementById('parRCorrect').textContent = correct.length + ' / ' + results.length;
    document.getElementById('parRAvgRt').textContent = fmtMs(avgRt);
    document.getElementById('parRWrong').textContent = wrong.length;
    document.getElementById('parRTimeout').textContent = timeouts.length;
    document.getElementById('parRAcc').textContent = accuracy === null ? '—' : accuracy.toFixed(0) + '%';

    const bestCorrect = window.KA_records.get('par_best_correct', null);
    const isNewBest = bestCorrect === null || correct.length > bestCorrect;
    if (isNewBest) window.KA_records.set('par_best_correct', correct.length);
    window.KA_weekly.record('par', correct.length);
    document.getElementById('parRBest').textContent = (isNewBest ? correct.length : bestCorrect) + ' / ' + results.length;
    document.getElementById('parRBestRow').classList.toggle('is-new', isNewBest);

    window.KA_scoreRun('par', 'parResultCard', { accuracyPct: accuracy, avgRt, mode });
    parResultCard.style.display = 'flex';
    runHistory.unshift({ correct: correct.length, wrong: wrong.length, timeouts: timeouts.length, avgRt, accuracy });
    if (runHistory.length > 6) runHistory.pop();
    renderLog();
    window.KA_history.add('Parity Rush', `correct ${correct.length}/${results.length} · acc ${accuracy === null ? '—' : accuracy.toFixed(0) + '%'}`);
  }

  function renderLog(){
    parLog.innerHTML = runHistory.map((h, i) =>
      `<span class="entry">Run ${runHistory.length - i} — correct <b>${h.correct}</b> &middot; wrong <b>${h.wrong}</b> &middot; timeout <b>${h.timeouts}</b> &middot; avg RT <b>${fmtMs(h.avgRt)}</b></span>`
    ).join('<span style="color:var(--grid)">|</span>');
  }

  Object.keys(zoneEls).forEach(parity => zoneEls[parity].addEventListener('pointerdown', () => handleZoneClick(zoneEls[parity].getAttribute('data-parity'))));
  parStartBtn.addEventListener('click', startRun);
  parNextBtn.addEventListener('click', startRun);
  parNormalBtn.addEventListener('click', () => setMode('normal'));
  parHardBtn.addEventListener('click', () => setMode('hard'));

  window.parEnterHook = function(){
    clearTimers(); armed = false; parNumber.style.display = 'none';
    parStartPanel.style.display = ''; parResultCard.style.display = 'none';
    clearFeedback();
  };
})();
