(() => {
'use strict';

function createElectrical() {
  let fault = false;
  let switchedOff = false;

  return {
    failed: () => fault,
    trip() {
      if (fault) return false;
      fault = true;
      switchedOff = false;
      return true;
    },
    powerChanged(wasOn, isOn) {
      if (!fault || wasOn === isOn) return false;
      if (!isOn) switchedOff = true;
      if (!isOn || !switchedOff) return false;
      fault = switchedOff = false;
      return true;
    }
  };
}

window.NathGame.createElectrical = createElectrical;
})();
