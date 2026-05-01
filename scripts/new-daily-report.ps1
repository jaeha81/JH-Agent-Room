param(
  [string]$Date = (Get-Date -Format 'yyyy-MM-dd'),
  [string]$Author = 'Codex'
)

$ErrorActionPreference = 'Stop'
$Shared = 'G:\내 드라이브\JH-SHARED'
$DailyRoot = Join-Path $Shared '04_DAILY_REPORTS'
$Template = Join-Path $DailyRoot 'TEMPLATE.md'

if (!(Test-Path $Template)) {
  throw "Daily report template not found: $Template"
}

$Year = $Date.Substring(0, 4)
$Month = $Date.Substring(0, 7)
$TargetDir = Join-Path (Join-Path $DailyRoot $Year) $Month
$Target = Join-Path $TargetDir "$Date.md"

New-Item -ItemType Directory -Path $TargetDir -Force | Out-Null

if (Test-Path $Target) {
  Write-Host "Daily report already exists: $Target"
  exit 0
}

$Content = Get-Content -Encoding UTF8 $Template -Raw
$Content = $Content.Replace('{{DATE}}', $Date).Replace('{{AUTHOR}}', $Author)
Set-Content -Encoding UTF8 $Target $Content
Write-Host "Created daily report: $Target"
