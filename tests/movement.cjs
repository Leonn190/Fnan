// Run with: node tests/movement.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

global.window = {};
require('../src/data/game-data.js');
require('../src/movement.js');
const {
  CAMERAS, VENUE, buildRoomGraph, createMovement, cameraStateKey, cameraFrame
} = window.NathGame;
const graph = buildRoomGraph(VENUE);
const expected = {
  G01: ['controle', 'corredor_servico'], G02: ['corredor_servico', 'vip2'],
  G03: ['salao', 'vip2'], G04: ['corredor_servico', 'vip1'], G05: ['salao', 'vip1'],
  G06: ['corredor_servico', 'salao'], G07: ['circ_wc', 'salao'],
  G08: ['recepcao', 'salao'], G09: ['estoque', 'loja'],
  P01: ['loja', 'recepcao'], P02: ['controle', 'estoque'], P03: ['corredor_servico', 'estoque'],
  P04: ['corredor_servico', 'servico'], P05: ['armario', 'controle'], P06: ['cozinha', 'servico'],
  P07: ['corredor_servico', 'cozinha'], P08: ['corredor_servico', 'cozinha'], P09: ['cozinha', 'retirada'],
  P10: ['corredor_servico', 'retirada'], P11: ['corredor_servico', 'nathzinha'],
  P12: ['corredor_servico', 'eletrica'], P13: ['corredor_servico', 'wc_func'],
  P14: ['circ_wc', 'fliperama'], P15: ['circ_wc', 'wc_m'], P16: ['circ_wc', 'wc_f']
};
assert.equal([...graph.values()].flat().length, 2 * Object.keys(expected).length);
for (const [id, [a, b]] of Object.entries(expected)) {
  const type = id.startsWith('G') ? 'portao' : 'livre';
  assert.deepEqual(graph.get(a).find(edge => edge.id === id), { to: b, id, type });
  assert.deepEqual(graph.get(b).find(edge => edge.id === id), { to: a, id, type });
}

const ids = ['original', 'yandere', 'gotica', 'platinada', 'maid'];
const rosters = ['0123', '0123', '012', '0123', '0124', '01234', '0123', '0123', '4', '0124', '0124', '012'];
const assets = new Map();
function imageStatus(source) {
  if (!assets.has(source)) {
    assets.set(source, fs.existsSync(path.resolve(__dirname, '..', source)) ? 'ready' : 'missing');
  }
  return assets.get(source);
}
for (const [index, cam] of CAMERAS.entries()) {
  for (let mask = 0; mask < 32; mask++) {
    const occupants = ids.filter((_, i) => mask & (1 << i));
    const roster = rosters[index];
    const compatible = occupants.every(id => roster.includes(ids.indexOf(id)));
    const key = cameraStateKey(cam, [...occupants].reverse());
    if (!compatible) {
      assert.equal(key, null, cam.id);
      continue;
    }
    const exactKey = !occupants.length ? 'vazia'
      : occupants.length === roster.length && cam.id !== 'CAM09' ? 'todas'
      : occupants.join('-');
    assert.equal(key, exactKey, cam.id);
    const gates = cam.gateStateImages?.gates ?? [];
    for (let gateMask = 0; gateMask < 1 << gates.length; gateMask++) {
      const frame = cameraFrame(cam, key, id => Boolean(gateMask & (1 << gates.indexOf(id))));
      assert.equal(imageStatus(frame.source), 'ready', frame.source);
      if (key !== 'vazia' && cam.id !== 'CAM09') assert(frame.source.endsWith(`/${key}.webp`));
    }
  }
}

