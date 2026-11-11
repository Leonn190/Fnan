// Run with: node tests/camera-gates.cjs. No browser/server dependencies.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
async function test() {
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
  focus() {}
  setPointerCapture() {}
  addEventListener(event, action) { (this.events[event] ??= []).push(action); }
  closest() { return this.attrs.role === 'button' ? this : null; }
  fire(event, details) { for (const action of this.events[event] ?? []) action({ target: this, preventDefault() {}, ...details }); }
}
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
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
let now = 0;
const math = Object.create(Math);
let randomValue = () => 0;
math.random = () => randomValue();
const warnings = [];
const context = vm.createContext({
  window, document, Element, URLSearchParams, URL, Math: math, performance: { now: () => now },
  Image: class {
    complete = true;
    set src(value) {
      assert(fs.existsSync(path.join(root, value)), value);
      this.naturalWidth = 1;
    }
  },
  console: { warn: message => warnings.push(message), info() {}, error: console.error },
  async fetch(url) {
    const data = JSON.parse(fs.readFileSync(path.join(root, url.pathname), 'utf8'));
    // Keep the layout and controls tests independent of random movement.
    if (url.pathname.endsWith('/characters.json')) {
      for (const actor of Object.values(data)) actor.interval = 1000;
    }
    if (url.pathname.endsWith('/threats.json')) data.clown.growthIncreasePerLevel = 0;
    return { ok: true, json: async () => data };
  },
  setTimeout: () => 1, clearTimeout() {}, requestAnimationFrame: fn => { frame = fn; },
  ResizeObserver: class { observe() {} }
});
const step = time => { now = time; const callback = frame; frame = undefined; callback?.(now); };
for (const [, src] of html.matchAll(/<script defer src="([^"]+)"/g)) {
  document.currentScript = { src: new URL(src, 'https://test.invalid/').href };
  await vm.runInContext(fs.readFileSync(path.join(root, src), 'utf8'), context, { filename: src });
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
nodes['start-game'].fire('click');
assert.deepEqual(nodes['office-characters'].children.filter(image => !image.hidden), []);
assert.match(nodes['movement-debug'].textContent, /Palhaça · 0\.0/);
const customStart = levels => {
  nodes['open-custom'].fire('click');
  const selectors = nodes['custom-levels'].children.map(label => label.children[1]);
  for (const select of selectors) {
    assert.deepEqual(select.children.map(option => option.value), Array.from({ length: 11 }, (_, level) => String(level)));
    select.value = String(levels[select.name] ?? 0);
  }
  nodes['custom-form'].fire('submit');
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
const tracking = svg.children.find(node => node.attrs.class === 'map-tracking').children;
const stageDots = tracking.filter(node => node.attrs['data-position'] === '1');
assert.equal(stageDots.length, 3);
assert.equal(new Set(stageDots.map(node => node.attrs['data-actor'])).size, 3);
assert.equal(new Set(stageDots.map(node => node.attrs.cy)).size, 1);
const centers = stageDots.map(node => Number(node.attrs.cx)).sort((a, b) => a - b);
assert(centers.slice(1).every((center, i) => center - centers[i] > 2 * Number(stageDots[i].attrs.r)));
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
pressW({ repeat: true }); office('lit');
officeLight.fire('pointerdown', pointer); office('lit');
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
assert.equal(nodes['cameras-view'].hidden, true);
assert.equal(nodes['systems-view'].hidden, true);
assert.match(nodes['task-time'].textContent, /^\d{2}:\d{2}$/);
assert.match(nodes['task-date'].textContent, /^\d{2}\/\d{2}\/\d{4}$/);

// The taskbar keeps minimized apps open and restores their window state.
nodes['open-cameras'].fire('click');
nodes['maximize-cameras'].fire('click');
nodes['open-systems'].fire('click');
assert.equal(nodes['cameras-view'].hidden, false);
assert.equal(nodes['taskbar-systems'].attrs['aria-pressed'], 'true');
camera('CAM08');
nodes['monitor-exit'].fire('click');
nodes['office-monitor'].fire('click');
assert.equal(nodes['taskbar-systems'].attrs['aria-pressed'], 'true');
assert.equal(nodes['cameras-view'].hidden, false);
assert(Object.hasOwn(nodes['cameras-view'].dataset, 'maximized'));
assert.equal(nodes['cam-number'].textContent, 'CAM 08');
nodes['minimize-systems'].fire('click');
assert.equal(nodes['systems-view'].hidden, true);
assert(Object.hasOwn(nodes['taskbar-systems'].dataset, 'open'));
assert.equal(nodes['taskbar-cameras'].attrs['aria-pressed'], 'true');
nodes['monitor-exit'].fire('click');
nodes['office-monitor'].fire('click');
assert.equal(nodes['systems-view'].hidden, true);
assert(Object.hasOwn(nodes['taskbar-systems'].dataset, 'open'));
assert.equal(nodes['taskbar-cameras'].attrs['aria-pressed'], 'true');
nodes['taskbar-cameras'].fire('click');
assert.equal(nodes.game.dataset.mode, 'desktop');
nodes['taskbar-cameras'].fire('click');
assert(Object.hasOwn(nodes['cameras-view'].dataset, 'maximized'));
nodes['close-cameras'].fire('click');
assert(!Object.hasOwn(nodes['taskbar-cameras'].dataset, 'open'));

nodes['open-start'].fire('click');
assert.equal(nodes['start-menu'].hidden, false);
nodes['start-systems'].fire('click');
assert.equal(nodes['start-menu'].hidden, true);
assert.equal(nodes['systems-view'].hidden, false);
nodes['show-desktop'].fire('click');
assert.equal(nodes['systems-view'].hidden, true);
nodes['close-systems'].fire('click');
nodes['open-cameras'].fire('click'); office('dark');
assert(!Object.hasOwn(nodes['cameras-view'].dataset, 'maximized'));
pressW(); office('dark');
camera('CAM05'); check('open-open');
// Corrected visual mapping: screen-left G04; screen-right G05.
gate('G04'); check('closed-open');
gate('G05'); check('closed-closed');
gate('G04'); check('open-closed');
gate('G05'); check('open-open');
// Unrelated gates leave CAM05 alone. A fourth closure reopens the latest
// previous closure, and the feed must update in the same interaction.
gate('G01'); gate('G02'); gate('G04'); check('closed-open');
gate('G03'); check('open-open'); assert(!isClosed('G04'));
gate('G05'); check('open-closed'); assert(!isClosed('G03'));
// State changes while another camera is selected must be visible on return.
camera('CAM01');
const otherSrc = nodes['feed-art'].src;
gate('G04'); assert.equal(nodes['feed-art'].src, otherSrc);
assert(!isClosed('G05'));
camera('CAM05'); check('closed-open');
nodes['close-cameras'].fire('click');
nodes['close-desktop'].fire('click');
radioButton.fire('click');
radio.fire('playing');
nodes['office-monitor'].fire('click');
nodes['open-cameras'].fire('click'); check('closed-open');
// Resetting the night restores both the map and the default open-open image.
for (let time = nightStart + 200; time <= nightStart + 360_000; time += 100) step(time);
assert.equal(nodes['shift-complete'].hidden, false);
assert.equal(radio.paused, true);
nodes['restart-shift'].fire('click');
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
customStart({ palhaca: 1 });
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
press('s');
assert.equal(nodes.game.dataset.mode, 'office');
step(closetStart + 1000);
assert.equal(nodes.game.dataset.mode, 'closet');
assert.equal(closet.dataset.view, 'door');
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
assert.equal(closetExit.hidden, true);
closetExit.fire('click');
assert.equal(nodes.game.dataset.closetTransition, undefined);
press('W');
assert.equal(closetBeam.hidden, false);
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
assert.equal(nodes['computer-desktop'].hidden, true);
office('dark');
console.log('PASS: closet entry, blocked monitor, both views, flashlight and slatted-door exit.');

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
  nodes['start-game'].fire('click');
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
assert.match(closetBeam.src, /seated-clown\.png$/);
step(start + 23_751);
assert.match(closetBeam.src, /seated-clown-alternate\.png$/);
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
assert.match(closetBeam.src, /seated-clown\.png$/);
radioButton.fire('click');
document.fire('click');
const quiet = now;
step(quiet + 98_751);
assert.equal(peek.hidden, false);
step(quiet + 123_751);
assert.match(scare.src.split('?')[0], /palhaca-direita\.gif$/);
console.log('PASS: three radio tracks, clown poses, music reduction, peek and automatic defeat.');
}

test().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
