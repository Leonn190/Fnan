(async () => {
'use strict';
const {
  CAMERAS, OFFICE, makeCameraMap, SoundEngine, createMovement, createNightMenu,
  cameraStateKey, cameraFrame, characterStateImages, officeCharacterImage, corridorSlots, loadConfig
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
let config, enterImmediately;
try {
  ({ config, enterImmediately } = await loadConfig());
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
  officeCharacters: $('#office-characters'), corridorCharacters: $('#corridor-characters'),
  officeCloset: $('#office-closet'), officeRadio: $('#office-radio'),
  clownPeek: $('#clown-peek'), leftDoor: $('#left-door'), officeLight: $('#office-light'),
  closet: $('#closet-view'), closetExit: $('#closet-exit'), closetLight: $('#closet-light'),
  closetDoorArt: $('#closet-door-art'), closetBeam: $('#closet-beam'), closetBlackout: $('#closet-blackout'),
  closetExtra: $('#closet-extra'),
  feedArt: $('#feed-art'), tech: $('#technical-feed'),
  techArt: $('#technical-art'), techNumber: $('#technical-number'),
  camNumber: $('#cam-number'), flash: $('#camera-switch-flash'), cameraOffline: $('#camera-offline'), cameraAudio: $('#camera-audio'),
  static: $('#camera-static'), threatAlert: $('#threat-alert'),
  systemsGrid: $('#systems-grid'), locatorGrid: $('#locator-grid'),
  restartAllSystems: $('#restart-all-systems'), restartAllLocators: $('#restart-all-locators'),
  closeDesktop: $('#close-desktop'), openStart: $('#open-start'), startMenu: $('#start-menu'),
  taskTime: $('#task-time'), taskDate: $('#task-date'),
  clock: $('#clock-label'),
  hint: $('#initial-hint'),
  toast: $('#toast'), complete: $('#shift-complete'), restart: $('#restart-shift'),
  debug: $('#movement-debug')
};

const desktopApps = Object.fromEntries(['cameras', 'systems'].map(id => [id, {
  panel: $('#' + id + '-view'),
  task: $('#taskbar-' + id),
  titlebar: $('#' + id + '-titlebar'),
  maximize: $('#maximize-' + id),
  open: false
}]));
const desktopTime = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' });
const desktopDate = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
let lastDesktopMinute;

const CLOWN_RIGHT_IMAGE = './public/images/jumpscares/palhaca-direita.gif';
const CLOWN_BOTTOM_IMAGE = './public/images/jumpscares/palhaca-baixo.gif';
const CLOWN_PHASES = [
  { art: 'office/closet/seated-clown.png', alt: 'Palhaça dormindo no fundo do armário' },
  { art: 'office/closet/seated-clown-alternate.png', alt: 'Palhaça sentada com os olhos acesos' },
  { art: 'Boneca Animatrônica Jester na Cela Sombria (1).png', alt: 'Palhaça em pé no fundo do armário' },
  { art: 'Arlequina animatrônica no corredor sombrio.png', alt: 'Palhaça de perto com os olhos pretos' }
];
const JUMPSCARE_IMAGES = ['original', 'yandere', 'gotica', 'maid', 'platinada']
  .map(character => `./public/images/jumpscares/${character}.gif`)
  .concat(CLOWN_RIGHT_IMAGE);
const SYSTEMS = [
  { id: 'doors', fault: 'portas', name: 'Sistema de portas', icon: '▥' },
  { id: 'cameras', fault: 'cameras', name: 'Sistema de câmeras', icon: '▣' },
  { id: 'audio', fault: 'audio', name: 'Sistema de áudio', icon: '◖' },
  { id: 'ventilation', fault: 'ventilacao', name: 'Sistema de ventilação', icon: '≋' }
];
const LOCATORS = [
  { id: 'original', name: 'Padrão', color: '#ffce65' },
  { id: 'yandere', name: 'Yandere', color: '#ff6e9f' },
  { id: 'gotica', name: 'Gótica', color: '#a88cff' },
  { id: 'platinada', name: 'Gatinha', color: '#79e6ef' }
];
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
  mode: 'office', cameraIndex: 0, characterPreviews: new Map(), startedAt: 0,
  officeRoom: new Set(), officeDoorway: null,
  complete: true, flashlight: false, leftClosed: false, pan: 0, targetPan: 0,
  dragging: false, pointerX: null, lastFrame: performance.now(),
  closetTransition: null, closetMouseAtEdge: true, closetTouchX: null,
  clownPhase: -1, radioPlaying: false,
  systems: Object.fromEntries(SYSTEMS.map(({ id }) => [id, 'online'])),
  locators: Object.fromEntries(LOCATORS.map(({ id }) => [id, 'online'])),
  restarts: new Map(), levels: {}, custom: false
};
let toastTimeout;
let flashTimeout;
let nextHudUpdate = 0;
let nextRestartPanelUpdate = 0;
let clockLabel;
let renderedSystems;
let renderedLocators;
let defeatDeadline = 0;
let scareReplay = 0;
let radioPlayback = null;
const playedScares = new Set();
const imageCache = new Map();
const changedCameras = new Set();
let movementChanged = false;
let gateChanged = false;
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
const closetExtras = OFFICE.characters.slice(3).map(id => {
  const image = document.createElement('img');
  image.className = 'closet-extra-layer';
  image.alt = '';
  image.hidden = true;
  dom.closetExtra.append(image);
  return { id, image };
});

function setCorridorCharacters(front = [], back = []) {
  dom.corridorCharacters.replaceChildren(...corridorSlots(front, back).map(({ slot, column }) => {
    const sprite = document.createElement('span');
    sprite.style.backgroundPosition = `${column * 25}% ${slot * 25}%`;
    return sprite;
  }));
}

function announce(message) {
  clearTimeout(toastTimeout);
  dom.toast.textContent = message;
  dom.toast.classList.add('show');
  toastTimeout = setTimeout(() => dom.toast.classList.remove('show'), 2350);
}

function systemOnline(id) {
  return state.systems[id] === 'online';
}

function locatorOnline(id) {
  return state.locators[id] === 'online';
}

function locatorPosition(id) {
  return movement.diagnostics().find(actor => actor.id === id)?.location ?? 'SINAL INDISPONÍVEL';
}

function restartLabel(id, collection) {
  const restart = state.restarts.get(`${collection}:${id}`);
  if (!restart) return null;
  return `${Math.max(0, Math.ceil((restart.endsAt - performance.now()) / 1000))}s`;
}

function renderSystemPanel() {
  const { faults, ventilationRemaining } = movement.snapshot();
  const systemsMarkup = SYSTEMS.map(system => {
    const remaining = restartLabel(system.id, 'system');
    const fault = faults.includes(system.fault);
    const status = fault ? system.fault === 'ventilacao' ? `SABOTADA · ${Math.ceil(ventilationRemaining)}s` : 'SABOTAGEM DETECTADA'
      : remaining ? 'REINICIANDO' : systemOnline(system.id) ? 'ONLINE' : 'OFFLINE';
    return `<article class="system-card ${remaining ? 'restarting' : ''}">
      <span class="system-icon">${system.icon}</span><div><h3>${system.name}</h3><p><i></i>${status}</p></div>
      <button type="button" data-restart-system="${system.id}" ${remaining ? 'disabled' : ''}>${remaining ? `REINICIANDO ${remaining}` : 'REINICIAR'} <small>${controls.restarts.system}s</small></button>
    </article>`;
  }).join('');
  const locatorMarkup = LOCATORS.map(locator => {
    const remaining = restartLabel(locator.id, 'locator');
    const status = remaining ? 'REINICIANDO' : locatorOnline(locator.id) ? 'LOCALIZANDO' : 'SINAL PERDIDO';
    return `<article class="locator-card ${remaining ? 'restarting' : ''}">
      <span class="locator-dot" style="--locator-color:${locator.color}"></span><div><h3>${locator.name}</h3><p>${status}${locatorOnline(locator.id) && !remaining ? ` · ${locatorPosition(locator.id)}` : ''}</p></div>
      <button type="button" data-restart-locator="${locator.id}" ${remaining ? 'disabled' : ''}>${remaining ? `REINICIANDO ${remaining}` : 'REINICIAR'} <small>${controls.restarts.locator}s</small></button>
    </article>`;
  }).join('');
  if (renderedSystems !== systemsMarkup) {
    dom.systemsGrid.innerHTML = renderedSystems = systemsMarkup;
  }
  if (renderedLocators !== locatorMarkup) {
    dom.locatorGrid.innerHTML = renderedLocators = locatorMarkup;
  }
  const allSystemsBusy = SYSTEMS.some(({ id }) => restartLabel(id, 'system'));
  const allLocatorsBusy = LOCATORS.some(({ id }) => restartLabel(id, 'locator'));
  dom.restartAllSystems.disabled = allSystemsBusy;
  dom.restartAllLocators.disabled = allLocatorsBusy;
}

function beginRestart(collection, ids, duration) {
  if (state.complete || ids.some(id => state.restarts.has(`${collection}:${id}`))) return;
  const endsAt = performance.now() + duration * 1000;
  for (const id of ids) {
    state.restarts.set(`${collection}:${id}`, { endsAt, collection, id });
    if (collection === 'system') state.systems[id] = 'restarting';
    else state.locators[id] = 'restarting';
  }
  if (collection === 'system' && ids.includes('audio')) stopRadio();
  renderSystemPanel();
  refreshComputerState();
  announce(`Reiniciando ${ids.length > 1 ? 'os sistemas' : 'o sistema'}...`);
}

function advanceRestarts(now) {
  let changed = false;
  for (const [key, restart] of state.restarts) {
    if (now < restart.endsAt) continue;
    state.restarts.delete(key);
    if (restart.collection === 'system') state.systems[restart.id] = 'online';
    else state.locators[restart.id] = 'online';
    changed = true;
  }
  if (changed) {
    renderSystemPanel();
    refreshComputerState();
    announce('Sistema reiniciado e online.');
  }
}

function trackedActors() {
  return movement.diagnostics().filter(actor => actor.trackable && locatorOnline(actor.id)).map(actor => {
    const camera = CAMERAS.find(cam => actor.camera.split('/').includes(cam.id));
    const room = camera?.room ?? controls.trackingRooms[actor.position];
    return { ...LOCATORS.find(locator => locator.id === actor.id), room };
  });
}

function refreshComputerState() {
  const camerasOnline = systemOnline('cameras');
  dom.cameraOffline.hidden = camerasOnline;
  updateAudioControl();
  map.setTracking(trackedActors());
  if (state.mode === 'cameras') updateCameraFeed(CAMERAS[state.cameraIndex]);
  updateOfficeView();
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

const map = makeCameraMap({
  canvas: $('#map-canvas'),
  maxClosedGates: config.map.maxClosedMapGates,
  canToggleGate: () => state.mode === 'cameras' && !state.complete && systemOnline('doors'),
  onGatesChange: (id, closed) => {
    const cam = CAMERAS[state.cameraIndex];
    const visible = cam.gateStateImages?.gates.includes(id);
    advanceGame(performance.now(), { type: 'gate', id, closed, visible });
    updateOfficeView();
    if (cam.gateStateImages) updateCameraFeed(cam);
    updateMovementDebug();
  },
  onSelect: id => {
    if (state.complete || !systemOnline('cameras')) return;
    changeCamera(id, true);
  }
});
const movement = createMovement(config, {
  emit(event, value) {
    if (event === 'move') {
      movementChanged = true;
      for (const position of config.map.positions) {
        if (position.id === value.from || position.id === value.to) {
          for (const id of position.cameras) changedCameras.add(id);
        }
      }
    } else if (event === 'openGate') {
      if (value === 'leftDoor') state.leftClosed = false;
      else map.openGate(value);
      gateChanged = true;
    } else if (event === 'sabotage') {
      announce('Sabotagem detectada. Consulte o Painel Geral.');
    } else if (event === 'loss') {
      if (value === 'ventilacao') beginVentilationDefeat();
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

function updateOfficeView() {
  const closed = map.isGateClosed(OFFICE.gate);
  if (closed || state.officeRoom.size) state.flashlight = false;
  const illuminated = state.flashlight && corridorInView();
  const view = closed ? 'closed' : illuminated ? 'lit' : 'dark';
  dom.office.dataset.gate = closed ? 'closed' : 'open';
  dom.office.dataset.flashlight = String(illuminated);
  dom.leftDoor.setAttribute('aria-pressed', String(state.leftClosed));
  dom.leftDoor.textContent = `PORTA ESQUERDA · ${state.leftClosed ? 'FECHADA' : 'ABERTA'}`;
  dom.leftDoor.disabled = !systemOnline('doors');
  dom.officeLight.setAttribute('aria-pressed', String(state.flashlight));
  dom.officeLight.disabled = closed || Boolean(state.officeRoom.size);
  dom.corridorCharacters.hidden = !illuminated;
  const source = OFFICE.images[view];
  if (dom.officeArt.getAttribute('src') !== source) dom.officeArt.src = source;
  dom.officeArt.alt = closed
    ? 'Escritório de segurança, portão principal fechado'
    : illuminated
      ? 'Escritório de segurança, portão aberto e corredor iluminado por luz circular'
      : 'Escritório de segurança, portão principal aberto e corredor escuro';

  const occupants = OFFICE.characters.filter(character => state.officeRoom.has(character));
  const room = occupants.slice(0, 3).join('-') || 'vazia';
  const doorway = OFFICE.doorwayCharacters.includes(state.officeDoorway) ? state.officeDoorway : 'vazia';
  const gate = closed ? 'closed' : 'open';
  const closetSource = `./public/images/office/closet/states/${gate}/sala-${room}--porta-${doorway}.webp`;
  if (dom.closetDoorArt.getAttribute('src') !== closetSource) dom.closetDoorArt.src = closetSource;
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
  const actors = movement.cameraActors(cam.id).filter(actor => !controls.unillustratedCameraPositions.includes(actor.position));
  if (!state.characterPreviews.has(cam.id) && cam.id === 'CAM09' && actors.some(actor => actor.stage > 0)) {
    return { key: 'maid-saindo', source: './public/images/cameras/CAM09/states/02-maid-saindo.webp' };
  }
  const key = state.characterPreviews.get(cam.id) ?? cameraStateKey(cam, actors, config.map.stage);
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
  if (!systemOnline('cameras')) {
    dom.feedArt.hidden = true;
    dom.tech.hidden = true;
    dom.cameraOffline.hidden = false;
    return;
  }
  dom.cameraOffline.hidden = true;
  const source = cameraImage(cam);
  if (!source) {
    showTechnical(cam);
    console.warn(`[FNAN] ${cam.id}: combinação sem imagem para a configuração atual.`);
    return;
  }
  dom.tech.hidden = true;
  dom.feedArt.hidden = false;
  dom.feedArt.alt = `Câmera ${cam.id}, cenário noturno`;
  dom.feedArt.onerror = () => {
    if (CAMERAS[state.cameraIndex].id === cam.id && dom.feedArt.getAttribute('src') === source) {
      showTechnical(cam);
      announce(`${cam.id}: imagem não encontrada; exibindo a planta técnica`);
    }
  };
  if (dom.feedArt.getAttribute('src') !== source) dom.feedArt.src = source;
  else if (dom.feedArt.complete && dom.feedArt.naturalWidth === 0) showTechnical(cam);
}

function updateMovementDebug() {
  if (!debugEnabled) return;
  const cam = CAMERAS[state.cameraIndex];
  const { key, gateKey, source } = currentCameraFrame(cam);
  const feed = state.mode === 'cameras'
    ? `${cam.id} · ${key ?? 'sem estado'}${gateKey ? ` · ${gateKey}` : ''}${!source || dom.feedArt.hidden ? ' · planta técnica' : ''}`
    : 'Monitor abaixado';
  const lines = movement.diagnostics().map(actor => {
    const status = state.complete ? 'turno encerrado' : actor.stopped;
    return `${actor.name} [${actor.level}] · ${actor.location} · ${actor.camera} · ${actor.remaining.toFixed(1)} s\n`
      + `  Anterior: ${actor.previous ?? '—'} | Destino: ${actor.destination ?? '—'}\n`
      + `  ${status}`;
  });
  const { counter, floor } = movement.snapshot();
  dom.debug.textContent = [`IA · ${feed}`, `Palhaça · ${counter.toFixed(1)} · piso ${floor}`, ...lines].join('\n');
}

function syncMovement() {
  for (const id of changedCameras) state.characterPreviews.delete(id);
  const cam = CAMERAS[state.cameraIndex];
  if (changedCameras.has(cam.id) || gateChanged) updateCameraFeed(cam);
  if (movementChanged) {
    const { room, doorway, front, back } = movement.officeState();
    setCorridorCharacters(front, back);
    setOfficeCharacterState(room, doorway);
    map.setTracking(trackedActors());
  } else if (gateChanged) {
    updateOfficeView();
  }
  changedCameras.clear();
  movementChanged = gateChanged = false;
}

function changeCamera(id, withSound = false) {
  const index = CAMERAS.findIndex(camera => camera.id === id);
  if (index < 0) return;
  const changed = state.cameraIndex !== index;
  state.cameraIndex = index;
  const cam = CAMERAS[index];
  dom.camNumber.textContent = cam.id.replace('CAM', 'CAM ');
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
  dom.closet.hidden = !hiding;
  dom.desktop.hidden = mode !== 'desktop' && !Object.hasOwn(desktopApps, mode);
  setStartMenu(false);
  if (dom.desktop.hidden) {
    for (const app of Object.values(desktopApps)) resetApp(app);
  } else {
    updateDesktopClock();
  }
  renderDesktopApps();
  dom.hint.hidden = true;
  state.dragging = false;
  state.pointerX = null;
  state.flashlight = false;
  updateOfficeView();
  updateRadioMix();
  if (withSound) playSound('monitor');
  if (watching) {
    changeCamera(CAMERAS[state.cameraIndex].id);
    preloadCamera(CAMERAS[0]);
  }
  if (mode === 'systems') renderSystemPanel();
  refreshComputerState();
  updateMovementDebug();
}

function openComputer() {
  if (state.mode !== 'office' || state.closetTransition) return;
  dom.game.dataset.computerTransition = 'opening';
  setMode('desktop');
  setTimeout(() => {
    delete dom.game.dataset.computerTransition;
  }, 360);
}

function closeComputer() {
  if (dom.desktop.hidden || state.complete) return;
  setMode('office');
  dom.officeMonitor.focus({ preventScroll: true });
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

function renderDesktopApps() {
  for (const [id, app] of Object.entries(desktopApps)) {
    const active = state.mode === id;
    app.task.setAttribute('aria-pressed', String(active));
    if (active) app.panel.dataset.active = '';
    else delete app.panel.dataset.active;
    if (app.open) app.task.dataset.open = '';
    else delete app.task.dataset.open;
  }
}

function showApp(id) {
  if (state.complete || dom.desktop.hidden) return;
  const app = desktopApps[id];
  const fromStart = !dom.startMenu.hidden;
  setStartMenu(false);
  app.open = true;
  app.panel.hidden = false;
  setMode(id);
  if (fromStart) app.task.focus({ preventScroll: true });
}

function setMaximized(app, maximized) {
  if (maximized) app.panel.dataset.maximized = '';
  else delete app.panel.dataset.maximized;
  const label = maximized ? 'Restaurar janela' : 'Maximizar janela';
  app.maximize.title = label;
  app.maximize.setAttribute('aria-label', label);
}

function resetApp(app) {
  app.open = false;
  app.panel.hidden = true;
  setMaximized(app, false);
  app.panel.style.setProperty('--window-x', '');
  app.panel.style.setProperty('--window-y', '');
}

function hideApp(id, close = false) {
  const app = desktopApps[id];
  if (!app || state.complete) return;
  if (close) resetApp(app);
  else app.panel.hidden = true;
  if (state.mode === id) {
    const nextApp = Object.keys(desktopApps).find(key => !desktopApps[key].panel.hidden);
    setMode(nextApp ?? 'desktop');
  } else {
    renderDesktopApps();
  }
  app.task.focus({ preventScroll: true });
}

function updateRadioMix() {
  if (!radioPlayback) return;
  const hiding = state.mode === 'closet';
  // The radio knob is at 70.3% of the panorama. Pan relative to the visible viewport.
  const offset = .203 * dom.officeScene.offsetWidth + state.pan;
  const relative = Math.max(-1, Math.min(1, 2 * offset / (dom.game.clientWidth || 1)));
  const pan = hiding ? (dom.closet.dataset.view === 'door' ? -.55 : .55) : Math.round(relative * 100) / 100;
  sound.mixRadio(radioMusic, pan, hiding);
}

function stopRadio() {
  radioPlayback = null;
  state.radioPlaying = false;
  radioMusic.pause();
  dom.officeRadio.setAttribute('aria-pressed', 'false');
}

function toggleRadio() {
  if (state.complete || state.closetTransition || state.mode !== 'office') return;
  if (!systemOnline('audio')) {
    announce('Sistema de áudio indisponível.');
    return;
  }
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
  const { art, alt } = CLOWN_PHASES[index];
  state.clownPhase = index;
  const source = `./public/images/${art}`;
  if (dom.closetBeam.getAttribute('src') !== source) dom.closetBeam.src = source;
  dom.closetBeam.alt = alt;
  dom.clownPeek.hidden = index !== CLOWN_PHASES.length - 1;
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
  updateRadioMix();
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
  if (kind !== 'turn') {
    advanceGame(now, { type: kind === 'enter' ? 'closetEnter' : 'closetExit' });
    if (state.complete) return;
  }
  const { swap, duration } = controls.closetTransitionsMs[kind];
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
  if (!systemOnline('cameras')) return;
  const next = (state.cameraIndex + direction + CAMERAS.length) % CAMERAS.length;
  changeCamera(CAMERAS[next].id, true);
}

function playCameraAudio() {
  if (state.complete || state.mode !== 'cameras') return;
  if (!systemOnline('audio') || !systemOnline('cameras')) {
    announce('Não foi possível transmitir áudio.');
    return;
  }
  if (!advanceGame(performance.now(), { type: 'cameraAudio' }) || state.complete) {
    announce('Aguarde antes de reproduzir outro som.');
    return;
  }
  playSound('lure', config.effects.cameraAudio.duration);
  updateAudioControl();
  announce(`Som reproduzido em ${CAMERAS[state.cameraIndex].id}.`);
}

function clockHour(elapsedHours) {
  return (night.startHour + elapsedHours) % 12 || 12;
}

function updateClockUI(now) {
  const hours = Math.min(night.hoursToWin, Math.floor(now / night.secondsPerHour));
  const label = clockHour(hours);
  if (clockLabel === label) return;
  clockLabel = label;
  dom.clock.innerHTML = `${label} <small>AM</small>`;
}

function finishShift() {
  state.complete = true;
  clearClosetTransition();
  stopRadio();
  sound.stopLure();
  updateClockUI(night.hoursToWin * night.secondsPerHour);
  $('#shift-time').innerHTML = `${clockHour(night.hoursToWin)}:00 <small>AM</small>`;
  dom.complete.hidden = false;
  dom.restart.focus();
  playSound('finish');
}

function prepareDefeat() {
  state.complete = true;
  stopRadio();
  sound.stopLure();
  state.dragging = false;
  panKeys.clear();
  clearClosetTransition();
  dom.playfield.inert = true;
}

function beginVentilationDefeat() {
  prepareDefeat();
  $('#game-over-status').textContent = 'FALHA DE VENTILAÇÃO';
  setDefeatPhase('flash', performance.now() + controls.jumpscare.flashMs);
}

function beginJumpscare(source) {
  if (source === CLOWN_BOTTOM_IMAGE) {
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
}

function advanceDefeat(now) {
  if (now < defeatDeadline) return;
  const { cycleMs, clownBottomCycleMs, finalHoldMs, flashMs, imageLoadWaitMs } = controls.jumpscare;
  switch (dom.game.dataset.defeat) {
    case 'blackout':
      // Give a cold load time to arrive, but always reach Game Over.
      if (!dom.scareArt.complete && now < defeatDeadline + imageLoadWaitMs) return;
      if (dom.scareArt.naturalWidth > 0) {
        const cycle = dom.game.dataset.scare === 'clown-bottom' ? clownBottomCycleMs : cycleMs;
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

function resetShift() {
  state.startedAt = state.lastFrame = performance.now();
  nextHudUpdate = 0;
  nextRestartPanelUpdate = 0;
  dom.scareSound.pause();
  dom.scareArt.removeAttribute('src');
  dom.gameOver.hidden = true;
  dom.playfield.inert = false;
  delete dom.game.dataset.defeat;
  delete dom.game.dataset.scare;
  delete dom.game.dataset.computerTransition;
  $('#game-over-status').textContent = 'SINAL PERDIDO';
  $('#night-mode').textContent = state.custom ? 'CUSTOM NIGHT' : 'NOITE 01';
  clearTimeout(toastTimeout);
  dom.toast.classList.remove('show');
  dom.threatAlert.hidden = true;
  dom.static.hidden = true;
  sound.stopLure();
  state.leftClosed = false;
  movement.reset(state.levels);
  movementChanged = true;
  gateChanged = false;
  changedCameras.clear();
  state.characterPreviews.clear();
  state.flashlight = false;
  state.systems = Object.fromEntries(SYSTEMS.map(({ id }) => [id, 'online']));
  state.locators = Object.fromEntries(LOCATORS.map(({ id }) => [id, 'online']));
  state.restarts.clear();
  stopRadio();
  setClownPhase(movement.snapshot().clownStage);
  clearClosetTransition();
  setClosetView('door');
  panKeys.clear();
  state.pan = state.targetPan = 0;
  dom.officeScene.style.setProperty('--pan-shift', '0px');
  map.resetGates();
  syncMovement();
  state.complete = false;
  state.mode = 'cameras'; // Force setMode to apply the initial office state.
  dom.complete.hidden = true;
  setMode('office', false);
  changeCamera(CAMERAS[0].id);
  updateClockUI(0);
  dom.hint.hidden = false;
  dom.officeMonitor.focus({ preventScroll: true });
  requestGameFrame();
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

function corridorInView() {
  return Math.abs(state.pan) <= maxPanShift() * controls.observation.corridorPanFraction;
}

function gameInput() {
  const office = state.mode === 'office' && !state.closetTransition;
  const gates = map.closedGateIds();
  if (state.leftClosed) gates.push('leftDoor');
  return {
    gates,
    camera: state.mode === 'cameras' && systemOnline('cameras') ? CAMERAS[state.cameraIndex].id : null,
    leftLook: office && state.pan > maxPanShift() * controls.observation.leftPanFraction,
    corridorLight: office && state.flashlight && !map.isGateClosed(OFFICE.gate) && corridorInView(),
    clownLight: state.mode === 'closet' && dom.closet.dataset.view === 'back' && !dom.closetBeam.hidden,
    radio: state.radioPlaying,
    computer: !dom.desktop.hidden,
    viewMoving: (office && state.pan !== state.targetPan) || state.closetTransition?.kind === 'turn'
  };
}

function updateAudioControl(audio = movement.snapshot().audio) {
  const online = systemOnline('audio') && systemOnline('cameras');
  dom.cameraAudio.disabled = !online || audio.remaining > 0;
  dom.cameraAudio.textContent = !online ? 'ÁUDIO INDISPONÍVEL'
    : audio.camera ? `▸ SOM ATIVO · ${audio.camera} · ${Math.ceil(audio.remaining)}s`
    : audio.remaining > 0 ? `ÁUDIO RECARREGANDO · ${Math.ceil(audio.remaining)}s`
    : '▸ REPRODUZIR SOM NESTA CÂMERA';
}

function advanceGame(now, action) {
  if (state.complete || dom.game.hidden) return false;
  const accepted = movement.advance((now - state.startedAt) / 1000, gameInput, action);
  const frame = movement.snapshot();
  syncMovement();
  dom.static.hidden = !frame.static || !systemOnline('cameras');
  updateClockUI(frame.now);
  if (state.complete) return accepted;
  setClownPhase(frame.clownStage);
  const warnings = [];
  if (state.officeRoom.size) warnings.push(frame.hidden ? 'AGUARDE NO ARMÁRIO' : 'INVASÃO · ENTRE NO ARMÁRIO');
  if (frame.ventilationRemaining !== null) warnings.push(`VENTILAÇÃO SABOTADA · ${Math.ceil(frame.ventilationRemaining)}s`);
  const warning = warnings.join(' / ');
  if (dom.threatAlert.textContent !== warning) dom.threatAlert.textContent = warning;
  dom.threatAlert.hidden = !warnings.length;
  return accepted;
}

let gameFrame;
function requestGameFrame() {
  gameFrame ??= requestAnimationFrame(tick);
}

function tick(now) {
  gameFrame = undefined;
  const delta = Math.min(100, Math.max(0, now - state.lastFrame));
  state.lastFrame = now;
  if (!state.complete) {
    advanceRestarts(now);
    advanceClosetTransition(now);
    if (state.mode === 'office') moveCamera(delta);
    advanceGame(performance.now());
    if (state.flashlight && dom.office.dataset.flashlight !== String(corridorInView())) updateOfficeView();
    updateRadioMix();
    if (now >= nextHudUpdate) {
      const frame = movement.snapshot();
      updateAudioControl(frame.audio);
      if (!dom.desktop.hidden) updateDesktopClock();
      updateMovementDebug();
      nextHudUpdate = now + 200;
    }
    if (state.mode === 'systems' && now >= nextRestartPanelUpdate) {
      renderSystemPanel();
      nextRestartPanelUpdate = now + 250;
    }
  }
  if (dom.game.dataset.defeat) advanceDefeat(now);
  if (!state.complete || (dom.game.dataset.defeat && dom.game.dataset.defeat !== 'over')) requestGameFrame();
}

document.addEventListener('visibilitychange', () => advanceGame(performance.now()));
dom.officeMonitor.addEventListener('click', () => {
  if (state.mode === 'office') openComputer();
});
dom.officeCloset.addEventListener('click', () => beginClosetTransition('enter'));
dom.officeRadio.addEventListener('click', toggleRadio);
function setRadioPlaying(on) {
  state.radioPlaying = on;
  advanceGame(performance.now());
}
radioMusic.addEventListener('playing', () => setRadioPlaying(Boolean(radioPlayback)));
radioMusic.addEventListener('waiting', () => setRadioPlaying(false));
radioMusic.addEventListener('pause', () => { if (radioMusic.paused) setRadioPlaying(false); });
radioMusic.addEventListener('error', stopRadio);
dom.closetExit.addEventListener('click', () => beginClosetTransition('exit'));
dom.closetLight.addEventListener('click', toggleClosetLight);
dom.leftDoor.addEventListener('click', toggleLeftDoor);
dom.officeLight.addEventListener('click', toggleFlashlight);
for (const [id, app] of Object.entries(desktopApps)) {
  $('#open-' + id).addEventListener('click', () => showApp(id));
  $('#start-' + id).addEventListener('click', () => showApp(id));
  app.task.addEventListener('click', () => state.mode === id ? hideApp(id) : showApp(id));
  app.panel.addEventListener('pointerdown', () => showApp(id));
  app.panel.addEventListener('focusin', () => showApp(id));
  $('#minimize-' + id).addEventListener('click', () => hideApp(id));
  $('#close-' + id).addEventListener('click', () => hideApp(id, true));

  const toggleMaximized = () => setMaximized(app, app.panel.dataset.maximized === undefined);
  app.maximize.addEventListener('click', toggleMaximized);
  app.titlebar.addEventListener('dblclick', event => {
    if (!event.target.closest('button')) toggleMaximized();
  });

  let drag;
  app.titlebar.addEventListener('pointerdown', event => {
    if (!event.isPrimary || event.button !== 0 || event.target.closest('button')
        || app.panel.dataset.maximized !== undefined) return;
    drag = {
      pointer: event.pointerId,
      x: event.clientX - app.panel.offsetLeft,
      y: event.clientY - app.panel.offsetTop
    };
    app.titlebar.setPointerCapture(event.pointerId);
  });
  app.titlebar.addEventListener('pointermove', event => {
    if (drag?.pointer !== event.pointerId) return;
    const workspace = app.panel.parentElement;
    const x = Math.max(0, Math.min(workspace.clientWidth - app.panel.offsetWidth, event.clientX - drag.x));
    const y = Math.max(0, Math.min(workspace.clientHeight - app.panel.offsetHeight, event.clientY - drag.y));
    app.panel.style.setProperty('--window-x', x + 'px');
    app.panel.style.setProperty('--window-y', y + 'px');
  });
  app.titlebar.addEventListener('lostpointercapture', () => { drag = null; });
}
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
  for (const app of Object.values(desktopApps)) app.panel.hidden = true;
  setStartMenu(false);
  setMode('desktop');
});
dom.cameraAudio.addEventListener('click', playCameraAudio);
dom.closeDesktop.addEventListener('click', closeComputer);
dom.systemsGrid.addEventListener('click', event => {
  const button = event.target.closest('[data-restart-system]');
  if (!button) return;
  beginRestart('system', [button.dataset.restartSystem], controls.restarts.system);
});
dom.locatorGrid.addEventListener('click', event => {
  const button = event.target.closest('[data-restart-locator]');
  if (!button) return;
  beginRestart('locator', [button.dataset.restartLocator], controls.restarts.locator);
});
dom.restartAllSystems.addEventListener('click', () => beginRestart('system', SYSTEMS.map(({ id }) => id), controls.restarts.allSystems));
dom.restartAllLocators.addEventListener('click', () => beginRestart('locator', LOCATORS.map(({ id }) => id), controls.restarts.allLocators));
dom.restart.addEventListener('click', resetShift);
$('#retry-night').addEventListener('click', resetShift);
function returnToMenu() {
  dom.scareSound.pause();
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
  if (event.target === dom.officeRadio) {
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

function toggleLeftDoor() {
  if (state.complete || state.mode !== 'office' || state.closetTransition || !systemOnline('doors')) return;
  state.leftClosed = !state.leftClosed;
  advanceGame(performance.now(), { type: 'gate', id: 'leftDoor', closed: state.leftClosed });
  updateOfficeView();
}

function toggleFlashlight() {
  if (state.complete || state.mode !== 'office' || state.closetTransition
      || state.officeRoom.size || map.isGateClosed(OFFICE.gate)) return;
  state.flashlight = !state.flashlight;
  updateOfficeView();
}

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
  if (state.closetTransition) return;
  if (state.mode === 'closet') {
    if (key === 'w') {
      event.preventDefault();
      if (!event.repeat) toggleClosetLight();
    } else if (['a', 'd', 'arrowleft', 'arrowright'].includes(key)) {
      event.preventDefault();
      if (!event.repeat) beginClosetTransition('turn');
    }
  } else if (key === 'f' && state.mode === 'office') {
    event.preventDefault();
    if (!event.repeat) toggleFlashlight();
  } else if (key === 'q' && state.mode === 'office') {
    event.preventDefault();
    if (!event.repeat) toggleLeftDoor();
  } else if (key === 'escape') {
    if (!dom.startMenu.hidden) {
      event.preventDefault();
      setStartMenu(false);
      dom.openStart.focus({ preventScroll: true });
    } else if (Object.hasOwn(desktopApps, state.mode)) {
      event.preventDefault();
      hideApp(state.mode);
    } else if (state.mode === 'desktop') {
      event.preventDefault();
      closeComputer();
    }
  } else if ((state.mode === 'cameras' || state.mode === 'office') && (key === 'arrowleft' || key === 'arrowright')) {
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
  advanceGame(performance.now());
});
for (const event of ['click', 'keydown', 'keyup', 'focusin']) {
  document.addEventListener(event, () => advanceGame(performance.now()));
}
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

function startShift(levels, custom) {
  state.levels = levels;
  state.custom = custom;
  dom.game.hidden = false;
  resetShift();
  preloadImages(Object.values(OFFICE.images));
  preloadImages(CLOWN_PHASES.map(({ art }) => `./public/images/${art}`));
  // Load state variants before the player starts toggling their gates.
  for (const cam of CAMERAS) if (cam.gateStateImages) preloadCamera(cam);
}

const menu = createNightMenu(config, {
  startShift, enterImmediately,
  onEnter: () => preloadImages([...JUMPSCARE_IMAGES, CLOWN_BOTTOM_IMAGE])
});
dom.restartAllSystems.querySelector('small').textContent = `${controls.restarts.allSystems}s`;
dom.restartAllLocators.querySelector('small').textContent = `${controls.restarts.allLocators}s`;

})();
