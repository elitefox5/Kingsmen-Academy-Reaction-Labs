(function(){
  const TOTAL_TRIALS = 12;
  const MIN_LEN = 3, MAX_LEN = 5;
  const SHOW_TIME = 550, GAP_TIME = 200;
  const ISI_MIN = 500, ISI_MAX = 900;
  const POST_PAUSE = 500;
  const DIRECTIONS = ['NORTH', 'SOUTH', 'EAST', 'WEST'];
  const ADAPTIVE_TRIALS = 24; // span trials run long, so fewer than the 30 used elsewhere
  const STAIR = { min: 2, max: 9, step: 1, startAt: 4, harderIs: 'higher' };

  const cloWord = document.getElementById('cloWord');
  const cloFeedback = document.getElementById('cloFeedback');
  const cloStartPanel = document.getElementById('cloStartPanel');
  const cloStartBtn = document.getElementById('cloStartBtn');
  const cloResultCard = document.getElementById('cloResultCard');
  const cloNextBtn = document.getElementById('cloNextBtn');
  const cloLog = document.getElementById('cloLog');
  const cloTrialVal = document.getElementById('cloTrialVal');
  const cloScoreVal = document.getElementById('cloScoreVal');
  const cloNormalBtn = document.getElementById('cloNormalBtn');
  const cloAdaptiveBtn = document.getElementById('cloAdaptiveBtn');

  let trialIndex, score, results, runHistory = [];
  let sequence = [], playerIndex = 0, accepting = false, currentTrial = null, timers = {};
  let mode = 'normal';
  let stair = null;
  let runTotal = TOTAL_TRIALS;

  function setMode(m){
    mode = m;
    cloNormalBtn.classList.toggle('selected', m === 'normal');
    cloAdaptiveBtn.classList.toggle('selected', m === 'adaptive');
  }

  function clearTimers(){ Object.keys(timers).forEach(k => clearTimeout(timers[k])); timers = {}; }
  function clearFeedback(){ cloFeedback.textContent = ''; cloFeedback.className = 'game-feedback'; }
  function showFeedback(msg, kind){ cloFeedback.textContent = msg; cloFeedback.className = 'game-feedback ' + kind; }
  function updateHud(){
    cloTrialVal.textContent = trialIndex + ' / ' + runTotal;
    cloScoreVal.textContent = mode === 'adaptive' ? Math.round(stair.value) + ' long' : score;
  }

  function startRun(){
    trialIndex = 0; score = 0; results = []; accepting = false; clearTimers();
    stair = window.KA_makeStaircase(STAIR);
    runTotal = mode === 'adaptive' ? ADAPTIVE_TRIALS : TOTAL_TRIALS;
    cloScoreVal.previousElementSibling.textContent = mode === 'adaptive' ? 'LENGTH' : 'CORRECT';
    window.KA_setResultMode('cloResultCard', mode === 'adaptive');
    cloStartPanel.style.display = 'none'; cloResultCard.style.display = 'none';
    clearFeedback(); cloWord.style.display = 'none';
    updateHud();
    nextTrial();
  }

  function nextTrial(){
    if (trialIndex >= runTotal){ finishRun(); return; }
    trialIndex++;
    updateHud(); clearFeedback();
    const len = mode === 'adaptive'
      ? Math.round(stair.value)
      : MIN_LEN + Math.floor(Math.random() * (MAX_LEN - MIN_LEN + 1));
    sequence = Array.from({ length: len }, () => DIRECTIONS[Math.floor(Math.random() * DIRECTIONS.length)]);
    playerIndex = 0; accepting = false;
    currentTrial = { trial: trialIndex, len, outcome: null };
    const isi = ISI_MIN + Math.random() * (ISI_MAX - ISI_MIN);
    timers.start = setTimeout(playSequence, isi);
  }

  function playSequence(){
    let i = 0;
    function step(){
      if (i >= sequence.length){
        playerIndex = 0;
        accepting = true;
        showFeedback('YOUR TURN', 'neutral');
        return;
      }
      cloWord.textContent = sequence[i];
      cloWord.style.display = 'block';
      timers.show = setTimeout(() => {
        cloWord.style.display = 'none';
        i++;
        timers.gap = setTimeout(step, GAP_TIME);
      }, SHOW_TIME);
    }
    step();
  }

  function handleZoneClick(dir){
    if (!accepting) return;
    if (dir === sequence[playerIndex]){
      playerIndex++;
      if (playerIndex >= sequence.length){
        accepting = false;
        currentTrial.outcome = 'correct'; score++;
        showFeedback('CORRECT', 'good');
        settleTrial();
      }
    } else {
      accepting = false;
      currentTrial.outcome = 'incorrect';
      showFeedback('WRONG ORDER', 'bad');
      settleTrial();
    }
  }

  function settleTrial(){
    results.push(currentTrial);
    if (mode === 'adaptive') stair.record(currentTrial.outcome === 'correct');
    updateHud();
    timers.advance = setTimeout(nextTrial, POST_PAUSE);
  }

  function finishRun(){
    clearFeedback(); cloWord.style.display = 'none';
    const correct = results.filter(r => r.outcome === 'correct');
    const accuracy = results.length ? (correct.length / results.length) * 100 : null;

    document.getElementById('cloRCorrect').textContent = correct.length + ' / ' + results.length;
    document.getElementById('cloRAcc').textContent = accuracy === null ? '—' : accuracy.toFixed(0) + '%';

    if (mode === 'adaptive'){
      const threshold = stair.result();
      const { best, isNew } = window.KA_recordThreshold('clo', threshold, 'higher');
      document.getElementById('cloRBest').textContent = best.toFixed(1) + ' callouts';
      document.getElementById('cloRBestRow').classList.toggle('is-new', isNew);
      window.KA_renderThreshold('cloResultCard', 'Span held',
        threshold.toFixed(1) + ' callouts  (' + stair.reversalCount() + ' reversals)', isNew);
      window.KA_setResultMode('cloResultCard', true);
      window.KA_history.add('Callout Recall', `adaptive · span ${threshold.toFixed(1)}`);
    } else {
      const bestCorrect = window.KA_records.get('clo_best_correct', null);
      const isNewBest = bestCorrect === null || correct.length > bestCorrect;
      if (isNewBest) window.KA_records.set('clo_best_correct', correct.length);
      window.KA_weekly.record('clo', correct.length);
      document.getElementById('cloRBest').textContent = (isNewBest ? correct.length : bestCorrect) + ' / ' + results.length;
      document.getElementById('cloRBestRow').classList.toggle('is-new', isNewBest);
      window.KA_renderRunRank('cloResultCard', window.KA_getAccRank(accuracy));
      window.KA_setResultMode('cloResultCard', false);
      window.KA_history.add('Callout Recall', `correct ${correct.length}/${results.length} · acc ${accuracy === null ? '—' : accuracy.toFixed(0) + '%'}`);
    }
    cloResultCard.style.display = 'flex';
    runHistory.unshift({ correct: correct.length, accuracy });
    if (runHistory.length > 6) runHistory.pop();
    renderLog();
  }

  function renderLog(){
    cloLog.innerHTML = runHistory.map((h, i) =>
      `<span class="entry">Run ${runHistory.length - i} — correct <b>${h.correct}</b> &middot; acc <b>${h.accuracy === null ? '—' : h.accuracy.toFixed(0) + '%'}</b></span>`
    ).join('<span style="color:var(--grid)">|</span>');
  }

  document.querySelectorAll('.clo-zone').forEach(el => el.addEventListener('click', () => handleZoneClick(el.getAttribute('data-dir'))));
  cloStartBtn.addEventListener('click', startRun);
  cloNextBtn.addEventListener('click', startRun);
  cloNormalBtn.addEventListener('click', () => setMode('normal'));
  cloAdaptiveBtn.addEventListener('click', () => setMode('adaptive'));

  window.cloEnterHook = function(){
    clearTimers(); accepting = false; cloWord.style.display = 'none';
    cloStartPanel.style.display = ''; cloResultCard.style.display = 'none';
    clearFeedback();
  };
})();
