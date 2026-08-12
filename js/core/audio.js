// Simple synthesized sound effects — no audio files to source or download, just short
// oscillator blips with a quick attack / exponential decay envelope so nothing clicks or
// pops. One shared AudioContext, lazily created and resumed on first use since browsers
// block audio from starting before a user gesture — the first stimulus/click a player
// triggers doubles as that gesture, so this never needs its own "enable sound" prompt.
(function(){
  let ctx = null;
  let muted = window.KA_records.get('muted', false);

  function getCtx(){
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    if (!ctx) ctx = new AC();
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function blip(freq, dur, type, peak){
    if (muted) return;
    const c = getCtx();
    if (!c) return;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    const now = c.currentTime;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(peak, now + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    osc.connect(gain);
    gain.connect(c.destination);
    osc.start(now);
    osc.stop(now + dur + 0.02);
  }

  // Deliberately harsher/lower than every other cue — a falling sawtooth reads as
  // "wrong" the way the sine/triangle blips read as neutral confirmation.
  function errorBlip(){
    if (muted) return;
    const c = getCtx();
    if (!c) return;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = 'sawtooth';
    const now = c.currentTime;
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(110, now + 0.16);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.15, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
    osc.connect(gain);
    gain.connect(c.destination);
    osc.start(now);
    osc.stop(now + 0.2);
  }

  // Rank-celebration chime — an ascending run through a bright major-pentatonic scale.
  // noteCount controls how far up the scale it climbs, so a Platinum celebration plays a
  // short 3-note phrase and a Legend/Master one plays the full run — same instrument, just
  // more of it, so the sound itself scales with how big a deal the rank is.
  const CELEBRATE_SCALE = [523.25, 587.33, 659.25, 783.99, 880.00, 987.77, 1046.50];
  function celebrateChime(noteCount){
    if (muted) return;
    const c = getCtx();
    if (!c) return;
    const notes = CELEBRATE_SCALE.slice(0, Math.max(1, Math.min(noteCount, CELEBRATE_SCALE.length)));
    const now = c.currentTime;
    notes.forEach((freq, i) => {
      const start = now + i * 0.09;
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.16, start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.35);
      osc.connect(gain);
      gain.connect(c.destination);
      osc.start(start);
      osc.stop(start + 0.4);
    });
  }

  window.KA_sound = {
    // A reaction-game stimulus appearing (Go/No-Go's color, Peripheral Ping's dot, Base
    // Reflex's green, Flash Reflex's arrow, Choice Reaction's flash).
    stimulus(){ blip(660, 0.09, 'sine', 0.14); },
    // A square/pad lighting up during the computer's playback of a memory sequence.
    memoryShow(){ blip(520, 0.12, 'triangle', 0.13); },
    // The player's own click on a memory square, lighting it up in response.
    memoryClick(){ blip(340, 0.08, 'square', 0.1); },
    // A wrong answer, miss, timeout, or false start — any trial-ending mistake.
    error(){ errorBlip(); },
    // First time ever reaching a new Platinum+ rank tier. noteCount scales with how far
    // above Platinum the tier is.
    celebrate(noteCount){ celebrateChime(noteCount); },
    isMuted(){ return muted; },
    setMuted(value){
      muted = !!value;
      window.KA_records.set('muted', muted);
    }
  };
})();
