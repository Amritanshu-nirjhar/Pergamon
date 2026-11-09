// Optional sound, synthesised with Web Audio (no files): an ambient chord per room, paper rustles, spine thuds.
// Off by default; the AudioContext is only created on the first click of the toggle.
let ctx, master, noise, zone = 0, pad = null, on = false, lastThud = 0;

// one chord per room, then the library: low, open voicings that sit under the page
const CHORDS = [
  [73.4, 110, 146.8, 220, 277.2], // I   warm D major: epics
  [110, 130.8, 164.8, 196, 261.6], // II  A minor seventh: love & ruin
  [98, 138.6, 146.8, 207.7, 293.7], // III unsettled: visions of the future
  [65.4, 98, 130.8, 196, 246.9], // IV  open fifths: other worlds
  [87.3, 130.8, 174.6, 220, 329.6], // library: F major, calm
];

function init() {
  ctx = new AudioContext();
  master = ctx.createGain(); master.gain.value = 0; master.connect(ctx.destination);
  // two seconds of brown noise, reused by every rustle and the room-tone bed
  const len = ctx.sampleRate * 2, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
  for (let i = 0, v = 0; i < len; i++) { v = (v + (Math.random() * 2 - 1) * .02) / 1.02; d[i] = v * 3.5 }
  noise = buf;
}

function makePad(z) {
  const t = ctx.currentTime, out = ctx.createGain(), lp = ctx.createBiquadFilter();
  lp.type = 'lowpass'; lp.frequency.value = 700; lp.Q.value = .4;
  // a slow breath on the filter keeps the chord alive
  const lfo = ctx.createOscillator(), lfoG = ctx.createGain();
  lfo.frequency.value = .05 + z * .01; lfoG.gain.value = 260; lfo.connect(lfoG).connect(lp.frequency); lfo.start();
  const nodes = [lfo];
  CHORDS[z].forEach((f, i) => {
    for (const det of [-5, 5]) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = i < 2 ? 'sine' : 'triangle'; o.frequency.value = f; o.detune.value = det + Math.random() * 3;
      g.gain.value = .05 / (1 + i * .6);
      o.connect(g).connect(lp); o.start(); nodes.push(o);
    }
  });
  const bed = ctx.createBufferSource(), bedF = ctx.createBiquadFilter(), bedG = ctx.createGain();
  bed.buffer = noise; bed.loop = true; bedF.type = 'lowpass'; bedF.frequency.value = 380; bedG.gain.value = .07;
  bed.connect(bedF).connect(bedG).connect(out); bed.start(); nodes.push(bed);
  lp.connect(out); out.connect(master);
  out.gain.setValueAtTime(0, t); out.gain.linearRampToValueAtTime(1, t + 2.5);
  return {out, nodes};
}
function fadeOut(p) {
  const t = ctx.currentTime;
  p.out.gain.cancelScheduledValues(t); p.out.gain.setValueAtTime(p.out.gain.value, t); p.out.gain.linearRampToValueAtTime(0, t + 2.5);
  p.nodes.forEach(n => n.stop(t + 2.6));
}

// a burst of filtered noise shaped like a page lifting and falling
function burst({freq, q = .8, dur, gain, delay = 0, type = 'bandpass'}) {
  const t = ctx.currentTime + delay, src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  src.buffer = noise; f.type = type; f.frequency.setValueAtTime(freq, t); f.frequency.exponentialRampToValueAtTime(freq * 1.8, t + dur); f.Q.value = q;
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + dur * .25); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
  src.connect(f).connect(g).connect(master); src.start(t, Math.random() * 1.5); src.stop(t + dur + .05);
}

export const sfx = {
  get on() { return on },
  toggle() {
    if (!ctx) init();
    on = !on;
    ctx.resume();
    master.gain.setTargetAtTime(on ? .8 : 0, ctx.currentTime, .4);
    if (on && !pad) pad = makePad(zone);
    if (!on && pad) { const p = pad; pad = null; setTimeout(() => !on && fadeOut(p), 50) }
    return on;
  },
  room(z) {
    if (z === zone) return;
    zone = z;
    if (!on) return;
    if (pad) fadeOut(pad);
    pad = makePad(z);
  },
  rustle(k = 1) {
    if (!on) return;
    burst({freq: 1800, dur: .32, gain: .5 * k});
    burst({freq: 4200, q: 1.4, dur: .18, gain: .22 * k, delay: .05, type: 'highpass'});
  },
  thud(k = 1) {
    if (!on) return;
    const now = performance.now();
    if (now - lastThud < 45) return; // a whole shelf landing shouldn't become a drum roll
    lastThud = now;
    const t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain(), v = k * (.5 + Math.random() * .4);
    o.frequency.setValueAtTime(120 + Math.random() * 40, t); o.frequency.exponentialRampToValueAtTime(48, t + .14);
    g.gain.setValueAtTime(v * .55, t); g.gain.exponentialRampToValueAtTime(.0001, t + .2);
    o.connect(g).connect(master); o.start(t); o.stop(t + .22);
    burst({freq: 900, dur: .06, gain: v * .25, type: 'lowpass'});
  },
};
