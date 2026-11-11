(() => {
'use strict';

function createNightMenu(config, { startShift, onEnter }) {
  const $ = selector => document.querySelector(selector);
  const entry = $('#entry-screen');
  const entryButton = $('#enter-game');
  const title = $('#title-screen');
  const music = $('#menu-music');
  const titleContent = $('.title-content');
  const start = $('#start-game');
  const customButton = $('#open-custom');
  const customScreen = $('#custom-night');
  const fields = $('#custom-levels');
  const settings = config.controls.menuMusic;
  const [min, max] = config.night.levels;
  const inputs = new Map();

  for (const [id, { name }] of Object.entries({ ...config.characters, palhaca: config.threats.clown })) {
    const label = document.createElement('label');
    const select = document.createElement('select');
    select.name = id;
    for (let level = min; level <= max; level++) {
      const option = document.createElement('option');
      option.value = option.textContent = String(level);
      select.append(option);
    }
    select.value = String(config.night.normalLevel);
    label.append(name, select);
    fields.append(label);
    inputs.set(id, select);
  }

  function showCustom(open, focus) {
    titleContent.hidden = open;
    customScreen.hidden = !open;
    focus.focus();
  }

  function fadeMusic() {
    if (title.hidden) return;
    const progress = Math.min(1, Math.max(0, (music.currentTime - settings.startSeconds) / settings.fadeSeconds));
    music.volume = settings.initialVolume + (settings.volume - settings.initialVolume) * progress;
    if (progress < 1) requestAnimationFrame(fadeMusic);
  }

  function show() {
    title.hidden = false;
    showCustom(false, start);
    music.currentTime = settings.startSeconds;
    music.volume = settings.initialVolume;
    music.addEventListener('playing', fadeMusic, { once: true });
    music.play().catch(() => {});
  }

  function begin(levels, custom) {
    title.hidden = true;
    music.pause();
    startShift(levels, custom);
  }

  function enter() {
    entry.hidden = true;
    show();
    onEnter();
  }
  start.addEventListener('click', () => begin({}, false));
  customButton.addEventListener('click', () => showCustom(true, inputs.values().next().value));
  $('#close-custom').addEventListener('click', () => showCustom(false, customButton));
  $('#custom-form').addEventListener('submit', event => {
    event.preventDefault();
    const levels = Object.fromEntries([...inputs].map(([id, select]) => [id, Number(select.value)]));
    begin(levels, true);
  });
  entryButton.disabled = false;
  entryButton.addEventListener('click', enter, { once: true });
  return { show };
}

window.NathGame.createNightMenu = createNightMenu;
})();
