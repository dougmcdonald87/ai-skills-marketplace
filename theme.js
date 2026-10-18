// theme.js — the light/dark switch, shared by all four pages.
//
// One implementation, four includes. The same reason there is one email renderer
// on this machine and not two: a second copy of a small behaviour is how two
// versions start disagreeing.
//
// The default is set by an inline script in <head> so the chassis never flashes.
// This file only handles the click and the persisted choice.

(function () {
  'use strict';

  function current() {
    return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
  }

  function apply(mode) {
    if (mode === 'light') {
      document.documentElement.setAttribute('data-theme', 'light');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
    try { localStorage.setItem('register-theme', mode); } catch (e) { /* private mode */ }
    try {
      var meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute('content', mode === 'light' ? '#f6f5f2' : '#0a0b0d');
    } catch (e2) { /* no meta */ }
  }

  function wire() {
    var btn = document.getElementById('theme-toggle');
    if (!btn) return;
    btn.setAttribute('aria-pressed', current() === 'light' ? 'true' : 'false');
    btn.addEventListener('click', function () {
      var next = current() === 'light' ? 'dark' : 'light';
      apply(next);
      btn.setAttribute('aria-pressed', next === 'light' ? 'true' : 'false');
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wire);
  } else {
    wire();
  }
})();