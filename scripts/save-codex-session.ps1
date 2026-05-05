param(
  [string]$Summary = '',
  [string]$UserNote = '',
  [string]$SessionId = '',
  [string]$BrainUrl = 'http://localhost:3457',
  [string]$VaultPath = 'C:\Users\user1\Documents\Obsidian Vault'
)

$ErrorActionPreference = 'Stop'

if (!$SessionId) {
  $SessionId = "codex-$((Get-Date).ToString('yyyyMMdd-HHmmss'))"
}

if (!$Summary) {
  $Summary = 'Codex session ended. No explicit summary was provided.'
}

$Payload = @{
  summary = $Summary
  userNote = $UserNote
  sessionId = $SessionId
} | ConvertTo-Json -Compress

try {
  $Response = Invoke-RestMethod `
    -Uri "$BrainUrl/api/session/save" `
    -Method Post `
    -ContentType 'application/json; charset=utf-8' `
    -Body $Payload `
    -TimeoutSec 8

  Write-Host "Saved Codex session through Brain API: $($Response.path)"
  exit 0
} catch {
  Write-Warning "Brain API save failed. Falling back to direct Obsidian file write. $($_.Exception.Message)"
}

$SessionsDir = Join-Path $VaultPath 'sessions'
if (!(Test-Path -LiteralPath $SessionsDir)) {
  New-Item -ItemType Directory -Path $SessionsDir | Out-Null
}

$Now = Get-Date
$DateStr = $Now.ToString('yyyy-MM-dd')
$TimeStr = $Now.ToString('HH-mm-ss-fff')
$SafeSessionId = $SessionId -replace '[\\/:*?"<>|]', '-'
$FilePath = Join-Path $SessionsDir "$DateStr-$TimeStr-$SafeSessionId-codex.md"

$Content = @"
# Codex session memory - $($Now.ToString('yyyy-MM-dd HH:mm:ss'))

## Agent summary
$Summary

## User note
$UserNote

---
Session ID: $SessionId
Saved at: $($Now.ToString('o'))
Save method: Codex fallback direct write
"@

[System.IO.File]::WriteAllText($FilePath, $Content, [System.Text.UTF8Encoding]::new($false))
Write-Host "Saved Codex session directly to Obsidian: $FilePath"
