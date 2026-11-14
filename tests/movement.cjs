const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

global.window = {};
for (const file of ['data/game-data', 'data/camera-layers', 'data/complex-layers', 'gameplay/routes', 'gameplay/effects', 'gameplay/threats',
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
assert.equal(routes.positions.size, 25);
assert.equal(base.map.edges.length, 35);
assert.deepEqual(routes.neighbors.get(2).sort((a, b) => a - b), [1, 3, 6, 7]);
assert.equal(routes.gate(19, 1), 'G06');
assert.equal(routes.connection(19, 18).openingId, 'P10');
assert.equal(routes.connection(18, 19), routes.connection(19, 18));
assert.equal(routes.connection(19, 15), undefined);
assert.equal(routes.connection(15, 19), undefined);
assert.deepEqual(routes.connection(19, 20).actors, ['padrao']);
assert.deepEqual(Object.keys(base.characters).filter(key => base.characters[key].positions.includes(20)), ['padrao']);
assert.deepEqual(Object.keys(base.characters).filter(key => base.characters[key].positions.includes(24)), ['gatinha']);
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
for (const { from, to, type, gateId, openingId, exits, through = [], via = [] } of base.map.edges) {
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
    const rooms = [a, ...through, b];
    const openings = [gateId ?? openingId, ...via];
    assert.equal(openings.length, rooms.length - 1);
    openings.forEach((id, i) => {
      const opening = byOpening.get(id);
      assert.equal(opening.type, i === 0 && type === 'gate' ? 'portao' : 'livre');
      assert(crosses(opening, rooms[i], rooms[i + 1]), id);
    });
  }
}
const gateCrossings = {
  G01: [[14, 13]], G02: [[7, 15]], G03: [[2, 7], [3, 7]], G04: [[15, 6]], G05: [[2, 6]],
  G06: [[1, 19]], G07: [[3, 4], [3, 24]], G08: [[3, 5]], G09: [[9, 10]]
};
for (const [id, crossings] of Object.entries(gateCrossings)) {
  if (id === 'G01') continue; // Office entry is verified after completing a corridor route.
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
  const { at, actor, output } = scenario({ gatinha: { start: 3, interval: 10, positions: [3, 4] } },
    { random: () => 0, gates: ['G07'] });
  at(10);
  assert.equal(actor('gatinha').position, 3);
  at(12, {}, { type: 'gate', id: 'G07' });
  at(22);
  assert.deepEqual(output('move').map(({ from, to }) => [from, to]), [[3, 4], [4, 3]]);
  const hiding = scenario({ gatinha: { start: 4, interval: 10, positions: [4, 24] } });
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
    padrao: { CV: 19, CC: 19, EL: 16, EC: 15, EV: 10, ES: 21 },
    gotica: { CV: 30, CC: 30, EL: 20, EC: 10, EV: 10 },
    yandere: { CV: 22, CC: 22, EL: 10, EC: 14, EV: 8, EE: 24 },
    gatinha: { CV: 48, EL: 26, EV: 26 }, maid: {}
  };
  const open = (_, edge) => Boolean(edge);
  const routing = createAttackRoutes(base, routes, () => 0, open, open);
  assert.deepEqual([1, 3, 4, 7, 8, 10].map(level => routing.bonus(level)), [22, 22, 27, 27, 32, 32]);
  assert.deepEqual([1, 3, 4, 7, 8, 10].map(level => routing.bonus(level, 2)), [28, 28, 35, 35, 42, 42]);
  assert.deepEqual([1, 3, 4, 7, 8, 10].map(level => routing.bonus(level, 2, 'padrao')), [29, 29, 36, 36, 43, 43]);
  assert.equal(routing.bonus(10, 120), 632);
  for (const [key, weights] of Object.entries(expected)) {
    const rule = base.characters[key];
    const actor = { key, rule, allowed: new Set(rule.positions), position: rule.start };
    const odds = routing.selectionOdds(actor);
    assert.deepEqual(odds.map(({ route }) => route.id), Object.keys(weights));
    for (const { route, probability } of odds) {
      closeTo(probability, weights[route.id] / 100);
      assert.equal(route.required, route.id === 'EE' ? null : route.paths[0][0]);
      assert(route.paths?.every(path => path.at(-1) === route.target) ?? route.target === 21);
    }
  }
  const rule = base.characters.padrao;
  for (const position of [5, 19]) {
    const actor = { key: 'padrao', rule, allowed: new Set(rule.positions), position };
    const { route } = routing.selectionOdds(actor).find(({ route }) => route.id === 'ES');
    assert.equal(route.required, position === 5 ? 8 : 22);
  }
  const gatinha = base.characters.gatinha;
  const actor = { key: 'gatinha', rule: gatinha, allowed: new Set(gatinha.positions), position: 3 };
  const closedVip = (_, edge) => open(null, edge) && edge.gateId !== 'G02';
  const available = createAttackRoutes(base, routes, () => 0, closedVip, closedVip).selectionOdds(actor);
  assert.deepEqual(available.map(({ route, probability }) => [route.id, probability]), [['EL', 1]]);
}

