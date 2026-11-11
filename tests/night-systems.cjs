const assert = require('node:assert/strict');
const fs = require('node:fs');

global.window = {};
for (const file of ['data/game-data', 'gameplay/routes', 'gameplay/effects', 'gameplay/threats',
  'gameplay/resources', 'gameplay/shadow', 'scene-art', 'movement']) {
  require('../src/' + file + '.js');
}
const { createMovement, sanityRate, hourDuration, shadowDifficulty, CAMERAS } = window.NathGame;
const base = Object.fromEntries(['night', 'map', 'movement', 'characters', 'effects', 'threats',
  'controls', 'sanity', 'power', 'shadow'].map(name => [name, require('../config/' + name + '.json')]));
const near = (actual, expected, tolerance = 1e-8) => assert(Math.abs(actual - expected) < tolerance, `${actual} != ${expected}`);

function scenario({ levels, input, draws = [], tune = () => {} } = {}) {
  const config = structuredClone(base);
  tune(config);
  const events = [];
  let calls = 0;
  const game = createMovement(config, { random: () => { calls++; return draws.shift() ?? 0; },
    emit: (...args) => events.push(args) });
  game.reset(levels, input);
  return { game, events, calls: () => calls, state: game.snapshot, at: (time, next = {}, action) => game.advance(time, next, action),
    returnAt: (time, source = 'computer') => game.advance(time, { view: 'office' }, { type: 'returnToOffice', source }) };
}

for (const [conditions, rate] of [
  [{ camera: true }, -.15], [{ direct: true }, -.35], [{ closet: true }, -.5],
  [{ direct: true, invasion: true }, -2], [{ centralGate: true }, -.1],
  [{ radio: true, camera: true }, .05], [{}, .05], [{ radio: true }, .25],
  [{ radio: true, direct: true, closet: true, blackout: true }, -1.5],
  [{ radio: true, blackout: true }, .25]
]) near(sanityRate(base.sanity, conditions), rate);

const empty = scenario({ input: { camera: 'CAM03' }, tune: config => { config.sanity.initial = 50; } });
empty.at(10);
near(empty.state().sanity, 50.5);
const stage = scenario({ levels: { padrao: 1, gotica: 1 }, input: { camera: 'CAM03' } });
stage.at(10, { camera: 'CAM01' });
near(stage.state().sanity, 98.5);
stage.at(12);
near(stage.state().sanity, 98.6);

function observation(start, input, expected, key = 'padrao') {
  const test = scenario({ levels: { [key]: 1 }, input, tune(config) {
    config.characters[key].start = start;
    config.characters[key].interval = 100;
  } });
  test.at(2);
  near(test.state().sanity, expected);
}
const { left, front, office } = base.map;
observation(left, { view: 'office', officeBounds: [0, 480] }, 99.3);
observation(left, { view: 'office', officeBounds: [800, 1300] }, 100);
observation(left, { view: 'closet-door', closet: true, closetBounds: [500, 900] }, 98.3);
observation(office, { view: 'office', officeBounds: [800, 1300] }, 96);
observation(office, { view: 'closet-door', closet: true, closetBounds: [400, 900] }, 95);
observation(front, { view: 'office', officeBounds: [800, 1300], corridorLight: true }, 99.3);
observation(front, { view: 'office', officeBounds: [800, 1300] }, 100);
observation(16, { camera: 'CAM09' }, 99.7, 'maid');
observation(1, { camera: 'CAM03', visibleCameraSource: null }, 100);

const clown = scenario({ levels: { palhaca: 1 } });
clown.at(0, { view: 'closet-back', closet: true, clownLight: true }, { type: 'closetEnter' });
clown.at(2);
near(clown.state().sanity, 98.3);
near(clown.state().counter, 1);
const inactive = scenario({ input: { view: 'closet-back', closet: true, clownLight: true } });
inactive.at(2);
near(inactive.state().sanity, 99);
inactive.at(100, {}, { type: 'closetEnter' });
inactive.at(1000);
assert.equal(inactive.state().clownStage, -1);
assert.equal(inactive.state().counter, 0);
assert.deepEqual(inactive.game.diagnostics(), []);
assert.deepEqual(CAMERAS.flatMap(cam => inactive.game.cameraActors(cam.id)), []);
assert.deepEqual(inactive.events, [['win', undefined]]);
assert.equal(inactive.calls(), 0);

for (const [sanity, seconds] of [[100, 60], [90, 60], [70, 105], [50, 150], [30, 195], [10, 240], [0, 240]]) {
  near(hourDuration(base.night.clock, sanity), seconds);
  const test = scenario({ tune(config) {
    config.sanity.initial = sanity;
    config.sanity.recovery.passive = 0;
  } });
  test.at(seconds);
  near(test.state().hours, 1);
  test.at(6 * seconds - .001);
  assert.equal(test.state().outcome, null);
  test.at(6 * seconds + 1);
  near(test.state().now, 6 * seconds);
  assert.deepEqual(test.events, [['win', undefined]]);
  assert.equal(test.state().hours, 6);
}

