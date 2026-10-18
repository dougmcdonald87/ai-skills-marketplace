// key-variants.js - the drag handle covers the first character of the password in
// Doug's screenshot. Every other character has been read confidently at 10x:
//   group 2 ppee   group 3 hvgj   group 4 catg   group 1 = ?yio
// So sweep the 26 possibilities for that one character against the account, with a
// positive control first so a negative means something.
//
//   node tools/key-variants.js dougmoug@gmail.com yio ppee hvgj catg

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
  line(ms = 12000) {
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
    return { ok: /^a1 OK/i.test(r), res: r };
  } catch (e) { return { ok: false, res: 'ERR ' + e.message }; } finally { im.end(); }
}

async function main() {
  const [, , user, g1, g2, g3, g4] = process.argv;
  if (!user || !g1 || !g2 || !g3 || !g4) {
    console.error('usage: node tools/key-variants.js <email> <g1> <g2> <g3> <g4>');
    process.exit(2);
  }

  console.log('');
  console.log('  CONTROL');
  const ctl = await tryLogin('dottyecho1@gmail.com', stored('dottyMailbox'));
  console.log('  dottyecho1 + stored key : ' + (ctl.ok ? 'OK' : 'BROKEN - all results below are meaningless'));
  if (!ctl.ok) process.exit(2);

  console.log('');
  console.log('  Sweeping character 1 of group 1 ("' + g1 + '"), rest fixed: ' + g2 + ' ' + g3 + ' ' + g4);
  console.log('');
  const alpha = 'abcdefghijklmnopqrstuvwxyz';
  const hits = [];
  for (const c of alpha) {
    const candidate = c + g1 + g2 + g3 + g4;
    const r = await tryLogin(user, candidate);
    if (r.ok) hits.push(candidate);
    console.log('    ' + (r.ok ? 'MATCH  ' : '  --   ') + candidate);
  }

  console.log('');
  if (hits.length) {
    console.log('  RESULT: ' + hits.join(', '));
  } else {
    console.log('  RESULT: no first character works. Every other character is read confidently,');
    console.log('  so either the remaining groups are also misread, or this app password is no');
    console.log('  longer valid for the account.');
  }
  console.log('');
  process.exit(hits.length ? 0 : 1);
}

main();