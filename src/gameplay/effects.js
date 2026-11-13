(() => {
'use strict';

const { factor } = window.NathGame;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function createEffects(config, routes, actors) {
  const { cameraAudio, flashlight, noise } = config.effects;
  const noiseRates = Object.entries(noise.rates);
  const { front, back } = config.map;
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
    actor.noise = clamp(actor.noise + amount, 0, noise.max);
  }

  function integrate(dt, input) {
    let rate = 0;
    for (const [key, value] of noiseRates) if (input[key]) rate += value;
    const equilibrium = rate * noise.max / noise.decay;
    const blend = -Math.expm1(-dt * noise.decay / noise.max);
    for (const actor of actors) {
      addNoise(actor, (equilibrium - actor.noise) * blend);
      if (!flashlight.modifiers[actor.key]) continue;
      const lit = input.corridorLight && corridor.includes(actor.position);
      const lightRate = lit ? flashlight.buildPerSecond : -flashlight.decayPerSecond;
      actor.light = clamp(actor.light + lightRate * dt, 0, 1);
    }
  }

  function attackOdds(actor, objective, phase) {
    const { base, maxNoiseBonus } = config.movement.attack[objective][phase];
    const intensity = clamp(actor.noise / noise.max, 0, 1);
    const light = objective === 'corridor' && flashlight.modifiers[actor.key];
    const advance = clamp(base + maxNoiseBonus * intensity + (light ? light[phase] * actor.light : 0),
      light ? flashlight.minimumAdvance : 0, light ? flashlight.maximumAdvance : 1);
    const share = clamp(config.movement.attack.stayShare + (light ? light.stayShareDelta * actor.light : 0), 0, 1);
    const stay = (1 - advance) * share;
    return { advance, stay, abandon: 1 - advance - stay };
  }

  function weight(actor, to, now) {
    const from = actor.position;
    let result = 1;
    if (lure && now < lure.ends) {
      const distance = lure.distance.get(to) ?? Infinity;
      if (distance < (lure.distance.get(from) ?? Infinity)) {
        result *= factor(actor.rule.audioModifier * cameraAudio.factors[distance] * actor.audioRetention);
      }
    }
    if (actor.rule.hidingPlaces?.includes(to)) result *= factor(actor.rule.hidingBonus);
    return result;
  }

  return {
    startAudio, integrate, weight, attackOdds,
    staticActive: now => now < staticUntil,
    staticDeadline: now => now < staticUntil ? staticUntil : Infinity,
    triggerStatic: now => { staticUntil = now + config.effects.static.duration; },
    audioStatus: now => ({ remaining: Math.max(0, readyAt - now), camera: now < lure?.ends ? lure.camera : null }),
    addNoiseEvent: event => actors.forEach(actor => addNoise(actor, noise.events[event] ?? 0)),
    retain(actor) {
      const retain = config.movement.failedModifierRetention;
      actor.audioRetention *= retain;
      actor.noise *= retain;
      actor.light *= retain;
    }
  };
}

window.NathGame.createEffects = createEffects;
})();
