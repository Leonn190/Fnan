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
        if (!allowed(to) || result.has(to) || !passable(towardOrigins ? connection(to, from) : connection(from, to))) continue;
        result.set(to, distance);
        queue.push(to);
      }
    }
    return result;
  }

  return { positions, neighbors, distances, connection, gate: (a, b) => connection(a, b)?.gateId };
}

function createAttackRoutes(config, graph, random, gateVersion, passable) {
  const { map, movement } = config;
  const { definitions, electricalChance, bonusByLevel } = movement.routes;
  const preparation = { corridor: map.back, stock: map.leftApproach };
  const cache = new WeakMap();
  const permitsEdge = (key, edge) => edge && (!edge.actors || edge.actors.includes(key));
  const catalog = Object.fromEntries(Object.entries(config.characters).map(([key, rule]) => {
    const allowed = new Set(rule.positions);
    const options = (rule.routes ?? []).map(id => {
      const { objective, paths } = definitions[id];
      const variants = (rule.routePaths?.[id] ?? paths).filter(path => path.every((position, index) =>
        allowed.has(position) && (index === 0 || permitsEdge(key, graph.connection(path[index - 1], position)))));
      return { id, objective, variants };
    }).filter(({ variants }) => variants.length);
    return [key, options];
  }));

  function navigationDistances(actor, target, openOnly) {
    return graph.distances([target], id => actor.allowed.has(id) && id !== map.office && id !== map.left
      && !(actor.stockRequired && id === map.stockRequired.destination), Infinity,
      edge => openOnly ? passable(actor, edge) : permitsEdge(actor.key, edge), true);
  }

  function checkpointPath(actor, objective, path) {
    const prepare = preparation[objective];
    const checkpoints = prepare === undefined ? path : path.slice(0, path.indexOf(prepare) + 1);
    const at = checkpoints.indexOf(actor.position);
    if (at >= 0 && actor.position !== config.threats.electrical.position) {
      return checkpoints.slice(at === checkpoints.length - 1 ? at : at + 1);
    }
    if (checkpoints.length < 2) return null;
    // Join the route at an intermediate waypoint, keeping the final approach on the selected route.
    const last = checkpoints.length - 1;
    let join;
    let nearest = Infinity;
    for (let index = 1; index < last; index++) {
      const distances = navigationDistances(actor, checkpoints[index], false);
      const distance = distances.get(actor.position) ?? Infinity;
      if (distance >= nearest) continue;
      nearest = distance;
      join = index;
    }
    if (join === undefined) return null;
    return checkpoints.slice(join);
  }

  const makeRoute = ({ id, objective }, checkpoints, counterattack = false) =>
    ({ id, objective, checkpoints, index: 0, completed: false, counterattack });

  function assign(actor, option, checkpoints, counterattack = false) {
    actor.route = makeRoute(option, checkpoints, counterattack);
    const { id } = option;
    actor.lastRoute = id;
  }

  function candidates(actor) {
    const options = catalog[actor.key].filter(({ id, objective }) => id !== actor.lastRoute
      && (objective !== 'electrical' || electricalChance > 0))
      .map(option => ({
        ...option,
        paths: option.variants.map(path => checkpointPath(actor, option.objective, path)).filter(Boolean)
      })).filter(({ paths }) => paths.length);
    const electrical = options.find(option => option.objective === 'electrical');
    const regular = options.filter(option => option !== electrical);
    return { electrical, regular };
  }

  function select(actor) {
    const { electrical, regular } = candidates(actor);
    const selected = electrical && (!regular.length || random() < electricalChance)
      ? electrical : weighted(random, regular, () => 1);
    if (!selected) return;
    const { paths } = selected;
    assign(actor, selected, paths.length === 1 ? paths[0] : weighted(random, paths, () => 1));
  }

  function selectionOdds(actor) {
    const { electrical, regular } = candidates(actor);
    const electricalShare = electrical ? (regular.length ? electricalChance : 1) : 0;
    const variants = (option, share) => option.paths.map(path => ({
      route: makeRoute(option, path), probability: share / option.paths.length
    }));
    return [
      ...(electrical ? variants(electrical, electricalShare) : []),
      ...regular.flatMap(option => variants(option, (1 - electricalShare) / regular.length))
    ];
  }

  function counterattackOption(actor) {
    const options = catalog[actor.key].filter(({ id, objective }) => objective === 'stock' && id !== actor.lastRoute);
    const selected = options.find(({ id }) => id === movement.attack.stockCounterattack.route) ?? options[0];
    if (selected && permitsEdge(actor.key, graph.connection(map.front, map.back))
        && permitsEdge(actor.key, graph.connection(map.back, map.leftApproach))) return selected;
  }

  function counterattack(actor) {
    const selected = counterattackOption(actor);
    if (!selected) return false;
    assign(actor, selected, [map.back, map.leftApproach], true);
    return true;
  }

  const checkpoint = actor => actor.route?.checkpoints[actor.route.index];

  function reach(actor) {
    if (checkpoint(actor) !== actor.position) return false;
    return ++actor.route.index === actor.route.checkpoints.length;
  }

  function distances(actor, target) {
    const version = gateVersion();
    let entry = cache.get(actor);
    if (entry?.target !== target || entry.version !== version || entry.stockRequired !== actor.stockRequired) {
      entry = { target, version, stockRequired: actor.stockRequired,
        open: navigationDistances(actor, target, true), physical: null };
      cache.set(actor, entry);
    }
    if (entry.open.has(actor.position)) return entry.open;
    entry.physical ??= navigationDistances(actor, target, false);
    return entry.physical;
  }

  const bonus = level => bonusByLevel.findLast(({ minLevel }) => level >= minLevel)?.bonus ?? 0;
  return { select, selectionOdds, counterattack, counterattackOption, checkpoint, reach, distances, bonus };
}

Object.assign(window.NathGame, { factor, uniform, weighted, weightedChoices, drawWeighted, createRoutes, createAttackRoutes });
})();
