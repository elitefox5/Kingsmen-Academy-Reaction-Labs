(function(){
  const TOTAL_TRIALS = 20;
  const RESPONSE_WINDOW = 800;
  const ISI_MIN = 1000, ISI_MAX = 4000; // wide, unpredictable wait so the onset can't be timed
  const POST_PAUSE = 400;

  const bfxZone = document.getElementById('bfxZone');
  const bfxFeedback = document.getElementById('bfxFeedback');
  const bfxStartPanel = document.getElementById('bfxStartPanel');
  const bfxStartBtn = document.getElementById('bfxStartBtn');
  const bfxResultCard = document.getElementById('bfxResultCard');
  const bfxNextBtn = document.getElementById('bfxNextBtn');
  const bfxLog = document.getElementById('bfxLog');
  const bfxTrialVal = document.getElementById('bfxTrialVal');
  const bfxAvgVal = document.getElementById('bfxAvgVal');

  let trialIndex, results, runHistory = [];
  let armed = false, appearTime = null, currentTrial = null, timers = {};

  function fmtMs(ms){ if (ms === null || ms === undefined) return '—'; return ms.toFixed(0) + ' ms'; }
  function clearTimers(){ clearTimeout(timers.isi); clearTimeout(timers.response); clearTimeout(timers.advance); }
  function clearFeedback(){ bfxFeedback.textContent = ''; bfxFeedback.className = 'game-feedback'; }
  function showFeedback(msg, kind){ bfxFeedback.textContent = msg; bfxFeedback.className = 'game-feedback ' + kind; }
  function avg(arr){ if (!arr.length) return null; return arr.reduce((a,b) => a+b, 0) / arr.length; }
  function updateHud(){
    bfxTrialVal.textContent = trialIndex + ' / ' + TOTAL_TRIALS;
    const correctSoFar = results.filter(r => r.outcome === 'correct').map(r => r.rt);
    bfxAvgVal.textContent = fmtMs(avg(correctSoFar));
  }

  function startRun(){
    trialIndex = 0; results = []; armed = false; clearTimers();
    bfxStartPanel.style.display = 'none'; bfxResultCard.style.display = 'none';
    clearFeedback(); bfxZone.classList.remove('go'); bfxZone.textContent = 'WAIT';
    updateHud();
    nextTrial();
  }

  function nextTrial(){
    if (trialIndex >= TOTAL_TRIALS){ finishRun(); return; }
    trialIndex++;
    updateHud(); clearFeedback();
    armed = false;
    bfxZone.classList.remove('go'); bfxZone.textContent = 'WAIT';
    currentTrial = { trial: trialIndex, rt: null, outcome: null };
    const isi = ISI_MIN + Math.random() * (ISI_MAX - ISI_MIN);
    timers.isi = setTimeout(showGo, isi);
  }

  function showGo(){
    // Two nested rAFs: the first runs right before the browser paints the color change,
    // the second only fires once that paint has actually completed — so the clock starts
    // when the frame was presented, not just when we asked the browser to draw it.
    requestAnimationFrame(() => {
      bfxZone.classList.add('go'); bfxZone.textContent = 'CLICK!';
      window.KA_sound.stimulus();
      // Arm immediately with a provisional timestamp. Without this there's a ~1 frame
      // window where the green is already on screen but a press would be judged a false
      // start. rAF #2 then replaces it with the true presentation time.
      appearTime = performance.now();
      armed = true;
      requestAnimationFrame(() => {
        appearTime = performance.now();
        timers.response = setTimeout(handleTimeout, RESPONSE_WINDOW);
      });
    });
  }

  function handleZoneClick(){
    if (!currentTrial || currentTrial.outcome) return;
    if (!armed){
      clearTimeout(timers.isi);
      currentTrial.outcome = 'early';
      window.KA_sound.error();
      showFeedback('TOO SOON', 'bad');
      settleTrial();
      return;
    }
    const rt = window.KA_applyGrace(performance.now() - appearTime);
    armed = false; clearTimeout(timers.response);
    bfxZone.classList.remove('go'); bfxZone.textContent = 'WAIT';
    currentTrial.rt = rt; currentTrial.outcome = 'correct';
    showFeedback(fmtMs(rt), 'good');
    settleTrial();
  }

  function handleTimeout(){
    if (!armed) return;
    armed = false;
    bfxZone.classList.remove('go'); bfxZone.textContent = 'WAIT';
    currentTrial.outcome = 'timeout';
    window.KA_sound.error();
    showFeedback('MISSED', 'bad');
    settleTrial();
  }

  function settleTrial(){
    results.push(currentTrial);
    updateHud();
    timers.advance = setTimeout(nextTrial, POST_PAUSE);
  }

  function finishRun(){
    armed = false; clearFeedback(); bfxZone.classList.remove('go'); bfxZone.textContent = 'WAIT';
    const correct = results.filter(r => r.outcome === 'correct');
    const errors = results.filter(r => r.outcome !== 'correct');
    const avgRt = avg(correct.map(r => r.rt));

    document.getElementById('bfxRAvgRt').textContent = fmtMs(avgRt);
    document.getElementById('bfxRErrors').textContent = errors.length;

    const rank = avgRt === null ? null : window.KA_getRank(avgRt);
    const rankLabel = document.getElementById('bfxRRank');
    rankLabel.textContent = rank ? rank.name.toUpperCase() : '—';
    rankLabel.style.color = rank ? rank.color : '';

    let isNewBest = false;
    if (avgRt !== null){
      const best = window.KA_records.get('rank_best_avg_rt', null);
      isNewBest = best === null || avgRt < best;
      if (isNewBest) window.KA_records.set('rank_best_avg_rt', avgRt, false);
      document.getElementById('bfxRBest').textContent = fmtMs(isNewBest ? avgRt : best);
    } else {
      document.getElementById('bfxRBest').textContent = fmtMs(window.KA_records.get('rank_best_avg_rt', null));
    }
    document.getElementById('bfxRBestRow').classList.toggle('is-new', isNewBest);

    bfxResultCard.style.display = 'flex';
    runHistory.unshift({ avgRt, errors: errors.length, rank: rank ? rank.name : null });
    if (runHistory.length > 6) runHistory.pop();
    renderLog();
    window.KA_history.add('Base Reflex', `avg ${fmtMs(avgRt)} · rank ${rank ? rank.name : '—'}`);

    if (typeof window.__onRankTestComplete === 'function') window.__onRankTestComplete();
  }

  function renderLog(){
    bfxLog.innerHTML = runHistory.map((h, i) =>
      `<span class="entry">Run ${runHistory.length - i} — avg <b>${fmtMs(h.avgRt)}</b> &middot; errors <b>${h.errors}</b> &middot; rank <b>${h.rank || '—'}</b></span>`
    ).join('<span style="color:var(--grid)">|</span>');
  }

  bfxZone.addEventListener('pointerdown', handleZoneClick);
  bfxStartBtn.addEventListener('click', startRun);
  bfxNextBtn.addEventListener('click', startRun);

  window.bfxEnterHook = function(){
    clearTimers(); armed = false; bfxZone.classList.remove('go'); bfxZone.textContent = 'WAIT';
    bfxStartPanel.style.display = ''; bfxResultCard.style.display = 'none';
    clearFeedback();
  };
})();
