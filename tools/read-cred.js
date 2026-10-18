// read-cred.js - print an app password from Windows Credential Manager to stdout.
//
// Needed because every "the key fails" test needs a known-good key as a control,
// and shovelling passwords through PowerShell string interpolation is how they get
// mangled. This is the one place a secret legitimately reaches a process, and it
// prints nothing unless asked.
//
//   node tools/read-cred.js dottyMailbox

'use strict';
const { execFileSync } = require('child_process');

const target = process.argv[2];
if (!target) {
  console.error('usage: node tools/read-cred.js <credential-target>');
  process.exit(2);
}

// cmdkey does not echo passwords, so ask PowerShell for the blob instead and take
// only the last line, which is the password.
const ps = `
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
if (-not [CR]::CredRead('${target}', 1, 0, [ref]$p)) { Write-Output 'NOTFOUND'; exit 1 }
try {
  $c = [Runtime.InteropServices.Marshal]::PtrToStructure($p, [type][CR+CREDENTIAL])
  $b = New-Object byte[] $c.CredentialBlobSize
  [Runtime.InteropServices.Marshal]::Copy($c.CredentialBlob, $b, 0, $c.CredentialBlobSize)
  Write-Output ([Text.Encoding]::Unicode.GetString($b).TrimEnd([char]0))
} finally { [CR]::CredFree($p) }
`;

const out = execFileSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', ps], {
  encoding: 'utf8'
});
process.stdout.write(out.trim() + '\n');