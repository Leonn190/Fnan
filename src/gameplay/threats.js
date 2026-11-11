(() => {
'use strict';

const { factor, uniform, weighted } = window.NathGame;

function createThreats(config, levels, random, emit) {
  const { attack, clown, sabotage } = config.threats;
  const clownEnabled = levels.palhaca > 0;
  const growth = clown.growth * factor(clown.growthIncreasePerLevel * levels.palhaca);
  const invasions = new Map();
  const faults = new Map();
  const thresholds = [];
  let hidden = false;
  let counter = clownEnabled ? clown.initial : 0;
  let floor = clownEnabled ? clown.min : 0;
  let entries = 0;
  let clownDeath = false;

  function protect(invasion, now) {
    const late = invasion.reactionEnds - now <= attack.lateThreshold;
    const stay = late ? attack.lateStay : attack.stay;
    invasion.leaveAt = Math.max(now, invasion.arrived + stay + uniform(random, attack.jitter));
  }

  function enterCloset(now) {
    if (clownEnabled && counter > clown.entryDeathAbove) {
      clownDeath = true;
      return;
    }
    hidden = true;
    if (clownEnabled) {
      const threshold = Math.min(clown.max, ++entries * clown.floorPerEntry);
      if (!thresholds.includes(threshold)) thresholds.push(threshold);
    }
    for (const invasion of invasions.values()) if (invasion.leaveAt === null) protect(invasion, now);
  }

  function invade(actor, now) {
    const invasion = { arrived: now, reactionEnds: now + actor.reaction, leaveAt: null };
    invasions.set(actor, invasion);
    if (hidden) protect(invasion, now);
    emit('invasion', actor);
  }

  function triggerSabotage(actor, now) {
    const counts = sabotage.countWeights[actor.abilityTier];
    const systems = Object.keys(sabotage.systems);
    const count = Number(weighted(random, Object.keys(counts), id => counts[id]));
    const selected = [];
    while (selected.length < count && systems.length) {
      const id = weighted(random, systems, system => sabotage.systems[system]);
      if (id === undefined) break;
      systems.splice(systems.indexOf(id), 1);
      selected.push(id);
      // A new hit cannot extend a fault that is already active.
      if (!faults.has(id)) faults.set(id, now);
    }
    emit('sabotage', selected);
  }

  function clownRate(input) {
    if (hidden && input.clownLight) return 0;
    if (input.radio) return -clown.musicReduction;
    return growth * (hidden ? clown.closetGrowthFactor : 1);
  }

  function integrate(dt, input) {
    if (!clownEnabled) return;
    const next = Math.max(floor, Math.min(clown.max, counter + dt * clownRate(input)));
    for (const threshold of thresholds) {
      if (counter <= threshold && next > threshold) floor = Math.max(floor, threshold);
    }
    counter = next;
  }

  function ventilationDeadline() {
    const started = faults.get('ventilacao');
    return started === undefined ? Infinity : started + sabotage.effects.ventilacao.deadline;
  }

  function nextDeadline(now, input) {
    const rate = clownEnabled ? clownRate(input) : 0;
    const deathAt = rate > 0 ? now + (clown.max - counter) / rate : Infinity;
    return Math.min(deathAt, ventilationDeadline(), ...[...invasions.values()].map(invasion =>
      hidden ? invasion.leaveAt : invasion.reactionEnds
    ));
  }

  function resolve(now, retreat, lose) {
    if (clownEnabled && (clownDeath || clown.max - counter <= Number.EPSILON * clown.max)) return lose('palhaca');
    if (now >= ventilationDeadline()) return lose('ventilacao');
    for (const [actor, invasion] of invasions) {
      if (!hidden && now >= invasion.reactionEnds) return lose(actor.key);
      if (hidden && now >= invasion.leaveAt) {
        invasions.delete(actor);
        retreat(actor);
      }
    }
  }

  const clownStage = () => clownEnabled ? clown.stages.findLastIndex(threshold => counter >= threshold) : -1;
  return {
    enterCloset, exitCloset: () => { hidden = false; },
    invade, triggerSabotage, integrate, nextDeadline, resolve, clownStage,
    snapshot: now => ({
      hidden, counter, floor, faults: [...faults.keys()],
      ventilationRemaining: faults.has('ventilacao') ? Math.max(0, ventilationDeadline() - now) : null,
      clownStage: clownStage()
    })
  };
}

window.NathGame.createThreats = createThreats;
})();
