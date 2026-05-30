# Ярлык LevelUp на рабочем столе — открывается как отдельное окно без панели браузера.
# Запуск: powershell -ExecutionPolicy Bypass -File scripts/create-desktop-shortcut.ps1

$AppUrl = "https://tracker-mobile.expo.app"
$ShortcutName = "LevelUp.lnk"
$Desktop = [Environment]::GetFolderPath("Desktop")
$ShortcutPath = Join-Path $Desktop $ShortcutName

$chrome = "${env:ProgramFiles}\Google\Chrome\Application\chrome.exe"
$chromeX86 = "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe"
$edge = "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe"
$edgeArm = "${env:ProgramFiles}\Microsoft\Edge\Application\msedge.exe"

$browser = $null
$args = "--app=$AppUrl"

foreach ($candidate in @($chrome, $chromeX86, $edge, $edgeArm)) {
  if ($candidate -and (Test-Path $candidate)) {
    $browser = $candidate
    break
  }
}

if (-not $browser) {
  Write-Host "Chrome or Edge not found. Open $AppUrl and use Install app from browser menu."
  exit 1
}

$wsh = New-Object -ComObject WScript.Shell
$sc = $wsh.CreateShortcut($ShortcutPath)
$sc.TargetPath = $browser
$sc.Arguments = $args
$sc.WorkingDirectory = Split-Path $browser
$sc.IconLocation = "$browser,0"
$sc.Description = "LevelUp tracker"
$sc.Save()

Write-Host "Done: $ShortcutPath"
Write-Host "Double-click opens LevelUp in app window (no browser toolbar)."
