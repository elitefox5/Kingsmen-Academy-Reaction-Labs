(function(){
  const TOTAL_TRIALS = 20;
  const RESPONSE_WINDOW = 2000;
  const ISI_MIN = 500, ISI_MAX = 1000;
  const POST_PAUSE = 350;
  const BASE_HUE = 190; // cyan-ish base; odd cell is a lighter/darker shade of the same hue

  const oddGrid = document.getElementById('oddGrid');
  const oddFeedback = document.getElementById('oddFeedback');
  const oddStartPanel = document.getElementById('oddStartPanel');
  const oddStartBtn = document.getElementById('oddStartBtn');
  const oddResultCard = document.getElementById('oddResultCard');
  const oddNextBtn = document.getElementById('oddNextBtn');
  const oddLog = document.getElementById('oddLog');
  const oddTrialVal = document.getElementById('oddTrialVal');
  const oddScoreVal = document.getElementById('oddScoreVal');

  let trialIndex, score, results, runHistory = [];
  let armed = false, appearTime = null, currentTrial = null, timers = {};

  function fmtMs(ms){ if (ms === null || ms === undefined) return '—'; return ms.toFixed(0) + ' ms'; }
  function clearTimers(){ clearTimeout(timers.isi); clearTimeout(timers.response); clearTimeout(timers.advance); }
  function clearFeedback(){ oddFeedback.textContent = ''; oddFeedback.className = 'game-feedback'; }
  function showFeedback(msg, kind){ oddFeedback.textContent = msg; oddFeedback.className = 'game-feedback ' + kind; }
  function updateHud(){ oddTrialVal.textContent = trialIndex + ' / ' + TOTAL_TRIALS; oddScoreVal.textContent = score; }

  function buildGrid(){
    oddGrid.innerHTML = '';
    const oddIndex = Math.floor(Math.random() * 9);
    const baseLight = 42;
    const oddLight = baseLight + (Math.random() < 0.5 ? 14 : -14);
    for (let i = 0; i < 9; i++){
      const cell = document.createElement('div');
      cell.className = 'odd-cell';
      const light = i === oddIndex ? oddLight : baseLight;
      cell.style.background = `hsl(${BASE_HUE}, 55%, ${light}%)`;
      cell.dataset.odd = (i === oddIndex) ? '1' : '0';
      oddGrid.appendChild(cell);
    }
    return oddIndex;
  }

  function startRun(){
    trialIndex = 0; score = 0; results = []; armed = false; clearTimers();
    oddStartPanel.style.display = 'none'; oddResultCard.style.display = 'none';
    clearFeedback(); oddGrid.style.display = 'none'; oddGrid.innerHTML = '';
    updateHud();
    nextTrial();
  }

  function nextTrial(){
    if (trialIndex >= TOTAL_TRIALS){ finishRun(); return; }
    trialIndex++;
    updateHud(); clearFeedback();
    oddGrid.style.display = 'none';
    currentTrial = { trial: trialIndex, rt: null, outcome: null };
    const isi = ISI_MIN + Math.random() * (ISI_MAX - ISI_MIN);
    timers.isi = setTimeout(showGrid, isi);
  }

  function showGrid(){
    buildGrid();
    oddGrid.style.display = 'grid';
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        appearTime = performance.now();
        armed = true;
        timers.response = setTimeout(handleTimeout, RESPONSE_WINDOW);
      });
    });
  }

  function handleCellClick(e){
    if (!armed) return;
    const cell = e.target.closest('.odd-cell');
    if (!cell) return;
    const rt = window.KA_applyGrace(performance.now() - appearTime);
    armed = false; clearTimeout(timers.response);
    oddGrid.style.display = 'none';
    if (cell.dataset.odd === '1'){
      currentTrial.rt = rt; currentTrial.outcome = 'correct'; score++;
      showFeedback('CORRECT — ' + fmtMs(rt), 'good');
    } else {
      currentTrial.outcome = 'incorrect';
      showFeedback('WRONG CELL', 'bad');
    }
    settleTrial();
  }

  function handleTimeout(){
    if (!armed) return;
    armed = false; oddGrid.style.display = 'none';
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
    clearFeedback(); oddGrid.style.display = 'none';
    const correct = results.filter(r => r.outcome === 'correct');
    const wrong = results.filter(r => r.outcome === 'incorrect');
    const timeouts = results.filter(r => r.outcome === 'timeout');
    const avgRt = avg(correct.map(r => r.rt));
    const accuracy = results.length ? (correct.length / results.length) * 100 : null;

    document.getElementById('oddRCorrect').textContent = correct.length + ' / ' + results.length;
    document.getElementById('oddRAvgRt').textContent = fmtMs(avgRt);
    document.getElementById('oddRWrong').textContent = wrong.length;
    document.getElementById('oddRTimeout').textContent = timeouts.length;
    document.getElementById('oddRAcc').textContent = accuracy === null ? '—' : accuracy.toFixed(0) + '%';

    const bestCorrect = window.KA_records.get('odd_best_correct', null);
    const isNewBest = bestCorrect === null || correct.length > bestCorrect;
    if (isNewBest) window.KA_records.set('odd_best_correct', correct.length);
    window.KA_weekly.record('odd', correct.length);
    document.getElementById('oddRBest').textContent = (isNewBest ? correct.length : bestCorrect) + ' / ' + results.length;
    document.getElementById('oddRBestRow').classList.toggle('is-new', isNewBest);

    window.KA_scoreRun('odd', 'oddResultCard', { accuracyPct: accuracy, avgRt });
    oddResultCard.style.display = 'flex';
    runHistory.unshift({ correct: correct.length, wrong: wrong.length, timeouts: timeouts.length, avgRt, accuracy });
    if (runHistory.length > 6) runHistory.pop();
    renderLog();
    window.KA_history.add('Odd One Out', `correct ${correct.length}/${results.length} · acc ${accuracy === null ? '—' : accuracy.toFixed(0) + '%'}`);
  }

  function renderLog(){
    oddLog.innerHTML = runHistory.map((h, i) =>
      `<span class="entry">Run ${runHistory.length - i} — correct <b>${h.correct}</b> &middot; wrong <b>${h.wrong}</b> &middot; timeout <b>${h.timeouts}</b> &middot; avg RT <b>${fmtMs(h.avgRt)}</b></span>`
    ).join('<span style="color:var(--grid)">|</span>');
  }

  oddGrid.addEventListener('pointerdown', handleCellClick);
  oddStartBtn.addEventListener('click', startRun);
  oddNextBtn.addEventListener('click', startRun);

  window.oddEnterHook = function(){
    clearTimers(); armed = false; oddGrid.style.display = 'none'; oddGrid.innerHTML = '';
    oddStartPanel.style.display = ''; oddResultCard.style.display = 'none';
    clearFeedback();
  };
})();