const dynamic = scenario({ input: { closet: true }, tune: config => { config.sanity.initial = 70; } });
dynamic.at(10, { radio: true });
near(dynamic.state().hours, Math.log(116.25 / 105) / 1.125);
const first = dynamic.state().hours;
dynamic.at(20);
near(dynamic.state().hours - first, Math.log(116.25 / 110.625) / .5625);
const testMovement = sanity => scenario({ levels: { padrao: 9, palhaca: 9 }, tune(config) { config.sanity.initial = sanity; } });
const fast = testMovement(100);
const slow = testMovement(10);
fast.at(14.4);
slow.at(14.4);
assert.deepEqual(fast.game.diagnostics(), slow.game.diagnostics());
near(fast.state().counter, slow.state().counter);
assert(fast.state().hours > slow.state().hours);
for (const key of [...Object.keys(base.characters), 'palhaca']) {
  const nine = scenario({ levels: { [key]: 9 } });
  const ten = scenario({ levels: { [key]: 10 } });
  if (key === 'palhaca') {
    nine.at(10); ten.at(10);
    assert(ten.state().counter > nine.state().counter);
  } else {
    assert(ten.game.diagnostics()[0].remaining > 0);
    assert(ten.game.diagnostics()[0].remaining < nine.game.diagnostics()[0].remaining);
  }
}

const power = scenario({ input: { radio: true, corridorLight: true } });
power.at(10, { radio: true, corridorLight: true }, { type: 'computerPower' });
near(power.state().energy, 99.82);
power.at(20, { gates: ['G01', 'G06'] });
near(power.state().energy, 99.82);
power.at(30, {}, { type: 'computerPower' });
near(power.state().energy, 99.26);
assert.equal(power.state().computerOn, true);
near(power.state().sanity, 99);

const outage = scenario({ input: { gates: ['G01'], closet: true, radio: true }, tune(config) {
  config.power.initial = .46;
} });
outage.at(10, { gates: ['G01'], closet: true });
assert.equal(outage.state().blackout, true);
assert.equal(outage.state().computerOn, false);
near(outage.state().sanity, 96);
outage.at(15, { gates: ['G01'], closet: true, radio: true }, { type: 'computerPower' });
assert.equal(outage.state().computerOn, false);
near(outage.state().sanity, 90);
outage.at(34.99, { gates: ['G01'], closet: true, radio: true });
assert.equal(outage.state().radioAvailable, true);
outage.at(36, { gates: ['G01'], closet: true, radio: true });
assert.equal(outage.state().radioAvailable, false);
near(outage.state().sanity, 68.8);
outage.game.reset();
assert.deepEqual([outage.state().energy, outage.state().sanity, outage.state().hours, outage.state().computerOn], [.46, 100, 0, true]);

const shadowTest = (level, sanity, draws = [0, .99], tune = () => {}) => scenario({
  levels: { shadow: level }, draws, tune(config) { config.sanity.initial = sanity; tune(config); }
});
assert.equal(shadowDifficulty(base.shadow, 0, 10), null);
assert.deepEqual(shadowDifficulty(base.shadow, 1, 10), { sanityLimit: 35, chance: 10, searchSeconds: 10 });
assert.deepEqual(shadowDifficulty(base.shadow, 10, 10), { sanityLimit: 50, chance: 15, searchSeconds: 7.5 });
near(shadowDifficulty(base.shadow, 5, 10).searchSeconds, 10 - 10 / 9);
for (const [level, sanity] of [[0, 0], [1, 35], [10, 50]]) {
  const test = shadowTest(level, sanity);
  test.returnAt(0);
  assert.equal(test.calls(), 0);
  assert.equal(test.state().shadow.phase, 'inactive');
}
for (const [sanity, draw, expected] of [[34, .109, 'manifested'], [34, .111, 'inactive'], [20, .249, 'manifested'], [20, .251, 'inactive']]) {
  const test = shadowTest(1, sanity, [draw, 0]);
  test.at(0);
  assert.equal(test.state().shadow.phase, 'inactive');
  test.returnAt(0, 'closet');
  assert.equal(test.state().shadow.phase, expected);
  assert.equal(test.calls(), expected === 'manifested' ? 2 : 1);
}
for (const [level, sanity, duration] of [[1, 34, 10], [10, 49, 7.5]]) {
  const test = shadowTest(level, sanity);
  test.returnAt(0);
  assert.deepEqual(test.state().shadow, { phase: 'manifested', camera: 'CAM12' });
  test.returnAt(.5, 'closet');
  assert.equal(test.calls(), 2);
  test.at(2, { camera: 'CAM01' });
  assert.deepEqual(test.state().shadow, { phase: 'searching', camera: 'CAM12' });
  test.at(duration - .001);
  assert.equal(test.state().outcome, null);
  test.at(duration, { camera: 'CAM12' });
  assert.deepEqual(test.events, [['loss', 'shadow']]);
  assert.equal(test.state().shadow.phase, 'inactive');
}
const found = shadowTest(1, 20);
found.returnAt(0);
found.at(1, {}, { type: 'computerPower' });
assert.equal(found.state().shadow.phase, 'manifested');
found.returnAt(2);
assert.equal(found.calls(), 2);
found.at(3, { camera: 'CAM12' }, { type: 'computerPower' });
assert.equal(found.state().shadow.phase, 'found');
found.at(3.65, { camera: 'CAM12' });
assert.equal(found.state().shadow.phase, 'inactive');
found.returnAt(4);
assert.equal(found.calls(), 2);
found.returnAt(5, 'closet');
assert.equal(found.state().shadow.phase, 'manifested');
found.game.reset({ shadow: 1 });
assert.equal(found.state().shadow.phase, 'inactive');
const interrupted = shadowTest(10, 20, [0, .25], config => { config.power.initial = .018 * 3; });
interrupted.returnAt(0);
interrupted.at(10);
assert.equal(interrupted.state().blackout, true);
assert.equal(interrupted.state().shadow.phase, 'inactive');
assert.deepEqual(interrupted.events, []);
interrupted.returnAt(11);
assert.equal(interrupted.calls(), 2);
for (const asset of [base.shadow.officeArt, base.shadow.sprite, base.shadow.jumpscare]) assert(fs.existsSync(asset));

