(() => {
'use strict';

const { factor, uniform, weighted, createRoutes, createEffects, createThreats } = window.NathGame;

function createMovement(config, { random = Math.random, emit = () => {} } = {}) {
  const { map, movement, characters, night } = config;
  const { left, leftApproach, office, front, back } = map;
  const { difficulty, retreat } = movement;
  const routes = createRoutes(map);
  const winAt = night.secondsPerHour * night.hoursToWin;
  let actors, effects, threats, input, now, outcome;

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
    actors = Object.entries(characters).map(([key, rule]) => {
      const level = levels[key] ?? night.normalLevel;
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
    threats = createThreats(config, { palhaca: levels.palhaca ?? night.normalLevel }, random, emit);
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
      * (distance(id) === nearest && Number.isFinite(nearest) ? factor(actor.targetBonus) : 1)
      * effects.weight(actor, id, now));
    return { to };
  }

  function cameraObserves(position) {
    return routes.positions.get(position).cameras.includes(input.camera);
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

  function settle() {
    if (now >= winAt) {
      outcome = 'win';
      emit('win');
      return;
    }
    for (const actor of actors) {
      if (actor.pending || actor.due > now) continue;
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
    }, source => {
      outcome = 'loss';
      emit('loss', source);
    });
  }

  function integrate(until) {
    const dt = until - now;
    effects.integrate(dt, input);
    threats.integrate(dt, input);
    now = until;
  }

  function advance(until, nextInput, action) {
    if (outcome) return;
    while (true) {
      const due = Math.min(winAt, threats.nextDeadline(now, input),
        ...actors.map(actor => actor.pending?.expires ?? actor.due));
      if (due >= until) break;
      integrate(due);
      settle();
      if (outcome) return;
    }
    integrate(until);
    const current = typeof nextInput === 'function' ? nextInput() : nextInput;
    input = { ...current, gates: new Set(current.gates) };
    let accepted = false;
    switch (action?.type) {
      case 'closetEnter':
        threats.enterCloset(now);
        break;
      case 'closetExit':
        threats.exitCloset();
        effects.addNoiseEvent('closetRoundTrip');
        break;
      case 'cameraAudio':
        accepted = effects.startAudio(now, input.camera);
        break;
      case 'gate':
        if (action.id === 'leftDoor') effects.addNoiseEvent('workshopDoor');
        if (action.closed && action.visible && random() * 100 < config.effects.static.gateClosingChance) {
          effects.triggerStatic(now);
        }
        break;
    }
    settle();
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
        remaining: Math.max(0, (actor.pending?.expires ?? actor.due) - now),
        stopped: actor.pending?.reason ?? (actor.position === office ? 'invasão' : 'intervalo'),
        light: { ...actor.light }, noise: actor.noise, audioRetention: actor.audioRetention
      };
    });
  }

  reset();
  return {
    reset, advance, cameraActors, diagnostics,
    officeState: () => ({
      room: occupants(office).map(actor => actor.rule.artId),
      doorway: occupants(left)[0]?.rule.artId ?? null,
      front: occupants(front).map(actor => actor.rule.artId),
      back: occupants(back).map(actor => actor.rule.artId)
    }),
    snapshot: () => ({ now, outcome, ...threats.snapshot(now), audio: effects.audioStatus(now), static: effects.staticActive(now) })
  };
}

window.NathGame.createMovement = createMovement;
})();
