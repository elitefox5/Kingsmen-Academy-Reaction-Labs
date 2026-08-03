(function(){
  const TOTAL_TRIALS = 15;
  const RESPONSE_WINDOW = 1000;
  const ISI_MIN = 1500, ISI_MAX = 3500;
  const POST_PAUSE = 500;

  const audZone = document.getElementById('audZone');
  const audFeedback = document.getElementById('audFeedback');
  const audStartPanel = document.getElementById('audStartPanel');
  const audStartBtn = document.getElementById('audStartBtn');
  const audResultCard = document.getElementById('audResultCard');
  const audNextBtn = document.getElementById('audNextBtn');
  const audLog = document.getElementById('audLog');
  const audTrialVal = document.getElementById('audTrialVal');
  const audScoreVal = document.getElementById('audScoreVal');

  let trialIndex, score, results, runHistory = [];
  let armed = false, toneTime = null, currentTrial = null, timers = {};
  let audioCtx = null;

  function getAudioCtx(){
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
  }

  function playTone(){
    const ctx = getAudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.35, ctx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.14);
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.15);
  }

  function fmtMs(ms){ if (ms === null || ms === undefined) return '—'; return ms.toFixed(0) + ' ms'; }
  function clearTimers(){ clearTimeout(timers.isi); clearTimeout(timers.response); clearTimeout(timers.advance); }
  function clearFeedback(){ audFeedback.textContent = ''; audFeedback.className = 'game-feedback'; }
  function showFeedback(msg, kind){ audFeedback.textContent = msg; audFeedback.className = 'game-feedback ' + kind; }
  function updateHud(){ audTrialVal.textContent = trialIndex + ' / ' + TOTAL_TRIALS; audScoreVal.textContent = score; }

  function startRun(){
    trialIndex = 0; score = 0; results = []; armed = false; clearTimers();
    audStartPanel.style.display = 'none'; audResultCard.style.display = 'none';
    clearFeedback();
    updateHud();
    getAudioCtx();
    nextTrial();
  }

  function nextTrial(){
    if (trialIndex >= TOTAL_TRIALS){ finishRun(); return; }
    trialIndex++;
    updateHud(); clearFeedback();
    armed = false;
    currentTrial = { trial: trialIndex, rt: null, outcome: null };
    const isi = ISI_MIN + Math.random() * (ISI_MAX - ISI_MIN);
    timers.isi = setTimeout(soundTone, isi);
  }

  function soundTone(){
    playTone();
    toneTime = performance.now();
    armed = true;
    timers.response = setTimeout(handleTimeout, RESPONSE_WINDOW);
  }

  function handleZoneClick(){
    if (!currentTrial || currentTrial.outcome) return;
    if (!armed){
      clearTimeout(timers.isi);
      currentTrial.outcome = 'early';
      showFeedback('TOO SOON', 'bad');
      settleTrial();
      return;
    }
    const rt = performance.now() - toneTime;
    armed = false; clearTimeout(timers.response);
    currentTrial.rt = rt; currentTrial.outcome = 'correct'; score++;
    showFeedback('CAUGHT IT — ' + fmtMs(rt), 'good');
    settleTrial();
  }

  function handleTimeout(){
    if (!armed) return;
    armed = false;
    currentTrial.outcome = 'timeout';
    showFeedback('MISSED', 'bad');
    settleTrial();
  }

  function settleTrial(){
    results.push(currentTrial);
    updateHud();
    timers.advance = setTimeout(nextTrial, POST_PAUSE);
  }

  function avg(arr){ if (!arr.length) return null; return arr.reduce((a,b) => a+b, 0) / arr.length; }

  function finishRun(){
    armed = false; clearFeedback();
    const correct = results.filter(r => r.outcome === 'correct');
    const errors = results.filter(r => r.outcome !== 'correct');
    const avgRt = avg(correct.map(r => r.rt));
    const accuracy = results.length ? (correct.length / results.length) * 100 : null;

    document.getElementById('audRCorrect').textContent = correct.length + ' / ' + results.length;
    document.getElementById('audRAvgRt').textContent = fmtMs(avgRt);
    document.getElementById('audRErrors').textContent = errors.length;
    document.getElementById('audRAcc').textContent = accuracy === null ? '—' : accuracy.toFixed(0) + '%';

    const bestCorrect = window.KA_records.get('aud_best_correct', null);
    const isNewBest = bestCorrect === null || correct.length > bestCorrect;
    if (isNewBest) window.KA_records.set('aud_best_correct', correct.length);
    window.KA_weekly.record('aud', correct.length);
    document.getElementById('audRBest').textContent = (isNewBest ? correct.length : bestCorrect) + ' / ' + results.length;
    document.getElementById('audRBestRow').classList.toggle('is-new', isNewBest);

    window.KA_scoreRun('aud', 'audResultCard', { accuracyPct: accuracy, avgRt });
    audResultCard.style.display = 'flex';
    runHistory.unshift({ correct: correct.length, errors: errors.length, avgRt, accuracy });
    if (runHistory.length > 6) runHistory.pop();
    renderLog();
    window.KA_history.add('Audio Reflex', `correct ${correct.length}/${results.length} · acc ${accuracy === null ? '—' : accuracy.toFixed(0) + '%'}`);
  }

  function renderLog(){
    audLog.innerHTML = runHistory.map((h, i) =>
      `<span class="entry">Run ${runHistory.length - i} — correct <b>${h.correct}</b> &middot; errors <b>${h.errors}</b> &middot; avg RT <b>${fmtMs(h.avgRt)}</b></span>`
    ).join('<span style="color:var(--grid)">|</span>');
  }

  audZone.addEventListener('pointerdown', handleZoneClick);
  audStartBtn.addEventListener('click', startRun);
  audNextBtn.addEventListener('click', startRun);

  window.audEnterHook = function(){
    clearTimers(); armed = false;
    audStartPanel.style.display = ''; audResultCard.style.display = 'none';
    clearFeedback();
  };
})();