// Beginning at the stockroom still requires CAM12. Its intermediate corridor visit cannot start an attack.
{
  const { at, actor, output } = scenario({ gotica: { start: 10, interval: 10, routes: { EC: 100 } } },
    { random: () => 0 });
  for (const time of [10, 20, 30, 40, 50]) {
    at(time, { corridorLight: true });
    assert.equal(actor('gotica').approach, null);
    assert.equal(actor('gotica').noise, 0);
    assert.equal(actor('gotica').light, 0);
    assert.equal(actor('gotica').routeBonus, 22 + 3 * time / 10);
  }
  at(60);
  assert.equal(actor('gotica').approach, 'approach');
  assert.equal(actor('gotica').noise, 0);
  assert.equal(actor('gotica').routeCompleted, true);
  assert.deepEqual(output('move').map(({ to }) => to), [15, 18, 19, 18, 15, 10]);
}

for (const reason of ['observada', 'lotada']) {
  const input = reason === 'observada' ? { camera: 'CAM06' } : {};
  const { at, actor, output } = scenario({ gatinha: { start: 7, interval: 10, routes: { CV: 48, EL: 26 } } }, {
    random: () => 0,
    tune(config) { if (reason === 'lotada') config.map.capacities[15] = 0; }
  });
  at(10, input);
  assert.equal(actor('gatinha').route, 'CV');
  assert.match(actor('gatinha').stopped, new RegExp(reason));
  at(14.999, input);
  assert.equal(actor('gatinha').route, 'CV');
  at(15, input);
  assert.equal(actor('gatinha').route, 'EL');
  assert.equal(actor('gatinha').routeBonus, 22);
  closeTo(actor('gatinha').remaining, 3.5);
  assert.deepEqual(output('move'), []);
}

for (const reopen of [true, false]) {
  const { at, actor } = scenario({ gatinha: { start: 3, interval: 10, routes: { CV: 48, EL: 26 } } },
    { random: () => 0 });
  at(10);
  assert.equal(actor('gatinha').position, 7);
  assert.equal(actor('gatinha').routeBonus, 25);
  at(11, {}, { type: 'gate', id: 'G02' });
  at(20);
  assert.match(actor('gatinha').stopped, /porta fechada/);
  if (reopen) {
    at(24.999, {}, { type: 'gate', id: 'G02' });
    assert.equal(actor('gatinha').position, 15);
    assert.equal(actor('gatinha').approach, 'approach');
  } else {
    at(25);
    assert.equal(actor('gatinha').position, 7);
    assert.equal(actor('gatinha').route, 'EL');
    assert.equal(actor('gatinha').routeBonus, 22);
    closeTo(actor('gatinha').remaining, 3.5);
  }
}

{
  const { at, actor, output } = scenario({ gotica: { start: 19, interval: 10, routes: { CC: 100 } } }, {
    random: () => 0,
    tune(config) {
      config.map.edges.find(({ from, to }) => from === 15 && to === 18).gateId = 'G09';
    }
  });
  at(10);
  at(11, {}, { type: 'gate', id: 'G09' });
  at(30);
  assert.deepEqual(output('move').map(({ to }) => to), [18, 17, 15]);
  assert.equal(actor('gotica').approach, 'approach');
}

