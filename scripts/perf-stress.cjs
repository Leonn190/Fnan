const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const os = require('node:os');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const { setTimeout: wait } = require('node:timers/promises');

const [chrome, minutes = '25', codeRoot = '.', assetRoot = '.', port = '9222'] = process.argv.slice(2);
if (!chrome || !Number.isFinite(Number(minutes)) || Number(minutes) <= 0) {
  console.error('Uso: node scripts/perf-stress.cjs <chrome.exe> [minutos=25] [checkout=.] [assets=.] [porta=9222]');
  process.exit(1);
}

const assets = path.resolve(assetRoot);
const code = path.resolve(codeRoot);
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.webp': 'image/webp',
  '.png': 'image/png', '.gif': 'image/gif', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav' };
const server = http.createServer((req, res) => {
  const uri = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  const root = uri.startsWith('/public/') ? assets : code;
  const file = path.resolve(root, '.' + (uri === '/' ? '/index.html' : uri));
  if (!file.startsWith(root + path.sep)) return res.writeHead(403).end();
  fs.stat(file, (error, stat) => {
    if (error || !stat.isFile()) return res.writeHead(404).end();
    const headers = { 'Content-Type': types[path.extname(file)] ?? 'application/octet-stream',
      'Cache-Control': 'public, max-age=3600', 'Accept-Ranges': 'bytes' };
    const range = req.headers.range?.match(/^bytes=(\d+)-(\d*)$/);
    const start = range ? Number(range[1]) : 0;
    const end = range?.[2] ? Math.min(Number(range[2]), stat.size - 1) : stat.size - 1;
    if (start > end) return res.writeHead(416, { 'Content-Range': 'bytes */' + stat.size }).end();
    if (range) headers['Content-Range'] = 'bytes ' + start + '-' + end + '/' + stat.size;
    headers['Content-Length'] = end - start + 1;
    res.writeHead(range ? 206 : 200, headers);
    const stream = fs.createReadStream(file, { start, end });
    res.on('close', () => stream.destroy());
    stream.pipe(res);
  });
});