console.log('PASS: sanity and visibility, dynamic clock, zero and maximum levels, power and radio, Shadow deadlines and reset.');

const ventLook = { radio: true, smoresLooking: true };
const pc = { radio: true, computer: true };
const smoresPhase = test => test.game.officeState().smores;
const vent = scenario({ levels: { smores: 1 }, input: ventLook, draws: [.15, .1499] });
vent.at(15, ventLook);
assert.equal(smoresPhase(vent), 'idle');
vent.at(30, ventLook);
assert.equal(smoresPhase(vent), 'pre-vent');
vent.at(31, { radio: true, closet: true }, { type: 'closetEnter' });
assert.equal(smoresPhase(vent), 'pre-vent');
vent.at(32, { radio: true, closet: true }, { type: 'closetExit' });
assert.equal(smoresPhase(vent), 'vent');
vent.at(33, {});
assert.equal(smoresPhase(vent), 'vent');
vent.at(34, { smoresLooking: true });
vent.at(42.99, {});
assert.equal(smoresPhase(vent), 'vent');
vent.at(43, { smoresLooking: true });
vent.at(44, {});
assert.equal(smoresPhase(vent), 'idle');
assert.deepEqual(vent.events, [['smores', 'pre-vent'], ['smores', 'vent'], ['smores', 'idle']]);

const interruptedRadio = scenario({ levels: { smores: 1 }, input: ventLook });
interruptedRadio.at(14, {});
interruptedRadio.at(15, ventLook);
interruptedRadio.at(29.99, ventLook);
assert.equal(smoresPhase(interruptedRadio), 'idle');
interruptedRadio.at(30, { radio: true, leftLook: true });
assert.equal(smoresPhase(interruptedRadio), 'vent');

for (const [level, ticket, duration] of [[1, .1499, 35], [10, .1999, 50]]) {
  const test = scenario({ levels: { smores: level }, input: pc, draws: [ticket] });
  test.at(15, pc);
  test.at(16, pc);
  assert.equal(smoresPhase(test), 'vent');
  test.at(17, ventLook);
  test.at(18, pc);
  assert.equal(smoresPhase(test), 'room');
  test.at(23, {});
  const end = 23 + (duration - 5) / 2;
  test.at(end - .01);
  assert.equal(smoresPhase(test), 'room');
  test.at(end);
  assert.equal(smoresPhase(test), 'idle');
  test.game.reset({ smores: 0 }, pc);
  test.at(30, pc);
  assert.equal(smoresPhase(test), 'idle');
}

const boosted = scenario({
  levels: { smores: 1, padrao: 1 }, input: pc,
  tune(config) {
    config.characters.padrao.start = config.map.left;
    config.characters.padrao.interval = 25;
    config.movement.jitter = { min: 0, max: 0 };
  }
});
boosted.at(15, pc);
boosted.at(16, ventLook);
boosted.at(17, pc);
near(boosted.game.diagnostics()[0].remaining, 5);
boosted.at(21.99, pc);
assert.deepEqual(boosted.game.officeState().room, []);
boosted.at(22, pc);
assert.deepEqual(boosted.game.officeState().room, ['original']);
boosted.at(25.19, pc);
assert.equal(boosted.state().outcome, null);
boosted.at(25.2, pc);
assert.equal(boosted.state().outcome, 'loss');
console.log('PASS: Smores radio rolls, vent timing, silence, room duration and movement/reaction reductions.');
