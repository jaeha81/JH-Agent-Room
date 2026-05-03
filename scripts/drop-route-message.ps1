param(
  [Parameter(Mandatory=$true)]
  [ValidateSet('claude','codex','user')]
  [string]$Speaker,

  [Parameter(Mandatory=$true)]
  [ValidateSet('direction','implementation','review','sync')]
  [string]$Kind,

  [Parameter(Mandatory=$true)]
  [string]$Body,

  [ValidateSet('room','both','gpt','claude','codex','harness','github','local')]
  [string]$Target = 'room',

  [ValidateSet('question','plan','implementation','review','harness','github','local','browser')]
  [string]$TaskType = 'question',

  [ValidateSet('todo','working','review','done')]
  [string]$Status = 'todo',

  [string]$LoopId = '',

  [string]$ReplyTo = '',

  [string]$SharedDir = ''
)

$ErrorActionPreference = 'Stop'

if (!$SharedDir) {
  $Root = Split-Path -Parent $PSScriptRoot
  $EnvFile = Join-Path $Root '.env'
  if (Test-Path $EnvFile) {
    Get-Content $EnvFile | ForEach-Object {
      if ($_ -match '^\s*#' -or $_ -notmatch '=') { return }
      $Name, $Value = $_ -split '=', 2
      [Environment]::SetEnvironmentVariable($Name.Trim(), $Value.Trim(), 'Process')
    }
  }
  $SharedDir = $env:AGENT_ROOM_SHARED_DIR
}

if (!$SharedDir) {
  $DriveRoot = 'G:\'
  $SharedDir = Get-ChildItem -LiteralPath $DriveRoot -Directory -Recurse -Depth 2 -ErrorAction Stop |
    Where-Object { $_.Name -like '*JH-SHARED' } |
    Select-Object -First 1 -ExpandProperty FullName
}

if (!$SharedDir) {
  throw 'SharedDir was not provided and JH-SHARED was not found on G:.'
}

$InboxDir = Join-Path $SharedDir '01_AGENT_ROOM\inbox'
New-Item -ItemType Directory -Force -Path $InboxDir | Out-Null

$Payload = [ordered]@{
  speaker = $Speaker
  kind = $Kind
  target = $Target
  taskType = $TaskType
  status = $Status
  body = $Body
  droppedAt = (Get-Date).ToString('o')
  source = "$env:COMPUTERNAME/$env:USERNAME"
}
if ($LoopId) { $Payload.loopId = $LoopId }
if ($ReplyTo) { $Payload.replyTo = $ReplyTo }

$Stamp = (Get-Date).ToString('yyyyMMdd-HHmmss-fff')
$Id = [guid]::NewGuid().ToString('N')
$File = Join-Path $InboxDir "$Stamp-$Speaker-to-$Target-$Id.json"
$Payload | ConvertTo-Json -Depth 4 | Set-Content -Encoding UTF8 -Path $File

Write-Host "Dropped route message:"
Write-Host $File