{
  let draw = .5;
  const { at, game, actor, output } = scenario({ gatinha: { start: 7, interval: 10, routes: { CV: 100 } } },
    { random: () => draw });
  const odds = game.debugSnapshot().actors[0].odds;
  const total = 1.22 + 1 + 1.05 + .25;
  closeTo(odds['Corredor central — fundo'], 1.22 / total);
  closeTo(odds['Fundo do salão (CAM 04)'], 1 / total);
  closeTo(odds['Escondida na VIP 2'], 1.05 / total);
  closeTo(odds.Ficar, .25 / total);
  at(10);
  assert.equal(actor('gatinha').position, 3);
  assert.equal(actor('gatinha').lastReached, 7);
  assert.equal(actor('gatinha').checkpoint, 7);
  const recoveryOdds = game.debugSnapshot().actors[0].odds;
  closeTo(recoveryOdds['VIP 2'] / recoveryOdds.Recepção, 1.25);
  draw = .99;
  at(20);
  assert.equal(actor('gatinha').routeBonus, 25);
  draw = 0;
  at(40);
  assert.deepEqual(output('move').map(({ to }) => to), [3, 7, 15]);
  assert.equal(actor('gatinha').routeBonus, 31);
  assert.equal(actor('gatinha').routeCompleted, true);
}

for (const [level, roll, opens] of [[3, .6999, true], [3, .70, false], [4, .9399, true], [4, .94, false]]) {
  let draw = 0;
  const { game, at, actor, output } = scenario({ padrao: { start: 1, interval: 10, positions: [1, 19] } },
    { levels: { padrao: level }, random: () => draw, gates: ['G06'] });
  at(0, { camera: 'CAM12' });
  at(9, { camera: 'CAM12' });
  assert.equal(actor('padrao').position, 1);
  assert.match(actor('padrao').stopped, /c.mera observada/);
  assert(game.isGateClosed('G06'));
  assert.deepEqual(output('openGate'), []);
  draw = roll;
  at(10);
  assert.equal(game.isGateClosed('G06'), !opens);
  assert.deepEqual(output('openGate'), opens ? ['G06'] : []);
  assert.deepEqual(output('gatesChanged'), opens ? [[{ id: 'G06', closed: false }]] : []);
  assert.equal(actor('padrao').position, opens ? 19 : 1);
}

{
  const { game, at, actor, output } = scenario({ padrao: { start: 1, interval: 10, positions: [1, 19] } },
    { gates: ['G06'], tune(config) { config.map.capacities[19] = 0; } });
  at(10);
  assert(!game.isGateClosed('G06'));
  assert.deepEqual(output('openGate'), ['G06']);
  assert.equal(actor('padrao').position, 1);
  assert.match(actor('padrao').stopped, /lotada/);
}

{
  const { game, at, actor } = scenario({
    padrao: { start: 1, interval: 10, positions: [1, 2] },
    gotica: { start: 1, interval: 11, positions: [1, 2] },
    yandere: { start: 1, interval: 11, positions: [1, 19] }
  }, { random: () => .5, gates: ['G06'] });
  at(10, { camera: 'CAM03' });
  assert.equal(actor('padrao').position, 1);
  at(11, { camera: 'CAM03' });
  assert.equal(game.snapshot().static, true);
  assert.equal(actor('padrao').position, 2);
  assert.equal(actor('gotica').position, 2);
  assert.equal(actor('yandere').position, 1);
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
    padrao: { start: 9, interval: 10, routes: { EV: 100 } },
    gotica: { start: 9, interval: 10, routes: { EV: 100 } }
  }, { random: () => 0 });
  at(50);
  assert.equal(actor('padrao').position, 10);
  assert.equal(actor('gotica').position, 10);
  assert.equal(actor('gotica').approach, 'approach');
  at(60, { leftLook: true });
  assert.match(actor('padrao').stopped, /porta esquerda observada/);
  at(61);
  assert.equal(actor('padrao').position, 12);
  assert.equal(actor('gotica').position, 10);
  assert.match(actor('gotica').stopped, /lotada/);
}