function scenario() {
  const $ = selector => document.querySelector(selector);
  const click = selector => $(selector)?.click();
  const visible = selector => $(selector)?.getClientRects().length > 0;
  const key = (key, type = 'keydown') => document.dispatchEvent(new KeyboardEvent(type, { key, bubbles: true }));
  const frames = [];
  const jobs = {};
  const images = new Map();
  const recentImages = new Map();
  const observed = new Map();
  const modes = {};
  let longAnimationFrames = 0;
  let longBlockingMs = 0;
  let sequence = 0;
  let previousFrame;
  let previousMode;
  let maxLiveBytes = 0;
  const count = name => { jobs[name] = (jobs[name] ?? 0) + 1; };
  new PerformanceObserver(list => {
    for (const entry of list.getEntries()) {
      if (!/\.(webp|gif|png)(\?|$)/i.test(entry.name)) continue;
      const old = images.get(entry.name) ?? { requests: 0, transfers: 0, compressed: 0 };
      old.requests++;
      old.transfers += entry.transferSize;
      old.compressed = Math.max(old.compressed, entry.encodedBodySize);
      images.set(entry.name, old);
      recentImages.set(entry.name, old.compressed);
    }
  }).observe({ type: 'resource', buffered: true });
  if (PerformanceObserver.supportedEntryTypes.includes('long-animation-frame')) {
    new PerformanceObserver(list => {
      for (const entry of list.getEntries()) {
        longAnimationFrames++;
        longBlockingMs += entry.blockingDuration;
      }
    }).observe({ type: 'long-animation-frame' });
  }
  function sample(t) {
    const game = $('#game');
    const mode = game.hidden ? 'menu' : game.dataset.defeat ?? game.dataset.mode;
    if (previousFrame !== undefined) {
      frames.push(t - previousFrame);
      if (previousMode === mode) (modes[mode] ??= []).push(t - previousFrame);
    }
    previousFrame = t;
    previousMode = mode;
    requestAnimationFrame(sample);
  }
  requestAnimationFrame(sample);
  function sampleImages() {
    const live = new Map();
    for (const img of document.images) {
      if (!img.currentSrc || !img.naturalWidth) continue;
      const bytes = img.naturalWidth * img.naturalHeight * 4;
      live.set(img.currentSrc, bytes);
      if (img.getClientRects().length) observed.set(img.currentSrc, bytes);
    }
    maxLiveBytes = Math.max(maxLiveBytes, [...live.values()].reduce((sum, value) => sum + value, 0));
  }
  const plan = [1, 5, 9, 'zero', 'max', 'mixed'];
  let nightIndex = 0;
  let activeSince;
  let retry = false;
  let retried = false;
  let selected;
  let lastAction = 0;
  click('#enter-game');

  setInterval(() => {
    sampleImages();
    if (visible('#night-intro')) return;
    if (visible('#game-over')) {
      if (retry) { click('#retry-night'); count('retry'); retry = false; }
      else { click('#return-to-menu'); count('menu'); }
      activeSince = undefined;
      return;
    }
    if (visible('#shift-complete')) {
      click('#complete-menu'); count('menu'); activeSince = undefined;
      return;
    }
    if (visible('#title-screen')) {
      selected = plan[nightIndex++ % plan.length];
      retried = false;
      count('start-' + selected);
      if (typeof selected === 'number') {
        localStorage.setItem('nnn.campaign.completed', String(selected - 1));
        click(selected === 1 ? '#start-game' : '#continue-game');
      } else {
        click('#open-custom');
        if ($('#custom-debug')?.getAttribute('aria-pressed') === 'false') click('#custom-debug');
        [...document.querySelectorAll('#custom-levels select')].forEach((select, i) => {
          select.value = selected === 'zero' ? '0' : selected === 'max' ? '10' : String(i % 2 ? 0 : 5);
        });
        $('#custom-form').requestSubmit();
      }
      return;
    }
    const game = $('#game');
    if (game.inert || $('#playfield').inert || game.dataset.defeat) return;
    const now = performance.now();
    if (activeSince === undefined) {
      activeSince = now;
      sequence = 0;
    }
    if (now - activeSince > (retried ? 23000 : 69000)) {
      retry = !retried && nightIndex % 2 === 0;
      retried ||= retry;
      key('j'); count('debug-jumpscare');
      return;
    }
    if (game.dataset.closetTransition || game.dataset.monitorTransition || now < lastAction) return;
    const step = sequence++ % 48;
    const mode = game.dataset.mode;
    if (mode === 'cameras') {
      if (step === 27 || step === 44) { click('#monitor-exit'); count('monitor-close'); return; }
      const cams = document.querySelectorAll('.map-camera');
      const gates = document.querySelectorAll('.map-gate');
      const camera = cams[(sequence * 7) % cams.length];
      camera?.dispatchEvent(new MouseEvent('click', { bubbles: true })); count('camera');
      if (step % 3 === 0) {
        gates[(sequence * 5) % gates.length]?.dispatchEvent(new MouseEvent('click', { bubbles: true })); count('gate');
      }
      if (!$('#camera-audio').disabled) { click('#camera-audio'); count('camera-audio'); }
    } else if (mode === 'desktop') {
      click('#open-cameras'); count('camera-app');
    } else if (mode === 'office') {
      if (step < 11) {
        if (step % 4 === 0) { click('#office-radio'); count('radio'); }
        else if (step % 3 === 0) { click('#office-gate'); count('office-gate'); }
        else { key(step % 2 ? 'a' : 'd'); key('w'); key('w', 'keyup'); }
      } else if (step >= 28 && step < 34) {
        click('#office-closet'); count('closet-enter');
      } else {
        click('#office-monitor'); count('monitor-open');
      }
    } else if (mode === 'closet') {
      if (step === 36) { key('d'); lastAction = now + 650; }
      else if (step === 37) { key('w'); lastAction = now + 650; }
      else if (step === 38) { key('w', 'keyup'); key('a'); lastAction = now + 650; }
      else if (step >= 39 || step < 28) { click('#closet-exit'); count('closet-exit'); }
    }
  }, 420);

  function summary(values) {
    if (!values.length) return null;
    values.sort((a, b) => a - b);
    return { frames: values.length, fps: 1000 * values.length / values.reduce((sum, value) => sum + value, 0),
      p95: values[Math.ceil(values.length * .95) - 1], p99: values[Math.ceil(values.length * .99) - 1],
      over50ms: values.filter(value => value > 50).length };
  }
  window.stressSnapshot = () => {
    const result = { seconds: performance.now() / 1000, ...summary(frames.splice(0)),
      modes: Object.fromEntries(Object.entries(modes).map(([mode, values]) => [mode, summary(values.splice(0))])),
      jobs, longAnimationFrames, longBlockingMs,
      imageRequests: [...images.values()].reduce((sum, entry) => sum + entry.requests, 0),
      imageUrls: images.size, imageTransferBytes: [...images.values()].reduce((sum, entry) => sum + entry.transfers, 0),
      windowImageUrls: recentImages.size, windowImageEncodedBytes: [...recentImages.values()].reduce((sum, bytes) => sum + bytes, 0),
      displayedImageUrls: observed.size, maxLiveDomImageRgbaEstimate: maxLiveBytes,
      replayHttpUrls: [...images.keys()].filter(url => url.includes('?replay=')).length,
      jsHeap: performance.memory?.usedJSHeapSize, activeAnimations: document.getAnimations().filter(a => a.playState === 'running').length,
      overlay: document.querySelector('.perf-overlay')?.textContent };
    recentImages.clear();
    maxLiveBytes = 0;
    longAnimationFrames = longBlockingMs = 0;
    return result;
  };
}

