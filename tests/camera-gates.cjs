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
document.createElementNS = () => new Element();
const window = new Element();
let frame;
const context = vm.createContext({
  window, document, Element, Image: class {}, performance: { now: () => 0 },
  setTimeout: () => 1, clearTimeout() {}, requestAnimationFrame: fn => { frame = fn; },
  ResizeObserver: class { observe() {} }
});
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
    ? './public/images/cameras/originals/CAM05.png'
    : `./public/images/cameras/states/CAM05-${expected}.png`);
  assert.equal(nodes['technical-feed'].hidden, true);
  assert.equal(nodes['cam-number'].textContent, 'CAM 05');
  assert(fs.existsSync(path.join(root, src)), src);
};
assert.equal(cameras.length, 12);
assert.equal(gates.length, 9);
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
for (let now = 100; now <= 540100; now += 100) frame(now);
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
const checkHall = open => assert.equal(nodes['feed-art'].src, open
  ? './public/images/cameras/states/CAM04-open.webp'
  : './public/images/cameras/CAM04.webp');
camera('CAM04'); checkHall(true);
gate('G08'); checkHall(false);
gate('G08'); checkHall(true);
camera('CAM09');
assert.equal(nodes['feed-art'].src, './public/images/cameras/CAM09.webp');
assert.equal(nodes['technical-feed'].hidden, true);
gate('G08');
camera('CAM04'); checkHall(false);
gate('G07'); assert(!isClosed('G08')); checkHall(true);
// All 12 cameras have a standardized base render and master PNG.
for (const cam of window.NathGame.CAMERAS) {
  camera(cam.id);
  assert.equal(nodes['cam-number'].textContent, cam.id.replace('CAM', 'CAM '));
  assert.equal(cam.image, `./public/images/cameras/${cam.id}.webp`);
  assert.equal(cam.renderAvailable, true);
  assert.equal(nodes['technical-feed'].hidden, true);
  for (const src of [cam.image, nodes['feed-art'].src, `public/images/cameras/originals/${cam.id}.png`]) {
    assert(fs.existsSync(path.join(root, src)), src);
  }
}
console.log('PASS: all 12 camera renders and originals, CAM04 G08 open/closed/reopened, CAM05, office and shift reset.');