{
  const { game, at, actor } = scenario({
    padrao: { start: 6, interval: 10, routes: { CV: 100 } },
    gotica: { start: 6, interval: 10, routes: { CV: 100 } },
    yandere: { start: 6, interval: 10, routes: { CV: 100 } },
    gatinha: { start: 7, interval: 10, routes: { CV: 100 } }
  }, { random: () => 0 });
  at(10);
  assert.equal(game.officeState().back.length, 3);
  assert.equal(actor('gatinha').position, 7);
  assert.match(actor('gatinha').stopped, /lotada/);
  at(20);
  assert.equal(game.officeState().front.length, 2);
  assert.match(actor('yandere').stopped, /lotada/);
}

{
  const { at, actor, output } = scenario({ gotica: { start: 7, interval: 10, routes: { CV: 30, EL: 20 } } },
    { gates: ['G01'], random: () => 0 });
  at(10);
  assert.equal(actor('gotica').approach, 'approach');
  assert.equal(actor('gotica').routeCompleted, true);
  at(20);
  assert.equal(actor('gotica').approach, 'entry');
  at(30);
  assert.match(actor('gotica').stopped, /porta fechada/);
  at(34.999);
  assert.equal(actor('gotica').position, 14);
  at(35);
  assert.equal(actor('gotica').route, 'EL');
  assert.equal(actor('gotica').approach, null);
  assert.equal(actor('gotica').noise, 0);
  assert.equal(actor('gotica').routeBonus, 22);
  closeTo(actor('gotica').remaining, 3.5);
  assert.deepEqual(output('move').map(({ to }) => to), [15, 14, 17]);
  assert.deepEqual(output('corridorAttack'), ['gotica']);
}

{
  const { at, actor, output } = scenario({
    gotica: { start: 7, positions: [7, 15, 14, 13], interval: 10, routes: { CV: 100 } }
  },
    { gates: ['G02'], random: () => 0 });
  at(10, { corridorLight: true });
  assert.equal(actor('gotica').position, 7);
  assert.match(actor('gotica').stopped, /porta fechada/);
  assert(output('corridorFlicker').length > 0);
  assert.deepEqual(output('corridorAttack'), []);
  at(11, { corridorLight: true }, { type: 'gate', id: 'G02' });
  assert.equal(actor('gotica').position, 15);
  assert.deepEqual(output('corridorAttack'), ['gotica']);
}

{
  let draw = 0;
  const { at, actor, output } = scenario({ gotica: { start: 7, interval: 10, routes: { CV: 100 } } },
    { random: () => draw });
  const quiet = { radio: false };
  at(0, quiet);
  at(20, quiet);
  draw = .84;
  at(30, quiet);
  assert.equal(actor('gotica').position, 14);
  draw = .99;
  at(40, quiet);
  assert.equal(actor('gotica').position, 7);
  assert.equal(actor('gotica').route, null);
  assert.equal(actor('gotica').freeMoves, 1);
  closeTo(actor('gotica').remaining, 12.5);
  at(52.5, quiet);
  assert.equal(actor('gotica').position, 7);
  assert.equal(actor('gotica').freeMoves, 0);
  assert.deepEqual(output('move').map(({ from, to }) => [from, to]), [[7, 15], [15, 14], [14, 7]]);
}

{
  const { at, game, actor } = scenario({ maid: { start: 15, interval: 10, initialStationaryAttempts: undefined } },
    { random: () => 0 });
  assert.equal(actor('maid').approach, 'approach');
  at(20);
  assert.deepEqual(game.officeState().room, ['maid']);
  at(22, {}, { type: 'closetEnter' });
  assert(actor('maid').noise > 0);
  at(28.5);
  assert.deepEqual(game.officeState().room, []);
  assert.equal(actor('maid').noise, 0);
  assert.equal(actor('maid').intervalPenalty, 1.25);
}

