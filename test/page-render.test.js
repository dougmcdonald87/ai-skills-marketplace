const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const skills = JSON.parse(fs.readFileSync(path.join(ROOT, 'skills.json'), 'utf8'));

let failures = 0;
let checks = 0;

function check(name, actual, expected) {
  checks++;
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) {
    failures++;
    console.log('FAIL ' + name);
    console.log('  expected: ' + JSON.stringify(expected));
    console.log('  actual:   ' + JSON.stringify(actual));
  } else {
    console.log('ok   ' + name);
  }
}

class El {
  constructor(tag) {
    this.tagName = String(tag).toUpperCase();
    this.children = [];
    this.textContent = '';
    this.className = '';
    this.hidden = false;
    this.href = '';
    this.target = '';
    this.rel = '';
    this.attributes = {};
    this.value = '';
    this.listeners = {};
    this._innerHTML = '';
  }
  addEventListener(event, handler) {
    this.listeners[event] = handler;
  }
  appendChild(child) {
    this.children.push(child);
    return child;
  }
  setAttribute(name, value) {
    this.attributes[name] = value;
  }
  getAttribute(name) {
    return Object.prototype.hasOwnProperty.call(this.attributes, name) ? this.attributes[name] : null;
  }
  set innerHTML(value) {
    this._innerHTML = value;
    this.children = [];
  }
  get innerHTML() {
    return this._innerHTML;
  }
}

function buildDocument(html) {
  const registry = {};
  const tagPattern = /<([a-zA-Z][a-zA-Z0-9]*)([^>]*)>/g;
  let match;
  while ((match = tagPattern.exec(html)) !== null) {
    const attrs = match[2];
    const idMatch = /id="([^"]+)"/.exec(attrs);
    if (!idMatch) continue;
    const el = new El(match[1]);
    if (/(^|\s)hidden(\s|=|>|$)/.test(attrs)) el.hidden = true;
    registry[idMatch[1]] = el;
  }
  return {
    title: '',
    getElementById(id) {
      return Object.prototype.hasOwnProperty.call(registry, id) ? registry[id] : null;
    },
    createElement(tag) {
      return new El(tag);
    },
    _registry: registry,
  };
}

function extractScript(html) {
  const matches = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
  if (matches.length === 0) throw new Error('no inline script found');
  return matches[matches.length - 1][1];
}

function run(file, search, dataOverride) {
  const html = fs.readFileSync(path.join(ROOT, file), 'utf8');
  const script = extractScript(html);
  const document = buildDocument(html);
  const payload = dataOverride || skills;
  const sandbox = {
    document,
    console,
    URLSearchParams,
    window: { location: { search: search || '' } },
    fetch(url) {
      if (String(url).indexOf('skills.json') === -1) {
        return Promise.reject(new Error('unexpected fetch: ' + url));
      }
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(payload) });
    },
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(script, sandbox);
  return new Promise((resolve) => setTimeout(resolve, 0)).then(() => document);
}

