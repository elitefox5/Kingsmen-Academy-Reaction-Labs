(function(){
  const TOTAL_TRIALS = 20;
  const RESPONSE_WINDOW = 2000;
  const ISI_MIN = 500, ISI_MAX = 1000;
  const POST_PAUSE = 350;

  const mthEquation = document.getElementById('mthEquation');
  const mthFeedback = document.getElementById('mthFeedback');
  const mthStartPanel = document.getElementById('mthStartPanel');
  const mthStartBtn = document.getElementById('mthStartBtn');
  const mthResultCard = document.getElementById('mthResultCard');
  const mthNextBtn = document.getElementById('mthNextBtn');
  const mthLog = document.getElementById('mthLog');
  const mthTrialVal = document.getElementById('mthTrialVal');
  const mthScoreVal = document.getElementById('mthScoreVal');
  const zoneEls = {};
  document.querySelectorAll('.mth-zone').forEach(el => { zoneEls[el.getAttribute('data-answer')] = el; });

  let trialIndex, score, results, runHistory = [];
  let armed = false, waiting = false, appearTime = null, currentTrial = null, timers = {};

  function fmtMs(ms){ if (ms === null || ms === undefined) return '—'; return ms.toFixed(0) + ' ms'; }
  function clearTimers(){ clearTimeout(timers.isi); clearTimeout(timers.response); clearTimeout(timers.advance); }
  function clearFeedback(){ mthFeedback.textContent = ''; mthFeedback.className = 'game-feedback'; }
  function showFeedback(msg, kind){ mthFeedback.textContent = msg; mthFeedback.className = 'game-feedback ' + kind; }
  function updateHud(){ mthTrialVal.textContent = trialIndex + ' / ' + TOTAL_TRIALS; mthScoreVal.textContent = score; }

  function buildEquation(){
    const ops = ['+', '-', '*'];
    const op = ops[Math.floor(Math.random() * ops.length)];
    let a, b, realResult;
    if (op === '+'){ a = 1 + Math.floor(Math.random()*20); b = 1 + Math.floor(Math.random()*20); realResult = a+b; }
    else if (op === '-'){ a = 5 + Math.floor(Math.random()*20); b = 1 + Math.floor(Math.random()*a); realResult = a-b; }
    else { a = 1 + Math.floor(Math.random()*12); b = 1 + Math.floor(Math.random()*12); realResult = a*b; }

    const showTrue = Math.random() < 0.5;
    let shown = realResult;
    if (!showTrue){
      const delta = 1 + Math.floor(Math.random()*4);
      shown = realResult + (Math.random() < 0.5 ? delta : -delta);
    }
    return { text: `${a} ${op} ${b} = ${shown}`, answer: showTrue };
  }

  function startRun(){
    trialIndex = 0; score = 0; results = []; armed = false; waiting = false; clearTimers();
    mthStartPanel.style.display = 'none'; mthResultCard.style.display = 'none';
    clearFeedback(); mthEquation.style.display = 'none';
    updateHud();
    nextTrial();
  }

  function nextTrial(){
    if (trialIndex >= TOTAL_TRIALS){ finishRun(); return; }
    trialIndex++;
    updateHud(); clearFeedback();
    mthEquation.style.display = 'none';
    const eq = buildEquation();
    currentTrial = { trial: trialIndex, text: eq.text, answer: eq.answer, rt: null, outcome: null };
    waiting = true;
    const isi = ISI_MIN + Math.random() * (ISI_MAX - ISI_MIN);
    timers.isi = setTimeout(() => showEquation(eq), isi);
  }

  // Clicking before the equation appears used to be a silent no-op — spamming both zones
  // through the whole wait would land a click the instant the trial armed, banking a
  // near-zero "reaction time" on lucky trials with no accuracy cost. An early click now
  // fails the trial outright instead, same as Split Focus.
  function handleEarlyClick(){
    clearTimeout(timers.isi);
    waiting = false;
    mthEquation.style.display = 'none';
    currentTrial.outcome = 'early';
    showFeedback('TOO EARLY', 'bad');
    settleTrial();
  }

  function showEquation(eq){
    waiting = false;
    mthEquation.textContent = eq.text;
    mthEquation.style.display = 'block';
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        appearTime = performance.now();
        armed = true;
        timers.response = setTimeout(handleTimeout, RESPONSE_WINDOW);
      });
    });
  }

  function handleZoneClick(answerStr){
    if (waiting){ handleEarlyClick(); return; }
    if (!armed) return;
    const rt = window.KA_applyGrace(performance.now() - appearTime);
    armed = false; clearTimeout(timers.response);
    mthEquation.style.display = 'none';
    const clicked = answerStr === 'true';
    if (clicked === currentTrial.answer){
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
    armed = false; mthEquation.style.display = 'none';
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
    clearFeedback(); mthEquation.style.display = 'none';
    const correct = results.filter(r => r.outcome === 'correct');
    const wrong = results.filter(r => r.outcome === 'incorrect' || r.outcome === 'early');
    const timeouts = results.filter(r => r.outcome === 'timeout');
    const avgRt = avg(correct.map(r => r.rt));
    const accuracy = results.length ? (correct.length / results.length) * 100 : null;

    document.getElementById('mthRCorrect').textContent = correct.length + ' / ' + results.length;
    document.getElementById('mthRAvgRt').textContent = fmtMs(avgRt);
    document.getElementById('mthRWrong').textContent = wrong.length;
    document.getElementById('mthRTimeout').textContent = timeouts.length;
    document.getElementById('mthRAcc').textContent = accuracy === null ? '—' : accuracy.toFixed(0) + '%';

    const bestCorrect = window.KA_records.get('mth_best_correct', null);
    const isNewBest = bestCorrect === null || correct.length > bestCorrect;
    if (isNewBest) window.KA_records.set('mth_best_correct', correct.length);
    window.KA_weekly.record('mth', correct.length);
    document.getElementById('mthRBest').textContent = (isNewBest ? correct.length : bestCorrect) + ' / ' + results.length;
    document.getElementById('mthRBestRow').classList.toggle('is-new', isNewBest);

    window.KA_scoreRun('mth', 'mthResultCard', { accuracyPct: accuracy, avgRt });
    mthResultCard.style.display = 'flex';
    runHistory.unshift({ correct: correct.length, wrong: wrong.length, timeouts: timeouts.length, avgRt, accuracy });
    if (runHistory.length > 6) runHistory.pop();
    renderLog();
    window.KA_history.add('Math Sprint', `correct ${correct.length}/${results.length} · acc ${accuracy === null ? '—' : accuracy.toFixed(0) + '%'}`);
  }

  function renderLog(){
    mthLog.innerHTML = runHistory.map((h, i) =>
      `<span class="entry">Run ${runHistory.length - i} — correct <b>${h.correct}</b> &middot; wrong <b>${h.wrong}</b> &middot; timeout <b>${h.timeouts}</b> &middot; avg RT <b>${fmtMs(h.avgRt)}</b></span>`
    ).join('<span style="color:var(--grid)">|</span>');
  }

  Object.keys(zoneEls).forEach(answerStr => zoneEls[answerStr].addEventListener('pointerdown', () => handleZoneClick(answerStr)));
  mthStartBtn.addEventListener('click', startRun);
  mthNextBtn.addEventListener('click', startRun);

  window.mthEnterHook = function(){
    clearTimers(); armed = false; waiting = false; mthEquation.style.display = 'none';
    mthStartPanel.style.display = ''; mthResultCard.style.display = 'none';
    clearFeedback();
  };
})();
