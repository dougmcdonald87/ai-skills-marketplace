const http = require('http');
const fs = require('fs');
const { spawn } = require('child_process');

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = 9200 + Math.floor(Math.random() * 500);
const PROFILE = require('path').join(require('os').tmpdir(), 'opencode', 'cdp-profile-' + PORT);

function getJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch (e) { reject(e); } });
    }).on('error', reject);
  });
}

function waitFor(fn, timeout) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tick = async () => {
      try {
        const v = await fn();
        if (v) return resolve(v);
      } catch (e) { /* keep polling */ }
      if (Date.now() - start > timeout) return reject(new Error('timeout waiting for ' + fn));
      setTimeout(tick, 250);
    };
    tick();
  });
}

class CDP {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    this.events = [];
    ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && this.pending.has(msg.id)) {
        const entry = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) entry.reject(new Error(msg.method + ': ' + JSON.stringify(msg.error)));
        else entry.resolve(msg.result);
      } else {
        this.events.push(msg);
      }
    });
  }
  send(method, params, sessionId) {
    const id = ++this.id;
    const msg = { id, method, params: params || {} };
    if (sessionId) msg.sessionId = sessionId;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject, method });
      this.ws.send(JSON.stringify(msg));
    });
  }
}

async function main() {
  const url = process.argv[2];
  const out = process.argv[3];
  const width = parseInt(process.argv[4] || '390', 10);
  const height = parseInt(process.argv[5] || '1400', 10);
  const measure = process.argv[6] === 'measure';

  fs.mkdirSync(PROFILE, { recursive: true });
  const edge = spawn(EDGE, [
    '--headless=new', '--disable-gpu', '--no-sandbox', '--disable-dev-shm-usage',
    '--user-data-dir=' + PROFILE, '--remote-debugging-port=' + PORT, 'about:blank'
  ], { stdio: 'ignore', detached: false });

  let version;
  try {
    version = await waitFor(() => getJson('http://127.0.0.1:' + PORT + '/json/version'), 30000);
  } catch (e) {
    edge.kill();
    throw e;
  }

  const ws = new WebSocket(version.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true });
    ws.addEventListener('error', reject, { once: true });
  });
  const cdp = new CDP(ws);

  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });

  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width, height, deviceScaleFactor: 1, mobile: width < 820
  }, sessionId);
  await cdp.send('Page.enable', {}, sessionId);
  await cdp.send('Runtime.enable', {}, sessionId);
  await cdp.send('Page.navigate', { url }, sessionId);

  await waitFor(() => cdp.events.some((e) => e.method === 'Page.loadEventFired'), 45000);
  await cdp.send('Runtime.evaluate', {
    expression: 'document.fonts ? document.fonts.ready : Promise.resolve()',
    awaitPromise: true
  }, sessionId);
  await new Promise((r) => setTimeout(r, 1200));

  if (measure) {
    const expression = `(function () {
      var vw = document.documentElement.clientWidth;
      var offenders = [];
      document.querySelectorAll('*').forEach(function (el) {
        var r = el.getBoundingClientRect();
        if (r.width > vw + 1 || r.right > vw + 1) {
          offenders.push({
            tag: el.tagName.toLowerCase(),
            cls: (el.className && el.className.baseVal !== undefined ? el.className.baseVal : el.className) || '',
            id: el.id || '',
            w: Math.round(r.width),
            right: Math.round(r.right)
          });
        }
      });
      return JSON.stringify({
        viewport: vw,
        scrollWidth: document.documentElement.scrollWidth,
        bodyScrollWidth: document.body.scrollWidth,
        paypalLinks: Array.prototype.map.call(
          document.querySelectorAll('a.btn-paypal'),
          function (a) { return a.href; }
        ),
        text: (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 1500),
        offenders: offenders.slice(0, 25)
      }, null, 1);
    })()`;
    const res = await cdp.send('Runtime.evaluate', { expression, returnByValue: true }, sessionId);
    console.log(res.result.value);
  }

  const shot = await cdp.send('Page.captureScreenshot', {
    format: 'png', captureBeyondViewport: true
  }, sessionId);
  fs.writeFileSync(out, Buffer.from(shot.data, 'base64'));
  console.log('SHOT ' + out);

  ws.close();
  edge.kill();
  process.exit(0);
}

main().catch((err) => {
  console.error('FAILED: ' + err.message);
  process.exit(1);
});
