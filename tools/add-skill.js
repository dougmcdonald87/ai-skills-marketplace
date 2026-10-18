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
