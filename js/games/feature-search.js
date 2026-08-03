(function(){
  const TOTAL_TRIALS = 20;
  const RESPONSE_WINDOW = 2200;
  const ISI_MIN = 500, ISI_MAX = 1000;
  const POST_PAUSE = 350;
  const CELLS = 12;
  const COLORS = ['cyan', 'amber'];
  const SHAPES = ['circle', 'square'];

  const fsrGrid = document.getElementById('fsrGrid');
  const fsrFeedback = document.getElementById('fsrFeedback');
  const fsrTargetLabel = document.getElementById('fsrTargetLabel');
  const fsrStartPanel = document.getElementById('fsrStartPanel');
  const fsrStartBtn = document.getElementById('fsrStartBtn');
  const fsrResultCard = document.getElementById('fsrResultCard');
  const fsrNextBtn = document.getElementById('fsrNextBtn');
  const fsrLog = document.getElementById('fsrLog');
  const fsrTrialVal = document.getElementById('fsrTrialVal');
  const fsrScoreVal = document.getElementById('fsrScoreVal');

  let trialIndex, score, results, runHistory = [];
  let armed = false, appearTime = null, currentTrial = null, timers = {};
  let target = { color: 'cyan', shape: 'circle' };

  function otherColor(c){ return c === 'cyan' ? 'amber' : 'cyan'; }
  function otherShape(s){ return s === 'circle' ? 'square' : 'circle'; }

  function chooseTarget(){
    target = {
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      shape: SHAPES[Math.floor(Math.random() * SHAPES.length)]
    };
    fsrTargetLabel.innerHTML = `Find the <b>${target.color.toUpperCase()} ${target.shape.toUpperCase()}</b> — ignore anything that only matches one feature.`;
  }

  function fmtMs(ms){ if (ms === null || ms === undefined) return '—'; return ms.toFixed(0) + ' ms'; }
  function clearTimers(){ clearTimeout(timers.isi); clearTimeout(timers.response); clearTimeout(timers.advance); }
  function clearFeedback(){ fsrFeedback.textContent = ''; fsrFeedback.className = 'game-feedback'; }
  function showFeedback(msg, kind){ fsrFeedback.textContent = msg; fsrFeedback.className = 'game-feedback ' + kind; }
  function updateHud(){ fsrTrialVal.textContent = trialIndex + ' / ' + TOTAL_TRIALS; fsrScoreVal.textContent = score; }

  function buildGrid(){
    fsrGrid.innerHTML = '';
    const targetIndex = Math.floor(Math.random() * CELLS);
    for (let i = 0; i < CELLS; i++){
      let color, shape;
      if (i === targetIndex){
        color = target.color; shape = target.shape;
      } else if (Math.random() < 0.5){
        color = target.color; shape = otherShape(target.shape);
      } else {
        color = otherColor(target.color); shape = target.shape;
      }
      const cell = document.createElement('div');
      cell.className = `fsr-cell color-${color} shape-${shape}`;
      cell.dataset.target = (i === targetIndex) ? '1' : '0';
      fsrGrid.appendChild(cell);
    }
  }

  function startRun(){
    trialIndex = 0; score = 0; results = []; armed = false; clearTimers();
    fsrStartPanel.style.display = 'none'; fsrResultCard.style.display = 'none';
    clearFeedback(); fsrGrid.style.display = 'none'; fsrGrid.innerHTML = '';
    updateHud();
    nextTrial();
  }

  function nextTrial(){
    if (trialIndex >= TOTAL_TRIALS){ finishRun(); return; }
    trialIndex++;
    updateHud(); clearFeedback();
    fsrGrid.style.display = 'none';
    currentTrial = { trial: trialIndex, rt: null, outcome: null };
    const isi = ISI_MIN + Math.random() * (ISI_MAX - ISI_MIN);
    timers.isi = setTimeout(showGrid, isi);
  }

  function showGrid(){
    buildGrid();
    fsrGrid.style.display = 'grid';
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
    const cell = e.target.closest('.fsr-cell');
    if (!cell) return;
    const rt = window.KA_applyGrace(performance.now() - appearTime);
    armed = false; clearTimeout(timers.response);
    fsrGrid.style.display = 'none';
    if (cell.dataset.target === '1'){
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
    armed = false; fsrGrid.style.display = 'none';
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
    clearFeedback(); fsrGrid.style.display = 'none';
    const correct = results.filter(r => r.outcome === 'correct');
    const wrong = results.filter(r => r.outcome === 'incorrect');
    const timeouts = results.filter(r => r.outcome === 'timeout');
    const avgRt = avg(correct.map(r => r.rt));
    const accuracy = results.length ? (correct.length / results.length) * 100 : null;

    document.getElementById('fsrRCorrect').textContent = correct.length + ' / ' + results.length;
    document.getElementById('fsrRAvgRt').textContent = fmtMs(avgRt);
    document.getElementById('fsrRWrong').textContent = wrong.length;
    document.getElementById('fsrRTimeout').textContent = timeouts.length;
    document.getElementById('fsrRAcc').textContent = accuracy === null ? '—' : accuracy.toFixed(0) + '%';

    const bestCorrect = window.KA_records.get('fsr_best_correct', null);
    const isNewBest = bestCorrect === null || correct.length > bestCorrect;
    if (isNewBest) window.KA_records.set('fsr_best_correct', correct.length);
    window.KA_weekly.record('fsr', correct.length);
    document.getElementById('fsrRBest').textContent = (isNewBest ? correct.length : bestCorrect) + ' / ' + results.length;
    document.getElementById('fsrRBestRow').classList.toggle('is-new', isNewBest);

    window.KA_scoreRun('fsr', 'fsrResultCard', { accuracyPct: accuracy, avgRt });
    fsrResultCard.style.display = 'flex';
    runHistory.unshift({ correct: correct.length, wrong: wrong.length, timeouts: timeouts.length, avgRt, accuracy });
    if (runHistory.length > 6) runHistory.pop();
    renderLog();
    window.KA_history.add('Feature Search', `correct ${correct.length}/${results.length} · acc ${accuracy === null ? '—' : accuracy.toFixed(0) + '%'}`);
  }

  function renderLog(){
    fsrLog.innerHTML = runHistory.map((h, i) =>
      `<span class="entry">Run ${runHistory.length - i} — correct <b>${h.correct}</b> &middot; wrong <b>${h.wrong}</b> &middot; timeout <b>${h.timeouts}</b> &middot; avg RT <b>${fmtMs(h.avgRt)}</b></span>`
    ).join('<span style="color:var(--grid)">|</span>');
  }

  fsrGrid.addEventListener('pointerdown', handleCellClick);
  fsrStartBtn.addEventListener('click', startRun);
  fsrNextBtn.addEventListener('click', startRun);

  window.fsrEnterHook = function(){
    clearTimers(); armed = false; fsrGrid.style.display = 'none'; fsrGrid.innerHTML = '';
    chooseTarget();
    fsrStartPanel.style.display = ''; fsrResultCard.style.display = 'none';
    clearFeedback();
  };

  chooseTarget();
})();
