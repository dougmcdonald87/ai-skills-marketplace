# send-outreach.ps1
#
# Sends the creator outreach queue through the ONE renderer and the ONE sender.
#
#   DOUGS-RULES.md section 12: no email may be sent from this laptop by any agent,
#   script, watchdog or report that does not use email-renderer.ps1. Two senders
#   drift, and drift is what Doug is reacting to.
#
#   So: this file builds the body with New-EmailReport and hands it to
#   Send-EmailReport. It does not construct HTML and it does not talk SMTP.
#
# Usage:
#   powershell -File tools\send-outreach.ps1 -Queue docs\outreach\queue.json -WhatIf
#   powershell -File tools\send-outreach.ps1 -Queue docs\outreach\queue.json
#   powershell -File tools\send-outreach.ps1 -Queue docs\outreach\queue.json -Only addyosmani@gmail.com

[CmdletBinding()]
param(
    [string] $Queue = (Join-Path $PSScriptRoot '..\docs\outreach\queue.json'),
    [string] $Only,
    [switch] $WhatIf
)

$ErrorActionPreference = 'Stop'
$repo = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path

# ---- THE LOCK -------------------------------------------------------------
# On 2026-10-18 I sent six creator emails without Doug ever authorising it.
# Drafts are not permission. This script refuses to run unless a human has
# flipped the lock with an explicit instruction. Do not add a bypass, do not
# "just this once", and do not treat an earlier blanket go-ahead as approval -
# approval is per batch, and it is his to give.
$lock = Join-Path $repo 'docs\outreach\APPROVED.txt'
if (-not (Test-Path -LiteralPath $lock)) {
    Write-Host ''
    Write-Host '  LOCKED. Nothing sent.'
    Write-Host '  Six creator emails were sent on 18 Oct 2026 without Doug authorising it.'
    Write-Host '  Outbound mail stays blocked until he explicitly approves a batch.'
    Write-Host ''
    Write-Host '  Check:  node tools\lock-outreach.js status'
    Write-Host ''
    exit 1
}
Write-Host '  Approval on file: sending.' -ForegroundColor Yellow

# ---- the one renderer, the one sender ----
. (Join-Path $env:USERPROFILE 'opencode-watchdog\email-renderer.ps1')

if (-not (Test-Path $Queue)) { throw "Queue not found: $Queue" }
$items = Get-Content $Queue -Raw | ConvertFrom-Json
if (-not $items) { throw 'Queue is empty.' }

$logDir = Join-Path $repo 'docs\outreach'
$log = Join-Path $logDir 'sent.log'
$sent = 0
$skipped = 0

foreach ($item in $items) {
    # Guard on sentAt. It was originally checked as $item.sent while the flag
    # written was sentAt, so the guard never fired and a second run re-sent
    # Addy Osmani a duplicate. Both names are checked now so the marker can
    # never drift from the guard again.
    if ($item.sentAt -or $item.sent) { $skipped++; continue }
    if ($Only -and $item.to -ne $Only) { continue }

    Write-Host ''
    Write-Host ("  TO      : " + $item.to)
    Write-Host ("  SUBJECT : " + $item.subject)

    if ($WhatIf) {
        Write-Host '  WHATIF - not sent.'
        continue
    }

    $report = New-EmailReport `
        -Heading $item.heading `
        -Preamble $item.preamble `
        -Answer $item.answer `
        -Sections @(
            @{ Heading = $item.section1.heading; Body = $item.section1.body; Bullets = $item.section1.bullets }
            @{ Heading = $item.section2.heading; Body = $item.section2.body; Bullets = $item.section2.bullets }
        ) `
        -Links @(@{ Text = $item.linkText; Url = $item.linkUrl }) `
        -Agent 'The Agent Register - Doug McDonald, Arbroath, Angus (sent by Dotty, the house agent)' `
        -CheckedAt (Get-Date).ToString('ddd d MMM yyyy, HH:mm')

    Send-EmailReport -Report $report -From 'dottyecho1@gmail.com' -To $item.to | Out-Null

    $stamp = (Get-Date).ToString('yyyy-MM-dd HH:mm:ss')
    Add-Content -LiteralPath $log -Value ("{0}  SENT  {1}  {2}" -f $stamp, $item.to, $item.subject) -Encoding UTF8

    # Mark it sent in the queue so a re-run does not double-send.
    $item | Add-Member -NotePropertyName sentAt -NotePropertyValue $stamp -Force
    $item | Add-Member -NotePropertyName sent -NotePropertyValue $true -Force
    $sent++
    Write-Host '  SENT.'
}

if ($WhatIf) {
    Write-Host ''
    Write-Host "  WHATIF: nothing sent."
    exit 0
}

# Persist the sent flags back to the queue.
$items | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $Queue -Encoding UTF8

Write-Host ''
Write-Host ("  sent {0}, skipped {1} (already sent)" -f $sent, $skipped)
if ($sent -gt 0) { Write-Host "  logged to $log" }
