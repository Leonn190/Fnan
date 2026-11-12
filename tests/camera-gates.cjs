// Run with: node tests/camera-gates.cjs. No browser/server dependencies.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
async function test() {
const runningAnimations = new Set();
class Element {
  constructor() {
    this.children = []; this.attrs = {}; this.dataset = {}; this.events = {};
    this.style = { setProperty() {} };
    const classes = new Set();
    this.classList = {
      add: c => classes.add(c), remove: c => classes.delete(c),
      toggle(c, v) { v ? classes.add(c) : classes.delete(c); },
      contains: c => classes.has(c)
    };
  }
  get src() { return this.attrs.src; }
  set src(value) { this.attrs.src = value; }
  setAttribute(key, value) { this.attrs[key] = String(value); }
  getAttribute(key) { return this.attrs[key] ?? null; }
  removeAttribute(key) { delete this.attrs[key]; }
  toggleAttribute(key, enabled) { if (enabled) this.setAttribute(key, ''); else this.removeAttribute(key); }
  append(...items) { this.children.push(...items); }
  replaceChildren(...items) { this.children = items; }
  querySelector() { return new Element(); }
  getBoundingClientRect() { return { left: 0, width: this.clientWidth, height: this.clientHeight }; }
  animate(keyframes, options) {
    const animation = { keyframes, options, cancel() { runningAnimations.delete(this); } };
    runningAnimations.add(animation);
    return animation;
  }
  focus() {}
  setPointerCapture() {}
  addEventListener(event, action) { (this.events[event] ??= []).push(action); }
  closest() { return this.attrs.role === 'button' ? this : null; }
  fire(event, details) { for (const action of this.events[event] ?? []) action({ target: this, preventDefault() {}, ...details }); }
}
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'src/styles/main.css'), 'utf8');
assert.doesNotMatch(html + css, /office-lighting|office-glow|office-light-drift/);
const nodes = Object.fromEntries([...html.matchAll(/id="([^"]+)"/g)].map(([, id]) => [id, new Element()]));
for (const [, id, attributes] of html.matchAll(/<main [^>]*id="([^"]+)"([^>]*)>/g)) {
  nodes[id].hidden = /\bhidden\b/.test(attributes);
}
nodes.game.clientWidth = 1280;
nodes.game.clientHeight = 720;
nodes['office-scene'].offsetWidth = 2160;
const music = nodes['menu-music'];
const scream = nodes['jumpscare-sound'];
const radio = nodes['radio-music'];
const radioButton = nodes['office-radio'];
for (const audio of [music, scream, radio]) {
  audio.paused = true;
  audio.play = () => {
    audio.paused = false;
    return Promise.resolve();
  };
  audio.pause = () => { audio.paused = true; };
}
const document = new Element();
document.querySelector = selector => selector === '.title-content' ? titleContent : nodes[selector.slice(1)];
const titleContent = new Element();
document.createElement = () => new Element();
document.createElementNS = () => new Element();
const window = new Element();
window.location = { search: '?debug=1' };
let frame;
let frameId = 0;
let now = 0;
let characterRules;
let startingCharacterRules;
let movement;
const math = Object.create(Math);
let randomValue = () => 0;
math.random = () => randomValue();
const warnings = [];
const samples = new Map();
const playedSamples = [];
const storage = new Map();
const progressKey = 'nnn.campaign.completed';
const context = vm.createContext({
  window, document, Element, URLSearchParams, URL, Math: math, performance: { now: () => now },
  localStorage: {
    getItem: key => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value)
  },
  Audio: class {
    paused = true;
    constructor(source) {
      assert(fs.existsSync(path.join(root, source)), source);
      this.file = source.replace('./public/', '');
      samples.set(this.file, this);
    }
    play() {
      playedSamples.push(this.file);
      this.paused = false;
      return Promise.resolve();
    }
    pause() { this.paused = true; }
  },
  Image: class {
    complete = true;
    set src(value) {
      assert(fs.existsSync(path.join(root, value)), value);
      this.naturalWidth = 1;
      queueMicrotask(() => this.onload?.());
    }
  },
  console: { warn: message => warnings.push(message), info() {}, error: console.error },
  async fetch(url) {
    assert(url.pathname.startsWith('/NNN/config/'));
    const data = JSON.parse(fs.readFileSync(path.join(root, url.pathname.slice('/NNN/'.length)), 'utf8'));
    // Keep the layout and controls tests independent of random movement.
    if (url.pathname.endsWith('/characters.json')) {
      for (const actor of Object.values(data)) actor.interval = 1000;
      characterRules = data;
      startingCharacterRules = structuredClone(data);
    }
    if (url.pathname.endsWith('/threats.json')) data.clown.growthIncreasePerLevel = 0;
    return { ok: true, json: async () => data };
  },
  setTimeout: () => 1, clearTimeout() {},
  requestAnimationFrame(fn) { frame = fn; return ++frameId; },
  cancelAnimationFrame(id) { if (id === frameId) frame = undefined; },
  ResizeObserver: class { observe() {} }
});
const step = time => { now = time; const callback = frame; frame = undefined; callback?.(now); };
for (const [, src] of html.matchAll(/<script defer src="([^"]+)"/g)) {
  document.currentScript = { src: new URL(src, 'https://test.invalid/NNN/').href };
  await vm.runInContext(fs.readFileSync(path.join(root, src), 'utf8'), context, { filename: src });
  if (src === './src/movement.js') {
    const { createMovement } = window.NathGame;
    window.NathGame.createMovement = (...args) => movement = createMovement(...args);
  }
}
assert.equal(nodes['entry-screen'].hidden, false);
assert(!nodes['local-config-files']);
assert.equal(nodes['title-screen'].hidden, true);
assert.equal(nodes.game.hidden, true);
document.fire('keydown', { key: 'm' });
assert.equal(music.paused, true);
nodes['enter-game'].fire('click');
assert.equal(nodes['entry-screen'].hidden, true);
assert.equal(nodes['title-screen'].hidden, false);
assert.equal(nodes.game.hidden, true);
assert.equal(music.paused, false);
assert.equal(music.currentTime, 27);
assert.equal(music.volume, .08);
document.fire('keydown', { key: 'm' });
assert.equal(nodes.game.dataset.mode, undefined);
assert.equal(frame, undefined);
music.fire('playing');
music.currentTime = 28;
step(1_000);
assert(Math.abs(music.volume - .33) < .001);
music.currentTime = 29;
step(2_000);
assert.equal(music.volume, .58);
now = 600_000;
const intro = nodes['night-intro'];
const introTitle = nodes['night-intro-title'];
const finishIntro = (label, phase = 'cover') => {
  assert.equal(intro.hidden, false);
  assert.equal(nodes.game.inert, true);
  assert.equal(intro.dataset.phase, phase);
  assert.equal(introTitle.textContent, label);
  const beforeCard = movement.snapshot();
  const wasHidden = nodes.game.hidden;
  intro.fire('animationend', { target: new Element(), animationName: 'newspaper-fade' });
  assert.equal(nodes.game.hidden, wasHidden);
  step(now + (phase === 'newspaper' ? 7000 : 550));
  intro.fire('animationend', { animationName: phase === 'newspaper' ? 'night-intro' : 'night-cover' });
  assert.equal(intro.dataset.phase, 'card');
  step(now + 2400);
  assert.deepEqual(movement.snapshot(), beforeCard);
  introTitle.fire('animationend', { animationName: 'night-card' });
  assert.equal(nodes.game.hidden, false);
  assert.equal(nodes.game.inert, true);
  assert.equal(nodes['title-screen'].hidden, true);
  assert.equal(intro.dataset.phase, 'reveal');
  const prepared = movement.snapshot();
  const actors = movement.diagnostics();
  assert.equal(prepared.now, 0);
  assert.equal(prepared.hours, 0);
  document.fire('keydown', { key: 'j' });
  step(now + 850);
  assert.equal(frame, undefined);
  assert.deepEqual(movement.snapshot(), prepared);
  assert.deepEqual(movement.diagnostics(), actors);
  intro.fire('animationend', { animationName: 'night-reveal' });
  assert.equal(intro.hidden, true);
  assert.equal(nodes.game.inert, false);
  assert.equal(nodes['night-mode'].textContent, label);
  assert.equal(movement.snapshot().now, 0);
};
const startNewGame = () => {
  nodes['start-game'].fire('click');
  assert.equal(nodes.game.hidden, true);
  assert.equal(nodes['title-screen'].inert, true);
  finishIntro('NOITE 1', 'newspaper');
};
startNewGame();
assert.deepEqual(nodes['office-characters'].children.filter(image => !image.hidden), []);
assert.match(nodes['movement-debug'].textContent, /Palhaça · 0\.0/);
assert.equal(nodes['office-gate'].disabled, true);
const initialMap = nodes['map-canvas'].children[0].children;
assert(initialMap.find(node => node.attrs['aria-label'] === 'Portões')
  .children.every(node => node.attrs['aria-disabled'] === 'true'));
