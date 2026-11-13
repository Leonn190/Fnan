const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

global.window = {};
for (const file of ['data/game-data', 'gameplay/routes', 'gameplay/effects', 'gameplay/threats',
  'gameplay/gates', 'gameplay/electrical', 'gameplay/resources', 'gameplay/shadow', 'movement', 'scene-art']) {
  require('../src/' + file + '.js');
}
const { createRoutes, createAttackRoutes, createEffects, createMovement, cameraStateKey, corridorSlots, CAMERAS, VENUE } = window.NathGame;
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
assert.deepEqual([...routes.positions.keys()].filter(from => routes.connection(from, 14)), [15]);
assert.equal(routes.gate(15, 7), 'G02');
assert.equal(routes.connection(10, 15).openingId, 'P03');
assert.equal(routes.connection(14, 25), undefined);
assert.equal(routes.gate(25, 7), undefined);
assert.equal(routes.gate(3, 5), 'G08');
assert.equal(routes.gate(14, 13), 'G01');
assert.equal(routes.connection(13, 14), undefined);
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
  G01: [[14, 13]], G02: [[7, 15]], G03: [[2, 7], [3, 7]], G04: [[15, 6]], G05: [[2, 6]],
  G06: [[2, 19]], G07: [[3, 26]], G08: [[3, 5]], G09: [[9, 10]]
};
for (const [id, crossings] of Object.entries(gateCrossings)) {
  for (const [a, b] of crossings) for (const [from, to] of id === 'G01' ? [[a, b]] : [[a, b], [b, a]]) {
    assert.equal(routes.gate(from, to), id);
    const { game, at, actor } = scenario({ gatinha: { start: from, interval: 10, positions: [from, to] } },
      { random: () => 0, gates: [id] });
    const due = 10;
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
  const { at, actor, output } = scenario({ gatinha: { start: 3, interval: 10, positions: [3, 4, 24, 26] } },
    { random: () => draw, gates: ['G07'] });
  for (const [from, to] of [[3, 4], [3, 24], [4, 24]]) assert(!routes.connection(from, to));
  at(10);
  assert.equal(actor('gatinha').position, 3);
  at(12, {}, { type: 'gate', id: 'G07' });
  draw = .4;
  at(22);
  at(32);
  assert.deepEqual(output('move').map(({ from, to }) => [from, to]), [[3, 26], [26, 4], [4, 26]]);
  const hiding = scenario({ gatinha: { start: 26, interval: 10, positions: [24, 26] } });
  hiding.at(10);
  assert.equal(hiding.actor('gatinha').position, 24);
  assert.equal(hiding.game.cameraActors('CAM07').length, 0);
}

{
  const distance = routes.distances([14], id => base.characters.gatinha.positions.includes(id), Infinity,
    edge => edge.gateId !== 'G02', true);
  assert.equal(distance.get(7), 6);
  assert.equal(distance.get(25), 7);
}

{
  const expected = {
    padrao: ['C1', 'C2', 'C3', 'E1', 'E2', 'E3'],
    gotica: ['C1', 'C2', 'C3', 'E1', 'E2'],
    yandere: ['C1', 'C2', 'C3', 'E1', 'E2', 'electrical'],
    gatinha: ['C2', 'E1', 'E2'], maid: []
  };
  const routing = createAttackRoutes(base, routes, () => 0, () => 0, () => true);
  assert.deepEqual([1, 3, 4, 7, 8, 10].map(routing.bonus), [12, 12, 16, 16, 20, 20]);
  for (const [key, ids] of Object.entries(expected)) {
    const rule = base.characters[key];
    assert.deepEqual(rule.routes ?? [], ids);
    for (const id of ids) {
      const paths = rule.routePaths?.[id] ?? base.movement.routes.definitions[id].paths;
      assert.equal(paths.length, id === 'E3' ? 2 : 1);
      for (const path of paths) {
        assert.equal(path[0], rule.start);
        path.forEach((position, index) => {
          assert(rule.positions.includes(position));
          if (!index) return;
          const edge = routes.connection(path[index - 1], position);
          assert(edge);
          if (edge.actors) assert(edge.actors.includes(key));
        });
      }
    }
  }

  for (const [draw, checkpoints] of [[.2, [2, 3, 5, 8, 11, 10]], [.8, [2, 19, 22, 11, 10]]]) {
    const routing = createAttackRoutes(base, routes, () => draw, () => 0, () => true);
    const rule = base.characters.padrao;
    const actor = { key: 'padrao', allowed: new Set(rule.positions), position: 1, lastRoute: null };
    const onlyExterior = structuredClone(base);
    onlyExterior.characters.padrao.routes = ['E3'];
    const exterior = createAttackRoutes(onlyExterior, routes, () => draw, () => 0, () => true);
    exterior.select(actor);
    assert.equal(actor.route.id, 'E3');
    assert.deepEqual(actor.route.checkpoints, checkpoints);
    actor.route = null;
    exterior.select(actor);
    assert.equal(actor.route, null); // Both variants share the same route identity.
    routing.select(actor);
    assert.notEqual(actor.route.id, 'E3');
  }
}

// A deviation keeps the checkpoint. A return to the route gets the weight bonus.
for (const [level, expected] of [[2, 1], [8, 3]]) {
  let draw = .177;
  const { at, actor } = scenario({ gotica: { start: 2, interval: 10, routes: ['E1'] } },
    { levels: { gotica: level }, random: () => draw });
  at(10);
  assert.equal(actor('gotica').position, expected);
  assert.equal(actor('gotica').checkpoint, expected === 1 ? 3 : 5);
  if (expected === 1) {
    draw = 0;
    at(20);
    assert.equal(actor('gotica').position, 2);
    assert.equal(actor('gotica').route, 'E1');
    assert.equal(actor('gotica').checkpoint, 3);
  }
}

{
  const { at, actor, output } = scenario({ gatinha: { start: 7, interval: 10, routes: ['C2', 'E2'] } },
    { random: () => .4, gates: ['G02'] });
  at(10);
  assert.equal(actor('gatinha').route, 'C2');
  assert.match(actor('gatinha').stopped, /porta fechada/);
  at(12.999);
  assert.equal(actor('gatinha').route, 'C2');
  at(13);
  assert.equal(actor('gatinha').route, 'E2');
  assert.equal(actor('gatinha').freeMoves, 0);
  at(13);
  assert.equal(actor('gatinha').route, 'E2');
  assert.deepEqual(output('move'), []);
}

for (const input of [{ camera: 'CAM06' }, {}]) {
  const { at, actor } = scenario({ gatinha: { start: 7, interval: 10, routes: ['C2', 'E2'] } },
    { random: () => .4, tune(config) { config.map.capacities[15] = input.camera ? 3 : 0; } });
  at(10, input);
  assert.match(actor('gatinha').stopped, input.camera ? /observada/ : /lotada/);
  at(13, input);
  assert.equal(actor('gatinha').route, 'C2');
  assert.equal(actor('gatinha').audioRetention, .75);
}

{
  const { at, actor } = scenario({ gatinha: { start: 7, interval: 10, routes: ['C2', 'E2'] } },
    { random: () => .4, gates: ['G02'] });
  const observed = { camera: 'CAM06' };
  at(10, observed);
  at(11, observed, { type: 'gate', id: 'G02' });
  at(12, observed, { type: 'gate', id: 'G02' });
  at(13, observed);
  assert.equal(actor('gatinha').route, 'C2'); // Observation outlasted the window, but the gate reopened.
}

{
  const { at, actor } = scenario({ yandere: { start: 2, interval: 10, positions: [2, 19] } }, { gates: ['G06'] });
  at(10);
  assert.match(actor('yandere').stopped, /porta fechada/);
  at(13);
  closeTo(actor('yandere').remaining, 5);
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
    padrao: { start: 10, interval: 10, routes: ['E1'] },
    gotica: { start: 10, interval: 10, routes: ['E1'] }
  }, { random: () => 0 });
  at(10, { leftLook: true });
  assert.equal(actor('padrao').position, 10);
  at(11);
  assert.equal(actor('padrao').position, 12);
  assert.equal(actor('gotica').position, 10);
  assert.match(actor('gotica').stopped, /lotada/);
}

