(function(){
  const PADS = ['green', 'red', 'blue', 'yellow'];
  const padEls = {
    green: document.getElementById('simPadGreen'),
    red: document.getElementById('simPadRed'),
    blue: document.getElementById('simPadBlue'),
    yellow: document.getElementById('simPadYellow')
  };
  const simStartPanel = document.getElementById('simStartPanel');
  const simStartBtn = document.getElementById('simStartBtn');
  const simResultCard = document.getElementById('simResultCard');
  const simNextBtn = document.getElementById('simNextBtn');
  const simRoundVal = document.getElementById('simRoundVal');
  const simStateVal = document.getElementById('simStateVal');
  const simFeedback = document.getElementById('simFeedback');
  const simLog = document.getElementById('simLog');

  let sequence = [];
  let playerIndex = 0;
  let correctClicks = 0;
  let accepting = false;
  let runHistory = [];
  let timers = {};

  function clearTimers(){ Object.keys(timers).forEach(k => clearTimeout(timers[k])); timers = {}; }
  function clearFeedback(){ simFeedback.textContent = ''; simFeedback.className = 'game-feedback'; }
  function showFeedback(msg, kind){ simFeedback.textContent = msg; simFeedback.className = 'game-feedback ' + kind; }

  function lightPad(color, duration){
    return new Promise(resolve => {
      padEls[color].classList.add('lit');
      timers.lit = setTimeout(() => {
        padEls[color].classList.remove('lit');
        timers.gap = setTimeout(resolve, 150);
      }, duration);
    });
  }

  async function playSequence(){
    accepting = false;
    simStateVal.textContent = 'WATCH';
    for (const color of sequence){
      await lightPad(color, 500);
    }
    playerIndex = 0;
    accepting = true;
    simStateVal.textContent = 'YOUR TURN';
  }

  function startRun(){
    sequence = [];
    correctClicks = 0;
    playerIndex = 0;
    accepting = false;
    clearTimers();
    simStartPanel.style.display = 'none';
    simResultCard.style.display = 'none';
    clearFeedback();
    simRoundVal.textContent = '0';
    nextRound();
  }

  function nextRound(){
    sequence.push(PADS[Math.floor(Math.random() * PADS.length)]);
    simRoundVal.textContent = sequence.length;
    clearFeedback();
    timers.start = setTimeout(playSequence, 500);
  }

  function handlePadClick(color){
    if (!accepting) return;
    if (color === sequence[playerIndex]){
      correctClicks++;
      playerIndex++;
      if (playerIndex >= sequence.length){
        accepting = false;
        showFeedback('CORRECT — NEXT ROUND', 'good');
        timers.advance = setTimeout(nextRound, 700);
      }
    } else {
      accepting = false;
      showFeedback('WRONG PAD', 'bad');
      finishRun();
    }
  }

  function finishRun(){
    simStateVal.textContent = 'DONE';
    const reached = Math.max(0, sequence.length - 1);
    document.getElementById('simRRounds').textContent = reached;
    document.getElementById('simRCorrect').textContent = correctClicks;

    const bestRounds = window.KA_records.get('sim_best_rounds', null);
    const isNewBest = bestRounds === null || reached > bestRounds;
    if (isNewBest) window.KA_records.set('sim_best_rounds', reached);
    window.KA_weekly.record('sim', reached);
    document.getElementById('simRBest').textContent = isNewBest ? reached : bestRounds;
    document.getElementById('simRBestRow').classList.toggle('is-new', isNewBest);

    window.KA_renderRunRank('simResultCard', window.KA_getRoundsRank(reached));
    simResultCard.style.display = 'flex';

    runHistory.unshift({ rounds: reached, correct: correctClicks });
    if (runHistory.length > 6) runHistory.pop();
    renderLog();
    window.KA_history.add('Simon Sequence', `reached ${reached} · correct clicks ${correctClicks}`);
  }

  function renderLog(){
    simLog.innerHTML = runHistory.map((h, i) =>
      `<span class="entry">Run ${runHistory.length - i} — reached <b>${h.rounds}</b> &middot; correct clicks <b>${h.correct}</b></span>`
    ).join('<span style="color:var(--grid)">|</span>');
  }

  Object.keys(padEls).forEach(color => {
    padEls[color].addEventListener('click', () => handlePadClick(color));
  });
  simStartBtn.addEventListener('click', startRun);
  simNextBtn.addEventListener('click', startRun);

  window.simEnterHook = function(){
    clearTimers();
    accepting = false;
    simStartPanel.style.display = '';
    simResultCard.style.display = 'none';
    clearFeedback();
    simRoundVal.textContent = '0';
    simStateVal.textContent = '—';
  };
})();
