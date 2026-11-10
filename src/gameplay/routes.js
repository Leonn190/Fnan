(() => {
'use strict';

const factor = percent => 1 + percent / 100;
const uniform = (random, { min, max }) => min + random() * (max - min);
const edgeKey = (a, b) => a < b ? a + ':' + b : b + ':' + a;

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
  for (const [from, to] of map.edges) {
    neighbors.get(from).push(to);
    neighbors.get(to).push(from);
  }
  const gates = new Map();
  for (const [id, edges] of Object.entries({ ...map.gateEdges, ...map.otherGateEdges })) {
    for (const [from, to] of edges) gates.set(edgeKey(from, to), id);
  }

  function distances(origins, allowed, max = Infinity) {
    const queue = origins.filter(allowed);
    const result = new Map(queue.map(id => [id, 0]));
    for (const from of queue) {
      const distance = result.get(from) + 1;
      if (distance > max) continue;
      for (const to of neighbors.get(from)) {
        if (!allowed(to) || result.has(to)) continue;
        result.set(to, distance);
        queue.push(to);
      }
    }
    return result;
  }

  return { positions, neighbors, distances, gate: (a, b) => gates.get(edgeKey(a, b)) };
}

Object.assign(window.NathGame, { factor, uniform, weighted, createRoutes });
})();
