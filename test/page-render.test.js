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
    this.checked = false;
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
    if (this._scope && this._scope.indexOf(child) === -1) this._scope.push(child);
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
    const scope = this._scope || this.descendants();
    return scope.filter(function (el) { return matches(el, selector); });
  }
  querySelector(selector) {
    return this.querySelectorAll(selector)[0] || null;
  }
}

function matches(el, selector) {
  selector = String(selector).trim();

  // tag[attr="value"]:checked
  let checkedOnly = false;
  if (/:checked$/.test(selector)) {
    checkedOnly = true;
    selector = selector.replace(/:checked$/, '');
  }

  const attrMatch = /\[([a-zA-Z-]+)(?:=["']?([^"'\]]*)["']?)?\]/.exec(selector);
  let attrName = null;
  let attrValue = null;
  if (attrMatch) {
    attrName = attrMatch[1];
    attrValue = attrMatch[2];
    selector = selector.replace(attrMatch[0], '');
  }

  const tag = selector.trim();
  if (tag && tag.charAt(0) !== '.') {
    if (el.tagName !== tag.toUpperCase()) return false;
  } else if (tag.charAt(0) === '.') {
    const cls = tag.slice(1);
    if (String(el.className).split(/\s+/).indexOf(cls) === -1) return false;
  }

  if (attrName) {
    const actual = el.getAttribute(attrName);
    if (actual === null) return false;
    if (attrValue !== undefined && attrValue !== '' && String(actual) !== attrValue) return false;
  }

  if (checkedOnly) {
    if (el.checked !== true) return false;
  }

  return true;
}

