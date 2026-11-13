(() => {
'use strict';

const ART_ORDER = ['original', 'yandere', 'gotica', 'platinada', 'maid'];
const CORRIDOR_ORDER = ['original', 'platinada', 'yandere', 'gotica', 'maid'];
const characterStateImages = cam => cam.characterStateImages ?? cam.stageStateImages ?? {};
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

function cameraFrame(cam, key, isGateClosed) {
  const gates = cam.gateStateImages?.gates;
  const gateKey = gates?.map(id => isGateClosed(id) ? 'closed' : 'open').join('-');
  const empty = cam.gateStateImages?.images ?? cam.image;
  const variants = characterStateImages(cam)[key] ?? empty;
  return { key, gateKey, source: gates ? variants?.[gateKey] ?? empty[gateKey] : variants };
}

function cameraActorFrame(cam, actors, config, isGateClosed, preview) {
  const visibleActors = actors.filter(actor => !config.controls.unillustratedCameraPositions.includes(actor.position));
  if (preview === undefined && cam.id === 'CAM09' && visibleActors.some(actor => actor.stage > 0)) {
    return { key: 'maid-saindo', source: './public/images/cameras/CAM09/states/02-maid-saindo.webp', occupied: true };
  }
  const key = preview ?? cameraStateKey(cam, visibleActors, config.map.stage);
  const frame = cameraFrame(cam, key, isGateClosed);
  const variant = characterStateImages(cam)[key];
  const activeActorVisible = visibleActors.some(actor => actor.level !== 0);
  return { ...frame, occupied: Boolean(activeActorVisible && (frame.gateKey ? variant?.[frame.gateKey] : variant)) };
}

function sanityObservation(config, actors, cameraActors, input) {
  const { CAMERAS, OFFICE } = window.NathGame;
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
  const cam = CAMERAS.find(cam => cam.id === input.camera);
  const onCamera = cam ? cameraActors(cam.id) : [];
  const frame = cam && cameraActorFrame(cam, onCamera, config, id => input.gates.has(id), input.cameraPreview);
  const camera = frame?.occupied && (input.visibleCameraSource === undefined || frame.source === input.visibleCameraSource);
  return {
    invasion, direct, camera,
    yandereCamera: camera && (frame.key === 'todas' || frame.key.split('-').includes('yandere'))
      && onCamera.some(actor => actor.key === 'yandere' && actor.level > 0
      && !config.controls.unillustratedCameraPositions.includes(actor.position)),
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
  cameraStateKey, cameraFrame, cameraActorFrame, sanityObservation, characterStateImages, officeCharacterImage, corridorSlots
});
})();
