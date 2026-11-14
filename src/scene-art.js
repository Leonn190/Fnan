(() => {
'use strict';

const ART_ORDER = ['original', 'yandere', 'gotica', 'platinada', 'maid'];
const CORRIDOR_ORDER = ['original', 'platinada', 'yandere', 'gotica', 'maid'];
const characterStateImages = cam => cam.characterStateImages ?? cam.stageStateImages ?? {};
const cameraLayerScene = (cam, gateKey) => {
  const scene = window.NathGame.cameraLayers?.[cam.id] ?? window.NathGame.complexLayers?.[cam.id];
  return gateKey ? scene?.[gateKey] : scene;
};
const officeCharacterImage = (phase, id) => `./public/images/office/characters/${phase}/${id}.webp`;
// Horizontal silhouettes in the panorama (2172 px) and the view through the slats (1671 px).
const officeRoomBounds = {
  original: [907, 1277], maid: [442, 802], gotica: [1374, 1648], yandere: [727, 1080], platinada: [1146, 1520]
};
const officeDoorBounds = {
  original: [229, 423], maid: [243, 432], gotica: [243, 424], yandere: [205, 372], platinada: [202, 419]
};
const closetRoomBounds = {
  original: [428, 620], maid: [761, 950], gotica: [948, 1149], yandere: [622, 786], platinada: [1106, 1363]
};

function cameraStateKey(cam, actors, stagePosition) {
  const ids = ART_ORDER.filter(id => actors.some(actor => actor.rule.artId === id));
  if (!ids.length) return 'vazia';
  const states = characterStateImages(cam);
  if (cam.id === 'CAM03' && actors.some(actor => actor.position !== stagePosition)) {
    const onStage = id => actors.some(actor => actor.rule.artId === id && actor.position === stagePosition);
    const stage = ids.filter(onStage).join('-') || 'vazio';
    const floor = ids.filter(id => !onStage(id)).join('-');
    return `palco-${stage}--salao-${floor}`;
  }
  const key = ids.join('-');
  return key === cam.allCharacters?.join('-') && Object.hasOwn(states, 'todas') ? 'todas' : key;
}

function cameraLayerKeys(cam, key) {
  if (typeof key !== 'string') return [];
  if (cam.id === 'CAM09') {
    if (key === 'todas') return ['maid'];
    return key === 'maid' || key === 'maid-saindo' ? [key] : [];
  }
  if (cam.id === 'CAM03') {
    const positions = /^palco-(.+)--salao-(.+)$/.exec(key);
    const stage = positions?.[1] ?? key;
    const hall = positions?.[2] ?? '';
    const stageIds = canonicalCameraCast(cam, stage === 'vazio' ? '' : stage);
    const hallIds = canonicalCameraCast(cam, hall);
    if ((stage && stage !== 'vazio' && !stageIds.length)
        || (positions && !hallIds.length) || stageIds.some(id => hallIds.includes(id))) return [];
    return [...stageIds.map(id => `palco-${id}`), ...hallIds.map(id => `salao-${id}`)];
  }
  return canonicalCameraCast(cam, key);
}

function canonicalCameraCast(cam, key) {
  const ids = key.split('-');
  const supported = cam.allCharacters.filter(id => ids.includes(id));
  return supported.join('-') === key ? supported : [];
}

function hasCameraState(cam, key) {
  return typeof key === 'string' && (key === 'vazia' || Object.hasOwn(characterStateImages(cam), key)
    || ((window.NathGame.cameraLayers?.[cam.id] || window.NathGame.complexLayers?.[cam.id])
      && cameraLayerKeys(cam, key).length > 0));
}

function cameraFrame(cam, key, isGateClosed) {
  const gates = cam.gateStateImages?.gates;
  const gateKey = gates?.map(id => isGateClosed(id) ? 'closed' : 'open').join('-');
  const empty = cam.gateStateImages?.images ?? cam.image;
  const variant = Object.hasOwn(characterStateImages(cam), key) ? characterStateImages(cam)[key] : undefined;
  const base = gates ? empty[gateKey] : empty;
  const art = gates ? variant?.[gateKey] : variant;
  const scene = cameraLayerScene(cam, gateKey);
  if (!scene || art) return { key, gateKey, source: art ?? base };
  const selected = cameraLayerKeys(cam, key);
  const layers = Object.entries(scene.layers)
    .filter(([id]) => id.split('+').every(part => selected.includes(part))).map(([, layer]) => layer);
  return { key, gateKey, source: layers.length ? scene.base ?? base : base, layers, size: scene.size };
}

function cameraActorFrame(cam, actors, config, isGateClosed, preview) {
  const visibleActors = actors.filter(actor => !config.controls.unillustratedCameraPositions.includes(actor.position));
  if (preview === undefined && cam.id === 'CAM09' && visibleActors.some(actor => actor.stage > 0)) {
    return { ...cameraFrame(cam, 'maid-saindo', isGateClosed), occupied: true };
  }
  const key = preview ?? cameraStateKey(cam, visibleActors, config.map.stage);
  const frame = cameraFrame(cam, key, isGateClosed);
  const variant = characterStateImages(cam)[key];
  const activeActorVisible = visibleActors.some(actor => actor.level !== 0);
  return { ...frame, occupied: Boolean(activeActorVisible
    && (frame.layers?.length || (frame.gateKey ? variant?.[frame.gateKey] : variant))) };
}

function closetFrame(gate, occupants, doorway) {
  const scene = window.NathGame.complexLayers.closet;
  const layers = [scene.layers[`porta-${doorway}`], ...occupants.map(id => scene.layers[`sala-${id}`])].filter(Boolean);
  const empty = `./public/images/office/closet/states/${gate}/sala-vazia--porta-vazia.webp`;
  return { source: layers.length ? scene.bases[gate] : empty, layers, size: scene.size };
}

function cameraObservation(config, cameraActors, input) {
  const cam = window.NathGame.CAMERAS.find(cam => cam.id === input.camera);
  if (!cam) return;
  const onCamera = cameraActors(cam.id);
  const frame = cameraActorFrame(cam, onCamera, config, id => input.gates.has(id), input.cameraPreview);
  if (!frame.occupied || (input.visibleCameraSource !== undefined && frame.source !== input.visibleCameraSource)) return;
  if (input.visibleCameraLayers !== undefined && frame.layers
      && (frame.layers.length !== input.visibleCameraLayers.length
        || frame.layers.some(([source], index) => source !== input.visibleCameraLayers[index]))) return;

  const illustrated = frame.key === 'todas' ? cam.allCharacters : frame.key.split('-');
  const { loss, cameraLossOverrides } = config.sanity;
  let cameraLoss = loss.camera;
  let yandereVisible = false;
  for (const actor of onCamera) {
    if (actor.level === 0 || !illustrated.includes(actor.rule.artId)
        || config.controls.unillustratedCameraPositions.includes(actor.position)) continue;
    const yandere = actor.key === 'yandere';
    yandereVisible ||= yandere;
    cameraLoss = Math.max(cameraLoss, cameraLossOverrides[actor.key]?.[cam.id] ?? (yandere ? loss.yandereCamera : loss.camera));
  }
  return { cameraLoss, yandereVisible };
}

function sanityObservation(config, actors, input, camera) {
  const { OFFICE } = window.NathGame;
  const { left, office, front, back } = config.map;
  const intersects = (viewport, [min, max]) => viewport && min < viewport[1] && max > viewport[0];
  const inOffice = input.view === 'office';
  const closetDoor = input.view === 'closet-door';
  const room = actors.filter(actor => actor.position === office);
  const doorway = actors.find(actor => actor.position === left)?.rule.artId;
  const invasion = room.some(({ rule }) => (inOffice && intersects(input.officeBounds, officeRoomBounds[rule.artId]))
    || (closetDoor && intersects(input.closetBounds, closetRoomBounds[rule.artId])));
  const direct = (doorway && ((inOffice && intersects(input.officeBounds, officeDoorBounds[doorway]))
      || (closetDoor && OFFICE.doorwayCharacters.includes(doorway) && intersects(input.closetBounds, [541, 700]))))
    || (inOffice && input.corridorLight && intersects(input.officeBounds, [956, 1220])
      && actors.some(actor => actor.position === front || actor.position === back))
    || (inOffice && input.clownStage === config.threats.clown.stages.length - 1 && intersects(input.officeBounds, [1859, 2172]))
    || (input.view === 'closet-back' && input.clownLight && input.clownStage >= 0);
  return {
    invasion, direct, cameraLoss: camera?.cameraLoss,
    centralGate: input.gates.has(OFFICE.gate), closet: input.closet
  };
}

function corridorSlots(front, back) {
  const frontSlots = [3, 4];
  const backSlots = [[], [1], [0, 2], [0, 1, 2]][Math.min(back.length, 3)];
  return [...CORRIDOR_ORDER.filter(id => back.includes(id)).slice(0, backSlots.length)
    .map((id, index) => ({ slot: backSlots[index], column: CORRIDOR_ORDER.indexOf(id) })),
  ...CORRIDOR_ORDER.filter(id => front.includes(id)).slice(0, frontSlots.length)
    .map((id, index) => ({ slot: frontSlots[index], column: CORRIDOR_ORDER.indexOf(id) }))];
}

Object.assign(window.NathGame, {
  cameraStateKey, cameraFrame, cameraActorFrame, cameraObservation, sanityObservation,
  characterStateImages, hasCameraState, officeCharacterImage, corridorSlots, closetFrame
});
})();