async function main() {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'nnn-stress-'));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browserMode = process.env.NNN_HEADED === '1' ? [] : ['--headless=new'];
  const child = spawn(chrome, [...browserMode, '--no-first-run', '--no-default-browser-check',
    '--remote-debugging-port=' + port, '--user-data-dir=' + profile, '--window-size=1280,800',
    '--autoplay-policy=no-user-gesture-required', 'about:blank'], { stdio: 'ignore', windowsHide: true });
  let socket;
  try {
    let target;
    for (let i = 0; i < 50 && !target; i++) {
      await wait(200);
      try { target = (await (await fetch('http://127.0.0.1:' + port + '/json/list')).json()).find(tab => tab.type === 'page'); }
      catch {}
    }
    if (!target) throw Error('Chrome DevTools indisponível');
    socket = new WebSocket(target.webSocketDebuggerUrl);
    const pending = new Map();
    let id = 0;
    let errors = 0;
    let completeTrace;
    socket.addEventListener('message', event => {
      const message = JSON.parse(event.data);
      if (message.method === 'Runtime.exceptionThrown') { errors++; console.error(message.params.exceptionDetails.text); }
      if (message.method === 'Tracing.tracingComplete') completeTrace?.(message.params.stream);
      if (!pending.has(message.id)) return;
      const { resolve, reject } = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) reject(Error(message.error.message));
      else resolve(message.result);
    });
    await new Promise((resolve, reject) => {
      socket.addEventListener('open', resolve, { once: true });
      socket.addEventListener('error', reject, { once: true });
    });
    const call = (method, params) => new Promise((resolve, reject) => {
      const commandId = ++id;
      const timeout = setTimeout(() => {
        pending.delete(commandId);
        reject(Error('Chrome DevTools sem resposta em ' + method));
      }, 15000);
      pending.set(commandId, {
        resolve: value => { clearTimeout(timeout); resolve(value); },
        reject: error => { clearTimeout(timeout); reject(error); }
      });
      socket.send(JSON.stringify({ id, method, params }));
    });
    const evaluate = async expression => (await call('Runtime.evaluate', { expression, returnByValue: true })).result.value;
    await call('Runtime.enable');
    await call('Performance.enable');
    // Identical random stream for each run. Real elapsed time and production rules still drive deadlines.
    await call('Page.addScriptToEvaluateOnNewDocument', { source:
      'let stressSeed = 911; Math.random = () => ((stressSeed = (Math.imul(stressSeed, 1664525) + 1013904223) >>> 0) / 4294967296);' });
    await call('Page.navigate', { url: 'http://127.0.0.1:' + server.address().port + '/?perf=1&debug=1' });
    for (let i = 0; i < 100; i++) {
      if (await evaluate("document.querySelector('#enter-game')?.disabled === false")) break;
      await wait(100);
    }
    if (!await evaluate("document.querySelector('#enter-game')?.disabled === false")) throw Error('Jogo não inicializou');
    await evaluate('(' + scenario + ')()');
    const until = Date.now() + Number(minutes) * 60000;
    if (process.env.NNN_TRACE && Number(minutes) * 60 >= 28) {
      await wait(16000);
      await call('Tracing.start', {
        categories: 'devtools.timeline,disabled-by-default-devtools.timeline,disabled-by-default-v8.cpu_profiler,blink.user_timing,cc,gpu',
        transferMode: 'ReturnAsStream'
      });
      await wait(12000);
      const streamReady = new Promise(resolve => { completeTrace = resolve; });
      await call('Tracing.end');
      const handle = await Promise.race([streamReady, wait(10000, null, { ref: false })]);
      if (!handle) throw Error('Chrome não entregou o trace');
      const file = fs.openSync(process.env.NNN_TRACE, 'w');
      try {
        let chunk;
        do {
          chunk = await call('IO.read', { handle, size: 64 * 1024 });
          fs.writeSync(file, chunk.base64Encoded ? Buffer.from(chunk.data, 'base64') : chunk.data);
        } while (!chunk.eof);
      } finally {
        fs.closeSync(file);
        await call('IO.close', { handle });
      }
    }
    let data;
    while (Date.now() < until) {
      await wait(Math.max(0, Math.min(30000, until - Date.now())));
      data = await evaluate('window.stressSnapshot()');
      if (!data) throw Error('A página de teste deixou de responder');
      const { metrics } = await call('Performance.getMetrics');
      const browser = Object.fromEntries(metrics.filter(({ name }) =>
        /^(TaskDuration|ScriptDuration|LayoutDuration|RecalcStyleDuration|JSHeapUsedSize|Nodes|JSEventListeners|Documents)$/.test(name))
        .map(({ name, value }) => [name, value]));
      const line = JSON.stringify({ ...data, errors, browser }) + '\n';
      if (process.env.NNN_LOG) fs.appendFileSync(process.env.NNN_LOG, line);
      else if (!process.stdout.write(line)) await once(process.stdout, 'drain');
    }
    if (errors) throw Error(errors + ' exceções JavaScript');
    if (Number(minutes) >= 20) {
      const required = ['start-1', 'start-5', 'start-9', 'start-zero', 'start-max', 'start-mixed',
        'camera', 'gate', 'camera-audio', 'radio', 'closet-enter', 'closet-exit', 'debug-jumpscare', 'retry', 'menu'];
      const missing = required.filter(action => !data?.jobs[action]);
      if (missing.length) throw Error('Ações ausentes: ' + missing.join(', '));
    }
  } finally {
    socket?.close();
    child.kill();
    server.closeAllConnections();
    server.close();
    for (let i = 0; i < 10; i++) {
      try { fs.rmSync(profile, { recursive: true, force: true }); break; }
      catch { await wait(250); }
    }
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
