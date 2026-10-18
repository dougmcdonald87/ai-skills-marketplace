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

function checkTrue(name, actual) {
  check(name, !!actual, true);
}

class El {
  constructor(tag) {
    this.tagName = String(tag).toUpperCase();
    this.children = [];
    this.parent = null;
    this.className = '';
    this.hidden = false;
    this.href = '';
    this.target = '';
    this.rel = '';
    this.value = '';
    this.lang = '';
    this.attributes = {};
    this.listeners = {};
    this._text = '';
    this._innerHTML = '';
  }
  get textContent() {
    if (this.children.length === 0) return this._text;
    return this.children.map(function (c) { return c.textContent; }).join('');
  }
  set textContent(value) {
    this._text = value;
    this.children = [];
  }
  appendChild(child) {
    this.children.push(child);
    child.parent = this;
    return child;
  }
  removeChild(child) {
    this.children = this.children.filter(function (c) { return c !== child; });
    child.parent = null;
    return child;
  }
  get lastChild() {
    return this.children[this.children.length - 1] || null;
  }
  addEventListener(event, handler) {
    this.listeners[event] = handler;
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
  descendants() {
    const out = [];
    const walk = (node) => {
      node.children.forEach(function (child) {
        out.push(child);
        walk(child);
      });
    };
    walk(this);
    return out;
  }
  querySelectorAll(selector) {
    const all = this.descendants();
    if (selector.charAt(0) === '.') {
      const cls = selector.slice(1);
      return all.filter(function (el) {
        return String(el.className).split(/\s+/).indexOf(cls) !== -1;
      });
    }
    return all.filter(function (el) { return el.tagName === selector.toUpperCase(); });
  }
  querySelector(selector) {
    return this.querySelectorAll(selector)[0] || null;
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
  const doc = {
    title: '',
    documentElement: new El('html'),
    getElementById(id) {
      return Object.prototype.hasOwnProperty.call(registry, id) ? registry[id] : null;
    },
    createElement(tag) {
      return new El(tag);
    },
    createElementNS(ns, tag) {
      return new El(tag);
    },
    createTextNode(text) {
      const node = new El('#text');
      node.textContent = text;
      return node;
    },
    querySelectorAll(selector) {
      const all = Object.keys(registry).map(function (k) { return registry[k]; });
      const pool = [];
      all.forEach(function (el) {
        el.descendants().forEach(function (d) { pool.push(d); });
      });
      if (selector.charAt(0) === '.') {
        const cls = selector.slice(1);
        return pool.filter(function (el) {
          return String(el.className).split(/\s+/).indexOf(cls) !== -1;
        });
      }
      return pool.filter(function (el) { return el.tagName === selector.toUpperCase(); });
    },
    _registry: registry,
  };
  doc.documentElement.setAttribute = function () {};
  return doc;
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
    Intl,
    window: { location: { search: search || '', href: '' } },
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

function entriesOf(doc) {
  return doc.getElementById('catalogue').children;
}

function findEntry(doc, id) {
  return entriesOf(doc).filter(function (el) {
    return el.getAttribute('data-skill-id') === id;
  })[0];
}

async function main() {
  const config = skills.marketplace;

  // ---------- static source checks: the UK units must not regress ----------
  const pages = ['index.html', 'skill-page.html', 'submit.html'];
  pages.forEach(function (file) {
    const src = fs.readFileSync(path.join(ROOT, file), 'utf8');
    check('no USD in ' + file, src.indexOf('USD') === -1, true);
    check('no one-time in ' + file, src.indexOf('one-time') === -1, true);
    check('no american spelling color in ' + file, /\bcolor\b/i.test(src), false);
    check('no american spelling customize in ' + file, /\bcustomiz/i.test(src), false);
    check('lang is en-GB in ' + file, src.indexOf('lang="en-GB"') !== -1, true);
  });
  const jsonSrc = fs.readFileSync(path.join(ROOT, 'skills.json'), 'utf8');
  check('no USD in skills.json', jsonSrc.indexOf('USD') === -1, true);
  check('no one-time in skills.json', jsonSrc.indexOf('one-time') === -1, true);
  check('address is DD11 4AX in skills.json', jsonSrc.indexOf('DD11 4AX') !== -1, true);
  check('currency is GBP in skills.json', config.currency, 'GBP');
  check('locale is en-GB in skills.json', config.locale, 'en-GB');

  // ---------- index.html ----------
  const index = await run('index.html');
  check('index renders one entry per skill', entriesOf(index).length, skills.skills.length);
  check('index sets lang to en-GB', index.documentElement.lang, 'en-GB');

  const first = findEntry(index, 'skill-001');
  checkTrue('index entry 001 exists', first);
  check('index entry number', first.children[0].textContent, 'No. 001');
  const firstBody = first.children[1];
  check('index entry name', firstBody.children[0].children[0].textContent, 'Code Review');
  check('index entry link', firstBody.children[0].children[0].href, 'skill-page.html?id=skill-001');
  check('index entry description', firstBody.children[1].textContent, skills.skills[0].desc);
  check('index entry price is GBP', first.children[2].children[0].textContent, '£29');

  const meta = firstBody.children[2];
  const metaText = meta.children.map(function (c) { return c.textContent; }).join(' | ');
  checkTrue('index entry meta has category', metaText.indexOf('Engineering') !== -1);
  checkTrue('index entry meta has verified', metaText.indexOf('Verified') !== -1);
  checkTrue('index entry meta has publisher', metaText.indexOf('The Register') !== -1);

  const firstBtn = first.children[2].children[1];
  check('index paid button is a paypal button', firstBtn.className, 'btn btn-paypal');
  check('index paid button label', firstBtn.textContent, 'Buy via PayPal');
  check('index paid button uses the real handle', firstBtn.href, 'https://paypal.me/dougmcdoald87/29');
  check('index paid button is not aria-disabled', firstBtn.getAttribute('aria-disabled'), null);

  const freeEntry = findEntry(index, 'skill-002');
  check('index free entry price', freeEntry.children[2].children[0].textContent, 'Free');
  check('index free entry action', freeEntry.children[2].children[1].textContent, 'Install from GitHub');
  check('index free entry href', freeEntry.children[2].children[1].href, skills.skills[1].github);

  const filterButtons = index.getElementById('filters').children;
  check('index filter count', filterButtons.length, 3);
  check('index first filter is All', filterButtons[0].textContent, 'All');
  check('index All filter is pressed', filterButtons[0].getAttribute('aria-pressed'), 'true');
  check('index category filter present', filterButtons[1].textContent, 'Engineering');

  check('index colophon place', index.getElementById('colophon-place').textContent, 'Arbroath, Angus DD11 4AX, Scotland');
  checkTrue('index colophon mentions GBP', index.getElementById('colophon-note').textContent.indexOf('GBP') !== -1);
  checkTrue('index colophon says one-off', index.getElementById('colophon-note').textContent.indexOf('one-off') !== -1);
  check('index catalogue count', index.getElementById('catalogue-count').textContent, '4 entries');

  // ---------- search + filter behaviour ----------
  const search = index.getElementById('search');
  search.value = 'prototype';
  search.listeners.input();
  check('search narrows the catalogue', entriesOf(index).length, 1);
  check('search keeps the right entry', findEntry(index, 'skill-004') !== undefined, true);
  check('search updates the count', index.getElementById('catalogue-count').textContent, '1 of 4 entries');

  search.value = 'zzzznothing';
  search.listeners.input();
  check('no match hides entries', entriesOf(index).length, 0);
  check('no match shows empty state', index.getElementById('empty').hidden, false);

  search.value = '';
  search.listeners.input();
  check('clearing search restores entries', entriesOf(index).length, 4);

  const engineeringFilter = index.getElementById('filters').children[1];
  engineeringFilter.listeners.click();
  check('category filter narrows the catalogue', entriesOf(index).length, 2);
  check('category filter updates pressed state', engineeringFilter.getAttribute('aria-pressed'), 'true');

  const allFilter = index.getElementById('filters').children[0];
  allFilter.listeners.click();
  check('All filter restores the catalogue', entriesOf(index).length, 4);

  // ---------- the paypal seam ----------
  // Production data now carries a verified live handle, so the paid button must be live.
  check('paypalBase is the verified live handle', config.paypalBase, 'https://paypal.me/dougmcdoald87');

  // A placeholder base must NOT produce a live payment link.
  const placeholder = JSON.parse(JSON.stringify(skills));
  placeholder.marketplace.paypalBase = 'https://paypal.me/yourname';

  const placeholderIndex = await run('index.html', '', placeholder);
  const placeholderCard = findEntry(placeholderIndex, 'skill-001');
  check('placeholder paypal base disables the button', placeholderCard.children[2].children[1].className, 'btn');
  check('placeholder paypal base shows opening soon', placeholderCard.children[2].children[1].textContent, 'Payments opening soon');
  check('placeholder paypal base is aria-disabled', placeholderCard.children[2].children[1].getAttribute('aria-disabled'), 'true');
  check('placeholder paypal base has no paypal href', placeholderCard.children[2].children[1].href, '#');

  // A different real base must be used in full, proving the base is the only source.
  const live = JSON.parse(JSON.stringify(skills));
  live.marketplace.paypalBase = 'https://paypal.me/someoneelse';

  const liveIndex = await run('index.html', '', live);
  const liveCard = findEntry(liveIndex, 'skill-001');
  check('live paypal base enables paypal button', liveCard.children[2].children[1].className, 'btn btn-paypal');
  check('live paypal url uses base and amount', liveCard.children[2].children[1].href, 'https://paypal.me/someoneelse/29');
  check('live paypal button label', liveCard.children[2].children[1].textContent, 'Buy via PayPal');

  const liveDetail = await run('skill-page.html', '?id=skill-001', live);
  check('live detail paypal class', liveDetail.getElementById('skill-action').className, 'btn btn-paypal');
  check('live detail paypal href', liveDetail.getElementById('skill-action').href, 'https://paypal.me/someoneelse/29');

  const liveFree = await run('skill-page.html', '?id=skill-002', live);
  check('live free entry stays on github', liveFree.getElementById('skill-action').href, skills.skills[1].github);

  // ---------- skill-page.html ----------
  const page = await run('skill-page.html', '?id=skill-001');
  check('detail entry number', page.getElementById('skill-no').textContent, 'No. 001');
  check('detail name', page.getElementById('skill-name').textContent, 'Code Review');
  check('detail desc', page.getElementById('skill-desc').textContent, skills.skills[0].desc);
  check('detail price is GBP', page.getElementById('skill-price').textContent, '£29');
  check('detail card visible', page.getElementById('entry-detail').hidden, false);
  check('detail paid button is live', page.getElementById('skill-action').className, 'btn btn-paypal');
  check('detail paid button href', page.getElementById('skill-action').href, 'https://paypal.me/dougmcdoald87/29');
  check('detail paid button label', page.getElementById('skill-action').textContent, 'Buy via PayPal');
  check('detail document title', page.title, 'Code Review — The Agent Register');
  check('detail colophon place', page.getElementById('colophon-place').textContent, 'Arbroath, Angus DD11 4AX, Scotland');

  const detailMeta = page.getElementById('skill-meta');
  const detailMetaText = detailMeta.children.map(function (c) { return c.textContent; }).join(' | ');
  checkTrue('detail meta has category', detailMetaText.indexOf('Engineering') !== -1);
  checkTrue('detail meta has verified', detailMetaText.indexOf('Verified') !== -1);

  check('detail spec is shown', page.getElementById('skill-spec').hidden, false);
  check('detail install section is shown', page.getElementById('skill-install').hidden, false);
  const specRows = page.getElementById('spec-rows').children;
  check('detail spec row count', specRows.length, 8);
  const specText = specRows.map(function (r) {
    return r.children[0].textContent + ': ' + r.children[1].textContent;
  }).join(' | ');
  checkTrue('spec has entry number', specText.indexOf('No. 001') !== -1);
  checkTrue('spec has format', specText.indexOf('Markdown skill (SKILL.md)') !== -1);
  checkTrue('spec has publisher', specText.indexOf('The Register') !== -1);
  checkTrue('spec has GBP price', specText.indexOf('£29, one-off') !== -1);
  checkTrue('spec has payment method', specText.indexOf('PayPal') !== -1);
  checkTrue('spec states verified', specText.indexOf('Yes — tested by the Register') !== -1);
  check('spec has no USD', specText.indexOf('USD') === -1, true);

  const freeSpec = await run('skill-page.html', '?id=skill-002');
  const freeSpecText = freeSpec.getElementById('spec-rows').children.map(function (r) {
    return r.children[0].textContent + ': ' + r.children[1].textContent;
  }).join(' | ');
  checkTrue('free spec states no payment', freeSpecText.indexOf('Payment: None') !== -1);
  checkTrue('free spec price is Free', freeSpecText.indexOf('Price: Free') !== -1);

  const free = await run('skill-page.html', '?id=skill-002');
  check('detail free price', free.getElementById('skill-price').textContent, 'Free');
  check('detail free action', free.getElementById('skill-action').textContent, 'Install from GitHub');
  check('detail free href', free.getElementById('skill-action').href, skills.skills[1].github);

  const missing = await run('skill-page.html', '?id=nope');
  check('unknown id shows missing', missing.getElementById('missing').hidden, false);
  check('unknown id hides the entry', missing.getElementById('entry-detail').hidden, true);

  const noId = await run('skill-page.html', '');
  check('no id shows missing', noId.getElementById('missing').hidden, false);

  // ---------- submit.html ----------
  const submitHtml = fs.readFileSync(path.join(ROOT, 'submit.html'), 'utf8');
  const submitDoc = buildDocument(submitHtml);
  const submitWindow = { location: { search: '', href: '' } };
  const submitSandbox = {
    document: submitDoc,
    console,
    URLSearchParams,
    Intl,
    window: submitWindow,
    fetch(url) {
      if (String(url).indexOf('skills.json') === -1) {
        return Promise.reject(new Error('unexpected fetch: ' + url));
      }
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(skills) });
    },
  };
  submitSandbox.globalThis = submitSandbox;
  vm.createContext(submitSandbox);
  vm.runInContext(extractScript(submitHtml), submitSandbox);
  await new Promise((resolve) => setTimeout(resolve, 0));

  const formEl = submitDoc.getElementById('skill-form');
  check('submit form exists', formEl !== null, true);
  const capturedHandler = formEl ? formEl.listeners.submit : null;
  check('submit handler attached', typeof capturedHandler === 'function', true);
  check('submit page sets lang to en-GB', submitDoc.documentElement.lang, 'en-GB');
  check('submit place', submitDoc.getElementById('fact-place').textContent, 'Arbroath, Angus DD11 4AX, Scotland');

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
    check('rejects bad paypal url', submitDoc.getElementById('form-status').className, 'form-status error');
    checkTrue('rejects bad paypal url message', /PayPal\.me link/.test(submitDoc.getElementById('form-status').textContent));

    setField('f-paypal', '');
    setField('f-github', '');
    fire();
    check('requires paypal or github', submitDoc.getElementById('form-status').className, 'form-status error');

    setField('f-github', 'https://github.com/someone/skill');
    fire();
    check('accepts free entry with github only', submitDoc.getElementById('form-status').className, 'form-status ok');
    check('mailto targets review address', submitWindow.location.href.indexOf('mailto:dougmoug@gmail.com') === 0, true);
    const decoded = decodeURIComponent(submitWindow.location.href);
    checkTrue('mailto body carries skill name', decoded.indexOf('My Skill') !== -1);
    checkTrue('mailto body carries GBP price label', decoded.indexOf('Price (GBP): 19') !== -1);
    checkTrue('mailto body has no USD label', decoded.indexOf('USD') === -1);
    checkTrue('mailto body carries github', decoded.indexOf('https://github.com/someone/skill') !== -1);
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