function buildDocument(html) {
  const registry = {};
  const all = [];
  const tagPattern = /<([a-zA-Z][a-zA-Z0-9]*)((?:\s+[a-zA-Z-]+(?:="[^"]*")?)*)\s*\/?>/g;
  let match;
  while ((match = tagPattern.exec(html)) !== null) {
    const tag = match[1];
    const attrs = match[2] || '';
    const el = new El(tag);
    if (/(^|\s)hidden(\s|=|>|$)/.test(attrs)) el.hidden = true;
    if (/(^|\s)checked(\s|=|>|$)/.test(attrs)) el.checked = true;
    const attrPattern = /([a-zA-Z-]+)(?:="([^"]*)")?/g;
    let a;
    while ((a = attrPattern.exec(attrs)) !== null) {
      el.setAttribute(a[1], a[2] === undefined ? '' : a[2]);
      if (a[1] === 'value') el.value = a[2] === undefined ? '' : a[2];
    }
    all.push(el);
    const idMatch = /id="([^"]+)"/.exec(attrs);
    if (idMatch) registry[idMatch[1]] = el;
  }
  all.forEach(function (el) { el._scope = all; });
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
      return all.filter(function (el) { return matches(el, selector); });
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
  // Strip CSS before the spelling sweep, so "color:" as a CSS property is not
  // mistaken for American prose. Only visible copy is checked.
  // Strip everything that is not visible prose. <script> was missing, so a technical
  // token in inline JS (prefers-color-scheme, currentColor) read as an American
  // spelling in the copy. The check is about what a visitor READS, so scripts and
  // style blocks are not prose.
  const proseOnly = (src) => src
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/style="[^"]*"/gi, ' ')
    .replace(/<[^>]+>/g, ' ');

  const pages = ['index.html', 'skill-page.html', 'submit.html', 'about.html'];
  pages.forEach(function (file) {
    const src = fs.readFileSync(path.join(ROOT, file), 'utf8');
    const prose = proseOnly(src);
    check('no USD in ' + file, src.indexOf('USD') === -1, true);
    check('no one-time in ' + file, src.indexOf('one-time') === -1, true);
    check('no american spelling color in ' + file, /\bcolor\b/i.test(prose), false);
    check('no american spelling customize in ' + file, /\bcustomiz/i.test(prose), false);
    check('no american spelling behavior in ' + file, /\bbehavior/i.test(prose), false);
    check('no american spelling organization in ' + file, /\borganization/i.test(prose), false);
    check('no american spelling catalog in ' + file, /\bcatalog\b/i.test(prose), false);
    check('lang is en-GB in ' + file, src.indexOf('lang="en-GB"') !== -1, true);
  });
  const jsonSrc = fs.readFileSync(path.join(ROOT, 'skills.json'), 'utf8');
  const cssSrc = fs.readFileSync(path.join(ROOT, 'styles.css'), 'utf8');
  check('no USD in skills.json', jsonSrc.indexOf('USD') === -1, true);
  check('no one-time in skills.json', jsonSrc.indexOf('one-time') === -1, true);
  check('address is DD11 4AX in skills.json', jsonSrc.indexOf('DD11 4AX') !== -1, true);
  check('currency is GBP in skills.json', config.currency, 'GBP');
  check('locale is en-GB in skills.json', config.locale, 'en-GB');

  // ---------- about.html ----------
  const about = await run('about.html');
  check('about sets lang to en-GB', about.documentElement.lang, 'en-GB');
  check('about place', about.getElementById('hero-place').textContent, 'Arbroath, Angus DD11 4AX, Scotland');
  check('about colophon place', about.getElementById('colophon-place').textContent, 'Arbroath, Angus DD11 4AX, Scotland');
  check('about entry count', about.getElementById('fact-count').textContent, '4 entries, numbered in the order they were accepted.');
  checkTrue('about colophon mentions GBP', about.getElementById('colophon-note').textContent.indexOf('GBP') !== -1);

  // The contact address must render as typed, not shouted by text-transform.
  // The address is read from skills.json, never hardcoded here. It used to be
  // written out literally in these three checks, which meant changing the
  // register's contact address broke the suite and the only fix was to paste
  // the new address into the test. skills.json is the single source of truth;
  // a test that duplicates a value will drift from it.
  const aboutSrc = fs.readFileSync(path.join(ROOT, 'about.html'), 'utf8');
  const reviewEmail = config.reviewEmail;
  checkTrue('reviewEmail is set in skills.json', typeof reviewEmail === 'string' && reviewEmail.indexOf('@') !== -1);
  check('about email is lowercase in the markup', aboutSrc.indexOf('>' + reviewEmail + '<') !== -1, true);
  check('about email button opts out of uppercase', aboutSrc.indexOf('btn btn-plain') !== -1, true);
  check('about email href is a mailto', aboutSrc.indexOf('href="mailto:' + reviewEmail + '"') !== -1, true);
  check('about email matches the register address', aboutSrc.indexOf(reviewEmail) !== -1, true);

  // The free/paid radio labels must not inherit the uppercase form-label style.
  // ".form label" outranks ".choice-opt", so the specific selector is required.
  check('choice options opt out of uppercase', cssSrc.indexOf('.form .choice-opt') !== -1, true);
  check('choice options set text-transform none', /\.form \.choice-opt \{[\s\S]*?text-transform: none;/.test(cssSrc), true);

  // ---- Premium and proved -------------------------------------------------
  // "Worth the money" is enforced, not asserted. Every paid entry must ship at
  // least one thing that is not prose and must carry a recorded run. Free entries
  // are exempt; claiming premium on a free entry would be a lie in the other
  // direction, so that is refused too.
  const paid = skills.skills.filter(function (s) { return !s.free && Number(s.price) > 0; });
  checkTrue('there are paid entries to check', paid.length > 0);

  paid.forEach(function (s) {
    const tag = s.name;
    checkTrue(tag + ' claims premium', s.premium === true);
    checkTrue(tag + ' ships a list', Array.isArray(s.ships) && s.ships.length > 0);
    checkTrue(
      tag + ' ships something that is not prose',
      (s.ships || []).some(function (item) {
        return !/\.(md|txt)$/i.test(String(item).trim());
      })
    );
    checkTrue(tag + ' carries proof', !!s.proof && typeof s.proof === 'object');
    ['testedOn', 'command', 'result', 'reproduce', 'verifiedAt', 'verifiedBy'].forEach(function (key) {
      checkTrue(tag + ' proof.' + key + ' is filled in', !!(s.proof && String(s.proof[key] || '').trim()));
    });
    checkTrue(
      tag + ' proof date is a real date',
      /^\d{4}-\d{2}-\d{2}$/.test(String((s.proof || {}).verifiedAt || ''))
    );
  });

  // The proof text must name something that was actually run, not just assert it works.
  paid.forEach(function (s) {
    checkTrue(
      s.name + ' proof names a command',
      /\S/.test(String((s.proof || {}).command || '')) &&
        String(s.proof.command).indexOf(' ') !== -1
    );
    checkTrue(
      s.name + ' proof says how to reproduce it',
      String((s.proof || {}).reproduce || '').length > 20
    );
  });

  skills.skills.filter(function (s) { return s.free; }).forEach(function (s) {
    checkTrue(s.name + ' (free) does not claim premium', !s.premium);
    checkTrue(s.name + ' (free) does not carry proof', !s.proof);
  });

  // Every page must link to the other three, or a visitor can get stranded.
  pages.forEach(function (file) {
    const src = fs.readFileSync(path.join(ROOT, file), 'utf8');
    ['index.html', 'about.html', 'submit.html'].forEach(function (target) {
      check(file + ' links to ' + target, src.indexOf('href="' + target + '"') !== -1, true);
    });
  });

  // ---------- index.html ----------
  const index = await run('index.html');
  check('index renders one entry per skill', entriesOf(index).length, skills.skills.length);
  check('index sets lang to en-GB', index.documentElement.lang, 'en-GB');

  const first = findEntry(index, 'skill-001');
  checkTrue('index entry 001 exists', first);

  // Located by class, not by child index. Index-based structural assertions break
  // every time the layout changes for a good reason, and then get "fixed" by
  // editing the number rather than by fixing the code. Two brittle assertions
  // (a hardcoded email and a hardcoded spec-row count) already bit this suite.
  const pick = function (el, cls) {
    return el.children.filter(function (c) {
      return String(c.className).indexOf(cls) !== -1;
    })[0];
  };
  const pickAll = function (el, cls) {
    return el.children.filter(function (c) {
      return String(c.className).indexOf(cls) !== -1;
    });
  };

  const plate = pick(first, 'plate');
  checkTrue('index entry has a monogram plate', !!plate);
  check('index entry number is inside the plate', pick(plate, 'entry-no').textContent, 'No. 001');
  check('index monogram is two letters', plate.children[0].textContent, 'CR');

  const firstBody = pick(first, 'entry-body');
  checkTrue('index entry has a body', !!firstBody);
  check('index entry name', pick(firstBody, 'entry-name').children[0].textContent, 'Code Review');
  check('index entry link', pick(firstBody, 'entry-name').children[0].href, 'skill-page.html?id=skill-001');
  check('index entry description', pick(firstBody, 'entry-desc').textContent, skills.skills[0].desc);

  const buy = pick(first, 'entry-buy');
  checkTrue('index entry has a price column', !!buy);
  check('index entry price is GBP', pick(buy, 'price').textContent, '£29');

  // The proof strip is the design's anchor. It must appear in the catalogue,
  // carrying the command that was actually run.
  const strip = pick(firstBody, 'proof-strip');
  checkTrue('index paid entry shows a proof strip', !!strip);
  checkTrue(
    'proof strip carries the command',
    !!pick(strip, 'proof-cmd') && pick(strip, 'proof-cmd').textContent === skills.skills[0].proof.command
  );
  checkTrue(
    'proof strip carries the result',
    !!pick(strip, 'proof-out') && pick(strip, 'proof-out').textContent === skills.skills[0].proof.result
  );
  checkTrue('proof strip names the date', strip.textContent.indexOf(skills.skills[0].proof.verifiedAt) !== -1);

  // A free entry must not borrow the paid entries' proof strip.
  const freeEntry = findEntry(index, 'skill-002');
  const freeBody = pick(freeEntry, 'entry-body');
  check('index free entry has no proof strip', pick(freeBody, 'proof-strip'), undefined);

  const meta = pick(firstBody, 'entry-meta');
  checkTrue('index entry has a meta row', !!meta);
  const metaText = meta.children.map(function (c) { return c.textContent; }).join(' | ');
  checkTrue('index entry meta has category', metaText.indexOf('Engineering') !== -1);
  checkTrue('index entry meta has verified', metaText.indexOf('Verified') !== -1);
  checkTrue('index entry meta has publisher', metaText.indexOf('The Register') !== -1);

  const includesText = pick(firstBody, 'entry-includes');
  checkTrue('index paid entry states what you get', !!includesText);
  checkTrue('index includes mentions the bundle', includesText.textContent.indexOf('separate runnable skills') !== -1);

  const firstBtn = pick(buy, 'btn-paypal');
  check('index paid button is a paypal button', firstBtn.className, 'btn btn-paypal');
  check('index paid button label', firstBtn.textContent, 'Buy via PayPal');
  check('index paid button uses the real handle', firstBtn.href, 'https://paypal.me/dougmcdoald87/29');
  check('index paid button is not aria-disabled', firstBtn.getAttribute('aria-disabled'), null);

  const freeBuy = pick(freeEntry, 'entry-buy');
  check('index free entry price', pick(freeBuy, 'price').textContent, 'Free');
  check('index free entry action', pick(freeBuy, 'btn').textContent, 'Install from GitHub');
  check('index free entry href', pick(freeBuy, 'btn').href, skills.skills[1].github);

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
  // Not a hardcoded row count. Rows are conditional on what the entry actually
  // carries (includes, attribution, premium, proof), so a magic number here just
  // breaks every time an entry gains a field. Assert the rows that matter exist.
  checkTrue('detail spec has rows', specRows.length >= 9);
  const specText = specRows.map(function (r) {
    return r.children[0].textContent + ': ' + r.children[1].textContent;
  }).join(' | ');
  // A paid entry must say, in its own spec sheet, that it is premium and proved.
  checkTrue('detail spec says Premium', specText.indexOf('Premium:') !== -1);
  checkTrue('detail spec says Proved', specText.indexOf('Proved:') !== -1);
  checkTrue('detail spec says What you get', specText.indexOf('What you get:') !== -1);

  // The proof panel itself, not just the word in the spec sheet. Read the child
  // elements directly: this harness's DOM shim does not aggregate descendant
  // textContent, so proofPanel.textContent is always empty.
  const proofPanel = page.getElementById('skill-proof');
  check('detail proof panel is shown on a paid entry', proofPanel.hidden, false);
  const paidSkill = skills.skills[0];
  check('proof claim carries the result', page.getElementById('proof-claim').textContent, paidSkill.proof.result);
  check('proof step carries the command', page.getElementById('proof-cmd').textContent, paidSkill.proof.command);
  check('proof step carries how to reproduce', page.getElementById('proof-repro-text').textContent, paidSkill.proof.reproduce);
  const foot = page.getElementById('proof-foot').textContent;
  checkTrue('proof foot names the date', foot.indexOf(paidSkill.proof.verifiedAt) !== -1);
  checkTrue('proof foot names the verifier', foot.indexOf(paidSkill.proof.verifiedBy) !== -1);
  checkTrue('proof foot names what was tested on', foot.indexOf(paidSkill.proof.testedOn) !== -1);
  const proofRows = page.getElementById('proof-rows').children.map(function (r) {
    return r.children[0].textContent + ': ' + r.children[1].textContent;
  }).join(' | ');
  checkTrue('proof rows include the result', proofRows.indexOf(paidSkill.proof.result) !== -1);
  checkTrue('proof rows include the environment', proofRows.indexOf(paidSkill.proof.verifiedOn) !== -1);
  checkTrue('spec has entry number', specText.indexOf('No. 001') !== -1);
  checkTrue('spec has format', specText.indexOf('Markdown skill (SKILL.md)') !== -1);
  checkTrue('spec has publisher', specText.indexOf('The Register') !== -1);
  checkTrue('spec has GBP price', specText.indexOf('£29, one-off') !== -1);
  checkTrue('spec has payment method', specText.indexOf('PayPal') !== -1);
  checkTrue('spec states verified', specText.indexOf('Yes — tested by the Register') !== -1);
  checkTrue('spec has licence', specText.indexOf('Licence: MIT') !== -1);
  checkTrue('spec says what the buyer gets', specText.indexOf('What you get:') !== -1);
  checkTrue('spec has attribution', specText.indexOf('Built on:') !== -1);
  checkTrue('spec attributes Matt Pocock', specText.indexOf('Matt Pocock') !== -1);
  check('spec has no USD', specText.indexOf('USD') === -1, true);

  const freeSpec = await run('skill-page.html', '?id=skill-002');
  const freeSpecText = freeSpec.getElementById('spec-rows').children.map(function (r) {
    return r.children[0].textContent + ': ' + r.children[1].textContent;
  }).join(' | ');
  checkTrue('free spec states no payment', freeSpecText.indexOf('Payment: None') !== -1);
  checkTrue('free spec price is Free', freeSpecText.indexOf('Price: Free') !== -1);
  // A free entry has nothing to prove and must not borrow the paid entries' panel.
  check('free entry shows no proof panel', freeSpec.getElementById('skill-proof').hidden, true);
  checkTrue('free spec makes no premium claim', freeSpecText.indexOf('Premium:') === -1);
  checkTrue('free spec makes no proved claim', freeSpecText.indexOf('Proved:') === -1);
  checkTrue('free spec has no what-you-get row', freeSpecText.indexOf('What you get:') === -1);
  checkTrue('free spec names the publisher', freeSpecText.indexOf('Publisher: Matt Pocock') !== -1);

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
    const radios = submitDoc.getElementById('skill-form').querySelectorAll('input[name="kind"]');
    const setKind = (value) => {
      radios.forEach(function (r) { r.checked = r.getAttribute('value') === value; });
    };
    const fire = () => {
      let prevented = false;
      capturedHandler({ preventDefault: () => { prevented = true; } });
      return prevented;
    };

    check('submit form has a free option', radios.length, 2);
    check('free is the default', radios.filter(function (r) { return r.checked; })[0].getAttribute('value'), 'free');

    // --- free path ---
    setField('f-name', 'My Free Skill');
    setField('f-desc', 'Does a thing');
    setField('f-github', '');
    setKind('free');
    fire();
    check('free listing needs a github link', submitDoc.getElementById('form-status').className, 'form-status error');
    checkTrue('free listing message mentions github', /GitHub link/.test(submitDoc.getElementById('form-status').textContent));

    setField('f-github', 'https://github.com/someone/skill');
    fire();
    check('accepts a free listing with github only', submitDoc.getElementById('form-status').className, 'form-status ok');
    check('mailto targets review address', submitWindow.location.href.indexOf('mailto:' + config.reviewEmail) === 0, true);
    const freeDecoded = decodeURIComponent(submitWindow.location.href);
    checkTrue('free mailto says the type', freeDecoded.indexOf('Listing type: FREE') !== -1);
    checkTrue('free mailto says price is Free', freeDecoded.indexOf('Price (GBP): Free') !== -1);
    checkTrue('free mailto carries github', freeDecoded.indexOf('https://github.com/someone/skill') !== -1);
    checkTrue('free mailto has no USD label', freeDecoded.indexOf('USD') === -1);

    // --- paid path ---
    setKind('paid');
    setField('f-price', '19');
    setField('f-includes', 'A bundle of four skills and a year of updates.');
    setField('f-paypal', 'not-a-url');
    setField('f-github', '');
    fire();
    check('rejects bad paypal url', submitDoc.getElementById('form-status').className, 'form-status error');
    checkTrue('rejects bad paypal url message', /PayPal\.me link/.test(submitDoc.getElementById('form-status').textContent));

    setField('f-paypal', '');
    fire();
    check('paid listing needs a paypal link', submitDoc.getElementById('form-status').className, 'form-status error');
    checkTrue('paid listing message mentions paypal', /PayPal\.me link/.test(submitDoc.getElementById('form-status').textContent));

    setField('f-paypal', 'https://paypal.me/someone');
    setField('f-price', '19');
    setField('f-includes', 'A bundle of four skills and a year of updates.');
    fire();
    check('accepts a paid listing', submitDoc.getElementById('form-status').className, 'form-status ok');
    const paidDecoded = decodeURIComponent(submitWindow.location.href);
    checkTrue('paid mailto says the type', paidDecoded.indexOf('Listing type: PAID') !== -1);
    checkTrue('paid mailto carries skill name', paidDecoded.indexOf('My Free Skill') !== -1);
    checkTrue('paid mailto carries GBP price label', paidDecoded.indexOf('Price (GBP): 19') !== -1);
    checkTrue('paid mailto says what the buyer gets', paidDecoded.indexOf('A bundle of four skills') !== -1);
    checkTrue('paid mailto has no USD label', paidDecoded.indexOf('USD') === -1);
    checkTrue('paid mailto carries the paypal link', paidDecoded.indexOf('https://paypal.me/someone') !== -1);
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
