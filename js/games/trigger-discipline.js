(function(){
  const TOTAL_TRIALS = 20;
  const RESPONSE_WINDOW = 800;
  const CHORD_WINDOW = 100; // ms — the precision window for both the fail-case and the chord case
  const ISI_MIN = 500, ISI_MAX = 1200;
  const POST_PAUSE = 350;

  const trgStim = document.getElementById('trgStim');
  const trgStimLabel = document.getElementById('trgStimLabel');
  const trgFeedback = document.getElementById('trgFeedback');
  const trgStartPanel = document.getElementById('trgStartPanel');
  const trgStartBtn = document.getElementById('trgStartBtn');
  const trgResultCard = document.getElementById('trgResultCard');
  const trgNextBtn = document.getElementById('trgNextBtn');
  const trgLog = document.getElementById('trgLog');
  const trgTrialVal = document.getElementById('trgTrialVal');
  const trgScoreVal = document.getElementById('trgScoreVal');

  let trialIndex, score, results, runHistory = [];
  let armed = false, resolved = false, appearTime = null, leftTime = null, rightTime = null, currentTrial = null, timers = {};

  function fmtMs(ms){ if (ms === null || ms === undefined) return '—'; return ms.toFixed(0) + ' ms'; }
  function clearTimers(){ clearTimeout(timers.isi); clearTimeout(timers.response); clearTimeout(timers.grace); clearTimeout(timers.advance); }
  function clearFeedback(){ trgFeedback.textContent = ''; trgFeedback.className = 'game-feedback'; }
  function showFeedback(msg, kind){ trgFeedback.textContent = msg; trgFeedback.className = 'game-feedback ' + kind; }
  function updateHud(){ trgTrialVal.textContent = trialIndex + ' / ' + TOTAL_TRIALS; trgScoreVal.textContent = score; }
  function hideStim(){ trgStim.style.display = 'none'; trgStim.classList.remove('left-only', 'both-required'); }

  function startRun(){
    trialIndex = 0; score = 0; results = []; armed = false; resolved = false; clearTimers();
    trgStartPanel.style.display = 'none'; trgResultCard.style.display = 'none';
    clearFeedback(); hideStim();
    updateHud();
    nextTrial();
  }

  function nextTrial(){
    if (trialIndex >= TOTAL_TRIALS){ finishRun(); return; }
    trialIndex++;
    updateHud(); clearFeedback();
    hideStim();
    const requirement = Math.random() < 0.5 ? 'left' : 'both';
    currentTrial = { trial: trialIndex, requirement, rt: null, outcome: null };
    const isi = ISI_MIN + Math.random() * (ISI_MAX - ISI_MIN);
    timers.isi = setTimeout(() => showStim(requirement), isi);
  }

  function showStim(requirement){
    leftTime = null; rightTime = null; resolved = false;
    timers.grace = null; // setTimeout IDs are truthy, so this must be reset each trial or the "!timers.grace" guard below silently skips scheduling a new grace timer
    trgStimLabel.textContent = requirement === 'left' ? 'LEFT CLICK' : 'LEFT + RIGHT';
    trgStim.classList.add(requirement === 'left' ? 'left-only' : 'both-required');
    trgStim.style.display = 'flex';
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        appearTime = performance.now();
        armed = true;
        timers.response = setTimeout(handleTimeout, RESPONSE_WINDOW);
      });
    });
  }

  function handleButton(button){
    if (!armed || resolved) return;
    const t = performance.now();
    if (button === 0 && leftTime === null) leftTime = t;
    else if (button === 2 && rightTime === null) rightTime = t;
    else return;
    attemptResolve();
  }

  function attemptResolve(){
    if (resolved) return;
    const req = currentTrial.requirement;

    if (req === 'left'){
      if (leftTime === null) return;
      if (rightTime !== null && Math.abs(rightTime - leftTime) <= CHORD_WINDOW){
        finalize('fail', null);
        return;
      }
      if (!timers.grace){
        timers.grace = setTimeout(() => {
          if (resolved) return;
          if (rightTime !== null && Math.abs(rightTime - leftTime) <= CHORD_WINDOW){
            finalize('fail', null);
          } else {
            finalize('correct', leftTime - appearTime);
          }
        }, CHORD_WINDOW);
      }
    } else {
      if (leftTime !== null && rightTime !== null){
        if (Math.abs(leftTime - rightTime) <= CHORD_WINDOW){
          finalize('correct', Math.max(leftTime, rightTime) - appearTime);
        } else {
          finalize('fail', null);
        }
        return;
      }
      if (!timers.grace){
        timers.grace = setTimeout(() => {
          if (resolved) return;
          if (leftTime !== null && rightTime !== null && Math.abs(leftTime - rightTime) <= CHORD_WINDOW){
            finalize('correct', Math.max(leftTime, rightTime) - appearTime);
          } else {
            finalize('fail', null);
          }
        }, CHORD_WINDOW);
      }
    }
  }

  function finalize(outcome, rt){
    if (resolved) return;
    resolved = true;
    armed = false;
    clearTimeout(timers.response);
    clearTimeout(timers.grace);
    hideStim();
    currentTrial.outcome = outcome;
    currentTrial.rt = rt;
    if (outcome === 'correct'){
      score++;
      showFeedback('CORRECT — ' + fmtMs(rt), 'good');
    } else {
      showFeedback(currentTrial.requirement === 'left' ? 'WRONG BUTTON' : 'BAD CHORD', 'bad');
    }
    settleTrial();
  }

  function handleTimeout(){
    if (!armed || resolved) return;
    resolved = true;
    armed = false;
    hideStim();
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
    clearFeedback(); hideStim();
    const correct = results.filter(r => r.outcome === 'correct');
    const fails = results.filter(r => r.outcome === 'fail');
    const timeouts = results.filter(r => r.outcome === 'timeout');
    const avgRt = avg(correct.map(r => r.rt));
    const accuracy = results.length ? (correct.length / results.length) * 100 : null;

    document.getElementById('trgRCorrect').textContent = correct.length + ' / ' + results.length;
    document.getElementById('trgRAvgRt').textContent = fmtMs(avgRt);
    document.getElementById('trgRFail').textContent = fails.length;
    document.getElementById('trgRTimeout').textContent = timeouts.length;
    document.getElementById('trgRAcc').textContent = accuracy === null ? '—' : accuracy.toFixed(0) + '%';

    const bestCorrect = window.KA_records.get('trg_best_correct', null);
    const isNewBest = bestCorrect === null || correct.length > bestCorrect;
    if (isNewBest) window.KA_records.set('trg_best_correct', correct.length);
    window.KA_weekly.record('trg', correct.length);
    document.getElementById('trgRBest').textContent = (isNewBest ? correct.length : bestCorrect) + ' / ' + results.length;
    document.getElementById('trgRBestRow').classList.toggle('is-new', isNewBest);

    window.KA_scoreRun('trg', 'trgResultCard', { accuracyPct: accuracy, avgRt });
    trgResultCard.style.display = 'flex';
    runHistory.unshift({ correct: correct.length, fails: fails.length, timeouts: timeouts.length, avgRt, accuracy });
    if (runHistory.length > 6) runHistory.pop();
    renderLog();
    window.KA_history.add('Trigger Discipline', `correct ${correct.length}/${results.length} · acc ${accuracy === null ? '—' : accuracy.toFixed(0) + '%'}`);
  }

  function renderLog(){
    trgLog.innerHTML = runHistory.map((h, i) =>
      `<span class="entry">Run ${runHistory.length - i} — correct <b>${h.correct}</b> &middot; fail <b>${h.fails}</b> &middot; timeout <b>${h.timeouts}</b> &middot; avg RT <b>${fmtMs(h.avgRt)}</b></span>`
    ).join('<span style="color:var(--grid)">|</span>');
  }

  trgStim.addEventListener('mousedown', (e) => {
    e.preventDefault();
    handleButton(e.button);
  });
  document.getElementById('trg').addEventListener('contextmenu', (e) => e.preventDefault());
  trgStartBtn.addEventListener('click', startRun);
  trgNextBtn.addEventListener('click', startRun);

  window.trgEnterHook = function(){
    clearTimers(); armed = false; resolved = false; hideStim();
    trgStartPanel.style.display = ''; trgResultCard.style.display = 'none';
    clearFeedback();
  };
})();
