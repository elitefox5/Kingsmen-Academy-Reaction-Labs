(function(){
  const ZONE_COLORS = {
    yellow:'#ffe066',
    // Was cyan — too easy to mistake for blue under the stim circle's glow, especially on
    // the swatch-less flashing center circle where there's no text label to disambiguate.
    // Black reads unambiguously instead, but needs its own rendering path everywhere below
    // (a black-on-black fill/border would be invisible against the page's black background).
    black:'#000000',
    green:'#3ddc6f',
    red:'#ff5a5a',
    white:'#f2f2ea',
    blue:'#4f8cff',
    orange:'#ff9d4d',
    purple:'#c98bff'
  };
  const ZONE_KEYS = Object.keys(ZONE_COLORS);
  const POSITIONS = ['top', 'bottom', 'left', 'right', 'topLeft', 'topRight', 'bottomLeft', 'bottomRight'];
  const TOTAL_TRIALS = 20;
  const RESPONSE_WINDOW = 1200;
  const ISI_MIN = 500, ISI_MAX = 1200;
  const POST_TRIAL_PAUSE = 350;
  // missPenalty: 3 — a single error backs the response window off 3 step-sizes (225ms)
  // instead of the standard 1-step recovery, so one miss undoes as much difficulty as
  // 3 separate hardening moves (each of which itself takes 2 correct answers to earn).
  const STAIR = { min: 400, max: 1500, step: 75, startAt: 1200, harderIs: 'lower', missPenalty: 3 };
  // Adaptive is never-ending: the staircase keeps adjusting the response window until the
  // player racks up 3 total errors (wrong zone or no response), not a fixed trial count.
  // The threshold/rank scoring itself (stair.result(), KA_ADAPTIVE_RANKS) is unchanged.
  const ADAPTIVE_ERROR_LIMIT = 3;

  const crHud = document.getElementById('crHud');
  const crTrialVal = document.getElementById('crTrialVal');
  const crScoreVal = document.getElementById('crScoreVal');
  const crStreakVal = document.getElementById('crStreakVal');
  const crLivesRow = document.getElementById('crLivesRow');
  const crLivesVal = document.getElementById('crLivesVal');
  const crStim = document.getElementById('crStim');
  const crFeedback = document.getElementById('crFeedback');
  const crStartPanel = document.getElementById('crStartPanel');
  const crStartBtn = document.getElementById('crStartBtn');
  const crResultCard = document.getElementById('crResultCard');
  const crNextBtn = document.getElementById('crNextBtn');
  const crLog = document.getElementById('crLog');
  const crNormalBtn = document.getElementById('crNormalBtn');
  const crHardBtn = document.getElementById('crHardBtn');
  const crAdaptiveBtn = document.getElementById('crAdaptiveBtn');
  let mode = 'normal';
  let switchPoints = [];
  let stair = null;
  let runTotal = TOTAL_TRIALS;
  function setMode(m){
    mode = m;
    crNormalBtn.classList.toggle('selected', m === 'normal');
    crHardBtn.classList.toggle('selected', m === 'hard');
    crAdaptiveBtn.classList.toggle('selected', m === 'adaptive');
  }
  function responseWindow(){ return mode === 'adaptive' ? stair.value : RESPONSE_WINDOW; }
  const zoneEls = {
    top: document.getElementById('crZoneTop'),
    bottom: document.getElementById('crZoneBottom'),
    left: document.getElementById('crZoneLeft'),
    right: document.getElementById('crZoneRight'),
    topLeft: document.getElementById('crZoneTopLeft'),
    topRight: document.getElementById('crZoneTopRight'),
    bottomLeft: document.getElementById('crZoneBottomLeft'),
    bottomRight: document.getElementById('crZoneBottomRight')
  };

  let zoneAssignment = {}; // position -> colorKey
  let trialIndex, score, streak, results, runHistory = [];
  let adErrors = 0;
  let armed = false;
  let appearTime = null;
  let currentTrial = null;
  let timers = {};

  function shuffle(arr){
    const out = arr.slice();
    for (let i = out.length - 1; i > 0; i--){
      const j = Math.floor(Math.random() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }

  function fmtMs(ms){
    if (ms === null || ms === undefined) return '—';
    return ms.toFixed(0) + ' ms';
  }

  function clearTimers(){
    clearTimeout(timers.isi);
    clearTimeout(timers.response);
    clearTimeout(timers.advance);
  }

  function assignZones(){
    const colors = shuffle(ZONE_KEYS);
    POSITIONS.forEach((pos, i) => {
      zoneAssignment[pos] = colors[i];
      const el = zoneEls[pos];
      const key = colors[i];
      const hex = ZONE_COLORS[key];
      el.textContent = key.toUpperCase();
      if (key === 'black'){
        // A solid black tile with a white border/label — deliberately not the same
        // translucent-glow treatment every other zone gets, since that would render as
        // nothing here. Also visually distinct from the actual 'white' zone (glowing
        // translucent box) rather than reading as the same thing.
        el.style.borderColor = '#ffffff';
        el.style.color = '#ffffff';
        el.style.background = '#000000';
      } else {
        el.style.borderColor = hex;
        el.style.color = hex;
        el.style.background = hex + '1a';
      }
    });
  }

  function updateHud(){
    crTrialVal.textContent = mode === 'adaptive' ? String(trialIndex) : (trialIndex + ' / ' + runTotal);
    crScoreVal.textContent = score;
    crStreakVal.textContent = mode === 'adaptive' ? Math.round(stair.value) + ' ms' : streak;
    if (mode === 'adaptive') crLivesVal.textContent = Math.max(0, ADAPTIVE_ERROR_LIMIT - adErrors);
  }

  function clearFeedback(){
    crFeedback.textContent = '';
    crFeedback.className = 'cr-feedback';
  }

  function showFeedback(msg, kind){
    crFeedback.textContent = msg;
    crFeedback.className = 'cr-feedback ' + kind;
  }

  function startRun(){
    trialIndex = 0;
    score = 0;
    streak = 0;
    adErrors = 0;
    results = [];
    armed = false;
    clearTimers();
    assignZones();
    stair = window.KA_makeStaircase(STAIR);
    runTotal = TOTAL_TRIALS;
    switchPoints = mode === 'hard' ? [Math.floor(TOTAL_TRIALS / 3) + 1, Math.floor(TOTAL_TRIALS * 2 / 3) + 1] : [];
    crStreakVal.previousElementSibling.textContent = mode === 'adaptive' ? 'WINDOW' : 'STREAK';
    crLivesRow.style.display = mode === 'adaptive' ? '' : 'none';
    window.KA_setResultMode('crResultCard', mode === 'adaptive');
    crStartPanel.style.display = 'none';
    crResultCard.style.display = 'none';
    crHud.style.display = '';
    clearFeedback();
    crStim.style.display = 'none';
    updateHud();
    nextTrial();
  }

  function nextTrial(){
    // Adaptive has no trial cap — it only ever stops once 3 errors have piled up, handled
    // in settleTrial.
    if (mode !== 'adaptive' && trialIndex >= runTotal){
      finishRun();
      return;
    }
    trialIndex++;
    updateHud();
    clearFeedback();
    crStim.style.display = 'none';

    if (switchPoints.includes(trialIndex)){
      assignZones();
      showFeedback('MAPPING REASSIGNED', 'neutral');
    }

    const position = POSITIONS[Math.floor(Math.random() * POSITIONS.length)];
    const colorKey = zoneAssignment[position];
    currentTrial = { trial: trialIndex, position, colorKey, rt: null, outcome: null };

    const isi = ISI_MIN + Math.random() * (ISI_MAX - ISI_MIN);
    timers.isi = setTimeout(showStim, isi);
  }

  function showStim(){
    const key = currentTrial.colorKey;
    const hex = ZONE_COLORS[key];
    if (key === 'black'){
      // A black fill would otherwise vanish into the page's own black background — the
      // white ring is what actually makes the circle (and its color) visible at all.
      crStim.style.background = '#000000';
      crStim.style.borderColor = '#ffffff';
      crStim.style.boxShadow = '0 0 24px rgba(255,255,255,0.55)';
    } else {
      crStim.style.background = hex;
      crStim.style.borderColor = hex;
      crStim.style.boxShadow = `0 0 30px ${hex}99`;
    }
    crStim.style.display = 'block';
    window.KA_sound.stimulus();
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        appearTime = performance.now();
        armed = true;
        timers.response = setTimeout(handleTimeout, responseWindow());
      });
    });
  }

  function handleZoneClick(position){
    if (!armed) return;
    const rt = window.KA_applyGrace(performance.now() - appearTime);
    armed = false;
    clearTimeout(timers.response);
    crStim.style.display = 'none';

    const el = zoneEls[position];
    if (position === currentTrial.position){
      currentTrial.rt = rt;
      currentTrial.outcome = 'hit';
      score++; streak++;
      showFeedback('CORRECT — ' + fmtMs(rt), 'good');
      el.classList.add('hit-flash');
      setTimeout(() => el.classList.remove('hit-flash'), 200);
    } else {
      currentTrial.outcome = 'wrongZone';
      streak = 0;
      window.KA_sound.error();
      showFeedback('WRONG ZONE', 'bad');
      el.classList.add('miss-flash');
      setTimeout(() => el.classList.remove('miss-flash'), 220);
    }
    settleTrial();
  }

  function handleTimeout(){
    if (!armed) return;
    armed = false;
    crStim.style.display = 'none';
    currentTrial.outcome = 'timeout';
    streak = 0;
    window.KA_sound.error();
    showFeedback('NO RESPONSE', 'bad');
    settleTrial();
  }

  function settleTrial(){
    results.push(currentTrial);
    if (mode === 'adaptive'){
      const hit = currentTrial.outcome === 'hit';
      stair.record(hit);
      if (!hit) adErrors++;
      updateHud();
      if (adErrors >= ADAPTIVE_ERROR_LIMIT){
        timers.advance = setTimeout(finishRun, POST_TRIAL_PAUSE);
        return;
      }
    } else {
      updateHud();
    }
    timers.advance = setTimeout(nextTrial, POST_TRIAL_PAUSE);
  }

  function avg(arr){
    if (!arr.length) return null;
    return arr.reduce((a,b) => a+b, 0) / arr.length;
  }

  function finishRun(){
    crHud.style.display = '';
    clearFeedback();
    crStim.style.display = 'none';

    const hits = results.filter(r => r.outcome === 'hit');
    const errors = results.filter(r => r.outcome === 'wrongZone');
    const timeouts = results.filter(r => r.outcome === 'timeout');

    const avgRt = avg(hits.map(r => r.rt));
    const accuracy = results.length ? (hits.length / results.length) * 100 : null;

    document.getElementById('crRHits').textContent = hits.length + ' / ' + results.length;
    document.getElementById('crRAvgRt').textContent = fmtMs(avgRt);
    document.getElementById('crRErrors').textContent = errors.length;
    document.getElementById('crRMisses').textContent = timeouts.length;
    document.getElementById('crRAcc').textContent = accuracy === null ? '—' : accuracy.toFixed(0) + '%';

    if (mode === 'adaptive'){
      // Difficulty varied per player, so accuracy here isn't comparable to the fixed-trial
      // accuracy+speed rank — this run reports a threshold instead and deliberately stays
      // out of records/weekly, but does get its own ladder (KA_ADAPTIVE_RANKS).
      const threshold = stair.result();
      const { best, isNew } = window.KA_recordThreshold('cr', threshold, 'lower');
      document.getElementById('crRBest').textContent = Math.round(best) + ' ms window';
      document.getElementById('crRBestRow').classList.toggle('is-new', isNew);
      window.KA_renderThreshold('crResultCard', 'Response window held',
        Math.round(threshold) + ' ms  (' + stair.reversalCount() + ' reversals)', isNew);
      window.KA_renderRunRank('crResultCard', { combined: window.KA_getAdaptiveRank('cr', threshold) });
      window.KA_setResultModeRanked('crResultCard');
      window.KA_history.add('Choice Reaction', `adaptive · window ${Math.round(threshold)} ms`);
    } else {
      const bestCorrect = window.KA_records.get('cr_best_correct', null);
      const isNewBest = bestCorrect === null || hits.length > bestCorrect;
      if (isNewBest) window.KA_records.set('cr_best_correct', hits.length);
      window.KA_weekly.record('cr', hits.length);
      document.getElementById('crRBest').textContent = (isNewBest ? hits.length : bestCorrect) + ' / ' + results.length;
      document.getElementById('crRBestRow').classList.toggle('is-new', isNewBest);
      window.KA_scoreRun('cr', 'crResultCard', { accuracyPct: accuracy, avgRt, mode });
      window.KA_setResultMode('crResultCard', false);
      window.KA_history.add('Choice Reaction', `correct ${hits.length}/${results.length} · acc ${accuracy === null ? '—' : accuracy.toFixed(0) + '%'}`);
    }
    crResultCard.style.display = 'flex';

    runHistory.unshift({ hits: hits.length, errors: errors.length, timeouts: timeouts.length, avgRt, accuracy });
    if (runHistory.length > 6) runHistory.pop();
    renderLog();
  }

  function renderLog(){
    crLog.innerHTML = runHistory.map((h, i) =>
      `<span class="entry">Run ${runHistory.length - i} — correct <b>${h.hits}</b> &middot; wrong zone <b>${h.errors}</b> &middot; no-response <b>${h.timeouts}</b> &middot; avg RT <b>${fmtMs(h.avgRt)}</b> &middot; acc <b>${h.accuracy === null ? '—' : h.accuracy.toFixed(0) + '%'}</b></span>`
    ).join('<span style="color:var(--grid)">|</span>');
  }

  POSITIONS.forEach(pos => {
    zoneEls[pos].addEventListener('pointerdown', () => handleZoneClick(pos));
  });
  crStartBtn.addEventListener('click', startRun);
  crNextBtn.addEventListener('click', startRun);
  crNormalBtn.addEventListener('click', () => setMode('normal'));
  crHardBtn.addEventListener('click', () => setMode('hard'));
  crAdaptiveBtn.addEventListener('click', () => setMode('adaptive'));

  window.crEnterHook = function(){
    clearTimers();
    armed = false;
    crStim.style.display = 'none';
    crStartPanel.style.display = '';
    crResultCard.style.display = 'none';
    crHud.style.display = 'none';
    clearFeedback();
  };
})();
