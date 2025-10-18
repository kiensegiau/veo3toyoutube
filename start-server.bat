@echo off
echo ========================================
echo    AI Video Generator Server
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
echo 📦 Cài đặt dependencies...
npm install
if %errorlevel% neq 0 (
    echo ❌ Lỗi cài đặt dependencies!
    pause
    exit /b 1
)

echo.
echo 🚀 Khởi động server với nodemon (auto restart)...
echo Server sẽ chạy tại: http://localhost:8888
echo.
echo 📝 Nodemon sẽ tự động restart khi có thay đổi code
echo Nhấn Ctrl+C để dừng server
echo.

npm run dev-server

pause
