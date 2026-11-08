(() => {
'use strict';
const { CAMERAS, VENUE, OFFICE } = window.NathGame;
const MIN_MOVE_MS = 10_000;
const CAST = [
  { id: 'original', name: 'Padrão', start: 'salao' },
  { id: 'yandere', name: 'Yandere', start: 'salao' },
  { id: 'gotica', name: 'Gótica', start: 'salao' },
  { id: 'platinada', name: 'Gatinha', start: 'nathzinha' },
  { id: 'maid', name: 'Maid', start: 'servico' }
];

function containsPoint(polygon, x, y) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [ax, ay] = polygon[i];
    const [bx, by] = polygon[j];
    if ((ay > y) !== (by > y) && x < ax + (y - ay) * (bx - ax) / (by - ay)) inside = !inside;
  }
  return inside;
}

function buildRoomGraph(venue) {
  const graph = new Map(venue.rooms.map(room => [room.id, []]));
  for (const { id, axis, at, start, end, type } of venue.openings) {
    if (type !== 'livre' && type !== 'portao') continue;
    const middle = (start + end) / 2;
    // Sample 1 cm into each side of the opening in the measured floor plan.
    const sides = [-.01, .01].map(offset => {
      const [x, y] = axis === 'H' ? [middle, at + offset] : [at + offset, middle];
      return venue.rooms.filter(room => containsPoint(room.points, x, y));
    });
    const [[from], [to]] = sides;
    if (sides.some(side => side.length !== 1) || from === to) {
      throw new Error(`[FNAN] A passagem ${id} precisa ligar duas salas distintas.`);
    }
    graph.get(from.id).push({ to: to.id, id, type });
    graph.get(to.id).push({ to: from.id, id, type });
  }
  return graph;
}

const graph = buildRoomGraph(VENUE);
const roomNames = new Map(VENUE.rooms.map(room => [room.id, room.name]));
const roomCameras = new Map(VENUE.rooms.map(room => [room.id, CAMERAS.filter(cam => cam.room === room.id)]));
const characterStateImages = cam => cam.characterStateImages ?? cam.stageStateImages ?? {};
const officeCharacterImage = (phase, id) => `./public/images/office/characters/${phase}/${id}.webp`;

function cameraStateKey(cam, occupants) {
  if (!occupants.length) return 'vazia';
  const states = characterStateImages(cam);
  const ordered = CAST.map(({ id }) => id).filter(id => occupants.includes(id));
  if (ordered.length !== occupants.length) return null;
  const key = ordered.join('-');
  if (key === cam.allCharacters?.join('-') && Object.hasOwn(states, 'todas')) return 'todas';
  return Object.hasOwn(states, key) ? key : null;
}

function cameraStateVariants(cam, key) {
  if (key === 'vazia') return cam.gateStateImages?.images ?? cam.image;
  return characterStateImages(cam)[key];
}

function cameraFrame(cam, key, isGateClosed) {
  const gates = cam.gateStateImages?.gates;
  const gateKey = gates?.map(id => isGateClosed(id) ? 'closed' : 'open').join('-');
  const variants = cameraStateVariants(cam, key);
  return { key, gateKey, source: gates ? variants?.[gateKey] : variants };
}

