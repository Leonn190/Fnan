(() => {
'use strict';

function shadowDifficulty(rules, level, maxLevel) {
  if (level <= 0) return null;
  const fraction = (level - 1) / Math.max(1, maxLevel - 1);
  const interpolate = key => rules.firstLevel[key] + fraction * (rules.lastLevel[key] - rules.firstLevel[key]);
  return { sanityLimit: interpolate('sanityLimit'), chance: interpolate('chance'),
    searchSeconds: interpolate('searchSeconds') };
}

function createShadow(rules, difficulty, cameras, random) {
  let phase = 'inactive';
  let camera = null;
  let attackAt = Infinity;
  let phaseEnds = Infinity;
  let suppressComputerReturn = false;

  function clear() {
    phase = 'inactive';
    camera = null;
    attackAt = phaseEnds = Infinity;
  }

  function returnToOffice(now, source, sanity, blackout) {
    if (source === 'computer' && suppressComputerReturn) {
      suppressComputerReturn = false;
      if (phase === 'found') clear();
      return;
    }
    if (!difficulty || phase !== 'inactive' || blackout || sanity >= difficulty.sanityLimit) return;
    const chance = Math.min(100, difficulty.chance + (difficulty.sanityLimit - sanity) * rules.chancePerSanityPoint);
    if (random() * 100 >= chance) return;
    camera = cameras[Math.floor(random() * cameras.length)];
    attackAt = now + difficulty.searchSeconds;
    phaseEnds = now + rules.manifestSeconds;
    phase = 'manifested';
  }

  function update(now, viewedCamera, blackout) {
    if (blackout) {
      stop();
      return false;
    }
    if (now >= attackAt) {
      clear();
      phase = 'attack';
      return true;
    }
    if ((phase === 'manifested' || phase === 'searching') && viewedCamera === camera) {
      phase = 'found';
      suppressComputerReturn = true;
      attackAt = Infinity;
      phaseEnds = now + rules.foundSeconds;
    } else if (now >= phaseEnds) {
      if (phase === 'found') clear();
      else {
        phase = 'searching';
        phaseEnds = Infinity;
      }
    }
    return false;
  }

  function stop() {
    clear();
    suppressComputerReturn = false;
  }

  return { update, returnToOffice, stop, nextDeadline: () => Math.min(attackAt, phaseEnds),
    snapshot: () => ({ phase, camera }) };
}

Object.assign(window.NathGame, { createShadow, shadowDifficulty });
})();
