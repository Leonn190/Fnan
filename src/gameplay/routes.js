(() => {
'use strict';

const factor = percent => 1 + percent / 100;
const uniform = (random, { min, max }) => min + random() * (max - min);
function weightedChoices(items, weight) {
  const weights = items.map(item => Math.max(0, weight(item)));
  const total = weights.reduce((sum, value) => sum + value, 0);
  return { items, weights, total };
}

function drawWeighted(random, { items, weights, total }) {
  if (total === 0) return undefined;
  let ticket = random() * total;
  return items.find((_, index) => (ticket -= weights[index]) < 0);
}

const weighted = (random, items, weight) => drawWeighted(random, weightedChoices(items, weight));

function createRoutes(map) {
  const positions = new Map(map.positions.map(position => [position.id, position]));
  const neighbors = new Map(map.positions.map(({ id }) => [id, []]));
  const incoming = new Map(map.positions.map(({ id }) => [id, []]));
  const edges = new Map();
  const connection = (from, to) => edges.get(from)?.get(to);
  function link(from, to, edge) {
    if (!positions.has(from) || !positions.has(to) || from === to || connection(from, to)) {
      throw new Error(`Ligação física inválida: ${from} → ${to}.`);
    }
    if (!edges.has(from)) edges.set(from, new Map());
    edges.get(from).set(to, edge);
    neighbors.get(from).push(to);
    incoming.get(to).push(from);
  }
  for (const edge of map.edges) {
    link(edge.from, edge.to, edge);
    if (!edge.oneWay) link(edge.to, edge.from, edge);
  }

  function distances(origins, allowed, max = Infinity, passable = () => true, towardOrigins = false) {
    const queue = origins.filter(id => positions.has(id) && allowed(id));
    const result = new Map(queue.map(id => [id, 0]));
    for (const from of queue) {
      const distance = result.get(from) + 1;
      if (distance > max) continue;
      for (const to of (towardOrigins ? incoming : neighbors).get(from)) {
        const start = towardOrigins ? to : from;
        const end = towardOrigins ? from : to;
        if (!allowed(to) || result.has(to) || !passable(connection(start, end), start, end)) continue;
        result.set(to, distance);
        queue.push(to);
      }
    }
    return result;
  }

  return { positions, neighbors, distances, connection, gate: (a, b) => connection(a, b)?.gateId };
}

function createAttackRoutes(config, graph, random, passable, clear) {
  const { map, movement } = config;
  const { definitions, bonusByLevel, bonusPerMove } = movement.routes;
  const permitsEdge = (actor, edge) => edge && (!edge.actors || edge.actors.includes(actor.key));
  function routeOptions(actor) {
    return Object.entries(actor.rule.routes ?? {}).map(([id, weight]) => {
      const { objective, target, paths } = definitions[id];
      const variants = paths?.filter(path => path.every((position, index) =>
        actor.allowed.has(position) && (index === 0 || permitsEdge(actor, graph.connection(path[index - 1], position)))));
      return { id, weight, objective, target, variants };
    }).filter(({ target, variants }) => actor.allowed.has(target) && (variants === undefined || variants.length));
  }

  function canNavigate(actor, id) {
    return actor.allowed.has(id) && id !== map.office && id !== map.front && id !== map.left
      && !(actor.rule.initialStationaryAttempts !== undefined && id === actor.rule.start)
      && !(actor.route?.id === 'CC' && id === map.leftApproach);
  }

  function distances(actor, target, usable) {
    return graph.distances([target], id => canNavigate(actor, id) || id === actor.position, Infinity,
      (edge, from, to) => usable(actor, edge, from, to), true);
  }

  function pathUsable(actor, path, start, usable) {
    return path.slice(start + 1).every((to, index) => {
      const from = path[start + index];
      return usable(actor, graph.connection(from, to), from, to);
    });
  }

  function candidate(actor, option, usable) {
    const { id, objective, target, variants, weight } = option;
    actor = { ...actor, route: { id } };
    let required = null;
    if (variants) {
      let nearest = Infinity;
      for (const start of new Set(variants.map(path => path[0]))) {
        if (!variants.some(path => path[0] === start && pathUsable(actor, path, 0, usable))) continue;
        const distance = distances(actor, start, usable).get(actor.position) ?? Infinity;
        if (distance >= nearest) continue;
        nearest = distance;
        required = start;
      }
      if (required === null) return;
    } else if (!distances(actor, target, usable).has(actor.position)) return;
    return { route: { id, objective, target, required, paths: variants?.filter(path => path[0] === required),
      index: 0, lastReached: null, completed: false, moves: 0 }, weight };
  }

  function selectionOdds(actor, exclude) {
    const options = routeOptions(actor).filter(({ id, objective, weight }) => id !== exclude && weight > 0
      && !(objective === 'electrical' && actor.lastRoute === id && actor.route?.id !== id));
    const candidates = usable => options.map(option => candidate(actor, option, usable)).filter(Boolean);
    let eligible = candidates(passable);
    // If every route is gated, keep a physical option so the actor can wait for a door.
    if (!eligible.length && exclude === undefined) eligible = candidates(permitsEdge);
    const total = eligible.reduce((sum, { weight }) => sum + weight, 0);
    return eligible.map(({ route, weight }) => ({ route, probability: weight / total }));
  }

  function select(actor, exclude) {
    const options = selectionOdds(actor, exclude);
    const selected = weighted(random, options, option => option.probability);
    if (!selected) return;
    actor.route = selected.route;
    actor.lastRoute = selected.route.id;
  }

  function internalSteps(actor, usable) {
    const { paths, index } = actor.route;
    const eligible = paths.filter(path => pathUsable(actor, path, index, usable));
    const shortest = Math.min(...eligible.map(path => path.length));
    return [...new Set(eligible.filter(path => path.length === shortest).map(path => path[index + 1]))];
  }

  function nextSteps(actor, target) {
    const { position, route } = actor;
    for (const usable of [clear, passable, permitsEdge]) {
      if (route?.paths && route.lastReached === position) {
        const steps = internalSteps(actor, usable);
        if (steps.length) return steps;
      } else {
        const distance = distances(actor, target, usable);
        const steps = graph.neighbors.get(position).filter(to =>
          distance.get(to) === distance.get(position) - 1
          && usable(actor, graph.connection(position, to), position, to));
        if (steps.length) return steps;
      }
    }
    return [];
  }

  function checkpoint(actor) {
    const { route, position } = actor;
    if (!route || route.completed) return;
    if (!route.paths) return route.target;
    if (route.lastReached === null) return route.required;
    if (position !== route.lastReached) return route.lastReached;
    return nextSteps(actor)[0];
  }

  function reach(actor, from) {
    const { route, position } = actor;
    if (!route || route.completed) return false;
    if (route.paths) {
      if (route.lastReached === null) {
        if (position !== route.required) return false;
      } else {
        if (from !== route.lastReached) return false;
        const paths = route.paths.filter(path => path[route.index + 1] === position);
        if (!paths.length) return false;
        route.paths = paths;
        route.index++;
      }
    }
    route.lastReached = position;
    route.completed = position === route.target;
    return route.completed;
  }

  const bonus = (level, moves = 0) =>
    (bonusByLevel.findLast(({ minLevel }) => level >= minLevel)?.bonus ?? 0) + moves * bonusPerMove;
  return { select, selectionOdds, checkpoint, reach, nextSteps, canNavigate, bonus };
}

Object.assign(window.NathGame, { factor, uniform, weighted, weightedChoices, drawWeighted, createRoutes, createAttackRoutes });
})();