for (const [key, reaction] of Object.entries({ padrao: 3.5, gotica: 4.5, yandere: 4.5, gatinha: 4.5, maid: 2.5 })) {
  for (const level of [5, 6]) {
    const { at, actor, output, game } = scenario({
      [key]: { start: key === 'maid' ? 15 : 7, interval: 20, routes: key === 'maid' ? undefined : { CV: 100 },
        initialStationaryAttempts: undefined }
    }, { random: () => 0, levels: { [key]: level } });
    const loud = { radio: true, flashlight: true, corridorLight: true, viewMoving: true };
    let time = 0;
    for (let step = 0; step < (key === 'maid' ? 2 : 3); step++) {
      time += actor(key).remaining;
      at(time, loud);
    }
    assert.equal(actor(key).position, 13);
    const deadline = time + reaction * (level === 6 ? .89 : 1);
    at(deadline - .001, loud);
    assert.equal(game.snapshot().outcome, null);
    at(deadline, loud);
    assert.deepEqual(output('loss'), [key]);
  }
}

const corridorOdds = {
  gotica: [[.60, .85], [.80, .99]], yandere: [[.60, .85], [.80, .99]],
  gatinha: [[.15, .45], [.25, .65]], maid: [[.65, .76], [.85, .96]],
  padrao: [[.45, .80], [.60, .98]]
};
const attackPhases = ['approach', 'entry'];
{
  let draw;
  const actor = { key: 'yandere', position: base.map.back, noise: 45, light: .5 };
  const fx = createEffects(base, routes, [actor]);
  const approach = window.NathGame.createApproach(base.map, fx, () => draw);
  approach.begin(actor, 'corridor');
  actor.noise = 45;
  actor.light = .5;
  const { advance } = fx.attackOdds(actor, 'corridor', 'approach');
  draw = advance - .000001;
  assert.deepEqual(approach.choose(actor), { to: base.map.front });
  draw = advance;
  assert.deepEqual(approach.choose(actor), { stay: true });
  draw = advance + (1 - advance) * .30 - .000001;
  assert.deepEqual(approach.choose(actor), { stay: true });
  draw = advance + (1 - advance) * .30;
  assert.deepEqual(approach.choose(actor), { abandon: 'corridor' });
}
for (const [key, corridor] of Object.entries(corridorOdds)) {
  const actor = { key, rule: base.characters[key], position: 15, noise: 0, light: 0,
    approach: { objective: 'corridor', phase: 'approach' } };
  const fx = createEffects(base, routes, [actor]);
  const tables = { corridor, ...(key !== 'maid' && { stock: [[.20, .94], [.40, .99]] }) };
  for (const [objective, table] of Object.entries(tables)) {
    for (const [index, phase] of attackPhases.entries()) {
      const [quiet, loud] = table[index];
      for (const noise of [0, 50, 100]) {
        actor.noise = noise;
        const odds = fx.attackOdds(actor, objective, phase);
        const expected = quiet + (loud - quiet) * noise / 100;
        closeTo(odds.advance, expected);
        closeTo(odds.stay, (1 - expected) * .3);
        closeTo(odds.abandon, (1 - expected) * .7);
      }
    }
  }
  actor.noise = 0;
  const repelled = ['gotica', 'yandere'].includes(key);
  const attracted = key === 'gatinha';
  const seconds = attracted ? 6 : 8;
  fx.integrate(seconds / 2, { corridorLight: true });
  closeTo(actor.light, repelled || attracted ? .5 : 0);
  closeTo(fx.attackOdds(actor, 'corridor', 'entry').advance,
    corridor[1][0] + (repelled ? -.325 : attracted ? .325 : 0));
  actor.position = 14;
  fx.integrate(seconds / 2, { corridorLight: true });
  closeTo(actor.light, repelled || attracted ? 1 : 0);
  for (const [index, phase] of attackPhases.entries()) {
    const quiet = repelled ? [.05, .15][index] : attracted ? [.80, .90][index] : corridor[index][0];
    const odds = fx.attackOdds(actor, 'corridor', phase);
    closeTo(odds.advance, quiet);
    closeTo(odds.stay, (1 - quiet) * .3);
    if (key !== 'maid') closeTo(fx.attackOdds(actor, 'stock', phase).advance, tables.stock[index][0]);
    actor.noise = 100;
    const loud = corridor[index][1] - (repelled ? .65 : 0);
    closeTo(fx.attackOdds(actor, 'corridor', phase).advance, attracted ? .995 : loud);
    actor.noise = 0;
  }
  fx.integrate(2, {});
  closeTo(actor.light, repelled || attracted ? .6 : 0);
  fx.integrate(5, {});
  closeTo(fx.attackOdds(actor, 'corridor', 'approach').advance, corridor[0][0]);
}

