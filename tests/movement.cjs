const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

global.window = {};
for (const file of ['data/game-data', 'gameplay/routes', 'gameplay/effects', 'gameplay/threats', 'movement', 'scene-art']) {
  require('../src/' + file + '.js');
}
const { createRoutes, createEffects, createMovement, cameraStateKey, corridorSlots, CAMERAS } = window.NathGame;
const base = Object.fromEntries(['night', 'map', 'movement', 'characters', 'effects', 'threats', 'controls']
  .map(name => [name, require('../config/' + name + '.json')]));

const closeTo = (actual, expected) => assert(Math.abs(actual - expected) < 1e-8, actual + ' != ' + expected);

function scenario(overrides = {}, { levels, random = () => .5 } = {}) {
  const config = structuredClone(base);
  const { map, movement, threats } = config;
  config.characters = Object.fromEntries(Object.entries(overrides).map(([id, fields]) =>
    [id, { ...config.characters[id], ...fields }]));
  movement.jitter = { min: 0, max: 0 };
  threats.attack.jitter = { min: 0, max: 0 };
  const events = [];
  const game = createMovement(config, { random, emit: (event, value) => events.push([event, value]) });
  game.reset(levels, { radio: true });
  return {
    game, map, events,
    actor: key => game.diagnostics().find(actor => actor.key === key),
    at: (time, input = {}, action) => game.advance(time, { radio: true, ...input }, action),
    output: event => events.filter(([type]) => type === event).map(([, value]) => value)
  };
}

const routes = createRoutes(base.map);
assert.equal(routes.positions.size, 25);
assert.equal(base.map.edges.length, 36);
assert.deepEqual(routes.neighbors.get(2).sort((a, b) => a - b), [1, 3, 6, 7, 19]);
assert.equal(routes.gate(19, 2), 'G06');
assert.equal(routes.gate(14, 7), 'G02');
assert.equal(routes.gate(14, 25), 'G02');
assert.equal(routes.gate(25, 7), undefined);
assert.equal(routes.gate(3, 5), undefined);
assert.equal(routes.gate(13, 14), 'G01');
assert.equal(routes.gate(13, 12), 'leftDoor');

{
  const { game } = scenario(base.characters, { levels: { gatinha: 9, yandere: 1, maid: 4, gotica: 6 } });
  const roster = game.diagnostics();
  assert.deepEqual(roster.map(x => x.position), [1, 1, 1, 3, 16]);
  assert.deepEqual(roster.map(x => x.level), [0, 6, 1, 9, 4]);
  [24, 19.76, 19.32, 10.83, 21.924].forEach((interval, index) => closeTo(roster[index].remaining, interval));
}

{
  const { game, at, actor } = scenario({ gatinha: { start: 25, interval: 10, positions: [25, 14] } });
  at(10, { gates: ['G02'] });
  assert.equal(actor('gatinha').position, 25);
  assert.match(actor('gatinha').stopped, /porta fechada/);
  at(12, { gates: [] });
  assert.equal(actor('gatinha').position, 14);
  assert.equal(actor('gatinha').remaining, 10);
  assert.deepEqual(game.officeState().front, ['platinada']);
}

for (const [level, expected] of [[2, 1], [8, 7]]) {
  const { at, actor } = scenario({ padrao: { start: 2, interval: 10, positions: [1, 2, 7, 14, 10] } },
    { levels: { padrao: level }, random: () => .465 });
  at(12);
  assert.equal(actor('padrao').position, expected);
}

for (const [draw, expected] of [[.4999, 5], [.5001, 7]]) {
  const { at, actor } = scenario({ padrao: { start: 3, interval: 10, positions: [3, 5, 7, 9, 10, 14] } },
    { random: () => draw });
  at(10);
  assert.equal(actor('padrao').position, expected);
}

{
  const { at, actor } = scenario({ yandere: { start: 2, interval: 10, positions: [2, 19] } });
  at(10, { gates: ['G06'] });
  assert.match(actor('yandere').stopped, /porta fechada/);
  at(13, { gates: ['G06'] });
  assert.equal(actor('yandere').remaining, 5);
  at(17.99);
  assert.equal(actor('yandere').position, 2);
  at(18);
  assert.equal(actor('yandere').position, 19);
}

