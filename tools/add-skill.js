const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SKILLS = path.join(ROOT, 'skills.json');

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) {
      args[key] = true;
    } else {
      args[key] = next;
      i++;
    }
  }
  return args;
}

function fail(message) {
  console.error('ERROR: ' + message);
  process.exit(1);
}

// --ships may arrive comma-separated or repeated; normalise to a trimmed array.
function toList(value) {
  if (value === undefined || value === null) return [];
  const raw = Array.isArray(value) ? value : String(value).split(',');
  return raw
    .map(function (s) { return String(s).trim(); })
    .filter(function (s) { return s.length > 0; });
}

function buildProof(args) {
  const tested = args['proof-tested'];
  const command = args['proof-command'];
  const result = args['proof-result'];
  const reproduce = args['proof-reproduce'];
  if (!tested && !command && !result && !reproduce) return null;
  return {
    testedOn: tested || '',
    command: command || '',
    result: result || '',
    reproduce: reproduce || '',
    verifiedOn: args['proof-env'] || '',
    verifiedAt: args['proof-date'] || new Date().toISOString().slice(0, 10),
    verifiedBy: args['proof-by'] || 'The Register'
  };
}

function slugify(name) {
  return String(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const data = JSON.parse(fs.readFileSync(SKILLS, 'utf8'));
  const skills = data.skills || [];

  if (args.list) {
    console.log('Entries: ' + skills.length);
    skills.forEach(function (s) {
      console.log(
        '  No. ' + s.no + '  ' + s.id.padEnd(12) +
        (s.free ? 'Free  ' : ('£' + s.price).padEnd(7)) +
        ' ' + s.name + '  — ' + s.publisher
      );
    });
    return;
  }

  if (!args.name) fail('--name is required. Use --list to see current entries.');
  if (!args.desc) fail('--desc is required. Say what the skill does, in one or two sentences.');
  if (!args.category) fail('--category is required.');
  if (!args.publisher) fail('--publisher is required. Say who stands behind the entry.');

  const free = args.free === true || args.free === 'true';
  let price = 0;
  if (!free) {
    if (args.price === undefined) fail('--price is required for a paid entry, or pass --free.');
    price = Number(args.price);
    if (!Number.isFinite(price) || price < 0) fail('--price must be a number of pounds, 0 or more.');
  }

  let github = args.github || null;
  if (github !== null) {
    if (!/^https:\/\/github\.com\/[^/]+\/[^/]+/.test(github)) {
      fail('--github must be a full https://github.com/owner/repo URL.');
    }
  }
  if (free && !github) fail('A free entry needs --github, so buyers can install it from the source.');

  // A paid entry must be premium AND proved, or it is not worth anybody's money.
  //
  // The underlying skills are mostly MIT and already free elsewhere, so a listing
  // that ships only prose is a listing charging money for something the buyer can
  // get for nothing. Two rules make that impossible to publish by accident:
  //
  //   --ships     at least one thing that is not prose (a script, a reference,
  //               a worked example). Pass it comma-separated, repeated.
  //   --proof     the recorded run: what was tested, the command, the result,
  //               and how to reproduce it.
  //
  // Free entries are exempt. Charging is the claim, and a claim needs evidence.
  const ships = toList(args.ships);
  const proof = buildProof(args);

  if (!free && price > 0) {
    if (ships.length === 0) {
      fail(
        'A paid entry must ship more than prose.\n' +
        '  The skills themselves are free and MIT almost everywhere, so prose alone is not\n' +
        '  worth money. Pass --ships with at least one script, reference or worked example.\n' +
        '  Example: --ships "run-review.ps1 - pins the diff and emits both briefs,standards-checklist.md"'
      );
    }
    if (ships.some(function (s) { return /\.(md|txt)$/i.test(s) && !/worked-example/i.test(s); })) {
      fail('Every --ships item must be something you can run or read as a reference, not a Markdown file.');
    }
    if (!proof) {
      fail(
        'A paid entry must carry proof.\n' +
        '  Pass --proof-tested, --proof-command, --proof-result and --proof-reproduce.\n' +
        '  Proof is the run and its actual output, not a claim that it works.'
      );
    }
    // THE HARD RULE. Doug: "we can only sell premium skills not other folks free
    // skills they need to be worth the money or why would someone pay for something
    // they can source themselves." He said this repeatedly and was right.
    //
    // If an entry has to credit another author, the skill is derived from their
    // free open-source work. Charging for that is not worth the money to a buyer -
    // they can source it themselves - and it is not fair to the author. Entries
    // 001 and 004 were taken off sale for exactly this reason on 18 Oct 2026.
    //
    // So: attribution is allowed on free listings, refused on paid ones.
    if (args.attribution) {
      fail(
        'A paid entry cannot be built on another author\'s work.\n' +
        '  --attribution is set, which means this skill is derived from someone else\'s\n' +
        '  free open-source work. That is a free listing: link to the source and credit\n' +
        '  them. Only Doug\'s OWN original work can be priced.\n' +
        '  List it free with --github, or drop --attribution if this is original.'
      );
    }
    if (String(args.publisher || '').toLowerCase() !== 'the register') {
      fail(
        'A paid entry must be published by The Register.\n' +
        '  Paid entries are Doug\'s own original work. Anything else is a free listing\n' +
        '  that links to its author.'
      );
    }
    // Checked against the field names buildProof actually returns. This was reading
    // proof['tested'], which does not exist - the field is 'testedOn' - so
    // --proof-tested was reported missing no matter what was passed.
    const required = [
      ['testedOn', '--proof-tested'],
      ['command', '--proof-command'],
      ['result', '--proof-result'],
      ['reproduce', '--proof-reproduce']
    ];
    const missing = required.filter(function (pair) { return !String(proof[pair[0]] || '').trim(); });
    if (missing.length) {
      fail('Proof is incomplete. Missing: ' + missing.map(function (pair) { return pair[1]; }).join(', '));
    }
  }

  const nextNo = skills.length
    ? String(Math.max.apply(null, skills.map(function (s) { return Number(s.no) || 0; })) + 1).padStart(3, '0')
    : '001';

  const id = args.id || ('skill-' + nextNo);
  const existing = skills.filter(function (s) { return s.id === id; })[0];
  if (existing && args.update !== true) {
    fail('Entry "' + id + '" already exists (' + existing.name + '). Pass --update to change it.');
  }
  if (skills.some(function (s) { return s.name.toLowerCase() === String(args.name).toLowerCase(); }) && !existing) {
    fail('An entry with that name already exists. Use --id to give it a distinct id.');
  }

  const entry = {
    id: id,
    no: existing ? existing.no : nextNo,
    name: String(args.name).trim(),
    desc: String(args.desc).trim(),
    platform: args.platform || 'Universal',
    category: String(args.category).trim(),
    price: price,
    github: github,
    free: free,
    verified: args.verified === true || args.verified === 'true',
    publisher: String(args.publisher).trim(),
    format: args.format || 'Markdown skill (SKILL.md)',
    licence: args.licence || 'MIT'
  };

  // A paid entry has to say what the buyer gets, or the price is arbitrary.
  if (args.includes) entry.includes = String(args.includes).trim();
  if (args.attribution) entry.attribution = String(args.attribution).trim();

  if (!free && !entry.includes) {
    fail('A paid entry needs --includes. Say what the buyer actually gets for the price.');
  }

  // Premium and proof travel with the entry. An --update that does not restate them
  // must not silently strip a paid listing of its evidence.
  if (!free && price > 0) {
    entry.premium = true;
    entry.ships = ships;
    entry.proof = proof;
  } else if (existing && existing.proof && existing.ships) {
    entry.premium = existing.premium;
    entry.ships = existing.ships;
    entry.proof = existing.proof;
  }

  if (existing) {
    skills[skills.indexOf(existing)] = entry;
  } else {
    skills.push(entry);
  }
  data.skills = skills;

  // Locale guard. The register is en-GB / GBP and must not drift.
  const serialised = JSON.stringify(data, null, 2);
  ['USD', 'one-time', 'color', 'behavior', 'catalog '].forEach(function (bad) {
    if (serialised.toLowerCase().indexOf(bad.toLowerCase()) !== -1) {
      fail('Rejected: the register data contains "' + bad + '". It is en-GB / GBP.');
    }
  });
  if (data.marketplace.currency !== 'GBP') fail('marketplace.currency must be GBP.');
  if (data.marketplace.locale !== 'en-GB') fail('marketplace.locale must be en-GB.');

  JSON.parse(serialised);
  fs.writeFileSync(SKILLS, serialised + '\n', 'utf8');

  console.log((existing ? 'Updated ' : 'Added ') + 'No. ' + entry.no + '  ' + entry.id + '  ' + entry.name);
  console.log('  price: ' + (free ? 'Free' : '£' + price) + '   publisher: ' + entry.publisher);
  console.log('  github: ' + (entry.github || '(none)'));
  console.log('Run: node test\\page-render.test.js');
}

main();
