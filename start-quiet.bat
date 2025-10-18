@echo off
echo ========================================
echo    AI Video Generator - Quiet Mode
echo ========================================
echo.

echo 🔇 Khởi động server với chế độ quiet (ít log hơn)
echo.

set AUTO_BATCH_QUIET_MODE=true
set AUTO_BATCH_INTERVAL_MS=30000

echo 📝 Cấu hình:
echo - Quiet mode: %AUTO_BATCH_QUIET_MODE%
echo - Polling interval: %AUTO_BATCH_INTERVAL_MS% ms
echo.

node server.js

pause
