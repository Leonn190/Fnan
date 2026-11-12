(() => {
'use strict';

const { factor, uniform } = window.NathGame;

function createSmores(rules, level, random, emit) {
  if (!rules || level <= 0) return {
    integrate() {}, resolve() {}, nextDeadline: () => Infinity, phase: () => 'idle',
    intervalReduction: () => 0, reactionReduction: () => 0, targetBonusMultiplier: () => 1
  };

  const progress = (level - 1) / 9;
  const { ventChance, roomSeconds, intervalReduction, reactionReduction } = Object.fromEntries(
    Object.entries(rules.level1).map(([key, value]) => [key, value + progress * (rules.level10[key] - value)])
  );
  const tolerance = 1e-9;
  const roomSpeed = radio => radio ? 1 : rules.quietRoomSpeed;
  let phase = 'idle';
  let radioTime = 0;
  let silenceTime = 0;
  let retreatReady = false;
  let looking = false;
  let roomRemaining = 0;

  function setPhase(next) {
    phase = next;
    emit('smores', phase);
  }

  function integrate(dt, radio) {
    if (phase === 'idle') radioTime = radio ? radioTime + dt : 0;
    if (phase === 'vent' && !retreatReady) {
      silenceTime = radio ? 0 : silenceTime + dt;
      retreatReady = silenceTime >= rules.silenceSeconds - tolerance;
    }
    if (phase === 'room') roomRemaining -= dt * roomSpeed(radio);
  }

  function nextDeadline(now, radio) {
    if (phase === 'idle' && radio) return now + (rules.radioSeconds - radioTime);
    if (phase === 'room') return now + roomRemaining / roomSpeed(radio);
    return Infinity;
  }

  function resolve(input, radio, ventOpportunity) {
    if (phase === 'idle') {
      if (radioTime >= rules.radioSeconds - tolerance) {
        radioTime = 0;
        if (random() * 100 < ventChance) setPhase('pre-vent');
      }
      if (!radio) radioTime = 0;
    }
    if (phase === 'pre-vent') {
      if (ventOpportunity) {
        looking = Boolean(input.smoresLooking);
        silenceTime = 0;
        retreatReady = false;
        setPhase('vent');
      }
      return;
    }
    if (phase === 'vent') {
      if (radio) silenceTime = 0;
      if (looking && !input.smoresLooking) {
        if (retreatReady) setPhase('idle');
        else if (radio) {
          roomRemaining = roomSeconds;
          setPhase('room');
        }
      }
      looking = Boolean(input.smoresLooking);
    } else if (phase === 'room' && roomRemaining <= tolerance) {
      setPhase('idle');
    }
  }

  return {
    integrate, nextDeadline, resolve, phase: () => phase,
    intervalReduction: () => phase === 'room' ? intervalReduction : 0,
    reactionReduction: () => phase === 'room' ? reactionReduction : 0,
    targetBonusMultiplier: () => phase === 'room' ? rules.targetBonusMultiplier : 1
  };
}

function createThreats(config, levels, random, emit, reactionReduction = () => 0) {
  const { attack, clown } = config.threats;
  const clownEnabled = levels.palhaca > 0;
  const growth = clown.growth * factor(clown.growthIncreasePerLevel * levels.palhaca);
  const invasions = new Map();
  const thresholds = [];
  let hidden = false;
  let counter = clownEnabled ? clown.initial : 0;
  let floor = clownEnabled ? clown.min : 0;
  let entries = 0;
  let clownDeath = false;

  function protect(invasion, now) {
    const late = invasion.reactionEnds - reactionReduction() - now <= attack.lateThreshold;
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

  function nextDeadline(now, input) {
    const rate = clownEnabled ? clownRate(input) : 0;
    const deathAt = rate > 0 ? now + (clown.max - counter) / rate : Infinity;
    return Math.min(deathAt, ...[...invasions.values()].map(invasion =>
      hidden ? invasion.leaveAt : invasion.reactionEnds - reactionReduction()
    ));
  }

  function resolve(now, retreat, lose) {
    if (clownEnabled && (clownDeath || clown.max - counter <= Number.EPSILON * clown.max)) return lose('palhaca');
    for (const [actor, invasion] of invasions) {
      if (!hidden && now >= invasion.reactionEnds - reactionReduction()) return lose(actor.key);
      if (hidden && now >= invasion.leaveAt) {
        invasions.delete(actor);
        retreat(actor);
      }
    }
  }

  const clownStage = () => clownEnabled ? clown.stages.findLastIndex(threshold => counter >= threshold) : -1;
  return {
    enterCloset, exitCloset: () => { hidden = false; },
    invade, integrate, nextDeadline, resolve, clownStage,
    snapshot: () => ({ hidden, counter, floor, clownStage: clownStage() })
  };
}

Object.assign(window.NathGame, { createThreats, createSmores });
})();