for (const key of ['gotica', 'yandere', 'gatinha']) {
  const { at, actor } = scenario({ [key]: { start: 7, interval: 10, routes: { CV: 100 } } },
    { random: () => 0 });
  at(0, { radio: false, corridorLight: true });
  at(10, { radio: false, corridorLight: true });
  assert.equal(actor(key).position, 15);
  assert.equal(actor(key).routeCompleted, true);
  assert.equal(actor(key).approach, 'approach');
  at(20, { radio: false, corridorLight: true });
  assert.equal(actor(key).position, 14);
  at(30, { radio: false, corridorLight: true });
  assert.equal(actor(key).position, 13);
}

{
  let draw = 0;
  const { at, actor, game } = scenario({
    gotica: { start: 7, interval: 10, routes: { CV: 100 } },
    yandere: { start: 5, interval: 10, routes: { EL: 100 } },
    gatinha: { start: 7, interval: 15, routes: { CV: 100 } },
    maid: { start: 16, interval: 1000 }
  }, { random: () => draw });
  const quiet = { radio: false };
  const beam = { ...quiet, flashlight: true, corridorLight: true };
  const debug = key => game.debugSnapshot().actors.find(actor => actor.key === key);
  const decay = seconds => Math.exp(-.03 * seconds);
  at(0, { ...beam, radio: true, computer: true, viewMoving: true }, { type: 'computerPower' });
  at(5, { ...beam, radio: true, computer: true, viewMoving: true }, { type: 'computerPower' });
  assert(game.diagnostics().every(({ noise, light }) => noise === 0 && light === 0));
  at(10, beam);
  assert.equal(debug('gotica').attackActive, true);
  assert.equal(debug('gotica').attackPath, 'corridor');
  assert.equal(debug('gotica').noise, 0);
  assert.equal(debug('gotica').light, 0);
  assert.equal(debug('yandere').attackActive, false);

  at(11, quiet, { type: 'computerPower' }); // Off.
  at(11, beam, { type: 'computerPower' });  // On again, along with the flashlight.
  closeTo(debug('gotica').noise, (8 + 12) * .8);
  closeTo(debug('gotica').light, .125);
  at(11, beam);
  assert.equal(debug('gotica').noise, 16);
  const advance = .60 + .25 * .16 - .65 * .125;
  const stay = (1 - advance) * .30;
  closeTo(debug('gotica').attackOdds.advance, advance);
  closeTo(debug('gotica').attackOdds.stay, stay);
  closeTo(debug('gotica').attackOdds.abandon, 1 - advance - stay);

  at(15.001, quiet);
  assert.equal(debug('gatinha').attackPath, 'corridor');
  assert.equal(debug('gatinha').noise, 0);
  at(20, quiet);
  assert.equal(actor('gotica').position, 14);
  closeTo(debug('gotica').noise, 16 * decay(9));
  assert.equal(actor('yandere').position, 10);
  assert.equal(debug('yandere').noise, 0);
  assert.equal(debug('yandere').attackPath, 'stock');
  at(20, quiet, { type: 'closetEnter' });
  const closetBeam = { ...quiet, closet: true, flashlight: true, clownLight: true };
  at(20, closetBeam);
  at(20, closetBeam);
  closeTo(debug('gotica').noise, 16 * decay(9) + (5 + 8) * .8);
  closeTo(debug('gatinha').noise, (5 + 8) * .8);
  closeTo(debug('yandere').noise, 5 + 8);
  at(20, quiet, { type: 'closetExit' });
  closeTo(debug('yandere').noise, 18);
  assert.equal(debug('maid').noise, 0);
  assert.equal(debug('yandere').light, 0);

  const stockAdvance = .20 + (.94 - .20) * .18;
  closeTo(debug('yandere').attackOdds.advance, stockAdvance);
  at(20, { ...quiet, leftLook: true });
  closeTo(debug('yandere').attackOdds.advance, 0);
  closeTo(debug('yandere').attackOdds.blocked, stockAdvance);
  closeTo(debug('yandere').attackOdds.stay, (1 - stockAdvance) * .3);
  at(20, quiet, { type: 'gate', id: 'G01' });
  assert.equal(debug('gotica').attackOdds.advance, 0);
  assert(debug('gotica').attackOdds.blocked > 0);
  at(21, { ...beam, corridorLight: false }); // Closed gate prevents office activation.
  closeTo(debug('yandere').noise, 18 * decay(1));
  assert.equal(debug('gotica').light, 0);
  draw = .99;
  at(30.001, quiet);
  for (const key of ['gotica', 'yandere', 'gatinha']) {
    assert.equal(debug(key).noise, 0);
    assert.equal(debug(key).light, 0);
    assert.equal(debug(key).attackActive, false);
    assert.equal(debug(key).attackOdds, null);
  }
  draw = 0;
  let time = 30.001;
  for (let step = 0; step < 4 && !debug('gotica').attackActive; step++) {
    time += actor('gotica').remaining;
    at(time, { radio: true });
    if (!debug('gotica').attackActive) assert.equal(debug('gotica').noise, 0);
  }
  assert.equal(debug('gotica').attackActive, true);
  assert.equal(debug('gotica').noise, 0);
}

