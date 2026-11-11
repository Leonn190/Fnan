(() => {
'use strict';

const sections = ['night', 'map', 'movement', 'characters', 'effects', 'threats', 'controls'];
const scriptUrl = document.currentScript.src;
const configDirectory = new URL('../config/', scriptUrl);

async function readSections(read) {
  return Object.fromEntries(await Promise.all(sections.map(async name => {
    const filename = name + '.json';
    try {
      const section = await read(filename);
      if (!section || typeof section !== 'object' || Array.isArray(section)) {
        throw new Error('Era esperado um objeto JSON.');
      }
      return [name, section];
    } catch (cause) {
      throw new Error('Falha ao carregar config/' + filename + '.', { cause });
    }
  })));
}

function loadDefaults() {
  return new Promise((resolve, reject) => {
    // A classic script can be loaded from disk even when fetch cannot read local JSON.
    const script = document.createElement('script');
    script.src = new URL('data/local-config.js', scriptUrl).href;
    script.onload = () => resolve(window.NathGame.localConfig);
    script.onerror = () => reject(new Error('Falha ao carregar a configuração padrão local.'));
    document.head.append(script);
  });
}

window.NathGame.loadConfig = async () => {
  if (configDirectory.protocol === 'file:') return loadDefaults();
  return readSections(async filename => {
    const response = await fetch(new URL(filename, configDirectory), { cache: 'no-cache' });
    if (!response.ok) throw new Error('HTTP ' + response.status);
    return response.json();
  });
};
})();
