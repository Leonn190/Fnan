(() => {
'use strict';

const { factor, uniform } = window.NathGame;

function createSmores(rules, level, random, emit) {
  if (!rules || level <= 0) return {
    integrate() {}, resolve() {}, nextDeadline: () => Infinity, phase: () => 'idle',
    diagnostics: () => ({ phase: 'disabled' }),
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
    diagnostics: radio => ({
      phase, looking, retreatReady, radio,
      remaining: phase === 'idle' && radio ? Math.max(0, rules.radioSeconds - radioTime)
        : phase === 'vent' ? Math.max(0, rules.silenceSeconds - silenceTime)
        : phase === 'room' ? Math.max(0, roomRemaining / roomSpeed(radio)) : null
    }),
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
      return false;
    }
    hidden = true;
    if (clownEnabled) {
      const threshold = Math.min(clown.max, ++entries * clown.floorPerEntry);
      if (!thresholds.includes(threshold)) thresholds.push(threshold);
    }
    for (const invasion of invasions.values()) if (invasion.leaveAt === null) protect(invasion, now);
    return true;
  }

  function invade(actor, now) {
    const invasion = { arrived: now, reactionEnds: now + actor.reaction, leaveAt: null };
    invasions.set(actor, invasion);
    if (hidden) protect(invasion, now);
    emit('invasion', actor);
  }

  function clownRate(radio, light) {
    if (hidden && light) return 0;
    if (radio) return -clown.musicReduction;
    return growth * (hidden ? clown.closetGrowthFactor : 1);
  }

  function integrate(dt, input) {
    if (!clownEnabled) return;
    const next = Math.max(floor, Math.min(clown.max, counter + dt * clownRate(input.radio, input.clownLight)));
    for (const threshold of thresholds) {
      if (counter <= threshold && next > threshold) floor = Math.max(floor, threshold);
    }
    counter = next;
  }

  function clownDeadline(now, radio, light) {
    const rate = clownEnabled ? clownRate(radio, light) : 0;
    return rate > 0 ? now + (clown.max - counter) / rate : Infinity;
  }

  function nextDeadline(now, radio, light) {
    let due = clownDeadline(now, radio, light);
    for (const invasion of invasions.values()) {
      due = Math.min(due, hidden ? invasion.leaveAt : invasion.reactionEnds - reactionReduction());
    }
    return due;
  }

  function resolve(now, retreat, lose, radio, light) {
    if (clownEnabled && (clownDeath || clown.max - counter <= Number.EPSILON * clown.max
        || clownDeadline(now, radio, light) <= now)) return lose('palhaca');
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
    snapshot: () => ({ hidden, counter, floor, clownStage: clownStage() }),
    invasionStatus(actor, now) {
      const invasion = invasions.get(actor);
      if (!invasion) return null;
      const deadline = hidden ? invasion.leaveAt : invasion.reactionEnds - reactionReduction();
      return { retreat: hidden, remaining: Math.max(0, deadline - now) };
    },
    clownStatus: (radio, light) => !clownEnabled ? 'dormindo'
      : clownDeath || counter >= clown.max ? 'ataque'
      : hidden && light ? 'contida pela lanterna'
      : radio ? (counter > floor ? 'recuando com a música' : 'no piso')
      : 'avançando'
  };
}

function createApproach(map, effects, random) {
  const stages = {
    corridor: [map.back, map.front, map.office],
    stock: [map.leftApproach, map.left, map.office]
  };

  function begin(actor, objective) {
    if (actor.position !== stages[objective][0]) return;
    actor.noise = 0;
    actor.light = 0;
    actor.approach = { objective, phase: 'approach' };
  }

  function options(actor) {
    const { objective, phase } = actor.approach;
    return { to: stages[objective][phase === 'approach' ? 1 : 2], objective,
      ...effects.attackOdds(actor, objective, phase) };
  }

  function choose(actor) {
    const { to, objective, advance, stay } = options(actor);
    const draw = random();
    if (draw < advance) return { to };
    return draw < advance + stay ? { stay: true } : { abandon: objective };
  }

  function arrive(actor) {
    if (actor.position === map.office) {
      if (actor.approach) actor.approach.phase = 'invasion';
    } else if (actor.approach) {
      if (actor.position === stages[actor.approach.objective][1]) actor.approach.phase = 'entry';
    } else if (actor.key === 'maid' && actor.position === map.back) {
      begin(actor, 'corridor');
    }
  }

  return { begin, choose, options, arrive };
}

Object.assign(window.NathGame, { createThreats, createSmores, createApproach });
})();
