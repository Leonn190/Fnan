const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

global.window = {};
for (const file of ['data/game-data', 'gameplay/routes', 'gameplay/effects', 'gameplay/threats',
  'gameplay/gates', 'gameplay/electrical', 'gameplay/resources', 'gameplay/shadow', 'movement', 'scene-art']) {
  require('../src/' + file + '.js');
}
const { createRoutes, createEffects, createMovement, cameraStateKey, corridorSlots, CAMERAS, VENUE } = window.NathGame;
const base = Object.fromEntries(['night', 'map', 'movement', 'characters', 'effects', 'threats', 'controls', 'sanity', 'power', 'shadow']
  .map(name => [name, require('../config/' + name + '.json')]));

const closeTo = (actual, expected) => assert(Math.abs(actual - expected) < 1e-8, actual + ' != ' + expected);

function scenario(overrides = {}, { levels, random = () => .5, gates = [], tune = () => {} } = {}) {
  const config = structuredClone(base);
  const { map, movement, threats } = config;
  config.characters = Object.fromEntries(Object.entries(overrides).map(([id, fields]) =>
    [id, { ...config.characters[id], ...fields }]));
  tune(config);
  const activeLevels = { ...levels };
  // Unspecified fixtures use their stated interval exactly, with abilities still disabled.
  for (const [id, actor] of Object.entries(config.characters)) {
    if (activeLevels[id] !== undefined) continue;
    activeLevels[id] = 1;
    actor.interval /= 1 - movement.difficulty.intervalReductionPerStep / 100;
  }
  movement.jitter = { min: 0, max: 0 };
  threats.attack.jitter = { min: 0, max: 0 };
  const events = [];
  const game = createMovement(config, { random, emit: (event, value) => events.push([event, value]) });
  game.reset(activeLevels, { radio: true, gates });
  return {
    game, map, events,
    actor: key => game.diagnostics().find(actor => actor.key === key),
    at: (time, input = {}, action) => game.advance(time, { radio: true, ...input }, action),
    output: event => events.filter(([type]) => type === event).map(([, value]) => value)
  };
}

const routes = createRoutes(base.map);
assert.equal(routes.positions.size, 26);
assert.equal(base.map.edges.length, 35);
assert.deepEqual(routes.neighbors.get(2).sort((a, b) => a - b), [1, 3, 6, 7, 19]);
assert.equal(routes.gate(19, 2), 'G06');
assert.equal(routes.gate(14, 7), 'G02');
assert.equal(routes.connection(14, 25), undefined);
assert.equal(routes.gate(25, 7), undefined);
assert.equal(routes.gate(3, 5), 'G08');
assert.equal(routes.gate(13, 14), 'G01');
assert.equal(routes.gate(13, 12), undefined);

{
  const { game } = scenario(base.characters, { levels: { padrao: 1, gatinha: 9, yandere: 1, maid: 4, gotica: 6 } });
  const roster = game.diagnostics();
  assert.deepEqual(roster.map(x => x.position), [1, 1, 1, 3, 16]);
  assert.deepEqual(roster.map(x => x.level), [1, 6, 1, 9, 4]);
  [22.08, 19.76, 19.32, 10.83, 21.924].forEach((interval, index) => closeTo(roster[index].remaining, interval));
}

