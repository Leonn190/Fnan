(() => {
'use strict';

const { factor, uniform, weighted, createRoutes, createEffects, createThreats, createSmores,
  createResources, createShadow, shadowDifficulty, createGates, createElectrical, CAMERAS } = window.NathGame;

function createMovement(config, { random = Math.random, emit = () => {} } = {}) {
  const { map, movement, characters, night } = config;
  const { left, leftApproach, office, front, back } = map;
  const { difficulty, retreat } = movement;
  const routes = createRoutes(map);
  const cameraIds = CAMERAS.map(cam => cam.id);
  let roster, actors, effects, threats, resources, shadow, smores, gates, electrical, input, now, outcome, sanityEnabled;
  let movementDelay, maxClosedGates;

  const movementPaused = () => now < movementDelay;
  const gateControlsAvailable = () => maxClosedGates > 0 && !electrical.failed();
  const moveDue = actor => actor.due - (actor.retreating ? 0 : smores.intervalReduction());
  const camerasAvailable = () => resources.computerOn() && !electrical.failed();
  const canUse = (actor, edge) => edge && (!edge.actors || edge.actors.includes(actor.key));
  const passable = (actor, edge) => canUse(actor, edge) && !gates.closed.has(edge.gateId);

  function interval(actor, first = false) {
    const initial = actor.rule.initialStationaryAttempts !== undefined && actor.position === actor.rule.start;
    const extra = actor.rule.extraIntervalReduction ?? 0;
    const acceleration = initial ? actor.rule.initialIntervalReduction : 0;
    const firstFactor = first && actor.abilityTier ? actor.rule.firstIntervalFactor ?? 1 : 1;
    const seconds = (actor.interval * (actor.abilityTier ? factor(-extra) * factor(-acceleration) : 1)
      + uniform(random, movement.jitter)) * firstFactor;
    if (!(seconds > 0 && Number.isFinite(seconds))) throw new Error(`Intervalo inválido para ${actor.rule.name}.`);
    return seconds;
  }

  const nextInterval = actor => actor.retreating ? retreat.stepSeconds : interval(actor);

  function reset(levels = {}, initialInput = {}, rules = night) {
    now = 0;
    outcome = null;
    sanityEnabled = rules.sanityEnabled;
    movementDelay = rules.movementDelay ?? 0;
    maxClosedGates = rules.maxClosedGates ?? map.maxClosedMapGates;
    const { gates: initialGates, ...startingInput } = initialInput;
    input = startingInput;
    gates = createGates(maxClosedGates, changes => emit('gatesChanged', changes), initialGates);
    electrical = createElectrical();
    const levelFor = key => Math.max(0, Math.min(night.levels[1], levels[key] ?? night.defaultLevel));
    roster = Object.entries(characters).map(([key, rule]) => {
      const level = levelFor(key);
      const character = { key, rule, level, position: rule.start, stage: 0 };
      if (level === 0) return character;
      const steps = difficulty.oddSteps.filter(step => level >= step).length;
      const bonuses = difficulty.targetBonusLevels.filter(step => level >= step).length;
      const allowed = new Set(rule.positions);
      return {
        ...character, allowed, previous: null, pending: null,
        noise: 0, light: { advance: 0, retreat: 0 }, audioRetention: 1,
        abilityTier: Number(level >= difficulty.abilityLevel),
        interval: rule.interval * factor(-steps * difficulty.intervalReductionPerStep),
        reaction: rule.reaction * (level >= difficulty.reactionLevel ? factor(-difficulty.reactionReduction) : 1),
        targetBonus: rule.targetBonus * factor(bonuses * difficulty.targetBonusIncreasePerStep),
        retreating: false, retreatTarget: null
      };
    });
    actors = roster.filter(actor => actor.level > 0);
    for (const actor of actors) actor.due = movementDelay + interval(actor, true);
    effects = createEffects(config, routes, actors);
    smores = createSmores(config.threats.smores, levelFor('smores'), random, emit);
    threats = createThreats(config, { palhaca: levelFor('palhaca') }, random, emit, smores.reactionReduction);
    resources = createResources(config, rules);
    shadow = createShadow(config.shadow, shadowDifficulty(config.shadow, sanityEnabled ? levelFor('shadow') : 0, night.levels[1]),
      cameraIds, random);
  }

  function occupants(position) {
    return actors.filter(actor => actor.position === position);
  }

  function retreatChoice(actor) {
    const from = actor.position;
    const allowed = id => actor.allowed.has(id) && (id !== office || id === from);
    const candidates = [...retreat.destinations, ...(actor.rule.extraRetreat ?? [])].filter(id => id !== from && allowed(id));
    function steps(available, visit) {
      const neighbors = routes.neighbors.get(from).filter(to => available(routes.connection(from, to)));
      return candidates.flatMap(target => {
        const distances = routes.distances([target], visit, Infinity, available, true);
        const to = neighbors.find(id => distances.get(id) === distances.get(from) - 1);
        return to === undefined ? [] : [{ target, to }];
      });
    }
    const open = steps(edge => passable(actor, edge), id => allowed(id) && (id === from || !isFull(id)));
    const options = open.length ? open : steps(edge => canUse(actor, edge), allowed);
    const step = options.find(({ target }) => target === actor.retreatTarget) ?? weighted(random, options, () => 1);
    actor.retreatTarget = step?.target ?? null;
    return { to: step?.to };
  }

  function choose(actor) {
    if (actor.retreating) return retreatChoice(actor);
    if (actor.position === left) {
      if (actor.allowed.has(office) && random() * 100 < movement.leftAttackChance) return { to: office };
      actor.retreating = true;
      return retreatChoice(actor);
    }
    if (actor.stage < actor.rule.initialStationaryAttempts) return { to: actor.position, stationary: true };
    const allowed = id => actor.allowed.has(id)
      && !(actor.rule.initialStationaryAttempts !== undefined && id === actor.rule.start);
    const edgeTo = id => routes.connection(actor.position, id);
    const choices = routes.neighbors.get(actor.position).filter(id => allowed(id) && canUse(actor, edgeTo(id)));
    const distances = routes.distances([actor.rule.target], allowed, Infinity, edge => passable(actor, edge), true);
    const distance = id => passable(actor, edgeTo(id)) ? distances.get(id) ?? Infinity : Infinity;
    const nearest = Math.min(...choices.map(distance));
    const to = weighted(random, [...choices, actor.position], id => id === actor.position ? movement.weight / 2 : movement.weight
      * (id === actor.previous ? movement.backtrackFactor : 1)
      * (distance(id) === nearest && Number.isFinite(nearest) ? factor(actor.targetBonus * smores.targetBonusMultiplier()) : 1)
      * effects.weight(actor, id, now));
    return { to, stay: to === actor.position };
  }

  function cameraObserves(position) {
    return routes.positions.get(position).cameras.includes(input.camera);
  }

  function isFull(position) {
    return map.capacities[position] !== undefined && occupants(position).length >= map.capacities[position];
  }

  function transition(actor, choice, to) {
    const from = actor.position;
    actor.pending = null;
    if (choice.stationary) actor.stage++;
    else {
      actor.previous = from;
      actor.position = to;
    }
    const retreating = actor.retreating;
    if (to === actor.retreatTarget) {
      actor.retreating = false;
      actor.retreatTarget = null;
    }
    actor.due = to === office ? Infinity : now + nextInterval(actor) * (retreating && !actor.retreating ? retreat.intervalFactor : 1);
    if (actor.key === 'yandere' && from !== to && to === config.threats.electrical.position && electrical.trip()) {
      emit('electricalFault');
    }
    emit('move', { actor, from, to });
    if (to === office) threats.invade(actor, now);
  }

  function tryPending(actor) {
    const choice = actor.pending;
    const from = actor.position;
    const to = choice.to;
    const edge = routes.connection(from, to);
    if (!routes.positions.has(from) || !routes.positions.has(to) || !actor.allowed.has(to)
        || (choice.stationary ? to !== from : !canUse(actor, edge))) {
      choice.reason = 'passagem indisponível';
      return false;
    }
    const gate = edge?.gateId;
    const observed = camerasAvailable() && input.camera && !effects.staticActive(now) && (cameraObserves(from) || cameraObserves(to));
    if (observed && actor.rule.staticChance && !choice.rolledStatic) {
      choice.rolledStatic = true;
      if (random() * 100 < actor.rule.staticChance[actor.abilityTier]) {
        effects.triggerStatic(now);
        emit('cameraInterference', now);
      }
    }
    const touches = positions => positions.includes(from) || positions.includes(to);
    const blockers = [
      observed && !effects.staticActive(now) && 'câmera observada',
      input.leftLook && touches([left]) && 'porta esquerda observada',
      input.corridorLight && touches([front, back]) && 'corredor iluminado'
    ].filter(Boolean);
    if (!blockers.length && gates.closed.has(gate) && actor.key === 'padrao'
        && actor.rule.doorChance && choice.rolledGate !== gate) {
      choice.rolledGate = gate;
      if (random() * 100 < actor.rule.doorChance[actor.abilityTier]) {
        gates.open(gate);
        emit('openGate', gate);
      }
    }
    if (gates.closed.has(gate)) blockers.push('porta fechada');
    if (!choice.stationary && isFull(to)) blockers.push('posição lotada');
    if (from === leftApproach && to === left && occupants(office).length) blockers.push('invasão em andamento');
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
    if (!movementPaused()) {
      const ventOpportunity = !input.smoresLooking
        && (input.leftLook || (input.computer && computerOn) || action?.type === 'closetExit');
      smores.resolve(input, input.radio && radioAvailable, ventOpportunity);
    }
    if (action?.type === 'closetEnter') threats.enterCloset(now);
    if (movementPaused()) return;
    threats.resolve(now, actor => {
      actor.retreating = true;
      actor.due = now;
    }, source => finish('loss', source));
    if (outcome) return;
    for (const actor of actors) {
      if (actor.pending || moveDue(actor) > now) continue;
      const choice = choose(actor);
      if (choice.to === undefined || choice.stay) {
        actor.due = now + nextInterval(actor);
        continue;
      }
      actor.pending = { ...choice, expires: now + movement.retryWindow };
    }
    // A traversal, a forced door or the onset of static can release other pending moves.
    let changed;
    do {
      const staticBefore = effects.staticActive(now);
      const gatesBefore = gates.closed.size;
      const signalBefore = camerasAvailable();
      changed = false;
      for (const actor of actors) if (actor.pending && tryPending(actor)) changed = true;
      changed ||= staticBefore !== effects.staticActive(now) || gatesBefore !== gates.closed.size
        || signalBefore !== camerasAvailable();
    } while (changed && actors.some(actor => actor.pending));
    for (const actor of actors) {
      if (!actor.pending || actor.pending.expires > now) continue;
      actor.pending = null;
      effects.retain(actor);
      actor.due = now + movement.failedIntervalFactor * nextInterval(actor);
    }
    const available = camerasAvailable();
    if (shadow.update(now, available && input.findShadow !== false ? input.camera : null, blackout, available)) {
      finish('loss', 'shadow');
    }
  }

  function integrate(until) {
    const { computerOn } = resources.snapshot(now);
    const observation = sanityEnabled && window.NathGame.sanityObservation(config, actors, cameraActors, {
      ...input, gates: gates.closed, camera: camerasAvailable() && !effects.staticActive(now) ? input.camera : null,
      view: !computerOn && input.computer ? 'office' : input.view,
      clownStage: threats.clownStage()
    });
    const { end, radio, won } = resources.segment(now, until, { ...input, gates: gates.closed }, observation);
    const activeInput = { ...input, radio, computer: computerOn && input.computer };
    effects.integrate(end - now, activeInput);
    if (!movementPaused()) {
      threats.integrate(end - now, activeInput);
      smores.integrate(end - now, radio);
    }
    now = end;
    if (won) finish('win');
  }

  function advance(until, nextInput, action) {
    if (outcome) return;
    until = Math.max(now, until);
    while (now < until) {
      const radio = input.radio && resources.snapshot(now).radioAvailable;
      const due = movementPaused() ? Math.min(until, movementDelay)
        : Math.min(until, shadow.nextDeadline(), effects.staticDeadline(now),
          threats.nextDeadline(now, { ...input, radio }),
          smores.nextDeadline(now, radio),
          ...actors.map(actor => actor.pending?.expires ?? moveDue(actor)));
      integrate(due);
      if (outcome) return;
      if (now < until) settle();
      if (outcome) return;
    }
    const current = typeof nextInput === 'function' ? nextInput() : nextInput;
    input = { ...current };
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
        accepted = camerasAvailable() && effects.startAudio(now, input.camera);
        break;
      case 'gate':
        accepted = gateControlsAvailable() && gates.toggle(action.id);
        break;
      case 'computerPower': {
        const wasOn = resources.computerOn();
        resources.toggleComputer();
        if (electrical.powerChanged(wasOn, resources.computerOn())) emit('electricalRestored');
        break;
      }
      case 'returnToOffice': {
        const { sanity, blackout } = resources.snapshot(now);
        if (!movementPaused()) shadow.returnToOffice(now, action.source, sanity, blackout);
        break;
      }
    }
    settle(action);
    return accepted;
  }

  function cameraActors(camera) {
    return roster.filter(actor => actor.rule.cameras.includes(camera) && routes.positions.get(actor.position).cameras.includes(camera));
  }

  function diagnostics() {
    return actors.map(actor => {
      const position = routes.positions.get(actor.position);
      return {
        id: actor.rule.artId, key: actor.key, name: actor.rule.name,
        position: actor.position, level: actor.level, location: position.name,
        camera: position.cameras.join('/') || 'sem câmera',
        previous: routes.positions.get(actor.previous)?.name,
        destination: routes.positions.get(actor.pending?.to)?.name,
        remaining: Math.max(0, (actor.pending?.expires ?? moveDue(actor)) - Math.max(now, movementDelay)),
        stopped: actor.pending?.reason ?? (actor.retreating ? 'recuando' : actor.position === office ? 'invasão' : 'intervalo'),
        light: { ...actor.light }, noise: actor.noise, audioRetention: actor.audioRetention
      };
    });
  }

  reset();
  return {
    reset, advance, cameraActors, diagnostics, stop: () => shadow.stop(),
    isGateClosed: id => gates.closed.has(id),
    electricalFault: () => electrical.failed(), gateControlsAvailable,
    camerasAvailable,
    officeState: () => ({
      smores: smores.phase(),
      room: occupants(office).map(actor => actor.rule.artId),
      doorway: occupants(left)[0]?.rule.artId ?? null,
      front: occupants(front).map(actor => actor.rule.artId),
      back: occupants(back).map(actor => actor.rule.artId)
    }),
    snapshot: () => ({ now, outcome, ...resources.snapshot(now), shadow: shadow.snapshot(), ...threats.snapshot(),
      electricalFault: electrical.failed(),
      audio: effects.audioStatus(now), static: effects.staticActive(now) })
  };
}

window.NathGame.createMovement = createMovement;
})();
