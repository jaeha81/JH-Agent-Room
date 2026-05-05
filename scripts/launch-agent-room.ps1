param(
  [int]$Port = 3100,
  [switch]$NoBrowser
)

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
$OutLog = Join-Path $Root 'agent-room.out.log'
$ErrLog = Join-Path $Root 'agent-room.err.log'
$Url = "http://localhost:$Port"

function Test-AgentRoom {
  param([string]$TargetUrl)
  try {
    $response = Invoke-WebRequest -Uri "$TargetUrl/api/status" -UseBasicParsing -TimeoutSec 2
    return $response.StatusCode -eq 200
  } catch {
    return $false
  }
}

if (!(Test-AgentRoom -TargetUrl $Url)) {
  $script = Join-Path $PSScriptRoot 'start-agent-room.ps1'
  Start-Process `
    -FilePath 'powershell.exe' `
    -ArgumentList @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $script, '-Port', $Port) `
    -WorkingDirectory $Root `
    -WindowStyle Hidden `
    -RedirectStandardOutput $OutLog `
    -RedirectStandardError $ErrLog

  $ready = $false
  for ($i = 0; $i -lt 20; $i++) {
    Start-Sleep -Milliseconds 500
    if (Test-AgentRoom -TargetUrl $Url) {
      $ready = $true
      break
    }
  }

  if (!$ready) {
    throw "Agent Room did not start. Check $ErrLog"
  }
}

if (!$NoBrowser) {
  Start-Process $Url
}

Write-Host "JH Agent Room is ready: $Url"
