import { CAMERAS } from './data/game-data.js';
import { makeCameraMap } from './map.js';
import { SoundEngine } from './sound.js';

// A primeira versão funciona como site estático: sem build, sem servidor de jogo e sem backend.
const $ = selector => document.querySelector(selector);
const dom = {
  game: $('#game'), office: $('#office-view'), cameras: $('#cameras-view'),
  officeScene: $('#office-scene'), officeMonitor: $('#office-monitor'),
  panGuide: $('#pan-guide'), feedArt: $('#feed-art'), tech: $('#technical-feed'),
  techArt: $('#technical-art'), techNumber: $('#technical-number'),
  camNumber: $('#cam-number'), camRoom: $('#cam-room'), camCaption: $('#feed-caption'),
  feedTime: $('#feed-time'), flash: $('#camera-switch-flash'),
  clock: $('#clock-label'), power: $('#power-number'), powerFill: $('#power-fill'),
  usageBars: [...document.querySelectorAll('#usage-bars b')], usageCaption: $('#usage-caption'),
  mapPanel: $('#map-panel'), mapBody: $('#map-body'), mapMinimize: $('#map-minimize'),
  mapSelected: $('#map-selected'),
  handle: $('#monitor-handle'), handleLabel: $('#handle-label'),
  soundToggle: $('#sound-toggle'), soundLabel: $('#sound-label'),
  helpToggle: $('#help-toggle'), help: $('#help-dialog'), helpClose: $('#help-close'),
  helpOkay: $('#help-okay'), hint: $('#initial-hint'),
  toast: $('#toast'), complete: $('#shift-complete'), restart: $('#restart-shift')
};

const HOURS_PER_SHIFT = 6;
const SECONDS_PER_HOUR = 90;
const TOTAL_SHIFT_SECONDS = HOURS_PER_SHIFT * SECONDS_PER_HOUR;
const sound = new SoundEngine();
const state = {
  mode: 'office', cameraIndex: 0, elapsed: 0, power: 100,
  complete: false, pan: 0, targetPan: 0,
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
  if (!cam?.image || imageCache.has(cam.image)) return;
  const image = new Image();
  image.decoding = 'async';
  image.src = cam.image;
  imageCache.set(cam.image, image);
}

const map = makeCameraMap({
  canvas: $('#map-canvas'), selector: $('#map-selector'),
  onSelect: id => {
    if (state.complete) return;
    changeCamera(id, true);
  }
});

function showTechnical(cam) {
  dom.feedArt.hidden = true;
  dom.tech.hidden = false;
  dom.techArt.src = cam.technical;
  dom.techNumber.textContent = cam.id.replace('CAM', 'CAM ');
  dom.camCaption.textContent = 'REFERÊNCIA DE VISIBILIDADE 2D • IMAGEM FINAL PENDENTE';
}

function changeCamera(id, playSound = false) {
  const index = CAMERAS.findIndex(camera => camera.id === id);
  if (index < 0) return;
  const changed = state.cameraIndex !== index;
  state.cameraIndex = index;
  const cam = CAMERAS[index];
  dom.camNumber.textContent = cam.id.replace('CAM', 'CAM ');
  dom.camRoom.textContent = cam.name.toUpperCase();
  dom.mapSelected.textContent = `${String(cam.number).padStart(2, '0')} / ${CAMERAS.length}`;
  map.setActive(cam);

  if (cam.image) {
    dom.tech.hidden = true;
    dom.feedArt.hidden = false;
    dom.feedArt.alt = `Câmera ${cam.id}: ${cam.name}, cenário noturno sem animatrônicos`;
    dom.camCaption.innerHTML = 'CÂMERA CONECTADA <span>•</span> NENHUM ANIMATRÔNICO EM CAMPO';
    // A imagem requisitada pode estar ausente após uma edição do repositório.
    dom.feedArt.onerror = () => {
      if (state.cameraIndex === index) {
        showTechnical(cam);
        announce(`${cam.id}: imagem não encontrada; exibindo a planta técnica`);
      }
    };
    dom.feedArt.src = cam.image;
  } else {
    showTechnical(cam);
  }

  clearTimeout(flashTimeout);
  dom.flash.classList.remove('active');
  // Restart CSS animation even when switching quickly.
  void dom.flash.offsetWidth;
  dom.flash.classList.add('active');
  flashTimeout = setTimeout(() => dom.flash.classList.remove('active'), 360);
  if (playSound && changed) sound.switch();
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
  sound.monitor();
  if (watching) {
    changeCamera(CAMERAS[state.cameraIndex].id);
    preloadCamera(CAMERAS[0]);
  }
  updatePowerUI();
}

function toggleMonitor() { setMode(state.mode === 'office' ? 'cameras' : 'office'); }

