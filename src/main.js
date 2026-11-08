(() => {
'use strict';
const {
  CAMERAS, OFFICE, makeCameraMap, SoundEngine, createMovement,
  cameraStateKey, cameraFrame, characterStateImages, officeCharacterImage
} = window.NathGame;
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
const titleScreen = $('#title-screen');
const startGame = $('#start-game');
const menuMusic = $('#menu-music');
const dom = {
  game: $('#game'), office: $('#office-view'), cameras: $('#cameras-view'),
  playfield: $('#playfield'), scareArt: $('#jumpscare-art'),
  gameOver: $('#game-over'), returnToMenu: $('#return-to-menu'), scareSound: $('#jumpscare-sound'),
  officeScene: $('#office-scene'), officeMonitor: $('#office-monitor'), officeArt: $('#office-art'),
  officeCharacters: $('#office-characters'), officeCloset: $('#office-closet'),
  closet: $('#closet-view'), closetExit: $('#closet-exit'), closetLight: $('#closet-light'),
  closetDoorArt: $('#closet-door-art'), closetBeam: $('#closet-beam'), closetBlackout: $('#closet-blackout'),
  feedArt: $('#feed-art'), tech: $('#technical-feed'),
  techArt: $('#technical-art'), techNumber: $('#technical-number'),
  camNumber: $('#cam-number'), camRoom: $('#cam-room'), flash: $('#camera-switch-flash'),
  clock: $('#clock-label'), handle: $('#monitor-handle'), handleLabel: $('#handle-label'),
  hint: $('#initial-hint'),
  toast: $('#toast'), complete: $('#shift-complete'), restart: $('#restart-shift'),
  debug: $('#movement-debug')
};

const HOURS_PER_SHIFT = 6;
const SECONDS_PER_HOUR = 90;
const TOTAL_SHIFT_SECONDS = HOURS_PER_SHIFT * SECONDS_PER_HOUR;
const MENU_MUSIC_START = 27;
const MENU_MUSIC_FADE_SECONDS = 2;
const MENU_MUSIC_INITIAL_VOLUME = .08;
const MENU_MUSIC_VOLUME = .58;
const CLOWN_RIGHT_IMAGE = './public/images/jumpscares/palhaca-direita.gif';
const CLOWN_BOTTOM_IMAGE = './public/images/jumpscares/palhaca-baixo.gif';
const JUMPSCARE_IMAGES = ['original', 'yandere', 'gotica', 'maid', 'platinada']
  .map(character => `./public/images/jumpscares/${character}.gif`)
  .concat(CLOWN_RIGHT_IMAGE);
const BLACKOUT_MS = 110;
const GIF_CYCLE_MS = 960; // 48 quadros de 20 ms.
const CLOWN_BOTTOM_CYCLE_MS = 1280; // 16 quadros de 80 ms.
const FINAL_FRAME_HOLD_MS = 250;
const DEATH_FLASH_MS = 230;
const JUMPSCARE_VOLUME = .55;
const CLOSET_TRANSITIONS = {
  enter: { swap: 980, duration: 1450 },
  turn: { swap: 320, duration: 640 },
  exit: { swap: 650, duration: 1040 }
};
const sound = new SoundEngine();
let audioReady;
// Browsers unlock audio after the first interaction with the game.
for (const event of ['click', 'keydown']) {
  document.addEventListener(event, () => { audioReady ??= sound.enable(); }, { capture: true, once: true });
}

function playSound(effect, ...args) {
  if (sound.enabled) sound[effect](...args);
  else audioReady?.then(enabled => { if (enabled) sound[effect](...args); });
}

function fadeMenuMusic() {
  if (titleScreen.hidden) return;
  const progress = Math.min(1, Math.max(0, (menuMusic.currentTime - MENU_MUSIC_START) / MENU_MUSIC_FADE_SECONDS));
  menuMusic.volume = MENU_MUSIC_INITIAL_VOLUME + (MENU_MUSIC_VOLUME - MENU_MUSIC_INITIAL_VOLUME) * progress;
  if (progress < 1) requestAnimationFrame(fadeMenuMusic);
}

const state = {
  mode: 'office', cameraIndex: 0, characterPreviews: new Map(), elapsed: 0, movementTime: 0,
  officeRoom: new Set(), officeDoorway: null,
  complete: false, flashlight: false, pan: 0, targetPan: 0,
  dragging: false, pointerX: null, lastFrame: performance.now(),
  closetTransition: null, closetMouseAtEdge: true, closetTouchX: null
};
let toastTimeout;
let flashTimeout;
let nextHudUpdate = 0;
let defeatDeadline = 0;
let scareReplay = 0;
const playedScares = new Set();
const imageCache = new Map();
const debugEnabled = window.location && new URLSearchParams(window.location.search).get('debug') === '1';
dom.debug.hidden = !debugEnabled;

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
    if (!source || imageCache.has(source)) continue;
    const image = new Image();
    image.decoding = 'async';
    image.onerror = () => console.warn(`[FNAN] Imagem indisponível: ${source}`);
    imageCache.set(source, image);
    image.src = source;
  }
}

