(async () => {
'use strict';
const {
  CAMERAS, OFFICE, makeCameraMap, SoundEngine, createMovement, createNightMenu,
  cameraActorFrame, characterStateImages, officeCharacterImage, corridorSlots, loadConfig,
  createImageCache, clearImageSource, setImageSource, createCameraInterference
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
const { controls } = config;
const radioMusic = $('#radio-music');
const dom = {
  game: $('#game'), office: $('#office-view'), cameras: $('#cameras-view'), desktop: $('#computer-desktop'),
  computerScreen: $('#computer-screen'),
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
  feedArt: $('#feed-art'), tech: $('#technical-feed'), cameraScare: $('#camera-scare'),
  techArt: $('#technical-art'), techNumber: $('#technical-number'),
  camNumber: $('#cam-number'), cameraOffline: $('#camera-offline'), cameraAudio: $('#camera-audio'),
  static: $('#camera-static'), threatAlert: $('#threat-alert'),
  closeDesktop: $('#close-desktop'), openStart: $('#open-start'), startMenu: $('#start-menu'),
  taskTime: $('#task-time'), taskDate: $('#task-date'),
  clock: $('#clock-label'),
  resourceHud: $('#resource-hud'), sanityMeter: $('#sanity-meter'), sanityValue: $('#sanity-value'),
  volumeDetector: $('#volume-detector'), volumeTrace: $('#volume-trace'),
  energyMeter: $('#energy-meter'), energyValue: $('#energy-value'),
  shadowManifest: $('#shadow-manifest'), shadowOfficeArt: $('#shadow-office-art'),
  shadowFeed: $('#shadow-feed'), shadowSprite: $('#shadow-sprite'),
  hint: $('#initial-hint'),
  toast: $('#toast'), complete: $('#shift-complete'), restart: $('#restart-shift'), nextShift: $('#next-shift'),
  debug: $('#movement-debug')
};

const cameraApp = {
  panel: dom.cameras,
  task: $('#taskbar-cameras'),
  titlebar: $('#cameras-titlebar'),
  maximize: $('#maximize-cameras'),
  launch: $('#camera-launch'),
  launchEndAt: null,
  open: false
};
const desktopTime = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' });
const desktopDate = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
let lastDesktopMinute;

const CLOWN_RIGHT_IMAGE = './public/images/jumpscares/palhaca-direita.gif';
const CLOWN_BOTTOM_IMAGE = './public/images/jumpscares/palhaca-baixo.gif';
const SHADOW_IMAGE = config.shadow.jumpscare;
const JUMPSCARE_AUDIO = './public/audio/jumpscares/';
const { corridorAttackSound, flashlight } = config.effects;
const corridorSoundVoices = Object.keys(config.characters).length;
const cameraScareImage = config.threats.yandereCameraScare.image;
const MONITOR_TRANSITION_MS = { boot: 6500, shutdown: 2000 };
const CAMERA_LAUNCH_MS = 1500;
let computerTransitionTimer;
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
// Browsers unlock audio after the first interaction with the game.
function unlockAudio() {
  for (const event of ['click', 'keydown']) document.removeEventListener(event, unlockAudio, true);
  sound.enable();
}
for (const event of ['click', 'keydown']) {
  document.addEventListener(event, unlockAudio, { capture: true });
}

const state = {
  mode: 'office', computerMode: 'desktop', monitorTransition: null, cameraIndex: 0, characterPreviews: new Map(), startedAt: 0,
  officeRoom: new Set(), officeDoorway: null,
  complete: true, flashlight: false, flashlightKey: false, flashlightPointer: null, pan: 0, targetPan: 0,
  dragging: false, pointerX: null, lastFrame: performance.now(),
  closetTransition: null, closetMouseAtEdge: true, closetGesture: null, closetPan: 0, closetTarget: 0,
  clownPhase: -1, radioPlaying: false,
  shift: null
};
let toastTimeout;
let nextHudUpdate = 0;
let nextDebugUpdate = 0;
let nextDesktopUpdate = 0;
let clockLabel;
let defeatDeadline = 0;
let scareRequest;
let scareObjectUrl;
let radioPlayback = null;
let radioMixPan;
let radioMixHiding;
const playedScares = new Map();
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
let renderedGoticaStaticAt;
let corridorFlickerTimer;
let cameraScareRequest;
let cameraScareBlob;
let cameraScareUrl;
let cameraScarePlays = 0;
const params = new URLSearchParams(window.location?.search);
const developerDebug = params.get('debug') === '1';
const debugEnabled = () => state.shift?.debug ?? developerDebug;
const debugRows = new Map();
const debugActors = $('#movement-debug-actors');
const debugClown = $('#movement-debug-clown');
const debugProgress = $('#movement-debug-progress');
const debugSmores = $('#movement-debug-smores');
const debugPercent = new Intl.NumberFormat('pt-BR', { style: 'percent', maximumFractionDigits: 2 });

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
  const next = CAMERAS[(state.cameraIndex + 1) % CAMERAS.length];
  alternatives.push(currentCameraFrame(next).source);
  imageCache.warmForView(alternatives.filter(alternative => alternative !== source));
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
    } else if (event === 'corridorFlicker') {
      if (corridorFlickerTimer !== undefined || state.mode !== 'office' || document.hidden
          || !state.flashlight || !corridorInView()) return;
      dom.office.toggleAttribute('data-flashlight-flicker', true);
      corridorFlickerTimer = setTimeout(clearCorridorFlicker, flashlight.corridorFlickerMs);
    } else if (event === 'corridorAttack') {
      const { files, volume } = corridorAttackSound;
      sound.playSample(files[Math.floor(Math.random() * files.length)], volume, corridorSoundVoices);
    } else if (event === 'cameraScareStart') {
      nextHudUpdate = 0;
      dom.cameraScare.hidden = false;
      if (cameraScareBlob) cameraScareUrl = URL.createObjectURL(cameraScareBlob);
      const replaySource = cameraScarePlays ? `${cameraScareImage}?replay=${cameraScarePlays % 2}` : cameraScareImage;
      dom.cameraScare.src = cameraScareUrl ?? replaySource;
      cameraScarePlays++;
      cameraApp.panel.inert = true;
    } else if (event === 'cameraScareEnd') {
      clearCameraScare();
      clearMonitorTransition();
      clearCameraLaunch();
      clearCameraInterference();
      goticaStaticAt = undefined;
      updateCameraFeed(CAMERAS[state.cameraIndex]);
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
  const lightBlocked = closed || state.officeRoom.size > 0 || !movement.flashlightAvailable();
  if (lightBlocked && state.flashlight) {
    state.flashlight = state.flashlightKey = false;
    state.flashlightPointer = null;
  }
  const illuminated = state.flashlight && corridorInView();
  const view = closed ? 'closed' : illuminated ? 'lit' : 'dark';
  const doorsOnline = movement.gateControlsAvailable();
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
  clearImageSource(dom.feedArt);
  dom.tech.hidden = false;
  setImageSource(dom.techArt, cam.technical);
  setText(dom.techNumber, cam.id.replace('CAM', 'CAM '));
}

function currentCameraFrame(cam, actors = movement.cameraActors(cam.id)) {
  return cameraActorFrame(cam, actors, config, movement.isGateClosed, state.characterPreviews.get(cam.id));
}

function clearCorridorFlicker() {
  if (corridorFlickerTimer === undefined) return;
  clearTimeout(corridorFlickerTimer);
  corridorFlickerTimer = undefined;
  dom.office.toggleAttribute('data-flashlight-flicker', false);
}

function clearCameraScare() {
  dom.cameraScare.hidden = true;
  clearImageSource(dom.cameraScare);
  if (cameraScareUrl) URL.revokeObjectURL(cameraScareUrl);
  cameraScareUrl = undefined;
  cameraApp.panel.inert = false;
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
    imageCache.cancelPending();
    clearImageSource(dom.feedArt);
    clearImageSource(dom.techArt);
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
  clearImageSource(dom.techArt);
  dom.feedArt.hidden = false;
  const alt = `Câmera ${cam.id}, cenário noturno`;
  if (dom.feedArt.alt !== alt) dom.feedArt.alt = alt;
  const changed = dom.feedArt.getAttribute('src') !== source;
  setImageSource(dom.feedArt, source, () => {
    if (!movement.camerasAvailable() || CAMERAS[state.cameraIndex] !== cam) return;
    showTechnical(cam);
    announce(`${cam.id}: imagem não encontrada; exibindo a planta técnica`);
  }, () => {
    if (watchingCameras() && CAMERAS[state.cameraIndex] === cam) imageCache.markLoaded(source);
  });
  if ((changed || warm) && watchingCameras()) {
    warmCamera(cam, actors, source);
  }
}

function updateMovementDebug() {
  if (!debugEnabled()) return;
  const { actors, clown, smores } = movement.debugSnapshot();
  for (const actor of actors) {
    if (!debugRows.has(actor.key)) {
      const group = document.createElement('tbody');
      group.className = 'debug-actor';
      group.dataset.actor = actor.key;
      const row = document.createElement('tr');
      const name = document.createElement('th');
      name.setAttribute('scope', 'rowgroup');
      name.textContent = actor.name.replace(/^Nathzinha /, '');
      const cells = Array.from({ length: 3 }, () => document.createElement('td'));
      row.append(name, ...cells);
      const detail = document.createElement('tr');
      const details = document.createElement('td');
      details.setAttribute('colspan', '4');
      const status = document.createElement('div');
      status.className = 'debug-status';
      const odds = document.createElement('div');
      odds.className = 'debug-odds';
      const routes = document.createElement('div');
      routes.className = 'debug-odds';
      const expiry = document.createElement('div');
      expiry.className = 'debug-odds debug-expiry';
      const attack = document.createElement('div');
      attack.className = 'debug-status';
      const attackOdds = document.createElement('div');
      attackOdds.className = 'debug-odds';
      details.append(status, routes, odds, expiry, attack, attackOdds);
      detail.append(details);
      group.append(row, detail);
      debugActors.append(group);
      debugRows.set(actor.key, [...cells, status, routes, odds, expiry, attack, attackOdds]);
    }
    const [position, route, target, status, routes, odds, expiry, attack, attackOdds] = debugRows.get(actor.key);
    setText(position, actor.location);
    setText(route, actor.route);
    setText(target, positions.get(actor.target)?.name ?? '—');
    const required = positions.get(actor.required)?.name ?? '—';
    const progress = actor.completed ? 'concluída' : positions.get(actor.lastReached)?.name ?? '—';
    const routeDetails = actor.route !== 'Sem rota' && actor.bonus !== null
      ? ` · início ${required} · progresso ${progress} · bônus +${actor.bonus}%` : '';
    setText(status, actor.status + routeDetails);
    renderDebugOdds(routes, actor.routeOdds, 'Sorteio de rota');
    renderDebugOdds(odds, actor.odds);
    renderDebugOdds(expiry, actor.expiryOdds, 'Se expirar');
    const path = { corridor: 'corredor', stock: 'estoque' }[actor.attackPath] ?? '—';
    setText(attack, `Ataque ${actor.attackActive ? 'ativo' : 'inativo'} · ${path}`
      + ` · barulho ${actor.noise.toFixed(1)} / ${config.effects.noise.max} · lanterna ${debugPercent.format(actor.light)}`);
    const chances = actor.attackOdds;
    renderDebugOdds(attackOdds, chances ? { Avançar: chances.advance, Permanecer: chances.stay,
      Recuar: chances.abandon, ...(chances.blocked > 0 && { Bloqueio: chances.blocked }) } : {});
  }
  setText(debugClown, `Palhaça · ${clown.counter.toFixed(1)} / ${clown.max} · ${clown.status}`);
  debugProgress.max = clown.max;
  debugProgress.value = clown.counter;
  const phase = {
    disabled: 'inativo', idle: 'inativo', 'pre-vent': 'aguardando acesso à ventilação',
    vent: smores.retreatReady ? 'ventilação · pronto para recuar' : 'ventilação',
    room: 'sala'
  }[smores.phase];
  const timer = { idle: 'teste com rádio', vent: 'silêncio restante', room: 'saída' }[smores.phase];
  const remaining = smores.remaining > 0
    ? ` · ${timer} ${smores.remaining.toFixed(1)} s${smores.phase === 'vent' && smores.radio ? ' (rádio ligado)' : ''}`
    : '';
  setText(debugSmores, `Smores · ${phase}${smores.phase === 'vent' && smores.looking ? ' · sob observação' : ''}${remaining}`);
}

function renderDebugOdds(container, odds, prefix) {
  const labels = Object.entries(odds).map(([label, value]) => `${label} · ${debugPercent.format(value)}`);
  if (prefix && labels.length) labels.unshift(prefix);
  if (container.children.length !== labels.length) {
    container.replaceChildren(...labels.map(() => document.createElement('span')));
  }
  labels.forEach((label, index) => setText(container.children[index], label));
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
    for (const [pose, image] of [['vent', dom.smoresVent], ['room', dom.smoresRoom]]) {
      if (smores === pose && !image.getAttribute('src')) image.src = SMORES_ART[pose];
      image.hidden = smores !== pose;
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
  return !state.complete && state.mode === 'cameras' && !state.monitorTransition
    && movement.camerasAvailable() && !document.hidden;
}

function clearCameraInterference() {
  interference.clear();
  renderedGoticaStaticAt = undefined;
}

function changeCamera(id, withSound = false) {
  const index = CAMERAS.findIndex(camera => camera.id === id);
  if (index < 0) return;
  const changed = state.cameraIndex !== index;
  if (changed) movement.interruptCameraObservation();
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
  }
  if (withSound && changed) sound.switch();
}

function setMode(mode, withSound = true, force = false) {
  if (!force && (state.complete || state.mode === mode)) return;
  const watching = mode === 'cameras';
  const hiding = mode === 'closet';
  if (state.mode === 'cameras' && !watching) movement.interruptCameraObservation();
  state.mode = mode;
  if (!watching) {
    clearCameraInterference();
    imageCache.cancelPending();
    map.clearAudioPulses();
    clearCameraGesture();
  }
  dom.game.dataset.mode = mode;
  dom.office.hidden = mode !== 'office';
  dom.closet.hidden = !hiding;
  dom.desktop.hidden = mode !== 'desktop' && !watching;
  if (!watching) delete cameraApp.panel.dataset.opening;
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
  if (withSound) sound.monitor();
  if (watching && !dom.computerScreen.inert) {
    changeCamera(CAMERAS[state.cameraIndex].id);
  }
  updateAudioControl();
  updateOfficeView();
  updateMovementDebug();
}

function openComputer() {
  if (state.mode !== 'office' || state.closetTransition || state.complete) return;
  if (state.monitorTransition || cameraApp.launchEndAt !== null) {
    const now = performance.now();
    advanceGame(now);
    if (state.monitorTransition) {
      dom.computerScreen.style.setProperty('--monitor-delay', `${state.monitorTransition.startedAt - now}ms`);
    }
  }
  setMode(state.computerMode);
}

function closeComputer() {
  if (dom.desktop.hidden || state.complete) return;
  setMode('office');
  advanceGame(performance.now(), { type: 'returnToOffice', source: 'computer' });
  dom.officeMonitor.focus({ preventScroll: true });
}

function toggleComputerPower() {
  if (state.complete || state.closetTransition || !dom.cameraScare.hidden) return;
  const now = performance.now();
  if (state.monitorTransition) {
    advanceGame(now);
    if (state.monitorTransition || state.complete) return;
  }
  const wasOn = movement.snapshot().computerOn;
  advanceGame(now, { type: 'computerPower' });
  const { computerOn, blackout } = movement.snapshot();
  if (state.complete || blackout || wasOn === computerOn) return;

  const phase = wasOn ? 'shutdown' : 'boot';
  const duration = MONITOR_TRANSITION_MS[phase];
  clearCameraLaunch();
  clearCameraGesture();
  delete cameraApp.panel.dataset.opening;
  state.monitorTransition = { startedAt: now, endAt: now + duration };
  dom.computerScreen.style.setProperty('--monitor-duration', `${duration}ms`);
  dom.computerScreen.style.setProperty('--monitor-delay', '0ms');
  dom.game.dataset.monitorTransition = phase;
  dom.computerScreen.inert = true;
  setStartMenu(false);
  scheduleComputerTransition();
  if (!dom.desktop.hidden) dom.desktopPower.focus({ preventScroll: true });
  clearCameraInterference();
  imageCache.cancelPending();
}

function clearMonitorTransition() {
  if (!state.monitorTransition) return;
  clearTimeout(computerTransitionTimer);
  state.monitorTransition = null;
  delete dom.game.dataset.monitorTransition;
  dom.computerScreen.style.setProperty('--monitor-duration', '');
  dom.computerScreen.style.setProperty('--monitor-delay', '');
}

function scheduleComputerTransition() {
  const deadline = state.monitorTransition?.endAt ?? cameraApp.launchEndAt;
  if (deadline === null) return;
  computerTransitionTimer = setTimeout(() => {
    advanceGame(performance.now());
    scheduleComputerTransition();
  }, Math.ceil(deadline - performance.now()));
}

function advanceComputerTransition(now) {
  if (cameraApp.launchEndAt !== null && now >= cameraApp.launchEndAt) {
    clearCameraLaunch();
    cameraApp.open = true;
    cameraApp.panel.hidden = false;
    if (dom.desktop.hidden) state.computerMode = 'cameras';
    else {
      cameraApp.panel.dataset.opening = '';
      setMode('cameras');
    }
  }
  if (!state.monitorTransition || now < state.monitorTransition.endAt) return;
  clearMonitorTransition();
  dom.computerScreen.inert = !movement.snapshot().computerOn;
  if (state.mode === 'cameras' && !dom.computerScreen.inert) {
    changeCamera(CAMERAS[state.cameraIndex].id);
  }
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
  const now = performance.now();
  if (state.monitorTransition || cameraApp.launchEndAt !== null) advanceGame(now);
  if (state.complete || dom.desktop.hidden || dom.computerScreen.inert || cameraApp.launchEndAt !== null) return;
  const fromStart = !dom.startMenu.hidden;
  setStartMenu(false);
  if (cameraApp.open) {
    cameraApp.panel.hidden = false;
    setMode('cameras');
  } else {
    cameraApp.launchEndAt = now + CAMERA_LAUNCH_MS;
    cameraApp.launch.hidden = false;
    scheduleComputerTransition();
  }
  if (fromStart) cameraApp.task.focus({ preventScroll: true });
}

function clearCameraLaunch() {
  if (cameraApp.launchEndAt !== null) clearTimeout(computerTransitionTimer);
  cameraApp.launchEndAt = null;
  cameraApp.launch.hidden = true;
}

function setMaximized(maximized) {
  if (maximized) cameraApp.panel.dataset.maximized = '';
  else delete cameraApp.panel.dataset.maximized;
  const label = maximized ? 'Restaurar janela' : 'Maximizar janela';
  cameraApp.maximize.title = label;
  cameraApp.maximize.setAttribute('aria-label', label);
}

function resetCameraApp() {
  clearCameraLaunch();
  delete cameraApp.panel.dataset.opening;
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
  const closetPan = -.55 * Math.cos(state.closetPan * Math.PI);
  const pan = Math.round((hiding ? closetPan : relative) * 100) / 100;
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
  if (radioMusic.getAttribute('src') !== null) {
    radioMusic.removeAttribute('src');
    radioMusic.load?.();
  }
  sound.disconnectRadio();
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
  index = Math.max(0, index);
  if (state.clownPhase === index) return;
  state.clownPhase = index;
  dom.clownPeek.hidden = index !== CLOWN_PHASES.length - 1;
  const { art, alt } = CLOWN_PHASES[index];
  const source = CLOWN_ART + art;
  if (dom.closetBeam.getAttribute('src') !== source) dom.closetBeam.src = source;
  dom.closetBeam.alt = alt;
}

function setClosetLight(on) {
  dom.closetBeam.hidden = !on;
  dom.closetLight.setAttribute('aria-pressed', String(on));
}

function setClosetView(view) {
  if (dom.closet.dataset.view === view) return;
  dom.closet.dataset.view = view;
  dom.closetExit.hidden = view !== 'door';
  dom.closetLight.hidden = view !== 'back';
  clearFlashlight();
  if (state.mode === 'closet') {
    sound.setSampleLoop('musicBox', view === 'back' ? .065 : .035);
    dom.closet.focus({ preventScroll: true });
  }
}

function flashlightTarget() {
  if (state.complete || state.closetTransition || !movement.flashlightAvailable()) return null;
  if (state.mode === 'office' && !dom.officeLight.disabled) return dom.officeLight;
  if (state.mode === 'closet' && !dom.closetLight.hidden) return dom.closetLight;
  return null;
}

function updateFlashlight() {
  const held = state.flashlightKey || state.flashlightPointer !== null;
  const target = flashlightTarget();
  const wasOn = state.flashlight || dom.closetLight.getAttribute('aria-pressed') === 'true';
  state.flashlight = held && target === dom.officeLight;
  if (!state.flashlight) clearCorridorFlicker();
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
  advanceGame(now, { type: kind === 'enter' ? 'closetEnter' : 'closetExit' });
  if (state.complete) return;
  const { swap, duration } = controls.closetTransitionsMs[kind];
  state.closetTransition = { kind, swapAt: now + swap, endAt: now + duration };
  clearFlashlight();
  state.closetGesture = null;
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
        resetClosetPan();
        setMode('closet', false);
        sound.setSampleLoop('musicBox', .035);
        dom.closet.focus({ preventScroll: true });
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
  map.pulseAudio(CAMERAS[state.cameraIndex].id);
  updateAudioControl();
  announce(`Som reproduzido em ${CAMERAS[state.cameraIndex].id}.`);
}

function clockHour(elapsedHours) {
  return (state.shift.rules.startHour + elapsedHours) % 12 || 12;
}

function updateClockUI(progress) {
  const hours = Math.min(state.shift.rules.hoursToWin, Math.floor(progress + 1e-12));
  const label = clockHour(hours);
  if (clockLabel === label) return;
  clockLabel = label;
  dom.clock.innerHTML = `${label} <small>AM</small>`;
}

function finishShift() {
  stopShift();
  releaseShiftImages();
  const { number, rules: { hoursToWin } } = state.shift;
  const campaignComplete = number === config.night.campaign.length;
  if (number) menu.recordWin(number);
  updateClockUI(hoursToWin);
  $('#shift-time').innerHTML = `${clockHour(hoursToWin)}:00 <small>AM</small>`;
  $('#shift-result').textContent = campaignComplete ? 'Campanha concluída.' : 'O turno terminou.';
  $('#shift-message').textContent = campaignComplete ? 'Você sobreviveu às nove noites.' : 'Noite concluída.';
  dom.nextShift.hidden = !number || campaignComplete;
  dom.complete.hidden = false;
  (dom.nextShift.hidden ? dom.restart : dom.nextShift).focus();
  sound.playSample('chimes');
}

function stopShift() {
  state.complete = true;
  movement.stop();
  clearTimeout(toastTimeout);
  dom.toast.classList.remove('show');
  clearCameraInterference();
  clearCorridorFlicker();
  clearCameraScare();
  releaseCameraScarePreload();
  imageCache.clear();
  map.clearAudioPulses();
  clearCameraGesture();
  goticaStaticAt = undefined;
  cancelGameFrame();
  dom.resourceHud.hidden = dom.shadowManifest.hidden = dom.shadowOfficeArt.hidden = dom.shadowFeed.hidden = true;
  renderVolume(0);
  dom.sanityMeter.style.removeProperty('--meter-color');
  dom.energyMeter.style.removeProperty('--meter-color');
  dom.energyMeter.classList.remove('low');
  delete dom.shadowFeed.dataset.phase;
  clearFlashlight();
  stopRadio();
  sound.stopShift();
  state.dragging = false;
  state.closetGesture = null;
  clearClosetTransition();
  clearMonitorTransition();
  clearCameraLaunch();
  delete cameraApp.panel.dataset.opening;
}

function releaseShiftImages() {
  for (const image of [dom.feedArt, dom.techArt, dom.shadowOfficeArt, dom.shadowSprite,
    dom.smoresRoom, dom.smoresVent, ...officeLayers.map(layer => layer.image),
    ...closetExtras.map(layer => layer.image)]) clearImageSource(image);
  closetArtKey = undefined;
}

function prepareDefeat() {
  stopShift();
  dom.playfield.inert = true;
}

function clearJumpscareArt() {
  scareRequest?.abort();
  scareRequest = undefined;
  clearImageSource(dom.scareArt);
  if (scareObjectUrl) URL.revokeObjectURL(scareObjectUrl);
  scareObjectUrl = undefined;
}

function clearJumpscareSound() {
  dom.scareSound.pause();
  if (dom.scareSound.getAttribute('src') === null) return;
  dom.scareSound.removeAttribute('src');
  dom.scareSound.load?.();
}

function loadJumpscare(source) {
  if (!playedScares.has(source) || !source.endsWith('.gif')) {
    playedScares.set(source, 0);
    dom.scareArt.src = source;
    return;
  }
  const replay = () => {
    // File URLs and failed fetches use two alternating identities for the same file.
    const variant = playedScares.get(source) ^ 1;
    playedScares.set(source, variant);
    dom.scareArt.src = `${source}?replay=${variant}`;
  };
  if (!/^https?:$/.test(window.location.protocol) || !URL.createObjectURL) {
    replay();
    return;
  }
  // Restart the one-shot GIF with a new image identity while reusing the HTTP URL.
  const request = scareRequest = new AbortController();
  fetch(source, { signal: request.signal }).then(response => {
    if (!response.ok) throw new Error('Falha ao carregar a animação');
    return response.blob();
  }).then(blob => {
    if (scareRequest !== request) return;
    scareRequest = undefined;
    scareObjectUrl = URL.createObjectURL(blob);
    dom.scareArt.src = scareObjectUrl;
  }).catch(() => {
    if (scareRequest !== request) return;
    scareRequest = undefined;
    replay();
  });
}

function beginJumpscare(source) {
  let audio = 'scream.wav';
  if (source === SHADOW_IMAGE) {
    dom.game.dataset.scare = 'shadow';
    audio = 'shadow.ogg';
  } else if (source === CLOWN_BOTTOM_IMAGE || source === CLOWN_RIGHT_IMAGE) {
    audio = 'palha%C3%A7a.ogg';
    if (source === CLOWN_BOTTOM_IMAGE) {
      dom.game.dataset.scare = 'clown-bottom';
      setClosetLight(false);
    } else setMode('office', false);
  }
  prepareDefeat();
  loadJumpscare(source);
  setDefeatPhase('blackout', performance.now() + controls.jumpscare.blackoutMs);
  const audioSource = JUMPSCARE_AUDIO + audio;
  if (dom.scareSound.getAttribute('src') !== audioSource) dom.scareSound.src = audioSource;
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
      if ((scareRequest || !dom.scareArt.complete) && now < defeatDeadline + imageLoadWaitMs) return;
      if (dom.scareArt.naturalWidth > 0) {
        const cycle = dom.game.dataset.scare === 'shadow' ? config.shadow.jumpscareMs
          : dom.game.dataset.scare === 'clown-bottom' ? clownBottomCycleMs : cycleMs;
        setDefeatPhase('scare', now + cycle + finalHoldMs);
        break;
      }
      // Missing art still leads to the flash and the end of the night.
    case 'scare':
      setDefeatPhase('flash', now + flashMs);
      clearJumpscareArt();
      break;
    case 'flash':
      dom.game.dataset.defeat = 'over';
      releaseShiftImages();
      dom.gameOver.hidden = false;
      $('#retry-night').focus();
      break;
  }
}

function prepareShift(shift) {
  state.shift = shift;
  dom.debug.hidden = !debugEnabled();
  dom.game.hidden = false;
  measureViewport();
  cancelGameFrame();
  clearCameraInterference();
  clearCorridorFlicker();
  clearCameraScare();
  releaseCameraScarePreload();
  goticaStaticAt = undefined;
  imageCache.clear();
  resetPerformance();
  nextHudUpdate = nextDebugUpdate = 0;
  renderedShadow = undefined;
  nextDesktopUpdate = 0;
  clearJumpscareSound();
  clearJumpscareArt();
  dom.gameOver.hidden = true;
  dom.playfield.inert = false;
  delete dom.game.dataset.defeat;
  delete dom.game.dataset.scare;
  $('#game-over-status').textContent = 'SINAL PERDIDO';
  $('#night-mode').textContent = shift.label;
  clearTimeout(toastTimeout);
  dom.toast.classList.remove('show');
  dom.threatAlert.hidden = true;
  sound.preloadSamples(corridorAttackSound.files);
  sound.stopSamples();
  state.computerMode = 'desktop';
  clearMonitorTransition();
  resourceStateKey = undefined;
  resetCameraApp();
  movement.reset(shift.levels, {}, shift.rules);
  const { powerEnabled, sanityEnabled } = shift.rules;
  dom.energyMeter.hidden = $('#energy-label').hidden = !powerEnabled;
  dom.sanityMeter.hidden = $('#sanity-label').hidden = !sanityEnabled;
  dom.resourceHud.hidden = false;
  const frame = movement.snapshot({ hud: true });
  renderResourceState(frame);
  renderResources(frame);
  renderVolume(frame.noiseIntensity);
  movementChanged = officeChanged = true;
  changedGates.clear();
  changedCameras.clear();
  state.characterPreviews.clear();
  stopRadio();
  setClownPhase(frame.clownStage);
  clearClosetTransition();
  resetClosetPan();
  state.pan = state.targetPan = 0;
  renderPan();
  for (const { id, type } of window.NathGame.VENUE.openings) {
    if (type === 'portao') map.setGate(id, movement.isGateClosed(id));
  }
  renderedElectrical = undefined;
  renderElectrical();
  syncMovement(performance.now());
  dom.complete.hidden = true;
  setMode('office', false, true);
  changeCamera(CAMERAS[0].id);
  updateClockUI(0);
  warmShiftImages(shift.levels);
}

function startShift() {
  state.startedAt = state.lastFrame = performance.now();
  state.complete = false;
  sound.startShift();
  dom.game.inert = false;
  dom.hint.hidden = false;
  dom.officeMonitor.focus({ preventScroll: true });
  updateMovementDebug();
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
  renderPan();
  renderClosetPan();
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

// One unit is a half turn. Wrap each view's offset so it can enter from either side.
function closetOffset(heading) {
  return heading - 2 * Math.floor((heading + 1) / 2);
}

function renderClosetPan() {
  const travel = viewport.width * 1.45;
  const doorShift = closetOffset(-state.closetPan) * travel;
  const backShift = closetOffset(1 - state.closetPan) * travel;
  dom.closet.style.setProperty('--closet-door-shift', `${Math.round(doorShift)}px`);
  dom.closet.style.setProperty('--closet-back-shift', `${Math.round(backShift)}px`);
  setClosetView(Math.abs(doorShift) < travel * .32 ? 'door' : Math.abs(backShift) < travel * .32 ? 'back' : 'side');
}

function resetClosetPan() {
  state.closetPan = state.closetTarget = 0;
  state.closetMouseAtEdge = true;
  state.closetGesture = null;
  renderClosetPan();
}

function moveClosetCamera(dt) {
  if (state.closetPan === state.closetTarget) return;
  state.closetPan += (state.closetTarget - state.closetPan) * (1 - Math.exp(-dt / 105));
  if (Math.abs(state.closetTarget - state.closetPan) < .005) state.closetPan = state.closetTarget;
  renderClosetPan();
  updateRadioMix();
}

function gameInput() {
  const office = state.mode === 'office' && !state.closetTransition;
  const closet = state.mode === 'closet';
  const camera = state.mode === 'cameras' && !dom.computerScreen.inert ? CAMERAS[state.cameraIndex].id : null;
  const { officeWidth, officeHalf, closetHalf } = viewport;
  const officeCenter = office ? 1086 - 2172 * state.pan / (officeWidth || 1) : 0;
  const closetCenter = closet ? 835.5 - 2.9 * closetHalf * closetOffset(-state.closetPan) : 0;
  return {
    camera,
    cameraPreview: state.characterPreviews.get(camera),
    visibleCameraSource: camera && !dom.feedArt.hidden && dom.feedArt.complete && dom.feedArt.naturalWidth
      ? dom.feedArt.getAttribute('src') : null,
    cameraObservationBlocked: document.hidden,
    findShadow: !document.hidden,
    view: office ? 'office' : closet && !state.closetTransition ? `closet-${dom.closet.dataset.view}` : camera ? 'cameras' : null,
    closet,
    officeBounds: office ? [officeCenter - officeHalf, officeCenter + officeHalf] : null,
    closetBounds: closet ? [closetCenter - closetHalf, closetCenter + closetHalf] : null,
    leftLook: office && state.pan > maxPanShift() * controls.observation.leftPanFraction,
    smoresLooking: office && officeCenter - officeHalf <= SMORES_VENT_CENTER && SMORES_VENT_CENTER <= officeCenter + officeHalf,
    corridorLight: office && state.flashlight && !movement.isGateClosed(OFFICE.gate) && corridorInView(),
    clownLight: state.mode === 'closet' && dom.closet.dataset.view === 'back' && !dom.closetBeam.hidden,
    flashlight: (office && state.flashlight) || (closet && !dom.closetBeam.hidden),
    radio: state.radioPlaying,
    computer: !dom.desktop.hidden && !dom.computerScreen.inert,
    viewMoving: (office && state.pan !== state.targetPan) || (closet && state.closetPan !== state.closetTarget)
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

function advanceGame(now, action, measure = false) {
  if (state.complete || dom.game.hidden) return false;
  const start = measure ? performance.now() : 0;
  const accepted = movement.advance((now - state.startedAt) / 1000, gameInput, action);
  const integrated = measure ? performance.now() : 0;
  if (!state.complete) {
    renderGameFrame(movement.snapshot({ hud: now >= nextHudUpdate }), now);
    advanceComputerTransition(now);
  }
  if (measure) {
    perfLogic += integrated - start;
    perfRender += performance.now() - integrated;
  }
  return accepted;
}

let renderedElectrical;
function renderElectrical(fault = movement.electricalFault()) {
  if (renderedElectrical === fault) return;
  renderedElectrical = fault;
  map.setGateControls(movement.gateControlsAvailable());
  if (state.mode === 'cameras') updateCameraFeed(CAMERAS[state.cameraIndex]);
  updateAudioControl();
  updateOfficeView();
}

function renderGameFrame(frame, now) {
  renderElectrical(frame.electricalFault);
  interference.update(now);
  if (goticaStaticAt !== undefined) {
    if (now >= goticaStaticAt + signal.gotica.durationMs) goticaStaticAt = undefined;
    else if (goticaStaticAt !== renderedGoticaStaticAt && watchingCameras()) {
      interference.play('gotica', goticaStaticAt, now, signal.gotica);
      renderedGoticaStaticAt = goticaStaticAt;
    }
  }
  syncMovement(now);
  updateClockUI(frame.hours);
  renderResourceState(frame);
  if (!frame.radioAvailable && radioPlayback) stopRadio();
  renderShadow(frame.shadow);
  setClownPhase(frame.clownStage);
  if (now >= nextHudUpdate) {
    nextHudUpdate = now + 100;
    renderResources(frame);
    renderVolume(frame.noiseIntensity);
    updateAudioControl(frame.audio);
    renderWarnings(frame);
  }
  if (debugEnabled() && now >= nextDebugUpdate) {
    nextDebugUpdate = now + 150;
    updateMovementDebug();
  }
}

function renderWarnings(frame) {
  const warnings = [];
  if (state.officeRoom.size) warnings.push(frame.hidden ? 'AGUARDE NO ARMÁRIO' : 'INVASÃO · ENTRE NO ARMÁRIO');
  setText(dom.threatAlert, warnings.join(' / '));
  const hidden = warnings.length === 0;
  if (dom.threatAlert.hidden !== hidden) dom.threatAlert.hidden = hidden;
}

const energyLossStops = [0, .12, .32, .65, .95];
const sanityLossStops = [0, .20, .45, .90, 1.50];
const lossColors = [[70, 217, 135], [190, 221, 89], [230, 185, 39], [243, 139, 67], [240, 75, 86]];

function lossColor(rate, stops) {
  const end = stops.findIndex(stop => stop >= rate);
  if (end === 0) return '#46D987';
  if (end === -1) return '#F04B56';
  const fraction = (rate - stops[end - 1]) / (stops[end] - stops[end - 1]);
  const channels = lossColors[end - 1].map((start, i) => Math.round(start + (lossColors[end][i] - start) * fraction));
  return `rgb(${channels.join(', ')})`;
}

function renderVolume(intensity) {
  const value = String(Math.round(intensity));
  if (dom.volumeDetector.getAttribute('aria-valuenow') === value) return;
  dom.volumeDetector.setAttribute('aria-valuenow', value);
  dom.volumeTrace.style.transform = `scaleY(${Math.max(.025, Number(value) / 100)})`;
}

function renderResources({ sanity, energy, sanityLossPerSecond, energyLossPerSecond }) {
  for (const [meter, label, value, rate, stops] of [
    [dom.sanityMeter, dom.sanityValue, sanity, sanityLossPerSecond, sanityLossStops],
    [dom.energyMeter, dom.energyValue, energy, energyLossPerSecond, energyLossStops]
  ]) {
    if (meter.hidden) continue;
    const color = lossColor(rate, stops);
    if (meter.style.getPropertyValue('--meter-color') !== color) meter.style.setProperty('--meter-color', color);
    const rounded = Math.round(value * 10) / 10;
    const text = value > 0 && rounded === 0 ? '<0,1%' : `${String(rounded).replace('.', ',')}%`;
    if (label.textContent === text) continue;
    label.textContent = text;
    meter.value = rounded;
    meter.style.setProperty('--meter-fill', `${rounded}%`);
  }
}

let resourceStateKey;
function renderResourceState({ energy, blackout, computerOn, radioAvailable, flashlightAvailable }) {
  const low = energy <= config.power.warningBelow;
  const key = Number(low) + 2 * blackout + 4 * computerOn + 8 * radioAvailable + 16 * flashlightAvailable;
  if (key === resourceStateKey) return;
  resourceStateKey = key;
  dom.energyMeter.classList.toggle('low', low);
  dom.game.toggleAttribute('data-blackout', blackout);
  dom.game.toggleAttribute('data-computer-off', !computerOn);
  if (blackout) {
    clearMonitorTransition();
    clearCameraLaunch();
    delete cameraApp.panel.dataset.opening;
  }
  dom.computerScreen.inert = !computerOn || Boolean(state.monitorTransition);
  dom.officePower.disabled = dom.desktopPower.disabled = blackout;
  for (const button of [dom.officePower, dom.desktopPower]) {
    button.setAttribute('aria-pressed', String(computerOn));
  }
  dom.officeRadio.disabled = !radioAvailable;
  if (dom.closetLight.disabled !== !flashlightAvailable) {
    dom.closetLight.disabled = !flashlightAvailable;
    if (flashlightAvailable) updateOfficeView();
    else clearFlashlight();
  }
}

let renderedShadow, renderedShadowOffice, renderedShadowFeed;
function renderShadow({ phase, camera }) {
  const inOffice = state.mode === 'office';
  const feedVisible = phase === 'found' && watchingCameras() && CAMERAS[state.cameraIndex].id === camera;
  if (phase === renderedShadow && inOffice === renderedShadowOffice && feedVisible === renderedShadowFeed) return;
  renderedShadow = phase;
  renderedShadowOffice = inOffice;
  renderedShadowFeed = feedVisible;
  const attacking = phase === 'manifested' || phase === 'searching';
  sound.setSampleLoop('nightmare', attacking ? .3 : 0);
  dom.shadowManifest.hidden = !inOffice || phase !== 'manifested';
  dom.shadowOfficeArt.hidden = !inOffice || !attacking;
  dom.shadowFeed.hidden = !feedVisible;
  if (feedVisible) dom.shadowFeed.dataset.phase = phase;
  else delete dom.shadowFeed.dataset.phase;
}

let gameFrame;
let backgroundFrame;
function requestGameFrame() {
  if (document.hidden) {
    movement.interruptCameraObservation();
    clearCorridorFlicker();
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
const frameTimes = [];
let perfStart, perfWork = 0, perfLogic = 0, perfRender = 0;
let perfTotalFrames = 0, perfTotalTime = 0, perfLongFrames = 0, perfBlocking = 0;
let perfObserver;
const perfImageSources = new Set();
let perfImageTransfer = 0;
let perfImageRequests = 0;
const longFrameType = 'long-animation-frame';
const supportsLongFrames = typeof PerformanceObserver !== 'undefined'
  && PerformanceObserver.supportedEntryTypes.includes(longFrameType);
const mb = bytes => (bytes / 1048576).toFixed(1) + ' MiB';
if (perf) {
  perf.className = 'perf-overlay';
  dom.game.append(perf);
  if (supportsLongFrames) {
    perfObserver = new PerformanceObserver(list => {
      for (const entry of list.getEntries()) {
        if (entry.startTime < perfStart || perfStart === undefined || document.hidden) continue;
        perfLongFrames++;
        perfBlocking += entry.blockingDuration;
      }
    });
    perfObserver.observe({ type: longFrameType });
  }
  if (typeof PerformanceObserver !== 'undefined') {
    new PerformanceObserver(list => {
      for (const entry of list.getEntries()) {
        if (!/\.(webp|gif|png)(\?|$)/i.test(entry.name)) continue;
        perfImageSources.add(entry.name.split('?')[0]);
        perfImageRequests++;
        perfImageTransfer += entry.transferSize;
      }
    }).observe({ type: 'resource', buffered: true });
  }
}

function recordPerformance(now, delta, started) {
  if (perfStart === undefined) {
    perfStart = now;
    return;
  }
  frameTimes.push(delta);
  perfWork += performance.now() - started;
  const elapsed = now - perfStart;
  if (elapsed < 1000) return;
  const count = frameTimes.length;
  perfTotalFrames += count;
  perfTotalTime += elapsed;
  frameTimes.sort((a, b) => a - b);
  const percentile = fraction => frameTimes[Math.ceil(count * fraction) - 1].toFixed(1);
  const slow = frameTimes.filter(duration => duration > 50).length;
  const animations = document.getAnimations().filter(animation => animation.playState === 'running').length;
  const imageBytes = new Map();
  for (const image of document.images) {
    if (image.currentSrc && image.naturalWidth) imageBytes.set(image.currentSrc, image.naturalWidth * image.naturalHeight * 4);
  }
  const rgba = [...imageBytes.values()].reduce((sum, bytes) => sum + bytes, 0);
  const { ready, pending, queued, cancelled } = imageCache.stats();
  const audio = sound.stats();
  const heap = performance.memory ? mb(performance.memory.usedJSHeapSize) : 'indisponível';
  const loaf = supportsLongFrames ? `${perfLongFrames} · bloqueio ${perfBlocking.toFixed(0)} ms` : 'indisponível';
  perf.textContent = `FPS ${(1000 * count / elapsed).toFixed(1)} · média ${(1000 * perfTotalFrames / perfTotalTime).toFixed(1)}`
    + ` · p95/p99 ${percentile(.95)}/${percentile(.99)} ms · >50 ms ${slow}\n`
    + `JS do jogo ${(perfWork / count).toFixed(2)} ms/quadro · lógica/visual ${(perfLogic / count).toFixed(2)}/${(perfRender / count).toFixed(2)} · LoAF ${loaf}\n`
    + `Pré-carga ${ready} prontas · ${pending} em voo · ${queued} na fila · ${cancelled} canceladas · animações ${animations} (${interference.activeAnimations} de estática)\n`
    + `Imagens HTTP ${perfImageSources.size} URLs / ${perfImageRequests} entradas · ${mb(perfImageTransfer)} transferidos\n`
    + `IMG no DOM ${imageBytes.size} · RGBA estimado ${mb(rgba)} · heap JS estimado ${heap}\n`
    + `Áudio ${audio.context} · tons ${audio.tones} · ambiente ${Number(audio.ambience)} · rádio ${Number(audio.radio)} · amostras ${audio.playingSamples}/${audio.samples}`;
  perfStart = now;
  frameTimes.length = 0;
  perfWork = perfLogic = perfRender = perfLongFrames = perfBlocking = 0;
}

function resetPerformance() {
  if (!perf) return;
  perf.textContent = '';
  perfStart = undefined;
  frameTimes.length = 0;
  perfObserver?.takeRecords();
  perfWork = perfLogic = perfRender = perfLongFrames = perfBlocking = 0;
}

function tick(now) {
  gameFrame = undefined;
  const elapsed = Math.max(0, now - state.lastFrame);
  state.lastFrame = now;
  const time = performance.now();
  if (!state.complete) {
    const action = advanceClosetTransition(time);
    if (state.mode === 'office' && state.pan !== state.targetPan) {
      moveCamera(Math.min(100, elapsed));
      renderPan();
      if (state.flashlight && dom.office.dataset.flashlight !== String(corridorInView())) updateOfficeView();
      updateRadioMix();
    } else if (state.mode === 'closet' && !state.closetTransition) {
      moveClosetCamera(elapsed);
    }
    // Movement integrates elapsed time and resolves intermediate deadlines, even after dropped frames.
    advanceGame(time, action, Boolean(perf && !document.hidden && perfStart !== undefined));
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
  dom.game.toggleAttribute('data-page-hidden', Boolean(document.hidden));
  cancelGameFrame();
  state.lastFrame = performance.now();
  resetPerformance();
  if (document.hidden) {
    clearFlashlight();
    clearCameraInterference();
    imageCache.cancelPending();
  } else if (state.mode === 'cameras' && !state.complete) {
    updateCameraFeed(CAMERAS[state.cameraIndex]);
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
  if (state.complete || state.mode !== 'office' || state.closetTransition || !movement.gateControlsAvailable()) return;
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
let clearCameraGesture;
function bindCameraWindow() {
  const app = cameraApp;
  $('#open-cameras').addEventListener('click', showCameraApp);
  $('#start-cameras').addEventListener('click', showCameraApp);
  app.task.addEventListener('click', () => state.mode === 'cameras' ? hideCameraApp() : showCameraApp());
  app.panel.addEventListener('focusin', showCameraApp);
  app.panel.addEventListener('animationend', event => {
    if (event.target === app.panel && event.animationName === 'camera-window-open') delete app.panel.dataset.opening;
  });
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
    gesture.handle = handle;
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
    clearCameraGesture();
  };
  clearCameraGesture = () => {
    if (!gesture) return;
    const { handle, pointer } = gesture;
    gesture = null;
    delete panel.parentElement.dataset.snapPreview;
    if (handle?.hasPointerCapture?.(pointer)) handle.releasePointerCapture(pointer);
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
const replayShift = () => menu.play(state.shift);
dom.restart.addEventListener('click', replayShift);
$('#retry-night').addEventListener('click', replayShift);
dom.nextShift.addEventListener('click', () => menu.playCampaign(state.shift.number + 1));
function returnToMenu() {
  stopShift();
  clearJumpscareSound();
  clearJumpscareArt();
  releaseShiftImages();
  dom.game.hidden = true;
  dom.gameOver.hidden = true;
  dom.playfield.inert = false;
  delete dom.game.dataset.defeat;
  delete dom.game.dataset.scare;
  menu.show();
}
dom.returnToMenu.addEventListener('click', returnToMenu);
$('#complete-menu').addEventListener('click', returnToMenu);
dom.scareSound.addEventListener('ended', () => {
  if (dom.scareSound.ended) clearJumpscareSound();
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
  if (state.complete || state.closetTransition) return;
  const gesture = state.closetGesture;
  if (event.pointerType === 'touch') {
    if (gesture?.id !== event.pointerId) return;
    const dx = event.clientX - gesture.startX;
    if (!gesture.dragging) {
      if (Math.abs(dx) < 12) return;
      gesture.dragging = true;
      clearFlashlight();
      dom.closet.setPointerCapture(event.pointerId);
    }
    state.closetTarget = gesture.startHeading - 2 * dx / (viewport.pointerWidth || 1);
    return;
  }
  if (event.pointerType !== 'mouse' || state.flashlightPointer !== null) return;
  const ratio = (event.clientX - viewport.left) / (viewport.pointerWidth || 1);
  const anchor = Math.round(state.closetTarget);
  if (ratio > .3 && ratio < .7) state.closetMouseAtEdge = false;
  if (state.closetMouseAtEdge) return;
  if (ratio <= .08 || ratio >= .92) {
    state.closetTarget = anchor + (ratio < .5 ? -1 : 1);
    state.closetMouseAtEdge = true;
    return;
  }
  state.closetTarget = anchor + (ratio - .5) * .35;
});
dom.closet.addEventListener('pointerdown', event => {
  if (event.pointerType !== 'touch' || !event.isPrimary || state.complete || state.closetTransition) return;
  state.closetGesture = { id: event.pointerId, startX: event.clientX, startHeading: state.closetTarget, dragging: false };
});
for (const eventName of ['pointerup', 'pointercancel', 'lostpointercapture']) {
  dom.closet.addEventListener(eventName, event => {
    if (eventName === 'lostpointercapture' && event.target !== dom.closet) return;
    if (event.pointerId === state.closetGesture?.id) state.closetGesture = null;
  });
}

document.addEventListener('keydown', event => {
  if (dom.game.hidden || state.complete || event.altKey || event.ctrlKey || event.metaKey) return;
  const key = event.key.toLowerCase();
  if (developerDebug && key === 'j' && (!state.closetTransition || state.mode === 'closet')) {
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
    advanceGame(performance.now());
    return;
  }
  if (state.mode === 'office') {
    if (key === 's') openComputer();
    else if (key === 'a' || key === 'd') state.targetPan = maxPanShift() * (key === 'a' ? 1 : -1);
  } else if (state.mode === 'closet') {
    if (key === 'a') state.closetTarget = 2 * Math.ceil((state.closetPan - 1) / 2);
    else if (key === 'd') state.closetTarget = 2 * Math.floor(state.closetPan / 2) + 1;
  }
});
document.addEventListener('keyup', event => {
  if (event.key.toLowerCase() !== 'w' || !state.flashlightKey) return;
  state.flashlightKey = false;
  updateFlashlight();
  advanceGame(performance.now());
});
window.addEventListener('blur', () => {
  state.targetPan = 0;
  state.closetGesture = null;
  clearCameraGesture();
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

function releaseCameraScarePreload() {
  cameraScareRequest?.abort();
  cameraScareRequest = cameraScareBlob = undefined;
}

function warmShiftImages(levels) {
  imageCache.warm([OFFICE.images.lit, OFFICE.images.closed]);
  if (levels.shadow > 0) {
    setImageSource(dom.shadowOfficeArt, config.shadow.officeArt);
    setImageSource(dom.shadowSprite, config.shadow.sprite);
  } else {
    clearImageSource(dom.shadowOfficeArt);
    clearImageSource(dom.shadowSprite);
  }
  imageCache.warm([...JUMPSCARE_IMAGES, CLOWN_BOTTOM_IMAGE], false);
  if (levels.yandere > 0 && /^https?:$/.test(window.location.protocol) && URL.createObjectURL) {
    const request = cameraScareRequest = new AbortController();
    // Reuse the downloaded bytes and give each playback a fresh animation identity.
    fetch(cameraScareImage, { signal: request.signal, priority: 'low' }).then(response => {
      if (response.ok) return response.blob();
    }).then(blob => {
      if (cameraScareRequest === request) cameraScareBlob = blob;
    }).catch(() => {}).finally(() => {
      if (cameraScareRequest === request) cameraScareRequest = undefined;
    });
  }
}

const menu = createNightMenu(config, {
  prepareShift,
  startShift,
  onEnter: () => sound.preloadSamples(corridorAttackSound.files)
});
dom.game.style.setProperty('--shadow-manifest-duration', `${config.shadow.manifestSeconds}s`);
dom.game.style.setProperty('--shadow-found-duration', `${config.shadow.foundSeconds}s`);

})();
