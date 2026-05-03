param(
  [ValidateSet('all','open','done')]
  [string]$Status = 'open',

  [string]$BaseUrl = 'http://localhost:3100'
)

$ErrorActionPreference = 'Stop'

$Response = Invoke-RestMethod -Uri "$BaseUrl/api/loops?status=$Status" -Method Get

if (!$Response.loops -or $Response.loops.Count -eq 0) {
  Write-Host "No $Status feedback loops."
  return
}

$Response.loops | ForEach-Object {
  Write-Host "[$($_.status)] $($_.id)"
  Write-Host "  updatedAt=$($_.updatedAt) actions=$($_.actionCount) openActions=$($_.actionOpenCount) autoAck=$($_.autoAckCount)"
  Write-Host "  speakers=$($_.speakers -join ',') targets=$($_.targets -join ',')"
  Write-Host "  $($_.title)"
  Write-Host ''
}
