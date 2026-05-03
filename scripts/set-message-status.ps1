param(
  [Parameter(Mandatory=$true)]
  [string]$Id,

  [Parameter(Mandatory=$true)]
  [ValidateSet('todo','working','review','blocked','done')]
  [string]$Status,

  [string]$BaseUrl = 'http://localhost:3100'
)

$ErrorActionPreference = 'Stop'

$Payload = @{
  id = $Id
  status = $Status
} | ConvertTo-Json -Compress

Invoke-RestMethod -Uri "$BaseUrl/api/messages/status" -Method Post -ContentType 'application/json; charset=utf-8' -Body $Payload | Out-Null
Write-Host "Updated message $Id to $Status."
