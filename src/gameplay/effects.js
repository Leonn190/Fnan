(() => {
'use strict';

const { factor } = window.NathGame;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function createEffects(config, routes, actors) {
  const { cameraAudio, flashlight, noise } = config.effects;
  const { front, back, office, left, leftApproach } = config.map;
  const corridor = [front, back];
  let lure;
  let readyAt = 0;
  let staticUntil = 0;

  function startAudio(now, camera) {
    if (!camera || now < readyAt) return false;
    const origins = [...routes.positions.values()].filter(p => p.cameras.includes(camera)).map(p => p.id);
    const distance = routes.distances(origins, id => !cameraAudio.excluded.includes(id), cameraAudio.factors.length - 1);
    lure = { camera, distance, ends: now + cameraAudio.duration };
    readyAt = now + cameraAudio.cooldown;
    for (const actor of actors) actor.audioRetention = 1;
    return true;
  }

  function addNoise(actor, amount) {
    actor.noise = clamp(actor.noise + amount, 0, noise.max ?? Infinity);
  }

  function integrate(dt, input) {
    const rate = Object.entries(noise.rates).reduce((sum, [key, value]) => sum + (input[key] ? value : 0), 0);
    for (const actor of actors) {
      addNoise(actor, dt * (rate || -noise.decay));
      const rates = flashlight.rates[actor.key];
      if (!rates) continue;
      for (const direction of ['advance', 'retreat']) {
        const value = actor.light[direction];
        const lit = input.corridorLight && corridor.includes(actor.position);
        actor.light[direction] = lit
          ? clamp(value + rates[direction] * dt, flashlight.min, flashlight.max)
          : Math.sign(value) * Math.max(0, Math.abs(value) - flashlight.recovery * dt);
      }
    }
  }

  function weight(actor, to, now) {
    const from = actor.position;
    let result = 1;
    if (from === leftApproach && to === left) result *= config.movement.leftApproachFactor * factor(actor.noise);
    if (lure && now < lure.ends) {
      const distance = lure.distance.get(to) ?? Infinity;
      if (distance < (lure.distance.get(from) ?? Infinity)) {
        result *= factor(actor.rule.audioModifier * cameraAudio.factors[distance] * actor.audioRetention);
      }
    }
    if (corridor.includes(from)) {
      const advancing = (from === back && to === front) || (from === front && to === office);
      if (advancing) result *= factor(actor.rule.corridorAdvancePenalty ?? 0) * factor(actor.light.advance);
      else if (from === front || to !== front) result *= factor(actor.light.retreat);
    }
    if (actor.rule.hidingPlaces?.includes(to)) result *= factor(actor.rule.hidingBonus);
    return result;
  }

  return {
    startAudio, integrate, weight,
    staticActive: now => now < staticUntil,
    triggerStatic: now => { staticUntil = now + config.effects.static.duration; },
    audioStatus: now => ({ remaining: Math.max(0, readyAt - now), camera: now < lure?.ends ? lure.camera : null }),
    addNoiseEvent: event => actors.forEach(actor => addNoise(actor, noise.events[event])),
    retain(actor) {
      const retain = config.movement.failedModifierRetention;
      actor.audioRetention *= retain;
      actor.noise *= retain;
      actor.light.advance *= retain;
      actor.light.retreat *= retain;
    }
  };
}

window.NathGame.createEffects = createEffects;
})();
