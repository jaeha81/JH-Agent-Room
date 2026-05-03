param(
  [string]$BaseUrl = 'http://localhost:3100'
)

$ErrorActionPreference = 'Stop'

function Post-TestMessage {
  param(
    [string]$Target,
    [string]$TaskType,
    [string]$Body
  )

  $Payload = @{
    speaker = 'user'
    kind = 'direction'
    target = $Target
    taskType = $TaskType
    body = $Body
  } | ConvertTo-Json -Compress

  Invoke-RestMethod -Uri "$BaseUrl/api/messages" -Method Post -ContentType 'application/json; charset=utf-8' -Body $Payload
}

function Assert-QueueContains {
  param(
    [string]$Queue,
    [string]$MessageId
  )

  $Response = Invoke-RestMethod -Uri "$BaseUrl/api/queue?target=$Queue" -Method Get
  $Found = @($Response.messages | Where-Object { $_.id -eq $MessageId }).Count -gt 0
  if (!$Found) {
    throw "Queue '$Queue' did not contain message '$MessageId'."
  }
}

function Complete-Message {
  param([string]$MessageId)

  $Payload = @{
    id = $MessageId
    status = 'done'
  } | ConvertTo-Json -Compress

  Invoke-RestMethod -Uri "$BaseUrl/api/messages/status" -Method Post -ContentType 'application/json; charset=utf-8' -Body $Payload | Out-Null
}

$Cases = @(
  @{ target = 'claude'; taskType = 'implementation'; queues = @('claude'); body = 'compat-test claude direct' },
  @{ target = 'both'; taskType = 'question'; queues = @('claude','codex','both'); body = 'compat-test both shared' },
  @{ target = 'harness'; taskType = 'harness'; queues = @('claude','harness'); body = 'compat-test harness to claude' },
  @{ target = 'codex'; taskType = 'review'; queues = @('codex'); body = 'compat-test codex direct' },
  @{ target = 'github'; taskType = 'github'; queues = @('codex','github'); body = 'compat-test github to codex' },
  @{ target = 'local'; taskType = 'local'; queues = @('codex','local'); body = 'compat-test local to codex' }
)

$Created = @()
try {
  foreach ($Case in $Cases) {
    $Response = Post-TestMessage -Target $Case.target -TaskType $Case.taskType -Body $Case.body
    $Message = $Response.messages | Where-Object { $_.body -eq $Case.body } | Select-Object -Last 1
    if (!$Message) { throw "Message was not returned for target '$($Case.target)'." }
    $Created += $Message.id
    foreach ($Queue in $Case.queues) {
      Assert-QueueContains -Queue $Queue -MessageId $Message.id
    }
  }

  Write-Host 'Routing compatibility PASS.'
  foreach ($Id in $Created) {
    Write-Host "  $Id"
  }
} finally {
  foreach ($Id in $Created) {
    Complete-Message -MessageId $Id
  }
}
