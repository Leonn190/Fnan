const assert = require('node:assert/strict');
const { test } = require('node:test');

class AudioNode {
  connections = new Set();
  frequency = this.parameter();
  gain = this.parameter();
  pan = this.parameter();
  parameter() { return { setValueAtTime() {}, exponentialRampToValueAtTime() {}, setTargetAtTime() {} }; }
  connect(node) { this.connections.add(node); return node; }
  disconnect() { this.connections.clear(); }
  start() { this.started = true; }
  stop() { assert(this.started); this.stopped = true; }
}

const contexts = [];
class AudioContext {
  currentTime = 0;
  state = 'suspended';
  destination = new AudioNode();
  nodes = [];
  constructor() { contexts.push(this); }
  createOscillator() { return this.makeNode(); }
  createGain() { return this.makeNode(); }
  createBiquadFilter() { return this.makeNode(); }
  createStereoPanner() { return this.makeNode(); }
  createMediaElementSource() {
    assert(!this.radioSource);
    return this.radioSource = this.makeNode();
  }
  makeNode() { const node = new AudioNode(); this.nodes.push(node); return node; }
  async suspend() { this.state = 'suspended'; }
  async resume() { this.state = 'running'; }
}
global.window = { NathGame: {}, AudioContext };
require('../src/sound.js');
const { SoundEngine } = window.NathGame;

test('one context, finite voices, radio reuse, and no connected shift nodes after stop', async () => {
  const sound = new SoundEngine();
  await sound.enable();
  assert.equal(sound.context.state, 'suspended');
  sound.startShift();
  await Promise.resolve();
  assert.equal(contexts.length, 1);
  assert.equal(sound.stats().ambience, true);
  const [ambient, filter, ambientGain] = sound.context.nodes;
  sound.monitor();
  const [, , , osc, gain] = sound.context.nodes;
  assert.equal(sound.stats().tones, 1);
  const ended = osc.onended;
  ended();
  assert.equal(sound.stats().tones, 0);
  assert.equal(osc.onended, null);
  assert.equal(osc.connections.size + gain.connections.size, 0);

  sound.switch();
  const [, , , , , pending, pendingGain] = sound.context.nodes;
  const staleEnded = pending.onended;
  const media = {};
  sound.connectRadio(media);
  sound.disconnectRadio();
  sound.connectRadio(media);
  assert.equal(sound.stats().radio, true);
  sound.stopShift();
  staleEnded();
  assert.equal(sound.stats().tones, 0);
  assert.equal(sound.stats().ambience, false);
  assert.equal(sound.stats().radio, false);
  assert.equal(sound.context.state, 'suspended');
  assert.equal(ambient.stopped && pending.stopped, true);
  for (const node of [ambient, filter, ambientGain, pending, pendingGain, ...sound.context.nodes]) {
    assert.equal(node.connections.size, 0);
  }
  sound.startShift();
  await Promise.resolve();
  sound.connectRadio(media);
  assert.equal(contexts.length, 1);
  assert.equal(sound.stats().radio, true);
  sound.stopShift();
});

test('a pending audio resume cannot recreate ambience after a shift stops', async () => {
  const sound = new SoundEngine();
  await sound.enable();
  let resume;
  sound.context.resume = () => new Promise(resolve => { resume = resolve; });
  sound.startShift();
  sound.stopShift();
  resume();
  await Promise.resolve();
  assert.equal(sound.stats().ambience, false);
  assert.equal(sound.context.nodes.length, 0);
});
