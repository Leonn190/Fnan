(() => {
'use strict';

function createImageCache({ limit, parallel }) {
  const entries = new Map();
  let active = 0;

  function pump() {
    for (const entry of entries.values()) {
      if (active >= parallel) break;
      if (entry.image) continue;
      const image = entry.image = new Image();
      image.decoding = 'async';
      image.fetchPriority = 'low';
      active++;
      const done = failed => {
        image.onload = image.onerror = null;
        if (failed && entries.get(entry.source) === entry) entries.delete(entry.source);
        active--;
        pump();
      };
      image.onload = () => {
        if (entry.decode && entries.get(entry.source) === entry && image.decode) {
          image.decode().then(() => done(false), () => done(false));
        } else done(false);
      };
      image.onerror = () => done(true);
      image.src = entry.source;
    }
  }

  return {
    warm(sources, decode = true) {
      for (const source of sources) {
        if (!source) continue;
        const entry = entries.get(source) ?? { source, decode };
        entries.delete(source);
        entries.set(source, entry);
      }
      while (entries.size > limit) entries.delete(entries.keys().next().value);
      pump();
    },
    touch(source) {
      const entry = entries.get(source);
      if (!entry) return;
      entries.delete(source);
      entries.set(source, entry);
    },
    clear: () => entries.clear(),
    get size() { return entries.size; }
  };
}

// The visible element owns its request. Preload and decode callbacks never write to it.
function setImageSource(image, source, onError = null) {
  if (image.getAttribute('src') === source) {
    if (image.complete && image.naturalWidth === 0) onError?.();
    return;
  }
  function handleError() {
    if (image.onerror === handleError && image.getAttribute('src') === source
      && image.complete && image.naturalWidth === 0) onError();
  }
  image.onerror = onError ? handleError : null;
  image.src = source;
}

Object.assign(window.NathGame, { createImageCache, setImageSource });
})();
