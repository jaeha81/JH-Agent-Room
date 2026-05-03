param(
  [ValidateSet('all','room','both','gpt','claude','codex','harness','github','local')]
  [string]$Target = 'codex',

  [string]$BaseUrl = 'http://localhost:3100',

  [int]$PollSeconds = 5
)

$ErrorActionPreference = 'Stop'
$Seen = New-Object 'System.Collections.Generic.HashSet[string]'

function Write-QueueItem($Message) {
  $CreatedAt = if ($Message.createdAt) { ([datetime]$Message.createdAt).ToString('yyyy-MM-dd HH:mm') } else { 'unknown' }
  Write-Host ''
  Write-Host "=== Agent Room Queue: $($Message.target) / $($Message.taskType) ==="
  Write-Host "id: $($Message.id)"
  Write-Host "status: $($Message.status)"
  Write-Host "createdAt: $CreatedAt"
  Write-Host $Message.body
  Write-Host '=============================================='
}

function Read-Queue {
  try {
    $Response = Invoke-RestMethod -Uri "$BaseUrl/api/queue?target=$Target" -Method Get
    foreach ($Message in @($Response.messages)) {
      if ($Message.id -and !$Seen.Contains($Message.id)) {
        [void]$Seen.Add($Message.id)
        Write-QueueItem $Message
      }
    }
  } catch {
    Write-Warning "Queue read failed: $($_.Exception.Message)"
  }
}

Write-Host "Watching Agent Room queue: $Target ($BaseUrl)"
Write-Host "Use Ctrl+C to stop."
Read-Queue

try {
  $Request = [System.Net.HttpWebRequest]::Create("$BaseUrl/api/events")
  $Request.Accept = 'text/event-stream'
  $Request.Timeout = 30000
  $Response = $Request.GetResponse()
  $Stream = $Response.GetResponseStream()
  $Reader = New-Object System.IO.StreamReader($Stream)
  Write-Host 'Realtime event stream connected.'

  while (!$Reader.EndOfStream) {
    $Line = $Reader.ReadLine()
    if ($Line -like 'event: payload' -or $Line -like 'event: message') {
      Read-Queue
    }
  }
} catch {
  Write-Warning "Realtime stream unavailable. Falling back to polling every $PollSeconds seconds."
  while ($true) {
    Start-Sleep -Seconds $PollSeconds
    Read-Queue
  }
}
