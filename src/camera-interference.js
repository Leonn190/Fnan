(() => {
'use strict';

const priority = { switch: 0, gate: 1, gotica: 2 };

function createCameraInterference(overlay, band, feed, reducedMotion) {
  let current;
  let animations = [];

  function clear() {
    if (!current) return;
    for (const animation of animations) animation.cancel();
    animations = [];
    current = undefined;
    overlay.hidden = true;
    delete overlay.dataset.kind;
  }

  function play(kind, start, now, { durationMs, intensity }) {
    if (now >= start + durationMs) return;
    if (current && now < current.end && priority[current.kind] > priority[kind]) {
      if (kind !== 'gate') return;
      // A gate adds a fresh pulse to the existing interference using the same layers.
      kind = current.kind;
      durationMs = Math.max(durationMs, current.end - now);
      intensity = Math.max(intensity, current.intensity);
    }
    clear();
    current = { kind, end: start + durationMs, intensity };
    overlay.dataset.kind = kind;
    overlay.hidden = false;
    const reduced = reducedMotion();
    const levels = reduced ? [.22, .19, .15, .08, 0] : [1, .66, .86, .32, 0];
    const timing = { duration: durationMs, fill: 'both' };
    animations.push(overlay.animate(levels.map((level, index) => ({
      opacity: level * intensity, offset: [0, .11, .24, .53, 1][index]
    })), timing));
    if (!reduced) {
      animations.push(band.animate(['-24%', '12%', '4%', '32%', '61%', '79%'].map(y => ({
        transform: `translateY(${y})`, easing: 'steps(3, end)'
      })), timing));
      animations.push(feed.animate([0, 1.1, -.75, .45, -.28, 0, 0].map((x, index) => ({
        transform: `translateX(${x * intensity}%) scale(${x ? 1.025 : 1.015})`,
        offset: [0, .05, .12, .22, .34, .5, 1][index],
        easing: 'steps(1, end)'
      })), timing));
    }
    for (const animation of animations) animation.currentTime = Math.max(0, now - start);
  }

  return {
    play, clear,
    update(now) { if (current && now >= current.end) clear(); },
    clearTransient() { if (current?.kind !== 'gotica') clear(); }
  };
}

window.NathGame.createCameraInterference = createCameraInterference;
})();
