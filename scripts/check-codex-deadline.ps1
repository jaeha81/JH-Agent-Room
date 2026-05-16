# check-codex-deadline.ps1
# Codex review 미응답(overdue) 항목 감지 및 Claude 에게 리마인더 발송
# Task Scheduler 에서 5분 간격으로 실행.

param(
  [string]$Url = 'http://localhost:3100',
  [int]$MaxReminders = 25,
  [switch]$DryRun
)

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
$EnvFile = Join-Path $Root '.env'

# .env 로드
if (Test-Path $EnvFile) {
  Get-Content $EnvFile | ForEach-Object {
    if ($_ -match '^\s*#' -or $_ -notmatch '=') { return }
    $Name, $Value = $_ -split '=', 2
    [Environment]::SetEnvironmentVariable($Name.Trim(), $Value.Trim(), 'Process')
  }
}

if (!$env:ADMIN_SECRET -and !$DryRun) {
  Write-Warning 'ADMIN_SECRET is not set — cannot post reminder messages. Exiting.'
  exit 1
}

# 서버 연결 확인
try {
  $null = Invoke-RestMethod -Uri "$Url/api/status" -TimeoutSec 5
} catch {
  Write-Warning "Agent Room server not reachable at $Url — skipping deadline check."
  exit 0
}

# overdue review 목록 조회
$SafeMaxReminders = [Math]::Max(1, [Math]::Min($MaxReminders, 200))
$Result = Invoke-RestMethod -Uri "$Url/api/overdue-reviews?limit=$SafeMaxReminders" -Method Get
$Count  = $Result.count
$Items  = @($Result.items) | Select-Object -First $SafeMaxReminders
$Returned = $Items.Count

if ($Count -eq 0) {
  Write-Host "[check-codex-deadline] No overdue reviews."
  exit 0
}

Write-Host "[check-codex-deadline] $Count overdue Codex review(s) found; processing $Returned this run."
if ($DryRun) {
  Write-Host "[check-codex-deadline] DryRun enabled; no reminders will be posted."
}

$Headers = @{ 'x-admin-secret' = $env:ADMIN_SECRET }

foreach ($Item in $Items) {
  $Id       = $Item.id
  $Deadline = $Item.reviewDeadline
  $OrigBody = $Item.body -replace '\n', ' '
  if ($OrigBody.Length -gt 120) { $OrigBody = $OrigBody.Substring(0, 120) + '...' }

  $Body = @"
[Codex 리마인더] 미응답 review 항목이 기한을 초과했습니다.
ID: $Id
기한: $Deadline
내용 요약: $OrigBody
Codex가 응답하지 않은 경우 수동으로 확인하거나 /api/messages/status 로 done 처리해 주세요.
"@

  $Payload = @{
    speaker  = 'claude'
    kind     = 'direction'
    target   = 'both'
    taskType = 'review'
    status   = 'todo'
    replyTo  = $Id
    body     = $Body
  } | ConvertTo-Json -Compress

  if ($DryRun) {
    Write-Host "  Dry run: would post reminder for review $Id"
    continue
  }

  try {
    Invoke-RestMethod -Uri "$Url/api/messages" -Method Post `
      -ContentType 'application/json; charset=utf-8' `
      -Headers $Headers -Body $Payload | Out-Null
    Write-Host "  Reminder posted for review $Id"
  } catch {
    Write-Warning "  Failed to post reminder for $Id : $_"
  }
}
