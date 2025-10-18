Write-Host "========================================" -ForegroundColor Cyan
Write-Host "    AI Video Generator - No Auto Polling" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Khoi dong server KHONG co auto polling" -ForegroundColor Yellow
Write-Host ""

$env:AUTO_BATCH_POLL = "false"

Write-Host "Cau hinh:" -ForegroundColor Green
Write-Host "- Auto polling: $env:AUTO_BATCH_POLL" -ForegroundColor White
Write-Host "- Server se khong tu dong kiem tra video" -ForegroundColor White
Write-Host ""

node server.js

Read-Host "Nhan Enter de thoat"