assert.equal(nodes['smores-room'].hidden, false);
assert.equal(nodes['smores-vent'].hidden, true);
nodes['office-monitor'].fire('click');
nodes['open-cameras'].fire('click');
for (const [id, art] of [['CAM03', 'todas'], ['CAM04', 'open/platinada'], ['CAM09', '01-maid-sentada']]) {
  initialMap.find(node => node.attrs['data-cam'] === id).fire('click');
  assert.equal(nodes['feed-art'].src, `./public/images/cameras/${id}/states/${art}.webp`);
}
initialMap.find(node => node.attrs['data-cam'] === 'CAM12').fire('click');
assert.equal(nodes['shadow-feed'].hidden, false);
assert.equal(nodes['shadow-feed'].dataset.phase, 'idle');
assert.equal(nodes['shadow-manifest'].hidden, true);
initialMap.find(node => node.attrs['data-cam'] === 'CAM09').fire('click');
assert.equal(nodes['shadow-feed'].hidden, true);
nodes['monitor-exit'].fire('click');
const customStart = levels => {
  if (!nodes.game.hidden) nodes['complete-menu'].fire('click');
  nodes['open-custom'].fire('click');
  const selectors = nodes['custom-levels'].children.map(label => label.children[1]);
  for (const select of selectors) {
    assert.deepEqual(select.children.map(option => option.value), Array.from({ length: 11 }, (_, level) => String(level)));
    select.value = String(levels[select.name] ?? 0);
  }
  nodes['custom-form'].fire('submit');
  finishIntro('CUSTOM NIGHT');
};
customStart({ padrao: 1, gotica: 1, yandere: 1, maid: 1, gatinha: 1 });
const nightStart = now;
assert.equal(nodes['title-screen'].hidden, true);
assert.equal(nodes.game.hidden, false);
assert.equal(music.paused, true);
step(nightStart + 100);
assert.match(nodes['clock-label'].innerHTML, /^12 /);
assert.match(nodes['movement-debug'].textContent, /Padrão.*918\.4 s/);
const svg = nodes['map-canvas'].children[0];
const cameras = svg.children.filter(node => node.attrs['data-cam']);
const gates = svg.children.find(node => node.attrs['aria-label'] === 'Portões').children;
const camera = id => cameras.find(node => node.attrs['data-cam'] === id).fire('click');
const gate = id => gates.find(node => node.attrs['data-gate'] === id).fire('click');
const isClosed = id => gates.find(node => node.attrs['data-gate'] === id).attrs['aria-pressed'] === 'true';
assert(!svg.children.some(node => node.attrs.class === 'map-tracking'));
assert(!svg.children.some(node => node.attrs['data-actor']));
assert.doesNotMatch(html + css, /Painel Geral|systems-view|locator-|restart-all|animatronic-marker/i);
const check = expected => {
  const src = nodes['feed-art'].src;
  assert.equal(src, expected === 'closed-closed'
    ? './public/images/cameras/CAM05/base.webp'
    : `./public/images/cameras/CAM05/states/${expected}/vazia.webp`);
  assert.equal(nodes['technical-feed'].hidden, true);
  assert.equal(nodes['cam-number'].textContent, 'CAM 05');
  assert(fs.existsSync(path.join(root, src)), src);
};
assert.equal(cameras.length, 12);
assert.equal(gates.length, 9);
const openings = window.NathGame.VENUE.openings;
assert(!openings.some(opening => opening.id === 'P17'));
const backstage = openings.find(opening => opening.id === 'G06');
assert.equal(backstage.axis, 'H');
assert.equal(backstage.at, 22.2);
assert.equal((backstage.start + backstage.end) / 2, 20);
const office = view => {
  assert.equal(nodes['office-art'].src, window.NathGame.OFFICE.images[view]);
  assert(fs.existsSync(path.join(root, nodes['office-art'].src)));
};
const pressW = details => document.fire('keydown', { key: 'w', ...details });
const releaseW = () => document.fire('keyup', { key: 'w' });
const pointer = { button: 0, pointerId: 1 };
const officeLight = nodes['office-light'];
const officeGate = nodes['office-gate'];
office('dark');
document.fire('keydown', { key: 'f' }); office('dark');
assert(!nodes['left-door']);
pressW(); office('lit');
assert.equal(playedSamples.at(-1), '07_FNAF4_Flashlight.mp3');
const flashlightSampleCount = playedSamples.length;
pressW({ repeat: true }); office('lit');
officeLight.fire('pointerdown', pointer); office('lit');
assert.equal(playedSamples.length, flashlightSampleCount);
releaseW(); office('lit');
officeLight.fire('pointerup', pointer); office('dark');
pressW({ key: 'W' }); office('lit');
window.fire('blur'); office('dark');
officeLight.fire('pointerdown', pointer); office('lit');
officeLight.fire('pointercancel', pointer); office('dark');
officeGate.fire('click'); office('closed');
assert(isClosed('G01'));
officeLight.fire('pointerdown', pointer); office('closed');
officeGate.fire('click'); office('dark');
assert(!isClosed('G01'));
pressW(); office('lit');
document.fire('keydown', { key: 's' });
assert.equal(nodes['computer-desktop'].hidden, false);
document.fire('keydown', { key: 'Escape' });
assert.equal(nodes['computer-desktop'].hidden, false);
nodes['monitor-exit'].fire('click');
assert.equal(nodes['computer-desktop'].hidden, true);
nodes['office-monitor'].fire('click');
assert.equal(nodes['computer-desktop'].hidden, false);
nodes['desktop-power'].fire('click');
assert.equal(nodes['computer-desktop'].hidden, true);
assert.equal(nodes.game.getAttribute('data-computer-off'), '');
assert.equal(nodes['office-monitor'].disabled, true);
assert.equal(nodes['office-power'].getAttribute('aria-pressed'), 'false');
nodes['office-monitor'].fire('click');
assert.equal(nodes['computer-desktop'].hidden, true);
nodes['office-power'].fire('click');
assert.equal(nodes.game.getAttribute('data-computer-off'), null);
assert.equal(nodes['office-monitor'].disabled, false);
nodes['office-monitor'].fire('click');
assert.equal(nodes['computer-desktop'].hidden, false);
assert.equal(nodes['cameras-view'].hidden, true);
assert.match(nodes['task-time'].textContent, /^\d{2}:\d{2}$/);
assert.match(nodes['task-date'].textContent, /^\d{2}\/\d{2}\/\d{4}$/);

