(() => {
'use strict';

const ART_ORDER = ['original', 'yandere', 'gotica', 'platinada', 'maid'];
const CORRIDOR_ORDER = ['original', 'platinada', 'yandere', 'gotica', 'maid'];
const characterStateImages = cam => cam.characterStateImages ?? cam.stageStateImages ?? {};
const officeCharacterImage = (phase, id) => `./public/images/office/characters/${phase}/${id}.webp`;

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

function corridorSlots(front, back) {
  const frontSlots = [3, 4];
  const backSlots = [[], [1], [0, 2], [0, 1, 2]][Math.min(back.length, 3)];
  return [...CORRIDOR_ORDER.filter(id => back.includes(id)).slice(0, backSlots.length)
    .map((id, index) => ({ slot: backSlots[index], column: CORRIDOR_ORDER.indexOf(id) })),
  ...CORRIDOR_ORDER.filter(id => front.includes(id)).slice(0, frontSlots.length)
    .map((id, index) => ({ slot: frontSlots[index], column: CORRIDOR_ORDER.indexOf(id) }))];
}

Object.assign(window.NathGame, {
  cameraStateKey, cameraFrame, characterStateImages, officeCharacterImage, corridorSlots
});
})();
