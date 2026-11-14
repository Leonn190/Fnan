// Monta o site estático para publicação. Execute com node scripts/package-pages.cjs.
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const destination = path.resolve(process.argv[2] ?? path.join(root, 'dist'));
const files = [
  '.nojekyll', 'index.html',
  'public/images/Anúncio Vintage de Contratação Animatrônica.png',
  'public/images/Smores nas Frestas do Escritório.png',
  'public/NNN_Yandere_Jumpscare_1080p.gif',
  'public/SFXBible_12478.ogg',
  ...[
    '01_FNAF2_Music_Box', '02_FNAF2_Vent', '04_FNAF4_Door_Creak',
    '06_FNAF4_Player_Running', '07_FNAF4_Flashlight', '08_FNAF4_Nightmare_Jumpscare',
    '10_FNAF3_Rebooting', '11_FNAF2_Chimes'
  ].map(name => `public/${name}.mp3`),
  ...['scream.wav', 'shadow.ogg', 'palhaça.ogg'].map(name => `public/audio/jumpscares/${name}`)
];

function include(directory, pattern) {
  for (const entry of fs.readdirSync(path.join(root, directory), { withFileTypes: true, recursive: true })) {
    if (!entry.isFile()) continue;
    const relative = path.relative(root, path.join(entry.parentPath, entry.name)).split(path.sep).join('/');
    if (pattern.test(relative)) files.push(relative);
  }
}

include('src', /\.(js|css)$/);
include('config', /\.json$/);
include('public/images', /(?:\.(webp|gif|svg)$|\/cameras\/CAM\d{2}\/technical\.png$)/);
include('public/audio', /\/audio\/(?:menu\/[^/]+\.mp3|radio\/[^/]+\.mp3|metal\d{2}\.mp3)$/);
for (const folder of ['01_camera_sinistra', '02_camera_pesadelo']) include(`public/${folder}`, /\.wav$/);

// As variantes iluminadas exportadas são referências dos testes de arte.
const runtimeFiles = files.filter(file => !/^public\/images\/office\/states\/(?:open-lit|corridor)\//.test(file));
fs.mkdirSync(destination, { recursive: true });
if (fs.readdirSync(destination).length) throw new Error(`Use uma pasta vazia para publicar: ${destination}`);

let bytes = 0;
for (const file of runtimeFiles) {
  const source = path.join(root, file);
  const output = path.join(destination, file);
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.copyFileSync(source, output);
  bytes += fs.statSync(source).size;
}
console.log(`${runtimeFiles.length} arquivos, ${(bytes / 1e6).toFixed(2)} MB em ${destination}`);
