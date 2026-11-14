(() => {
'use strict';

function createNightMenu(config, { prepareShift, startShift, onEnter }) {
  const $ = selector => document.querySelector(selector);
  const entry = $('#entry-screen');
  const entryButton = $('#enter-game');
  const title = $('#title-screen');
  const game = $('#game');
  const intro = $('#night-intro');
  const introTitle = $('#night-intro-title');
  const music = $('#menu-music');
  const titleContent = $('.title-content');
  const start = $('#start-game');
  const continueButton = $('#continue-game');
  const continueLabel = $('#continue-game-label');
  const customButton = $('#open-custom');
  const customScreen = $('#custom-night');
  const debugButton = $('#custom-debug');
  let debug = false;
  const fields = $('#custom-levels');
  const settings = config.controls.menuMusic;
  const { campaign, levels: [min, max], defaultLevel, ...defaults } = config.night;
  const progressKey = 'nnn.campaign.completed';
  let completed = readProgress();
  let pendingShift;
  let musicFrame;
  let glitchTimer;
  let lastGlitchArt;
  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  const inputs = new Map();

  function readProgress() {
    try {
      const saved = Number(localStorage.getItem(progressKey));
      if (Number.isInteger(saved) && saved >= 0 && saved <= campaign.length) return saved;
    } catch {}
    return 0;
  }

  function recordWin(number) {
    completed = Math.max(number, completed, readProgress());
    try {
      localStorage.setItem(progressKey, String(completed));
    } catch {}
  }

  for (const [id, { name }] of Object.entries({
    ...config.characters, palhaca: config.threats.clown, shadow: config.shadow, smores: config.threats.smores
  })) {
    const label = document.createElement('label');
    const select = document.createElement('select');
    select.name = id;
    for (let level = min; level <= max; level++) {
      const option = document.createElement('option');
      option.value = option.textContent = String(level);
      select.append(option);
    }
    select.value = String(defaultLevel);
    label.append(name, select);
    fields.append(label);
    inputs.set(id, select);
  }

  function showCustom(open, focus) {
    titleContent.hidden = open;
    customScreen.hidden = !open;
    updateGlitches();
    focus.focus();
  }

  function updateGlitches() {
    clearTimeout(glitchTimer);
    delete title.dataset.glitch;
    delete title.dataset.doubleGlitch;
    title.toggleAttribute('data-page-hidden', Boolean(document.hidden));
    if (title.hidden || title.inert || !customScreen.hidden || document.hidden || reducedMotion?.matches) return;

    // Sample outside the gameplay RNG and avoid showing the same art twice in a row.
    const random = window.crypto.getRandomValues(new Uint16Array(4));
    glitchTimer = setTimeout(() => {
      lastGlitchArt = lastGlitchArt === undefined ? random[0] % 3 : (lastGlitchArt + 1 + random[0] % 2) % 3;
      const double = random[1] < 16384;
      const duration = (double ? 410 : 230) + random[2] / 65535 * 165;
      title.style.setProperty('--glitch-duration', `${duration}ms`);
      title.toggleAttribute('data-double-glitch', double);
      title.dataset.glitch = String(lastGlitchArt);
      glitchTimer = setTimeout(updateGlitches, duration);
    }, 4800 + random[3] / 65535 * 10500);
  }

  function fadeMusic() {
    musicFrame = undefined;
    if (title.hidden || title.inert || music.paused) return;
    const progress = Math.min(1, Math.max(0, (music.currentTime - settings.startSeconds) / settings.fadeSeconds));
    music.volume = settings.initialVolume + (settings.volume - settings.initialVolume) * progress;
    if (progress < 1) musicFrame = requestAnimationFrame(fadeMusic);
  }

  function startMusicFade() {
    if (musicFrame === undefined && music.volume !== settings.volume) fadeMusic();
  }

  function cancelMusicFade() {
    if (musicFrame !== undefined) cancelAnimationFrame(musicFrame);
    musicFrame = undefined;
  }

  function show() {
    completed = Math.max(completed, readProgress());
    continueButton.hidden = completed === 0;
    continueLabel.textContent = completed === campaign.length ? `Rejogar noite ${campaign.length}`
      : `Continuar · Noite ${completed + 1}`;
    title.hidden = false;
    showCustom(false, continueButton.hidden ? start : continueButton);
    music.currentTime = settings.startSeconds;
    music.volume = settings.initialVolume;
    cancelMusicFade();
    music.play().catch(() => {});
  }

  function play(shift, { newspaper = false } = {}) {
    if (pendingShift) return;
    pendingShift = shift;
    introTitle.textContent = shift.label;
    title.inert = true;
    game.inert = true;
    updateGlitches();
    cancelMusicFade();
    music.pause();
    intro.dataset.phase = newspaper ? 'newspaper' : 'cover';
    intro.hidden = false;
  }

  function playCampaign(number, options) {
    const entry = campaign[number - 1];
    if (!entry || number > completed + 1) return;
    const { levels, ...rules } = entry;
    play({ number, label: `NOITE ${number}`, levels, rules: { ...defaults, ...rules } }, options);
  }

  introTitle.addEventListener('animationend', event => {
    if (event.animationName !== 'night-card' || intro.dataset.phase !== 'card') return;
    title.hidden = true;
    title.inert = false;
    prepareShift(pendingShift);
    intro.dataset.phase = 'reveal';
  });

  intro.addEventListener('animationend', event => {
    if (event.target !== intro) return;
    const { phase } = intro.dataset;
    if ((phase === 'newspaper' && event.animationName === 'night-intro')
        || (phase === 'cover' && event.animationName === 'night-cover')) {
      intro.dataset.phase = 'card';
    } else if (phase === 'reveal' && event.animationName === 'night-reveal') {
      intro.hidden = true;
      delete intro.dataset.phase;
      pendingShift = undefined;
      startShift();
    }
  });

  function enter() {
    entry.hidden = true;
    show();
    onEnter();
  }
  start.addEventListener('click', () => playCampaign(1, { newspaper: true }));
  continueButton.addEventListener('click', () => playCampaign(Math.min(completed + 1, campaign.length)));
  customButton.addEventListener('click', () => showCustom(true, inputs.values().next().value));
  $('#close-custom').addEventListener('click', () => showCustom(false, customButton));
  debugButton.addEventListener('click', () => {
    debug = !debug;
    debugButton.setAttribute('aria-pressed', String(debug));
    debugButton.textContent = debug ? 'Debug ativado' : 'Debug desativado';
  });
  $('#custom-form').addEventListener('submit', event => {
    event.preventDefault();
    const levels = Object.fromEntries([...inputs].map(([id, select]) => [id, Number(select.value)]));
    play({ label: 'CUSTOM NIGHT', levels, rules: defaults, debug });
  });
  entryButton.disabled = false;
  music.addEventListener('playing', startMusicFade);
  music.addEventListener('waiting', cancelMusicFade);
  music.addEventListener('pause', cancelMusicFade);
  document.addEventListener('visibilitychange', updateGlitches);
  reducedMotion?.addEventListener('change', updateGlitches);
  entryButton.addEventListener('click', enter, { once: true });
  return { show, play, playCampaign, recordWin };
}

window.NathGame.createNightMenu = createNightMenu;
})();