{
  const { game, at, actor } = scenario({
    padrao: { start: 15, interval: 10, routes: ['C1'] },
    gotica: { start: 15, interval: 10, routes: ['C1'] },
    gatinha: { start: 15, interval: 10, routes: ['C2'] }
  }, { random: () => 0 });
  at(10);
  assert.equal(game.officeState().front.length, 2);
  assert.equal(actor('gatinha').position, 15);
  assert.match(actor('gatinha').stopped, /lotada/);
}

{
  const { at, game, actor } = scenario({
    padrao: { start: 6, interval: 10 }, gotica: { start: 6, interval: 10 },
    yandere: { start: 6, interval: 10 }, gatinha: { start: 7, interval: 10 }
  }, { random: () => .45 });
  at(10);
  assert.equal(game.officeState().back.length, 3);
  assert.equal(actor('gatinha').position, 7);
  assert.match(actor('gatinha').stopped, /lotada/);
}

{
  const { game, at, actor, output } = scenario({
    maid: { start: 14, interval: 10, initialStationaryAttempts: undefined },
    gotica: { start: 10, interval: 11, routes: ['E1'] }
  }, { random: () => 0 });
  at(10);
  at(11, { leftLook: true });
  assert.equal(actor('gotica').position, 10);
  at(12);
  assert.match(actor('gotica').stopped, /invasão em andamento/);
  assert.deepEqual(game.officeState().room, ['maid']);
  at(12, {}, { type: 'closetEnter' });
  at(14, {}, { type: 'gate', id: 'G01' });
  at(18.499);
  assert.equal(actor('maid').position, 13);
  at(18.5);
  assert.equal(actor('maid').position, 6);
  assert.equal(actor('maid').previous, routes.positions.get(13).name);
  assert.equal(actor('maid').remaining, 12.5);
  assert.equal(actor('maid').freeMoves, 0);
  assert.deepEqual(output('move').filter(({ actor }) => actor.key === 'maid').map(({ from, to }) => [from, to]),
    [[14, 13], [13, 6]]);
  assert.deepEqual(output('loss'), []);
}

