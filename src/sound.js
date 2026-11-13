(() => {
'use strict';
const sampleFiles = {
  musicBox: '01_FNAF2_Music_Box.mp3',
  vent: '02_FNAF2_Vent.mp3',
  doorCreak: '04_FNAF4_Door_Creak.mp3',
  officeGateClose: 'SFXBible_12478.ogg',
  running: '06_FNAF4_Player_Running.mp3',
  flashlight: '07_FNAF4_Flashlight.mp3',
  nightmare: '08_FNAF4_Nightmare_Jumpscare.mp3',
  reboot: '10_FNAF3_Rebooting.mp3',
  chimes: '11_FNAF2_Chimes.mp3'
};
const cameraMeows = [
  ['01_camera_sinistra', 'camera'],
  ['02_camera_pesadelo', 'pesadelo']
].map(([folder, suffix]) => [
  `${folder}/01_miado_agudo_${suffix}.wav`,
  `${folder}/02_miado_longo_${suffix}.wav`,
  `${folder}/03_miado_curto_${suffix}.wav`
]);

// Efeitos do jogo e mixagem do rádio da mesa.
class SoundEngine {
  constructor() {
    this.enabled = false;
    this.context = null;
    this.ambient = null;
    this.samples = new Map();
    this.tones = new Set();
    this.active = false;
  }
  preloadSamples() {
    for (const file of [...Object.values(sampleFiles), ...cameraMeows.flat()]) {
      if (this.samples.has(file)) continue;
      const audio = new Audio(`./public/${file}`);
      audio.preload = 'auto';
      this.samples.set(file, audio);
    }
  }
  playSample(name, volume = .45) {
    const audio = this.samples.get(sampleFiles[name] ?? name);
    if (!audio) return;
    audio.volume = volume;
    audio.currentTime = 0;
    audio.play().catch(() => {});
  }
  setSampleLoop(name, volume) {
    const audio = this.samples.get(sampleFiles[name]);
    if (!audio) return;
    if (volume === 0) {
      if (audio.loop) this.stopSample(name);
      return;
    }
    if (audio.loop) {
      if (audio.volume !== volume) audio.volume = volume;
      return;
    }
    audio.loop = true;
    this.playSample(name, volume);
  }
  stopSample(name) {
    const audio = this.samples.get(sampleFiles[name] ?? name);
    if (!audio) return;
    audio.loop = false;
    audio.pause();
  }
  stopSamples() {
    for (const file of this.samples.keys()) this.stopSample(file);
  }
  cameraMeow(sanity) {
    const clips = cameraMeows[Number(sanity < 50)];
    this.playSample(clips[Math.floor(Math.random() * clips.length)]);
  }
  async enable() {
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return false;
    try {
      if (!this.context) this.context = new Ctor();
      await this.context.resume();
      this.enabled = true;
      if (this.active) this.startAmbience();
      else this.context.suspend().catch(() => {});
      return true;
    } catch { return false; }
  }
  startAmbience() {
    if (!this.active || this.context?.state !== 'running' || this.ambient) return;
    const osc = this.context.createOscillator();
    const filter = this.context.createBiquadFilter();
    const gain = this.context.createGain();
    osc.type='sine'; osc.frequency.value=55;
    filter.type='lowpass';filter.frequency.value=155;
    gain.gain.value=.018;
    osc.connect(filter).connect(gain).connect(this.context.destination);
    osc.start();
    this.ambient = { osc, filter, gain };
  }
  startShift() {
    this.active = true;
    if (!this.enabled) return;
    this.context.resume().then(() => this.startAmbience(), () => {});
  }
  stopShift() {
    this.active = false;
    this.stopSamples();
    for (const voice of this.tones) {
      voice.cleanup();
      voice.osc.stop();
    }
    if (this.ambient) {
      const { osc, filter, gain } = this.ambient;
      this.ambient = null;
      osc.stop();
      osc.disconnect();
      filter.disconnect();
      gain.disconnect();
    }
    this.disconnectRadio();
    if (this.enabled) this.context.suspend().catch(() => {});
  }
  tone({frequency=330, endingFrequency=120, duration=.12, volume=.06, wave='triangle'}={}) {
    if (!this.active || this.context?.state !== 'running') return;
    const osc=this.context.createOscillator();
    const gain=this.context.createGain();
    const t=this.context.currentTime;
    osc.type=wave;
    osc.frequency.setValueAtTime(frequency,t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(40,endingFrequency),t+duration);
    gain.gain.setValueAtTime(.0001,t);
    gain.gain.exponentialRampToValueAtTime(volume,t+Math.min(.008,duration/2));
    gain.gain.exponentialRampToValueAtTime(.0001,t+duration);
    const voice = { osc, cleanup: () => {
      if (!this.tones.delete(voice)) return;
      osc.onended = null;
      osc.disconnect();
      gain.disconnect();
    } };
    this.tones.add(voice);
    osc.onended = voice.cleanup;
    osc.connect(gain).connect(this.context.destination);
    osc.start(t);
    osc.stop(t+duration+.01);
  }
  monitor(){this.tone({frequency:160,endingFrequency:70,duration:.21,volume:.07,wave:'sawtooth'});}
  switch(){this.tone({frequency:520,endingFrequency:180,duration:.08,volume:.055,wave:'square'});}
  connectRadio(media) {
    const context = this.context;
    // Local files play directly. Chromium silences file:// sources routed through Web Audio.
    if (window.location?.protocol === 'file:' || this.radio || !this.enabled || !context?.createStereoPanner) return;
    // A media element can have only one MediaElementAudioSourceNode in this context.
    this.radioSource ??= context.createMediaElementSource(media);
    const lowpass = context.createBiquadFilter();
    lowpass.type = 'lowpass';
    const panner = context.createStereoPanner();
    const gain = context.createGain();
    gain.gain.value = 0;
    this.radioSource.connect(lowpass).connect(panner)
      .connect(gain).connect(context.destination);
    this.radio = { lowpass, panner, gain };
    media.volume = 1;
  }

  disconnectRadio() {
    if (!this.radio) return;
    const { lowpass, panner, gain } = this.radio;
    this.radioSource.disconnect();
    lowpass.disconnect();
    panner.disconnect();
    gain.disconnect();
    this.radio = null;
  }

  mixRadio(media, pan, behindDoor) {
    const volume = behindDoor ? .045 : .15 * (1 - .35 * Math.abs(pan));
    if (!this.radio) {
      if (media.volume !== volume) media.volume = volume;
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

  stats() {
    let playingSamples = 0;
    for (const audio of this.samples.values()) if (!audio.paused) playingSamples++;
    return { context: this.context?.state ?? 'unavailable', tones: this.tones.size,
      ambience: Boolean(this.ambient), radio: Boolean(this.radio), playingSamples, samples: this.samples.size };
  }
}

window.NathGame.SoundEngine = SoundEngine;

})();