{
  const rules = structuredClone(base);
  const actor = {
    key: 'yandere', rule: rules.characters.yandere, position: 15, noise: 0,
    light: 0, audioRetention: 1
  };
  const fx = createEffects(rules, routes, [actor]);
  assert(fx.startAudio(0, 'CAM03'));
  assert.equal(fx.audioStatus(2.99).camera, 'CAM03');
  assert.equal(fx.audioStatus(3).camera, null);
  assert(!fx.startAudio(9.99, 'CAM12'));
  closeTo(fx.weight(actor, 19, 2), 1.6); // 19 is one step from the hall.
  actor.position = 17;
  closeTo(fx.weight(actor, 15, 2), 1.12); // 17 is out of range, 15 is in ring two.
  fx.retain(actor);
  closeTo(fx.weight(actor, 15, 2), 1.09);
  actor.position = 22;
  closeTo(fx.weight(actor, 8, 2), 1);
  assert(fx.startAudio(10, 'CAM12'));
  assert.equal(actor.noise, 0);
  fx.integrate(40, { radio: true, computer: true, viewMoving: true, corridorLight: true });
  fx.addNoiseEvent('flashlightOn');
  assert.equal(actor.noise, 0);
  assert.equal(actor.light, 0);
  actor.approach = { objective: 'corridor', phase: 'entry' };
  fx.integrate(10, { radio: true, computer: true, viewMoving: true });
  closeTo(actor.noise, 7 * .8 / .03 * -Math.expm1(-.03 * 10));
  const loud = fx.attackOdds(actor, 'corridor', 'entry').advance;
  fx.integrate(2, {});
  assert(fx.attackOdds(actor, 'corridor', 'entry').advance < loud);
  const before = actor.noise;
  fx.addNoiseEvent('closetExit');
  closeTo(actor.noise - before, 4);
  actor.position = 14;
  fx.integrate(30, { corridorLight: true });
  assert.equal(actor.light, 1);
  fx.integrate(40, { radio: true });
  assert.equal(actor.noise, 100);
}

{
  const actors = ['stock', 'corridor'].map(objective => ({
    key: 'gotica', position: objective === 'stock' ? 10 : 15, noise: 0, light: 0,
    approach: { objective, phase: 'approach' }
  }));
  const [stock, corridor] = actors;
  const fx = createEffects(base, routes, actors);
  fx.integrate(2, { radio: true, computer: true, viewMoving: true, corridorLight: true });
  closeTo(stock.noise, 7 / .03 * -Math.expm1(-.03 * 2));
  closeTo(corridor.noise, stock.noise * .8);
  assert.equal(stock.light, 0);
  closeTo(corridor.light, .25);
  fx.addNoiseEvent('computerOn');
  closeTo(corridor.noise, stock.noise * .8);
}

