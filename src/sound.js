(() => {
'use strict';
// Sons eletrônicos originais gerados no navegador. Nenhum arquivo de áudio ou serviço externo.
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
  tone({frequency=330, endingFrequency=120, duration=.12, volume=.06, wave='triangle'}={}) {
    if (!this.enabled || !this.context || this.context.state!=='running') return;
    const osc=this.context.createOscillator();
    const gain=this.context.createGain();
    const t=this.context.currentTime;
    osc.type=wave;
    osc.frequency.setValueAtTime(frequency,t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(40,endingFrequency),t+duration);
    gain.gain.setValueAtTime(.0001,t);
    gain.gain.exponentialRampToValueAtTime(volume,t+.008);
    gain.gain.exponentialRampToValueAtTime(.0001,t+duration);
    osc.connect(gain).connect(this.context.destination);
    osc.start(t);
    osc.stop(t+duration+.01);
  }
  monitor(){this.tone({frequency:160,endingFrequency:70,duration:.21,volume:.07,wave:'sawtooth'});}
  switch(){this.tone({frequency:520,endingFrequency:180,duration:.08,volume:.055,wave:'square'});}
  finish(){this.tone({frequency:440,endingFrequency:660,duration:.55,volume:.06});}
}

window.NathGame.SoundEngine = SoundEngine;

})();
