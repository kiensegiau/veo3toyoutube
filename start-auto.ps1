# PowerShell script để chạy hệ thống tự động
Write-Host "🚀 Khởi động hệ thống tự động làm mới token..." -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Green

function Start-AutoSystem {
    Write-Host "📅 $(Get-Date) - Khởi động hệ thống" -ForegroundColor Yellow
    
    try {
        # Chạy hệ thống tự động
        node auto-server.js
    }
    catch {
        Write-Host "❌ Lỗi: $($_.Exception.Message)" -ForegroundColor Red
    }
    
    Write-Host "⚠️ Hệ thống đã dừng, đang khởi động lại..." -ForegroundColor Yellow
    Start-Sleep -Seconds 5
    Start-AutoSystem
}

# Khởi động hệ thống
Start-AutoSystem
