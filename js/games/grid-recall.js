(function(){
  const CELLS = 9;
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
    flashPicked(index);
    if (index === sequence[playerIndex]){
      correctClicks++;
      playerIndex++;
      if (playerIndex >= sequence.length){
        accepting = false;
        showFeedback('CORRECT — NEXT ROUND', 'good');
        timers.advance = setTimeout(nextRound, 700);
      }
    } else {
      accepting = false;
      showFeedback('WRONG CELL', 'bad');
      finishRun();
    }
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
