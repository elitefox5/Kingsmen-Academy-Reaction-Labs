(function(){
  const playfield = document.getElementById('playfield');
  const cue = document.getElementById('cue');
  const startPanel = document.getElementById('startPanel');
  const stageLabel = document.getElementById('stageLabel');
  const startBtn = document.getElementById('startBtn');
  const resultCard = document.getElementById('resultCard');
  const nextBtn = document.getElementById('nextBtn');
  const logEl = document.getElementById('log');

  const reflexCircle = document.getElementById('reflexCircle');
  const rcLabel = document.getElementById('rcLabel');
  const ball = document.getElementById('ball');
  const targetB = document.getElementById('targetB');

  const hudA = document.getElementById('hudA');
  const hudBmove = document.getElementById('hudBmove');
  const hudBaim = document.getElementById('hudBaim');
  const hudBclick = document.getElementById('hudBclick');
  const hudCmove = document.getElementById('hudCmove');
  const hudCaim = document.getElementById('hudCaim');
  const hudCclick = document.getElementById('hudCclick');
  const hudBdev = document.getElementById('hudBdev');
  const hudCdev = document.getElementById('hudCdev');
  const rowA = document.getElementById('rowA');
  const rowBmove = document.getElementById('rowBmove');
  const rowBaim = document.getElementById('rowBaim');
  const rowBclick = document.getElementById('rowBclick');
  const rowCmove = document.getElementById('rowCmove');
  const rowCaim = document.getElementById('rowCaim');
  const rowCclick = document.getElementById('rowCclick');
  const rowBdev = document.getElementById('rowBdev');
  const rowCdev = document.getElementById('rowCdev');

  const MIN_MOVE_DIST = 12; // raised from 3px — small values pick up click recoil/sensor noise, not real movement
  const ANGLE_THRESHOLD_DEG = 10; // how tight your movement direction must be toward the target to count as "aimed"

  function angleBetween(v1, v2){
    const dot = v1.x*v2.x + v1.y*v2.y;
    const m1 = Math.hypot(v1.x, v1.y);
    const m2 = Math.hypot(v2.x, v2.y);
    if (m1 === 0 || m2 === 0) return 180;
    let cos = dot/(m1*m2);
    cos = Math.max(-1, Math.min(1, cos));
    return Math.acos(cos) * 180 / Math.PI;
  }

  let trial = 0;
  let lastMousePos = null;
  let history = [];

  // per-trial data
  let data = {};
  let greenTimer = null;
  let greenLive = false;
  let greenAppearTime = null;

  function fmt(ms){
    if (ms === null || ms === undefined) return '—';
    return ms.toFixed(0) + ' ms';
  }

  // Lower-is-better personal best: persists via localStorage, updates the given
  // elements in place, and flags a new record when this trial beats the stored one.
  function updateBestMetric(key, value, valEl, rowEl){
    if (value === null || value === undefined) return;
    const best = window.KA_records.get(key, null);
    const isNew = best === null || value < best;
    if (isNew) window.KA_records.set(key, value, false);
    valEl.textContent = fmt(isNew ? value : best);
    rowEl.classList.toggle('is-new', isNew);
  }

  function setAimResult(el, ms){
    if (ms === null || ms === undefined){
      el.textContent = 'FAIL';
      el.classList.add('fail');
    } else {
      el.textContent = fmt(ms);
      el.classList.remove('fail');
    }
  }

  function setActiveRow(row){
    [rowA, rowBmove, rowBaim, rowBclick, rowBdev, rowCmove, rowCaim, rowCclick, rowCdev].forEach(r => r.classList.remove('active'));
    if (row) row.classList.add('active');
  }

  function resetHud(){
    hudA.textContent = '—';
    hudBmove.textContent = '—';
    hudBaim.textContent = '—';
    hudBclick.textContent = '—';
    hudCmove.textContent = '—';
    hudCaim.textContent = '—';
    hudCclick.textContent = '—';
    hudBdev.textContent = '—';
    hudCdev.textContent = '—';
    setActiveRow(null);
  }

  function randomPos(marginX, marginTop, marginBottom){
    const w = playfield.clientWidth;
    const h = playfield.clientHeight;
    const x = marginX + Math.random() * (w - marginX*2);
    const y = marginTop + Math.random() * (h - marginTop - marginBottom);
    return {x, y};
  }

  function spawnTrail(x, y){
    const dot = document.createElement('div');
    dot.className = 'trail';
    dot.style.left = x + 'px';
    dot.style.top = y + 'px';
    playfield.appendChild(dot);
    setTimeout(() => dot.remove(), 400);
  }

  /* ---------- Trial lifecycle ---------- */

  function beginTrial(){
    trial++;
    data = { A: null, Bmove: null, Baim: null, Bclick: null, Bdev: null, Cmove: null, Caim: null, Cclick: null, Cdev: null };
    resetHud();
    resultCard.style.display = 'none';
    startPanel.style.display = 'none';
    ball.style.display = 'none';
    targetB.style.display = 'none';
    ball.classList.remove('armed');
    targetB.classList.remove('armed');
    document.getElementById('hud').style.display = 'none';
    hideGuideLine();
    clearDecoys();

    startStageA();
  }

  /* ---------- Stage A: color reaction (single target, colored) ---------- */

  let waitingForClick = false;
  let countdownArmed = false;
  const CIRCLE_RADIUS = 58; // slightly under the 60px visual radius, so you must be solidly inside

  const COLOR_PALETTE = [
    { name:'amber',  hex:'#ffb000' },
    { name:'cyan',   hex:'#4fd1c5' },
    { name:'pink',   hex:'#ff6b9d' },
    { name:'green',  hex:'#3ddc6f' },
    { name:'purple', hex:'#c98bff' }
  ];

  let trialColor = null; // this trial's reaction color — shared by stages A, B, and C

  function circleCenter(){
    const r = reflexCircle.getBoundingClientRect();
    return { x: r.left + r.width/2, y: r.top + r.height/2 };
  }

  // Paints an SVG target's ring(s)/core to match the trial's reaction color.
  function applyThemeColor(container, hex){
    container.querySelectorAll('.ring').forEach(el => el.style.stroke = hex);
    const core = container.querySelector('.core');
    if (core){
      core.style.fill = hex;
      core.style.opacity = '0.9'; // must match real ball/target exactly — decoys were rendering fully opaque otherwise
    }
    container.style.color = hex; // so the pulse glow (currentColor) matches too
  }

  /* ---------- Decoy circles (stages B & C) ---------- */

  const DECOY_COUNT = 2; // wrong-colored circles shown alongside the real target
  let activeDecoys = [];
  let decoyGuideLines = [];

  function shuffle(arr){
    const out = arr.slice();
    for (let i = out.length - 1; i > 0; i--){
      const j = Math.floor(Math.random() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }

  // A random spawn point that stays a minimum distance from every position
  // already taken, so decoys don't overlap the real target or each other.
  function randomSeparatedPos(existingPositions, minDist){
    let pos, tries = 0;
    do {
      pos = randomPos(70, 130, 130);
      tries++;
    } while (existingPositions.some(p => Math.hypot(p.x - pos.x, p.y - pos.y) < minDist) && tries < 40);
    return pos;
  }

  // Creates one dashed guide line, styled identically to the real target's
  // line, so following the line gives no clue about which circle is correct.
  function createGuideLineTo(start, end){
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const dist = Math.hypot(dx, dy);
    const angle = Math.atan2(dy, dx) * 180 / Math.PI;
    const el = document.createElement('div');
    el.className = 'guide-line-dyn';
    el.style.left = start.x + 'px';
    el.style.top = start.y + 'px';
    el.style.width = dist + 'px';
    el.style.transform = `rotate(${angle}deg)`;
    playfield.appendChild(el);
    return el;
  }

  function clearDecoys(){
    activeDecoys.forEach(el => el.remove());
    activeDecoys = [];
    decoyGuideLines.forEach(el => el.remove());
    decoyGuideLines = [];
  }

  // Builds a decoy that's visually identical in shape and size to the real
  // ball/target (same SVG ring+core structure, same pixel dimensions) so it
  // can only be told apart by color — and keeps every circle well clear of
  // the others so they never crowd together. Also draws a guide line to it,
  // identical to the real target's line, so the line itself gives no hint.
  function spawnDecoys(startPos, realPos, svgMarkup, sizePx, correctHex){
    const decoyColors = shuffle(COLOR_PALETTE.filter(c => c.hex !== correctHex)).slice(0, DECOY_COUNT);
    const taken = [realPos];
    const MIN_SEPARATION = 220; // px between circle centers — keeps them clearly apart, not just non-overlapping

    decoyColors.forEach(c => {
      const pos = randomSeparatedPos(taken, MIN_SEPARATION);
      taken.push(pos);

      decoyGuideLines.push(createGuideLineTo(startPos, pos));

      const el = document.createElement('div');
      el.className = 'mover armed';
      el.style.width = sizePx + 'px';
      el.style.height = sizePx + 'px';
      el.style.left = pos.x + 'px';
      el.style.top = pos.y + 'px';
      el.style.display = 'block';
      el.innerHTML = svgMarkup;
      applyThemeColor(el, c.hex);
      el.addEventListener('click', () => {
        el.classList.add('miss-flash');
        setTimeout(() => el.classList.remove('miss-flash'), 220);
      });
      playfield.appendChild(el);
      activeDecoys.push(el);
    });
  }

  const BALL_SVG = '<svg viewBox="0 0 56 56"><circle class="ring" cx="28" cy="28" r="24"/><circle class="core" cx="28" cy="28" r="6"/></svg>';
  const TARGET_SVG = '<svg viewBox="0 0 64 64"><circle class="ring" cx="32" cy="32" r="28"/><circle class="ring" cx="32" cy="32" r="18" opacity="0.6"/><circle class="core" cx="32" cy="32" r="7"/></svg>';

  function startStageA(){
    setActiveRow(rowA);
    greenLive = false;
    countdownArmed = false;
    waitingForClick = true;
    reflexCircle.style.display = 'block';
    reflexCircle.classList.remove('go');
    reflexCircle.style.background = 'transparent';
    reflexCircle.style.borderColor = 'var(--amber-dim)';
    reflexCircle.style.boxShadow = 'none';
    rcLabel.textContent = 'CLICK TO START';
    cue.classList.remove('hidden');
    cue.classList.remove('warn');
    cue.textContent = 'CLICK THE CIRCLE TO BEGIN';
    clearTimeout(greenTimer);
  }

  function armCountdown(){
    countdownArmed = true;
    waitingForClick = false;
    rcLabel.textContent = 'WAIT';
    cue.textContent = 'WAIT FOR COLOR';

    const delay = 1000 + Math.random() * 2500;
    greenTimer = setTimeout(() => {
      // Two nested rAFs: the first runs right before the browser paints our change,
      // the second only fires once that paint has actually completed — so the
      // timestamp reflects when the frame was presented, not just scheduled.
      requestAnimationFrame(() => {
        trialColor = COLOR_PALETTE[Math.floor(Math.random() * COLOR_PALETTE.length)];
        reflexCircle.classList.add('go');
        reflexCircle.style.background = trialColor.hex;
        reflexCircle.style.borderColor = trialColor.hex;
        reflexCircle.style.boxShadow = `0 0 40px ${trialColor.hex}99`;
        rcLabel.textContent = 'CLICK';
        cue.classList.add('hidden');
        requestAnimationFrame(() => {
          greenAppearTime = performance.now();
          greenLive = true;
        });
      });
    }, delay);
  }

  function restartStageA(message){
    clearTimeout(greenTimer);
    countdownArmed = false;
    waitingForClick = false;
    greenLive = false;
    cue.classList.remove('hidden');
    cue.classList.add('warn');
    cue.textContent = message;
    reflexCircle.style.display = 'none';
    setTimeout(startStageA, 1100);
  }

  function handleReflexClick(){
    if (waitingForClick){
      armCountdown();
      return;
    }
    if (!greenLive){
      restartStageA('TOO SOON — RESTARTING');
      return;
    }
    const rt = window.KA_applyGrace(performance.now() - greenAppearTime);
    data.A = rt;
    hudA.textContent = fmt(rt);
    greenLive = false;
    countdownArmed = false;
    reflexCircle.style.display = 'none';
    startStageB();
  }

  /* ---------- Guide line + path deviation ---------- */

  const guideLineEl = document.getElementById('guideLine');

  function showGuideLine(start, end){
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const dist = Math.hypot(dx, dy);
    const angle = Math.atan2(dy, dx) * 180 / Math.PI;
    guideLineEl.style.left = start.x + 'px';
    guideLineEl.style.top = start.y + 'px';
    guideLineEl.style.width = dist + 'px';
    guideLineEl.style.transform = `rotate(${angle}deg)`;
    guideLineEl.style.display = 'block';
  }

  function hideGuideLine(){
    guideLineEl.style.display = 'none';
  }

  // Average perpendicular distance (px) of the sampled cursor path from the
  // straight line between the stage's starting point and the target.
  function avgLineDeviation(points, start, end){
    if (!points.length) return null;
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const lineLen = Math.hypot(dx, dy);
    if (lineLen === 0) return null;
    let total = 0;
    points.forEach(p => {
      const cross = Math.abs(dx * (start.y - p.y) - (start.x - p.x) * dy);
      total += cross / lineLen;
    });
    return total / points.length;
  }

  function fmtPx(px){
    if (px === null || px === undefined) return '—';
    return px.toFixed(1) + ' px';
  }

  /* ---------- Stage B: move + click on ball ---------- */

  let stageBArmed = false;
  let stageBAppear = null;
  let stageBPos = null;
  let stageBPrevMove = null;
  let stageBLineStart = null;
  let stageBPath = [];

  function startStageB(){
    setActiveRow(rowBmove);
    stageBPos = randomPos(70, 130, 130);
    ball.style.left = stageBPos.x + 'px';
    ball.style.top = stageBPos.y + 'px';
    ball.style.display = 'block';
    ball.classList.add('armed');
    applyThemeColor(ball, trialColor.hex);
    stageBPrevMove = lastMousePos;
    stageBLineStart = lastMousePos || {x: window.innerWidth/2, y: window.innerHeight/2};
    stageBPath = [];
    showGuideLine(stageBLineStart, stageBPos);
    spawnDecoys(stageBLineStart, stageBPos, BALL_SVG, 56, trialColor.hex);
    // Two nested rAFs so the timestamp reflects when the ball was actually painted,
    // not just when we scheduled the change.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        stageBAppear = performance.now();
        stageBArmed = true;
      });
    });
  }

  function handleStageBClick(){
    if (!stageBArmed) return;
    const clickTime = window.KA_applyGrace(performance.now() - stageBAppear);
    stageBArmed = false;
    ball.classList.remove('armed');
    ball.style.display = 'none';
    clearDecoys();

    if (data.Bmove === null) data.Bmove = clickTime; // no movement registered before click
    data.Bclick = clickTime;
    hudBclick.textContent = fmt(clickTime);

    data.Bdev = avgLineDeviation(stageBPath, stageBLineStart, stageBPos);
    hudBdev.textContent = fmtPx(data.Bdev);

    setActiveRow(rowCmove);
    startStageC();
  }

  /* ---------- Stage C: move + click on target ---------- */

  let stageCArmed = false;
  let stageCAppear = null;
  let stageCPos = null;
  let stageCPrevMove = null;
  let stageCLineStart = null;
  let stageCPath = [];

  function startStageC(){
    stageCPos = randomPos(70, 130, 130);
    targetB.style.left = stageCPos.x + 'px';
    targetB.style.top = stageCPos.y + 'px';
    targetB.style.display = 'block';
    targetB.classList.add('armed');
    applyThemeColor(targetB, trialColor.hex);
    stageCPrevMove = lastMousePos;
    stageCLineStart = lastMousePos || {x: window.innerWidth/2, y: window.innerHeight/2};
    stageCPath = [];
    showGuideLine(stageCLineStart, stageCPos);
    spawnDecoys(stageCLineStart, stageCPos, TARGET_SVG, 64, trialColor.hex);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        stageCAppear = performance.now();
        stageCArmed = true;
      });
    });
  }

  function handleStageCClick(){
    if (!stageCArmed) return;
    const clickTime = window.KA_applyGrace(performance.now() - stageCAppear);
    stageCArmed = false;
    targetB.classList.remove('armed');
    targetB.style.display = 'none';
    clearDecoys();

    if (data.Cmove === null) data.Cmove = clickTime;
    data.Cclick = clickTime;
    hudCclick.textContent = fmt(clickTime);

    data.Cdev = avgLineDeviation(stageCPath, stageCLineStart, stageCPos);
    hudCdev.textContent = fmtPx(data.Cdev);

    finishTrial();
  }

  /* ---------- Mouse tracking (shared) ---------- */

  function handleMouseMove(e){
    const x = e.clientX, y = e.clientY;
    lastMousePos = {x, y};

    if (countdownArmed && !greenLive){
      const c = circleCenter();
      const dist = Math.hypot(x - c.x, y - c.y);
      if (dist > CIRCLE_RADIUS){
        restartStageA('LEFT THE CIRCLE — RESTARTING');
      }
    }

    if (stageBArmed){
      stageBPath.push({x, y});
      if (stageBPrevMove){
        const dist = Math.hypot(x - stageBPrevMove.x, y - stageBPrevMove.y);
        if (dist >= MIN_MOVE_DIST){
          spawnTrail(x, y);

          if (data.Bmove === null){
            data.Bmove = window.KA_applyGrace(performance.now() - stageBAppear);
            hudBmove.textContent = fmt(data.Bmove);
            setActiveRow(rowBaim);
          }

          if (data.Baim === null){
            const moveVec = {x: x - stageBPrevMove.x, y: y - stageBPrevMove.y};
            const toTarget = {x: stageBPos.x - stageBPrevMove.x, y: stageBPos.y - stageBPrevMove.y};
            const angle = angleBetween(moveVec, toTarget);
            if (angle <= ANGLE_THRESHOLD_DEG){
              data.Baim = window.KA_applyGrace(performance.now() - stageBAppear);
              hudBaim.textContent = fmt(data.Baim);
              setActiveRow(rowBclick);
            }
          }
          stageBPrevMove = {x, y};
        }
      } else {
        stageBPrevMove = {x, y};
      }
    }

    if (stageCArmed){
      stageCPath.push({x, y});
      if (stageCPrevMove){
        const dist = Math.hypot(x - stageCPrevMove.x, y - stageCPrevMove.y);
        if (dist >= MIN_MOVE_DIST){
          spawnTrail(x, y);

          if (data.Cmove === null){
            data.Cmove = window.KA_applyGrace(performance.now() - stageCAppear);
            hudCmove.textContent = fmt(data.Cmove);
            setActiveRow(rowCaim);
          }

          if (data.Caim === null){
            const moveVec = {x: x - stageCPrevMove.x, y: y - stageCPrevMove.y};
            const toTarget = {x: stageCPos.x - stageCPrevMove.x, y: stageCPos.y - stageCPrevMove.y};
            const angle = angleBetween(moveVec, toTarget);
            if (angle <= ANGLE_THRESHOLD_DEG){
              data.Caim = window.KA_applyGrace(performance.now() - stageCAppear);
              hudCaim.textContent = fmt(data.Caim);
              setActiveRow(rowCclick);
            }
          }
          stageCPrevMove = {x, y};
        }
      } else {
        stageCPrevMove = {x, y};
      }
    }
  }

  /* ---------- Results ---------- */

  function finishTrial(){
    document.getElementById('hud').style.display = '';
    hideGuideLine();
    document.getElementById('trialNum').textContent = trial;
    document.getElementById('rA').textContent = fmt(data.A);
    document.getElementById('rBmove').textContent = fmt(data.Bmove);
    setAimResult(document.getElementById('rBaim'), data.Baim);
    document.getElementById('rBclick').textContent = fmt(data.Bclick);
    document.getElementById('rBdev').textContent = fmtPx(data.Bdev);
    document.getElementById('rCmove').textContent = fmt(data.Cmove);
    setAimResult(document.getElementById('rCaim'), data.Caim);
    document.getElementById('rCclick').textContent = fmt(data.Cclick);
    document.getElementById('rCdev').textContent = fmtPx(data.Cdev);
    updateBestMetric('lab_best_A', data.A, document.getElementById('rBestA'), document.getElementById('rBestARow'));
    updateBestMetric('lab_best_Bclick', data.Bclick, document.getElementById('rBestBclick'), document.getElementById('rBestBclickRow'));
    updateBestMetric('lab_best_Cclick', data.Cclick, document.getElementById('rBestCclick'), document.getElementById('rBestCclickRow'));
    resultCard.style.display = 'flex';
    setActiveRow(null);

    history.unshift({trial, ...data});
    if (history.length > 6) history.pop();
    renderLog();
    window.KA_history.add('Colour Flick', `A ${fmt(data.A)} · B-click ${fmt(data.Bclick)} · C-click ${fmt(data.Cclick)}`);
  }

  function renderLog(){
    logEl.innerHTML = history.map(h =>
      `<span class="entry">T${h.trial} — A <b>${fmt(h.A)}</b> · B-move <b>${fmt(h.Bmove)}</b> · B-aim <b>${fmt(h.Baim)}</b> · B-click <b>${fmt(h.Bclick)}</b> · B-dev <b>${fmtPx(h.Bdev)}</b> · C-move <b>${fmt(h.Cmove)}</b> · C-aim <b>${fmt(h.Caim)}</b> · C-click <b>${fmt(h.Cclick)}</b> · C-dev <b>${fmtPx(h.Cdev)}</b></span>`
    ).join('<span style="color:var(--grid)">|</span>');
  }

  /* ---------- Wiring ---------- */

  playfield.addEventListener('mousemove', handleMouseMove);
  // Responses use pointerdown, not click: the browser only dispatches 'click' on mouse
  // RELEASE, which would fold the player's entire button-hold time into their reaction.
  reflexCircle.addEventListener('pointerdown', handleReflexClick);
  ball.addEventListener('pointerdown', handleStageBClick);
  targetB.addEventListener('pointerdown', handleStageCClick);
  startBtn.addEventListener('click', beginTrial);
  nextBtn.addEventListener('click', beginTrial);

  document.addEventListener('mousemove', function(e){
    if (lastMousePos === null){
      lastMousePos = {x: e.clientX, y: e.clientY};
    }
  }, {once:true});
})();