const byRoom = new Map(VENUE.rooms.map(room => [room.id, room.points]));
const byOpening = new Map(VENUE.openings.map(opening => [opening.id, opening]));
function inside([x, y], points) {
  let result = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [ax, ay] = points[i], [bx, by] = points[j];
    if ((ay > y) !== (by > y) && x < ax + (bx - ax) * (y - ay) / (by - ay)) result = !result;
  }
  return result;
}
function crosses(opening, roomA, roomB) {
  const { axis, at, start, end } = opening;
  const middle = (start + end) / 2;
  const sides = [-.001, .001].map(delta => axis === 'H' ? [middle, at + delta] : [at + delta, middle]);
  return sides.some((point, index) => inside(point, byRoom.get(roomA)) && inside(sides[1 - index], byRoom.get(roomB)));
}
for (const { point, room } of base.map.positions) assert(inside(point, byRoom.get(room)), room);
for (const { from, to, type, gateId, openingId, exits } of base.map.edges) {
  const a = routes.positions.get(from).room, b = routes.positions.get(to).room;
  if (type === 'room') assert.equal(a, b);
  else if (type === 'exterior') {
    for (const [i, room] of [a, b].entries()) {
      const opening = byOpening.get(exits[i]);
      assert.equal(opening.type, 'saida');
      const mid = (opening.start + opening.end) / 2;
      const sides = [-.001, .001].map(delta => opening.axis === 'H' ? [mid, opening.at + delta] : [opening.at + delta, mid]);
      assert.equal(sides.filter(point => inside(point, byRoom.get(room))).length, 1);
      assert.equal(sides.filter(point => [...byRoom.values()].some(points => inside(point, points))).length, 1);
    }
  } else {
    const opening = byOpening.get(gateId ?? openingId);
    assert.equal(opening.type, type === 'gate' ? 'portao' : 'livre');
    assert(crosses(opening, a, b), opening.id);
  }
}
const gateCrossings = {
  G01: [[14, 13]], G02: [[7, 14]], G03: [[2, 7], [3, 7]], G04: [[15, 6]], G05: [[2, 6]],
  G06: [[2, 19]], G07: [[3, 26]], G08: [[3, 5]], G09: [[9, 10]]
};
for (const [id, crossings] of Object.entries(gateCrossings)) {
  for (const [a, b] of crossings) for (const [from, to] of [[a, b], [b, a]]) {
    assert.equal(routes.gate(from, to), id);
    // Invasion nodes are entered through the same validator. Use a retreat to test the outward edge.
    const retreating = from === base.map.office;
    const { game, at, actor } = scenario({ gatinha: { start: retreating ? to : from, interval: 10,
      target: retreating ? from : to, positions: [from, to] } }, {
      random: () => 0, gates: retreating ? [] : [id],
      tune(config) { if (retreating) config.movement.retreat.destinations = [to]; }
    });
    if (retreating) {
      at(10);
      assert.equal(actor('gatinha').position, from);
      at(11, {}, { type: 'closetEnter' });
      at(12, {}, { type: 'gate', id });
    }
    const due = retreating ? 15.5 : 10;
    at(due);
    assert.equal(actor('gatinha').position, from);
    assert.match(actor('gatinha').stopped, /porta fechada/);
    at(due + 2, {}, { type: 'gate', id });
    assert(!game.isGateClosed(id));
    assert.equal(actor('gatinha').position, to);
  }
}

{
  let draw = 0;
  const { at, actor, output } = scenario({ gatinha: { start: 3, interval: 10, target: 24, positions: [3, 4, 24, 26] } },
    { random: () => draw, gates: ['G07'] });
  for (const [from, to] of [[3, 4], [3, 24], [4, 24]]) assert(!routes.connection(from, to));
  at(10);
  assert.equal(actor('gatinha').position, 3);
  at(12, {}, { type: 'gate', id: 'G07' });
  draw = .4;
  at(22);
  at(32);
  assert.deepEqual(output('move').map(({ from, to }) => [from, to]), [[3, 26], [26, 4], [4, 26]]);
  // The actual shortest route to the hiding place receives the target bonus, with random choice still in effect.
  const hiding = scenario({ gatinha: { start: 26, interval: 10, target: 24, positions: [24, 26] } });
  hiding.at(10);
  assert.equal(hiding.actor('gatinha').position, 24);
  assert.equal(hiding.game.cameraActors('CAM07').length, 0);
}

for (const closed of [true, false]) {
  const { at, actor } = scenario({ gatinha: { start: 7, interval: 10, target: 14, positions: [3, 5, 7, 9, 10, 14, 25] } },
    { random: () => .29, gates: closed ? ['G02'] : [] });
  at(10);
  assert.equal(actor('gatinha').position, closed ? 3 : 14);
}

{
  const distance = routes.distances([14], id => [3, 5, 7, 9, 10, 14, 25].includes(id), Infinity,
    edge => edge.gateId !== 'G02', true);
  assert.equal(distance.get(7), 5);
  assert.equal(distance.get(25), 6);
}

for (const [level, expected] of [[2, 1], [8, 7]]) {
  const { at, actor } = scenario({ padrao: { start: 2, interval: 10, positions: [1, 2, 7, 14, 10] } },
    { levels: { padrao: level }, random: () => .375 });
  at(12);
  assert.equal(actor('padrao').position, expected);
}

for (const [draw, expected] of [[.39, 5], [.43, 7], [.9, 3]]) {
  const { at, actor } = scenario({ padrao: { start: 3, interval: 10, positions: [3, 5, 7, 9, 10, 14] } },
    { random: () => draw });
  at(10);
  assert.equal(actor('padrao').position, expected);
}

{
  const { at, actor } = scenario({ yandere: { start: 2, interval: 10, positions: [2, 19] } }, { gates: ['G06'] });
  at(10);
  assert.match(actor('yandere').stopped, /porta fechada/);
  at(13);
  assert.equal(actor('yandere').remaining, 5);
  at(17.99, {}, { type: 'gate', id: 'G06' });
  assert.equal(actor('yandere').position, 2);
  at(18);
  assert.equal(actor('yandere').position, 19);
}

