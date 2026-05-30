# Деплой Cloud Function для push-уведомлений чата
# Запуск: правый клик → «Выполнить с PowerShell» или в терминале:
#   cd tracker-mobile
#   powershell -ExecutionPolicy Bypass -File scripts/deploy-functions.ps1

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..

Write-Host "`n=== Firebase: вход (откроется браузер) ===`n" -ForegroundColor Cyan
npx firebase login --reauth
if ($LASTEXITCODE -ne 0) { exit 1 }

Write-Host "`n=== Деплой функции onClanMessageCreated ===`n" -ForegroundColor Cyan
Set-Location functions
if (-not (Test-Path node_modules)) {
  npm install
}
Set-Location ..

npx firebase deploy --only functions --project levelup-ff95c
if ($LASTEXITCODE -ne 0) { exit 1 }

Write-Host "`nГотово! Push при новых сообщениях в чате клана включён.`n" -ForegroundColor Green
