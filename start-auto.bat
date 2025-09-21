@echo off
echo 🚀 Khởi động hệ thống tự động làm mới token...
echo ================================================

:start
echo 📅 %date% %time% - Khởi động hệ thống
node auto-server.js

:restart
echo ⚠️ Hệ thống đã dừng, đang khởi động lại...
timeout /t 5 /nobreak > nul
goto start