for (const [level, roll, opens] of [[3, .6999, true], [3, .70, false], [4, .9399, true], [4, .94, false]]) {
  let draw = 0;
  const { game, at, actor, output } = scenario({ padrao: { start: 2, interval: 10, positions: [2, 19] } },
    { levels: { padrao: level }, random: () => draw, gates: ['G06'] });
  at(0, { camera: 'CAM12' });
  at(9, { camera: 'CAM12' });
  assert.equal(actor('padrao').position, 2);
  assert.match(actor('padrao').stopped, /c.mera observada/);
  assert(game.isGateClosed('G06'));
  assert.deepEqual(output('openGate'), []);
  draw = roll;
  at(10);
  assert.equal(game.isGateClosed('G06'), !opens);
  assert.deepEqual(output('openGate'), opens ? ['G06'] : []);
  assert.deepEqual(output('gatesChanged'), opens ? [[{ id: 'G06', closed: false }]] : []);
  assert.equal(actor('padrao').position, opens ? 19 : 2);
}

{
  const { game, at, actor, output } = scenario({ padrao: { start: 2, interval: 10, positions: [2, 19] } },
    { gates: ['G06'], tune(config) { config.map.capacities[19] = 0; } });
  at(10);
  assert(!game.isGateClosed('G06'));
  assert.deepEqual(output('openGate'), ['G06']);
  assert.equal(actor('padrao').position, 2);
  assert.match(actor('padrao').stopped, /lotada/);
}

{
  const { game, at, actor } = scenario({
    padrao: { start: 1, interval: 10, positions: [1, 2] },
    gotica: { start: 1, interval: 11, positions: [1, 2] },
    yandere: { start: 2, interval: 11, positions: [2, 19] }
  }, { random: () => .5, gates: ['G06'] });
  at(10, { camera: 'CAM03' });
  assert.equal(actor('padrao').position, 1);
  at(11, { camera: 'CAM03' });
  assert.equal(game.snapshot().static, true);
  assert.equal(actor('padrao').position, 2);
  assert.equal(actor('gotica').position, 2);
  assert.equal(actor('yandere').position, 2);
  at(12.99, { camera: 'CAM03' });
  assert.equal(game.snapshot().static, true);
  at(13, { camera: 'CAM03' });
  assert.equal(game.snapshot().static, false);
}

for (const [tier, chance] of base.characters.gotica.staticChance.entries()) {
  for (const [draw, triggers] of [[(chance - .01) / 100, true], [chance / 100, false]]) {
    let drawCount = 0;
    const { at, game, output, actor } = scenario({ gotica: { start: 1, interval: 10, positions: [1, 2] } },
      { levels: { gotica: tier ? base.movement.difficulty.abilityLevel : 1 }, random: () => (++drawCount === 3 ? draw : 0) });
    const due = actor('gotica').remaining;
    at(0, { camera: 'CAM03' });
    at(due, { camera: 'CAM03' });
    assert.equal(game.snapshot().static, triggers);
    assert.deepEqual(output('cameraInterference'), triggers ? [due] : []);
    at(due + base.effects.static.duration, { camera: 'CAM03' });
    assert.equal(game.snapshot().static, false);
  }
}

{
  const { at, game, actor } = scenario({ padrao: { start: 1, interval: 10, positions: [1, 2] } });
  const input = { camera: 'CAM03' };
  at(0, input);
  at(10, input, { type: 'gate', id: 'G04' });
  assert.equal(game.snapshot().static, false);
  assert.equal(actor('padrao').position, 1);
  assert.match(actor('padrao').stopped, /c.mera observada/);
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
  assert(!base.characters.maid.positions.includes(10) && !base.characters.maid.positions.includes(12));
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
    gatinha: { start: 15, interval: 10, positions: [15, 14] }
  });
  at(10);
  assert.equal(game.officeState().front.length, 2);
  assert.equal(actor('gatinha').position, 15);
  assert.match(actor('gatinha').stopped, /lotada/);
}

{
  const draws = [0, 0, .45];
  const { game, at, actor, output } = scenario({
    maid: { start: 14, interval: 10, positions: [14, 13, 15, 6, 7], initialStationaryAttempts: undefined },
    gotica: { start: 10, interval: 11, positions: [10, 12, 13] }
  }, { random: () => draws.shift() ?? 0 });
  at(10);
  at(11, { leftLook: true });
  assert.equal(actor('gotica').position, 10);
  at(12);
  assert.match(actor('gotica').stopped, /invasão em andamento/);
  assert.deepEqual(game.officeState().room, ['maid']);
  at(12, {}, { type: 'closetEnter' });
  at(14, {}, { type: 'gate', id: 'G01' });
  at(18.5);
  assert.equal(actor('maid').position, 13);
  assert.match(actor('maid').stopped, /porta fechada/);
  at(19, {}, { type: 'gate', id: 'G01' });
  assert.equal(actor('maid').position, 14);
  at(20);
  assert.equal(actor('maid').position, 15);
  at(21);
  assert.equal(actor('maid').position, 6);
  assert.equal(actor('maid').previous, routes.positions.get(15).name);
  assert.equal(actor('maid').remaining, 15);
  assert.deepEqual(output('move').filter(({ actor }) => actor.key === 'maid').map(({ from, to }) => [from, to]),
    [[14, 13], [13, 14], [14, 15], [15, 6]]);
  assert.deepEqual(output('loss'), []);
}

