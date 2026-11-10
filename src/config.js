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

async function chooseLocalConfig() {
  let config = await loadDefaults();
  const play = document.querySelector('#enter-game');
  const picker = document.querySelector('#local-config-files');
  const status = document.querySelector('#local-config-status');
  document.querySelector('#local-config').hidden = false;
  play.disabled = false;
  let source = 'Configuração padrão local.';
  return new Promise(resolve => {
    picker.addEventListener('change', async () => {
      if (!picker.files.length) return;
      const files = new Map([...picker.files]
        .filter(file => file.webkitRelativePath.split('/').length === 2)
        .map(file => [file.name, file]));
      picker.value = '';
      picker.disabled = play.disabled = true;
      try {
        config = await readSections(async filename => {
          const file = files.get(filename);
          if (!file) throw new Error('Arquivo ausente.');
          return JSON.parse(await file.text());
        });
        source = 'Pasta de configuração carregada.';
        status.textContent = source;
      } catch (error) {
        status.textContent = `${error.message} ${source}`;
      } finally {
        picker.disabled = play.disabled = false;
      }
    });
    play.addEventListener('click', () => {
      picker.disabled = play.disabled = true;
      resolve(config);
    }, { once: true });
  });
}

window.NathGame.loadConfig = async () => {
  if (configDirectory.protocol === 'file:') {
    return { config: await chooseLocalConfig(), enterImmediately: true };
  }
  const config = await readSections(async filename => {
    const response = await fetch(new URL(filename, configDirectory), { cache: 'no-cache' });
    if (!response.ok) throw new Error('HTTP ' + response.status);
    return response.json();
  });
  return { config, enterImmediately: false };
};
})();