function imageStatus(source) {
  preloadImages([source]);
  const image = imageCache.get(source);
  if (!image.complete) return 'pending';
  return image.naturalWidth > 0 ? 'ready' : 'missing';
}

const map = makeCameraMap({
  canvas: $('#map-canvas'),
  canToggleGate: () => state.mode === 'cameras' && !state.complete,
  onGatesChange: () => {
    updateOfficeView();
    const cam = CAMERAS[state.cameraIndex];
    if (cam.gateStateImages) updateCameraFeed(cam);
    updateMovementDebug();
  },
  onSelect: id => {
    if (state.complete) return;
    changeCamera(id, true);
  }
});
const movement = createMovement({
  isGateClosed: map.isGateClosed,
  imageStatus,
  log(message, warning) {
    if (!debugEnabled) return;
    if (warning) console.warn(`[FNAN] ${message}`);
    else console.info(`[FNAN] ${message}`);
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

  const room = OFFICE.characters.filter(character => state.officeRoom.has(character)).join('-') || 'vazia';
  const doorway = OFFICE.doorwayCharacters.includes(state.officeDoorway) ? state.officeDoorway : 'vazia';
  const gate = closed ? 'closed' : 'open';
  const closetSource = `./public/images/office/closet/states/${gate}/sala-${room}--porta-${doorway}.webp`;
  if (dom.closetDoorArt.getAttribute('src') !== closetSource) dom.closetDoorArt.src = closetSource;
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
  state.officeDoorway = doorway;
  for (const { location, character, image } of officeLayers) {
    const visible = location === 'room' ? selected.has(character) : doorway === character;
    if (visible && !image.getAttribute('src')) {
      image.src = officeCharacterImage(location, character);
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

function currentCameraFrame(cam) {
  const key = state.characterPreviews.get(cam.id) ?? cameraStateKey(cam, movement.occupants(cam.room));
  return cameraFrame(cam, key, map.isGateClosed);
}

function cameraImage(cam) {
  return currentCameraFrame(cam).source;
}

// Prévia manual de arte, descartada na próxima alteração de ocupação da sala.
function setCameraCharacterState(cam, key) {
  if (typeof key !== 'string' || (key !== 'vazia' && !Object.hasOwn(characterStateImages(cam), key))) {
    return false;
  }
  state.characterPreviews.set(cam.id, key);
  if (CAMERAS[state.cameraIndex] === cam) updateCameraFeed(cam);
  updateMovementDebug();
  return true;
}

function updateCameraFeed(cam) {
  const source = cameraImage(cam);
  if (!source) {
    showTechnical(cam);
    console.warn(`[FNAN] ${cam.id}: combinação sem imagem para a configuração atual.`);
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

function observedRoom() {
  return state.mode === 'cameras' ? CAMERAS[state.cameraIndex].room : null;
}

function updateMovementDebug() {
  if (!debugEnabled) return;
  const cam = CAMERAS[state.cameraIndex];
  const { key, gateKey, source } = currentCameraFrame(cam);
  const feed = state.mode === 'cameras'
    ? `${cam.id} · ${key ?? 'sem estado'}${gateKey ? ` · ${gateKey}` : ''}${!source || dom.feedArt.hidden ? ' · planta técnica' : ''}`
    : 'Monitor abaixado';
  const lines = movement.diagnostics(state.movementTime, observedRoom()).map(actor => {
    const status = state.complete ? 'turno encerrado' : actor.stopped;
    return `${actor.name} · ${actor.location} · ${actor.camera} · ${(actor.remaining / 1000).toFixed(1)} s\n`
      + `  Anterior: ${actor.previous ?? '—'} | Destino: ${actor.destination ?? '—'}\n`
      + `  ${status}${actor.representation ? ` · ${actor.representation}` : ''}`;
  });
  dom.debug.textContent = [`IA VISUAL · ${feed}`, ...lines].join('\n');
}

function syncMovement(changed) {
  if (!changed.size) return;
  for (const cam of CAMERAS) {
    if (changed.has(cam.room)) state.characterPreviews.delete(cam.id);
  }
  const cam = CAMERAS[state.cameraIndex];
  if (changed.has(cam.room)) updateCameraFeed(cam);
  if (changed.has(OFFICE.room)) {
    const { room, doorway } = movement.officeState();
    setOfficeCharacterState(room, doorway);
  }
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
  updateMovementDebug();
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

function setMode(mode, withSound = true) {
  if (state.complete || state.mode === mode) return;
  const watching = mode === 'cameras';
  const hiding = mode === 'closet';
  state.mode = mode;
  dom.game.dataset.mode = mode;
  dom.office.hidden = mode !== 'office';
  dom.cameras.hidden = !watching;
  dom.closet.hidden = !hiding;
  dom.handle.hidden = hiding;
  dom.handleLabel.textContent = watching ? 'ABAIXAR MONITOR' : 'ABRIR MONITOR';
  dom.handle.setAttribute('aria-label', watching ? 'Abaixar o monitor para voltar ao escritório' : 'Abrir câmeras de segurança');
  dom.hint.hidden = true;
  state.dragging = false;
  state.pointerX = null;
  state.flashlight = false;
  updateOfficeView();
  if (withSound) playSound('monitor');
  if (watching) {
    changeCamera(CAMERAS[state.cameraIndex].id);
    preloadCamera(CAMERAS[0]);
  }
  updateMovementDebug();
}

function toggleMonitor() {
  if (state.mode === 'closet' || state.closetTransition) return;
  setMode(state.mode === 'office' ? 'cameras' : 'office');
}

function setClosetLight(on) {
  dom.closetBeam.hidden = !on;
  dom.closetLight.setAttribute('aria-pressed', String(on));
}

function setClosetView(view) {
  dom.closet.dataset.view = view;
  dom.closetExit.hidden = view !== 'door';
  dom.closetLight.hidden = view !== 'back';
  setClosetLight(false);
  if (state.mode === 'closet') dom.closet.focus({ preventScroll: true });
}

function toggleClosetLight() {
  if (state.complete || state.closetTransition || state.mode !== 'closet' || dom.closet.dataset.view !== 'back') return;
  setClosetLight(dom.closetBeam.hidden);
}

function beginClosetTransition(kind) {
  const expectedMode = kind === 'enter' ? 'office' : 'closet';
  if (state.complete || state.closetTransition || state.mode !== expectedMode) return;
  if (kind === 'exit' && dom.closet.dataset.view !== 'door') return;

  const now = performance.now();
  const { swap, duration } = CLOSET_TRANSITIONS[kind];
  state.closetTransition = { kind, swapAt: now + swap, endAt: now + duration };
  state.closetTouchX = null;
  state.dragging = false;
  state.targetPan = state.pan;
  panKeys.clear();
  dom.game.style.setProperty('--closet-duration', `${duration}ms`);
  // Restart the CSS animation if a new action follows the previous one immediately.
  void dom.closetBlackout.offsetWidth;
  dom.game.dataset.closetTransition = kind;
  if (kind !== 'turn') playSound('closetDoor', kind === 'enter');
}

function clearClosetTransition() {
  state.closetTransition = null;
  delete dom.game.dataset.closetTransition;
}

function advanceClosetTransition(now) {
  const transition = state.closetTransition;
  if (!transition) return;
  if (now >= transition.swapAt) {
    transition.swapAt = Infinity;
    switch (transition.kind) {
      case 'enter':
        state.closetMouseAtEdge = true;
        setMode('closet', false);
        setClosetView('door');
        break;
      case 'turn':
        setClosetView(dom.closet.dataset.view === 'door' ? 'back' : 'door');
        break;
      case 'exit':
        setMode('office', false);
        state.pan = state.targetPan = -maxPanShift() * .95;
        dom.officeCloset.focus({ preventScroll: true });
        break;
    }
  }
  if (now >= transition.endAt) clearClosetTransition();
}

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
  clearClosetTransition();
  dom.complete.hidden = false;
  playSound('finish');
}

function beginJumpscare() {
  const insideCloset = state.mode === 'closet';
  const source = insideCloset
    ? CLOWN_BOTTOM_IMAGE
    : JUMPSCARE_IMAGES[Math.floor(Math.random() * JUMPSCARE_IMAGES.length)];
  if (insideCloset) {
    dom.game.dataset.scare = 'clown-bottom';
    setClosetLight(false);
  } else if (source === CLOWN_RIGHT_IMAGE) {
    setMode('office', false);
  }
  state.complete = true;
  state.dragging = false;
  panKeys.clear();
  clearClosetTransition();
  dom.playfield.inert = true;
  // A fresh image request restarts a one-shot GIF the browser has already finished.
  dom.scareArt.src = playedScares.has(source) ? `${source}?replay=${++scareReplay}` : source;
  playedScares.add(source);
  setDefeatPhase('blackout', performance.now() + BLACKOUT_MS);
  dom.scareSound.currentTime = 0;
  dom.scareSound.volume = JUMPSCARE_VOLUME;
  dom.scareSound.play().catch(() => {});
}

function setDefeatPhase(phase, deadline) {
  dom.game.dataset.defeat = phase;
  defeatDeadline = deadline;
}

function advanceDefeat(now) {
  if (now < defeatDeadline) return;
  switch (dom.game.dataset.defeat) {
    case 'blackout':
      // Give a cold load time to arrive, but always reach Game Over.
      if (!dom.scareArt.complete && now < defeatDeadline + 2000) return;
      if (dom.scareArt.naturalWidth > 0) {
        const cycle = dom.game.dataset.scare === 'clown-bottom' ? CLOWN_BOTTOM_CYCLE_MS : GIF_CYCLE_MS;
        setDefeatPhase('scare', now + cycle + FINAL_FRAME_HOLD_MS);
        break;
      }
      // Missing art still leads to the flash and the end of the night.
    case 'scare':
      setDefeatPhase('flash', now + DEATH_FLASH_MS);
      dom.scareArt.removeAttribute('src');
      break;
    case 'flash':
      dom.game.dataset.defeat = 'over';
      dom.gameOver.hidden = false;
      dom.returnToMenu.focus();
      break;
  }
}

function resetShift() {
  state.elapsed = 0;
  state.movementTime = 0;
  state.lastFrame = performance.now();
  nextHudUpdate = 0;
  movement.reset();
  state.characterPreviews.clear();
  state.flashlight = false;
  clearClosetTransition();
  setClosetView('door');
  panKeys.clear();
  state.pan = state.targetPan = 0;
  dom.officeScene.style.setProperty('--pan-shift', '0px');
  setOfficeCharacterState();
  map.resetGates();
  state.complete = false;
  state.mode = 'cameras'; // Force setMode to apply the initial office state.
  dom.complete.hidden = true;
  setMode('office', false);
  updateCameraFeed(CAMERAS[state.cameraIndex]);
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
  const realDelta = Math.max(0, now - state.lastFrame);
  const delta = Math.min(100, realDelta);
  state.lastFrame = now;
  if (!state.complete && !document.hidden) {
    const seconds = delta / 1000;
    state.elapsed += seconds;
    if (state.elapsed >= TOTAL_SHIFT_SECONDS) finishShift();
    else {
      state.movementTime += realDelta;
      syncMovement(movement.advance(state.movementTime, observedRoom()));
    }
    if (now >= nextHudUpdate) {
      updateClockUI();
      updateMovementDebug();
      nextHudUpdate = now + 200;
    }
  }
  if (dom.game.dataset.defeat) advanceDefeat(now);
  else {
    advanceClosetTransition(now);
    if (state.mode !== 'closet') moveCamera(delta);
  }
  if (dom.game.dataset.defeat !== 'over') requestAnimationFrame(tick);
}

document.addEventListener('visibilitychange', () => { state.lastFrame = performance.now(); });
dom.officeMonitor.addEventListener('click', () => {
  if (state.mode === 'office') toggleMonitor();
});
dom.officeCloset.addEventListener('click', () => beginClosetTransition('enter'));
dom.closetExit.addEventListener('click', () => beginClosetTransition('exit'));
dom.closetLight.addEventListener('click', toggleClosetLight);
dom.handle.addEventListener('click', toggleMonitor);
dom.restart.addEventListener('click', resetShift);
dom.returnToMenu.addEventListener('click', () => {
  dom.scareSound.pause();
  dom.game.hidden = true;
  dom.gameOver.hidden = true;
  dom.playfield.inert = false;
  delete dom.game.dataset.defeat;
  delete dom.game.dataset.scare;
  showTitleScreen();
});

dom.office.addEventListener('pointermove', event => {
  if (state.closetTransition) return;
  if (event.pointerType === 'touch') {
    if (!state.dragging) return;
    const change = event.clientX - state.pointerX;
    state.pointerX = event.clientX;
    state.targetPan = Math.max(-maxPanShift(), Math.min(maxPanShift(), state.targetPan + change));
    return;
  }
  setEdgePan(event.clientX);
  // Keep the door under the pointer when it moves off the edge to click.
  if (event.target === dom.officeCloset) state.targetPan = Math.min(state.pan, state.targetPan);
});
dom.office.addEventListener('pointerleave', event => {
  if (event.pointerType !== 'touch' && !state.closetTransition && !state.dragging) state.targetPan = 0;
});
dom.office.addEventListener('pointerdown', event => {
  if (state.closetTransition || event.pointerType !== 'touch' || event.target.closest('button')) return;
  state.dragging = true;
  state.pointerX = event.clientX;
  dom.office.setPointerCapture(event.pointerId);
});
for (const eventName of ['pointerup','pointercancel']) dom.office.addEventListener(eventName, () => { state.dragging = false; });

dom.closet.addEventListener('pointermove', event => {
  if (event.pointerType !== 'mouse' || state.closetTransition) return;
  const bounds = dom.closet.getBoundingClientRect();
  const ratio = (event.clientX - bounds.left) / bounds.width;
  if (ratio > .25 && ratio < .75) state.closetMouseAtEdge = false;
  if (state.closetMouseAtEdge || (ratio > .12 && ratio < .88)) return;
  state.closetMouseAtEdge = true;
  beginClosetTransition('turn');
});
dom.closet.addEventListener('pointerdown', event => {
  if (event.pointerType === 'touch' && event.isPrimary && !state.closetTransition) state.closetTouchX = event.clientX;
});
dom.closet.addEventListener('pointerup', event => {
  if (event.pointerType !== 'touch' || !event.isPrimary || state.closetTouchX === null) return;
  const dx = event.clientX - state.closetTouchX;
  state.closetTouchX = null;
  if (Math.abs(dx) > 36) beginClosetTransition('turn');
});
dom.closet.addEventListener('pointercancel', () => { state.closetTouchX = null; });

const panKeys = new Set();
document.addEventListener('keydown', event => {
  if (dom.game.hidden || state.complete || event.altKey || event.ctrlKey || event.metaKey) return;
  const key = event.key.toLowerCase();
  if (key === 'j' && (!state.closetTransition || state.mode === 'closet')) {
    event.preventDefault();
    if (!event.repeat) beginJumpscare();
    return;
  }
  if (state.closetTransition) return;
  const focusedButton = event.target instanceof Element && Boolean(event.target.closest('button, [role="button"]'));
  if (state.mode === 'closet') {
    if (key === 'w') {
      event.preventDefault();
      if (!event.repeat) toggleClosetLight();
    } else if (['a', 'd', 'arrowleft', 'arrowright'].includes(key)) {
      event.preventDefault();
      if (!event.repeat) beginClosetTransition('turn');
    }
  } else if ((key === ' ' && !focusedButton) || key === 'm') {
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
  state.closetTouchX = null;
  setClosetLight(false);
  updateOfficeView();
});
const resizeObserver = new ResizeObserver(() => {
  const limit = maxPanShift();
  state.targetPan = Math.min(limit, Math.max(-limit, state.targetPan));
  state.pan = Math.min(limit, Math.max(-limit, state.pan));
});
resizeObserver.observe(dom.game);

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

function showTitleScreen() {
  titleScreen.hidden = false;
  menuMusic.currentTime = MENU_MUSIC_START;
  menuMusic.volume = MENU_MUSIC_INITIAL_VOLUME;
  menuMusic.addEventListener('playing', fadeMenuMusic, { once: true });
  menuMusic.play().catch(() => {});
  startGame.focus();
}

$('#enter-game').addEventListener('click', () => {
  $('#entry-screen').hidden = true;
  showTitleScreen();
  preloadImages([...JUMPSCARE_IMAGES, CLOWN_BOTTOM_IMAGE]);
}, { once: true });

startGame.addEventListener('click', () => {
  titleScreen.hidden = true;
  menuMusic.pause();
  dom.game.hidden = false;
  resetShift();
  changeCamera(CAMERAS[0].id);
  dom.hint.hidden = false;
  preloadImages(Object.values(OFFICE.images));
  // Load state variants before the player starts toggling their gates.
  for (const cam of CAMERAS) if (cam.gateStateImages) preloadCamera(cam);
  requestAnimationFrame(tick);
});

})();
