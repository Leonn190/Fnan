(() => {
'use strict';

const clampPercent = value => Math.min(100, Math.max(0, value));

function sanityRate(rules, { cameraLoss = 0, direct, invasion, centralGate, closet, radio, blackout }) {
  const { loss, recovery, blackoutLossMultiplier } = rules;
  const totalLoss = cameraLoss
    + (invasion ? loss.invasion : 0) + (direct ? loss.direct : 0)
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

  const radioAvailable = now => now < blackoutAt + power.radioGraceSeconds;
  const flashlightAvailable = now => now < blackoutAt + power.flashlightGraceSeconds;

  function drainEnergy(amount, now) {
    if (!powerEnabled || energy === 0) return;
    energy = clampPercent(energy - amount);
    if (energy === 0) {
      blackoutAt = now;
      computerOn = false;
    }
  }

  function applyEvent(event, now) {
    if (sanityEnabled) sanity = clampPercent(sanity - (sanityRules.eventLoss[event] ?? 0));
    drainEnergy(power.eventDrain[event] ?? 0, now);
  }

  const energyDrain = (input, gates, radio) => powerEnabled && energy > 0
    ? (computerOn ? power.computerDrain : 0) + gates.size * power.gateDrain
      + (radio ? power.radioDrain : 0) + (input.flashlight ? power.flashlightDrain : 0) : 0;
  const sanityChange = (observation, radio) => sanityEnabled
    ? sanityRate(sanityRules, { ...observation, radio, blackout: energy === 0 }) : 0;

  function segment(now, until, input, observation, gates = input.gates) {
    const radioUntil = blackoutAt + power.radioGraceSeconds;
    const flashlightUntil = blackoutAt + power.flashlightGraceSeconds;
    const radio = input.radio && radioAvailable(now);
    const drain = energyDrain(input, gates, radio);
    const powerEnds = drain > 0 ? now + energy / drain : Infinity;
    const rate = sanityChange(observation, radio);
    const progress = seconds => dynamicClock ? clockProgress(clock, sanity, rate, seconds)
      : seconds / fastestHour;
    const limit = Math.min(until, powerEnds, radioUntil > now ? radioUntil : Infinity,
      flashlightUntil > now ? flashlightUntil : Infinity);
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
    drainEnergy(end >= powerEnds ? energy : drain * dt, end);
    return { end, radio, won };
  }

  return {
    segment,
    applyEvent,
    radioAvailable,
    flashlightAvailable,
    computerOn: () => computerOn,
    turnComputerOff() { computerOn = false; },
    toggleComputer() { if (energy > 0) computerOn = !computerOn; },
    snapshot(now, input, observation, gates = input?.gates) {
      const radio = radioAvailable(now);
      const frame = { sanity, energy, hours, computerOn, blackout: energy === 0,
        radioAvailable: radio, flashlightAvailable: flashlightAvailable(now) };
      if (input) {
        const radioActive = input.radio && radio;
        frame.energyLossPerSecond = energyDrain(input, gates, radioActive);
        frame.sanityLossPerSecond = Math.max(0, -sanityChange(observation, radioActive));
      }
      return frame;
    }
  };
}

Object.assign(window.NathGame, { createResources, sanityRate, hourDuration, clockProgress });
})();