function cycleCamera(direction) {
  const next = (state.cameraIndex + direction + CAMERAS.length) % CAMERAS.length;
  changeCamera(CAMERAS[next].id, true);
}

function updatePowerUI() {
  const percent = Math.max(0, Math.ceil(state.power));
  dom.power.textContent = `${percent}%`;
  dom.powerFill.style.width = `${Math.max(0, state.power)}%`;
  dom.powerFill.classList.toggle('low', state.power <= 25);
  const usage = state.mode === 'cameras' ? 2 : 1;
  dom.usageBars.forEach((bar, i) => bar.classList.toggle('on', i < usage));
  dom.usageCaption.textContent = usage === 1 ? 'NORMAL' : 'MONITOR';
}

function updateClockUI() {
  const hours = Math.floor(state.elapsed / SECONDS_PER_HOUR);
  const label = hours === 0 ? '12' : String(Math.min(6, hours));
  dom.clock.innerHTML = `${label} <small>AM</small>`;
  const simulatedSeconds = Math.floor(state.elapsed / SECONDS_PER_HOUR * 3600);
  const hour = Math.floor(simulatedSeconds / 3600);
  const minute = Math.floor(simulatedSeconds % 3600 / 60);
  const second = simulatedSeconds % 60;
  dom.feedTime.textContent = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}`;
}

function finishShift() {
  state.complete = true;
  dom.complete.hidden = false;
  sound.finish();
}

function resetShift() {
  state.elapsed = 0;
  state.power = 100;
  state.complete = false;
  state.mode = 'cameras'; // Force setMode to apply the initial office state.
  dom.complete.hidden = true;
  setMode('office');
  updateClockUI();
  updatePowerUI();
}

function maxPanShift() {
  // The office panorama is exactly 2172:724 (3:1), never distorted.
  return Math.max(0, (Math.max(window.innerWidth, window.innerHeight * 3) - window.innerWidth) / 2);
}

function setEdgePan(clientX) {
  if (state.dragging) return;
  const ratio = clientX / window.innerWidth;
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
  if (!state.complete && !dom.help.open && !document.hidden) {
    const seconds = delta / 1000;
    state.elapsed += seconds;
    // A base explora a noite sem ameaças: o consumo informa o uso, não causa game over.
    state.power = Math.max(0, state.power - seconds * (state.mode === 'cameras' ? .026 : .014));
    if (now >= nextHudUpdate) {
      updateClockUI();
      updatePowerUI();
      nextHudUpdate = now + 200;
    }
    if (state.elapsed >= TOTAL_SHIFT_SECONDS) finishShift();
  }
  moveCamera(delta);
  requestAnimationFrame(tick);
}

dom.officeMonitor.addEventListener('click', () => setMode('cameras'));
dom.handle.addEventListener('click', toggleMonitor);
dom.mapMinimize.addEventListener('click', () => {
  const collapsed = dom.mapPanel.classList.toggle('collapsed');
  dom.mapMinimize.setAttribute('aria-expanded', String(!collapsed));
});
dom.helpToggle.addEventListener('click', () => dom.help.showModal());
dom.helpClose.addEventListener('click', () => dom.help.close());
dom.helpOkay.addEventListener('click', () => dom.help.close());
dom.restart.addEventListener('click', resetShift);

dom.soundToggle.addEventListener('click', async () => {
  if (sound.enabled) sound.disable();
  else if (!(await sound.enable())) {
    announce('ÁUDIO NÃO SUPORTADO NESTE NAVEGADOR');
    return;
  }
  dom.soundToggle.setAttribute('aria-pressed', String(sound.enabled));
  dom.soundToggle.setAttribute('aria-label', sound.enabled ? 'Desativar o som' : 'Ativar o som');
  dom.soundLabel.textContent = sound.enabled ? 'SOM ON' : 'SOM OFF';
  sound.switch();
});

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
});
for (const eventName of ['pointerup','pointercancel']) dom.office.addEventListener(eventName, () => { state.dragging = false; });

const panKeys = new Set();
document.addEventListener('keydown', event => {
  if (dom.help.open || state.complete || event.altKey || event.ctrlKey || event.metaKey) return;
  const key = event.key.toLowerCase();
  const focusedButton = event.target instanceof HTMLElement && Boolean(event.target.closest('button'));
  if ((key === ' ' && !focusedButton) || key === 'm') {
    event.preventDefault();
    toggleMonitor();
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
window.addEventListener('blur', () => {panKeys.clear();state.targetPan = 0;});
window.addEventListener('resize', () => {
  state.targetPan = Math.min(maxPanShift(), Math.max(-maxPanShift(), state.targetPan));
});

// The site opens directly inside the office: no menu or splash screen.
changeCamera(CAMERAS[0].id);
updateClockUI();
updatePowerUI();
requestAnimationFrame(tick);
