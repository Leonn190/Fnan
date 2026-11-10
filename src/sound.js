(() => {
'use strict';
// Efeitos sintetizados e mixagem do rádio da mesa.
class SoundEngine {
  constructor() { this.enabled = false; this.context = null; this.ambient = null; }
  async enable() {
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return false;
    try {
      if (!this.context) this.context = new Ctor();
      await this.context.resume();
      this.enabled = true;
      this.startAmbience();
      return true;
    } catch { return false; }
  }
  startAmbience() {
    if (!this.enabled || !this.context || this.ambient) return;
    const osc = this.context.createOscillator();
    const filter = this.context.createBiquadFilter();
    const gain = this.context.createGain();
    osc.type='sine'; osc.frequency.value=55;
    filter.type='lowpass';filter.frequency.value=155;
    gain.gain.value=.018;
    osc.connect(filter).connect(gain).connect(this.context.destination);
    osc.start();
    this.ambient = {osc,gain};
  }
  tone({frequency=330, endingFrequency=120, duration=.12, volume=.06, wave='triangle', delay=0, output}={}) {
    if (!this.enabled || !this.context || this.context.state!=='running') return;
    const osc=this.context.createOscillator();
    const gain=this.context.createGain();
    const t=this.context.currentTime+delay;
    osc.type=wave;
    osc.frequency.setValueAtTime(frequency,t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(40,endingFrequency),t+duration);
    gain.gain.setValueAtTime(.0001,t);
    gain.gain.exponentialRampToValueAtTime(volume,t+Math.min(.008,duration/2));
    gain.gain.exponentialRampToValueAtTime(.0001,t+duration);
    osc.connect(gain).connect(output ?? this.context.destination);
    osc.start(t);
    osc.stop(t+duration+.01);
  }
  monitor(){this.tone({frequency:160,endingFrequency:70,duration:.21,volume:.07,wave:'sawtooth'});}
  switch(){this.tone({frequency:520,endingFrequency:180,duration:.08,volume:.055,wave:'square'});}
  lure(duration) {
    if (!this.enabled || this.context.state !== 'running') return;
    this.stopLure();
    const output = this.context.createGain();
    output.connect(this.context.destination);
    this.lureOutput = output;
    for (let delay = 0; delay < duration; delay += 1) {
      this.tone({frequency:740,endingFrequency:420,duration:Math.min(.16,duration-delay),volume:.055,wave:'square',delay,output});
      if (delay + .2 < duration) {
        this.tone({frequency:520,endingFrequency:320,duration:Math.min(.22,duration-delay-.2),volume:.045,delay:delay+.2,output});
      }
    }
  }
  stopLure() {
    this.lureOutput?.disconnect();
    this.lureOutput = null;
  }
  finish(){this.tone({frequency:440,endingFrequency:660,duration:.55,volume:.06});}
  connectRadio(media) {
    const context = this.context;
    // Local files play directly. Chromium silences file:// sources routed through Web Audio.
    if (window.location?.protocol === 'file:' || this.radio || !context?.createStereoPanner) return;
    const lowpass = context.createBiquadFilter();
    lowpass.type = 'lowpass';
    const panner = context.createStereoPanner();
    const gain = context.createGain();
    gain.gain.value = 0;
    context.createMediaElementSource(media).connect(lowpass).connect(panner)
      .connect(gain).connect(context.destination);
    this.radio = { lowpass, panner, gain };
    media.volume = 1;
  }

  mixRadio(media, pan, behindDoor) {
    const volume = behindDoor ? .045 : .15 * (1 - .35 * Math.abs(pan));
    if (!this.radio) {
      media.volume = volume;
      return;
    }
    const { lowpass, panner, gain } = this.radio;
    if (this.radio.pan === pan && this.radio.behindDoor === behindDoor) return;
    this.radio.pan = pan;
    this.radio.behindDoor = behindDoor;
    const now = this.context.currentTime;
    lowpass.frequency.setTargetAtTime(behindDoor ? 1250 : 14_000, now, .045);
    panner.pan.setTargetAtTime(pan * .85, now, .045);
    gain.gain.setTargetAtTime(volume, now, .045);
  }

  closetDoor(entering) {
    const context = this.context;
    if (!this.enabled || context?.state !== 'running') return;
    const now = context.currentTime;
    const noise = context.createBuffer(1, Math.ceil(context.sampleRate * .48), context.sampleRate);
    const samples = noise.getChannelData(0);
    for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;

    const impact = (delay, duration, frequency, endFrequency, volume, resonance = 1) => {
      const start = now + delay;
      const source = context.createBufferSource();
      const filter = context.createBiquadFilter();
      const gain = context.createGain();
      source.buffer = noise;
      filter.type = 'bandpass';
      filter.Q.value = resonance;
      filter.frequency.setValueAtTime(frequency, start);
      filter.frequency.exponentialRampToValueAtTime(endFrequency, start + duration);
      gain.gain.setValueAtTime(.0001, start);
      gain.gain.exponentialRampToValueAtTime(volume, start + .012);
      gain.gain.exponentialRampToValueAtTime(.0001, start + duration);
      source.connect(filter).connect(gain).connect(context.destination);
      source.start(start, 0, duration);
    };
    const steps = entering ? [.26, .44, .61] : [.46, .63, .8];
    for (const delay of steps) {
      this.tone({ frequency: 110, endingFrequency: 46, duration: .14, volume: .095, delay });
      impact(delay, .13, 590, 190, .23);
    }
    const latch = entering ? .73 : .19;
    impact(latch, .075, 2400, 1000, .26);
    impact(latch + .04, .42, 720, 2200, .32, 8);
    this.tone({ frequency: 330, endingFrequency: 180, duration: .28, volume: .045, wave: 'sawtooth', delay: latch + .06 });
  }
}

window.NathGame.SoundEngine = SoundEngine;

})();
