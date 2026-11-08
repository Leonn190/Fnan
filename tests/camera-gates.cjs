// Run with: node tests/camera-gates.cjs. No browser/server dependencies.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
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
  append(...items) { this.children.push(...items); }
  addEventListener(event, action) { (this.events[event] ??= []).push(action); }
  closest() { return this.attrs.role === 'button' ? this : null; }
  fire(event, details) { for (const action of this.events[event] ?? []) action({ target: this, preventDefault() {}, ...details }); }
}
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const nodes = Object.fromEntries([...html.matchAll(/id="([^"]+)"/g)].map(([, id]) => [id, new Element()]));
const document = new Element();
document.querySelector = selector => nodes[selector.slice(1)];
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
  window, document, Element, URLSearchParams, Math: math, performance: { now: () => now },
  Image: class {
    complete = true;
    set src(value) {
      assert(fs.existsSync(path.join(root, value)), value);
      this.naturalWidth = 1;
    }
  },
  console: { warn: message => warnings.push(message), info() {} },
  setTimeout: () => 1, clearTimeout() {}, requestAnimationFrame: fn => { frame = fn; },
  ResizeObserver: class { observe() {} }
});
const step = time => { now = time; frame(now); };
for (const [, src] of html.matchAll(/<script defer src="([^"]+)"/g)) {
  vm.runInContext(fs.readFileSync(path.join(root, src), 'utf8'), context, { filename: src });
}
const svg = nodes['map-canvas'].children[0];
const cameras = svg.children.filter(node => node.attrs['data-cam']);
const gates = svg.children.find(node => node.attrs['aria-label'] === 'Portões').children;
const camera = id => cameras.find(node => node.attrs['data-cam'] === id).fire('click');
const gate = id => gates.find(node => node.attrs['data-gate'] === id).fire('click');
const isClosed = id => gates.find(node => node.attrs['data-gate'] === id).attrs['aria-pressed'] === 'true';
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
const pressF = details => document.fire('keydown', { key: 'f', ...details });
office('dark');
pressF(); office('lit');
pressF({ repeat: true }); office('lit');
pressF(); office('dark');
pressF({ key: 'F' }); office('lit');
window.fire('blur'); office('dark');
pressF(); office('lit');
nodes['office-monitor'].fire('click'); office('dark');
pressF(); office('dark');
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
nodes['monitor-handle'].fire('click');
nodes['office-monitor'].fire('click'); check('closed-open');
// Resetting the night restores both the map and the default open-open image.
for (let time = 100; time <= 540100; time += 100) step(time);
assert.equal(nodes['shift-complete'].hidden, false);
nodes['restart-shift'].fire('click');
assert(gates.every(node => node.attrs['aria-pressed'] === 'false'));
nodes['office-monitor'].fire('click'); check('open-open'); office('dark');
// G01 controls the office, and the flashlight cannot reveal a closed gate.
gate('G01'); office('closed');
nodes['monitor-handle'].fire('click'); office('closed');
pressF(); office('closed');
nodes['office-monitor'].fire('click');
gate('G01'); office('dark');
gate('G02'); gate('G03'); gate('G01'); office('closed');
gate('G06'); assert(!isClosed('G01')); office('dark');
nodes['monitor-handle'].fire('click');
pressF(); office('lit');
nodes['office-monitor'].fire('click'); office('dark');
// The southern hall gate controls only the large left shutter in CAM04.
const checkHall = open => assert.equal(nodes['feed-art'].src,
  `./public/images/cameras/CAM04/states/${open ? 'open' : 'closed'}/original-yandere-gotica.webp`);
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
    gate('G01');
    office('closed');
    assert.deepEqual(visibleOfficeLayers(), expected);
    gate('G01');
    officeCases += 2;
  }
}
assert.equal(officeCases, 202);
assert(!setOfficeCharacterState(OFFICE.characters.slice(0, 4)));
assert(!setOfficeCharacterState(['maid', 'maid']));
assert(!setOfficeCharacterState(['original'], 'original'));
assert(!setOfficeCharacterState([], 'desconhecida'));
assert(setOfficeCharacterState(['original'], 'maid'));
nodes['monitor-handle'].fire('click');
pressF(); office('dark');
assert.deepEqual(visibleOfficeLayers(), [officeLayer('doorway', 'maid'), officeLayer('room', 'original')]);
assert(setOfficeCharacterState());
assert.deepEqual(visibleOfficeLayers(), []);
pressF(); office('lit');
for (const doorway of officeCharacters) {
  assert(setOfficeCharacterState([], doorway));
  office('lit');
  assert.deepEqual(visibleOfficeLayers(), [officeLayer('doorway', doorway)]);
  pressF(); office('dark');
  pressF(); office('lit');
}
assert(setOfficeCharacterState(['original'], 'maid'));
office('dark');
pressF(); office('dark');
assert(setOfficeCharacterState([], 'maid'));
office('dark');
pressF(); office('lit');
console.log('PASS: 12 camera folders, all gate states, and 208 office combinations.');

