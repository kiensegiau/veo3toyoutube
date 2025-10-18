Write-Host "========================================" -ForegroundColor Cyan
Write-Host "    AI Video Generator - Development" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "🔍 Kiểm tra Node.js..." -ForegroundColor Yellow
$nodeVersion = node --version
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Node.js chưa được cài đặt!" -ForegroundColor Red
    Write-Host "Vui lòng cài đặt Node.js từ: https://nodejs.org/" -ForegroundColor Red
    Read-Host "Nhấn Enter để thoát"
    exit 1
}

Write-Host "✅ Node.js version: $nodeVersion" -ForegroundColor Green
Write-Host ""

Write-Host "📦 Cài đặt dependencies (bao gồm nodemon)..." -ForegroundColor Yellow
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Lỗi cài đặt dependencies!" -ForegroundColor Red
    Read-Host "Nhấn Enter để thoát"
    exit 1
}

Write-Host ""
Write-Host "🚀 Khởi động server với nodemon..." -ForegroundColor Yellow
Write-Host "Server sẽ chạy tại: http://localhost:8888" -ForegroundColor Green
Write-Host ""
Write-Host "📝 Nodemon sẽ tự động restart khi có thay đổi code" -ForegroundColor Cyan
Write-Host "🔄 Theo dõi: server.js, youtube-upload.js, chrome-profile-*.js, public/**" -ForegroundColor Cyan
Write-Host ""
Write-Host "Nhấn Ctrl+C để dừng server" -ForegroundColor Yellow
Write-Host ""

npm run dev-server

Read-Host "Nhấn Enter để thoát"
