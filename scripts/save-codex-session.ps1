param(
  [string]$Summary = '',
  [string]$Workstream = '',
  [string]$UserNote = '',
  [string]$SessionId = '',
  [string]$ThreadId = $env:CODEX_THREAD_ID,
  [string]$WindowId = $env:ORCA_TAB_ID,
  [string]$WorkspaceId = $env:ORCA_WORKSPACE_ID,
  [string]$ProjectPath = '',
  [string]$BrainUrl = 'http://localhost:3457',
  [string]$VaultPath = 'C:\Users\user1\Documents\Obsidian Vault',
  [string]$HandoffIndexDir = '',
  [switch]$DryRun
)

$ErrorActionPreference = 'Stop'

# ⛔ 출력을 UTF-8 로 고정한다. PowerShell 5.1 은 콘솔 코드페이지(한국어 윈도우=cp949)로
# 내보내는데, 이 스크립트의 오류 문구에는 한글이 섞인다. 그러면 UTF-8 로 읽는 쪽이
# `UnicodeDecodeError` 로 죽고 stderr 가 통째로 None 이 되어 **왜 실패했는지가 사라진다**
# (2026-08-13 실측: 부르는 쪽 테스트 3건이 TypeError 로 넘어졌고 원인 문구를 못 봤다).
try {
  [Console]::OutputEncoding = [Text.Encoding]::UTF8
  $OutputEncoding = [Text.Encoding]::UTF8
} catch {
  # 콘솔이 없는 환경(리다이렉트 전용)에서는 설정이 막힐 수 있다 — 여기서 죽지 않는다.
}

if ([string]::IsNullOrWhiteSpace($Summary)) {
  throw 'Summary is required. Refusing to save an ambiguous Codex handoff.'
}

if ([string]::IsNullOrWhiteSpace($Workstream)) {
  throw 'Workstream is required. Refusing to guess which work window this handoff belongs to.'
}

if ([string]::IsNullOrWhiteSpace($ThreadId)) {
  throw 'ThreadId is required. Set CODEX_THREAD_ID or pass -ThreadId explicitly.'
}

if ([string]::IsNullOrWhiteSpace($WindowId)) {
  $WindowId = "thread:$ThreadId"
}

if ([string]::IsNullOrWhiteSpace($ProjectPath)) {
  $ProjectPath = (Get-Location).Path
}

$ProjectPath = [System.IO.Path]::GetFullPath($ProjectPath)
if ([string]::IsNullOrWhiteSpace($WorkspaceId)) {
  $WorkspaceId = "path:$ProjectPath"
}

if ([string]::IsNullOrWhiteSpace($HandoffIndexDir)) {
  $HandoffIndexDir = Join-Path (Split-Path $PSScriptRoot -Parent) '.codex-window-handoffs'
}
$HandoffIndexDir = [System.IO.Path]::GetFullPath($HandoffIndexDir)

if (!$SessionId) {
  $SessionId = "codex-$ThreadId-$((Get-Date).ToString('yyyyMMdd-HHmmss'))"
}

$Scope = [ordered]@{
  schema = 'codex-window-handoff-v1'
  workstream = $Workstream.Trim()
  source_thread_id = $ThreadId.Trim()
  source_window_id = $WindowId.Trim()
  source_workspace_id = $WorkspaceId.Trim()
  project_path = $ProjectPath
}
$ScopeJson = $Scope | ConvertTo-Json -Compress

$ScopedSummary = @"
<!-- CODEX_WINDOW_SCOPE $ScopeJson -->
## Codex window scope
- workstream: $($Scope.workstream)
- source_thread_id: $($Scope.source_thread_id)
- source_window_id: $($Scope.source_window_id)
- source_workspace_id: $($Scope.source_workspace_id)
- project_path: $($Scope.project_path)

## Session summary
$Summary
"@

$ScopedUserNote = @"
## Resume guard
1. Resume from this exact handoff file only, unless current ORCA_TAB_ID equals source_window_id.
2. Never inspect or infer work from other active Claude/Codex sessions.
3. If workstream or window identity is ambiguous, stop and ask the user for the exact handoff file.

$UserNote
"@

$Payload = @{
  summary = $ScopedSummary
  userNote = $ScopedUserNote
  sessionId = $SessionId
} | ConvertTo-Json -Compress

function Get-WindowIndexName {
  $Hasher = [System.Security.Cryptography.SHA256]::Create()
  try {
    $Bytes = [System.Text.Encoding]::UTF8.GetBytes($WindowId)
    $Hash = [System.BitConverter]::ToString($Hasher.ComputeHash($Bytes)).Replace('-', '').ToLowerInvariant()
    return "$($Hash.Substring(0, 24)).json"
  } finally {
    $Hasher.Dispose()
  }
}

