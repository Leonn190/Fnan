const assert = require('node:assert/strict');

global.window = { NathGame: {} };
const loads = [];
global.Image = class {
  set src(source) {
    this.source = source;
    loads.push(this);
  }
  decode() { return new Promise(resolve => { this.finishDecode = resolve; }); }
};
require('../src/image-cache.js');
const { createImageCache, setImageSource } = window.NathGame;

async function test() {
  const cache = createImageCache({ limit: 2, parallel: 1 });
  cache.warm(['old', 'queued']);
  assert.deepEqual(loads.map(image => image.source), ['old']);
  cache.warm(['recent', 'next']);
  assert.equal(cache.size, 2);
  assert.equal(loads.length, 1);

  const visible = {
    complete: false,
    naturalWidth: 0,
    getAttribute: () => visible.src
  };
  const errors = [];
  setImageSource(visible, 'old', () => errors.push('old'));
  const staleError = visible.onerror;
  setImageSource(visible, 'recent', () => errors.push('recent'));
  staleError();
  assert.deepEqual(errors, []);
  setImageSource(visible, 'old', () => errors.push('new request for old'));
  visible.complete = true;
  staleError();
  assert.deepEqual(errors, []);
  visible.complete = false;

  loads[0].onload();
  assert.equal(loads[0].finishDecode, undefined);
  assert.deepEqual(loads.map(image => image.source), ['old', 'recent']);
  loads[1].onload();
  assert.equal(loads.length, 2);
  cache.clear();
  assert.equal(cache.size, 0);
  cache.warm(['latest']);
  setImageSource(visible, 'latest', () => errors.push('latest'));
  loads[1].finishDecode();
  await Promise.resolve();
  assert.equal(visible.src, 'latest');
  assert.deepEqual(loads.map(image => image.source), ['old', 'recent', 'latest']);

  loads[2].onerror();
  assert.equal(cache.size, 0);
  cache.warm(['latest'], false);
  loads[3].onload();
  cache.warm(['other'], false);
  loads[4].onload();
  cache.touch('latest');
  cache.warm(['new'], false);
  loads[5].onload();
  cache.warm(['latest']);
  assert.equal(loads.length, 6);
  assert.equal(cache.size, 2);
  visible.complete = true;
  visible.onerror();
  assert.deepEqual(errors, ['latest']);
  console.log('PASS: bounded LRU and preload concurrency, clear during decode, retry, and latest image request.');
}

test().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