for (const [level, opens] of [[3, false], [4, true]]) {
  const { at, actor, output } = scenario({ padrao: { start: 2, interval: 10, positions: [2, 19] } },
    { levels: { padrao: level }, random: () => .8 });
  at(0, { camera: 'CAM12', gates: ['G06'] });
  at(9, { camera: 'CAM12', gates: opens ? [] : ['G06'] });
  assert.equal(actor('padrao').position, 2);
  assert.deepEqual(output('openGate'), opens ? ['G06'] : []);
  assert.match(actor('padrao').stopped, /c.mera observada/);
}

{
  const { game, at, actor } = scenario({
    padrao: { start: 1, interval: 10, positions: [1, 2] },
    gotica: { start: 1, interval: 11, positions: [1, 2] },
    yandere: { start: 2, interval: 11, positions: [2, 19] }
  }, { random: () => .5 });
  at(10, { camera: 'CAM03', gates: ['G06'] });
  assert.equal(actor('padrao').position, 1);
  at(11, { camera: 'CAM03', gates: ['G06'] });
  assert.equal(game.snapshot().static, true);
  assert.equal(actor('padrao').position, 2);
  assert.equal(actor('gotica').position, 2);
  assert.equal(actor('yandere').position, 2);
  at(13.5, { camera: 'CAM03', gates: ['G06'] });
  assert.equal(game.snapshot().static, false);
}

{
  const { game, at, actor } = scenario({ maid: { interval: 10 } });
  at(10, { camera: 'CAM09' });
  assert.equal(game.cameraActors('CAM09')[0].stage, 0);
  at(11);
  assert.equal(game.cameraActors('CAM09')[0].stage, 1);
  at(21);
  assert.notEqual(actor('maid').position, 16);
  for (let t = 25; t < 60; t++) {
    at(t);
    assert(![10, 12, 16].includes(actor('maid').position));
  }
  assert.equal(actor('maid').trackable, false);
}

{
  const { at, actor } = scenario({
    padrao: { start: 10, interval: 10, positions: [10, 12] },
    gotica: { start: 10, interval: 10, positions: [10, 12] }
  });
  at(10, { leftLook: true });
  assert.equal(actor('padrao').position, 10);
  at(11);
  assert.equal(actor('padrao').position, 12);
  assert.equal(actor('gotica').position, 10);
  assert.match(actor('gotica').stopped, /lotada/);
}

{
  const { game, at, actor } = scenario({
    padrao: { start: 10, interval: 10, positions: [10, 14] },
    gotica: { start: 7, interval: 10, positions: [7, 14] },
    gatinha: { start: 25, interval: 10, positions: [25, 14] }
  });
  at(10);
  assert.equal(game.officeState().front.length, 2);
  assert.equal(actor('gatinha').position, 25);
  assert.match(actor('gatinha').stopped, /lotada/);
}

{
  const { game, at, actor, output } = scenario({
    padrao: { start: 14, interval: 10, positions: [14, 13, 6] },
    gotica: { start: 10, interval: 11, positions: [10, 12, 13, 7] }
  });
  at(10);
  at(11, { gates: ['leftDoor'] });
  assert.equal(actor('gotica').position, 10);
  at(12);
  assert.deepEqual(game.officeState().room, ['original', 'gotica']);
  at(13, {}, { type: 'closetEnter' });
  assert.equal(game.snapshot().hidden, true);
  at(17.5);
  assert.equal(actor('gotica').position, 7);
  assert.equal(actor('padrao').position, 13);
  at(18.5);
  assert.equal(actor('padrao').position, 6);
  assert.equal(actor('padrao').previous, routes.positions.get(15).name);
  assert.equal(actor('padrao').remaining, 15);
  assert.deepEqual(output('loss'), []);
}

{
  const { game, at, output } = scenario({ gotica: { start: 14, interval: 10, positions: [14, 13, 7] } },
    { levels: { gotica: 6 } });
  at(8);
  at(9, {}, { type: 'closetEnter' });
  at(10, {}, { type: 'closetExit' });
  at(11.604);
  assert.equal(game.snapshot().outcome, null);
  at(11.606);
  assert.deepEqual(output('loss'), ['gotica']);
}

{
  const { at, actor } = scenario({
    gotica: { start: 14, interval: 10, positions: [14, 15] }
  });
  at(0, { corridorLight: true });
  at(10, { corridorLight: true });
  assert.equal(actor('gotica').light.advance, -40);
  at(13, { corridorLight: true });
  assert.equal(actor('gotica').light.advance, -39);
  assert.equal(actor('gotica').light.retreat, 39);
  at(14, {});
  at(15, {});
  assert.equal(actor('gotica').light.advance, -41.5);
  at(18);
  assert.equal(actor('gotica').position, 15);
}

