(() => {
'use strict';

const { factor, uniform, weightedChoices, drawWeighted, createRoutes, createAttackRoutes, createEffects, createApproach, createThreats, createSmores,
  createResources, createShadow, shadowDifficulty, createGates, createElectrical, CAMERAS } = window.NathGame;

function createMovement(config, { random = Math.random, emit = () => {} } = {}) {
  const { map, movement, characters, night } = config;
  const { left, leftApproach, office, front, back } = map;
  const { difficulty, retreat, recovery } = movement;
  const routes = createRoutes(map);
  const cameraIds = CAMERAS.map(cam => cam.id);
  let roster, actors, effects, threats, resources, shadow, smores, gates, electrical, input, now, outcome, sanityEnabled;
  let movementDelay, maxClosedGates, approach;

  const movementPaused = () => now < movementDelay;
  const gateControlsAvailable = () => maxClosedGates > 0 && !electrical.failed();
  const moveDue = actor => {
    const accelerated = actor.due - smores.intervalReduction();
    return accelerated > actor.scheduledAt ? accelerated : actor.due;
  };
  const camerasAvailable = () => resources.computerOn() && !electrical.failed();
  const canUse = (actor, edge) => edge && (!edge.actors || edge.actors.includes(actor.key));
  const passable = (actor, edge) => canUse(actor, edge) && !gates.closed.has(edge.gateId);
  const clear = (actor, edge, from, to) => passable(actor, edge) && !isFull(to) && !observed(from, to);
  const attackRoutes = createAttackRoutes(config, routes, random, passable, clear);

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
    gates = createGates(maxClosedGates, changes => emit('gatesChanged', changes), initialGates);
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
        targetBonus: rule.targetBonus * factor(bonuses * difficulty.maidTargetBonusIncreasePerStep),
        route: null, lastRoute: null, approach: null, freeMoves: 0, retreat: null
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

  function recover(actor, intervalFactor = recovery.intervalFactor) {
    actor.route = null;
    actor.approach = null;
    actor.freeMoves = actor.rule.routes && intervalFactor === recovery.intervalFactor ? recovery.freeMoves : 0;
    schedule(actor, intervalFactor);
  }

  function retreatChoices(actor, kind) {
    return weightedChoices(retreat[kind].filter(id => actor.allowed.has(id) && !isFull(id)), () => 1);
  }

  function withdraw(actor, kind, intervalFactor) {
    const from = actor.position;
    const to = drawWeighted(random, retreatChoices(actor, kind));
    if (to !== undefined) {
      actor.previous = from;
      actor.position = to;
    }
    recover(actor, intervalFactor);
    actor.retreat = kind;
    if (to !== undefined) emit('move', { actor, from, to, retreat: kind });
  }

  function reachCheckpoint(actor, from) {
    if (!attackRoutes.reach(actor, from)) return false;
    if (actor.route.objective === 'electrical') {
      recover(actor);
      if (electrical.trip()) emit('electricalFault');
      return true;
    } else {
      approach.begin(actor, actor.route.objective);
    }
    return false;
  }

  const navigationTarget = actor => actor.rule.routes ? attackRoutes.checkpoint(actor) : back;
  const navigationBonus = actor => actor.rule.routes ? attackRoutes.bonus(actor.level, actor.route?.moves) : actor.targetBonus;

  function navigationChoices(actor) {
    const { position: from } = actor;
    const target = actor.route?.paths ? actor.route.lastReached ?? actor.route.required : navigationTarget(actor);
    const edgeTo = id => routes.connection(from, id);
    const progress = new Set(target === undefined ? [] : attackRoutes.nextSteps(actor, target));
    const choices = routes.neighbors.get(from).filter(id => {
      const edge = edgeTo(id);
      if (!attackRoutes.canNavigate(actor, id) || !canUse(actor, edge)) return false;
      if (!actor.route || progress.has(id)) return true;
      // A lure can cause a detour. While recovering, only take steps back to the last checkpoint.
      return actor.route.paths && (actor.route.lastReached === null || actor.route.lastReached === from)
        && clear(actor, edge, from, id)
        && effects.weight(actor, id, now) > 1;
    });
    const bonus = factor(navigationBonus(actor) * smores.targetBonusMultiplier());
    return weightedChoices([...choices, from], id => {
      if (id === from) return movement.weight * movement.stayFactor;
      const progresses = progress.has(id);
      return movement.weight * (id === actor.previous && !progresses ? movement.backtrackFactor : 1)
        * (progresses ? bonus : 1) * effects.weight(actor, id, now);
    });
  }

  function choose(actor) {
    if (actor.stage < actor.rule.initialStationaryAttempts) return { to: actor.position, stationary: true };
    if (actor.approach) return approach.choose(actor);
    const free = actor.freeMoves > 0;
    if (actor.rule.routes && !actor.route && !free) attackRoutes.select(actor);
    if (reachCheckpoint(actor)) return null;
    if (actor.approach) return approach.choose(actor);
    const to = drawWeighted(random, navigationChoices(actor));
    return { to, stay: to === actor.position, free };
  }

  function cameraObserves(position) {
    return routes.positions.get(position).cameras.includes(input.camera);
  }

  function observed(from, to) {
    return camerasAvailable() && input.camera && !effects.staticActive(now) && (cameraObserves(from) || cameraObserves(to));
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
      if (actor.route) actor.route.moves++;
    }
    if (choice.free) actor.freeMoves--;
    if (to === office) actor.due = Infinity;
    approach.arrive(actor);
    const recovered = reachCheckpoint(actor, from);
    if (to !== office && !recovered) schedule(actor);
    emit('move', { actor, from, to });
    if (to === office) threats.invade(actor, now);
  }

  function attemptConditions(actor, choice) {
    const from = actor.position;
    const to = choice.to;
    const edge = routes.connection(from, to);
    if (!routes.positions.has(from) || !routes.positions.has(to) || !actor.allowed.has(to)
        || (choice.stationary ? to !== from : !canUse(actor, edge))
        || (!choice.stationary && !actor.approach && !attackRoutes.canNavigate(actor, to))) return null;
    const gate = edge?.gateId;
    const watched = observed(from, to);
    return {
      gate, observed: watched,
      staticChance: watched && !choice.rolledStatic ? actor.rule.staticChance?.[actor.abilityTier] : undefined,
      doorChance: gates.closed.has(gate) && actor.key === 'padrao' && choice.rolledGate !== gate
        ? actor.rule.doorChance?.[actor.abilityTier] : undefined,
      leftLook: input.leftLook && (from === left || to === left),
      full: !choice.stationary && isFull(to),
      invasion: from === leftApproach && to === left && occupants(office).length > 0
    };
  }

  function tryPending(actor) {
    const choice = actor.pending;
    const conditions = attemptConditions(actor, choice);
    if (!conditions) {
      choice.reason = 'passagem indisponível';
      return false;
    }
    const { gate, observed, staticChance, doorChance, leftLook, full, invasion } = conditions;
    if (staticChance !== undefined) {
      choice.rolledStatic = true;
      if (random() * 100 < staticChance) {
        effects.triggerStatic(now);
        emit('cameraInterference', now);
      }
    }
    const blockers = [
      observed && !effects.staticActive(now) && 'câmera observada',
      leftLook && 'porta esquerda observada'
    ].filter(Boolean);
    if (!blockers.length && doorChance !== undefined) {
      choice.rolledGate = gate;
      if (random() * 100 < doorChance) {
        gates.open(gate);
        emit('openGate', gate);
      }
    }
    if (gates.closed.has(gate)) {
      blockers.push('porta fechada');
    }
    if (full) blockers.push('posição lotada');
    if (invasion) blockers.push('invasão em andamento');
    if (blockers.length) {
      choice.reason = blockers.join(' · ');
      return false;
    }
    transition(actor, choice, choice.to);
    return true;
  }

  function expire(actor) {
    const { to, free } = actor.pending;
    actor.pending = null;
    if (free) actor.freeMoves--;
    effects.retain(actor);
    const previousRoute = actor.route?.id;
    const kind = blockedAttackRetreat(actor, to);
    if (kind) withdraw(actor, kind, movement.failedIntervalFactor);
    if (actor.rule.routes && !actor.approach) attackRoutes.select(actor, previousRoute);
    if (!kind) schedule(actor, movement.failedIntervalFactor);
  }

  function blockedAttackRetreat(actor, to) {
    if (actor.approach && (actor.rule.routes || (actor.position === front && to === office
        && gates.closed.has(routes.gate(front, office))))) return actor.approach.objective;
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
      actor.retreat = null;
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
        required: actor.route?.required ?? null, lastReached: actor.route?.lastReached ?? null,
        routeBonus: navigationBonus(actor), approach: actor.approach?.phase ?? null,
        freeMoves: actor.freeMoves, intervalPenalty: actor.intervalPenalty,
        light: actor.light, noise: actor.noise, audioRetention: actor.audioRetention
      };
    });
  }

  function attemptOdds(actor, choice) {
    const conditions = attemptConditions(actor, choice);
    if (!conditions) return { pass: 0, reasons: ['passagem indisponível'] };
    const { gate, observed, staticChance, doorChance, leftLook, full, invasion } = conditions;
    const reasons = [
      observed && 'câmera observada', leftLook && 'porta esquerda observada',
      gates.closed.has(gate) && gate, full && 'posição lotada', invasion && 'invasão em andamento'
    ].filter(Boolean);
    const signalOdds = observed ? (staticChance ?? 0) / 100 : 1;
    const gateOdds = gates.closed.has(gate) ? (doorChance ?? 0) / 100 : 1;
    return { pass: leftLook || full || invasion ? 0 : signalOdds * gateOdds, reasons };
  }

  function addOdds(odds, label, probability) {
    if (probability > 0) odds[label] = (odds[label] ?? 0) + probability;
  }

  function addAttempt(odds, actor, choice, probability) {
    const { pass, reasons } = attemptOdds(actor, choice);
    const destination = routes.positions.get(choice.to)?.name;
    addOdds(odds, choice.stationary ? 'Ficar' : destination, probability * pass);
    addOdds(odds, `Bloqueio em ${destination} (${reasons.join(', ')})`, probability * (1 - pass));
  }

  function addRetreat(odds, actor, kind, probability) {
    const { items, weights, total } = retreatChoices(actor, kind);
    if (!total) addOdds(odds, 'Ficar (recuo sem destino)', probability);
    items.forEach((id, index) => addOdds(odds, `Recuar para ${routes.positions.get(id).name}`, probability * weights[index] / total));
  }

  function plannedOdds(odds, actor, probability) {
    if (actor.stage < actor.rule.initialStationaryAttempts) {
      addAttempt(odds, actor, { to: actor.position, stationary: true }, probability);
      return;
    }
    if (!actor.approach && attackRoutes.checkpoint(actor) === actor.position) {
      // Advance an independent route cursor exactly as choose() does.
      actor = { ...actor, route: { ...actor.route } };
      if (attackRoutes.reach(actor)) {
        if (actor.route.objective === 'electrical') {
          addOdds(odds, 'Ficar (ação na elétrica)', probability);
          return;
        }
        approach.begin(actor, actor.route.objective);
      }
    }
    if (actor.approach) {
      const { to, objective, advance, stay } = approach.options(actor);
      addAttempt(odds, actor, { to }, probability * advance);
      addOdds(odds, 'Ficar', probability * stay);
      addRetreat(odds, actor, objective, probability * (1 - (advance + stay)));
      return;
    }
    if (actor.route?.counterattack) {
      addAttempt(odds, actor, { to: attackRoutes.checkpoint(actor) }, probability);
      return;
    }
    const { items, weights, total } = navigationChoices(actor);
    if (!total) addOdds(odds, 'Ficar', probability);
    items.forEach((to, index) => {
      const share = total ? probability * weights[index] / total : 0;
      if (to === actor.position) addOdds(odds, 'Ficar', share);
      else if (share > 0) addAttempt(odds, actor, { to }, share);
    });
  }

  function actorDebug(actor) {
    const { pending, position } = actor;
    const odds = { Ficar: 0 };
    const expiryOdds = {};
    let status;
    let target;
    const selections = actor.level && actor.rule.routes && !outcome ? attackRoutes.selectionOdds(actor) : [];
    if (!actor.level || outcome) {
      status = actor.level ? 'turno encerrado' : 'parada · nível 0';
      addOdds(odds, 'Ficar', 1);
    } else if (position === office) {
      const invasion = threats.invasionStatus(actor, now);
      status = invasion?.retreat ? `invasão · recuo em ${invasion.remaining.toFixed(1)} s`
        : invasion ? `invasão · ataque em ${invasion.remaining.toFixed(1)} s` : 'invasão';
      if (invasion?.retreat) addRetreat(odds, actor, 'office', 1);
      else addOdds(odds, 'Ficar', 1);
    } else if (pending) {
      target = pending.to;
      status = `bloqueada · ${pending.reason} · ${Math.max(0, pending.expires - now).toFixed(1)} s`;
      addAttempt(odds, actor, pending, 1);
      const kind = blockedAttackRetreat(actor, target);
      if (kind) {
        addRetreat(expiryOdds, actor, kind, 1);
      } else if (!actor.approach) {
        for (const { route, probability } of attackRoutes.selectionOdds(actor, actor.route?.id)) {
          addOdds(expiryOdds, route.id, probability);
        }
        if (!Object.keys(expiryOdds).length) addOdds(expiryOdds, 'Ficar', 1);
      } else addOdds(expiryOdds, 'Ficar', 1);
    } else {
      const remaining = Math.max(0, moveDue(actor) - now).toFixed(1);
      const phase = actor.retreat ? 'recuou · recuperação' : actor.approach?.phase === 'entry' ? 'entrada'
        : actor.approach ? 'aproximação'
        : actor.freeMoves ? 'movimento livre' : movementPaused() ? 'pausa inicial'
        : actor.stage < actor.rule.initialStationaryAttempts ? 'parada inicial' : 'aguardando tentativa';
      status = `${phase} · ${remaining} s`;
      target = actor.approach ? approach.options(actor).to : navigationTarget(actor);
      if (actor.rule.routes && !actor.route && !actor.approach && !actor.freeMoves) {
        if (!selections.length) plannedOdds(odds, actor, 1);
        for (const { route, probability } of selections) plannedOdds(odds, { ...actor, route }, probability);
      } else plannedOdds(odds, actor, 1);
    }
    const routeOdds = Object.fromEntries(selections.map(({ route, probability }) => [route.id, probability]));
    return { key: actor.key, name: actor.rule.name, position, location: routes.positions.get(position).name,
      route: actor.rule.routes ? (actor.route?.id ?? 'A sortear') : 'Sem rota',
      routeOdds, required: actor.route?.required, lastReached: actor.route?.lastReached,
      completed: actor.route?.completed, bonus: actor.level ? navigationBonus(actor) : null,
      target, status, odds, expiryOdds };
  }

  function debugSnapshot() {
    const radio = input.radio && resources.radioAvailable(now);
    return {
      actors: roster.map(actorDebug),
      clown: { ...threats.snapshot(), max: config.threats.clown.max, status: threats.clownStatus(radio, input.clownLight) },
      smores: smores.diagnostics(radio)
    };
  }

  reset();
  return {
    reset, advance, cameraActors, diagnostics, debugSnapshot, stop: () => shadow.stop(),
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
