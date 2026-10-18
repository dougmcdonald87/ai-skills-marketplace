// apply-chrome.js — give the remaining three pages the new chassis.
//
// The masthead, fonts, theme default and toggle were redesigned on index.html
// first. The other three pages have the same markup shape, so they get the same
// change. Written in Node because it is a transform over file contents, and
// Rule 33 of DOUGS-RULES.md says transforms belong in Node, not PowerShell.
//
//   node tools/apply-chrome.js

'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PAGES = ['skill-page.html', 'submit.html', 'about.html'];

const OLD_FONTS =
  'https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400..800;1,9..144,400..800&family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500&display=swap';
const NEW_FONTS =
  'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600&display=swap';

const THEME_HEAD = `<script>
  // Dark is the register's chassis, not a preference to be negotiated. An earlier
  // version deferred to prefers-color-scheme and rendered light on any machine set
  // to light - which produced the generic light SaaS look this design exists to
  // avoid. The toggle is how you choose light; the default is not up for vote.
  (function () {
    try {
      if (localStorage.getItem('register-theme') === 'light') {
        document.documentElement.setAttribute('data-theme', 'light');
      }
    } catch (e) { /* private mode - dark is the default anyway */ }
  })();
</script>
<script src="theme.js" defer></script>`;

const NEW_MARK = '<span class="wordmark-mark" aria-hidden="true">R</span>';

const TOGGLE = `<button class="theme-toggle" id="theme-toggle" type="button"
              aria-label="Switch between dark and light" title="Switch theme">◐</button>
    </nav>`;

let changed = 0;
for (const page of PAGES) {
  const file = path.join(ROOT, page);
  if (!fs.existsSync(file)) {
    console.log('  skip (missing) ' + page);
    continue;
  }

  const before = fs.readFileSync(file, 'utf8');
  let src = before;

  src = src.split(OLD_FONTS).join(NEW_FONTS);

  src = src.replace(/<svg class="wordmark-mark"[\s\S]*?<\/svg>/, NEW_MARK);

  src = src.replace('</nav>', TOGGLE);

  if (src.indexOf('theme.js') === -1) {
    src = src.replace('</head>', THEME_HEAD + '\n</head>');
  }

  if (src !== before) {
    fs.writeFileSync(file, src, 'utf8');
    console.log('  updated ' + page);
    changed += 1;
  } else {
    console.log('  unchanged ' + page);
  }
}
console.log('  ' + changed + ' page(s) updated.');