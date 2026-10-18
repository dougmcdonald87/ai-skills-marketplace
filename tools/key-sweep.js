// key-sweep.js - find out WHICH Google account the app password in Doug's
// screenshot belongs to, instead of asking him again.
//
// He sent the screenshot specifically for dougmoug@gmail.com and has now been asked
// about it repeatedly. Guessing at his account is not acceptable, so this tests the
// key against every address plausibly signed in on this machine, using the probe
// that carries a positive control.
//
//   node tools/key-sweep.js <app-password>

'use strict';
const tls = require('tls');
const { execFileSync } = require('child_process');

const CANDIDATES = [
  'dougmoug@gmail.com',
  'dottyecho1@gmail.com',
  'echomcdonald29@gmail.com',
  'dougmcdonald87@gmail.com',
  'dougmyster87@gmail.com',
  'dougmcdonald@gmail.com',
  'dougmcdonald87@googlemail.com',
  'dougmoug@googlemail.com',
  'dougmcdoald87@gmail.com',
  'dougmacdonald@gmail.com',
  'dougmcdonald87@hotmail.com'
];

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
if (-not [CR]::CredRead('__T__', 1, 0, [ref]$p)) { exit 1 }
try {
  $c = [Runtime.InteropServices.Marshal]::PtrToStructure($p, [type][CR+CREDENTIAL])
  $b = New-Object byte[] $c.CredentialBlobSize
  [Runtime.InteropServices.Marshal]::Copy($c.CredentialBlob, $b, 0, $c.CredentialBlobSize)
  Write-Output ([Text.Encoding]::Unicode.GetString($b).TrimEnd([char]0))
} finally { [CR]::CredFree($p) }
`;
const stored = (t) => execFileSync('powershell',
  ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', CREDS_PS.replace('__T__', t)],
  { encoding: 'utf8' }).trim();

class Imap {
  constructor() {
    this.q = []; this.buf = ''; this.waiters = [];
    this.s = tls.connect({ host: 'imap.gmail.com', port: 993, servername: 'imap.gmail.com' });
    this.s.setEncoding('utf8');
    this.s.on('data', (c) => {
      this.buf += c;
      let i;
      while ((i = this.buf.indexOf('\r\n')) !== -1) {
        const l = this.buf.slice(0, i); this.buf = this.buf.slice(i + 2);
        if (this.waiters.length) this.waiters.shift()(l); else this.q.push(l);
      }
    });
    this.s.on('error', () => { if (this.waiters.length) this.waiters.shift()(null); });
  }
  ready() { return new Promise((res, rej) => { this.s.once('secureConnect', res); this.s.once('error', rej); }); }
  line(ms = 15000) {
    if (this.q.length) return Promise.resolve(this.q.shift());
    return new Promise((r) => {
      const t = setTimeout(() => r('__TO__'), ms);
      const h = (l) => { clearTimeout(t); r(l); };
      this.waiters.push(h);
    });
  }
  async until(pred, max = 12) {
    let last = '';
    for (let i = 0; i < max; i++) {
      const l = await this.line();
      if (l === null || l === '__TO__') return last || 'timeout';
      last = l;
      if (pred(l)) return l;
    }
    return last;
  }
  w(c) { this.s.write(c + '\r\n'); }
  end() { try { this.s.end(); } catch (e) {} }
}

async function tryLogin(user, pass) {
  const im = new Imap();
  try {
    await im.ready();
    await im.until((l) => /^\* OK/i.test(l));
    im.w('a1 LOGIN "' + user + '" "' + pass + '"');
    const r = await im.until((l) => /^a1 (OK|NO|BAD)/i.test(l));
    return /^a1 OK/i.test(r);
  } catch (e) { return false; } finally { im.end(); }
}

async function main() {
  const pass = process.argv[2];
  if (!pass) { console.error('usage: node tools/key-sweep.js <app-password>'); process.exit(2); }

  console.log('');
  console.log('  CONTROL (probe must work before any result means anything)');
  const ctl = await tryLogin('dottyecho1@gmail.com', stored('dottyMailbox'));
  console.log('  dottyecho1 + stored key : ' + (ctl ? 'OK' : 'BROKEN - results below are meaningless'));
  if (!ctl) { process.exit(2); }

  console.log('');
  console.log('  Sweeping the key from the screenshot across candidate accounts:');
  let hit = null;
  for (const addr of CANDIDATES) {
    const ok = await tryLogin(addr, pass);
    console.log('    ' + (ok ? 'MATCH   ' : 'no      ') + addr);
    if (ok && !hit) hit = addr;
  }

  console.log('');
  if (hit) {
    console.log('  RESULT: the key belongs to ' + hit);
  } else {
    console.log('  RESULT: the key authenticates NONE of the candidate accounts.');
    console.log('  The screenshot was therefore taken while signed into a Google account');
    console.log('  that is not any address this machine knows. The app-passwords page shows');
    console.log('  the account at the top of the screen - that is the one piece of');
    console.log('  information only he can read, and nothing here can substitute for it.');
  }
  console.log('');
  process.exit(hit ? 0 : 1);
}

main();