const fs = require('node:fs');
const path = require('node:path');

const directory = path.resolve(__dirname, '../config');
const output = path.resolve(__dirname, '../src/data/local-config.js');
const config = Object.fromEntries(fs.readdirSync(directory).filter(name => name.endsWith('.json')).sort()
  .map(name => [path.basename(name, '.json'), JSON.parse(fs.readFileSync(path.join(directory, name), 'utf8'))]));
const script = '// Gerado por scripts/sync-local-config.cjs a partir de config/*.json.\n'
  + 'window.NathGame.localConfig = ' + JSON.stringify(config, null, 2) + ';\n';

if (process.argv.includes('--check')) {
  if (!fs.existsSync(output) || fs.readFileSync(output, 'utf8').replace(/\r\n/g, '\n') !== script) {
    throw new Error('Configuração padrão local desatualizada. Execute node scripts/sync-local-config.cjs.');
  }
} else {
  fs.writeFileSync(output, script);
}
