@echo off
title AI Video Generator Server
color 0A

echo ========================================
echo    🎬 AI Video Generator Server v2.0
echo    🚀 Google Labs Veo 3.1 + Auto Cookies
echo ========================================
echo.

echo 🔍 Kiểm tra Node.js...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Node.js chưa được cài đặt!
    echo 📥 Vui lòng cài đặt Node.js từ: https://nodejs.org/
    echo.
    pause
    exit /b 1
)
echo ✅ Node.js đã sẵn sàng

echo.
echo 📦 Cài đặt dependencies...
call npm install --silent
if %errorlevel% neq 0 (
    echo ❌ Lỗi cài đặt dependencies!
    pause
    exit /b 1
)
echo ✅ Dependencies đã sẵn sàng

echo.
echo 🚀 Khởi động AI Video Generator Server...
echo 🌐 Server: http://localhost:8888
echo 🎬 Veo 3.1: Tự động cookie management
echo 🔄 Auto restart: Bật
echo.
echo 📝 Nhấn Ctrl+C để dừng server
echo ========================================
echo.

call npm run dev

echo.
echo 👋 Server đã dừng
pause