// The camera app retains its window state across the taskbar and monitor.
nodes['open-cameras'].fire('click');
nodes['maximize-cameras'].fire('click');
camera('CAM08');
nodes['monitor-exit'].fire('click');
nodes['office-monitor'].fire('click');
assert.equal(nodes['taskbar-cameras'].attrs['aria-pressed'], 'true');
assert.equal(nodes['cameras-view'].hidden, false);
assert(Object.hasOwn(nodes['cameras-view'].dataset, 'maximized'));
assert.equal(nodes['cam-number'].textContent, 'CAM 08');
nodes['minimize-cameras'].fire('click');
assert.equal(nodes['cameras-view'].hidden, true);
assert(Object.hasOwn(nodes['taskbar-cameras'].dataset, 'open'));
nodes['taskbar-cameras'].fire('click');
assert(Object.hasOwn(nodes['cameras-view'].dataset, 'maximized'));
nodes['taskbar-cameras'].fire('click');
assert.equal(nodes.game.dataset.mode, 'desktop');
nodes['taskbar-cameras'].fire('click');
nodes['close-cameras'].fire('click');
assert(!Object.hasOwn(nodes['taskbar-cameras'].dataset, 'open'));

nodes['open-start'].fire('click');
assert.equal(nodes['start-menu'].hidden, false);
nodes['start-cameras'].fire('click');
assert.equal(nodes['start-menu'].hidden, true);
assert.equal(nodes['cameras-view'].hidden, false);
nodes['show-desktop'].fire('click');
assert.equal(nodes['cameras-view'].hidden, true);
nodes['taskbar-cameras'].fire('click');
nodes['close-cameras'].fire('click');
nodes['open-cameras'].fire('click'); office('dark');
assert(!Object.hasOwn(nodes['cameras-view'].dataset, 'maximized'));
pressW(); office('dark');
camera('CAM05'); check('open-open');
const signal = nodes['camera-static'];
const assertGatePulse = () => {
  assert.equal(signal.hidden, false);
  assert.equal(signal.dataset.kind, 'gate');
  assert.equal(runningAnimations.size, 3);
  for (const animation of runningAnimations) assert.equal(animation.options.duration, 650);
};
// Corrected visual mapping: screen-left G04; screen-right G05.
gate('G04'); check('closed-open'); assertGatePulse();
const firstPulse = [...runningAnimations];
gate('G05'); check('closed-closed'); assertGatePulse();
assert(firstPulse.every(animation => !runningAnimations.has(animation)));
gate('G04'); check('open-closed'); assertGatePulse();
gate('G05'); check('open-open'); assertGatePulse();
step(now + 650);
assert.equal(signal.hidden, true);
assert.equal(runningAnimations.size, 0);
// Unrelated gates leave CAM05 alone. A fourth closure reopens the latest
// previous closure, and the feed must update in the same interaction.
gate('G01'); gate('G02'); assert.equal(signal.hidden, true);
gate('G04'); check('closed-open');
gate('G03'); check('open-open'); assert(!isClosed('G04')); assertGatePulse();
gate('G05'); check('open-closed'); assert(!isClosed('G03'));
// State changes while another camera is selected must be visible on return.
camera('CAM01');
const otherSrc = nodes['feed-art'].src;
gate('G04'); assert.equal(nodes['feed-art'].src, otherSrc);
assert.equal(signal.dataset.kind, 'switch');
assert(!isClosed('G05'));
camera('CAM05'); check('closed-open');
assert.equal(signal.dataset.kind, 'switch');
assert(window.NathGame.setCam05VipState('original'));
gate('G04'); assertGatePulse();
assert.match(nodes['feed-art'].src, /CAM05\/states\/open-open\/original\.webp$/);
gate('G04'); assert.match(nodes['feed-art'].src, /CAM05\/states\/closed-open\/original\.webp$/);
assert(window.NathGame.setCam05VipState('vazia'));
nodes['close-cameras'].fire('click');
nodes['close-desktop'].fire('click');
radioButton.fire('click');
radio.fire('playing');
nodes['office-monitor'].fire('click');
nodes['open-cameras'].fire('click'); check('closed-open');
// Resetting the night restores both the map and the default open-open image.
for (let time = nightStart + 200; time <= nightStart + 360_000; time += 100) step(time);
assert.equal(nodes['shift-complete'].hidden, false);
assert.equal(nodes['next-shift'].hidden, true);
assert.equal(storage.has(progressKey), false);
assert.equal(frame, undefined);
assert.equal(runningAnimations.size, 0);
assert.equal(radio.paused, true);
const chimes = samples.get('11_FNAF2_Chimes.mp3');
assert.equal(chimes.paused, false);
nodes['restart-shift'].fire('click');
finishIntro('CUSTOM NIGHT');
assert.equal(chimes.paused, true);
assert(gates.every(node => node.attrs['aria-pressed'] === 'false'));
nodes['office-monitor'].fire('click'); nodes['open-cameras'].fire('click'); camera('CAM05'); check('open-open'); office('dark');
// G01 controls the office, and the flashlight cannot reveal a closed gate.
gate('G01'); office('closed');
nodes['close-cameras'].fire('click'); office('closed');
pressW(); office('closed');
nodes['office-monitor'].fire('click'); nodes['open-cameras'].fire('click');
gate('G01'); office('dark');
gate('G02'); gate('G03'); gate('G01'); office('closed');
gate('G06'); assert(!isClosed('G01')); office('dark');
nodes['close-cameras'].fire('click');
nodes['close-desktop'].fire('click');
pressW(); office('lit');
nodes['office-monitor'].fire('click'); nodes['open-cameras'].fire('click'); office('dark');
// The southern hall gate controls only the large left shutter in CAM04.
const checkHall = open => assert.equal(nodes['feed-art'].src,
  `./public/images/cameras/CAM04/states/${open ? 'open' : 'closed'}/platinada.webp`);