const closed = new Set(['G03', 'G06', 'G08']);
const absent = './public/images/cameras/CAM05/states/closed-open/original.webp';
const messages = [];
const delays = [0, .9, .9, .9, .9];
const simulation = createMovement({
  isGateClosed: id => closed.has(id), random: () => delays.shift() ?? 0,
  imageStatus: source => source === absent ? 'missing' : imageStatus(source),
  log: (message, warning) => { if (warning) messages.push(message); }
});
const actor = id => simulation.diagnostics(10_000).find(item => item.id === id);
assert.deepEqual(simulation.diagnostics(0).map(item => [item.id, item.room]), [
  ['original', 'salao'], ['yandere', 'salao'], ['gotica', 'salao'],
  ['platinada', 'nathzinha'], ['maid', 'servico']
]);
assert.equal(simulation.advance(9_999, null).size, 0);
simulation.advance(10_000, null);
assert.equal(actor('original').room, 'salao');
assert.equal(actor('yandere').remaining, 3_600);
assert.match(actor('original').stopped, /portão fechado \(G03\)/);
assert.match(actor('original').stopped, /ausência de imagem.*CAM05/);
assert(messages.some(message => message.includes(absent)));

// A missing source-room remainder also blocks departure.
const sourceMissing = createMovement({
  isGateClosed: () => false, random: () => 0,
  imageStatus: source => source.endsWith('/CAM03/states/yandere-gotica.webp') ? 'missing' : imageStatus(source)
});
sourceMissing.advance(10_000, null);
assert.equal(sourceMissing.diagnostics(10_000)[0].room, 'salao');

// Verify the invariants over changing gates, simultaneous arrivals and repeat visits.
let seed = 42;
function random() {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return seed / 2 ** 32;
}
const moving = createMovement({ isGateClosed: id => closed.has(id), imageStatus, random });
const lastMove = new Map();
const visited = new Map(ids.map(id => [id, new Set()]));
for (let now = 0; now <= 1_000_000; now += 250) {
  closed.clear();
  if (now % 40_000 < 12_000) ['G01', 'G03', 'G09'].forEach(id => closed.add(id));
  const observed = now % 65_000 < 15_000 ? 'salao' : null;
  const before = moving.diagnostics(now, observed);
  moving.advance(now, observed);
  const after = moving.diagnostics(now, observed);
  for (const [index, current] of after.entries()) {
    const previous = before[index];
    if (current.room === previous.room && current.phase === previous.phase) continue;
    assert.notEqual(previous.room, observed);
    assert(now - (lastMove.get(current.id) ?? 0) >= 10_000, current.id);
    lastMove.set(current.id, now);
    visited.get(current.id).add(current.phase ?? current.room);
    if (current.room !== previous.room) {
      assert(graph.get(previous.room).some(edge => edge.to === current.room && !closed.has(edge.id)));
      if (current.room === 'controle') {
        assert.equal(previous.room, 'estoque');
        assert.equal(current.phase, 'doorway');
      }
      if (previous.room === 'controle') {
        assert.equal(previous.phase, 'room');
        assert.equal(current.room, 'estoque');
      }
    } else {
      assert.equal(previous.phase, 'doorway');
      assert.equal(current.phase, 'room');
    }
  }
  const office = moving.officeState();
  assert(office.room.length <= 3);
  assert(after.filter(actor => actor.phase === 'doorway').length <= 1);
  assert(!office.room.includes(office.doorway));
  for (const cam of CAMERAS) assert.notEqual(cameraStateKey(cam, moving.occupants(cam.room)), null);
}
assert.equal(visited.get('platinada').size, 0);
assert.deepEqual([...visited.get('maid')].sort(), ['cozinha', 'retirada', 'servico']);
assert(ids.slice(0, 3).some(id => visited.get(id).has('room')));
moving.reset();
assert.deepEqual(moving.officeState(), { room: [], doorway: null });
assert.deepEqual(moving.occupants('salao'), ids.slice(0, 3));
assert(moving.diagnostics(0).every(item => item.remaining >= 10_000 && !item.previousRoom && !item.destination));
console.log('PASS: 25 physical links, exact camera combinations, missing files, per-character timing and legal movement.');
