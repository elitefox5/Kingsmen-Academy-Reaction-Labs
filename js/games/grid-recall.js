(function(){
  const CELLS = 9;
  // Per-click deadline during playback of your own answer — without this, nothing stops a
  // player from recording the WATCH phase and then taking as long as they want between clicks
  // to go check the recording before every single cell, which turns the whole drill into
  // transcription instead of memory. Resets on every correct click, so sequence length never
  // makes it harsher — it's purely "recall and click now," not "recall the whole thing fast."
  // The very first click gets longer (5s) since it's also the WATCH-to-YOUR TURN reaction
  // gear-shift, not just recall; every click after that only needs recall, so it drops to 2s.
  const FIRST_RESPONSE_WINDOW = 5000;
  const RESPONSE_WINDOW = 2000;
  const grdGrid = document.getElementById('grdGrid');
  const cellEls = [];
  for (let i = 0; i < CELLS; i++){
    const c = document.createElement('div');
    c.className = 'grd-cell';
    c.dataset.index = i;
    grdGrid.appendChild(c);
    cellEls.push(c);
  }

  const grdStartPanel = document.getElementById('grdStartPanel');
  const grdStartBtn = document.getElementById('grdStartBtn');
  const grdResultCard = document.getElementById('grdResultCard');
  const grdNextBtn = document.getElementById('grdNextBtn');
  const grdRoundVal = document.getElementById('grdRoundVal');
  const grdStateVal = document.getElementById('grdStateVal');
  const grdFeedback = document.getElementById('grdFeedback');
  const grdLog = document.getElementById('grdLog');

  let sequence = [];
  let playerIndex = 0;
  let correctClicks = 0;
  let accepting = false;
  let runHistory = [];
  let timers = {};

  function clearTimers(){ Object.keys(timers).forEach(k => clearTimeout(timers[k])); timers = {}; }
  function clearFeedback(){ grdFeedback.textContent = ''; grdFeedback.className = 'game-feedback'; }
  function showFeedback(msg, kind){ grdFeedback.textContent = msg; grdFeedback.className = 'game-feedback ' + kind; }

  function lightCell(index, duration){
    return new Promise(resolve => {
      cellEls[index].classList.add('lit');
      window.KA_sound.memoryShow();
      timers.lit = setTimeout(() => {
        cellEls[index].classList.remove('lit');
        timers.gap = setTimeout(resolve, 150);
      }, duration);
    });
  }

  async function playSequence(){
    accepting = false;
    grdStateVal.textContent = 'WATCH';
    for (const index of sequence){
      await lightCell(index, 500);
    }
    playerIndex = 0;
    accepting = true;
    grdStateVal.textContent = 'YOUR TURN';
    timers.response = setTimeout(handleResponseTimeout, FIRST_RESPONSE_WINDOW);
  }

  function startRun(){
    sequence = [];
    correctClicks = 0;
    playerIndex = 0;
    accepting = false;
    clearTimers();
    grdStartPanel.style.display = 'none';
    grdResultCard.style.display = 'none';
    clearFeedback();
    grdRoundVal.textContent = '0';
    nextRound();
  }

  function nextRound(){
    sequence.push(Math.floor(Math.random() * CELLS));
    grdRoundVal.textContent = sequence.length;
    clearFeedback();
    timers.start = setTimeout(playSequence, 500);
  }

  // Brief confirmation flash so you can always tell your own click landed,
  // in a paler shade than the sequence playback uses.
  function flashPicked(index){
    const cell = cellEls[index];
    cell.classList.add('picked');
    setTimeout(() => cell.classList.remove('picked'), 150);
  }

  function handleCellClick(index){
    if (!accepting) return;
    clearTimeout(timers.response);
    flashPicked(index);
    if (index === sequence[playerIndex]){
      window.KA_sound.memoryClick();
      correctClicks++;
      playerIndex++;
      if (playerIndex >= sequence.length){
        accepting = false;
        showFeedback('CORRECT — NEXT ROUND', 'good');
        timers.advance = setTimeout(nextRound, 700);
      } else {
        timers.response = setTimeout(handleResponseTimeout, RESPONSE_WINDOW);
      }
    } else {
      accepting = false;
      window.KA_sound.error();
      showFeedback('WRONG CELL', 'bad');
      finishRun();
    }
  }

  function handleResponseTimeout(){
    if (!accepting) return;
    accepting = false;
    window.KA_sound.error();
    showFeedback('TOO SLOW', 'bad');
    finishRun();
  }

  function finishRun(){
    grdStateVal.textContent = 'DONE';
    const reached = Math.max(0, sequence.length - 1);
    document.getElementById('grdRRounds').textContent = reached;
    document.getElementById('grdRCorrect').textContent = correctClicks;

    const bestRounds = window.KA_records.get('grd_best_rounds', null);
    const isNewBest = bestRounds === null || reached > bestRounds;
    if (isNewBest) window.KA_records.set('grd_best_rounds', reached);
    window.KA_weekly.record('grd', reached);
    document.getElementById('grdRBest').textContent = isNewBest ? reached : bestRounds;
    document.getElementById('grdRBestRow').classList.toggle('is-new', isNewBest);

    window.KA_renderRunRank('grdResultCard', window.KA_getRoundsRank(reached));
    grdResultCard.style.display = 'flex';

    runHistory.unshift({ rounds: reached, correct: correctClicks });
    if (runHistory.length > 6) runHistory.pop();
    renderLog();
    window.KA_history.add('Grid Recall', `reached ${reached} · correct clicks ${correctClicks}`);
  }

  function renderLog(){
    grdLog.innerHTML = runHistory.map((h, i) =>
      `<span class="entry">Run ${runHistory.length - i} — reached <b>${h.rounds}</b> &middot; correct clicks <b>${h.correct}</b></span>`
    ).join('<span style="color:var(--grid)">|</span>');
  }

  cellEls.forEach((cell, index) => cell.addEventListener('pointerdown', () => handleCellClick(index)));
  grdStartBtn.addEventListener('click', startRun);
  grdNextBtn.addEventListener('click', startRun);

  window.grdEnterHook = function(){
    clearTimers();
    accepting = false;
    cellEls.forEach(c => c.classList.remove('lit', 'picked'));
    grdStartPanel.style.display = '';
    grdResultCard.style.display = 'none';
    clearFeedback();
    grdRoundVal.textContent = '0';
    grdStateVal.textContent = '—';
  };
})();
