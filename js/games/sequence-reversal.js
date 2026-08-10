(function(){
  const TOTAL_TRIALS = 12;
  const MIN_LEN = 3, MAX_LEN = 5;
  const SHOW_TIME = 500, GAP_TIME = 200;
  const ISI_MIN = 500, ISI_MAX = 900;
  const POST_PAUSE = 500;

  const padEls = [0, 1, 2, 3].map(i => document.getElementById('revPad' + i));
  const revFeedback = document.getElementById('revFeedback');
  const revStartPanel = document.getElementById('revStartPanel');
  const revStartBtn = document.getElementById('revStartBtn');
  const revResultCard = document.getElementById('revResultCard');
  const revNextBtn = document.getElementById('revNextBtn');
  const revLog = document.getElementById('revLog');
  const revTrialVal = document.getElementById('revTrialVal');
  const revScoreVal = document.getElementById('revScoreVal');

  let trialIndex, score, results, runHistory = [];
  let sequence = [], expected = [], playerIndex = 0, accepting = false, currentTrial = null, timers = {};

  function clearTimers(){ Object.keys(timers).forEach(k => clearTimeout(timers[k])); timers = {}; }
  function clearFeedback(){ revFeedback.textContent = ''; revFeedback.className = 'game-feedback'; }
  function showFeedback(msg, kind){ revFeedback.textContent = msg; revFeedback.className = 'game-feedback ' + kind; }
  function updateHud(){ revTrialVal.textContent = trialIndex + ' / ' + TOTAL_TRIALS; revScoreVal.textContent = score; }

  function startRun(){
    trialIndex = 0; score = 0; results = []; accepting = false; clearTimers();
    revStartPanel.style.display = 'none'; revResultCard.style.display = 'none';
    clearFeedback();
    updateHud();
    nextTrial();
  }

  function nextTrial(){
    if (trialIndex >= TOTAL_TRIALS){ finishRun(); return; }
    trialIndex++;
    updateHud(); clearFeedback();
    padEls.forEach(p => p.classList.remove('lit'));
    const len = MIN_LEN + Math.floor(Math.random() * (MAX_LEN - MIN_LEN + 1));
    sequence = Array.from({ length: len }, () => Math.floor(Math.random() * 4));
    expected = [...sequence].reverse();
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
        showFeedback('YOUR TURN — REVERSE IT', 'neutral');
        return;
      }
      const idx = sequence[i];
      padEls[idx].classList.add('lit');
      window.KA_sound.memoryShow();
      timers.show = setTimeout(() => {
        padEls[idx].classList.remove('lit');
        i++;
        timers.gap = setTimeout(step, GAP_TIME);
      }, SHOW_TIME);
    }
    step();
  }

  function flashPad(index){
    const pad = padEls[index];
    pad.classList.add('lit');
    setTimeout(() => pad.classList.remove('lit'), 150);
  }

  function handlePadClick(index){
    if (!accepting) return;
    flashPad(index);
    if (index === expected[playerIndex]){
      window.KA_sound.memoryClick();
      playerIndex++;
      if (playerIndex >= expected.length){
        accepting = false;
        currentTrial.outcome = 'correct'; score++;
        showFeedback('CORRECT', 'good');
        settleTrial();
      }
    } else {
      accepting = false;
      currentTrial.outcome = 'incorrect';
      window.KA_sound.error();
      showFeedback('WRONG ORDER', 'bad');
      settleTrial();
    }
  }

  function settleTrial(){
    results.push(currentTrial);
    updateHud();
    timers.advance = setTimeout(nextTrial, POST_PAUSE);
  }

  function finishRun(){
    clearFeedback();
    const correct = results.filter(r => r.outcome === 'correct');
    const accuracy = results.length ? (correct.length / results.length) * 100 : null;

    document.getElementById('revRCorrect').textContent = correct.length + ' / ' + results.length;
    document.getElementById('revRAcc').textContent = accuracy === null ? '—' : accuracy.toFixed(0) + '%';

    const bestCorrect = window.KA_records.get('rev_best_correct', null);
    const isNewBest = bestCorrect === null || correct.length > bestCorrect;
    if (isNewBest) window.KA_records.set('rev_best_correct', correct.length);
    window.KA_weekly.record('rev', correct.length);
    document.getElementById('revRBest').textContent = (isNewBest ? correct.length : bestCorrect) + ' / ' + results.length;
    document.getElementById('revRBestRow').classList.toggle('is-new', isNewBest);

    window.KA_renderRunRank('revResultCard', window.KA_getAccRank(accuracy));
    revResultCard.style.display = 'flex';
    runHistory.unshift({ correct: correct.length, accuracy });
    if (runHistory.length > 6) runHistory.pop();
    renderLog();
    window.KA_history.add('Sequence Reversal', `correct ${correct.length}/${results.length} · acc ${accuracy === null ? '—' : accuracy.toFixed(0) + '%'}`);
  }

  function renderLog(){
    revLog.innerHTML = runHistory.map((h, i) =>
      `<span class="entry">Run ${runHistory.length - i} — correct <b>${h.correct}</b> &middot; acc <b>${h.accuracy === null ? '—' : h.accuracy.toFixed(0) + '%'}</b></span>`
    ).join('<span style="color:var(--grid)">|</span>');
  }

  padEls.forEach((pad, index) => pad.addEventListener('click', () => handlePadClick(index)));
  revStartBtn.addEventListener('click', startRun);
  revNextBtn.addEventListener('click', startRun);

  window.revEnterHook = function(){
    clearTimers(); accepting = false;
    padEls.forEach(p => p.classList.remove('lit'));
    revStartPanel.style.display = ''; revResultCard.style.display = 'none';
    clearFeedback();
  };
})();
