# Повторный деплой на Expo (обход ECONNRESET на Windows: IPv4 + несколько попыток)
$ErrorActionPreference = 'Stop'
Set-Location (Join-Path $PSScriptRoot '..')
$env:NODE_OPTIONS = '--dns-result-order=ipv4first'

Write-Host '>> export:web'
npm run export:web
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$max = 8
for ($i = 1; $i -le $max; $i++) {
  Write-Host ">> eas deploy --prod (attempt $i/$max)"
  npx eas-cli deploy --prod --non-interactive
  if ($LASTEXITCODE -eq 0) {
    Write-Host '>> OK: https://tracker-mobile.expo.app/'
    exit 0
  }
  $wait = [Math]::Min(120, 15 * $i)
  Write-Host ">> failed, wait ${wait}s..."
  Start-Sleep -Seconds $wait
}

Write-Host '>> EAS deploy failed. Try: npm run deploy:expo  (VPN off, mobile hotspot, PowerShell outside IDE).'
exit 1
