(() => {
'use strict';

const factor = percent => 1 + percent / 100;
const uniform = (random, { min, max }) => min + random() * (max - min);
function weighted(random, items, weight) {
  const weights = items.map(item => Math.max(0, weight(item)));
  const total = weights.reduce((sum, value) => sum + value, 0);
  if (total === 0) return undefined;
  let ticket = random() * total;
  return items.find((_, index) => (ticket -= weights[index]) < 0);
}

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

Object.assign(window.NathGame, { factor, uniform, weighted, createRoutes });
})();
