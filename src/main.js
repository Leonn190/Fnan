(() => {
'use strict';
const { CAMERAS, OFFICE, makeCameraMap, SoundEngine } = window.NathGame;
const shopCamera = CAMERAS.find(cam => cam.id === 'CAM01');
const receptionCamera = CAMERAS.find(cam => cam.id === 'CAM02');
const stageCamera = CAMERAS.find(cam => cam.id === 'CAM03');
const hallCamera = CAMERAS.find(cam => cam.id === 'CAM04');
const vip1Camera = CAMERAS.find(cam => cam.id === 'CAM05');
const vip2Camera = CAMERAS.find(cam => cam.id === 'CAM06');
const arcadeCamera = CAMERAS.find(cam => cam.id === 'CAM07');
const stockroomCamera = CAMERAS.find(cam => cam.id === 'CAM08');
const kitchenCamera = CAMERAS.find(cam => cam.id === 'CAM10');
const pickupCamera = CAMERAS.find(cam => cam.id === 'CAM11');
const corridorCamera = CAMERAS.find(cam => cam.id === 'CAM12');

// A primeira versão funciona como site estático: sem build, sem servidor de jogo e sem backend.
const $ = selector => document.querySelector(selector);
const dom = {
  game: $('#game'), office: $('#office-view'), cameras: $('#cameras-view'),
  officeScene: $('#office-scene'), officeMonitor: $('#office-monitor'), officeArt: $('#office-art'),
  officeCharacters: $('#office-characters'),
  feedArt: $('#feed-art'), tech: $('#technical-feed'),
  techArt: $('#technical-art'), techNumber: $('#technical-number'),
  camNumber: $('#cam-number'), camRoom: $('#cam-room'), flash: $('#camera-switch-flash'),
  clock: $('#clock-label'), handle: $('#monitor-handle'), handleLabel: $('#handle-label'),
  hint: $('#initial-hint'),
  toast: $('#toast'), complete: $('#shift-complete'), restart: $('#restart-shift')
};

const HOURS_PER_SHIFT = 6;
const SECONDS_PER_HOUR = 90;
const TOTAL_SHIFT_SECONDS = HOURS_PER_SHIFT * SECONDS_PER_HOUR;
const sound = new SoundEngine();
let audioReady;
// Browsers unlock audio after the first interaction with the game.
for (const event of ['click', 'keydown']) {
  document.addEventListener(event, () => { audioReady ??= sound.enable(); }, { capture: true, once: true });
}

function playSound(effect) {
  if (sound.enabled) sound[effect]();
  else audioReady?.then(enabled => { if (enabled) sound[effect](); });
}
const state = {
  mode: 'office', cameraIndex: 0, characterStates: new Map(), elapsed: 0,
  officeRoom: new Set(),
  complete: false, flashlight: false, pan: 0, targetPan: 0,
  dragging: false, pointerX: null, lastFrame: performance.now()
};
let toastTimeout;
let flashTimeout;
let nextHudUpdate = 0;
const imageCache = new Map();

const officeLayers = ['doorway', 'room'].flatMap(location => OFFICE.characters.map(character => {
  const image = document.createElement('img');
  image.className = 'office-character';
  image.alt = '';
  image.draggable = false;
  image.hidden = true;
  dom.officeCharacters.append(image);
  return { location, character, image };
}));

function announce(message) {
  clearTimeout(toastTimeout);
  dom.toast.textContent = message;
  dom.toast.classList.add('show');
  toastTimeout = setTimeout(() => dom.toast.classList.remove('show'), 2350);
}

function preloadCamera(cam) {
  if (!cam?.image) return;
  const sources = cam.gateStateImages ? Object.values(cam.gateStateImages.images) : [cameraImage(cam)];
  preloadImages(sources);
}

function preloadImages(sources) {
  for (const source of sources) {
    if (imageCache.has(source)) continue;
    const image = new Image();
    image.decoding = 'async';
    image.src = source;
    imageCache.set(source, image);
  }
}

const map = makeCameraMap({
  canvas: $('#map-canvas'),
  canToggleGate: () => state.mode === 'cameras' && !state.complete,
  onGatesChange: () => {
    updateOfficeView();
    const cam = CAMERAS[state.cameraIndex];
    if (cam.gateStateImages) updateCameraFeed(cam);
  },
  onSelect: id => {
    if (state.complete) return;
    changeCamera(id, true);
  }
});

function updateOfficeView() {
  const closed = map.isGateClosed(OFFICE.gate);
  if (closed || state.officeRoom.size) state.flashlight = false;
  const view = closed ? 'closed' : state.flashlight ? 'lit' : 'dark';
  dom.office.dataset.gate = closed ? 'closed' : 'open';
  dom.office.dataset.flashlight = String(state.flashlight);
  const source = OFFICE.images[view];
  if (dom.officeArt.getAttribute('src') !== source) dom.officeArt.src = source;
  dom.officeArt.alt = closed
    ? 'Escritório de segurança, portão principal fechado'
    : state.flashlight
      ? 'Escritório de segurança, portão aberto e corredor iluminado por luz circular'
      : 'Escritório de segurança, portão principal aberto e corredor escuro';
}

function setOfficeCharacterState(room = [], doorway = null) {
  if (!Array.isArray(room) || room.length > 3) return false;
  const selected = new Set(room);
  if (selected.size !== room.length || [...selected].some(character => !OFFICE.characters.includes(character))) {
    return false;
  }
  if (doorway !== null && (!OFFICE.characters.includes(doorway) || selected.has(doorway))) {
    return false;
  }
  state.officeRoom = selected;
  for (const { location, character, image } of officeLayers) {
    const visible = location === 'room' ? selected.has(character) : doorway === character;
    if (visible && !image.getAttribute('src')) {
      image.src = `./public/images/office/characters/${location}/${character}.webp`;
    }
    image.hidden = !visible;
  }
  updateOfficeView();
  return true;
}

function showTechnical(cam) {
  dom.feedArt.hidden = true;
  dom.tech.hidden = false;
  dom.techArt.src = cam.technical;
  dom.techNumber.textContent = cam.id.replace('CAM', 'CAM ');
}

function characterStateImages(cam) {
  return cam.characterStateImages ?? cam.stageStateImages;
}

function cameraImage(cam) {
  const views = cam.gateStateImages;
  const characters = characterStateImages(cam)?.[state.characterStates.get(cam.id)];
  if (!views) return characters ?? cam.image;
  const key = views.gates.map(id => map.isGateClosed(id) ? 'closed' : 'open').join('-');
  return characters?.[key] ?? views.images[key] ?? cam.image;
}

// Seleção explícita para o código do jogo. Use "vazia" para restaurar a imagem padrão.
function setCameraCharacterState(cam, key) {
  if (typeof key !== 'string' || (key !== 'vazia' && !Object.hasOwn(characterStateImages(cam), key))) {
    return false;
  }
  state.characterStates.set(cam.id, key);
  if (CAMERAS[state.cameraIndex] === cam) updateCameraFeed(cam);
  return true;
}

function updateCameraFeed(cam) {
  const source = cameraImage(cam);
  if (!source) {
    showTechnical(cam);
    return;
  }
  dom.tech.hidden = true;
  dom.feedArt.hidden = false;
  dom.feedArt.alt = `Câmera ${cam.id}: ${cam.name}, cenário noturno`;
  dom.feedArt.onerror = () => {
    if (CAMERAS[state.cameraIndex].id === cam.id && dom.feedArt.getAttribute('src') === source) {
      showTechnical(cam);
      announce(`${cam.id}: imagem não encontrada; exibindo a planta técnica`);
    }
  };
  if (dom.feedArt.getAttribute('src') !== source) dom.feedArt.src = source;
  else if (dom.feedArt.complete && dom.feedArt.naturalWidth === 0) showTechnical(cam);
}

function changeCamera(id, withSound = false) {
  const index = CAMERAS.findIndex(camera => camera.id === id);
  if (index < 0) return;
  const changed = state.cameraIndex !== index;
  state.cameraIndex = index;
  const cam = CAMERAS[index];
  dom.camNumber.textContent = cam.id.replace('CAM', 'CAM ');
  dom.camRoom.textContent = cam.name.toUpperCase();
  map.setActive(cam);

  updateCameraFeed(cam);
  preloadCamera(cam);

  clearTimeout(flashTimeout);
  dom.flash.classList.remove('active');
  // Restart CSS animation even when switching quickly.
  void dom.flash.offsetWidth;
  dom.flash.classList.add('active');
  flashTimeout = setTimeout(() => dom.flash.classList.remove('active'), 360);
  if (withSound && changed) playSound('switch');
  preloadCamera(CAMERAS[(index + 1) % CAMERAS.length]);
}

function setMode(mode) {
  if (state.complete || state.mode === mode) return;
  const watching = mode === 'cameras';
  state.mode = mode;
  dom.game.dataset.mode = mode;
  dom.office.hidden = watching;
  dom.cameras.hidden = !watching;
  dom.handleLabel.textContent = watching ? 'ABAIXAR MONITOR' : 'ABRIR MONITOR';
  dom.handle.setAttribute('aria-label', watching ? 'Abaixar o monitor para voltar ao escritório' : 'Abrir câmeras de segurança');
  dom.hint.hidden = true;
  state.dragging = false;
  state.pointerX = null;
  state.flashlight = false;
  updateOfficeView();
  playSound('monitor');
  if (watching) {
    changeCamera(CAMERAS[state.cameraIndex].id);
    preloadCamera(CAMERAS[0]);
  }
}

function toggleMonitor() { setMode(state.mode === 'office' ? 'cameras' : 'office'); }

function cycleCamera(direction) {
  const next = (state.cameraIndex + direction + CAMERAS.length) % CAMERAS.length;
  changeCamera(CAMERAS[next].id, true);
}

function updateClockUI() {
  const hours = Math.floor(state.elapsed / SECONDS_PER_HOUR);
  const label = hours === 0 ? '12' : String(Math.min(6, hours));
  dom.clock.innerHTML = `${label} <small>AM</small>`;
}

function finishShift() {
  state.complete = true;
  dom.complete.hidden = false;
  playSound('finish');
}

function resetShift() {
  state.elapsed = 0;
  state.flashlight = false;
  setOfficeCharacterState();
  map.resetGates();
  state.complete = false;
  state.mode = 'cameras'; // Force setMode to apply the initial office state.
  dom.complete.hidden = true;
  setMode('office');
  updateClockUI();
}

function maxPanShift() {
  // The office panorama is exactly 2172:724 (3:1), never distorted.
  return Math.max(0, (dom.officeScene.offsetWidth - dom.game.clientWidth) / 2);
}

function setEdgePan(clientX) {
  if (state.dragging) return;
  const bounds = dom.game.getBoundingClientRect();
  const ratio = Math.max(0, Math.min(1, (clientX - bounds.left) / bounds.width));
  let signed = 0;
  const edge = .17;
  if (ratio < edge) signed = (edge - ratio) / edge;
  else if (ratio > 1 - edge) signed = -(ratio - (1 - edge)) / edge;
  state.targetPan = signed * maxPanShift() * .95;
}

function moveCamera(dt) {
  const speed = Math.min(1, dt * .008);
  state.pan += (state.targetPan - state.pan) * speed;
  if (Math.abs(state.pan - state.targetPan) < .3) state.pan = state.targetPan;
  dom.officeScene.style.setProperty('--pan-shift', `${Math.round(state.pan)}px`);
}

function tick(now) {
  const delta = Math.max(0, Math.min(100, now - state.lastFrame));
  state.lastFrame = now;
  if (!state.complete && !document.hidden) {
    const seconds = delta / 1000;
    state.elapsed += seconds;
    if (now >= nextHudUpdate) {
      updateClockUI();
      nextHudUpdate = now + 200;
    }
    if (state.elapsed >= TOTAL_SHIFT_SECONDS) finishShift();
  }
  moveCamera(delta);
  requestAnimationFrame(tick);
}

dom.officeMonitor.addEventListener('click', () => setMode('cameras'));
dom.handle.addEventListener('click', toggleMonitor);
dom.restart.addEventListener('click', resetShift);

dom.office.addEventListener('pointermove', event => {
  if (event.pointerType === 'touch') {
    if (!state.dragging) return;
    const change = event.clientX - state.pointerX;
    state.pointerX = event.clientX;
    state.targetPan = Math.max(-maxPanShift(), Math.min(maxPanShift(), state.targetPan + change));
    return;
  }
  if (!state.dragging) setEdgePan(event.clientX);
});
dom.office.addEventListener('pointerleave', () => {
  if (!state.dragging) state.targetPan = 0;
});
dom.office.addEventListener('pointerdown', event => {
  if (event.pointerType !== 'touch' || event.target.closest('button')) return;
  state.dragging = true;
  state.pointerX = event.clientX;
  dom.office.setPointerCapture(event.pointerId);
});
for (const eventName of ['pointerup','pointercancel']) dom.office.addEventListener(eventName, () => { state.dragging = false; });

const panKeys = new Set();
document.addEventListener('keydown', event => {
  if (state.complete || event.altKey || event.ctrlKey || event.metaKey) return;
  const key = event.key.toLowerCase();
  const focusedButton = event.target instanceof Element && Boolean(event.target.closest('button, [role="button"]'));
  if ((key === ' ' && !focusedButton) || key === 'm') {
    event.preventDefault();
    if (!event.repeat) toggleMonitor();
  } else if (key === 'f' && state.mode === 'office') {
    event.preventDefault();
    if (!event.repeat && !state.officeRoom.size && !map.isGateClosed(OFFICE.gate)) {
      state.flashlight = !state.flashlight;
      updateOfficeView();
    }
  } else if (key === 'escape') {
    if (state.mode === 'cameras') {
      event.preventDefault();
      setMode('office');
    }
  } else if (key === 'arrowleft' || key === 'arrowright') {
    event.preventDefault();
    if (state.mode === 'cameras') cycleCamera(key === 'arrowright' ? 1 : -1);
    else {
      panKeys.add(key);
      state.targetPan = maxPanShift() * (key === 'arrowleft' ? .9 : -.9);
    }
  } else if (state.mode === 'office' && (key === 'a' || key === 'd')) {
    panKeys.add(key);
    state.targetPan = maxPanShift() * (key === 'a' ? .9 : -.9);
  }
});
document.addEventListener('keyup', event => {
  const key = event.key.toLowerCase();
  if (panKeys.delete(key) && state.mode === 'office' && panKeys.size === 0) state.targetPan = 0;
});
window.addEventListener('blur', () => {
  panKeys.clear();
  state.targetPan = 0;
  state.flashlight = false;
  updateOfficeView();
});
const resizeObserver = new ResizeObserver(() => {
  const limit = maxPanShift();
  state.targetPan = Math.min(limit, Math.max(-limit, state.targetPan));
  state.pan = Math.min(limit, Math.max(-limit, state.pan));
});
resizeObserver.observe(dom.game);

// The site opens directly inside the office: no menu or splash screen.
window.NathGame.setCam01ShopState = key => setCameraCharacterState(shopCamera, key);
window.NathGame.setCam02ReceptionState = key => setCameraCharacterState(receptionCamera, key);
window.NathGame.setCam03StageState = key => setCameraCharacterState(stageCamera, key);
window.NathGame.setCam04HallState = key => setCameraCharacterState(hallCamera, key);
window.NathGame.setCam05VipState = key => setCameraCharacterState(vip1Camera, key);
window.NathGame.setCam06VipState = key => setCameraCharacterState(vip2Camera, key);
window.NathGame.setCam07ArcadeState = key => setCameraCharacterState(arcadeCamera, key);
window.NathGame.setCam08StockroomState = key => setCameraCharacterState(stockroomCamera, key);
window.NathGame.setCam10KitchenState = key => setCameraCharacterState(kitchenCamera, key);
window.NathGame.setCam11PickupState = key => setCameraCharacterState(pickupCamera, key);
window.NathGame.setCam12CorridorState = key => setCameraCharacterState(corridorCamera, key);
window.NathGame.setOfficeCharacterState = setOfficeCharacterState;
changeCamera(CAMERAS[0].id);
updateOfficeView();
preloadImages(Object.values(OFFICE.images));
// Load state variants before the player starts toggling their gates.
for (const cam of CAMERAS) if (cam.gateStateImages) preloadCamera(cam);
updateClockUI();
requestAnimationFrame(tick);

})();
