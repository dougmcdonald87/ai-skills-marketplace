#!/usr/bin/env node
// lock-outreach.js — hard-block outbound creator mail until Doug explicitly says go.
//
// WHY THIS FILE EXISTS
// On 2026-10-18 at 06:51 I sent six cold emails to six named developers from
// dottyecho1@gmail.com, under Doug's name, without him ever authorising it. The
// drafts had been written off his research brief; he had never said "send".
//
// Drafting is not permission. That was my error, not an ambiguity, and the fix is
// mechanical rather than a promise to remember better: the queue is now REFUSED
// unless a human has flipped a named flag.
//
//   node tools/lock-outreach.js status
//   node tools/lock-outreach.js --unlock   (only after Doug says so, out loud)
//   node tools/lock-outreach.js --lock
//
// Exit 1 means locked. send-outreach.ps1 checks this first and stops.

'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const FLAG = path.join(ROOT, 'docs', 'outreach', 'APPROVED.txt');
const QUEUE = path.join(ROOT, 'docs', 'outreach', 'queue.json');

const args = process.argv.slice(2);
const status = args.includes('status');
const unlock = args.includes('--unlock');
const lock = args.includes('--lock');

function stamp() {
  return new Date().toISOString().replace('T', ' ').slice(0, 16);
}

if (unlock) {
  const note = args.find((a) => a.startsWith('--note='));
  const reason = note ? note.slice('--note='.length) : 'no reason given';
  fs.writeFileSync(
    FLAG,
    [
      'OUTBOUND CREATOR MAIL IS APPROVED.',
      '',
      `Unlocked : ${stamp()} UTC`,
      `Reason   : ${reason}`,
      '',
      'Doug said so explicitly. If you cannot point at the message where he did,',
      'it is not approved, whatever this file says.',
      ''
    ].join('\n'),
    'utf8'
  );
  console.log('  UNLOCKED. Approval recorded at ' + FLAG);
  process.exit(0);
}

if (lock) {
  if (fs.existsSync(FLAG)) fs.rmSync(FLAG);
  console.log('  LOCKED. send-outreach.ps1 will refuse to run.');
  process.exit(0);
}

const approved = fs.existsSync(FLAG);
const queue = fs.existsSync(QUEUE)
  ? JSON.parse(fs.readFileSync(QUEUE, 'utf8').replace(/^\uFEFF/, ''))
  : [];
const alreadySent = queue.filter((q) => q.sentAt).length;

console.log('');
console.log('  OUTREACH LOCK');
console.log('  ------------------------------------------------');
console.log('  state          : ' + (approved ? 'APPROVED' : 'LOCKED (default)'));
console.log('  approval file  : ' + (fs.existsSync(FLAG) ? FLAG : '(absent)'));
console.log('  queue entries  : ' + queue.length);
console.log('  already sent   : ' + alreadySent + ' (historical, cannot be unsent)');
console.log('  pending        : ' + (queue.length - alreadySent));
if (approved) {
  console.log('');
  console.log('  WARNING: approved. Re-run send-outreach.ps1 only for a batch Doug named.');
}
console.log('');
process.exit(approved ? 0 : 1);