{
  const { at, actor, output } = scenario({ gotica: { start: 10, interval: 10, routes: ['E1'] } },
    { gates: ['G01'], random: () => 0 });
  at(10);
  assert.equal(actor('gotica').position, 12);
  assert.equal(actor('gotica').routeCompleted, true);
  assert.equal(actor('gotica').approach, 'entry');
  assert.equal(actor('gotica').freeMoves, 0);
  at(20);
  assert.equal(actor('gotica').position, 13);
  assert.deepEqual(output('move').map(({ from, to }) => [from, to]), [[10, 12], [12, 13]]);
}

for (const key of ['padrao', 'gotica', 'yandere', 'gatinha', 'maid']) {
  for (const roll of [.7499, .75]) {
    let draw = 0;
    const { at, actor, output } = scenario({ [key]: { start: 14, interval: 10, initialStationaryAttempts: undefined } },
      { random: () => draw, gates: ['G01'] });
    if (key === 'padrao') {
      // Advance at the noise-adjusted odds, but miss the forced-opening roll.
      draw = .75;
    }
    at(10);
    assert.match(actor(key).stopped, /porta fechada/);
    at(12.999);
    assert.equal(actor(key).position, 14);
    draw = roll;
    at(13);
    if (key === 'maid' || roll === .75) {
      assert.equal(actor(key).counterattack, false);
      assert.equal(actor(key).position, 7);
      assert.equal(actor(key).intervalPenalty, 1.25);
      continue;
    }
    assert.equal(actor(key).position, 14);
    assert.equal(actor(key).route, 'E2');
    assert.equal(actor(key).counterattack, true);
    assert.equal(actor(key).freeMoves, 0);
    assert.equal(actor(key).intervalPenalty, 1);
    draw = 0;
    at(23);
    assert.equal(actor(key).position, 15);
    assert.equal(actor(key).approach, null);
    at(33);
    assert.equal(actor(key).position, 10);
    assert.equal(actor(key).approach, 'approach');
    at(43);
    assert.equal(actor(key).position, 12);
    assert.equal(actor(key).routeCompleted, true);
    at(53);
    assert.equal(actor(key).position, 13);
    assert.deepEqual(output('move').map(({ from, to }) => [from, to]), [[14, 15], [15, 10], [10, 12], [12, 13]]);
  }
}

