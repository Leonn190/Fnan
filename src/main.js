(() => {
'use strict';
const { CAMERAS, OFFICE, makeCameraMap, SoundEngine } = window.NathGame;

// A primeira versão funciona como site estático: sem build, sem servidor de jogo e sem backend.
const $ = selector => document.querySelector(selector);
const dom = {
  game: $('#game'), office: $('#office-view'), cameras: $('#cameras-view'),
  officeScene: $('#office-scene'), officeMonitor: $('#office-monitor'), officeArt: $('#office-art'),
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
  mode: 'office', cameraIndex: 0, elapsed: 0,
  complete: false, flashlight: false, pan: 0, targetPan: 0,
  dragging: false, pointerX: null, lastFrame: performance.now()
};
let toastTimeout;
let flashTimeout;
let nextHudUpdate = 0;
const imageCache = new Map();

function announce(message) {
  clearTimeout(toastTimeout);
  dom.toast.textContent = message;
  dom.toast.classList.add('show');
  toastTimeout = setTimeout(() => dom.toast.classList.remove('show'), 2350);
}

function preloadCamera(cam) {
  if (!cam?.image) return;
  const sources = cam.gateStateImages ? Object.values(cam.gateStateImages.images) : [cam.image];
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
  if (closed) state.flashlight = false;
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

function showTechnical(cam) {
  dom.feedArt.hidden = true;
  dom.tech.hidden = false;
  dom.techArt.src = cam.technical;
  dom.techNumber.textContent = cam.id.replace('CAM', 'CAM ');
}

function cameraImage(cam) {
  const views = cam.gateStateImages;
  if (!views) return cam.image;
  const left = map.isGateClosed(views.leftGate) ? 'closed' : 'open';
  const right = map.isGateClosed(views.rightGate) ? 'closed' : 'open';
  return views.images[`${left}-${right}`];
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
    if (!event.repeat && !map.isGateClosed(OFFICE.gate)) {
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
changeCamera(CAMERAS[0].id);
updateOfficeView();
preloadImages(Object.values(OFFICE.images));
// Load all four CAM05 states before the player starts toggling its gates.
preloadCamera(CAMERAS.find(cam => cam.gateStateImages));
updateClockUI();
requestAnimationFrame(tick);

})();
