@echo off
echo ========================================
echo    AI Video Generator - Development
echo ========================================
echo.

echo 🔍 Kiểm tra Node.js...
node --version
if %errorlevel% neq 0 (
    echo ❌ Node.js chưa được cài đặt!
    echo Vui lòng cài đặt Node.js từ: https://nodejs.org/
    pause
    exit /b 1
)

echo.
echo 📦 Cài đặt dependencies (bao gồm nodemon)...
npm install
if %errorlevel% neq 0 (
    echo ❌ Lỗi cài đặt dependencies!
    pause
    exit /b 1
)

echo.
echo 🚀 Khởi động server với nodemon...
echo Server sẽ chạy tại: http://localhost:8888
echo.
echo 📝 Nodemon sẽ tự động restart khi có thay đổi code
echo 🔄 Theo dõi: server.js, youtube-upload.js, chrome-profile-*.js, public/**
echo.
echo Nhấn Ctrl+C để dừng server
echo.

npm run dev-server

pause