camera('CAM04'); checkHall(true);
gate('G08'); checkHall(false);
gate('G08'); checkHall(true);
camera('CAM09');
assert.equal(nodes['feed-art'].src, './public/images/cameras/CAM09/states/01-maid-sentada.webp');
assert.equal(nodes['technical-feed'].hidden, true);
gate('G08');
camera('CAM04'); checkHall(false);
gate('G07'); assert(!isClosed('G08')); checkHall(true);
// The relocated G06 reveals the backstage on CAM12.
const checkBackstage = open => {
  const src = nodes['feed-art'].src;
  assert.equal(src, open
    ? './public/images/cameras/CAM12/states/open/vazia.webp'
    : './public/images/cameras/CAM12/base.webp');
  assert(fs.existsSync(path.join(root, src)), src);
};
camera('CAM12'); checkBackstage(true);
gate('G06'); checkBackstage(false);
gate('G06'); checkBackstage(true);
camera('CAM09');
gate('G06');
camera('CAM12'); checkBackstage(false);
gate('G07'); assert(!isClosed('G06')); checkBackstage(true);
// Check every registered asset after the move, including inactive states.
for (const cam of window.NathGame.CAMERAS) {
  camera(cam.id);
  assert.equal(nodes['cam-number'].textContent, cam.id.replace('CAM', 'CAM '));
  const folder = `./public/images/cameras/${cam.id}`;
  assert.equal(cam.image, `${folder}/base.webp`);
  assert.equal(cam.technical, `${folder}/technical.png`);
  assert.equal(cam.renderAvailable, true);
  assert.equal(nodes['technical-feed'].hidden, true);
  const gateImages = Object.values(cam.gateStateImages?.images ?? {});
  const characterImages = Object.values(cam.characterStateImages ?? cam.stageStateImages ?? {})
    .flatMap(view => typeof view === 'string' ? [view] : Object.values(view));
  for (const src of [cam.image, cam.technical, nodes['feed-art'].src, `${folder}/master.png`, ...gateImages, ...characterImages]) {
    assert(src.startsWith(`${folder}/`), src);
    assert(fs.existsSync(path.join(root, src)), src);
  }
}
// Every character can be absent, on stage or in the hall, with no duplicates.
camera('CAM03');
const stageCast = ['original', 'yandere', 'gotica'];
let floorCases = 0;
for (let assignment = 0; assignment < 27; assignment++) {
  const stage = stageCast.filter((_, index) => Math.floor(assignment / 3 ** index) % 3 === 1);
  const floor = stageCast.filter((_, index) => Math.floor(assignment / 3 ** index) % 3 === 2);
  if (!floor.length) continue;
  const key = `palco-${stage.join('-') || 'vazio'}--salao-${floor.join('-')}`;
  assert(window.NathGame.setCam03StageState(key), key);
  assert.equal(nodes['feed-art'].src, `./public/images/cameras/CAM03/states/${key}.webp`);
  floorCases++;
}
assert.equal(floorCases, 19);
assert.equal(window.NathGame.setCam03StageState('palco-original--salao-original'), false);

// Each legal office arrangement must preserve the lateral doorway occupant across G01.
const { OFFICE, setOfficeCharacterState } = window.NathGame;
const closetArt = nodes['closet-door-art'];
const closetRoot = './public/images/office/closet/states';
const closetFrames = { open: new Set(), closed: new Set() };
const closetFrame = (gateState, room = [], doorway = null) => {
  const name = `sala-${room.join('-') || 'vazia'}--porta-${doorway || 'vazia'}.webp`;
  assert.equal(closetArt.src, `${closetRoot}/${gateState}/${name}`);
  closetFrames[gateState].add(name);
};
const visibleOfficeLayers = () => nodes['office-characters'].children
  .filter(image => !image.hidden).map(image => image.src);
