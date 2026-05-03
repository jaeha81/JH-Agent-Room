param(
  [ValidateSet('all','claude','codex','gpt')]
  [string]$Target = 'codex',

  [string]$BaseUrl = 'http://localhost:3100'
)

$ErrorActionPreference = 'Stop'

$Response = Invoke-RestMethod -Uri "$BaseUrl/api/queue?target=$Target" -Method Get

if (!$Response.messages -or $Response.messages.Count -eq 0) {
  Write-Host "No pending $Target queue items."
  return
}

$Response.messages | ForEach-Object {
  $CreatedAt = if ($_.createdAt) { ([datetime]$_.createdAt).ToString('yyyy-MM-dd HH:mm') } else { 'unknown' }
  Write-Host "[$($_.status)] $($_.id)"
  Write-Host "  target=$($_.target) taskType=$($_.taskType) kind=$($_.kind) createdAt=$CreatedAt"
  Write-Host "  $($_.body)"
  Write-Host ''
}