// Real game entry points: the map, monitor, frame loop and shift restart.
const random = [0, .25, .5, .75, 0];
randomValue = () => random.shift() ?? 0;
nodes['restart-shift'].fire('click');
const startedAt = now;
const debug = nodes['movement-debug'];
const feed = () => nodes['feed-art'].src;
assert.equal(debug.hidden, false);
assert.match(debug.textContent, /Gatinha · Sala da Nathzinha · sem câmera/);
assert.match(debug.textContent, /ausência de imagem/);
assert.match(debug.textContent, /Padrão.*10\.0 s[\s\S]*Yandere.*11\.0 s/);
nodes['office-monitor'].fire('click');
camera('CAM03');
assert.match(feed(), /CAM03\/states\/todas\.webp$/);
assert.match(debug.textContent, /observação/);
camera('CAM04');
checkHall(true);
step(startedAt + 9_999);
checkHall(true);
step(startedAt + 13_100);
checkHall(true); // Both hall angles freeze the same physical occupants.
camera('CAM10');
assert.match(feed(), /CAM10\/states\/maid\.webp$/);
camera('CAM09');
assert.match(feed(), /CAM09\/base\.webp$/);
gate('G03');
step(startedAt + 13_400);
camera('CAM05');
assert.match(feed(), /CAM05\/states\/open-open\/original-yandere-gotica\.webp$/);
gate('G04');
assert.match(feed(), /CAM05\/states\/closed-open\/original-yandere-gotica\.webp$/);
camera('CAM03');
assert.match(feed(), /CAM03\/base\.webp$/);

// Hidden time cannot advance the night or queue multiple movements.
document.hidden = true;
document.fire('visibilitychange');
step(startedAt + 55_000);
document.hidden = false;
document.fire('visibilitychange');
step(startedAt + 55_100);
camera('CAM05');
assert.match(feed(), /CAM05\/states\/closed-open\/original-yandere-gotica\.webp$/);
nodes['restart-shift'].fire('click');
assert.deepEqual(visibleOfficeLayers(), []);
assert(gates.every(node => node.attrs['aria-pressed'] === 'false'));
nodes['office-monitor'].fire('click');
camera('CAM03');
assert.match(feed(), /CAM03\/states\/todas\.webp$/);
assert(warnings.some(message => message.includes('Gatinha') && message.includes('CAM12')));
console.log('PASS: live camera occupancy, gate composition, observation, hidden tab, diagnostics and reset.');

// Reach the office along G06, P03 and P02 with the real map and layer renderer.
nodes['restart-shift'].fire('click');
const officeStart = now;
nodes['office-monitor'].fire('click');
camera('CAM01');
gate('G03'); gate('G05'); gate('G08');
nodes['monitor-handle'].fire('click');
step(officeStart + 10_000);
assert.deepEqual(visibleOfficeLayers(), []);
randomValue = () => .5;
step(officeStart + 20_000);
step(officeStart + 32_000);
assert.deepEqual(visibleOfficeLayers(), [officeLayer('doorway', 'original')]);
assert.match(debug.textContent, /Yandere · Estoque[\s\S]*fila da porta lateral/);
step(officeStart + 41_999);
assert.deepEqual(visibleOfficeLayers(), [officeLayer('doorway', 'original')]);
randomValue = () => 0;
step(officeStart + 44_000);
assert(visibleOfficeLayers().includes(officeLayer('room', 'original')));
step(officeStart + 54_000);
assert.deepEqual(visibleOfficeLayers(), [officeLayer('doorway', 'yandere')]);
assert.equal(nodes['shift-complete'].hidden, true);
nodes['office-monitor'].fire('click');
camera('CAM08');
assert.match(feed(), /CAM08\/states\/original-gotica\.webp$/);
console.log('PASS: automatic office doorway, room, departure and return to the stockroom.');