const officeLayer = (location, character) => `./public/images/office/characters/${location}/${character}.webp`;
for (const id of ['G01', 'G02', 'G03', 'G04', 'G05', 'G06', 'G07', 'G08', 'G09']) {
  if (isClosed(id)) gate(id);
}
const officeCharacters = [...OFFICE.characters];
let officeCases = 0;
for (let mask = 0; mask < (1 << officeCharacters.length); mask++) {
  const room = officeCharacters.filter((_, index) => mask & (1 << index));
  if (room.length > 3) continue;
  for (const doorway of [null, ...officeCharacters]) {
    if (room.includes(doorway)) continue;
    assert(setOfficeCharacterState(room, doorway));
    const expected = room.map(character => officeLayer('room', character));
    if (doorway) expected.unshift(officeLayer('doorway', doorway));
    for (const src of expected) assert(fs.existsSync(path.join(root, src)), src);
    assert.deepEqual(visibleOfficeLayers(), expected);
    office('dark');
    closetFrame('open', room, doorway === 'maid' ? null : doorway);
    gate('G01');
    office('closed');
    closetFrame('closed', room, doorway === 'maid' ? null : doorway);
    assert.deepEqual(visibleOfficeLayers(), expected);
    gate('G01');
    officeCases += 2;
  }
}
assert.equal(officeCases, 202);
for (const [gateState, names] of Object.entries(closetFrames)) {
  assert.equal(names.size, 86);
  assert.deepEqual(new Set(fs.readdirSync(path.join(root, closetRoot, gateState))), names);
}
assert(setOfficeCharacterState(OFFICE.characters.slice(0, 4)));
assert(!setOfficeCharacterState(['maid', 'maid']));
assert(!setOfficeCharacterState(['original'], 'original'));
assert(!setOfficeCharacterState([], 'desconhecida'));
assert(setOfficeCharacterState(['original'], 'maid'));
nodes['close-cameras'].fire('click');
nodes['close-desktop'].fire('click');
pressW(); office('dark');
assert.deepEqual(visibleOfficeLayers(), [officeLayer('doorway', 'maid'), officeLayer('room', 'original')]);
assert(setOfficeCharacterState());
assert.deepEqual(visibleOfficeLayers(), []);
pressW(); office('lit');
for (const doorway of officeCharacters) {
  assert(setOfficeCharacterState([], doorway));
  office('lit');
  closetFrame('open', [], doorway === 'maid' ? null : doorway);
  assert.deepEqual(visibleOfficeLayers(), [officeLayer('doorway', doorway)]);
  releaseW(); office('dark');
  pressW(); office('lit');
}
assert(setOfficeCharacterState(['original'], 'maid'));
office('dark');
pressW(); office('dark');
assert(setOfficeCharacterState([], 'maid'));
office('dark');
pressW(); office('lit');
console.log('PASS: 12 camera folders, all gate states, 208 office combinations and 172 closet frames.');

// The closet only exits through the slatted door. Turning resets the flashlight.
customStart({});
nodes.game.clientWidth = 1280;
nodes['office-scene'].offsetWidth = 2160;
const closetStart = now;
const closet = nodes['closet-view'];
const closetExit = nodes['closet-exit'];
const closetBeam = nodes['closet-beam'];
const closetLight = nodes['closet-light'];
const press = (key, details) => document.fire('keydown', { key, ...details });
nodes['office-closet'].fire('click');
assert.equal(nodes.game.dataset.closetTransition, 'enter');
assert.equal(playedSamples.at(-1), '06_FNAF4_Player_Running.mp3');
press('s');
assert.equal(nodes.game.dataset.mode, 'office');
step(closetStart + 1000);
assert.equal(nodes.game.dataset.mode, 'closet');
assert.equal(closet.dataset.view, 'door');
assert.deepEqual(playedSamples.slice(-2), ['06_FNAF4_Player_Running.mp3', '01_FNAF2_Music_Box.mp3']);
const musicBox = samples.get('01_FNAF2_Music_Box.mp3');
assert.equal(musicBox.loop, true);
const doorVolume = musicBox.volume;
musicBox.currentTime = .5;
assert(setOfficeCharacterState(['gotica', 'original'], 'yandere'));
closetFrame('open', ['original', 'gotica'], 'yandere');
assert.equal(nodes['computer-desktop'].hidden, true);
step(closetStart + 1500);
press('w');
assert.equal(closetBeam.hidden, true);
press('a');
press('ArrowRight');
assert.equal(nodes.game.dataset.closetTransition, undefined);
press('d');
step(closetStart + 2150);
assert.equal(closet.dataset.view, 'back');
assert(musicBox.volume > doorVolume && musicBox.volume < .1);
assert.equal(musicBox.currentTime, .5);
assert.equal(closetExit.hidden, true);
closetExit.fire('click');
assert.equal(nodes.game.dataset.closetTransition, undefined);
press('W');
assert.equal(closetBeam.hidden, false);
assert.match(closetBeam.src, /sleeping\.webp$/);
assert.equal(movement.snapshot().clownStage, -1);
assert.equal(playedSamples.at(-1), '07_FNAF4_Flashlight.mp3');
press('w', { repeat: true });
assert.equal(closetBeam.hidden, false);
releaseW();
assert.equal(closetBeam.hidden, true);
closetLight.fire('pointerdown', pointer);
assert.equal(closetBeam.hidden, false);
closetLight.fire('lostpointercapture', pointer);
assert.equal(closetBeam.hidden, true);
closetLight.fire('pointerdown', pointer);
assert.equal(closetBeam.hidden, false);
press('d');
assert.equal(nodes.game.dataset.closetTransition, undefined);
press('a');
step(closetStart + 2800);
assert.equal(closet.dataset.view, 'door');
assert.equal(closetBeam.hidden, true);
closetExit.fire('click');
step(closetStart + 3900);
assert.equal(nodes.game.dataset.mode, 'office');
assert.equal(closet.hidden, true);
assert.equal(musicBox.paused, true);
assert.equal(nodes['computer-desktop'].hidden, true);
office('dark');
console.log('PASS: closet entry, blocked monitor, both views, flashlight and slatted-door exit.');