{
  let draw = 0;
  const { at, actor, output } = scenario({ gotica: { start: 15, interval: 10, routes: ['C1', 'E2'] } },
    { random: () => draw });
  const quiet = { radio: false };
  at(0, quiet);
  at(10, quiet);
  assert.equal(actor('gotica').routeCompleted, true);
  draw = .90; // Stay at the imminent stage in silence.
  at(20, quiet);
  assert.equal(actor('gotica').position, 14);
  assert.equal(actor('gotica').route, 'C1');
  assert.equal(actor('gotica').freeMoves, 0);
  draw = .99; // Abandon the approach.
  at(30, quiet);
  assert.equal(actor('gotica').position, 7);
  assert.equal(actor('gotica').route, null);
  assert.equal(actor('gotica').lastRoute, 'C1');
  assert.equal(actor('gotica').freeMoves, 1);
  closeTo(actor('gotica').remaining, 12.5);
  at(42.499, quiet);
  assert.equal(actor('gotica').freeMoves, 1);
  at(42.5, quiet);
  assert.equal(actor('gotica').position, 7);
  assert.equal(actor('gotica').freeMoves, 0);
  assert.equal(actor('gotica').intervalPenalty, 1);
  at(52.5, quiet);
  assert.equal(actor('gotica').route, 'E2');
  assert.deepEqual(output('move').map(({ from, to }) => [from, to]), [[15, 14], [14, 7]]);
}

for (const [key, route, start, destination] of [
  ['padrao', 'E1', 10, 11], ['padrao', 'E1', 12, 11], ['gatinha', 'E1', 10, 9],
  ['gatinha', 'E1', 12, 9], ['gatinha', 'C2', 15, 7], ['gatinha', 'C2', 14, 7],
  ['maid', undefined, 15, 7], ['maid', undefined, 14, 7]
]) {
  const { at, actor, output } = scenario({ [key]: { start, interval: 10, initialStationaryAttempts: undefined,
    ...(route ? { routes: [route] } : {}) } }, { random: () => .999 });
  at(0, { radio: false });
  at(10, { radio: false });
  assert.equal(actor(key).position, destination);
  assert.equal(actor(key).route, null);
  assert.equal(output('move')[0].retreat, route === 'E1' ? 'stock' : 'corridor');
}

for (const blocked of ['open', 'expire']) {
  let draw = .99;
  const { at, actor } = scenario({ gatinha: { start: 14, interval: 10, routes: ['C2', 'E2'] } },
    { random: () => draw, gates: ['G02'] });
  at(0, { radio: false });
  at(10, { radio: false });
  draw = .4; // From VIP2, attempt the closed G02 on the free move.
  at(22.5);
  assert.equal(actor('gatinha').freeMoves, 1);
  assert.match(actor('gatinha').stopped, /porta fechada/);
  if (blocked === 'open') at(24, {}, { type: 'gate', id: 'G02' });
  else at(25.5);
  assert.equal(actor('gatinha').freeMoves, 0);
  assert.equal(actor('gatinha').route, null);
  assert.equal(actor('gatinha').position, blocked === 'open' ? 15 : 7);
}

