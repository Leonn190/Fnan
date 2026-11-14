(() => {
'use strict';

const priority = { switch: 0, gate: 1, gotica: 2 };

function createCameraInterference(overlay, band, feed, reducedMotion) {
  let current;
  let animations = [];

  function clear() {
    if (!current) return;
    for (const animation of animations) {
      animation.onfinish = null;
      animation.cancel();
    }
    animations = [];
    current = undefined;
    overlay.hidden = true;
    delete overlay.dataset.kind;
  }

  function play(kind, start, now, { durationMs, intensity }) {
    if (current?.kind === 'electrical' || now >= start + durationMs) return;
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
    const levels = reduced ? [.22, .19, .15, .08, 0] : [1, .58, .88, .54, .72, .38, .21, 0];
    const offsets = reduced ? [0, .11, .24, .53, 1] : [0, .08, .16, .29, .39, .55, .75, 1];
    const timing = { duration: durationMs, fill: 'both' };
    animations.push(overlay.animate(levels.map((level, index) => ({
      opacity: level * intensity, offset: offsets[index], easing: reduced ? 'linear' : 'steps(2, end)'
    })), timing));
    if (!reduced) {
      animations.push(band.animate([
        { transform: 'translateY(-48%)', offset: 0, easing: 'steps(4, end)' },
        { transform: 'translateY(-10%)', offset: .26, easing: 'step-end' },
        { transform: 'translateY(-19%)', offset: .34, easing: 'steps(9, end)' },
        { transform: 'translateY(51%)', offset: 1 }
      ], timing));
      animations.push(feed.animate([0, 1.1, -.75, .45, -.28, 0, 0].map((x, index) => ({
        transform: `translateX(${x * intensity}%) scale(${x ? 1.025 : 1.015})`,
        offset: [0, .05, .12, .22, .34, .5, 1][index],
        easing: 'steps(1, end)'
      })), timing));
    }
    for (const animation of animations) animation.currentTime = Math.max(0, now - start);
    const pulse = current;
    animations[0].onfinish = () => { if (current === pulse) clear(); };
  }

  return {
    play, clear,
    get activeAnimations() { return animations.length; },
    setElectrical(active) {
      if (active === (current?.kind === 'electrical')) return;
      clear();
      if (!active) return;
      current = { kind: 'electrical' };
      overlay.dataset.kind = current.kind;
      overlay.hidden = false;
    },
    update(now) { if (current && current.kind !== 'electrical' && now >= current.end) clear(); },
    clearTransient() { if (current?.kind === 'switch' || current?.kind === 'gate') clear(); }
  };
}

window.NathGame.createCameraInterference = createCameraInterference;
})();
