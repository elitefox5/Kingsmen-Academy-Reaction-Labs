(function(){
  const COLORS = { RED:'#ff5a5a', GREEN:'#3ddc6f', BLUE:'#4f8cff', YELLOW:'#ffe066' };
  const NAMES = Object.keys(COLORS);
  const TOTAL_TRIALS = 20;
  const RESPONSE_WINDOW = 1500;
  const ISI_MIN = 500, ISI_MAX = 1000;
  const POST_PAUSE = 350;

  const strWord = document.getElementById('strWord');
  const strFeedback = document.getElementById('strFeedback');
  const strStartPanel = document.getElementById('strStartPanel');
  const strStartBtn = document.getElementById('strStartBtn');
  const strResultCard = document.getElementById('strResultCard');
  const strNextBtn = document.getElementById('strNextBtn');
  const strLog = document.getElementById('strLog');
  const strTrialVal = document.getElementById('strTrialVal');
  const strScoreVal = document.getElementById('strScoreVal');
  const strRuleVal = document.getElementById('strRuleVal');
  const strNormalBtn = document.getElementById('strNormalBtn');
  const strHardBtn = document.getElementById('strHardBtn');
  const zoneEls = {};
  document.querySelectorAll('.str-zone').forEach(el => { zoneEls[el.getAttribute('data-color')] = el; });

  let trialIndex, score, results, runHistory = [];
  let armed = false, appearTime = null, currentTrial = null, timers = {};
  let mode = 'normal';
  let switchPoints = [];
  let targetRule = 'ink';

  function setMode(m){
    mode = m;
    strNormalBtn.classList.toggle('selected', m === 'normal');
    strHardBtn.classList.toggle('selected', m === 'hard');
  }

  function fmtMs(ms){ if (ms === null || ms === undefined) return '—'; return ms.toFixed(0) + ' ms'; }
  function clearTimers(){ clearTimeout(timers.isi); clearTimeout(timers.response); clearTimeout(timers.advance); }
  function clearFeedback(){ strFeedback.textContent = ''; strFeedback.className = 'game-feedback'; }
  function showFeedback(msg, kind){ strFeedback.textContent = msg; strFeedback.className = 'game-feedback ' + kind; }
  function updateHud(){ strTrialVal.textContent = trialIndex + ' / ' + TOTAL_TRIALS; strScoreVal.textContent = score; strRuleVal.textContent = targetRule === 'ink' ? 'INK' : 'WORD'; }

  function startRun(){
    trialIndex = 0; score = 0; results = []; armed = false; clearTimers();
    targetRule = 'ink';
    switchPoints = mode === 'hard' ? [Math.floor(TOTAL_TRIALS / 3) + 1, Math.floor(TOTAL_TRIALS * 2 / 3) + 1] : [];
    strStartPanel.style.display = 'none'; strResultCard.style.display = 'none';
    clearFeedback(); strWord.style.display = 'none';
    updateHud();
    nextTrial();
  }

  function nextTrial(){
    if (trialIndex >= TOTAL_TRIALS){ finishRun(); return; }
    trialIndex++;
    updateHud(); clearFeedback();
    strWord.style.display = 'none';
    if (switchPoints.includes(trialIndex)){
      targetRule = targetRule === 'ink' ? 'word' : 'ink';
      updateHud();
      showFeedback('RULE FLIPPED — ' + (targetRule === 'ink' ? 'INK' : 'WORD MEANING'), 'neutral');
    }
    const word = NAMES[Math.floor(Math.random() * NAMES.length)];
    const ink = NAMES[Math.floor(Math.random() * NAMES.length)];
    const congruent = word === ink;
    currentTrial = { trial: trialIndex, word, ink, congruent, rt: null, outcome: null };
    const isi = ISI_MIN + Math.random() * (ISI_MAX - ISI_MIN);
    timers.isi = setTimeout(() => showWord(word, ink), isi);
  }

  function showWord(word, ink){
    strWord.textContent = word;
    strWord.style.color = COLORS[ink];
    strWord.style.display = 'block';
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        appearTime = performance.now();
        armed = true;
        timers.response = setTimeout(handleTimeout, RESPONSE_WINDOW);
      });
    });
  }

  function handleZoneClick(color){
    if (!armed) return;
    const rt = window.KA_applyGrace(performance.now() - appearTime);
    armed = false; clearTimeout(timers.response);
    strWord.style.display = 'none';
    const correctColor = targetRule === 'ink' ? currentTrial.ink : currentTrial.word;
    if (color === correctColor){
      currentTrial.rt = rt; currentTrial.outcome = 'correct'; score++;
      showFeedback('CORRECT — ' + fmtMs(rt), 'good');
    } else {
      currentTrial.outcome = 'incorrect';
      showFeedback('WRONG COLOR', 'bad');
    }
    settleTrial();
  }

  function handleTimeout(){
    if (!armed) return;
    armed = false; strWord.style.display = 'none';
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
    clearFeedback(); strWord.style.display = 'none';
    const correct = results.filter(r => r.outcome === 'correct');
    const wrong = results.filter(r => r.outcome === 'incorrect');
    const timeouts = results.filter(r => r.outcome === 'timeout');
    const avgRt = avg(correct.map(r => r.rt));
    const accuracy = results.length ? (correct.length / results.length) * 100 : null;
    const congAvg = avg(correct.filter(r => r.congruent).map(r => r.rt));
    const incongAvg = avg(correct.filter(r => !r.congruent).map(r => r.rt));
    const interference = (congAvg !== null && incongAvg !== null) ? incongAvg - congAvg : null;

    document.getElementById('strRCorrect').textContent = correct.length + ' / ' + results.length;
    document.getElementById('strRAvgRt').textContent = fmtMs(avgRt);
    document.getElementById('strRWrong').textContent = wrong.length;
    document.getElementById('strRTimeout').textContent = timeouts.length;
    document.getElementById('strRAcc').textContent = accuracy === null ? '—' : accuracy.toFixed(0) + '%';
    document.getElementById('strRInterference').textContent = interference === null ? '—' : (interference >= 0 ? '+' : '') + interference.toFixed(0) + ' ms';

    const bestCorrect = window.KA_records.get('str_best_correct', null);
    const isNewBest = bestCorrect === null || correct.length > bestCorrect;
    if (isNewBest) window.KA_records.set('str_best_correct', correct.length);
    window.KA_weekly.record('str', correct.length);
    document.getElementById('strRBest').textContent = (isNewBest ? correct.length : bestCorrect) + ' / ' + results.length;
    document.getElementById('strRBestRow').classList.toggle('is-new', isNewBest);

    window.KA_scoreRun('str', 'strResultCard', { accuracyPct: accuracy, avgRt, mode });
    strResultCard.style.display = 'flex';
    runHistory.unshift({ correct: correct.length, wrong: wrong.length, timeouts: timeouts.length, avgRt, accuracy });
    if (runHistory.length > 6) runHistory.pop();
    renderLog();
    window.KA_history.add('Stroop Test', `correct ${correct.length}/${results.length} · acc ${accuracy === null ? '—' : accuracy.toFixed(0) + '%'}`);
  }

  function renderLog(){
    strLog.innerHTML = runHistory.map((h, i) =>
      `<span class="entry">Run ${runHistory.length - i} — correct <b>${h.correct}</b> &middot; wrong <b>${h.wrong}</b> &middot; timeout <b>${h.timeouts}</b> &middot; avg RT <b>${fmtMs(h.avgRt)}</b></span>`
    ).join('<span style="color:var(--grid)">|</span>');
  }

  Object.keys(zoneEls).forEach(color => zoneEls[color].addEventListener('pointerdown', () => handleZoneClick(color)));
  strStartBtn.addEventListener('click', startRun);
  strNextBtn.addEventListener('click', startRun);
  strNormalBtn.addEventListener('click', () => setMode('normal'));
  strHardBtn.addEventListener('click', () => setMode('hard'));

  window.strEnterHook = function(){
    clearTimers(); armed = false; strWord.style.display = 'none';
    targetRule = 'ink';
    strRuleVal.textContent = 'INK';
    strStartPanel.style.display = ''; strResultCard.style.display = 'none';
    clearFeedback();
  };
})();
