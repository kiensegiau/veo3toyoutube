const fs = require('fs');
const { exec } = require('child_process');

console.log('🎯 Hệ thống quản lý cookies tự động - Tối ưu');
console.log('==========================================');

// Menu chính
function showMenu() {
    console.log('\n📋 MENU CHÍNH:');
    console.log('1. 🔄 Chạy hệ thống tự động làm mới token');
    console.log('2. 🍪 Cập nhật cookies từ file JSON');
    console.log('3. 🔍 Kiểm tra trạng thái token hiện tại');
    console.log('4. 🚀 Khởi động server');
    console.log('5. 🛑 Dừng tất cả processes');
    console.log('6. ❌ Thoát');
    console.log('\nChọn một tùy chọn (1-6):');
}

// Chạy hệ thống tự động
function startAutoSystem() {
    console.log('\n🚀 Đang khởi động hệ thống tự động...');
    exec('node auto-refresh.js', (error, stdout, stderr) => {
        if (error) {
            console.error('❌ Lỗi:', error);
        }
        console.log(stdout);
    });
}

// Cập nhật cookies từ file JSON
function updateCookies() {
    console.log('\n🔄 Đang cập nhật cookies từ file JSON...');
    
    try {
        const cookiesData = JSON.parse(fs.readFileSync('cookies.json', 'utf8'));
        const labsCookies = cookiesData.filter(cookie => 
            cookie.domain === 'labs.google' || 
            cookie.domain === '.labs.google'
        );
        
        const cookieString = labsCookies.map(cookie => 
            `${cookie.name}=${cookie.value}`
        ).join(';');
        
        console.log('🍪 Đã lấy được', labsCookies.length, 'cookies từ labs.google');
        
        const storageData = JSON.parse(fs.readFileSync('server-storage.json', 'utf8'));
        storageData.currentCookies = cookieString;
        storageData.lastUpdated = new Date().toISOString();
        
        fs.writeFileSync('server-storage.json', JSON.stringify(storageData, null, 2));
        console.log('✅ Đã cập nhật cookies vào server-storage.json');
        
        // Restart server
        console.log('🔄 Đang restart server...');
        exec('taskkill /F /IM node.exe', (error) => {
            setTimeout(() => {
                exec('node server.js', (error, stdout, stderr) => {
                    if (error) {
                        console.error('❌ Lỗi khi start server:', error);
                        return;
                    }
                    console.log('🚀 Server đã được restart!');
                });
            }, 2000);
        });
        
    } catch (error) {
        console.error('❌ Lỗi:', error.message);
    }
}

// Kiểm tra trạng thái token
function checkTokenStatus() {
    console.log('\n🔍 Đang kiểm tra trạng thái token...');
    exec('curl -s http://localhost:3000/api/token-status', (error, stdout, stderr) => {
        if (error) {
            console.log('❌ Server không hoạt động hoặc không thể kết nối');
        } else {
            try {
                const data = JSON.parse(stdout);
                if (data.success) {
                    console.log('✅ Token đang hoạt động');
                    console.log(`⏰ Còn ${data.timeUntilExpiryMinutes} phút`);
                    console.log(`🍪 Có cookies: ${data.hasCookies ? 'Có' : 'Không'}`);
                } else {
                    console.log('❌ Token không hoạt động');
                }
            } catch (e) {
                console.log('📄 Response:', stdout);
            }
        }
    });
}

// Khởi động server
function startServer() {
    console.log('\n🚀 Đang khởi động server...');
    exec('node server.js', (error, stdout, stderr) => {
        if (error) {
            console.error('❌ Lỗi:', error);
        }
        console.log(stdout);
    });
}

// Dừng tất cả processes
function stopAll() {
    console.log('\n🛑 Đang dừng tất cả processes...');
    exec('taskkill /F /IM node.exe', (error) => {
        if (error) {
            console.log('⚠️ Không tìm thấy process node.exe');
        } else {
            console.log('✅ Đã dừng tất cả processes');
        }
    });
}

// Xử lý input
function handleInput(input) {
    const choice = input.trim();
    
    switch (choice) {
        case '1':
            startAutoSystem();
            break;
        case '2':
            updateCookies();
            break;
        case '3':
            checkTokenStatus();
            break;
        case '4':
            startServer();
            break;
        case '5':
            stopAll();
            break;
        case '6':
            console.log('\n👋 Tạm biệt!');
            process.exit(0);
            break;
        default:
            console.log('❌ Lựa chọn không hợp lệ. Vui lòng chọn 1-6.');
    }
    
    setTimeout(() => {
        showMenu();
    }, 2000);
}

// Khởi động
console.log('🎯 Hệ thống đã sẵn sàng!');
console.log('📋 Chỉ cần lấy cookies 1 lần từ trình duyệt, hệ thống sẽ tự động làm mới token');
showMenu();

// Lắng nghe input
process.stdin.on('data', handleInput);