function createMovement({ isGateClosed, imageStatus, random = Math.random, log = () => {} }) {
  let cast;
  const doorwayQueue = [];
  const interval = () => MIN_MOVE_MS + random() * 4_000;
  const occupants = room => cast.filter(actor => actor.room === room).map(actor => actor.id);
  const location = (room, phase) => phase === 'doorway'
    ? `${roomNames.get(room)} / porta lateral (P02)`
    : roomNames.get(room);
  const place = (room, phase) => roomCameras.get(room).map(cam => cam.id).join('/') || location(room, phase);

  function checkImages(paths, label) {
    let pending = false;
    for (const path of paths) {
      if (!path) return `ausência de imagem (${label})`;
      const status = imageStatus(path);
      if (status === 'missing') return `ausência de imagem (${label}: ${path})`;
      pending ||= status === 'pending';
    }
    return pending ? `carregando imagem (${label})` : null;
  }

  function cameraIssue(room, ids) {
    const cameras = roomCameras.get(room);
    if (!cameras.length) return ids.length ? `ausência de imagem (${roomNames.get(room)} sem câmera)` : null;
    let pending = null;
    for (const cam of cameras) {
      const key = cameraStateKey(cam, ids);
      const variants = cameraStateVariants(cam, key);
      const paths = cam.gateStateImages
        ? Object.keys(cam.gateStateImages.images).map(gateKey => variants?.[gateKey])
        : [variants];
      const issue = checkImages(paths, `${cam.id}: ${key ?? ids.join('+')}`);
      if (issue?.startsWith('ausência')) return issue;
      pending ??= issue;
    }
    return pending;
  }

  function officeState() {
    const office = cast.filter(actor => actor.room === OFFICE.room);
    return {
      room: office.filter(actor => actor.phase === 'room').map(actor => actor.id),
      doorway: office.find(actor => actor.phase === 'doorway')?.id ?? null
    };
  }

  function edgeIssue(actor, edge) {
    if (edge.type === 'portao' && isGateClosed(edge.id)) return `portão fechado (${edge.id})`;
    const officeAccess = edge.to === OFFICE.room || actor.room === OFFICE.room;
    if (officeAccess && edge.id !== OFFICE.doorwayPassage) return `ausência de imagem (porta ${edge.id})`;
    if (edge.to === OFFICE.room) {
      if (!OFFICE.doorwayCharacters.includes(actor.id)) return `passagem indisponível (${edge.id})`;
      return checkImages(['doorway', 'room'].map(phase => officeCharacterImage(phase, actor.id)), 'escritório');
    }
    return cameraIssue(edge.to, [...occupants(edge.to), actor.id]);
  }

  function departureIssue(actor) {
    return cameraIssue(actor.room, occupants(actor.room).filter(id => id !== actor.id));
  }

  function joinDoorway(actor, choice) {
    if (!doorwayQueue.includes(actor.id)) doorwayQueue.push(actor.id);
    if (doorwayQueue[0] !== actor.id || officeState().doorway) {
      return { reasons: ['fila da porta lateral (P02)'], waitingForDoor: true };
    }
    const issue = departureIssue(actor);
    if (issue?.startsWith('carregando')) return { reasons: [issue] };
    doorwayQueue.shift();
    return issue ? { reasons: [issue] } : { choice };
  }

  function tryMove(actor) {
    if (actor.phase === 'doorway') {
      if (officeState().room.length >= 3) return { reasons: ['aguardando vaga dentro do escritório'] };
      return { choice: { to: OFFICE.room, phase: 'room' } };
    }
    if (doorwayQueue.includes(actor.id)) {
      const edge = graph.get(actor.room).find(edge => edge.id === OFFICE.doorwayPassage);
      return joinDoorway(actor, { ...edge, phase: 'doorway' });
    }
    const reasons = [];
    const choices = [];
    for (const edge of graph.get(actor.room)) {
      const issue = edgeIssue(actor, edge);
      if (issue) reasons.push(issue);
      else choices.push({ ...edge, phase: edge.to === OFFICE.room ? 'doorway' : null });
    }
    if (reasons.some(reason => reason.startsWith('carregando')) || !choices.length) {
      return { reasons: reasons.length ? reasons : ['ausência de caminho'] };
    }

    const choice = choices[Math.floor(random() * choices.length)];
    if (choice.phase === 'doorway') return joinDoorway(actor, choice);
    // Do not leave a camera with an unrepresentable combination behind.
    const issue = actor.room === OFFICE.room ? null : departureIssue(actor);
    return issue ? { reasons: [issue] } : { choice };
  }

  function reset() {
    doorwayQueue.length = 0;
    cast = CAST.map(({ id, name, start }) => ({
      id, name, room: start, phase: null, nextAttempt: interval(),
      previousRoom: null, destination: null, reason: null
    }));
    for (const actor of cast) {
      const issue = cameraIssue(actor.room, occupants(actor.room));
      if (issue?.startsWith('ausência')) log(`${actor.name}: ${issue}`, true);
    }
  }

  function advance(now, observedRoom) {
    const changed = new Set();
    const ready = cast.filter(actor => now >= actor.nextAttempt).sort((a, b) => a.nextAttempt - b.nextAttempt);
    for (const actor of ready) {
      if (actor.room === observedRoom) continue;
      const { choice, reasons, waitingForDoor } = tryMove(actor);
      if (!choice) {
        const reason = [...new Set(reasons)].join(' · ');
        if (reason !== actor.reason && reason.includes('ausência de imagem')) log(`${actor.name}: ${reason}`, true);
        actor.reason = reason;
        actor.destination = waitingForDoor ? location(OFFICE.room, 'doorway') : null;
        const retrySoon = waitingForDoor || reasons.some(item => item.startsWith('carregando'));
        actor.nextAttempt = now + (retrySoon ? 500 : MIN_MOVE_MS);
        continue;
      }
      const from = place(actor.room, actor.phase);
      changed.add(actor.room);
      changed.add(choice.to);
      if (actor.room !== choice.to) actor.previousRoom = actor.room;
      actor.room = choice.to;
      actor.phase = choice.phase;
      actor.reason = null;
      actor.destination = location(actor.room, actor.phase);
      actor.nextAttempt = now + interval();
      const states = roomCameras.get(actor.room).map(cam => cameraStateKey(cam, occupants(actor.room)));
      const passage = choice.type === 'portao' ? `${choice.id} aberto` : choice.id ?? 'entrada pela P02';
      log(`${actor.name}: ${from} → ${place(actor.room, actor.phase)} | ${passage} | estado: ${states.join('/') || actor.phase}`);
    }
    return changed;
  }

  function diagnostics(now, observedRoom) {
    return cast.map(actor => ({
      ...actor,
      camera: roomCameras.get(actor.room).map(cam => cam.id).join('/') || 'sem câmera',
      location: location(actor.room, actor.phase),
      previous: roomNames.get(actor.previousRoom),
      remaining: Math.max(0, actor.nextAttempt - now),
      stopped: actor.room === observedRoom ? 'observação' : actor.reason ?? 'cooldown',
      representation: actor.room === OFFICE.room ? null : cameraIssue(actor.room, occupants(actor.room))
    }));
  }

  reset();
  return { advance, reset, occupants, officeState, diagnostics };
}

Object.assign(window.NathGame, {
  buildRoomGraph, createMovement, cameraStateKey, cameraFrame, characterStateImages, officeCharacterImage
});
})();