function Write-WindowHandoffIndex([string]$SavedPath, [string]$SaveMethod) {
  $ResolvedSavedPath = [System.IO.Path]::GetFullPath($SavedPath)
  if (!(Test-Path -LiteralPath $ResolvedSavedPath -PathType Leaf)) {
    throw "Saved handoff path does not exist: $ResolvedSavedPath"
  }
  if (!(Test-Path -LiteralPath $HandoffIndexDir)) {
    New-Item -ItemType Directory -Path $HandoffIndexDir | Out-Null
  }
  $IndexPath = Join-Path $HandoffIndexDir (Get-WindowIndexName)
  $TempPath = "$IndexPath.tmp-$PID"
  $Index = [ordered]@{
    schema = 'codex-window-handoff-index-v1'
    workstream = $Scope.workstream
    source_thread_id = $Scope.source_thread_id
    source_window_id = $Scope.source_window_id
    source_workspace_id = $Scope.source_workspace_id
    project_path = $Scope.project_path
    session_id = $SessionId
    saved_path = $ResolvedSavedPath
    saved_at = (Get-Date).ToString('o')
    save_method = $SaveMethod
  }
  try {
    [System.IO.File]::WriteAllText(
      $TempPath,
      ($Index | ConvertTo-Json -Depth 4),
      [System.Text.UTF8Encoding]::new($false)
    )
    Move-Item -LiteralPath $TempPath -Destination $IndexPath -Force
  } finally {
    if (Test-Path -LiteralPath $TempPath) {
      Remove-Item -LiteralPath $TempPath -Force
    }
  }
  return $IndexPath
}

function Write-SaveResult([string]$SavedPath, [string]$SaveMethod) {
  $IndexPath = Write-WindowHandoffIndex $SavedPath $SaveMethod
  Write-Host "Saved Codex session: $SavedPath"
  Write-Host "SOURCE_WINDOW_ID=$WindowId"
  Write-Host "WINDOW_INDEX=$IndexPath"
  Write-Host ('RESUME_COMMAND=이 창구에서 "다음 세션 이어서"라고 하면 인덱스 "{0}"만 사용. 다른 활성 세션을 추정하지 마.' -f $IndexPath)
}

if ($DryRun) {
  Write-Output "WINDOW_SCOPE_JSON=$ScopeJson"
  Write-Output "WINDOW_INDEX_DIR=$HandoffIndexDir"
  Write-Output 'DRY_RUN=1'
  exit 0
}

$SavedApiPath = ''
try {
  $Response = Invoke-RestMethod `
    -Uri "$BrainUrl/api/session/save" `
    -Method Post `
    -ContentType 'application/json; charset=utf-8' `
    -Body $Payload `
    -TimeoutSec 8

  if ([string]::IsNullOrWhiteSpace([string]$Response.path)) {
    throw 'Brain API response did not include a saved handoff path.'
  }
  $SavedApiPath = [string]$Response.path
} catch {
  Write-Warning "Brain API save failed. Falling back to direct Obsidian file write. $($_.Exception.Message)"
}

if ($SavedApiPath) {
  Write-SaveResult $SavedApiPath 'brain_api'
  exit 0
}

$SessionsDir = Join-Path $VaultPath 'sessions'
if (!(Test-Path -LiteralPath $SessionsDir)) {
  New-Item -ItemType Directory -Path $SessionsDir | Out-Null
}

$Now = Get-Date
$DateStr = $Now.ToString('yyyy-MM-dd')
$TimeStr = $Now.ToString('HH-mm-ss-fff')
$SafeSessionId = $SessionId -replace '[\\/:*?"<>|]', '-'
$SafeWindowId = ($WindowId -replace '[\\/:*?"<>|]', '-')
if ($SafeWindowId.Length -gt 12) { $SafeWindowId = $SafeWindowId.Substring(0, 12) }
$FilePath = Join-Path $SessionsDir "$DateStr-$TimeStr-$SafeWindowId-$SafeSessionId-codex.md"

$Content = @"
# Codex session memory - $($Now.ToString('yyyy-MM-dd HH:mm:ss'))

## Agent summary
$ScopedSummary

## User note
$ScopedUserNote

---
Session ID: $SessionId
Saved at: $($Now.ToString('o'))
Save method: Codex fallback direct write
"@

[System.IO.File]::WriteAllText($FilePath, $Content, [System.Text.UTF8Encoding]::new($false))
Write-SaveResult $FilePath 'fallback_direct_write'
