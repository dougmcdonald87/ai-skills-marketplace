#!/usr/bin/env node
// verify-packs.js — reconcile what the register PROMISES against what is DELIVERED.
//
// The premium promise is the whole product: skills.json tells buyers what they get.
// If that list and the pack folders drift apart, the register is selling a file list
// it cannot produce, which is worse than charging for prose because it is now
// specific and checkable.
//
// This is the check that makes "worth the money" true rather than claimed.
//
//   node tools/verify-packs.js            verify
//   node tools/verify-packs.js --strict    verify, and fail if any pack is missing
//
// Written in Node on purpose: parsing JSON is Node's job, and Rule 33 of
// DOUGS-RULES.md forbids doing it in PowerShell (whose Set-Content writes a BOM
// that JSON.parse then rejects).

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PACKS_ROOT = process.env.PACKS_ROOT ||
  path.join(process.env.USERPROFILE || '', 'agent-register-packs');

const strict = process.argv.includes('--strict');

function fail(msg) {
  console.error('  FAIL  ' + msg);
  process.exitCode = 1;
}

function main() {
  const skillsPath = path.join(ROOT, 'skills.json');
  if (!fs.existsSync(skillsPath)) {
    console.error('skills.json not found at ' + skillsPath);
    process.exit(1);
  }

  const data = JSON.parse(fs.readFileSync(skillsPath, 'utf8').replace(/^\uFEFF/, ''));
  const skills = data.skills || [];
  const paid = skills.filter((s) => !s.free && Number(s.price) > 0);
  const promising = paid.filter((s) => Array.isArray(s.ships) && s.ships.length > 0);

  console.log('');
  console.log('  The Agent Register — pack reconciliation');
  console.log('  ------------------------------------------------');
  console.log('  packs root: ' + PACKS_ROOT);

  if (promising.length === 0) {
    console.log('');
    console.log('  No paid entry declares a --ships list.');
    if (strict) {
      fail('strict mode: expected at least one paid entry with a ships list');
    }
    return;
  }

  let promised = 0;
  let missing = 0;

  for (const skill of promising) {
    const packDir = path.join(PACKS_ROOT, folderFor(skill));
    console.log('');
    console.log('  No. ' + skill.no + '  ' + skill.name + '  —  ' + packDir);

    if (!fs.existsSync(packDir)) {
      missing += skill.ships.length;
      promised += skill.ships.length;
      fail('pack folder does not exist: ' + packDir);
      continue;
    }

    for (const item of skill.ships) {
      promised += 1;
      const rel = String(item).split(' - ')[0].trim();
      const full = path.join(packDir, rel.replace(/\/$/, ''));

      if (!fs.existsSync(full)) {
        missing += 1;
        fail('promised but absent: ' + rel);
        continue;
      }

      const stat = fs.statSync(full);
      if (stat.isDirectory()) {
        const count = fs.readdirSync(full, { withFileTypes: true })
          .filter((d) => d.isFile()).length;
        if (count === 0) {
          fail('empty folder: ' + rel);
        } else {
          console.log('    ok      ' + rel + '  (' + count + ' files)');
        }
      } else {
        if (stat.size === 0) {
          fail('empty file: ' + rel);
        } else {
          console.log('    ok      ' + rel + '  (' + stat.size + ' bytes)');
        }
      }
    }

    // Proof must describe a run, not a claim.
    const p = skill.proof || {};
    for (const key of ['testedOn', 'command', 'result', 'reproduce', 'verifiedAt', 'verifiedBy']) {
      if (!String(p[key] || '').trim()) {
        fail(skill.name + ': proof.' + key + ' is empty');
      }
    }
  }

  // A paid entry that promises nothing is not premium.
  for (const skill of paid) {
    if (!Array.isArray(skill.ships) || skill.ships.length === 0) {
      fail(skill.name + ' is priced at £' + skill.price + ' but ships nothing');
    }
    if (skill.premium !== true) {
      fail(skill.name + ' is priced but does not declare premium');
    }
  }

  console.log('');
  console.log('  ------------------------------------------------');
  if (missing === 0 && process.exitCode !== 1) {
    console.log('  PASS  ' + promised + ' promised item(s), none missing.');
    console.log('');
    return;
  }
  console.log('  ' + missing + ' of ' + promised + ' promised item(s) are missing.');
  console.log('');
}

// The pack folder is declared explicitly on the entry (packFolder) rather than
// derived from the id, because entries get renumbered and a folder that moves when
// the register grows is a folder that will eventually be missed.
function folderFor(skill) {
  if (skill.packFolder) return String(skill.packFolder);
  const byId = path.join(PACKS_ROOT, String(skill.id || '').replace(/^skill-/, ''));
  if (fs.existsSync(byId)) return String(skill.id).replace(/^skill-/, '');
  return String(skill.name).toLowerCase().replace(/\s+/g, '-');
}

main();