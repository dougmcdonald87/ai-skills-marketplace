// imap-probe.js - does my IMAP login code work, and does a given key work?
//
// History, because this file exists at all:
//   1. I concluded the app key "fails" using a PowerShell IMAP test.
//   2. That test had NO positive control. I only ever proved SMTP worked.
//   3. Rewritten in Node, the control ALSO failed - Gmail sends an untagged
//      * CAPABILITY line after the greeting, and the reader returned that instead
//      of the tagged login reply.
//   4. Fixing that made it hang, because the reader attached/detached a 'data'
//      listener per line and dropped bytes already buffered.
//   5. So every "the key fails" conclusion before this file was fixed was
//      unfounded. A negative result from a tool that has never produced a positive
//      one is not evidence.
//
// This version keeps ONE listener and buffers properly. It always runs a control.
//
//   node tools/imap-probe.js <email> <app-password>
//   node tools/imap-probe.js --control-only

'use strict';
const tls = require('tls');
const { execFileSync } = require('child_process');

const CREDS_PS = `
$src = @'
using System; using System.Runtime.InteropServices;
public class CR {
  [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)]
  public class CREDENTIAL { public int Flags; public int Type; public IntPtr TargetName; public IntPtr Comment; public long LastWritten; public int CredentialBlobSize; public IntPtr CredentialBlob; public int Persist; public int AttributeCount; public IntPtr Attributes; public IntPtr TargetAlias; public IntPtr UserName; }
  [DllImport("advapi32.dll", EntryPoint="CredReadW", CharSet=CharSet.Unicode, SetLastError=true)]
  public static extern bool CredRead(string t, uint type, int r, out IntPtr c);
  [DllImport("advapi32.dll")] public static extern void CredFree(IntPtr c);
}
'@
Add-Type -TypeDefinition $src
$p = [IntPtr]::Zero
if (-not [CR]::CredRead('__TARGET__', 1, 0, [ref]$p)) { exit 1 }
try {
  $c = [Runtime.InteropServices.Marshal]::PtrToStructure($p, [type][CR+CREDENTIAL])
  $b = New-Object byte[] $c.CredentialBlobSize
  [Runtime.InteropServices.Marshal]::Copy($c.CredentialBlob, $b, 0, $c.CredentialBlobSize)
  Write-Output ([Text.Encoding]::Unicode.GetString($b).TrimEnd([char]0))
} finally { [CR]::CredFree($p) }
`;

function storedPassword(target) {
  return execFileSync(
    'powershell',
    ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', CREDS_PS.replace('__TARGET__', target)],
    { encoding: 'utf8' }
  ).trim();
}

// One persistent listener, one buffer. No listener churn, no dropped bytes.
class Imap {
  constructor() {
    this.queue = [];
    this.buffer = '';
    this.waiters = [];
    this.socket = tls.connect({
      host: 'imap.gmail.com', port: 993, servername: 'imap.gmail.com'
    });
    this.socket.setEncoding('utf8');
    this.socket.on('data', (chunk) => {
      this.buffer += chunk;
      let i;
      while ((i = this.buffer.indexOf('\r\n')) !== -1) {
        const line = this.buffer.slice(0, i);
        this.buffer = this.buffer.slice(i + 2);
        if (this.waiters.length) this.waiters.shift()(line);
        else this.queue.push(line);
      }
    });
    this.socket.on('error', (e) => {
      if (this.waiters.length) this.waiters.shift()(null);
    });
  }

  ready() {
    return new Promise((resolve, reject) => {
      this.socket.once('secureConnect', resolve);
      this.socket.once('error', reject);
    });
  }

  line(timeoutMs = 20000) {
    if (this.queue.length) return Promise.resolve(this.queue.shift());
    return new Promise((resolve) => {
      const t = setTimeout(() => {
        const idx = this.waiters.indexOf(handler);
        if (idx !== -1) this.waiters.splice(idx, 1);
        resolve('__TIMEOUT__');
      }, timeoutMs);
      const handler = (line) => { clearTimeout(t); resolve(line); };
      this.waiters.push(handler);
    });
  }

  async until(pred, max = 15) {
    let last = '';
    for (let i = 0; i < max; i++) {
      const line = await this.line();
      if (line === null || line === '__TIMEOUT__') return last || '(timeout)';
      last = line;
      if (pred(line)) return line;
    }
    return last;
  }

  write(cmd) { this.socket.write(cmd + '\r\n'); }
  end() { try { this.socket.end(); } catch (e) { /* already gone */ } }
}

async function tryLogin(user, pass) {
  const imap = new Imap();
  try {
    await imap.ready();
    await imap.until((l) => /^\* OK/i.test(l)); // greeting
    imap.write('a1 LOGIN "' + user + '" "' + pass + '"');
    const res = await imap.until((l) => /^a1 (OK|NO|BAD)/i.test(l));
    if (/^a1 OK/i.test(res)) {
      imap.write('a2 SELECT INBOX');
      const exists = await imap.until((l) => /EXISTS/i.test(l), 10);
      imap.write('a3 LOGOUT');
      return { ok: true, detail: 'LOGIN OK, ' + exists.trim() };
    }
    return { ok: false, detail: res.trim() };
  } catch (e) {
    return { ok: false, detail: 'ERROR ' + e.message };
  } finally {
    imap.end();
  }
}

async function main() {
  console.log('');
  console.log('  IMAP probe - a control runs every time');
  console.log('  ------------------------------------------------');

  // Control first. If this fails, every other result here is meaningless.
  const controlPass = storedPassword('dottyMailbox');
  const control = await tryLogin('dottyecho1@gmail.com', controlPass);
  console.log('  CONTROL  dottyecho1 + stored key : ' +
    (control.ok ? 'OK  (' + control.detail + ')' : 'BROKEN  (' + control.detail + ')'));
  if (!control.ok) {
    console.log('');
    console.log('  The probe cannot authenticate a KNOWN-GOOD key.');
    console.log('  Any failure below is meaningless. Fix the probe first.');
    console.log('');
    process.exit(2);
  }

  const args = process.argv.slice(2);
  if (args.includes('--control-only')) {
    console.log('');
    console.log('  Probe verified working.');
    console.log('');
    process.exit(0);
  }

  const user = args[0];
  const pass = args[1];
  if (!user || !pass) {
    console.log('');
    console.log('  usage: node tools/imap-probe.js <email> <app-password>');
    console.log('');
    process.exit(2);
  }

  const r = await tryLogin(user, pass);
  console.log('  TEST     ' + user + ' : ' + (r.ok ? 'OK  (' + r.detail + ')' : 'FAILED  (' + r.detail + ')'));
  console.log('');
  process.exit(r.ok ? 0 : 1);
}

main().catch((e) => {
  console.log('  ERROR ' + e.message);
  process.exit(2);
});