// Fires once — ever — the first time a run's rank reaches a new Platinum-or-higher tier,
// account-wide. Deliberately global rather than per-game: the point is "you just hit a new
// personal high-water mark," not "you hit Platinum in this specific drill for the first
// time," so celebrating Legend in Base Reflex means a later first-time Platinum in Choice
// Reaction stays quiet — it's not actually a new high point anymore.
(function(){
  const PLATINUM_IDX = window.KA_RANK_NAMES.indexOf('Platinum');
  const WATERMARK_KEY = 'celebrated_max_rank_idx';

  // Master's particles run a cool white/silver palette instead of the achieved rank's own
  // color — it reads as a tier above the gold/gem palette everything else uses, on top of
  // simply being more of everything (see intensity below).
  const MASTER_PALETTE = ['#ffffff', '#e6ecff', '#cfe0ff'];

  function particleColor(rank, i){
    if (rank.name === window.KA_MASTER_NAME) return MASTER_PALETTE[i % MASTER_PALETTE.length];
    return rank.color;
  }

  function burst(rank, count){
    const layer = document.createElement('div');
    layer.className = 'ka-celebrate-layer';
    for (let i = 0; i < count; i++){
      const p = document.createElement('span');
      p.className = 'ka-celebrate-particle';
      const angle = Math.random() * Math.PI * 2;
      const dist = 110 + Math.random() * 260;
      p.style.setProperty('--dx', (Math.cos(angle) * dist).toFixed(0) + 'px');
      p.style.setProperty('--dy', (Math.sin(angle) * dist).toFixed(0) + 'px');
      p.style.setProperty('--rot', (Math.random() * 720 - 360).toFixed(0) + 'deg');
      p.style.animationDuration = (900 + Math.random() * 700).toFixed(0) + 'ms';
      p.style.animationDelay = (Math.random() * 120).toFixed(0) + 'ms';
      p.style.background = particleColor(rank, i);
      layer.appendChild(p);
    }
    document.body.appendChild(layer);
    setTimeout(() => layer.remove(), 2200);
  }

  function banner(rank, glow, pulse, duration){
    const el = document.createElement('div');
    el.className = 'ka-celebrate-banner' + (glow ? ' glow' : '') + (pulse ? ' pulse' : '');
    el.style.setProperty('--rank-color', rank.color);
    el.innerHTML = '<span class="ka-celebrate-label">RANK ACHIEVED</span>' +
      '<span class="ka-celebrate-name">' + rank.name.toUpperCase() + '</span>';
    document.body.appendChild(el);
    // setTimeout rather than requestAnimationFrame: rAF can stall on a backgrounded/inactive
    // tab, and a player alt-tabbing away right as their run ends shouldn't eat the banner.
    setTimeout(() => el.classList.add('show'), 20);
    setTimeout(() => {
      el.classList.remove('show');
      setTimeout(() => el.remove(), 500);
    }, duration);
  }

  window.KA_maybeCelebrate = function(rank){
    if (!rank || !rank.name) return;
    const idx = window.KA_rankIndex(rank);
    if (idx === null || idx < PLATINUM_IDX) return;

    const watermark = window.KA_records.get(WATERMARK_KEY, -1);
    if (idx <= watermark) return;
    window.KA_records.set(WATERMARK_KEY, idx);

    // 1 at Platinum, climbing to 5 at Legend, 6 at the hidden Master tier — every visual and
    // audio knob below scales off this one number instead of a hand-picked branch per tier.
    const intensity = idx - PLATINUM_IDX + 1;
    const particleCount = 20 + intensity * 14;
    const noteCount = Math.min(2 + intensity, 7);
    const glow = intensity >= 2;   // Sapphire and above
    const pulse = intensity >= 5;  // Legend and Master
    const duration = 1800 + intensity * 250;

    burst(rank, particleCount);
    banner(rank, glow, pulse, duration);
    if (window.KA_sound && window.KA_sound.celebrate) window.KA_sound.celebrate(noteCount);
  };
})();
