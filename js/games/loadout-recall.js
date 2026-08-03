(function(){
  const TOTAL_TRIALS = 12;
  const SEQ_LEN = 4;
  const GRID_SIZE = 9;
  const SHOW_TIME = 600, GAP_TIME = 250;
  const ISI_MIN = 500, ISI_MAX = 900;
  const RESPONSE_WINDOW = 6000;
  const POST_PAUSE = 500;
  const POOL = ['◆', '▲', '●', '■', '✕', '◐', '⬟', '⬣', '✚', '◈', '▣', '☖'];

  const ldrIcon = document.getElementById('ldrIcon');
  const ldrGrid = document.getElementById('ldrGrid');
  const ldrFeedback = document.getElementById('ldrFeedback');
  const ldrStartPanel = document.getElementById('ldrStartPanel');
  const ldrStartBtn = document.getElementById('ldrStartBtn');
  const ldrResultCard = document.getElementById('ldrResultCard');
  const ldrNextBtn = document.getElementById('ldrNextBtn');
  const ldrLog = document.getElementById('ldrLog');
  const ldrTrialVal = document.getElementById('ldrTrialVal');
  const ldrScoreVal = document.getElementById('ldrScoreVal');

  let trialIndex, score, results, runHistory = [];
  let armed = false, appearTime = null, currentTrial = null, timers = {};
  let pickedCount = 0;

  function fmtMs(ms){ if (ms === null || ms === undefined) return '—'; return ms.toFixed(0) + ' ms'; }
  function clearTimers(){ Object.keys(timers).forEach(k => clearTimeout(timers[k])); timers = {}; }
  function clearFeedback(){ ldrFeedback.textContent = ''; ldrFeedback.className = 'game-feedback'; }
  function showFeedback(msg, kind){ ldrFeedback.textContent = msg; ldrFeedback.className = 'game-feedback ' + kind; }
  function updateHud(){ ldrTrialVal.textContent = trialIndex + ' / ' + TOTAL_TRIALS; ldrScoreVal.textContent = score; }

  function shuffled(arr){ return [...arr].sort(() => Math.random() - 0.5); }

  function startRun(){
    trialIndex = 0; score = 0; results = []; armed = false; clearTimers();
    ldrStartPanel.style.display = 'none'; ldrResultCard.style.display = 'none';
    clearFeedback(); ldrIcon.style.display = 'none'; ldrGrid.style.display = 'none';
    updateHud();
    nextTrial();
  }

  function nextTrial(){
    if (trialIndex >= TOTAL_TRIALS){ finishRun(); return; }
    trialIndex++;
    updateHud(); clearFeedback();
    ldrIcon.style.display = 'none'; ldrGrid.style.display = 'none'; ldrGrid.innerHTML = '';
    pickedCount = 0;
    const pool = shuffled(POOL);
    const targets = pool.slice(0, SEQ_LEN);
    const decoys = pool.slice(SEQ_LEN, GRID_SIZE);
    currentTrial = { trial: trialIndex, targets, rt: null, outcome: null };
    const isi = ISI_MIN + Math.random() * (ISI_MAX - ISI_MIN);
    timers.start = setTimeout(() => playSequence(targets, decoys), isi);
  }

  function playSequence(targets, decoys){
    let i = 0;
    function step(){
      if (i >= targets.length){ showGrid(targets, decoys); return; }
      ldrIcon.textContent = targets[i];
      ldrIcon.style.display = 'block';
      timers.show = setTimeout(() => {
        ldrIcon.style.display = 'none';
        i++;
        timers.gap = setTimeout(step, GAP_TIME);
      }, SHOW_TIME);
    }
    step();
  }

  function showGrid(targets, decoys){
    const cells = shuffled([
      ...targets.map(s => ({ s, isTarget: true })),
      ...decoys.map(s => ({ s, isTarget: false }))
    ]);
    ldrGrid.innerHTML = '';
    cells.forEach(c => {
      const cell = document.createElement('div');
      cell.className = 'ldr-cell';
      cell.textContent = c.s;
      cell.dataset.target = c.isTarget ? '1' : '0';
      ldrGrid.appendChild(cell);
    });
    ldrGrid.style.display = 'grid';
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
    const cell = e.target.closest('.ldr-cell');
    if (!cell || cell.classList.contains('picked')) return;
    if (cell.dataset.target === '1'){
      cell.classList.add('picked');
      pickedCount++;
      if (pickedCount >= SEQ_LEN){
        const rt = window.KA_applyGrace(performance.now() - appearTime);
        armed = false; clearTimeout(timers.response);
        currentTrial.rt = rt; currentTrial.outcome = 'correct'; score++;
        showFeedback('CORRECT — ' + fmtMs(rt), 'good');
        settleTrial();
      }
    } else {
      armed = false; clearTimeout(timers.response);
      currentTrial.outcome = 'incorrect';
      showFeedback('WRONG ITEM', 'bad');
      settleTrial();
    }
  }

  function handleTimeout(){
    if (!armed) return;
    armed = false; ldrGrid.style.display = 'none';
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
    clearFeedback(); ldrIcon.style.display = 'none'; ldrGrid.style.display = 'none';
    const correct = results.filter(r => r.outcome === 'correct');
    const avgRt = avg(correct.map(r => r.rt));
    const accuracy = results.length ? (correct.length / results.length) * 100 : null;

    document.getElementById('ldrRCorrect').textContent = correct.length + ' / ' + results.length;
    document.getElementById('ldrRAvgRt').textContent = fmtMs(avgRt);
    document.getElementById('ldrRAcc').textContent = accuracy === null ? '—' : accuracy.toFixed(0) + '%';

    const bestCorrect = window.KA_records.get('ldr_best_correct', null);
    const isNewBest = bestCorrect === null || correct.length > bestCorrect;
    if (isNewBest) window.KA_records.set('ldr_best_correct', correct.length);
    window.KA_weekly.record('ldr', correct.length);
    document.getElementById('ldrRBest').textContent = (isNewBest ? correct.length : bestCorrect) + ' / ' + results.length;
    document.getElementById('ldrRBestRow').classList.toggle('is-new', isNewBest);

    window.KA_scoreRun('ldr', 'ldrResultCard', { accuracyPct: accuracy, avgRt });
    ldrResultCard.style.display = 'flex';
    runHistory.unshift({ correct: correct.length, accuracy });
    if (runHistory.length > 6) runHistory.pop();
    renderLog();
    window.KA_history.add('Loadout Recall', `correct ${correct.length}/${results.length} · acc ${accuracy === null ? '—' : accuracy.toFixed(0) + '%'}`);
  }

  function renderLog(){
    ldrLog.innerHTML = runHistory.map((h, i) =>
      `<span class="entry">Run ${runHistory.length - i} — correct <b>${h.correct}</b> &middot; acc <b>${h.accuracy === null ? '—' : h.accuracy.toFixed(0) + '%'}</b></span>`
    ).join('<span style="color:var(--grid)">|</span>');
  }

  ldrGrid.addEventListener('pointerdown', handleCellClick);
  ldrStartBtn.addEventListener('click', startRun);
  ldrNextBtn.addEventListener('click', startRun);

  window.ldrEnterHook = function(){
    clearTimers(); armed = false; ldrIcon.style.display = 'none'; ldrGrid.style.display = 'none'; ldrGrid.innerHTML = '';
    ldrStartPanel.style.display = ''; ldrResultCard.style.display = 'none';
    clearFeedback();
  };
})();
