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

  window.KA_sound = {
    // A reaction-game stimulus appearing (Go/No-Go's color, Peripheral Ping's dot, Base
    // Reflex's green, Flash Reflex's arrow, Choice Reaction's flash).
    stimulus(){ blip(660, 0.09, 'sine', 0.14); },
    // A square/pad lighting up during the computer's playback of a memory sequence.
    memoryShow(){ blip(520, 0.12, 'triangle', 0.13); },
    // The player's own click on a memory square, lighting it up in response.
    memoryClick(){ blip(340, 0.08, 'square', 0.1); },
    isMuted(){ return muted; },
    setMuted(value){
      muted = !!value;
      window.KA_records.set('muted', muted);
    }
  };
})();
