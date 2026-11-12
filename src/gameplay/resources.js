(() => {
'use strict';

const clampPercent = value => Math.min(100, Math.max(0, value));

function sanityRate(rules, { camera, direct, invasion, centralGate, closet, radio, blackout }) {
  const { loss, recovery, blackoutLossMultiplier } = rules;
  const totalLoss = (camera ? loss.camera : 0)
    + (invasion ? loss.invasion : direct ? loss.direct : 0)
    + (centralGate ? loss.centralGate : 0) + (closet ? loss.closet : 0);
  return (radio ? recovery.music : 0) + (totalLoss === 0 ? recovery.passive : 0)
    - totalLoss * (blackout ? blackoutLossMultiplier : 1);
}

function hourDuration(clock, sanity) {
  const fraction = (clock.fastSanity - sanity) / (clock.fastSanity - clock.slowSanity);
  return clock.fastSecondsPerHour + Math.max(0, Math.min(1, fraction))
    * (clock.slowSecondsPerHour - clock.fastSecondsPerHour);
}

function clockProgress(clock, sanity, rate, seconds) {
  if (rate === 0 || seconds === 0) return seconds / hourDuration(clock, sanity);
  // Split where the hourly duration reaches a limit. Between limits it changes linearly.
  const cuts = [clock.slowSanity, clock.fastSanity].map(limit => (limit - sanity) / rate)
    .filter(time => time > 0 && time < seconds).sort((a, b) => a - b);
  let elapsed = 0;
  let hours = 0;
  for (const end of [...cuts, seconds]) {
    const startDuration = hourDuration(clock, sanity + rate * elapsed);
    const endDuration = hourDuration(clock, sanity + rate * end);
    const change = (endDuration - startDuration) / startDuration;
    hours += (end - elapsed) / startDuration * (change ? Math.log1p(change) / change : 1);
    elapsed = end;
  }
  return hours;
}

function createResources({ night: defaults, sanity: sanityRules, power }, night = defaults) {
  const { clock, hoursToWin, powerEnabled, sanityEnabled, secondsPerHour } = night;
  const fastestHour = secondsPerHour ?? clock.fastSecondsPerHour;
  const dynamicClock = sanityEnabled && secondsPerHour === undefined;
  let sanity = sanityEnabled ? clampPercent(sanityRules.initial) : 100;
  let energy = powerEnabled ? clampPercent(power.initial) : 100;
  let computerOn = energy > 0;
  let blackoutAt = energy === 0 ? 0 : Infinity;
  let hours = 0;

  function segment(now, until, input, observation) {
    const radioUntil = blackoutAt + power.radioGraceSeconds;
    const radio = input.radio && now < radioUntil;
    const drain = powerEnabled && energy > 0
      ? (computerOn ? power.computerDrain : 0) + input.gates.size * power.gateDrain : 0;
    const powerEnds = drain > 0 ? now + energy / drain : Infinity;
    const rate = sanityEnabled ? sanityRate(sanityRules, { ...observation, radio, blackout: energy === 0 }) : 0;
    const progress = seconds => dynamicClock ? clockProgress(clock, sanity, rate, seconds)
      : seconds / fastestHour;
    const limit = Math.min(until, powerEnds, radioUntil > now ? radioUntil : Infinity);
    const duration = limit - now;
    const remaining = hoursToWin - hours;
    let end = limit;
    let won = false;
    if (duration / fastestHour >= remaining - 1e-12 && progress(duration) >= remaining - 1e-12) {
      let low = 0;
      let high = duration;
      for (let i = 0; i < 42; i++) {
        const mid = (low + high) / 2;
        if (progress(mid) >= remaining) high = mid;
        else low = mid;
      }
      end = now + high;
      won = true;
    }
    const dt = end - now;
    hours = won ? hoursToWin : hours + progress(dt);
    if (sanityEnabled) sanity = clampPercent(sanity + rate * dt);
    if (powerEnabled) energy = end >= powerEnds ? 0 : clampPercent(energy - drain * dt);
    if (end >= powerEnds) {
      blackoutAt = end;
      computerOn = false;
    }
    return { end, radio, won };
  }

  return {
    segment,
    computerOn: () => computerOn,
    toggleComputer() { if (energy > 0) computerOn = !computerOn; },
    snapshot: now => ({ sanity, energy, hours, computerOn, blackout: energy === 0,
      radioAvailable: now < blackoutAt + power.radioGraceSeconds })
  };
}

Object.assign(window.NathGame, { createResources, sanityRate, hourDuration, clockProgress });
})();
