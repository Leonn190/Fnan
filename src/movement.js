(() => {
'use strict';

const { factor, uniform, weighted, createRoutes, createEffects, createThreats, createSmores,
  createResources, createShadow, shadowDifficulty, CAMERAS } = window.NathGame;

function createMovement(config, { random = Math.random, emit = () => {} } = {}) {
  const { map, movement, characters, night } = config;
  const { left, leftApproach, office, front, back } = map;
  const { difficulty, retreat } = movement;
  const routes = createRoutes(map);
  const cameraIds = CAMERAS.map(cam => cam.id);
  let actors, effects, threats, resources, shadow, smores, input, now, outcome;

  const moveDue = actor => actor.due - smores.intervalReduction();

  function interval(actor) {
    const initial = actor.rule.initialStationaryAttempts !== undefined && actor.position === actor.rule.start;
    const extra = actor.rule.extraIntervalReduction ?? 0;
    const acceleration = initial ? actor.rule.initialIntervalReduction : 0;
    const seconds = actor.interval * (actor.abilityTier ? factor(-extra) * factor(-acceleration) : 1)
      + uniform(random, movement.jitter);
    if (!(seconds > 0 && Number.isFinite(seconds))) throw new Error(`Intervalo inválido para ${actor.rule.name}.`);
    return seconds;
  }

  function reset(levels = {}, initialInput = {}) {
    now = 0;
    outcome = null;
    input = { ...initialInput, gates: new Set(initialInput.gates) };
    const levelFor = key => Math.max(0, Math.min(night.levels[1], levels[key] ?? night.normalLevel));
    actors = Object.entries(characters).filter(([key]) => levelFor(key) > 0).map(([key, rule]) => {
      const level = levelFor(key);
      const steps = difficulty.oddSteps.filter(step => level >= step).length;
      const bonuses = difficulty.targetBonusLevels.filter(step => level >= step).length;
      const allowed = new Set(rule.positions);
      return {
        key, rule, level, allowed, position: rule.start, previous: null, pending: null, stage: 0,
        noise: 0, light: { advance: 0, retreat: 0 }, audioRetention: 1,
        abilityTier: Number(level >= difficulty.abilityLevel),
        interval: rule.interval * factor(-steps * difficulty.intervalReductionPerStep),
        reaction: rule.reaction * (level >= difficulty.reactionLevel ? factor(-difficulty.reactionReduction) : 1),
        targetBonus: rule.targetBonus * factor(bonuses * difficulty.targetBonusIncreasePerStep),
        distance: routes.distances([rule.target], id => allowed.has(id))
      };
    });
    for (const actor of actors) actor.due = interval(actor);
    effects = createEffects(config, routes, actors);
    smores = createSmores(config.threats.smores, levelFor('smores'), random, emit);
    threats = createThreats(config, { palhaca: levelFor('palhaca') }, random, emit, smores.reactionReduction);
    resources = createResources(config);
    shadow = createShadow(config.shadow, shadowDifficulty(config.shadow, levelFor('shadow'), night.levels[1]),
      cameraIds, random);
  }

  function occupants(position) {
    return actors.filter(actor => actor.position === position);
  }

  function retreatChoice(actor) {
    const candidates = [...retreat.destinations, ...(actor.rule.extraRetreat ?? [])].filter(id => actor.allowed.has(id));
    return { to: weighted(random, candidates, () => 1), retreat: true };
  }

  function choose(actor) {
    if (actor.position === left) {
      return random() * 100 < movement.leftAttackChance ? { to: office } : retreatChoice(actor);
    }
    if (actor.stage < actor.rule.initialStationaryAttempts) return { to: actor.position, stationary: true };
    const choices = routes.neighbors.get(actor.position).filter(id => actor.allowed.has(id)
      && !(actor.rule.initialStationaryAttempts !== undefined && id === actor.rule.start));
    const distance = id => actor.distance.get(id) ?? Infinity;
    const nearest = Math.min(...choices.map(distance));
    const to = weighted(random, choices, id => movement.weight
      * (id === actor.previous ? movement.backtrackFactor : 1)
      * (distance(id) === nearest && Number.isFinite(nearest) ? factor(actor.targetBonus * smores.targetBonusMultiplier()) : 1)
      * effects.weight(actor, id, now));
    return { to };
  }

  function cameraObserves(position) {
    return resources.snapshot(now).computerOn && routes.positions.get(position).cameras.includes(input.camera);
  }

  function transition(actor, choice, to) {
    const from = actor.position;
    actor.pending = null;
    if (choice.stationary) actor.stage++;
    else {
      actor.previous = choice.retreat ? retreat.previous[to] : from;
      actor.position = to;
    }
    actor.due = to === office ? Infinity : now + interval(actor) * (choice.retreat ? retreat.intervalFactor : 1);
    emit('move', { actor, from, to });
    if (to === office) threats.invade(actor, now);
    if (actor.key === 'yandere' && to === config.threats.sabotage.position) threats.triggerSabotage(actor, now);
  }

  function tryPending(actor) {
    const choice = actor.pending;
    const from = actor.position;
    const bypass = from === leftApproach && choice.to === left && occupants(office).length > 0;
    const to = bypass ? office : choice.to;
    const gate = choice.retreat || choice.stationary ? null : routes.gate(bypass ? left : from, to);
    const observed = !effects.staticActive(now) && (cameraObserves(from) || cameraObserves(to)
      || (bypass && cameraObserves(left)));
    if (observed && actor.rule.staticChance && !choice.rolledStatic) {
      choice.rolledStatic = true;
      if (random() * 100 < actor.rule.staticChance[actor.abilityTier]) effects.triggerStatic(now);
    }
    if (input.gates.has(gate) && actor.rule.doorChance && choice.rolledGate !== gate) {
      choice.rolledGate = gate;
      if (random() * 100 < actor.rule.doorChance[actor.abilityTier]) {
        input.gates.delete(gate);
        emit('openGate', gate);
      }
    }
    const touches = positions => positions.includes(from) || positions.includes(to);
    const blockers = [
      observed && !effects.staticActive(now) && 'câmera observada',
      input.leftLook && (touches([left]) || bypass) && 'porta esquerda observada',
      input.corridorLight && touches([front, back]) && 'corredor iluminado',
      input.gates.has(gate) && 'porta fechada',
      !choice.stationary && occupants(to).length >= (map.capacities[to] ?? Infinity) && 'posição lotada'
    ].filter(Boolean);
    if (blockers.length) {
      choice.reason = blockers.join(' · ');
      return false;
    }
    transition(actor, choice, to);
    return true;
  }

  function finish(result, source) {
    outcome = result;
    shadow.stop();
    emit(result, source);
  }

  function settle(action) {
    const { blackout, computerOn, radioAvailable } = resources.snapshot(now);
    const ventOpportunity = !input.smoresLooking
      && (input.leftLook || (input.computer && computerOn) || action?.type === 'closetExit');
    smores.resolve(input, input.radio && radioAvailable && !threats.audioFault(), ventOpportunity);
    if (action?.type === 'closetEnter') threats.enterCloset(now);
    if (shadow.update(now, computerOn && input.findShadow !== false ? input.camera : null, blackout)) {
      finish('loss', 'shadow');
      return;
    }
    for (const actor of actors) {
      if (actor.pending || moveDue(actor) > now) continue;
      const choice = choose(actor);
      if (choice.to === undefined) {
        actor.due = now + interval(actor);
        continue;
      }
      actor.pending = { ...choice, expires: now + movement.retryWindow };
    }
    // A traversal, a forced door or the onset of static can release other pending moves.
    let changed;
    do {
      const staticBefore = effects.staticActive(now);
      const gatesBefore = input.gates.size;
      changed = false;
      for (const actor of actors) if (actor.pending && tryPending(actor)) changed = true;
      changed ||= staticBefore !== effects.staticActive(now) || gatesBefore !== input.gates.size;
    } while (changed && actors.some(actor => actor.pending));
    for (const actor of actors) {
      if (!actor.pending || actor.pending.expires > now) continue;
      actor.pending = null;
      effects.retain(actor);
      actor.due = now + movement.failedIntervalFactor * interval(actor);
    }
    threats.resolve(now, actor => {
      const choice = retreatChoice(actor);
      transition(actor, choice, choice.to);
    }, source => finish('loss', source));
  }

  function integrate(until) {
    const { computerOn } = resources.snapshot(now);
    const observation = window.NathGame.sanityObservation(config, actors, cameraActors, {
      ...input, camera: computerOn && !effects.staticActive(now) ? input.camera : null,
      view: !computerOn && input.computer ? 'office' : input.view,
      clownStage: threats.clownStage()
    });
    const { end, radio, won } = resources.segment(now, until, input, observation);
    const activeInput = { ...input, radio, computer: computerOn && input.computer };
    effects.integrate(end - now, activeInput);
    threats.integrate(end - now, activeInput);
    smores.integrate(end - now, radio && !threats.audioFault());
    now = end;
    if (won) finish('win');
  }

  function advance(until, nextInput, action) {
    if (outcome) return;
    until = Math.max(now, until);
    while (now < until) {
      const radio = input.radio && resources.snapshot(now).radioAvailable;
      const due = Math.min(until, shadow.nextDeadline(), effects.staticDeadline(now),
        threats.nextDeadline(now, { ...input, radio }),
        smores.nextDeadline(now, radio && !threats.audioFault()),
        ...actors.map(actor => actor.pending?.expires ?? moveDue(actor)));
      integrate(due);
      if (outcome) return;
      if (now < until) settle();
      if (outcome) return;
    }
    const current = typeof nextInput === 'function' ? nextInput() : nextInput;
    input = { ...current, gates: new Set(current.gates) };
    let accepted = false;
    switch (action?.type) {
      case 'closetEnter':
        input.smoresLooking = false;
        break;
      case 'closetExit':
        threats.exitCloset();
        effects.addNoiseEvent('closetRoundTrip');
        break;
      case 'cameraAudio':
        accepted = resources.snapshot(now).computerOn && effects.startAudio(now, input.camera);
        break;
      case 'computerPower':
        resources.toggleComputer();
        break;
      case 'returnToOffice': {
        const { sanity, blackout } = resources.snapshot(now);
        shadow.returnToOffice(now, action.source, sanity, blackout);
        break;
      }
      case 'gate':
        if (action.closed && action.visible && random() * 100 < config.effects.static.gateClosingChance) {
          effects.triggerStatic(now);
        }
        break;
    }
    settle(action);
    return accepted;
  }

  function cameraActors(camera) {
    return actors.filter(actor => actor.rule.cameras.includes(camera) && routes.positions.get(actor.position).cameras.includes(camera));
  }

  function diagnostics() {
    return actors.map(actor => {
      const position = routes.positions.get(actor.position);
      return {
        id: actor.rule.artId, key: actor.key, name: actor.rule.name, trackable: actor.rule.trackable,
        position: actor.position, level: actor.level, location: position.name,
        camera: position.cameras.join('/') || 'sem câmera',
        previous: routes.positions.get(actor.previous)?.name,
        destination: routes.positions.get(actor.pending?.to)?.name,
        remaining: Math.max(0, (actor.pending?.expires ?? moveDue(actor)) - now),
        stopped: actor.pending?.reason ?? (actor.position === office ? 'invasão' : 'intervalo'),
        light: { ...actor.light }, noise: actor.noise, audioRetention: actor.audioRetention
      };
    });
  }

  reset();
  return {
    reset, advance, cameraActors, diagnostics, stop: () => shadow.stop(),
    officeState: () => ({
      smores: smores.phase(),
      room: occupants(office).map(actor => actor.rule.artId),
      doorway: occupants(left)[0]?.rule.artId ?? null,
      front: occupants(front).map(actor => actor.rule.artId),
      back: occupants(back).map(actor => actor.rule.artId)
    }),
    snapshot: () => ({ now, outcome, ...resources.snapshot(now), shadow: shadow.snapshot(), ...threats.snapshot(now),
      audio: effects.audioStatus(now), static: effects.staticActive(now) })
  };
}

window.NathGame.createMovement = createMovement;
})();
