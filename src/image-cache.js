(() => {
'use strict';

function createImageCache({ limit, parallel }) {
  const entries = new Map();
  let pending = 0;
  let cancelled = 0;

  function release(entry) {
    const image = entry.image;
    if (!image) return;
    entry.image = null;
    pending--;
    image.onload = image.onerror = null;
    image.removeAttribute('src');
  }

  function remove(entry) {
    entries.delete(entry.source);
    if (entry.image) cancelled++;
    release(entry);
  }

  function remember(entry) {
    entries.delete(entry.source);
    entries.set(entry.source, entry);
    while (entries.size > limit) remove(entries.values().next().value);
  }

  function pump() {
    for (const entry of entries.values()) {
      if (pending >= parallel) break;
      if (entry.image || entry.loaded) continue;
      const image = entry.image = new Image();
      image.decoding = 'async';
      image.fetchPriority = 'low';
      pending++;
      const done = loaded => {
        if (entry.image !== image) return;
        entry.loaded = loaded;
        release(entry);
        if (!loaded) entries.delete(entry.source);
        pump();
      };
      // Keep only a record of completed warms. The browser owns HTTP/image caching.
      image.onload = () => done(true);
      image.onerror = () => done(false);
      image.src = entry.source;
    }
  }

  function warm(sources) {
    for (const source of sources) {
      if (source) remember(entries.get(source) ?? { source });
    }
    pump();
  }

  return {
    warm,
    markLoaded(source) {
      if (!source) return;
      const entry = entries.get(source) ?? { source };
      release(entry);
      entry.loaded = true;
      remember(entry);
      pump();
    },
    warmForView(sources) {
      const wanted = new Set(sources);
      for (const entry of entries.values()) {
        if (!entry.loaded && !wanted.has(entry.source)) remove(entry);
      }
      warm(sources);
    },
    cancelPending() {
      for (const entry of entries.values()) if (!entry.loaded) remove(entry);
    },
    clear() {
      for (const entry of entries.values()) remove(entry);
    },
    stats() {
      let ready = 0;
      for (const entry of entries.values()) if (entry.loaded) ready++;
      return { ready, pending, queued: entries.size - ready - pending, cancelled };
    },
    get size() { return entries.size; }
  };
}

function clearImageSource(image) {
  image.onload = image.onerror = null;
  if (image.getAttribute('src') !== null) image.removeAttribute('src');
}

// The visible element owns its request. Preload and decode callbacks never write to it.
function setImageSource(image, source, onError = null, onLoad = null) {
  if (image.getAttribute('src') === source) {
    if (image.complete && image.naturalWidth === 0) onError?.();
    return;
  }
  function handleError() {
    if (image.onerror === handleError && image.getAttribute('src') === source
      && image.complete && image.naturalWidth === 0) onError();
  }
  image.onerror = onError ? handleError : null;
  image.onload = onLoad ? function handleLoad() {
    if (image.onload !== handleLoad || image.getAttribute('src') !== source || !image.naturalWidth) return;
    image.onload = null;
    onLoad();
  } : null;
  image.src = source;
}

Object.assign(window.NathGame, { createImageCache, clearImageSource, setImageSource });
})();
