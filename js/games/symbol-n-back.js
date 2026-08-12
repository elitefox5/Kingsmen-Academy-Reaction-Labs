(function(){
  const SYMBOLS = ['●', '▲', '■', '★', '♦'];
  const TOTAL_TRIALS = 20;
  const DISPLAY_TIME = 900; // ms the symbol + click window stays open
  const ISI_MIN = 400, ISI_MAX = 900;
  const POST_PAUSE = 300;
  const MATCH_PROB = 0.35;

  const nbkSymbol = document.getElementById('nbkSymbol');
  const nbkMatchBtn = document.getElementById('nbkMatchBtn');
  const nbkFeedback = document.getElementById('nbkFeedback');
  const nbkStartPanel = document.getElementById('nbkStartPanel');
  const nbkStartBtn = document.getElementById('nbkStartBtn');
  const nbkResultCard = document.getElementById('nbkResultCard');
  const nbkNextBtn = document.getElementById('nbkNextBtn');
  const nbkLog = document.getElementById('nbkLog');
  const nbkTrialVal = document.getElementById('nbkTrialVal');
  const nbkScoreVal = document.getElementById('nbkScoreVal');
  const nbkEasyBtn = document.getElementById('nbkEasyBtn');
  const nbkHardBtn = document.getElementById('nbkHardBtn');

  let trialIndex, score, results, runHistory = [];
  let armed = false, waiting = false, appearTime = null, currentTrial = null, timers = {};
  let symbolHistory = [];
  let mode = 'easy';
  let backDist = 1;

  function setMode(m){
    mode = m;
    backDist = m === 'hard' ? 2 : 1;
    nbkEasyBtn.classList.toggle('selected', m === 'easy');
    nbkHardBtn.classList.toggle('selected', m === 'hard');
  }

  function fmtMs(ms){ if (ms === null || ms === undefined) return '—'; return ms.toFixed(0) + ' ms'; }
  function clearTimers(){ clearTimeout(timers.isi); clearTimeout(timers.response); clearTimeout(timers.advance); }
  function clearFeedback(){ nbkFeedback.textContent = ''; nbkFeedback.className = 'game-feedback'; }
  function showFeedback(msg, kind){ nbkFeedback.textContent = msg; nbkFeedback.className = 'game-feedback ' + kind; }
  function updateHud(){ nbkTrialVal.textContent = trialIndex + ' / ' + TOTAL_TRIALS; nbkScoreVal.textContent = score; }

  function startRun(){
    trialIndex = 0; score = 0; results = []; armed = false; waiting = false; symbolHistory = []; clearTimers();
    nbkStartPanel.style.display = 'none'; nbkResultCard.style.display = 'none';
    clearFeedback(); nbkSymbol.style.display = 'none';
    updateHud();
    nextTrial();
  }

  function nextTrial(){
    if (trialIndex >= TOTAL_TRIALS){ finishRun(); return; }
    trialIndex++;
    updateHud(); clearFeedback();
    nbkSymbol.style.display = 'none';

    const target = symbolHistory.length >= backDist ? symbolHistory[symbolHistory.length - backDist] : null;
    const lastSymbol = symbolHistory.length ? symbolHistory[symbolHistory.length - 1] : null;
    let symbol;
    const isMatch = target !== null && Math.random() < MATCH_PROB;
    if (isMatch){
      symbol = target;
    } else {
      do { symbol = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)]; } while (symbol === lastSymbol);
    }
    currentTrial = { trial: trialIndex, symbol, isMatch, rt: null, outcome: null };
    waiting = true;

    const isi = ISI_MIN + Math.random() * (ISI_MAX - ISI_MIN);
    timers.isi = setTimeout(() => showSymbol(symbol), isi);
  }

  // Clicking Match before the symbol appears used to be a silent no-op — spamming the
  // button through the whole wait would land a click the instant the trial armed, banking
  // a near-zero "reaction time" on lucky match trials with no accuracy cost. An early click
  // now fails the trial outright instead, same as Split Focus.
  function handleEarlyClick(){
    clearTimeout(timers.isi);
    waiting = false;
    nbkSymbol.style.display = 'none';
    currentTrial.outcome = 'early';
    showFeedback('TOO EARLY', 'bad');
    settleTrial();
  }

  function showSymbol(symbol){
    waiting = false;
    nbkSymbol.textContent = symbol;
    nbkSymbol.style.display = 'block';
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        appearTime = performance.now();
        armed = true;
        timers.response = setTimeout(handleTimeout, DISPLAY_TIME);
      });
    });
  }

  function handleMatchClick(){
    if (waiting){ handleEarlyClick(); return; }
    if (!armed) return;
    const rt = window.KA_applyGrace(performance.now() - appearTime);
    armed = false; clearTimeout(timers.response);
    nbkSymbol.style.display = 'none';
    if (currentTrial.isMatch){
      currentTrial.rt = rt; currentTrial.outcome = 'hit'; score++;
      showFeedback('MATCH — ' + fmtMs(rt), 'good');
    } else {
      currentTrial.outcome = 'falseAlarm';
      showFeedback('FALSE ALARM', 'bad');
    }
    settleTrial();
  }

  function handleTimeout(){
    if (!armed) return;
    armed = false; nbkSymbol.style.display = 'none';
    if (currentTrial.isMatch){
      currentTrial.outcome = 'miss';
      showFeedback('MISSED MATCH', 'bad');
    } else {
      currentTrial.outcome = 'correctReject';
    }
    settleTrial();
  }

  function settleTrial(){
    symbolHistory.push(currentTrial.symbol);
    results.push(currentTrial);
    updateHud();
    timers.advance = setTimeout(nextTrial, POST_PAUSE);
  }

  function avg(arr){ if (!arr.length) return null; return arr.reduce((a,b) => a+b, 0) / arr.length; }

  function finishRun(){
    clearFeedback(); nbkSymbol.style.display = 'none';
    const hits = results.filter(r => r.outcome === 'hit');
    const misses = results.filter(r => r.outcome === 'miss');
    const falseAlarms = results.filter(r => r.outcome === 'falseAlarm' || r.outcome === 'early');
    const correctRejects = results.filter(r => r.outcome === 'correctReject');
    const avgRt = avg(hits.map(r => r.rt));
    const accuracy = results.length ? ((hits.length + correctRejects.length) / results.length) * 100 : null;

    document.getElementById('nbkRHits').textContent = hits.length + ' / ' + (hits.length + misses.length);
    document.getElementById('nbkRAvgRt').textContent = fmtMs(avgRt);
    document.getElementById('nbkRMisses').textContent = misses.length;
    document.getElementById('nbkRFalse').textContent = falseAlarms.length;
    document.getElementById('nbkRAcc').textContent = accuracy === null ? '—' : accuracy.toFixed(0) + '%';

    const overallCorrect = hits.length + correctRejects.length;
    const bestCorrect = window.KA_records.get('nbk_best_correct', null);
    const isNewBest = bestCorrect === null || overallCorrect > bestCorrect;
    if (isNewBest) window.KA_records.set('nbk_best_correct', overallCorrect);
    window.KA_weekly.record('nbk', overallCorrect);
    document.getElementById('nbkRBest').textContent = (isNewBest ? overallCorrect : bestCorrect) + ' / ' + results.length;
    document.getElementById('nbkRBestRow').classList.toggle('is-new', isNewBest);

    window.KA_scoreRun('nbk', 'nbkResultCard', { accuracyPct: accuracy, avgRt, mode });
    nbkResultCard.style.display = 'flex';
    runHistory.unshift({ hits: hits.length, misses: misses.length, falseAlarms: falseAlarms.length, avgRt, accuracy });
    if (runHistory.length > 6) runHistory.pop();
    renderLog();
    window.KA_history.add('Symbol 1-Back', `hits ${hits.length} · misses ${misses.length} · false alarms ${falseAlarms.length} · acc ${accuracy === null ? '—' : accuracy.toFixed(0) + '%'}`);
  }

  function renderLog(){
    nbkLog.innerHTML = runHistory.map((h, i) =>
      `<span class="entry">Run ${runHistory.length - i} — hits <b>${h.hits}</b> &middot; misses <b>${h.misses}</b> &middot; false alarms <b>${h.falseAlarms}</b> &middot; avg RT <b>${fmtMs(h.avgRt)}</b></span>`
    ).join('<span style="color:var(--grid)">|</span>');
  }

  nbkMatchBtn.addEventListener('pointerdown', handleMatchClick);
  nbkStartBtn.addEventListener('click', startRun);
  nbkNextBtn.addEventListener('click', startRun);
  nbkEasyBtn.addEventListener('click', () => setMode('easy'));
  nbkHardBtn.addEventListener('click', () => setMode('hard'));

  window.nbkEnterHook = function(){
    clearTimers(); armed = false; waiting = false; nbkSymbol.style.display = 'none';
    nbkStartPanel.style.display = ''; nbkResultCard.style.display = 'none';
    clearFeedback();
  };
})();