{
  const { at, actor, output } = scenario({ gotica: { start: 10, interval: 10, positions: [10, 12, 13] } },
    { gates: ['G01'], random: () => 0 });
  at(10);
  assert.equal(actor('gotica').position, 12);
  at(20);
  assert.equal(actor('gotica').position, 13);
  assert.deepEqual(output('move').map(({ from, to }) => [from, to]), [[10, 12], [12, 13]]);
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
  fx.addNoiseEvent('closetRoundTrip');
  assert.equal(actor.noise, 199);
  actor.position = 14;
  fx.integrate(30, { corridorLight: true });
  assert.deepEqual(actor.light, { advance: -90, retreat: 90 });
}

for (const level of [3, 4, 10]) {
  const { at, actor } = scenario({ yandere: { start: 19, interval: 20, positions: [19, 21] } },
    { levels: { yandere: level }, random: () => 0 });
  const normal = 20 * (1 - .08 * base.movement.difficulty.oddSteps.filter(step => level >= step).length);
  const due = actor('yandere').remaining;
  closeTo(due, normal * (level >= 4 ? .60 : 1));
  at(due);
  assert.equal(actor('yandere').position, 21);
  closeTo(actor('yandere').remaining, normal);
  at(due + normal);
  assert.equal(actor('yandere').position, 19);
  closeTo(actor('yandere').remaining, normal);
}

for (const key of Object.keys(base.characters).filter(key => key !== 'yandere')) {
  const { game, at, actor } = scenario({ [key]: { start: 19, interval: 10, positions: [19, 21],
    initialStationaryAttempts: undefined } });
  at(120);
  assert.equal(actor(key).position, 19);
  assert.equal(game.electricalFault(), false);
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
  const { game, at, output } = scenario({}, { levels: { palhaca: 1 } });
  at(0, { radio: false });
  at(100, { radio: false }, { type: 'closetEnter' });
  assert.deepEqual(output('loss'), ['palhaca']);
  game.reset({}, { radio: true });
  at(359.999);
  assert.equal(game.snapshot().outcome, null);
  at(360);
  assert.equal(game.snapshot().outcome, 'win');
  game.reset({ palhaca: 1 }, { radio: false });
  at(360);
  assert.deepEqual(output('loss'), ['palhaca', 'palhaca']);
  closeTo(game.snapshot().now, 99 / .88);
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

{
  let seed = 912;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
  const levels = Object.fromEntries(Object.keys(base.characters).map(key => [key, 10]));
  const atPosition = new Map(Object.entries(base.characters).map(([key, rule]) => [key, rule.start]));
  const gateIds = Object.keys(gateCrossings);
  const moved = new Set();
  let moves = 0;
  const game = createMovement(base, { random, emit(event, value) {
    if (event !== 'move') return;
    const { actor, from, to } = value;
    const edge = routes.connection(from, to);
    assert.equal(atPosition.get(actor.key), from);
    if (from === to) assert.equal(actor.key, 'maid');
    else {
      assert(edge);
      assert(!edge.actors || edge.actors.includes(actor.key));
      assert(!game.isGateClosed(edge.gateId));
      assert(actor.rule.positions.includes(to));
      moves++;
      moved.add(actor.key);
    }
    atPosition.set(actor.key, to);
    for (const [id, limit] of Object.entries(base.map.capacities)) {
      assert([...atPosition.values()].filter(position => position === Number(id)).length <= limit);
    }
  } });
  const input = { radio: true, closet: true };
  game.reset(levels, input);
  game.advance(0, input, { type: 'closetEnter' });
  for (let time = 0; time <= 1500 && !game.snapshot().outcome; time += 4.25) {
    const action = game.electricalFault() ? { type: 'computerPower' }
      : { type: 'gate', id: gateIds[Math.floor(random() * gateIds.length)] };
    game.advance(time, input, action);
  }
  assert.equal(game.snapshot().outcome, 'win');
  assert(moves > 100);
  assert.equal(moved.size, Object.keys(levels).length);
}

console.log('PASS: physical graph, bidirectional gates, movement and retreat, difficulty, static, attacks and clown.');
