@echo off
echo 🚀 Hệ thống tự động chạy liên tục
echo ================================

:start
echo 📅 %date% %time% - Khởi động hệ thống
echo 🛑 Đang dừng tất cả processes...
taskkill /F /IM node.exe >nul 2>&1
timeout /t 3 /nobreak >nul

echo 🚀 Đang khởi động server...
start /B node server.js
timeout /t 5 /nobreak >nul

echo 🔄 Đang khởi động hệ thống tự động làm mới token...
start /B node auto-refresh.js

echo ✅ Hệ thống đã được khởi động
echo 📋 Server: http://localhost:3000
echo 🔄 Hệ thống sẽ tự động làm mới token mỗi 30 phút
echo ⏹️ Nhấn Ctrl+C để dừng

:monitor
timeout /t 60 /nobreak >nul
tasklist /FI "IMAGENAME eq node.exe" | find /I "node.exe" >nul
if errorlevel 1 (
    echo ⚠️ Server đã dừng, đang khởi động lại...
    goto start
)
goto monitor
