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
  let volumePeak = 0;
  let volumePeakAt = 0;
  const transientVolume = now => volumePeak * Math.exp(-(now - volumePeakAt) / .22);

  function startAudio(now, camera) {
    if (!camera || now < readyAt) return false;
    const origins = [...routes.positions.values()].filter(p => p.cameras.includes(camera)).map(p => p.id);
    const distance = routes.distances(origins, () => true, cameraAudio.factors.length - 1, undefined, true);
    lure = { camera, distance, ends: now + cameraAudio.duration };
    readyAt = now + cameraAudio.cooldown;
    for (const actor of actors) actor.audioRetention = 1;
    return true;
  }

  function addNoise(actor, amount) {
    actor.noise = clamp(actor.noise + amount, 0, noise.max);
  }

  const noiseMultiplier = actor => actor.approach.objective === 'corridor' ? noise.corridorMultiplier : 1;

  function noiseRate(input) {
    let rate = 0;
    for (const [key, value] of noiseRates) if (input[key]) rate += value;
    return rate;
  }

  function integrate(dt, input) {
    const equilibrium = noiseRate(input) * noise.max / noise.decay;
    const blend = -Math.expm1(-dt * noise.decay / noise.max);
    for (const actor of actors) {
      if (!actor.approach) continue;
      addNoise(actor, (equilibrium * noiseMultiplier(actor) - actor.noise) * blend);
      const light = flashlight.modifiers[actor.key];
      if (!light) continue;
      const lit = actor.approach.objective === 'corridor' && input.corridorLight && corridor.includes(actor.position);
      const lightRate = lit ? 1 / light.secondsToMax : -flashlight.decayPerSecond;
      actor.light = clamp(actor.light + lightRate * dt, 0, 1);
    }
  }

  function attackOdds(actor, objective, phase) {
    const { corridor, stock, stayShare } = config.movement.attack;
    const [quiet, loud] = (objective === 'corridor' ? corridor[actor.key] : stock)[phase];
    const intensity = clamp(actor.noise / noise.max, 0, 1);
    const light = objective === 'corridor' && actor.light > 0 && flashlight.modifiers[actor.key];
    const advance = clamp(quiet + (loud - quiet) * intensity + (light ? light.advanceDelta * actor.light : 0),
      light ? flashlight.minimumAdvance : 0, light ? flashlight.maximumAdvance : 1);
    const share = clamp(stayShare + (light ? light.stayShareDelta * actor.light : 0), 0, 1);
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
    // HUD gains map continuous rates and brief events onto the same 0–100 scale.
    noiseIntensity: (now, input) => clamp(noiseRate(input) * 12 + transientVolume(now), 0, 100),
    addNoiseEvent(event, now = volumePeakAt) {
      const amount = noise.events[event] ?? 0;
      volumePeak = transientVolume(now) + amount * 7;
      volumePeakAt = now;
      for (const actor of actors) {
        if (actor.approach) addNoise(actor, amount * noiseMultiplier(actor));
      }
    },
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