for (const level of [3, 4, 10]) {
  let draw = 0;
  const { at, actor, game } = scenario({ yandere: { start: 19, interval: 20, routes: { EE: 24 } } },
    { levels: { yandere: level }, random: () => draw });
  const normal = 20 * (1 - .08 * base.movement.difficulty.oddSteps.filter(step => level >= step).length);
  const due = actor('yandere').remaining;
  closeTo(due, normal * (level >= 4 ? .60 : 1));
  at(due);
  assert.equal(actor('yandere').position, 21);
  assert(game.electricalFault());
  assert.equal(actor('yandere').lastRoute, 'EE');
  assert.equal(actor('yandere').freeMoves, 1);
  closeTo(actor('yandere').remaining, normal * 1.25);
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
  const { game, at } = scenario({ padrao: { interval: 5, positions: [1, 2] } });
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
  function run(step, inspect = false) {
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
    for (let time = step; time < 240; time += step) {
      game.advance(time, input);
      if (inspect) {
        const previousSeed = seed;
        const debug = game.debugSnapshot();
        for (const { odds } of debug.actors) closeTo(Object.values(odds).reduce((a, b) => a + b, 0), 1);
        assert.equal(seed, previousSeed);
      }
    }
    game.advance(240, input);
    return { events, snapshot: game.snapshot() };
  }
  const continuous = run(.125);
  assert.deepEqual(run(.125, true), continuous);
  const resumed = run(240);
  assert(continuous.events.length > 10);
  assert.deepEqual(resumed.events, continuous.events);
  closeTo(resumed.snapshot.hours, continuous.snapshot.hours);
  assert.equal(resumed.snapshot.now, 240);
}

for (const [key, rule] of Object.entries(base.characters)) {
  for (const id of Object.keys(rule.routes ?? {})) {
    const config = structuredClone(base);
    config.characters = { [key]: { ...rule, routes: { [id]: 100 } } };
    for (const table of [config.movement.attack.corridor[key], config.movement.attack.stock]) {
      for (const phase of attackPhases) table[phase] = [1, 1];
    }
    const levels = { [key]: 10, palhaca: 0, smores: 0, shadow: 0 };
    const rules = { ...base.night, secondsPerHour: 600, powerEnabled: false, sanityEnabled: false };
    let seed = 912;
    let reached = false;
    const game = createMovement(config, {
      random: () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32,
      emit(type, data) {
        if (type === 'electricalFault') reached = true;
        if (type !== 'move' || data.retreat) return;
        if (data.to === 15 && data.actor.route?.target === 10) assert.equal(data.actor.approach, null);
        if (data.to === 13 && data.actor.route) {
          assert.equal(data.actor.route.id, id);
          assert.equal(data.from, config.movement.routes.definitions[id].objective === 'corridor' ? 14 : 12);
          reached = true;
        }
      }
    });
    game.reset(levels, { closet: true }, rules);
    game.advance(0, { closet: true }, { type: 'closetEnter' });
    for (let time = 1; time <= 1500 && !reached; time++) game.advance(time, { closet: true });
    assert(reached, `${key} ${id} never reached its objective`);
  }
}

{
  const { game, at } = scenario({ padrao: { start: 1, interval: 10, positions: [1, 19] } },
    { gates: ['G06'], random: () => .8 });
  const odds = () => game.debugSnapshot().actors[0].odds;
  closeTo(odds().Ficar, 1 / 5);
  closeTo(odds()['Corredor da CAM 12'], 4 / 5 * .7);
  closeTo(odds()['Bloqueio em Corredor da CAM 12 (G06)'], 4 / 5 * .3);
  at(0, { camera: 'CAM12' });
  closeTo(odds()['Bloqueio em Corredor da CAM 12 (câmera observada, G06)'], 4 / 5);
}

{
  const { game, at } = scenario({ gotica: { start: 1, interval: 10, positions: [1, 2] } },
    { random: () => 0 });
  at(0, { camera: 'CAM03' });
  const { odds } = game.debugSnapshot().actors[0];
  closeTo(odds['Meio do salão'], 4 / 5 * .75);
  closeTo(odds['Bloqueio em Meio do salão (câmera observada)'], 4 / 5 * .25);
}

console.log('PASS: physical graph, route checkpoints, blocked moves, attack probabilities, recovery, static, clown and deadline catch-up.');
