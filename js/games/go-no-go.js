(function(){
  const GO_COLORS = {
    yellow:'#ffe066',
    pink:'#ff6b9d',
    green:'#3ddc6f',
    red:'#ff5a5a',
    white:'#f2f2ea',
    blue:'#4f8cff'
  };
  const COLOR_KEYS = Object.keys(GO_COLORS);
  const TOTAL_TRIALS = 20;
  const GO_PROB = 0.6;
  const RESPONSE_WINDOW = 600; // ms a color stays up before a go trial counts as a miss / a no-go counts as held
  const ISI_MIN = 300, ISI_MAX = 2000; // blank gap between trials
  const POST_TRIAL_PAUSE = 350;

  function pickRandomColor(exclude){
    const options = exclude ? COLOR_KEYS.filter(c => c !== exclude) : COLOR_KEYS;
    return options[Math.floor(Math.random() * options.length)];
  }

  const gngHud = document.getElementById('gngHud');
  const gngRuleVal = document.getElementById('gngRuleVal');
  const gngTrialVal = document.getElementById('gngTrialVal');
  const gngScoreVal = document.getElementById('gngScoreVal');
  const gngStreakVal = document.getElementById('gngStreakVal');
  const gngRuleBanner = document.getElementById('gngRuleBanner');
  const gngRuleColorText = document.getElementById('gngRuleColorText');
  const gngStim = document.getElementById('gngStim');
  const gngFeedback = document.getElementById('gngFeedback');
  const gngStartPanel = document.getElementById('gngStartPanel');
  const gngStartBtn = document.getElementById('gngStartBtn');
  const gngResultCard = document.getElementById('gngResultCard');
  const gngNextBtn = document.getElementById('gngNextBtn');
  const gngLog = document.getElementById('gngLog');

  let ruleGoColor, trialIndex, score, streak, trialsSinceSwitch, nextSwitchAt;
  let results, runHistory = [];
  let waitingResponse = false;
  let stimAppearTime = null;
  let currentTrial = null;
  let timers = {};

  function fmtMs(ms){
    if (ms === null || ms === undefined) return '—';
    return ms.toFixed(0) + ' ms';
  }

  function resetState(){
    ruleGoColor = pickRandomColor();
    trialIndex = 0;
    score = 0;
    streak = 0;
    trialsSinceSwitch = 0;
    nextSwitchAt = 8 + Math.floor(Math.random() * 5);
    results = [];
    waitingResponse = false;
    clearTimers();
  }

  function clearTimers(){
    clearTimeout(timers.isi);
    clearTimeout(timers.response);
    clearTimeout(timers.advance);
  }

  function updateHud(){
    gngRuleVal.textContent = ruleGoColor.toUpperCase();
    gngTrialVal.textContent = trialIndex + ' / ' + TOTAL_TRIALS;
    gngScoreVal.textContent = score;
    gngStreakVal.textContent = streak;
  }

  function updateRuleBanner(flash){
    gngRuleColorText.textContent = ruleGoColor.toUpperCase();
    gngRuleColorText.style.color = GO_COLORS[ruleGoColor];
    if (flash){
      gngRuleBanner.classList.remove('switch-flash');
      void gngRuleBanner.offsetWidth;
      gngRuleBanner.classList.add('switch-flash');
    }
  }

  function clearFeedback(){
    gngFeedback.textContent = '';
    gngFeedback.className = 'gng-feedback';
  }

  function showFeedback(msg, kind){
    gngFeedback.textContent = msg;
    gngFeedback.className = 'gng-feedback ' + kind;
  }

  function startRun(){
    resetState();
    gngStartPanel.style.display = 'none';
    gngResultCard.style.display = 'none';
    gngHud.style.display = '';
    gngRuleBanner.classList.add('live');
    clearFeedback();
    updateRuleBanner(false);
    updateHud();
    nextTrial();
  }

  function nextTrial(){
    if (trialIndex >= TOTAL_TRIALS){
      finishRun();
      return;
    }
    trialIndex++;

    let afterSwitch = false;
    if (trialsSinceSwitch >= nextSwitchAt){
      ruleGoColor = pickRandomColor(ruleGoColor);
      trialsSinceSwitch = 0;
      nextSwitchAt = 8 + Math.floor(Math.random() * 5);
      afterSwitch = true;
      updateRuleBanner(true);
    }
    trialsSinceSwitch++;

    updateHud();
    clearFeedback();
    gngStim.style.display = 'none';

    const isi = ISI_MIN + Math.random() * (ISI_MAX - ISI_MIN);
    timers.isi = setTimeout(() => showStim(afterSwitch), isi);
  }

  function showStim(afterSwitch){
    const isGo = Math.random() < GO_PROB;
    const stimColor = isGo ? ruleGoColor : pickRandomColor(ruleGoColor);

    currentTrial = { trial: trialIndex, rule: ruleGoColor, color: stimColor, isGo, afterSwitch, rt: null, outcome: null };

    gngStim.style.background = GO_COLORS[stimColor];
    gngStim.style.borderColor = GO_COLORS[stimColor];
    gngStim.style.boxShadow = `0 0 36px ${GO_COLORS[stimColor]}99`;
    gngStim.style.display = 'block';
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        stimAppearTime = performance.now();
        waitingResponse = true;
        timers.response = setTimeout(handleTimeout, RESPONSE_WINDOW);
      });
    });
  }

  function handleStimClick(){
    if (!waitingResponse) return;
    const rt = performance.now() - stimAppearTime;
    waitingResponse = false;
    clearTimeout(timers.response);
    gngStim.style.display = 'none';

    if (currentTrial.isGo){
      currentTrial.rt = rt;
      currentTrial.outcome = 'hit';
      score++;
      streak++;
      showFeedback('HIT — ' + fmtMs(rt), 'good');
    } else {
      currentTrial.outcome = 'falseAlarm';
      score = Math.max(0, score - 1);
      streak = 0;
      showFeedback('FALSE ALARM', 'bad');
    }
    settleTrial();
  }

  function handleTimeout(){
    if (!waitingResponse) return;
    waitingResponse = false;
    gngStim.style.display = 'none';

    if (currentTrial.isGo){
      currentTrial.outcome = 'miss';
      streak = 0;
      showFeedback('MISS', 'bad');
    } else {
      currentTrial.outcome = 'correctReject';
      streak++;
      showFeedback('HELD', 'good');
    }
    settleTrial();
  }

  function settleTrial(){
    results.push(currentTrial);
    updateHud();
    timers.advance = setTimeout(nextTrial, POST_TRIAL_PAUSE);
  }

  function avg(arr){
    if (!arr.length) return null;
    return arr.reduce((a,b) => a+b, 0) / arr.length;
  }

  function finishRun(){
    gngHud.style.display = '';
    gngRuleBanner.classList.remove('live');
    clearFeedback();

    const hits = results.filter(r => r.outcome === 'hit');
    const misses = results.filter(r => r.outcome === 'miss');
    const falseAlarms = results.filter(r => r.outcome === 'falseAlarm');
    const correctRejects = results.filter(r => r.outcome === 'correctReject');

    const avgRt = avg(hits.map(r => r.rt));
    const accuracy = results.length ? ((hits.length + correctRejects.length) / results.length) * 100 : null;

    const switchHits = hits.filter(r => r.afterSwitch).map(r => r.rt);
    const steadyHits = hits.filter(r => !r.afterSwitch).map(r => r.rt);
    const switchAvg = avg(switchHits);
    const steadyAvg = avg(steadyHits);
    const switchCost = (switchAvg !== null && steadyAvg !== null) ? switchAvg - steadyAvg : null;

    document.getElementById('gngROverall').textContent = (hits.length + correctRejects.length) + ' / ' + results.length;
    document.getElementById('gngRHits').textContent = hits.length + ' / ' + (hits.length + misses.length);
    document.getElementById('gngRAvgRt').textContent = fmtMs(avgRt);
    document.getElementById('gngRMisses').textContent = misses.length;
    document.getElementById('gngRFalse').textContent = falseAlarms.length + ' / ' + (falseAlarms.length + correctRejects.length);
    document.getElementById('gngRAcc').textContent = accuracy === null ? '—' : accuracy.toFixed(0) + '%';
    document.getElementById('gngRSwitchCost').textContent = switchCost === null ? '—' : (switchCost >= 0 ? '+' : '') + switchCost.toFixed(0) + ' ms';

    const overallCorrect = hits.length + correctRejects.length;
    const bestCorrect = window.KA_records.get('gng_best_correct', null);
    const isNewBest = bestCorrect === null || overallCorrect > bestCorrect;
    if (isNewBest) window.KA_records.set('gng_best_correct', overallCorrect);
    window.KA_weekly.record('gng', overallCorrect);
    document.getElementById('gngRBest').textContent = (isNewBest ? overallCorrect : bestCorrect) + ' / ' + results.length;
    document.getElementById('gngRBestRow').classList.toggle('is-new', isNewBest);

    window.KA_scoreRun('gng', 'gngResultCard', { accuracyPct: accuracy, avgRt });
    gngResultCard.style.display = 'flex';

    runHistory.unshift({ hits: hits.length, misses: misses.length, falseAlarms: falseAlarms.length, avgRt, accuracy });
    if (runHistory.length > 6) runHistory.pop();
    renderLog();
    window.KA_history.add('Go / No-Go', `hits ${hits.length} · misses ${misses.length} · false alarms ${falseAlarms.length} · acc ${accuracy === null ? '—' : accuracy.toFixed(0) + '%'}`);
  }

  function renderLog(){
    gngLog.innerHTML = runHistory.map((h, i) =>
      `<span class="entry">Run ${runHistory.length - i} — hits <b>${h.hits}</b> &middot; misses <b>${h.misses}</b> &middot; false alarms <b>${h.falseAlarms}</b> &middot; avg RT <b>${fmtMs(h.avgRt)}</b> &middot; acc <b>${h.accuracy === null ? '—' : h.accuracy.toFixed(0) + '%'}</b></span>`
    ).join('<span style="color:var(--grid)">|</span>');
  }

  gngStim.addEventListener('pointerdown', handleStimClick);
  gngStartBtn.addEventListener('click', startRun);
  gngNextBtn.addEventListener('click', startRun);

  window.gngEnterHook = function(){
    clearTimers();
    waitingResponse = false;
    gngStim.style.display = 'none';
    gngStartPanel.style.display = '';
    gngResultCard.style.display = 'none';
    gngHud.style.display = 'none';
    gngRuleBanner.classList.remove('live');
    clearFeedback();
  };
})();
