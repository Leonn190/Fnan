const assert = require('node:assert/strict');
const { test } = require('node:test');

global.window = { NathGame: {} };
const loads = [];
global.Image = class {
  set src(source) {
    this.source = source;
    loads.push(this);
  }
  removeAttribute(name) {
    assert.equal(name, 'src');
    this.removed = true;
  }
  decode() { assert.fail('Speculative warming must not force image decode'); }
};
require('../src/image-cache.js');
const { createImageCache, clearImageSource, setImageSource } = window.NathGame;

test('eviction and clear release active requests and leave late callbacks harmless', () => {
  const cache = createImageCache({ limit: 2, parallel: 1 });
  cache.warm(['old', 'queued']);
  assert.deepEqual(cache.stats(), { ready: 0, pending: 1, queued: 1, cancelled: 0 });
  const staleLoad = loads[0].onload;
  cache.warm(['recent', 'next']);
  assert.deepEqual(loads.map(image => image.source), ['old', 'recent']);
  assert.equal(loads[0].removed, true);
  assert.equal(loads[0].onload, null);
  staleLoad();
  assert.deepEqual(cache.stats(), { ready: 0, pending: 1, queued: 1, cancelled: 1 });

  const staleError = loads[1].onerror;
  cache.clear();
  assert.equal(loads[1].removed, true);
  cache.warm(['recent']);
  staleError();
  assert.equal(cache.size, 1);
  loads[2].onerror();
  assert.equal(cache.size, 0);

  cache.warm(['recent', 'other']);
  loads[3].onload();
  assert.equal(loads[3].removed, true);
  assert.deepEqual(cache.stats(), { ready: 1, pending: 1, queued: 0, cancelled: 2 });
  cache.cancelPending();
  assert.equal(loads[4].removed, true);
  cache.warm(['recent']);
  assert.equal(loads.length, 5);

  cache.warm(['other']);
  loads[5].onload();
  cache.markLoaded('recent');
  cache.warm(['new']);
  loads[6].onload();
  cache.warm(['recent']);
  assert.equal(loads.length, 7);
  assert.equal(cache.size, 2);
});

test('only the current visible request can trigger its error handler', () => {
  const visible = {
    complete: false,
    naturalWidth: 0,
    getAttribute: () => visible.src ?? null,
    removeAttribute: () => { delete visible.src; }
  };
  const errors = [];
  setImageSource(visible, 'old', () => errors.push('old'));
  const staleError = visible.onerror;
  setImageSource(visible, 'recent', () => errors.push('recent'));
  visible.complete = true;
  staleError();
  assert.deepEqual(errors, []);
  visible.onerror();
  assert.deepEqual(errors, ['recent']);
  const clearedError = visible.onerror;
  clearImageSource(visible);
  clearedError();
  assert.deepEqual(errors, ['recent']);
  assert.equal(visible.src, undefined);
});

test('a visible load supersedes its speculative request', () => {
  const cache = createImageCache({ limit: 3, parallel: 1 });
  cache.warm(['visible', 'alternate']);
  const image = loads.at(-1);
  cache.markLoaded('visible');
  assert.equal(image.removed, true);
  assert.equal(loads.at(-1).source, 'alternate');
  assert.deepEqual(cache.stats(), { ready: 1, pending: 1, queued: 0, cancelled: 0 });
});

test('a pending source can serve the next frame without being requested again', () => {
  let current;
  let requests = 0;
  const image = {
    complete: false,
    naturalWidth: 0,
    getAttribute: () => current,
    set src(source) { current = source; requests++; }
  };
  let loaded;
  setImageSource(image, 'shared', null, () => { loaded = 'old frame'; }, true);
  const stale = image.onload;
  setImageSource(image, 'shared', null, () => { loaded = 'new frame'; }, true);
  image.complete = true;
  image.naturalWidth = 10;
  stale();
  assert.equal(loaded, undefined);
  image.onload();
  assert.equal(loaded, 'new frame');
  assert.equal(requests, 1);
});

test('changing views preserves shared work and removes obsolete queued entries', () => {
  const cache = createImageCache({ limit: 3, parallel: 1 });
  cache.warmForView(['shared', 'old']);
  const shared = loads.at(-1);
  cache.warmForView(['shared', 'new']);
  assert.equal(shared.removed, undefined);
  shared.onload();
  assert.equal(loads.at(-1).source, 'new');
  assert.equal(cache.size, 2);
});
