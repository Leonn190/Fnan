(async () => {
'use strict';
const {
  CAMERAS, OFFICE, makeCameraMap, SoundEngine, createMovement, createNightMenu,
  cameraActorFrame, characterStateImages, officeCharacterImage, corridorSlots, loadConfig,
  createImageCache, setImageSource, createCameraInterference
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
let config;
try {
  config = await loadConfig();
} catch (error) {
  const message = $('#config-error');
  message.textContent = error.message;
  message.hidden = false;
  console.error(error);
  return;
}
const { night, controls } = config;
const radioMusic = $('#radio-music');
const dom = {
  game: $('#game'), office: $('#office-view'), cameras: $('#cameras-view'), desktop: $('#computer-desktop'),
  playfield: $('#playfield'), scareArt: $('#jumpscare-art'),
  gameOver: $('#game-over'), returnToMenu: $('#return-to-menu'), scareSound: $('#jumpscare-sound'),
  officeScene: $('#office-scene'), officeMonitor: $('#office-monitor'), officeArt: $('#office-art'),
  officePower: $('#office-power'), desktopPower: $('#desktop-power'), shutdownDesktop: $('#shutdown-desktop'),
  officeCharacters: $('#office-characters'), corridorCharacters: $('#corridor-characters'),
  smoresVent: $('#smores-vent'), smoresRoom: $('#smores-room'),
  officeCloset: $('#office-closet'), officeRadio: $('#office-radio'),
  clownPeek: $('#clown-peek'), officeGate: $('#office-gate'), officeLight: $('#office-light'),
  closet: $('#closet-view'), closetExit: $('#closet-exit'), closetLight: $('#closet-light'),
  closetDoorArt: $('#closet-door-art'), closetBeam: $('#closet-beam'),
  closetExtra: $('#closet-extra'),
  feedArt: $('#feed-art'), tech: $('#technical-feed'),
  techArt: $('#technical-art'), techNumber: $('#technical-number'),
  camNumber: $('#cam-number'), cameraOffline: $('#camera-offline'), cameraAudio: $('#camera-audio'),
  static: $('#camera-static'), threatAlert: $('#threat-alert'),
  closeDesktop: $('#close-desktop'), openStart: $('#open-start'), startMenu: $('#start-menu'),
  taskTime: $('#task-time'), taskDate: $('#task-date'),
  clock: $('#clock-label'),
  resourceHud: $('#resource-hud'), sanityMeter: $('#sanity-meter'), sanityValue: $('#sanity-value'),
  energyMeter: $('#energy-meter'), energyValue: $('#energy-value'),
  shadowManifest: $('#shadow-manifest'), shadowOfficeArt: $('#shadow-office-art'),
  shadowFeed: $('#shadow-feed'), shadowSprite: $('#shadow-sprite'),
  hint: $('#initial-hint'),
  toast: $('#toast'), complete: $('#shift-complete'), restart: $('#restart-shift'),
  debug: $('#movement-debug')
};

const cameraApp = {
  panel: dom.cameras,
  task: $('#taskbar-cameras'),
  titlebar: $('#cameras-titlebar'),
  maximize: $('#maximize-cameras'),
  open: false
};
const desktopTime = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' });
const desktopDate = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
let lastDesktopMinute;

const CLOWN_RIGHT_IMAGE = './public/images/jumpscares/palhaca-direita.gif';
const CLOWN_BOTTOM_IMAGE = './public/images/jumpscares/palhaca-baixo.gif';
const SHADOW_IMAGE = config.shadow.jumpscare;
const CLOWN_ART = './public/images/office/closet/clown/';
const SMORES_ART = {
  vent: './public/images/office/characters/smores-vent.webp',
  room: './public/images/office/characters/smores-room.webp',
  closet: './public/images/Smores nas Frestas do Escritório.png'
};
const SMORES_VENT_CENTER = 1554;
const CLOWN_PHASES = [
  { art: 'sleeping.webp', alt: 'Palhaça dormindo no fundo do armário' },
  { art: 'eyes-lit.webp', alt: 'Palhaça sentada com os olhos acesos' },
  { art: 'standing.webp', alt: 'Palhaça em pé no fundo do armário' },
  { art: 'close-up.webp', alt: 'Palhaça de perto com os olhos pretos' }
];
const JUMPSCARE_IMAGES = ['original', 'yandere', 'gotica', 'maid', 'platinada']
  .map(character => `./public/images/jumpscares/${character}.gif`)
  .concat(CLOWN_RIGHT_IMAGE);
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

const state = {
  mode: 'office', computerMode: 'desktop', cameraIndex: 0, characterPreviews: new Map(), startedAt: 0,
  officeRoom: new Set(), officeDoorway: null,
  complete: true, flashlight: false, flashlightKey: false, flashlightPointer: null, pan: 0, targetPan: 0,
  dragging: false, pointerX: null, lastFrame: performance.now(),
  closetTransition: null, closetMouseAtEdge: true, closetTouchX: null,
  clownPhase: -1, radioPlaying: false,
  levels: {}, custom: false
};
let toastTimeout;
let nextHudUpdate = 0;
let nextDebugUpdate = 0;
let nextDesktopUpdate = 0;
let clockLabel;
let defeatDeadline = 0;
let scareReplay = 0;
let radioPlayback = null;
let radioMixPan;
let radioMixHiding;
const playedScares = new Set();
const imageCache = createImageCache(config.effects.imageCache);
const interference = createCameraInterference(dom.static, $('#camera-static-band'), dom.feedArt,
  () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
const signal = config.effects.static.visual;
const changedCameras = new Set();
const changedGates = new Set();
const positions = new Map(config.map.positions.map(position => [position.id, position]));
const officePositions = new Set([config.map.office, config.map.left, config.map.front, config.map.back]);
let movementChanged = false;
let officeChanged = false;
let officePreview = false;
let goticaStaticAt;
const params = new URLSearchParams(window.location?.search);
const debugEnabled = params.get('debug') === '1';
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
const closetExtras = OFFICE.characters.slice(3).map(id => {
  const image = document.createElement('img');
  image.className = 'closet-extra-layer';
  image.alt = '';
  image.hidden = true;
  dom.closetExtra.append(image);
  return { id, image };
});

const corridorSprites = [];
let corridorKey;
function setCorridorCharacters(front, back) {
  const key = `${front.join(',')}|${back.join(',')}`;
  if (key === corridorKey) return;
  corridorKey = key;
  const slots = corridorSlots(front, back);
  for (const [index, { slot, column }] of slots.entries()) {
    if (!corridorSprites[index]) {
      const sprite = document.createElement('span');
      corridorSprites.push(sprite);
      dom.corridorCharacters.append(sprite);
    }
    const sprite = corridorSprites[index];
    const position = `${column * 25}% ${slot * 25}%`;
    if (sprite.style.backgroundPosition !== position) sprite.style.backgroundPosition = position;
    sprite.hidden = false;
  }
  for (let index = slots.length; index < corridorSprites.length; index++) corridorSprites[index].hidden = true;
}

function setText(node, text) {
  if (node.textContent !== text) node.textContent = text;
}

function announce(message) {
  clearTimeout(toastTimeout);
  dom.toast.textContent = message;
  dom.toast.classList.add('show');
  toastTimeout = setTimeout(() => dom.toast.classList.remove('show'), 2350);
}

function warmCamera(cam, actors, source) {
  const alternatives = (cam.gateStateImages?.gates ?? []).map(gate =>
    cameraActorFrame(cam, actors, config, id => id === gate ? !movement.isGateClosed(id) : movement.isGateClosed(id),
      state.characterPreviews.get(cam.id)).source);
  imageCache.warm(alternatives.filter(alternative => alternative !== source));
  imageCache.touch(source);
}

const map = makeCameraMap({
  canvas: $('#map-canvas'),
  onToggleGate(id) {
    if (state.mode === 'cameras') advanceGame(performance.now(), { type: 'gate', id });
  },
  onSelect(id) {
    if (!state.complete) changeCamera(id, true);
  }
});
const movement = createMovement(config, {
  emit(event, value) {
    if (event === 'move') {
      movementChanged = true;
      officeChanged ||= officePositions.has(value.from) || officePositions.has(value.to);
      if (value.to === config.map.left && value.from !== value.to) sound.playSample('doorCreak');
      for (const position of [positions.get(value.from), positions.get(value.to)]) {
        for (const id of position.cameras) changedCameras.add(id);
      }
    } else if (event === 'smores') {
      officeChanged = true;
      if (value === 'vent') sound.playSample('vent');
    } else if (event === 'gatesChanged') {
      for (const { id, closed } of value) {
        map.setGate(id, closed);
        changedGates.add(id);
        if (id === OFFICE.gate && closed && state.mode === 'office') sound.playSample('officeGateClose');
      }
    } else if (event === 'cameraInterference') {
      goticaStaticAt = state.startedAt + value * 1000;
    } else if (event === 'electricalFault') {
      announce('Falha elétrica. Desligue e ligue o computador.');
    } else if (event === 'electricalRestored') {
      sound.playSample('reboot', .35);
      announce('Sinal e controle dos portões restaurados.');
    } else if (event === 'loss') {
      if (value === 'shadow') beginJumpscare(SHADOW_IMAGE);
      else if (value === 'palhaca') {
        beginJumpscare(movement.snapshot().hidden ? CLOWN_BOTTOM_IMAGE : CLOWN_RIGHT_IMAGE);
      } else {
        beginJumpscare(`./public/images/jumpscares/${config.characters[value].artId}.gif`);
      }
    } else if (event === 'win') {
      finishShift();
    }
  }
});

let officeViewKey;
let closetArtKey;
function updateOfficeView() {
  const closed = movement.isGateClosed(OFFICE.gate);
  const lightBlocked = closed || state.officeRoom.size > 0;
  if (lightBlocked && state.flashlight) {
    state.flashlight = state.flashlightKey = false;
    state.flashlightPointer = null;
  }
  const illuminated = state.flashlight && corridorInView();
  const view = closed ? 'closed' : illuminated ? 'lit' : 'dark';
  const doorsOnline = !movement.electricalFault();
  const viewKey = `${view}|${doorsOnline}|${lightBlocked}|${state.flashlight}`;
  if (viewKey !== officeViewKey) {
    officeViewKey = viewKey;
    dom.office.dataset.gate = closed ? 'closed' : 'open';
    dom.office.dataset.flashlight = String(illuminated);
    dom.officeGate.setAttribute('aria-pressed', String(closed));
    dom.officeGate.disabled = !doorsOnline;
    dom.officeLight.setAttribute('aria-pressed', String(state.flashlight));
    dom.officeLight.disabled = lightBlocked;
    dom.corridorCharacters.hidden = !illuminated;
    setImageSource(dom.officeArt, OFFICE.images[view]);
    dom.officeArt.alt = closed
      ? 'Escritório de segurança, portão principal fechado'
      : illuminated
        ? 'Escritório de segurança, portão aberto e corredor iluminado por luz circular'
        : 'Escritório de segurança, portão principal aberto e corredor escuro';
  }

  const smoresInRoom = !dom.smoresRoom.hidden;
  const artKey = `${closed}|${[...state.officeRoom].sort().join(',')}|${state.officeDoorway}|${smoresInRoom}`;
  if (artKey === closetArtKey) return;
  closetArtKey = artKey;
  const occupants = OFFICE.characters.filter(character => state.officeRoom.has(character));
  const room = occupants.slice(0, 3).join('-') || 'vazia';
  const doorway = OFFICE.doorwayCharacters.includes(state.officeDoorway) ? state.officeDoorway : 'vazia';
  const gate = closed ? 'closed' : 'open';
  const closetSource = smoresInRoom ? SMORES_ART.closet
    : `./public/images/office/closet/states/${gate}/sala-${room}--porta-${doorway}.webp`;
  setImageSource(dom.closetDoorArt, closetSource);
  dom.closetDoorArt.alt = smoresInRoom ? 'Smores visto pelas frestas da porta'
    : 'Escritório de segurança visto pelas frestas da porta';
  dom.closetExtra.hidden = smoresInRoom;
  for (const { id, image } of closetExtras) {
    const visible = occupants.indexOf(id) >= 3;
    if (visible && !image.getAttribute('src')) image.src = `./public/images/office/closet/layers/${id}.webp`;
    image.hidden = !visible;
  }
}

function setOfficeCharacterState(room = [], doorway = null) {
  if (!Array.isArray(room)) return false;
  const selected = new Set(room);
  if (selected.size !== room.length || [...selected].some(character => !OFFICE.characters.includes(character))) {
    return false;
  }
  if (doorway !== null && (!OFFICE.characters.includes(doorway) || selected.has(doorway))) {
    return false;
  }
  if (state.officeDoorway !== doorway || state.officeRoom.size !== selected.size
    || room.some(character => !state.officeRoom.has(character))) {
    state.officeRoom = selected;
    state.officeDoorway = doorway;
    for (const { location, character, image } of officeLayers) {
      const visible = location === 'room' ? selected.has(character) : doorway === character;
      if (visible && !image.getAttribute('src')) image.src = officeCharacterImage(location, character);
      if (image.hidden !== !visible) image.hidden = !visible;
    }
  }
  updateOfficeView();
  return true;
}

function showTechnical(cam) {
  dom.feedArt.hidden = true;
  dom.tech.hidden = false;
  setImageSource(dom.techArt, cam.technical);
  setText(dom.techNumber, cam.id.replace('CAM', 'CAM '));
}

function currentCameraFrame(cam, actors = movement.cameraActors(cam.id)) {
  return cameraActorFrame(cam, actors, config, movement.isGateClosed, state.characterPreviews.get(cam.id));
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

function updateCameraFeed(cam, warm = false) {
  if (!movement.camerasAvailable()) {
    dom.feedArt.hidden = true;
    dom.tech.hidden = true;
    dom.cameraOffline.hidden = !movement.electricalFault();
    interference.setElectrical(!dom.cameraOffline.hidden && state.mode === 'cameras');
    return;
  }
  interference.setElectrical(false);
  dom.cameraOffline.hidden = true;
  const actors = movement.cameraActors(cam.id);
  const { source } = currentCameraFrame(cam, actors);
  if (!source) {
    showTechnical(cam);
    console.warn(`[FNAN] ${cam.id}: combinação sem imagem para a configuração atual.`);
    return;
  }
  dom.tech.hidden = true;
  dom.feedArt.hidden = false;
  const alt = `Câmera ${cam.id}, cenário noturno`;
  if (dom.feedArt.alt !== alt) dom.feedArt.alt = alt;
  const changed = dom.feedArt.getAttribute('src') !== source;
  setImageSource(dom.feedArt, source, () => {
    if (!movement.camerasAvailable() || CAMERAS[state.cameraIndex] !== cam) return;
    showTechnical(cam);
    announce(`${cam.id}: imagem não encontrada; exibindo a planta técnica`);
  });
  if ((changed || warm) && watchingCameras()) warmCamera(cam, actors, source);
}

function updateMovementDebug(frame) {
  if (!debugEnabled) return;
  const cam = CAMERAS[state.cameraIndex];
  const { key, gateKey, source } = currentCameraFrame(cam);
  let feed = 'Monitor abaixado';
  if (state.mode === 'cameras') {
    const detail = movement.electricalFault() ? 'sem sinal'
      : `${key ?? 'sem estado'}${gateKey ? ` · ${gateKey}` : ''}${!source || dom.feedArt.hidden ? ' · planta técnica' : ''}`;
    feed = `${cam.id} · ${detail}`;
  }
  const lines = movement.diagnostics().map(actor => {
    const status = state.complete ? 'turno encerrado' : actor.stopped;
    return `${actor.name} [${actor.level}] · ${actor.location} · ${actor.camera} · ${actor.remaining.toFixed(1)} s\n`
      + `  Anterior: ${actor.previous ?? '—'} | Destino: ${actor.destination ?? '—'}\n`
      + `  ${status}`;
  });
  const { counter, floor } = frame ?? movement.snapshot();
  dom.debug.textContent = [`IA · ${feed}`, `Palhaça · ${counter.toFixed(1)} · piso ${floor}`, ...lines].join('\n');
}

function syncMovement(now) {
  if (!movementChanged && !officeChanged && !changedGates.size) return;
  for (const id of changedCameras) state.characterPreviews.delete(id);
  const cam = CAMERAS[state.cameraIndex];
  const visibleGateChanged = cam.gateStateImages?.gates.some(id => changedGates.has(id));
  if (changedCameras.has(cam.id) || visibleGateChanged) updateCameraFeed(cam);
  if (officeChanged || (movementChanged && officePreview)) {
    officePreview = false;
    const { room, doorway, front, back, smores } = movement.officeState();
    for (const [phase, image] of [['vent', dom.smoresVent], ['room', dom.smoresRoom]]) {
      if (smores === phase && !image.getAttribute('src')) image.src = SMORES_ART[phase];
      image.hidden = smores !== phase;
    }
    setCorridorCharacters(front, back);
    setOfficeCharacterState(room, doorway);
  } else if (changedGates.has(OFFICE.gate)) {
    updateOfficeView();
  }
  if (visibleGateChanged && watchingCameras()) interference.play('gate', now, now, signal.gate);
  changedCameras.clear();
  changedGates.clear();
  movementChanged = officeChanged = false;
}

function watchingCameras() {
  return !state.complete && state.mode === 'cameras' && movement.camerasAvailable() && !document.hidden;
}

function changeCamera(id, withSound = false) {
  const index = CAMERAS.findIndex(camera => camera.id === id);
  if (index < 0) return;
  const changed = state.cameraIndex !== index;
  state.cameraIndex = index;
  const cam = CAMERAS[index];
  setText(dom.camNumber, cam.id.replace('CAM', 'CAM '));
  map.setActive(cam);

  updateCameraFeed(cam, true);
  updateMovementDebug();
  if (watchingCameras()) {
    const now = performance.now();
    if (changed) interference.clearTransient();
    interference.play('switch', now, now, signal.switch);
    imageCache.warm([currentCameraFrame(CAMERAS[(index + 1) % CAMERAS.length]).source]);
  }
  if (withSound && changed) playSound('switch');
}

function setMode(mode, withSound = true) {
  if (state.complete || state.mode === mode) return;
  if (mode === 'cameras' || mode === 'desktop') {
    if (!movement.snapshot().computerOn) return;
  }
  const watching = mode === 'cameras';
  const hiding = mode === 'closet';
  state.mode = mode;
  if (!watching) {
    interference.setElectrical(false);
    interference.clearTransient();
  }
  dom.game.dataset.mode = mode;
  dom.office.hidden = mode !== 'office';
  dom.closet.hidden = !hiding;
  dom.desktop.hidden = mode !== 'desktop' && !watching;
  setStartMenu(false);
  if (!dom.desktop.hidden) {
    state.computerMode = mode;
    updateDesktopClock();
  }
  renderCameraApp();
  dom.hint.hidden = true;
  state.dragging = false;
  state.pointerX = null;
  clearFlashlight();
  updateRadioMix();
  if (!hiding) sound.setSampleLoop('musicBox', 0);
  if (withSound) playSound('monitor');
  if (watching) {
    changeCamera(CAMERAS[state.cameraIndex].id);
  }
  updateAudioControl();
  updateOfficeView();
  updateMovementDebug();
}

function openComputer() {
  if (state.mode === 'office' && !state.closetTransition) setMode(state.computerMode);
}

function closeComputer() {
  if (dom.desktop.hidden || state.complete) return;
  setMode('office');
  advanceGame(performance.now(), { type: 'returnToOffice', source: 'computer' });
  const target = movement.snapshot().computerOn ? dom.officeMonitor : dom.officePower;
  target.focus({ preventScroll: true });
}

function toggleComputerPower() {
  if (state.complete || state.closetTransition) return;
  advanceGame(performance.now(), { type: 'computerPower' });
  if (!movement.snapshot().computerOn && !dom.desktop.hidden) closeComputer();
}

function updateDesktopClock() {
  const now = new Date();
  const minute = Math.floor(now.getTime() / 60_000);
  if (minute === lastDesktopMinute) return;
  lastDesktopMinute = minute;
  dom.taskTime.textContent = dom.taskTime.dateTime = desktopTime.format(now);
  const date = desktopDate.format(now);
  dom.taskDate.textContent = date;
  dom.taskDate.dateTime = date.split('/').reverse().join('-');
}

function setStartMenu(open) {
  dom.startMenu.hidden = !open;
  dom.openStart.setAttribute('aria-expanded', String(open));
}

function renderCameraApp() {
  const active = state.mode === 'cameras';
  cameraApp.task.setAttribute('aria-pressed', String(active));
  if (active) cameraApp.panel.dataset.active = '';
  else delete cameraApp.panel.dataset.active;
  if (cameraApp.open) cameraApp.task.dataset.open = '';
  else delete cameraApp.task.dataset.open;
}

function showCameraApp() {
  if (state.complete || dom.desktop.hidden) return;
  const fromStart = !dom.startMenu.hidden;
  setStartMenu(false);
  cameraApp.open = true;
  cameraApp.panel.hidden = false;
  setMode('cameras');
  if (fromStart) cameraApp.task.focus({ preventScroll: true });
}

function setMaximized(maximized) {
  if (maximized) cameraApp.panel.dataset.maximized = '';
  else delete cameraApp.panel.dataset.maximized;
  const label = maximized ? 'Restaurar janela' : 'Maximizar janela';
  cameraApp.maximize.title = label;
  cameraApp.maximize.setAttribute('aria-label', label);
}

function resetCameraApp() {
  cameraApp.open = false;
  cameraApp.panel.hidden = true;
  setMaximized(false);
  delete cameraApp.panel.dataset.snapped;
  for (const property of ['--window-x', '--window-y', '--resized-width', '--resized-height']) {
    cameraApp.panel.style.setProperty(property, '');
  }
}

function hideCameraApp(close = false) {
  if (state.complete) return;
  if (close) resetCameraApp();
  else cameraApp.panel.hidden = true;
  if (state.mode === 'cameras') setMode('desktop');
  else renderCameraApp();
  cameraApp.task.focus({ preventScroll: true });
}

function updateRadioMix() {
  if (!radioPlayback) return;
  const hiding = state.mode === 'closet';
  // The radio knob is at 70.3% of the panorama. Pan relative to the visible viewport.
  const panoramaWidth = state.mode === 'office' ? viewport.panoramaWidth : 0;
  const offset = .203 * panoramaWidth + state.pan;
  const relative = Math.max(-1, Math.min(1, 2 * offset / (viewport.width || 1)));
  const pan = hiding ? (dom.closet.dataset.view === 'door' ? -.55 : .55) : Math.round(relative * 100) / 100;
  if (pan === radioMixPan && hiding === radioMixHiding) return;
  radioMixPan = pan;
  radioMixHiding = hiding;
  sound.mixRadio(radioMusic, pan, hiding);
}

function stopRadio() {
  radioPlayback = null;
  radioMixPan = radioMixHiding = undefined;
  state.radioPlaying = false;
  radioMusic.pause();
  dom.officeRadio.setAttribute('aria-pressed', 'false');
}

function toggleRadio() {
  if (state.complete || state.closetTransition || state.mode !== 'office') return;
  if (!movement.snapshot().radioAvailable) return;
  if (radioPlayback) {
    stopRadio();
    return;
  }
  sound.connectRadio(radioMusic);
  const track = controls.radioTracks[Math.floor(Math.random() * controls.radioTracks.length)];
  radioMusic.src = `./public/audio/radio/${track}`;
  const playback = radioMusic.play();
  radioPlayback = playback;
  dom.officeRadio.setAttribute('aria-pressed', 'true');
  updateRadioMix();
  playback.catch(() => {
    if (radioPlayback === playback) stopRadio();
  });
}

function setClownPhase(index) {
  if (state.clownPhase === index) return;
  state.clownPhase = index;
  dom.clownPeek.hidden = index !== CLOWN_PHASES.length - 1;
  if (index < 0) {
    dom.closetBeam.hidden = true;
    return;
  }
  const { art, alt } = CLOWN_PHASES[index];
  const source = CLOWN_ART + art;
  if (dom.closetBeam.getAttribute('src') !== source) dom.closetBeam.src = source;
  dom.closetBeam.alt = alt;
}

function setClosetLight(on) {
  dom.closetBeam.hidden = !on || state.clownPhase < 0;
  dom.closetLight.setAttribute('aria-pressed', String(on));
}

function setClosetView(view) {
  dom.closet.dataset.view = view;
  dom.closetExit.hidden = view !== 'door';
  dom.closetLight.hidden = view !== 'back';
  setClosetLight(false);
  updateRadioMix();
  if (state.mode === 'closet') {
    sound.setSampleLoop('musicBox', view === 'back' ? .065 : .035);
    dom.closet.focus({ preventScroll: true });
  }
}

function flashlightTarget() {
  if (state.complete || state.closetTransition) return null;
  if (state.mode === 'office' && !dom.officeLight.disabled) return dom.officeLight;
  if (state.mode === 'closet' && !dom.closetLight.hidden) return dom.closetLight;
  return null;
}

function updateFlashlight() {
  const held = state.flashlightKey || state.flashlightPointer !== null;
  const target = flashlightTarget();
  const wasOn = state.flashlight || dom.closetLight.getAttribute('aria-pressed') === 'true';
  state.flashlight = held && target === dom.officeLight;
  setClosetLight(held && target === dom.closetLight);
  if (held && target && !wasOn) sound.playSample('flashlight');
  updateOfficeView();
}

function clearFlashlight() {
  state.flashlightKey = false;
  state.flashlightPointer = null;
  updateFlashlight();
}

function beginClosetTransition(kind) {
  const expectedMode = kind === 'enter' ? 'office' : 'closet';
  if (state.complete || state.closetTransition || state.mode !== expectedMode) return;
  if (kind === 'exit' && dom.closet.dataset.view !== 'door') return;

  const now = performance.now();
  if (kind !== 'turn') {
    advanceGame(now, { type: kind === 'enter' ? 'closetEnter' : 'closetExit' });
    if (state.complete) return;
  }
  const { swap, duration } = controls.closetTransitionsMs[kind];
  state.closetTransition = { kind, swapAt: now + swap, endAt: now + duration };
  clearFlashlight();
  state.closetTouchX = null;
  state.dragging = false;
  state.targetPan = state.pan;
  dom.game.style.setProperty('--closet-duration', `${duration}ms`);
  dom.game.dataset.closetTransition = kind;
  if (kind === 'enter') sound.playSample('running');
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
        sound.playSample('running');
        setMode('office', false);
        state.pan = state.targetPan = -maxPanShift() * .95;
        dom.officeCloset.focus({ preventScroll: true });
        break;
    }
  }
  if (now >= transition.endAt) {
    clearClosetTransition();
    if (transition.kind === 'exit') return { type: 'returnToOffice', source: 'closet' };
  }
}

function playCameraAudio() {
  if (state.complete || state.mode !== 'cameras') return;
  if (!movement.camerasAvailable()) {
    announce('Não foi possível transmitir áudio.');
    return;
  }
  if (!advanceGame(performance.now(), { type: 'cameraAudio' }) || state.complete) {
    announce('Aguarde antes de reproduzir outro som.');
    return;
  }
  sound.cameraMeow(movement.snapshot().sanity);
  updateAudioControl();
  announce(`Som reproduzido em ${CAMERAS[state.cameraIndex].id}.`);
}

function clockHour(elapsedHours) {
  return (night.startHour + elapsedHours) % 12 || 12;
}

function updateClockUI(progress) {
  const hours = Math.min(night.hoursToWin, Math.floor(progress + 1e-12));
  const label = clockHour(hours);
  if (clockLabel === label) return;
  clockLabel = label;
  dom.clock.innerHTML = `${label} <small>AM</small>`;
}

function finishShift() {
  stopShift();
  updateClockUI(night.hoursToWin);
  $('#shift-time').innerHTML = `${clockHour(night.hoursToWin)}:00 <small>AM</small>`;
  dom.complete.hidden = false;
  dom.restart.focus();
  sound.playSample('chimes');
}

function stopShift() {
  state.complete = true;
  movement.stop();
  clearTimeout(toastTimeout);
  dom.toast.classList.remove('show');
  interference.clear();
  goticaStaticAt = undefined;
  cancelGameFrame();
  dom.resourceHud.hidden = dom.shadowManifest.hidden = dom.shadowOfficeArt.hidden = dom.shadowFeed.hidden = true;
  delete dom.shadowFeed.dataset.phase;
  clearFlashlight();
  stopRadio();
  sound.stopSamples();
  state.dragging = false;
  clearClosetTransition();
}

function prepareDefeat() {
  stopShift();
  dom.playfield.inert = true;
}

function beginJumpscare(source) {
  if (source === SHADOW_IMAGE) {
    dom.game.dataset.scare = 'shadow';
  } else if (source === CLOWN_BOTTOM_IMAGE) {
    dom.game.dataset.scare = 'clown-bottom';
    setClosetLight(false);
  } else if (source === CLOWN_RIGHT_IMAGE) {
    setMode('office', false);
  }
  prepareDefeat();
  // A fresh image request restarts a one-shot GIF the browser has already finished.
  dom.scareArt.src = playedScares.has(source) ? `${source}?replay=${++scareReplay}` : source;
  playedScares.add(source);
  setDefeatPhase('blackout', performance.now() + controls.jumpscare.blackoutMs);
  dom.scareSound.currentTime = 0;
  dom.scareSound.volume = controls.jumpscare.volume;
  dom.scareSound.play().catch(() => {});
}

function setDefeatPhase(phase, deadline) {
  dom.game.dataset.defeat = phase;
  defeatDeadline = deadline;
  requestGameFrame();
}

function advanceDefeat(now) {
  if (now < defeatDeadline) return;
  const { cycleMs, clownBottomCycleMs, finalHoldMs, flashMs, imageLoadWaitMs } = controls.jumpscare;
  switch (dom.game.dataset.defeat) {
    case 'blackout':
      // Give a cold load time to arrive, but always reach Game Over.
      if (!dom.scareArt.complete && now < defeatDeadline + imageLoadWaitMs) return;
      if (dom.scareArt.naturalWidth > 0) {
        const cycle = dom.game.dataset.scare === 'shadow' ? config.shadow.jumpscareMs
          : dom.game.dataset.scare === 'clown-bottom' ? clownBottomCycleMs : cycleMs;
        setDefeatPhase('scare', now + cycle + finalHoldMs);
        break;
      }
      // Missing art still leads to the flash and the end of the night.
    case 'scare':
      setDefeatPhase('flash', now + flashMs);
      dom.scareArt.removeAttribute('src');
      break;
    case 'flash':
      dom.game.dataset.defeat = 'over';
      dom.gameOver.hidden = false;
      $('#retry-night').focus();
      break;
  }
}

function resetShift({ keepWarm = false } = {}) {
  cancelGameFrame();
  interference.clear();
  goticaStaticAt = undefined;
  if (!keepWarm) imageCache.clear();
  resetPerformance();
  state.startedAt = state.lastFrame = performance.now();
  nextHudUpdate = nextDebugUpdate = 0;
  renderedShadow = undefined;
  nextDesktopUpdate = 0;
  dom.scareSound.pause();
  dom.scareArt.removeAttribute('src');
  dom.gameOver.hidden = true;
  dom.playfield.inert = false;
  delete dom.game.dataset.defeat;
  delete dom.game.dataset.scare;
  $('#game-over-status').textContent = 'SINAL PERDIDO';
  $('#night-mode').textContent = state.custom ? 'CUSTOM NIGHT' : 'NOITE 01';
  clearTimeout(toastTimeout);
  dom.toast.classList.remove('show');
  dom.threatAlert.hidden = true;
  sound.preloadSamples();
  sound.stopSamples();
  state.computerMode = 'desktop';
  resetCameraApp();
  movement.reset(state.levels);
  dom.resourceHud.hidden = false;
  const frame = movement.snapshot();
  renderResourceState(frame);
  renderResources(frame);
  movementChanged = officeChanged = true;
  changedGates.clear();
  changedCameras.clear();
  state.characterPreviews.clear();
  stopRadio();
  setClownPhase(frame.clownStage);
  clearClosetTransition();
  setClosetView('door');
  state.pan = state.targetPan = 0;
  renderPan();
  for (const { id, type } of window.NathGame.VENUE.openings) {
    if (type === 'portao') map.setGate(id, movement.isGateClosed(id));
  }
  renderedElectrical = undefined;
  renderElectrical();
  syncMovement(state.startedAt);
  state.complete = false;
  state.mode = 'cameras'; // Force setMode to apply the initial office state.
  dom.complete.hidden = true;
  setMode('office', false);
  changeCamera(CAMERAS[0].id);
  updateClockUI(0);
  dom.hint.hidden = false;
  dom.officeMonitor.focus({ preventScroll: true });
  warmShiftImages();
  requestGameFrame();
}

let viewport;
function measureViewport() {
  if (dom.game.hidden) return;
  const { clientWidth: width, clientHeight: height } = dom.game;
  const { left, width: pointerWidth, height: pointerHeight } = dom.game.getBoundingClientRect();
  // The CSS panorama is exactly 2172:724 (3:1).
  const officeWidth = Math.max(width, height * 3);
  const panoramaWidth = Math.round(Math.max(pointerWidth, pointerHeight * 3));
  const limit = Math.max(0, (panoramaWidth - width) / 2);
  viewport = {
    width, left, pointerWidth, officeWidth, panoramaWidth, limit,
    officeHalf: 1086 * width / (officeWidth || 1),
    closetHalf: Math.min(835.5, 941 * width / (2 * height || 1))
  };
  state.targetPan = Math.min(limit, Math.max(-limit, state.targetPan));
  state.pan = Math.min(limit, Math.max(-limit, state.pan));
  updateRadioMix();
}

function maxPanShift() {
  return viewport.limit;
}

function setEdgePan(clientX) {
  if (state.dragging) return;
  const ratio = Math.max(0, Math.min(1, (clientX - viewport.left) / (viewport.pointerWidth || 1)));
  let signed = 0;
  const edge = .17;
  if (ratio < edge) signed = (edge - ratio) / edge;
  else if (ratio > 1 - edge) signed = -(ratio - (1 - edge)) / edge;
  state.targetPan = signed * maxPanShift() * .95;
}

function moveCamera(dt) {
  if (state.pan === state.targetPan) return;
  const speed = Math.min(1, dt * .008);
  state.pan += (state.targetPan - state.pan) * speed;
  if (Math.abs(state.pan - state.targetPan) < .3) state.pan = state.targetPan;
}

let renderedPan;
function renderPan() {
  const pan = Math.round(state.pan);
  if (renderedPan === pan) return;
  renderedPan = pan;
  dom.officeScene.style.setProperty('--pan-shift', `${pan}px`);
}

function corridorInView() {
  return state.flashlightPointer !== null || Math.abs(state.pan) <= maxPanShift() * controls.observation.corridorPanFraction;
}

function gameInput() {
  const office = state.mode === 'office' && !state.closetTransition;
  const closet = state.mode === 'closet';
  const camera = state.mode === 'cameras' ? CAMERAS[state.cameraIndex].id : null;
  const { officeWidth, officeHalf, closetHalf } = viewport;
  const officeCenter = 1086 - 2172 * state.pan / (officeWidth || 1);
  const officeBounds = [officeCenter - officeHalf, officeCenter + officeHalf];
  return {
    camera,
    cameraPreview: state.characterPreviews.get(camera),
    visibleCameraSource: camera && !dom.feedArt.hidden && dom.feedArt.complete && dom.feedArt.naturalWidth
      ? dom.feedArt.getAttribute('src') : null,
    findShadow: !document.hidden,
    view: office ? 'office' : closet && !state.closetTransition ? `closet-${dom.closet.dataset.view}` : state.mode === 'cameras' ? 'cameras' : null,
    closet,
    officeBounds,
    closetBounds: [835.5 - closetHalf, 835.5 + closetHalf],
    leftLook: office && state.pan > maxPanShift() * controls.observation.leftPanFraction,
    smoresLooking: office && officeBounds[0] <= SMORES_VENT_CENTER && SMORES_VENT_CENTER <= officeBounds[1],
    corridorLight: office && state.flashlight && !movement.isGateClosed(OFFICE.gate) && corridorInView(),
    clownLight: state.mode === 'closet' && dom.closet.dataset.view === 'back' && !dom.closetBeam.hidden,
    radio: state.radioPlaying,
    computer: !dom.desktop.hidden,
    viewMoving: (office && state.pan !== state.targetPan) || state.closetTransition?.kind === 'turn'
  };
}

function updateAudioControl(audio = movement.snapshot().audio) {
  const online = movement.camerasAvailable();
  const disabled = !online || audio.remaining > 0;
  if (dom.cameraAudio.disabled !== disabled) dom.cameraAudio.disabled = disabled;
  setText(dom.cameraAudio, !online ? 'ÁUDIO INDISPONÍVEL'
    : audio.camera ? `▸ SOM ATIVO · ${audio.camera} · ${Math.ceil(audio.remaining)}s`
    : audio.remaining > 0 ? `ÁUDIO RECARREGANDO · ${Math.ceil(audio.remaining)}s`
    : '▸ REPRODUZIR SOM NESTA CÂMERA');
}

function advanceGame(now, action) {
  if (state.complete || dom.game.hidden) return false;
  const accepted = movement.advance((now - state.startedAt) / 1000, gameInput, action);
  if (!state.complete) renderGameFrame(movement.snapshot(), now);
  return accepted;
}

let renderedElectrical;
function renderElectrical(fault = movement.electricalFault()) {
  if (renderedElectrical === fault) return;
  renderedElectrical = fault;
  map.setGateControls(!fault);
  if (state.mode === 'cameras') updateCameraFeed(CAMERAS[state.cameraIndex]);
  updateAudioControl();
  updateOfficeView();
}

function renderGameFrame(frame, now) {
  renderElectrical(frame.electricalFault);
  interference.update(now);
  if (goticaStaticAt !== undefined) {
    if (watchingCameras()) {
      interference.play('gotica', goticaStaticAt, now, signal.gotica);
      goticaStaticAt = undefined;
    } else if (now >= goticaStaticAt + signal.gotica.durationMs) goticaStaticAt = undefined;
  }
  syncMovement(now);
  updateClockUI(frame.hours);
  renderResourceState(frame);
  if (!frame.radioAvailable && radioPlayback) stopRadio();
  if (frame.blackout && !dom.desktop.hidden) {
    setMode('office');
    dom.officePower.focus({ preventScroll: true });
  }
  renderShadow(frame.shadow);
  setClownPhase(frame.clownStage);
  if (now >= nextHudUpdate) {
    nextHudUpdate = now + 100;
    renderResources(frame);
    updateAudioControl(frame.audio);
    renderWarnings(frame);
  }
  if (debugEnabled && now >= nextDebugUpdate) {
    nextDebugUpdate = now + 200;
    updateMovementDebug(frame);
  }
}

function renderWarnings(frame) {
  const warnings = [];
  if (state.officeRoom.size) warnings.push(frame.hidden ? 'AGUARDE NO ARMÁRIO' : 'INVASÃO · ENTRE NO ARMÁRIO');
  setText(dom.threatAlert, warnings.join(' / '));
  const hidden = warnings.length === 0;
  if (dom.threatAlert.hidden !== hidden) dom.threatAlert.hidden = hidden;
}

function renderResources({ sanity, energy }) {
  for (const [meter, label, value] of [[dom.sanityMeter, dom.sanityValue, sanity], [dom.energyMeter, dom.energyValue, energy]]) {
    const rounded = Math.round(value * 10) / 10;
    const text = value > 0 && rounded === 0 ? '<0,1%' : `${String(rounded).replace('.', ',')}%`;
    if (label.textContent === text) continue;
    label.textContent = text;
    meter.value = rounded;
    meter.style.setProperty('--meter-fill', `${rounded}%`);
    if (meter === dom.sanityMeter) meter.style.setProperty('--meter-hue', 338 - rounded * .62);
  }
}

let resourceStateKey;
function renderResourceState({ energy, blackout, computerOn, radioAvailable }) {
  const low = energy <= config.power.warningBelow;
  const key = `${low}|${blackout}|${computerOn}|${radioAvailable}`;
  if (key === resourceStateKey) return;
  resourceStateKey = key;
  dom.energyMeter.classList.toggle('low', low);
  dom.game.toggleAttribute('data-blackout', blackout);
  dom.game.toggleAttribute('data-computer-off', !computerOn);
  dom.officeMonitor.disabled = !computerOn;
  dom.officePower.disabled = blackout;
  for (const button of [dom.officePower, dom.desktopPower]) {
    button.setAttribute('aria-pressed', String(computerOn));
  }
  dom.officeRadio.disabled = !radioAvailable;
}

let renderedShadow;
function renderShadow({ phase, camera }) {
  const inOffice = state.mode === 'office';
  const feedVisible = phase === 'found' && watchingCameras() && CAMERAS[state.cameraIndex].id === camera;
  const key = `${phase}|${inOffice}|${feedVisible}`;
  if (key === renderedShadow) return;
  renderedShadow = key;
  const attacking = phase === 'manifested' || phase === 'searching';
  sound.setSampleLoop('nightmare', attacking ? .3 : 0);
  dom.shadowManifest.hidden = !inOffice || phase !== 'manifested';
  dom.shadowOfficeArt.hidden = !inOffice || !attacking;
  dom.shadowFeed.hidden = !feedVisible;
  if (!dom.shadowFeed.hidden) dom.shadowFeed.dataset.phase = phase;
  else delete dom.shadowFeed.dataset.phase;
}

let gameFrame;
let backgroundFrame;
function requestGameFrame() {
  if (document.hidden) {
    backgroundFrame ??= setTimeout(() => {
      backgroundFrame = undefined;
      tick(performance.now());
    }, 1000);
  } else gameFrame ??= requestAnimationFrame(tick);
}

function cancelGameFrame() {
  if (gameFrame !== undefined) cancelAnimationFrame(gameFrame);
  gameFrame = undefined;
  clearTimeout(backgroundFrame);
  backgroundFrame = undefined;
}

const perf = params.get('perf') === '1' ? document.createElement('output') : null;
let perfStart, perfFrames = 0, perfSlow = 0, perfWork = 0;
if (perf) {
  perf.className = 'perf-overlay';
  dom.game.append(perf);
}

function recordPerformance(now, delta, started) {
  if (perfStart === undefined) {
    perfStart = now;
    return;
  }
  perfFrames++;
  if (delta > 25) perfSlow++;
  perfWork += performance.now() - started;
  const elapsed = now - perfStart;
  if (elapsed < 1000) return;
  perf.textContent = `${(1000 * perfFrames / elapsed).toFixed(0)} FPS · ${(elapsed / perfFrames).toFixed(1)} ms/quadro`
    + ` · ${perfSlow} lentos (>25 ms) · JS ${(perfWork / perfFrames).toFixed(2)} ms · cache ${imageCache.size}`;
  perfStart = now;
  perfFrames = perfSlow = perfWork = 0;
}

function resetPerformance() {
  if (!perf) return;
  perf.textContent = '';
  perfStart = undefined;
  perfFrames = perfSlow = perfWork = 0;
}

function tick(now) {
  gameFrame = undefined;
  const elapsed = Math.max(0, now - state.lastFrame);
  state.lastFrame = now;
  const time = performance.now();
  if (!state.complete) {
    const action = advanceClosetTransition(time);
    if (state.mode === 'office') {
      moveCamera(Math.min(100, elapsed));
      renderPan();
      if (state.flashlight && dom.office.dataset.flashlight !== String(corridorInView())) updateOfficeView();
      updateRadioMix();
    }
    // Movement integrates elapsed time and resolves intermediate deadlines, even after dropped frames.
    advanceGame(time, action);
    if (!dom.desktop.hidden && now >= nextDesktopUpdate) {
      nextDesktopUpdate = now + 1000;
      updateDesktopClock();
    }
  }
  if (dom.game.dataset.defeat) advanceDefeat(now);
  if (perf && !document.hidden) recordPerformance(now, elapsed, time);
  if (!state.complete || (dom.game.dataset.defeat && dom.game.dataset.defeat !== 'over')) requestGameFrame();
}

document.addEventListener('visibilitychange', () => {
  cancelGameFrame();
  resetPerformance();
  if (document.hidden) {
    clearFlashlight();
    interference.clearTransient();
  }
  advanceGame(performance.now());
  if (!state.complete || (dom.game.dataset.defeat && dom.game.dataset.defeat !== 'over')) requestGameFrame();
});
dom.officeMonitor.addEventListener('click', openComputer);
dom.officePower.addEventListener('click', toggleComputerPower);
dom.desktopPower.addEventListener('click', toggleComputerPower);
dom.shutdownDesktop.addEventListener('click', toggleComputerPower);
$('#monitor-exit').addEventListener('click', closeComputer);
document.addEventListener('click', event => {
  if (event.target === document.body) closeComputer();
});
dom.officeCloset.addEventListener('click', () => beginClosetTransition('enter'));
dom.officeRadio.addEventListener('click', toggleRadio);
function setRadioPlaying(on) {
  if (state.radioPlaying === on) return;
  state.radioPlaying = on;
  advanceGame(performance.now());
}
radioMusic.addEventListener('playing', () => setRadioPlaying(Boolean(radioPlayback)));
radioMusic.addEventListener('waiting', () => setRadioPlaying(false));
radioMusic.addEventListener('pause', () => { if (radioMusic.paused) setRadioPlaying(false); });
radioMusic.addEventListener('error', stopRadio);
dom.closetExit.addEventListener('click', () => beginClosetTransition('exit'));
dom.officeGate.addEventListener('click', () => {
  if (state.complete || state.mode !== 'office' || state.closetTransition || movement.electricalFault()) return;
  advanceGame(performance.now(), { type: 'gate', id: OFFICE.gate });
});
for (const button of [dom.officeLight, dom.closetLight]) {
  button.addEventListener('pointerdown', event => {
    if (event.button !== 0 || state.flashlightPointer !== null || flashlightTarget() !== button) return;
    button.setPointerCapture(event.pointerId);
    state.flashlightPointer = event.pointerId;
    updateFlashlight();
    advanceGame(performance.now());
  });
  const release = event => {
    if (event.pointerId !== state.flashlightPointer) return;
    state.flashlightPointer = null;
    updateFlashlight();
    advanceGame(performance.now());
  };
  for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) button.addEventListener(event, release);
}
function bindCameraWindow() {
  const app = cameraApp;
  $('#open-cameras').addEventListener('click', showCameraApp);
  $('#start-cameras').addEventListener('click', showCameraApp);
  app.task.addEventListener('click', () => state.mode === 'cameras' ? hideCameraApp() : showCameraApp());
  app.panel.addEventListener('focusin', showCameraApp);
  $('#minimize-cameras').addEventListener('click', () => hideCameraApp());
  $('#close-cameras').addEventListener('click', () => hideCameraApp(true));

  const toggleMaximized = () => setMaximized(app.panel.dataset.maximized === undefined);
  app.maximize.addEventListener('click', toggleMaximized);
  app.titlebar.addEventListener('dblclick', event => {
    if (!event.target.closest('button')) toggleMaximized();
  });

  const { panel, titlebar } = app;
  for (const edge of ['n', 's', 'w', 'e', 'nw', 'ne', 'sw', 'se']) {
    const handle = document.createElement('div');
    handle.className = 'window-resize';
    handle.dataset.resize = edge;
    handle.setAttribute('aria-hidden', 'true');
    panel.append(handle);
  }

  let gesture;
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  function measureGesture() {
    const workspace = panel.parentElement;
    gesture.viewport = viewport;
    gesture.workspaceWidth = workspace.clientWidth;
    gesture.workspaceHeight = workspace.clientHeight;
    gesture.screen = workspace.parentElement.getBoundingClientRect();
    gesture.width = panel.offsetWidth;
    gesture.height = panel.offsetHeight;
  }
  const snapSide = event => {
    const { left, right } = gesture.screen;
    if (event.clientX <= left + 18) return 'left';
    if (event.clientX >= right - 18) return 'right';
    return '';
  };
  panel.addEventListener('pointerdown', event => {
    showCameraApp();
    if (state.complete || gesture || !event.isPrimary || event.button !== 0) return;
    const edge = event.target.dataset.resize;
    if (!edge && (!titlebar.contains(event.target) || event.target.closest('button'))) return;

    const { offsetLeft: left, offsetTop: top, offsetWidth: width, offsetHeight: height } = panel;
    gesture = {
      pointer: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      edge,
      moving: false,
      left, top, right: left + width, bottom: top + height
    };
    measureGesture();
    const handle = edge ? event.target : titlebar;
    handle.setPointerCapture(event.pointerId);
  });
  panel.addEventListener('pointermove', event => {
    if (gesture?.pointer !== event.pointerId || panel.hidden || dom.desktop.hidden
        || state.complete) return;
    const workspace = panel.parentElement;
    if (gesture.viewport !== viewport) measureGesture();
    const { edge, x, y, workspaceWidth: clientWidth, workspaceHeight: clientHeight } = gesture;
    const dx = event.clientX - x;
    const dy = event.clientY - y;
    let { left, top, right, bottom } = gesture;
    if (!edge) {
      if (!gesture.moving) {
        if (Math.hypot(dx, dy) < 5) return;
        gesture.moving = true;
        if (panel.hasAttribute('data-snapped') || panel.hasAttribute('data-maximized')) {
          const bounds = workspace.getBoundingClientRect();
          const grip = clamp((x - bounds.left - left) / (right - left), 0, 1);
          setMaximized(false);
          delete panel.dataset.snapped;
          gesture.width = panel.offsetWidth;
          gesture.height = panel.offsetHeight;
          gesture.left = left = x - bounds.left - gesture.width * grip;
          gesture.top = top = y - bounds.top - clamp(y - bounds.top - top, 0, titlebar.offsetHeight);
        }
      }
      panel.style.setProperty('--window-x', clamp(left + dx, 0, Math.max(0, clientWidth - gesture.width)) + 'px');
      panel.style.setProperty('--window-y', clamp(top + dy, 0, Math.max(0, clientHeight - gesture.height)) + 'px');
      const side = snapSide(event);
      if (workspace.dataset.snapPreview !== side) workspace.dataset.snapPreview = side;
      return;
    }
    if (edge.includes('w') || edge.includes('e')) {
      const minWidth = Math.min(300, Math.round(clientWidth * .85));
      if (edge.includes('w')) {
        right = Math.min(right, clientWidth);
        left = clamp(left + dx, 0, Math.max(0, right - minWidth));
      } else {
        left = Math.min(left, clientWidth - minWidth);
        right = clamp(right + dx, left + minWidth, clientWidth);
      }
      panel.style.setProperty('--window-x', left + 'px');
      panel.style.setProperty('--resized-width', right - left + 'px');
    }
    if (edge.includes('n') || edge.includes('s')) {
      const minHeight = Math.min(200, Math.round(clientHeight * .75));
      if (edge.includes('n')) {
        bottom = Math.min(bottom, clientHeight);
        top = clamp(top + dy, 0, Math.max(0, bottom - minHeight));
      } else {
        top = Math.min(top, clientHeight - minHeight);
        bottom = clamp(bottom + dy, top + minHeight, clientHeight);
      }
      panel.style.setProperty('--window-y', top + 'px');
      panel.style.setProperty('--resized-height', bottom - top + 'px');
    }
  });
  const endGesture = event => {
    if (gesture?.pointer !== event.pointerId) return;
    if (event.type === 'pointerup' && gesture.moving && !state.complete && !panel.hidden && !dom.desktop.hidden) {
      const side = snapSide(event);
      if (side) panel.dataset.snapped = side;
    }
    delete panel.parentElement.dataset.snapPreview;
    gesture = null;
  };
  panel.addEventListener('pointerup', endGesture);
  panel.addEventListener('pointercancel', endGesture);
  panel.addEventListener('lostpointercapture', endGesture);
}
bindCameraWindow();
dom.openStart.addEventListener('click', () => {
  const open = dom.startMenu.hidden;
  setStartMenu(open);
  if (open) $('#start-cameras').focus({ preventScroll: true });
});
dom.desktop.addEventListener('pointerdown', event => {
  if (!dom.startMenu.hidden && !event.target.closest('#start-menu, #open-start')) setStartMenu(false);
});
$('#show-desktop').addEventListener('click', () => {
  if (state.complete) return;
  cameraApp.panel.hidden = true;
  setStartMenu(false);
  setMode('desktop');
});
dom.cameraAudio.addEventListener('click', playCameraAudio);
dom.closeDesktop.addEventListener('click', closeComputer);
dom.restart.addEventListener('click', resetShift);
$('#retry-night').addEventListener('click', resetShift);
function returnToMenu() {
  stopShift();
  dom.scareSound.pause();
  imageCache.clear();
  dom.feedArt.removeAttribute('src');
  dom.feedArt.onerror = null;
  dom.game.hidden = true;
  dom.gameOver.hidden = true;
  dom.playfield.inert = false;
  delete dom.game.dataset.defeat;
  delete dom.game.dataset.scare;
  menu.show();
}
dom.returnToMenu.addEventListener('click', returnToMenu);
$('#complete-menu').addEventListener('click', returnToMenu);

dom.office.addEventListener('pointermove', event => {
  if (state.closetTransition) return;
  if (event.pointerType === 'touch') {
    if (!state.dragging) return;
    const change = event.clientX - state.pointerX;
    state.pointerX = event.clientX;
    state.targetPan = Math.max(-maxPanShift(), Math.min(maxPanShift(), state.targetPan + change));
    return;
  }
  if ([dom.officeRadio, dom.officeGate, dom.officeLight, dom.officePower].includes(event.target)) {
    state.targetPan = state.pan;
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
  const ratio = (event.clientX - viewport.left) / (viewport.pointerWidth || 1);
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

document.addEventListener('keydown', event => {
  if (dom.game.hidden || state.complete || event.altKey || event.ctrlKey || event.metaKey) return;
  const key = event.key.toLowerCase();
  if (debugEnabled && key === 'j' && (!state.closetTransition || state.mode === 'closet')) {
    event.preventDefault();
    if (!event.repeat) {
      const source = state.mode === 'closet' ? CLOWN_BOTTOM_IMAGE
        : JUMPSCARE_IMAGES[Math.floor(Math.random() * JUMPSCARE_IMAGES.length)];
      beginJumpscare(source);
    }
    return;
  }
  if (state.closetTransition || event.repeat) return;
  if (key === 'w' && flashlightTarget()) {
    state.flashlightKey = true;
    updateFlashlight();
    return;
  }
  if (state.mode === 'office') {
    if (key === 's') openComputer();
    else if (key === 'a' || key === 'd') state.targetPan = maxPanShift() * (key === 'a' ? 1 : -1);
  } else if (state.mode === 'closet') {
    if ((key === 'a' && dom.closet.dataset.view === 'back')
      || (key === 'd' && dom.closet.dataset.view === 'door')) beginClosetTransition('turn');
  }
});
document.addEventListener('keyup', event => {
  if (event.key.toLowerCase() !== 'w' || !state.flashlightKey) return;
  state.flashlightKey = false;
  updateFlashlight();
});
window.addEventListener('blur', () => {
  state.targetPan = 0;
  state.closetTouchX = null;
  clearFlashlight();
  advanceGame(performance.now());
});
for (const event of ['click', 'keydown', 'keyup', 'focusin']) {
  document.addEventListener(event, () => advanceGame(performance.now()));
}
const resizeObserver = new ResizeObserver(measureViewport);
resizeObserver.observe(dom.game);
window.addEventListener('resize', measureViewport);
window.addEventListener('scroll', measureViewport, { passive: true });

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
window.NathGame.setOfficeCharacterState = (...args) => {
  const accepted = setOfficeCharacterState(...args);
  officePreview ||= accepted;
  return accepted;
};

function startShift(levels, custom) {
  const keepWarm = dom.game.hidden;
  state.levels = custom ? levels : { ...levels, smores: config.threats.smores.normalLevel };
  state.custom = custom;
  dom.game.hidden = false;
  measureViewport();
  resetShift({ keepWarm });
}

function warmShiftImages() {
  imageCache.warm(Object.values(OFFICE.images));
  if (state.levels.smores > 0) imageCache.warm(Object.values(SMORES_ART));
  if (state.levels.palhaca > 0) imageCache.warm(CLOWN_PHASES.map(({ art }) => CLOWN_ART + art));
  if (state.levels.shadow > 0) {
    setImageSource(dom.shadowOfficeArt, config.shadow.officeArt);
    setImageSource(dom.shadowSprite, config.shadow.sprite);
    imageCache.warm([config.shadow.officeArt, config.shadow.sprite]);
    imageCache.warm([SHADOW_IMAGE], false);
  }
  imageCache.warm([...JUMPSCARE_IMAGES, CLOWN_BOTTOM_IMAGE], false);
}

const menu = createNightMenu(config, {
  startShift,
  onEnter: () => {
    imageCache.warm([...JUMPSCARE_IMAGES, CLOWN_BOTTOM_IMAGE], false);
    sound.preloadSamples();
  }
});
dom.game.style.setProperty('--shadow-manifest-duration', `${config.shadow.manifestSeconds}s`);
dom.game.style.setProperty('--shadow-found-duration', `${config.shadow.foundSeconds}s`);

})();
