param(
  [int]$Port = 3100
)

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
$Launcher = Join-Path $PSScriptRoot 'launch-agent-room.ps1'
$Desktop = [Environment]::GetFolderPath('Desktop')
$ShortcutPath = Join-Path $Desktop 'JH Agent Room.lnk'

if (!(Test-Path $Launcher)) {
  throw "Launcher not found: $Launcher"
}

$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($ShortcutPath)
$shortcut.TargetPath = 'powershell.exe'
$shortcut.Arguments = "-NoProfile -ExecutionPolicy Bypass -File `"$Launcher`" -Port $Port"
$shortcut.WorkingDirectory = $Root
$shortcut.WindowStyle = 7
$shortcut.Description = 'Launch JH Agent Room desktop console'
$shortcut.Save()

Write-Host "Created desktop shortcut: $ShortcutPath"
