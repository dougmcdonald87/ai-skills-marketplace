// take-off-sale.js - entries 001 and 004 come off sale, immediately and honestly.
//
// WHY
// Doug: "we can only sell premium skills not other folks free skills they need to be
// worth the money or why would someone pay for something they can source themselves"
// He has said this repeatedly and was right every time.
//
// Entries 001 (Code Review) and 004 (Prototype) were being sold at GBP29 and GBP19.
// Both are repackaged Matt Pocock MIT skills. Those skills are free and already
// published on skills.sh. Charging GBP29 for a repackaging of someone's free
// open-source work is not worth the money to a buyer, and it is not fair to them.
// That is not a pricing problem. It is a legitimate-product problem.
//
// WHAT THIS DOES
// Both become free listings that link to the source, with licence and attribution
// intact. Nothing about the authors is removed - the credit stays and gets more
// accurate. The premium/ships/proof/packFolder fields are removed because we are no
// longer claiming to sell them.
//
// The register's rule, enforced from here on:
//   A paid entry must be Doug's OWN original work.
//   A priced repackaging of someone else's free skill is refused.

'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SKILLS = path.join(ROOT, 'skills.json');

// Matt Pocock's public repositories. These are the real sources; a free listing
// that does not link to them is just an advert for someone else's work.
const SOURCES = {
  'skill-001': 'https://github.com/mattpocock/skills/tree/main/skills/engineering/code-review',
  'skill-004': 'https://github.com/mattpocock/skills/tree/main/skills/productivity/prototype'
};

function main() {
  const raw = fs.readFileSync(SKILLS, 'utf8').replace(/^\uFEFF/, '');
  const data = JSON.parse(raw);
  let changed = 0;

  for (const s of data.skills) {
    if (s.free && !Number(s.price)) continue;      // already free
    if (!SOURCES[s.id]) continue;                 // not one of the two

    console.log('  No. ' + s.no + '  ' + s.name + '  was GBP' + s.price);

    s.price = 0;
    s.free = true;
    s.github = SOURCES[s.id];
    s.publisher = 'Matt Pocock';
    s.includes = undefined;
    s.premium = undefined;
    s.ships = undefined;
    s.proof = undefined;
    s.packFolder = undefined;
    s.verified = true;
    s.verificationNote =
      'Free and MIT. Listed here because it is good and it runs on every platform - ' +
      'not for sale. Install it from the source.';

    delete s.includes;
    delete s.premium;
    delete s.ships;
    delete s.proof;
    delete s.packFolder;

    console.log('    -> now FREE, linking to ' + s.github);
    changed++;
  }

  // Drop any empty paid section so the data reads cleanly.
  fs.writeFileSync(SKILLS, JSON.stringify(data, null, 2) + '\n', 'utf8');

  console.log('');
  console.log('  ' + changed + ' entr(y/ies) taken off sale.');
  console.log('');
}

main();