customStart({ smores: 1 });
const smoresStart = now;
const ventArt = nodes['smores-vent'];
const roomArt = nodes['smores-room'];
assert(nodes['custom-levels'].children.some(label => label.children[1].name === 'smores'));
radioButton.fire('click');
radio.fire('playing');
step(smoresStart + 15_010);
assert.equal(ventArt.hidden, true);
const afterRadio = playedSamples.length;
nodes['office-monitor'].fire('click');
step(smoresStart + 15_020);
assert.equal(ventArt.hidden, false);
assert.equal(roomArt.hidden, true);
assert.equal(playedSamples.slice(afterRadio).filter(file => file === '02_FNAF2_Vent.mp3').length, 1);
nodes['monitor-exit'].fire('click');
officeGate.fire('click');
office('closed');
assert.equal(ventArt.hidden, false);
assert.equal(playedSamples.at(-1), 'SFXBible_12478.ogg');
officeGate.fire('click');
office('dark');
nodes['office-monitor'].fire('click');
step(smoresStart + 15_030);
nodes['open-cameras'].fire('click');
const beforeMapGate = playedSamples.length;
gate('G01');
assert(!playedSamples.slice(beforeMapGate).includes('SFXBible_12478.ogg'));
nodes['monitor-exit'].fire('click');
assert.equal(ventArt.hidden, true);
assert.equal(roomArt.hidden, false);
nodes['office-closet'].fire('click');
step(smoresStart + 16_500);
assert.match(closetArt.src, /Smores nas Frestas/);
assert.equal(nodes['closet-extra'].hidden, true);
step(smoresStart + 51_000);
assert.equal(roomArt.hidden, true);
assert.equal(nodes['closet-extra'].hidden, false);
assert(!closetArt.src.includes('Smores'));
customStart({});
console.log('PASS: Smores custom difficulty, layered office and closet art, vent and office gate sounds.');

// A defeat holds a one-shot GIF and waits for the player to return to the menu.
const [, screamSource] = html.match(/<audio id="jumpscare-sound" src="([^"]+)"/);
assert(fs.existsSync(path.join(root, screamSource)));
const scare = nodes['jumpscare-art'];
scare.complete = true;
scare.naturalWidth = 178;
const phase = () => nodes.game.dataset.defeat;
const pressJ = details => document.fire('keydown', { key: 'j', ...details });
const seenScares = new Set();
for (let attempt = 0; attempt < 7; attempt++) {
  const scareStart = now;
  randomValue = () => (attempt % 6) / 6;
  if (attempt === 5) nodes['office-monitor'].fire('click');
  pressJ({ repeat: true });
  assert.equal(phase(), undefined);
  pressJ({ key: 'J' });
  assert.equal(phase(), 'blackout');
  assert.equal(nodes.playfield.inert, true);
  const chosen = scare.src;
  const source = chosen.split('?')[0];
  if (attempt === 5) {
    assert.match(source, /palhaca-direita\.gif$/);
    assert.equal(nodes.game.dataset.mode, 'office');
    assert.equal(nodes['office-view'].hidden, false);
  }
  assert(!fs.readFileSync(path.join(root, source)).includes('NETSCAPE2.0'), source);
  if (seenScares.has(source)) assert.notEqual(chosen, source);
  seenScares.add(source);
  assert.equal(scream.paused, false);
  assert.equal(scream.currentTime, 0);
  scream.currentTime = .1;
  randomValue = () => .99;
  pressJ();
  assert.equal(scare.src, chosen);
  assert.equal(scream.currentTime, .1);
  step(scareStart + 110);
  assert.equal(phase(), 'scare');
  step(scareStart + 1070);
  assert.equal(phase(), 'scare');
  assert.equal(scare.src, chosen);
  step(scareStart + 1320);
  assert.equal(phase(), 'flash');
  assert.equal(scare.getAttribute('src'), null);
  step(scareStart + 1550);
  assert.equal(phase(), 'over');
  assert.equal(nodes['game-over'].hidden, false);
  step(scareStart + 30_000);
  assert.equal(phase(), 'over');
  assert.equal(nodes['title-screen'].hidden, true);
  assert.equal(nodes['game-over'].hidden, false);
  nodes['return-to-menu'].fire('click');
  assert.equal(nodes.game.hidden, true);
  assert.equal(nodes['title-screen'].hidden, false);
  assert.equal(nodes['game-over'].hidden, true);
  assert.equal(scream.paused, true);
  assert.equal(music.paused, false);
  pressJ();
  assert.equal(phase(), undefined);
  startNewGame();
  assert.equal(nodes.game.hidden, false);
  assert.equal(nodes.playfield.inert, false);
  assert.equal(nodes.game.dataset.mode, 'office');
  assert.equal(nodes['clock-label'].innerHTML, '12 <small>AM</small>');
  assert.equal(nodes['cam-number'].textContent, 'CAM 01');
  assert(gates.every(node => node.attrs['aria-pressed'] === 'false'));
  assert.deepEqual(visibleOfficeLayers(), []);
}
assert.equal(seenScares.size, 6);
console.log('PASS: six one-shot jumpscares, including the clown from the right in the office.');

const bottomGif = './public/images/jumpscares/palhaca-baixo.gif';
assert(!fs.readFileSync(path.join(root, bottomGif)).includes('NETSCAPE2.0'));
customStart({ palhaca: 1 });
for (const closetState of ['door', 'lit', 'turning']) {
  const entry = now;
  nodes['office-closet'].fire('click');
  step(entry + 1450);
  if (closetState !== 'door') press('d');
  if (closetState === 'lit') {
    step(entry + 2090);
    press('w');
    assert.equal(closetBeam.hidden, false);
  }
  const scareStart = now;
  randomValue = () => { throw new Error('The closet scare must not use randomness'); };
  pressJ();
  assert.equal(phase(), 'blackout');
  assert.equal(nodes.game.dataset.scare, 'clown-bottom');
  assert.equal(nodes.game.dataset.closetTransition, undefined);
  assert.equal(closetBeam.hidden, true);
  assert.equal(scare.src.split('?')[0], bottomGif);
  if (closetState !== 'door') assert.notEqual(scare.src, bottomGif);
  step(scareStart + 110);
  assert.equal(phase(), 'scare');
  step(scareStart + 1639);
  assert.equal(phase(), 'scare');
  step(scareStart + 1640);
  assert.equal(phase(), 'flash');
  step(scareStart + 1870);
  assert.equal(phase(), 'over');
  nodes['return-to-menu'].fire('click');
  assert.equal(nodes.game.dataset.scare, undefined);
  randomValue = () => 0;
  customStart({ palhaca: 1 });
}
console.log('PASS: J always picks the bottom clown inside the closet, including with the light on or while turning.');


