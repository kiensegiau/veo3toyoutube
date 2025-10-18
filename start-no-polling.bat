@echo off
echo ========================================
echo    AI Video Generator - No Auto Polling
echo ========================================
echo.

echo 🚫 Khởi động server KHÔNG có auto polling
echo.

set AUTO_BATCH_POLL=false

echo 📝 Cấu hình:
echo - Auto polling: %AUTO_BATCH_POLL%
echo - Server sẽ không tự động kiểm tra video
echo.

node server.js

pause
