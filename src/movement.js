(() => {
'use strict';

const { factor, uniform, weighted, createRoutes, createAttackRoutes, createEffects, createApproach, createThreats, createSmores,
  createResources, createShadow, shadowDifficulty, createGates, createElectrical, CAMERAS } = window.NathGame;

function createMovement(config, { random = Math.random, emit = () => {} } = {}) {
  const { map, movement, characters, night } = config;
  const { left, leftApproach, office, front, back } = map;
  const { difficulty, retreat, recovery } = movement;
  const routes = createRoutes(map);
  const cameraIds = CAMERAS.map(cam => cam.id);
  let roster, actors, effects, threats, resources, shadow, smores, gates, electrical, input, now, outcome, sanityEnabled;
  let movementDelay, maxClosedGates, gateVersion, approach;

  const movementPaused = () => now < movementDelay;
  const gateControlsAvailable = () => maxClosedGates > 0 && !electrical.failed();
  const moveDue = actor => {
    const accelerated = actor.due - smores.intervalReduction();
    return accelerated > actor.scheduledAt ? accelerated : actor.due;
  };
  const camerasAvailable = () => resources.computerOn() && !electrical.failed();
  const canUse = (actor, edge) => edge && (!edge.actors || edge.actors.includes(actor.key));
  const passable = (actor, edge) => canUse(actor, edge) && !gates.closed.has(edge.gateId);
  const attackRoutes = createAttackRoutes(config, routes, random, () => gateVersion, passable);

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

  function schedule(actor, intervalFactor = 1, first = false) {
    actor.scheduledAt = now;
    actor.due = now + interval(actor, first) * intervalFactor;
    actor.intervalPenalty = intervalFactor === recovery.intervalFactor ? intervalFactor : 1;
  }

  function reset(levels = {}, initialInput = {}, rules = night) {
    now = 0;
    outcome = null;
    sanityEnabled = rules.sanityEnabled;
    movementDelay = rules.movementDelay ?? 0;
    maxClosedGates = rules.maxClosedGates ?? map.maxClosedMapGates;
    const { gates: initialGates, ...startingInput } = initialInput;
    input = startingInput;
    gateVersion = 0;
    gates = createGates(maxClosedGates, changes => {
      gateVersion++;
      emit('gatesChanged', changes);
    }, initialGates);
    electrical = createElectrical();
    const levelFor = key => Math.max(0, Math.min(night.levels[1], levels[key] ?? night.defaultLevel));
    roster = Object.entries(characters).map(([key, rule]) => {
      const level = levelFor(key);
      const character = { key, rule, level, position: rule.start, stage: 0 };
      if (level === 0) return character;
      const steps = difficulty.oddSteps.filter(step => level >= step).length;
      const bonuses = difficulty.maidTargetBonusLevels.filter(step => level >= step).length;
      const allowed = new Set(rule.positions);
      return {
        ...character, allowed, previous: null, pending: null,
        noise: 0, light: 0, audioRetention: 1,
        abilityTier: Number(level >= difficulty.abilityLevel),
        interval: rule.interval * factor(-steps * difficulty.intervalReductionPerStep),
        reaction: rule.reaction * (level >= difficulty.reactionLevel ? factor(-difficulty.reactionReduction) : 1),
        routeBonus: rule.routes ? attackRoutes.bonus(level)
          : rule.targetBonus * factor(bonuses * difficulty.maidTargetBonusIncreasePerStep),
        route: null, lastRoute: null, approach: null, freeMoves: 0
      };
    });
    actors = roster.filter(actor => actor.level > 0);
    effects = createEffects(config, routes, actors);
    approach = createApproach(map, effects, random);
    for (const actor of actors) {
      schedule(actor, 1, true);
      actor.scheduledAt = movementDelay;
      actor.due += movementDelay;
      approach.arrive(actor);
    }
    smores = createSmores(config.threats.smores, levelFor('smores'), random, emit);
    threats = createThreats(config, { palhaca: levelFor('palhaca') }, random, emit, smores.reactionReduction);
    resources = createResources(config, rules);
    shadow = createShadow(config.shadow, shadowDifficulty(config.shadow, sanityEnabled ? levelFor('shadow') : 0, night.levels[1]),
      cameraIds, random);
  }

  function occupants(position) {
    return actors.filter(actor => actor.position === position);
  }

  function recover(actor) {
    actor.route = null;
    actor.approach = null;
    actor.freeMoves = actor.rule.routes ? recovery.freeMoves : 0;
    schedule(actor, recovery.intervalFactor);
  }

  function withdraw(actor, kind) {
    const from = actor.position;
    const destinations = retreat[kind].filter(id => actor.allowed.has(id) && !isFull(id));
    const to = weighted(random, destinations, () => 1);
    if (to !== undefined) {
      actor.previous = from;
      actor.position = to;
    }
    recover(actor);
    if (to !== undefined) emit('move', { actor, from, to, retreat: kind });
  }

  function reachCheckpoint(actor) {
    if (!attackRoutes.reach(actor)) return false;
    if (actor.route.objective === 'electrical') {
      recover(actor);
      if (electrical.trip()) emit('electricalFault');
      return true;
    } else {
      approach.begin(actor, actor.route.objective);
    }
    return false;
  }

  function navigate(actor, free) {
    const { position: from } = actor;
    const target = attackRoutes.checkpoint(actor);
    if (actor.route?.counterattack) return { to: target };
    const canEnterAttack = !actor.route;
    const allowed = id => actor.allowed.has(id) && id !== office
      && (canEnterAttack || (id !== front && id !== left))
      && !(actor.rule.initialStationaryAttempts !== undefined && id === actor.rule.start);
    const edgeTo = id => routes.connection(from, id);
    const choices = routes.neighbors.get(from).filter(id => allowed(id) && canUse(actor, edgeTo(id)));
    const distances = target !== undefined ? attackRoutes.distances(actor, target)
      : actor.rule.routes ? null : attackRoutes.distances(actor, back);
    const currentDistance = distances?.get(from);
    const closer = id => distances?.get(id) < currentDistance;
    const openProgress = choices.some(id => closer(id) && passable(actor, edgeTo(id)));
    const bonus = factor(actor.routeBonus * smores.targetBonusMultiplier());
    const to = weighted(random, [...choices, from], id => {
      if (id === from) return movement.weight / 2;
      const progresses = closer(id) && (!openProgress || passable(actor, edgeTo(id)));
      return movement.weight * (id === actor.previous ? movement.backtrackFactor : 1)
        * (progresses ? bonus : 1) * effects.weight(actor, id, now);
    });
    return { to, stay: to === from, free };
  }

  function choose(actor) {
    if (actor.stage < actor.rule.initialStationaryAttempts) return { to: actor.position, stationary: true };
    if (actor.approach) return approach.choose(actor);
    const free = actor.freeMoves > 0;
    if (actor.rule.routes && !actor.route && !free) attackRoutes.select(actor);
    if (reachCheckpoint(actor)) return null;
    if (actor.approach) return approach.choose(actor);
    return navigate(actor, free);
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
    if (choice.free) actor.freeMoves--;
    if (to === office) actor.due = Infinity;
    approach.arrive(actor);
    const recovered = reachCheckpoint(actor);
    if (to !== office && !recovered) schedule(actor);
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
    const blockers = [
      observed && !effects.staticActive(now) && 'câmera observada',
      input.leftLook && (from === left || to === left) && 'porta esquerda observada'
    ].filter(Boolean);
    if (!blockers.length && gates.closed.has(gate) && actor.key === 'padrao'
        && actor.rule.doorChance && choice.rolledGate !== gate) {
      choice.rolledGate = gate;
      if (random() * 100 < actor.rule.doorChance[actor.abilityTier]) {
        gates.open(gate);
        emit('openGate', gate);
      }
    }
    if (gates.closed.has(gate)) {
      choice.closedSince ??= now;
      blockers.push('porta fechada');
    } else {
      choice.closedSince = null;
    }
    if (!choice.stationary && isFull(to)) blockers.push('posição lotada');
    if (from === leftApproach && to === left && occupants(office).length) blockers.push('invasão em andamento');
    if (blockers.length) {
      choice.reason = blockers.join(' · ');
      return false;
    }
    transition(actor, choice, to);
    return true;
  }

  function expire(actor) {
    const { to, closedSince, started, free } = actor.pending;
    const closedGate = closedSince === started ? routes.gate(actor.position, to) : null;
    actor.pending = null;
    if (free) actor.freeMoves--;
    effects.retain(actor);
    const counter = movement.attack.stockCounterattack;
    if (closedGate === counter.gate && actor.position === front && to === office) {
      if (actor.rule.routes && random() < counter.chance && attackRoutes.counterattack(actor)) {
        actor.approach = null;
        schedule(actor);
      } else {
        withdraw(actor, 'corridor');
      }
    } else {
      if (closedGate && !free) {
        actor.route = null;
        if (actor.rule.routes && !actor.approach) attackRoutes.select(actor);
      }
      schedule(actor, movement.failedIntervalFactor);
    }
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
    if (action?.type === 'closetEnter' && threats.enterCloset(now)) effects.addNoiseEvent('closetEnter');
    if (movementPaused()) return;
    const radio = input.radio && radioAvailable;
    threats.resolve(now, actor => withdraw(actor, 'office'), source => finish('loss', source), radio, input.clownLight);
    if (outcome) return;
    for (const actor of actors) {
      if (actor.pending || moveDue(actor) > now) continue;
      const choice = choose(actor);
      if (!choice) continue;
      if (choice.abandon) {
        withdraw(actor, choice.abandon);
        continue;
      }
      if (choice.to === undefined || choice.stay) {
        if (choice.free) actor.freeMoves--;
        schedule(actor);
        continue;
      }
      actor.pending = { ...choice, started: now, expires: now + movement.retryWindow };
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
      expire(actor);
    }
    const available = camerasAvailable();
    if (shadow.update(now, available && input.findShadow !== false ? input.camera : null, blackout, available)) {
      finish('loss', 'shadow');
    }
  }

  function integrate(until) {
    const computerOn = resources.computerOn();
    const observation = sanityEnabled && window.NathGame.sanityObservation(config, actors, cameraActors, {
      ...input, gates: gates.closed, camera: camerasAvailable() && !effects.staticActive(now) ? input.camera : null,
      view: !computerOn && input.computer ? 'office' : input.view,
      clownStage: threats.clownStage()
    });
    const { end, radio, won } = resources.segment(now, until, input, observation, gates.closed);
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
      let due = Math.min(until, movementDelay);
      if (!movementPaused()) {
        const radio = input.radio && resources.radioAvailable(now);
        due = Math.min(until, shadow.nextDeadline(), effects.staticDeadline(now),
          threats.nextDeadline(now, radio, input.clownLight), smores.nextDeadline(now, radio));
        for (const actor of actors) due = Math.min(due, actor.pending?.expires ?? moveDue(actor));
      }
      // A modifier or a power boundary can leave work due at this instant.
      // Resolve it without integrating backward or skipping intervening events.
      integrate(Math.max(now, due));
      if (outcome) return;
      if (now < until) settle();
      if (outcome) return;
    }
    const current = typeof nextInput === 'function' ? nextInput() : nextInput;
    input = { ...current };
    if (action?.type === 'closetEnter') input.smoresLooking = false;
    let accepted = false;
    switch (action?.type) {
      case 'closetExit':
        threats.exitCloset();
        effects.addNoiseEvent('closetExit');
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
        stopped: actor.pending?.reason ?? (actor.position === office ? 'invasão' : 'intervalo'),
        route: actor.route?.id ?? null, lastRoute: actor.lastRoute,
        objective: actor.approach?.objective ?? actor.route?.objective ?? null,
        checkpoint: attackRoutes.checkpoint(actor) ?? null, routeCompleted: actor.route?.completed ?? false,
        approach: actor.approach?.phase ?? null, counterattack: actor.route?.counterattack ?? false,
        freeMoves: actor.freeMoves, intervalPenalty: actor.intervalPenalty,
        light: actor.light, noise: actor.noise, audioRetention: actor.audioRetention
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