{
  const rules = structuredClone(base);
  const actor = {
    key: 'yandere', rule: rules.characters.yandere, position: 15, noise: 0,
    light: { advance: 0, retreat: 0 }, audioRetention: 1
  };
  const fx = createEffects(rules, routes, [actor]);
  assert(fx.startAudio(0, 'CAM03'));
  assert.equal(fx.audioStatus(6.99).camera, 'CAM03');
  assert.equal(fx.audioStatus(7).camera, null);
  assert(!fx.startAudio(11.99, 'CAM12'));
  closeTo(fx.weight(actor, 19, 6), 1.5); // 19 is one step from the hall.
  actor.position = 17;
  closeTo(fx.weight(actor, 15, 6), 1.075); // 17 is out of range, 15 is in ring two.
  fx.retain(actor);
  closeTo(fx.weight(actor, 15, 6), 1.05625);
  actor.position = 8;
  closeTo(fx.weight(actor, 22, 6), 1);
  assert(fx.startAudio(12, 'CAM12'));
  fx.integrate(40, { radio: true, computer: true, viewMoving: true });
  assert.equal(actor.noise, 188); // No invented cap.
  fx.integrate(2, {});
  fx.addNoiseEvent('workshopDoor');
  fx.addNoiseEvent('closetRoundTrip');
  assert.equal(actor.noise, 209);
  actor.position = 14;
  fx.integrate(30, { corridorLight: true });
  assert.deepEqual(actor.light, { advance: -90, retreat: 90 });
}

{
  const { game, at, output } = scenario({ yandere: { start: 19, interval: 10, positions: [19, 21] } },
    { levels: { yandere: 4 }, random: () => .99 });
  at(8.4);
  assert.equal(output('sabotage')[0].length, 3);
  assert.equal(new Set(output('sabotage')[0]).size, 3);
  assert.equal(game.snapshot().ventilationRemaining, 25);
  at(33.399);
  assert.equal(game.snapshot().outcome, null);
  at(33.4);
  assert.deepEqual(output('loss'), ['ventilacao']);
}

{
  const { game, at } = scenario({}, { levels: { palhaca: 9 } });
  at(0, { radio: false });
  at(10, { radio: false });
  closeTo(game.snapshot().counter, 16.2);
  at(10, { radio: false }, { type: 'closetEnter' });
  at(11, { radio: false });
  assert.equal(game.snapshot().floor, 1); // Registered while already above 10.
  at(11, { radio: true, clownLight: true });
  const lit = game.snapshot().counter;
  at(20, { radio: true });
  closeTo(game.snapshot().counter, lit);
  at(27, { radio: false });
  assert(game.snapshot().counter < 10);
  at(29, { radio: false });
  assert.equal(game.snapshot().floor, 10);
  at(29, { radio: true }, { type: 'closetExit' });
  at(49);
  assert.equal(game.snapshot().counter, 10);
}

{
  const { game, at, output } = scenario();
  at(0, { radio: false });
  at(100, { radio: false }, { type: 'closetEnter' });
  assert.deepEqual(output('loss'), ['palhaca']);
  game.reset({}, { radio: true });
  at(359.999);
  assert.equal(game.snapshot().outcome, null);
  at(360);
  assert.equal(game.snapshot().outcome, 'win');
  game.reset({}, { radio: false });
  at(360);
  assert.deepEqual(output('loss'), ['palhaca', 'palhaca']);
  closeTo(game.snapshot().now, 123.75);
}

{
  const { game, at } = scenario({ padrao: { interval: 5 } });
  at(5);
  const cam = CAMERAS.find(x => x.id === 'CAM03');
  assert.equal(cameraStateKey(cam, game.cameraActors(cam.id), base.map.stage), 'palco-vazio--salao-original');
  assert.deepEqual(corridorSlots(['maid', 'gotica'], ['yandere']),
    [{ slot: 1, column: 2 }, { slot: 3, column: 3 }, { slot: 4, column: 4 }]);
  assert(fs.existsSync(path.join(__dirname, '../public/images/office/states/corridor-atlas.webp')));
}

console.log('PASS: v1.1.2 graph, timing, difficulty, gate abilities, static, Maid, attacks, effects, clown and sabotage.');
