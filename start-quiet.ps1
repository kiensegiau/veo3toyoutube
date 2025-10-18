Write-Host "========================================" -ForegroundColor Cyan
Write-Host "    AI Video Generator - Quiet Mode" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Khoi dong server voi che do quiet (it log hon)" -ForegroundColor Yellow
Write-Host ""

$env:AUTO_BATCH_QUIET_MODE = "true"
$env:AUTO_BATCH_INTERVAL_MS = "30000"

Write-Host "Cau hinh:" -ForegroundColor Green
Write-Host "- Quiet mode: $env:AUTO_BATCH_QUIET_MODE" -ForegroundColor White
Write-Host "- Polling interval: $env:AUTO_BATCH_INTERVAL_MS ms" -ForegroundColor White
Write-Host ""

node server.js

Read-Host "Nhan Enter de thoat"