async function main() {
  // --- index.html ---
  const index = await run('index.html');
  const grid = index.getElementById('skills-grid');
  check('index renders one card per skill', grid.children.length, skills.skills.length);

  const first = grid.children[0];
  const firstName = first.children[0].children[0];
  check('index card 1 name', firstName.textContent, skills.skills[0].name);
  check('index card 1 links to detail page', firstName.href, 'skill-page.html?id=' + skills.skills[0].id);
  check('index card 1 price', first.children[3].textContent, '$29 one-time');
  check('index card 1 paid button disabled until paypal base is real', first.children[4].className, 'free-btn');
  check('index card 1 paid button label', first.children[4].textContent, 'Payments opening soon');
  check('index card 1 paid button has no paypal href', first.children[4].getAttribute('aria-disabled'), 'true');

  const freeCard = grid.children[1];
  check('index free card price', freeCard.children[3].textContent, 'Free');
  check('index free card action class', freeCard.children[4].className, 'free-btn');
  check('index free card action href', freeCard.children[4].href, skills.skills[1].github);

  const verified = grid.children[0].children[2].children[2];
  check('index shows verified badge', verified.textContent, 'Verified');

  // --- skill-page.html ---
  const page = await run('skill-page.html', '?id=skill-001');
  check('detail name', page.getElementById('skill-name').textContent, 'Code Review');
  check('detail desc', page.getElementById('skill-desc').textContent, skills.skills[0].desc);
  check('detail category', page.getElementById('skill-category').textContent, 'Engineering');
  check('detail platform', page.getElementById('skill-platform').textContent, 'Universal platform');
  check('detail price', page.getElementById('skill-price').textContent, '$29 one-time');
  check('detail paid button disabled until paypal base is real', page.getElementById('skill-action').className, 'free-btn');
  check('detail paid button label', page.getElementById('skill-action').textContent, 'Payments opening soon');
  check('detail card visible', page.getElementById('skill-card').hidden, false);
  check('detail verified badge visible', page.getElementById('skill-verified').hidden, false);
  check('detail document title', page.title, 'Code Review — AI Agent Skills Marketplace');

  const free = await run('skill-page.html', '?id=skill-002');
  check('detail free price', free.getElementById('skill-price').textContent, 'Free');
  check('detail free action class', free.getElementById('skill-action').className, 'free-btn');
  check('detail free action href', free.getElementById('skill-action').href, skills.skills[1].github);

  // --- real paypal base: the paypal button must go live and carry the amount ---
  const live = JSON.parse(JSON.stringify(skills));
  live.paypalBase = 'https://paypal.me/dougmcdonald87';

  const liveIndex = await run('index.html', '', live);
  const liveCard = liveIndex.getElementById('skills-grid').children[0];
  check('live paypal base enables paypal button', liveCard.children[4].className, 'paypal-btn');
  check('live paypal url uses base and amount', liveCard.children[4].href, 'https://paypal.me/dougmcdonald87/29');
  check('live paypal button label', liveCard.children[4].textContent, 'Buy via PayPal');

  const liveDetail = await run('skill-page.html', '?id=skill-001', live);
  check('live detail paypal class', liveDetail.getElementById('skill-action').className, 'paypal-btn');
  check('live detail paypal href', liveDetail.getElementById('skill-action').href, 'https://paypal.me/dougmcdonald87/29');

  const liveFree = await run('skill-page.html', '?id=skill-002', live);
  check('live free skill stays on github', liveFree.getElementById('skill-action').href, skills.skills[1].github);

  const missing = await run('skill-page.html', '?id=nope');
  check('unknown id shows missing', missing.getElementById('skill-missing').hidden, false);
  check('unknown id hides card', missing.getElementById('skill-card').hidden, true);

  const noId = await run('skill-page.html', '');
  check('no id shows missing', noId.getElementById('skill-missing').hidden, false);

  // --- submit.html ---
  const submitHtml = fs.readFileSync(path.join(ROOT, 'submit.html'), 'utf8');
  const submitDoc = buildDocument(submitHtml);
  const submitWindow = { location: { search: '', href: '' } };
  const submitSandbox = {
    document: submitDoc,
    console,
    URLSearchParams,
    window: submitWindow,
    fetch() {
      return Promise.reject(new Error('submit page must not fetch'));
    },
  };
  submitSandbox.globalThis = submitSandbox;
  vm.createContext(submitSandbox);
  vm.runInContext(extractScript(submitHtml), submitSandbox);

  const formEl = submitDoc.getElementById('skill-form');
  check('submit form exists', formEl !== null, true);
  const capturedHandler = formEl ? formEl.listeners.submit : null;
  check('submit handler attached', typeof capturedHandler === 'function', true);

  if (capturedHandler) {
    const setField = (id, value) => {
      submitDoc.getElementById(id).value = value;
    };
    const fire = () => {
      let prevented = false;
      capturedHandler({ preventDefault: () => { prevented = true; } });
      return prevented;
    };

    setField('f-name', 'My Skill');
    setField('f-desc', 'Does a thing');
    setField('f-price', '19');
    setField('f-paypal', 'not-a-url');
    setField('f-github', '');
    fire();
    check('rejects bad paypal url', submitDoc.getElementById('form-status').className, 'error');
    check('rejects bad paypal url message', /PayPal\.me link/.test(submitDoc.getElementById('form-status').textContent), true);

    setField('f-paypal', '');
    setField('f-github', '');
    fire();
    check('requires paypal or github', submitDoc.getElementById('form-status').className, 'error');

    setField('f-github', 'https://github.com/someone/skill');
    fire();
    check('accepts free skill with github only', submitDoc.getElementById('form-status').className, 'ok');
    check('mailto targets review address', submitWindow.location.href.indexOf('mailto:dougmoug@gmail.com') === 0, true);
    check('mailto body carries skill name', decodeURIComponent(submitWindow.location.href).indexOf('My Skill') !== -1, true);
    check('mailto body carries price', decodeURIComponent(submitWindow.location.href).indexOf('Price (USD): 19') !== -1, true);
    check('mailto body carries github', decodeURIComponent(submitWindow.location.href).indexOf('https://github.com/someone/skill') !== -1, true);
  }

  console.log('\n' + (checks - failures) + '/' + checks + ' checks passed');
  if (failures > 0) {
    console.log('FAILED');
    process.exit(1);
  }
  console.log('PASSED');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
