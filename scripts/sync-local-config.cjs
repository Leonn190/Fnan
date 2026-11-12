const fs = require('node:fs');
const path = require('node:path');

const directory = path.resolve(__dirname, '../config');
const output = path.resolve(__dirname, '../src/data/local-config.js');
const mapOutput = path.resolve(__dirname, '../NNN_mapa_posicoes_22.json');
const config = Object.fromEntries(fs.readdirSync(directory).filter(name => name.endsWith('.json')).sort()
  .map(name => [path.basename(name, '.json'), JSON.parse(fs.readFileSync(path.join(directory, name), 'utf8'))]));
const script = '// Gerado por scripts/sync-local-config.cjs a partir de config/*.json.\n'
  + 'window.NathGame.localConfig = ' + JSON.stringify(config, null, 2) + ';\n';

const { positions, edges, office, left, front } = config.map;
const connections = new Map(positions.map(({ id }) => [id, []]));
for (const { from, to, oneWay } of edges) {
  connections.get(from).push(to);
  if (!oneWay) connections.get(to).push(from);
}
const exterior = edges.filter(({ type }) => type === 'exterior');
const exits = [...new Set(exterior.flatMap(({ from, to }) => [from, to]))].sort((a, b) => a - b);
const kinds = new Map([...exits.map(id => [id, 'saida']), [left, 'aproximacao_controle'], [office, 'ataque']]);
const mapExport = JSON.stringify({
  projeto: "Nine Nights at Nath's (NNN)",
  versao: 'mapa-posicoes-v4',
  fonte: 'config/map.json',
  total_posicoes: positions.length,
  total_ligacoes: edges.length,
  ligacoes_bidirecionais: edges.every(({ oneWay }) => !oneWay),
  posicoes: positions.map(({ id, name, room, point }) => ({
    id, nome: name, tipo: kinds.get(id), sala: room, ponto: point, conexoes: connections.get(id).sort((a, b) => a - b)
  })),
  regras_especiais: {
    saidas_externas: exits,
    saidas_interligadas: exterior.length === exits.length * (exits.length - 1) / 2,
    sala_controle_ataque: office,
    entradas_sala_controle: [left, front]
  }
}, null, 2) + '\n';

for (const [file, contents] of [[output, script], [mapOutput, mapExport]]) {
  if (!process.argv.includes('--check')) {
    fs.writeFileSync(file, contents);
    continue;
  }
  if (!fs.existsSync(file) || fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n') !== contents) {
    throw new Error(path.basename(file) + ' desatualizado. Execute node scripts/sync-local-config.cjs.');
  }
}