{
  const { at, actor, game, output } = scenario({
    padrao: { start: 12, interval: 10 }, gotica: { start: 14, interval: 11 }
  }, { random: () => 0 });
  at(10);
  at(11);
  assert.deepEqual(game.officeState().room, ['original', 'gotica']);
  at(12, {}, { type: 'closetEnter' });
  at(15.5);
  assert.deepEqual(game.officeState().room, ['gotica']);
  assert.equal(actor('padrao').position, 6);
  assert.equal(actor('padrao').freeMoves, 1);
  at(16.5);
  assert.deepEqual(game.officeState().room, []);
  assert.equal(actor('gotica').position, 6);
  assert.equal(actor('gotica').freeMoves, 1);
  assert.deepEqual(output('move').filter(move => move.retreat === 'office')
    .map(({ actor }) => actor.key), ['padrao', 'gotica']);
}

{
  const { at, game } = scenario({ gotica: { start: 14, interval: 10 } }, { random: () => 0 });
  at(10);
  at(14.4, {}, { type: 'closetEnter' });
  at(15.5);
  assert.deepEqual(game.officeState().room, ['gotica']);
  at(18.5);
  assert.deepEqual(game.officeState().room, []);
}

for (const [roll, chance, expected] of [[.1499, .15, 'electrical'], [.15, .15, 'C1'], [0, 0, 'C1']]) {
  let draw = () => 0;
  const { at, actor } = scenario({ yandere: { start: 1, interval: 10 } }, {
    random: () => draw(),
    tune(config) { config.movement.routes.electricalChance = chance; }
  });
  const draws = [roll, 0, 0];
  draw = () => draws.shift() ?? 0;
  at(10);
  assert.equal(actor('yandere').route, expected);
  if (expected !== 'electrical') continue;
  assert.equal(actor('yandere').checkpoint, 19);
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

for (const key of ['gotica', 'yandere', 'gatinha', 'padrao', 'maid']) {
  const actor = { key, rule: base.characters[key], position: 15, noise: 0, light: 0 };
  const fx = createEffects(base, routes, [actor]);
  for (const objective of ['corridor', 'stock']) {
    for (const [phase, quiet, loud] of [['approach', .76, .96], ['entry', .86, .98]]) {
      actor.noise = 0;
      const odds = fx.attackOdds(actor, objective, phase);
      closeTo(odds.advance, quiet);
      closeTo(odds.stay, (1 - quiet) * .6);
      closeTo(odds.abandon, (1 - quiet) * .4);
      actor.noise = base.effects.noise.max;
      closeTo(fx.attackOdds(actor, objective, phase).advance, loud);
    }
  }
  actor.noise = 0;
  fx.integrate(4, { corridorLight: true });
  const [approach, entry] = {
    gotica: [.18, .21], yandere: [.18, .21], gatinha: [.94, .98], padrao: [.76, .86], maid: [.76, .86]
  }[key];
  closeTo(fx.attackOdds(actor, 'corridor', 'approach').advance, approach);
  closeTo(fx.attackOdds(actor, 'corridor', 'entry').advance, entry);
  closeTo(fx.attackOdds(actor, 'stock', 'approach').advance, .76);
  if (['gotica', 'yandere'].includes(key)) assert(fx.attackOdds(actor, 'corridor', 'entry').abandon > .6);
  fx.integrate(5, {});
  closeTo(fx.attackOdds(actor, 'corridor', 'approach').advance, .76);
}

for (const key of ['gotica', 'yandere', 'gatinha']) {
  const { at, actor } = scenario({ [key]: { start: 15, interval: 10, routes: [key === 'gatinha' ? 'C2' : 'C1'] } },
    { random: () => 0 });
  at(0, { radio: false, corridorLight: true });
  at(10, { radio: false, corridorLight: true });
  assert.equal(actor(key).position, 14);
  assert.equal(actor(key).routeCompleted, true);
  assert.equal(actor(key).approach, 'entry');
  at(20, { radio: false, corridorLight: true });
  assert.equal(actor(key).position, 13);
}

{
  const rules = structuredClone(base);
  const actor = {
    key: 'yandere', rule: rules.characters.yandere, position: 15, noise: 0,
    light: 0, audioRetention: 1
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
  assert.equal(actor.noise, 0);
  fx.integrate(40, { radio: true, computer: true, viewMoving: true });
  assert.equal(actor.noise, base.effects.noise.max);
  const loud = fx.attackOdds(actor, 'corridor', 'entry').advance;
  fx.integrate(2, {});
  assert(fx.attackOdds(actor, 'corridor', 'entry').advance < loud);
  const before = actor.noise;
  fx.addNoiseEvent('closetExit');
  closeTo(actor.noise - before, base.effects.noise.events.closetExit);
  actor.position = 14;
  fx.integrate(30, { corridorLight: true });
  assert.equal(actor.light, 1);
}

for (const level of [3, 4, 10]) {
  let draw = .72;
  const { at, actor, game } = scenario({ yandere: { start: 19, interval: 20, routes: ['electrical'] } },
    { levels: { yandere: level }, random: () => draw });
  const normal = 20 * (1 - .08 * base.movement.difficulty.oddSteps.filter(step => level >= step).length);
  const due = actor('yandere').remaining;
  closeTo(due, normal * (level >= 4 ? .60 : 1));
  at(due);
  assert.equal(actor('yandere').position, 21);
  assert(game.electricalFault());
  assert.equal(actor('yandere').lastRoute, 'electrical');
  assert.equal(actor('yandere').freeMoves, 1);
  closeTo(actor('yandere').remaining, normal * 1.25);
  draw = 0;
  at(due + normal * 1.25 + .000001);
  assert.equal(actor('yandere').position, 19);
  assert(Math.abs(actor('yandere').remaining - normal) < .00001);
  assert.equal(actor('yandere').freeMoves, 0);
  at(due + normal * 2.25 + .001);
  assert.equal(actor('yandere').route, null);
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
    const { actor, from, to, retreat } = value;
    const edge = routes.connection(from, to);
    assert.equal(atPosition.get(actor.key), from);
    if (from === to) assert.equal(actor.key, 'maid');
    else {
      if (retreat) {
        assert(base.movement.retreat[retreat].includes(to));
        if (retreat === 'office') assert.equal(from, base.map.office);
      } else {
        assert(edge);
        assert(!edge.actors || edge.actors.includes(actor.key));
        assert(!game.isGateClosed(edge.gateId));
      }
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

{
  const rules = { ...base.night, powerEnabled: false, sanityEnabled: false };
  const levels = { ...base.night.campaign[8].levels, palhaca: 0, shadow: 0, smores: 0 };
  const input = { closet: true, corridorLight: true };
  function run(step) {
    const events = [];
    let seed = 912;
    const random = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 2 ** 32;
    };
    const game = createMovement(base, { random, emit(type, detail) {
      events.push(type === 'move' ? [type, detail.actor.key, detail.from, detail.to] : [type]);
    } });
    game.reset(levels, input, rules);
    game.advance(0, input, { type: 'closetEnter' });
    for (let time = step; time < 240; time += step) game.advance(time, input);
    game.advance(240, input);
    return { events, snapshot: game.snapshot() };
  }
  const continuous = run(.125);
  const resumed = run(240);
  assert(continuous.events.length > 10);
  assert.deepEqual(resumed.events, continuous.events);
  closeTo(resumed.snapshot.hours, continuous.snapshot.hours);
  assert.equal(resumed.snapshot.now, 240);
}

console.log('PASS: physical graph, route checkpoints, blocked moves, attack probabilities, recovery, static, clown and deadline catch-up.');