const peek = nodes['clown-peek'];
const [, peekSource] = html.match(/id="clown-peek" src="([^"]+)"/);
assert(fs.existsSync(path.join(root, peekSource)));
const start = now;
step(start + 23_749);
assert.match(closetBeam.src, /clown\/sleeping\.webp$/);
step(start + 23_751);
assert.match(closetBeam.src, /clown\/eyes-lit\.webp$/);
const tracks = new Set();
for (const draw of [0, .5, .99]) {
  randomValue = () => draw;
  radioButton.fire('click');
  assert.equal(radioButton.getAttribute('aria-pressed'), 'true');
  assert(fs.existsSync(path.join(root, radio.src)));
  tracks.add(radio.src);
  if (draw < .99) radioButton.fire('click');
}
assert.equal(tracks.size, 3);
radio.fire('playing');
step(now + 10_000);
assert.match(closetBeam.src, /clown\/sleeping\.webp$/);
radioButton.fire('click');
document.fire('click');
const quiet = now;
step(quiet + 98_751);
assert.equal(peek.hidden, false);
step(quiet + 123_751);
assert.match(scare.src.split('?')[0], /palhaca-direita\.gif$/);
console.log('PASS: three radio tracks, clown poses, music reduction, peek and automatic defeat.');

nodes['return-to-menu'].fire('click');
randomValue = () => 0;
Object.assign(characterRules.padrao, { start: 2, positions: [2, 19], interval: 10 });
customStart({ padrao: 4 });
const forcedGateStart = now;
nodes['office-monitor'].fire('click');
nodes['open-cameras'].fire('click');
camera('CAM12');
gate('G06'); checkBackstage(false);
step(forcedGateStart + 9000);
assert(isClosed('G06'));
checkBackstage(false);
assert.match(nodes['movement-debug'].textContent, /c.mera observada/);
camera('CAM05');
step(forcedGateStart + 9200);
assert(!isClosed('G06'));
camera('CAM12');
assert(nodes['feed-art'].src.includes('CAM12/states/open/'));
customStart({});
assert.equal(runningAnimations.size, 0);
assert.equal(signal.hidden, true);
console.log('PASS: visual gate pulses in both directions, limit-driven and forced openings, latest art and cleanup.');

Object.assign(characterRules.gotica, { start: 1, positions: [1, 2], interval: 10 });
customStart({ gotica: 1 });
const gothicStart = now;
nodes['office-monitor'].fire('click');
nodes['open-cameras'].fire('click');
camera('CAM03');
step(gothicStart + 10);
step(gothicStart + 8000);
assert.equal(signal.dataset.kind, 'gotica');
assert.equal(runningAnimations.size, 3);
assert([...runningAnimations].every(animation => animation.options.duration === 2000 && animation.currentTime > 0));
camera('CAM05');
assert.equal(signal.dataset.kind, 'gotica');
gate('G04');
assert.equal(signal.dataset.kind, 'gotica');
assert.equal(runningAnimations.size, 3);
step(gothicStart + 10_000);
assert.equal(signal.hidden, true);
assert.equal(runningAnimations.size, 0);
console.log('PASS: Gothic onset follows its simulation event and a concurrent gate reuses the same layers.');

customStart({ shadow: 10 });
nodes['office-monitor'].fire('click');
nodes['open-cameras'].fire('click');
nodes['camera-audio'].fire('click');
assert.equal(playedSamples.at(-1), '01_camera_sinistra/01_miado_agudo_camera.wav');
const audioPin = cameras.find(node => node.attrs['data-cam'] === 'CAM01');
assert(audioPin.classList.contains('audio-pulse'));
assert(cameras.filter(node => node.classList.contains('audio-pulse')).length === 1);
audioPin.children.find(node => node.attrs.class?.includes('pin-audio-echo')).fire('animationend');
assert(!audioPin.classList.contains('audio-pulse'));
nodes['monitor-exit'].fire('click');

const shadowEntry = now;
nodes['office-closet'].fire('click');
step(shadowEntry + 1450);
step(shadowEntry + 107_000);
nodes['closet-exit'].fire('click');
step(shadowEntry + 108_040);
const nightmare = samples.get('08_FNAF4_Nightmare_Jumpscare.mp3');
assert.equal(nightmare.loop, true);
assert.equal(nightmare.paused, false);
nodes['office-monitor'].fire('click');
nodes['open-cameras'].fire('click');
camera('CAM02');
randomValue = () => .99;
nodes['camera-audio'].fire('click');
assert.equal(playedSamples.at(-1), '02_camera_pesadelo/03_miado_curto_pesadelo.wav');
step(shadowEntry + 110_000);
assert.equal(nightmare.paused, false);
camera('CAM01');
step(shadowEntry + 110_100);
assert.equal(nightmare.paused, true);
nodes['monitor-exit'].fire('click');
randomValue = () => 0;
nodes['office-monitor'].fire('click');
nodes['monitor-exit'].fire('click');
assert.equal(nightmare.paused, false);
step(shadowEntry + 117_600);
assert.equal(nodes.game.dataset.scare, 'shadow');
assert.equal(nightmare.paused, true);
assert.equal(scream.paused, false);

nodes['return-to-menu'].fire('click');
Object.assign(characterRules.padrao, { start: 10, positions: [10, 12], interval: 5 });
customStart({ padrao: 1 });
const approachStart = now;
const doorCreak = '04_FNAF4_Door_Creak.mp3';
assert(!playedSamples.includes(doorCreak));
step(approachStart + 3_500);
assert.deepEqual(visibleOfficeLayers(), [officeLayer('doorway', 'original')]);
assert.equal(playedSamples.at(-1), doorCreak);
step(approachStart + 4_000);
assert.equal(playedSamples.filter(file => file === doorCreak).length, 1);
console.log('PASS: samples for both meow sets, flashlight, closet travel, doorway arrival, win and Shadow attack.');
Object.assign(characterRules.yandere, { start: 19, positions: [19, 21], interval: 10 });
Object.assign(characterRules.padrao, { start: 2, positions: [2, 19], interval: 14 });
customStart({ yandere: 1, padrao: 1 });
const faultStart = now;
radioButton.fire('click');
radio.fire('playing');
nodes['office-monitor'].fire('click');
nodes['open-cameras'].fire('click');
camera('CAM05');
gate('G01');
gate('G06');
step(faultStart + 8000);
assert.match(html, /id="camera-offline"[^>]*><strong>SEM SINAL/);
assert.equal(nodes['camera-offline'].hidden, false);
assert.equal(nodes['feed-art'].hidden, true);
assert.equal(nodes['technical-feed'].hidden, true);
assert.equal(nodes['camera-audio'].disabled, true);
assert.equal(signal.dataset.kind, 'electrical');
assert.equal(signal.hidden, false);
assert.equal(runningAnimations.size, 0);
assert(gates.every(node => node.attrs['aria-disabled'] === 'true' && node.attrs.tabindex === '-1'));
assert.equal(officeGate.disabled, true);
gate('G01');
gates.find(node => node.attrs['data-gate'] === 'G01').fire('keydown', { key: 'Enter' });
assert(isClosed('G01') && isClosed('G06'));
assert.equal(radio.paused, false);

