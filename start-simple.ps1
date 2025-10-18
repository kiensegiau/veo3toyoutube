Write-Host "========================================" -ForegroundColor Cyan
Write-Host "    AI Video Generator - Simple Start" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Starting server with quiet mode..." -ForegroundColor Yellow
Write-Host ""

$env:AUTO_BATCH_QUIET_MODE = "true"
$env:AUTO_BATCH_INTERVAL_MS = "30000"

Write-Host "Configuration:" -ForegroundColor Green
Write-Host "- Quiet mode: $env:AUTO_BATCH_QUIET_MODE" -ForegroundColor White
Write-Host "- Polling interval: $env:AUTO_BATCH_INTERVAL_MS ms" -ForegroundColor White
Write-Host ""

node server.js

Read-Host "Press Enter to exit"