camera('CAM12');
assert.equal(nodes['cam-number'].textContent, 'CAM 12');
assert.equal(signal.dataset.kind, 'electrical');
nodes['close-cameras'].fire('click');
assert.equal(signal.hidden, true);
nodes['open-cameras'].fire('click');
assert.equal(nodes['camera-offline'].hidden, false);
assert.equal(signal.dataset.kind, 'electrical');
step(faultStart + 12_000);
assert(!isClosed('G06')); // Physical opening by Padrão during the outage.
assert(isClosed('G01'));
assert.equal(nodes['feed-art'].hidden, true);
assert.equal(gates[0].attrs['aria-disabled'], 'true');

nodes['monitor-exit'].fire('click');
officeGate.fire('click');
assert(isClosed('G01'));
assert.equal(radio.paused, false);
nodes['office-monitor'].fire('click');
nodes['desktop-power'].fire('click');
assert.equal(nodes.game.getAttribute('data-computer-off'), '');
assert.equal(nodes['computer-desktop'].hidden, true);
assert.equal(officeGate.disabled, true);
step(faultStart + 16_000);
assert.equal(officeGate.disabled, true);
nodes['office-power'].fire('click');
assert.equal(playedSamples.at(-1), '10_FNAF3_Rebooting.mp3');
assert.equal(nodes.game.getAttribute('data-computer-off'), null);
assert.equal(officeGate.disabled, false);
nodes['office-monitor'].fire('click');
assert.equal(nodes['camera-offline'].hidden, true);
assert.equal(nodes['feed-art'].hidden, false);
assert.equal(nodes['camera-audio'].disabled, false);
assert.match(nodes['feed-art'].src, /CAM12\/states\/open\//);
assert(gates.every(node => node.attrs['aria-disabled'] === 'false' && node.attrs.tabindex === '0'));
assert(isClosed('G01'));
gate('G01');
assert(!isClosed('G01'));
assert.equal(radio.paused, false);
customStart({});
assert.equal(nodes['camera-offline'].hidden, true);
assert.equal(signal.hidden, true);
console.log('PASS: persistent electrical interference, disabled controls, physical gate opening, radio and manual reboot.');

nodes['complete-menu'].fire('click');
assert.equal(nodes['continue-game'].hidden, true);
Object.assign(characterRules, startingCharacterRules);
randomValue = () => 0;
startNewGame();
const firstActors = movement.diagnostics();
pressJ();
const failedAt = now;
for (const elapsed of [110, 1320, 1550, 2000]) step(failedAt + elapsed);
assert.equal(nodes['game-over'].hidden, false);
assert.equal(storage.has(progressKey), false);
nodes['retry-night'].fire('click');
finishIntro('NOITE 1');
assert.deepEqual(movement.diagnostics(), firstActors);

for (let number = 1; number <= 9; number++) {
  const start = now;
  const sanityVisible = number >= 4;
  const energyVisible = number >= 3;
  assert.equal(nodes['sanity-meter'].hidden, !sanityVisible);
  assert.equal(nodes['sanity-label'].hidden, !sanityVisible);
  assert.equal(nodes['energy-meter'].hidden, !energyVisible);
  assert.equal(nodes['energy-label'].hidden, !energyVisible);
  assert.equal(nodes['resource-hud'].hidden, !energyVisible && !sanityVisible);
  assert.equal(movement.snapshot().energy, 100);
  assert.equal(movement.snapshot().sanity, 100);
  radioButton.fire('click');
  radio.fire('playing');
  step(start + 1);
  const winAfter = ([50, 55][number - 1] ?? 60) * (number === 9 ? 7000 : 6000);
  if (number === 9) {
    step(start + 360_000);
    assert.equal(nodes['shift-complete'].hidden, true);
    assert.match(nodes['clock-label'].innerHTML, /^6 /);
  }
  step(start + winAfter - 1);
  assert.equal(nodes['shift-complete'].hidden, true);
  step(start + winAfter);
  const hour = number === 9 ? 7 : 6;
  assert.equal(nodes['shift-complete'].hidden, false);
  assert.equal(nodes['clock-label'].innerHTML, `${hour} <small>AM</small>`);
  assert.equal(nodes['shift-time'].innerHTML, `${hour}:00 <small>AM</small>`);
  assert.equal(nodes['next-shift'].hidden, number === 9);
  assert.equal(storage.get(progressKey), String(number));
  if (number === 1) {
    nodes['complete-menu'].fire('click');
    assert.equal(nodes['continue-game'].hidden, false);
    assert.equal(nodes['continue-game-label'].textContent, 'Continuar · Noite 2');
    nodes['continue-game'].fire('click');
  } else if (number < 9) nodes['next-shift'].fire('click');
  if (number < 9) finishIntro(`NOITE ${number + 1}`);
}
assert.equal(nodes['shift-result'].textContent, 'Campanha concluída.');
nodes['restart-shift'].fire('click');
finishIntro('NOITE 9');
assert.equal(storage.get(progressKey), '9');
nodes['complete-menu'].fire('click');
assert.equal(nodes['continue-game-label'].textContent, 'Rejogar noite 9');
startNewGame();
assert.equal(storage.get(progressKey), '9');
customStart({ maid: 10 });
assert.deepEqual(Array.from(movement.diagnostics(), ({ key, level }) => [key, level]), [['maid', 10]]);
assert.equal(nodes['energy-meter'].hidden, false);
assert.equal(nodes['sanity-meter'].hidden, false);
console.log('PASS: nine campaign intros and wins, fixed start time, retry, continue, replay and independent custom settings.');
}

test().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
