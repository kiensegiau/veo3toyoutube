const fs = require('fs');
const { exec, spawn } = require('child_process');

console.log('🚀 Hệ thống tự động khởi động và chạy liên tục');
console.log('==============================================');

// Cấu hình
const COOKIES_FILE = 'cookies.json';
const STORAGE_FILE = 'server-storage.json';
const SERVER_FILE = 'server.js';
const REFRESH_INTERVAL = 30 * 60 * 1000; // 30 phút
const TOKEN_EXPIRY_BUFFER = 15 * 60 * 1000; // 15 phút trước khi hết hạn

let isRefreshing = false;
let refreshInterval = null;
let serverProcess = null;
let autoRefreshProcess = null;

// Function để lấy cookies từ file JSON
function getCookiesFromFile() {
    try {
        const cookiesData = JSON.parse(fs.readFileSync(COOKIES_FILE, 'utf8'));
        const labsCookies = cookiesData.filter(cookie => 
            cookie.domain === 'labs.google' || 
            cookie.domain === '.labs.google'
        );
        
        return labsCookies.map(cookie => `${cookie.name}=${cookie.value}`).join(';');
    } catch (error) {
        console.error('❌ Lỗi đọc file cookies.json:', error.message);
        return null;
    }
}

// Function để cập nhật cookies.json với cookies mới
function updateCookiesJsonFile(cookieString) {
    try {
        // Đọc file cookies.json hiện tại
        let cookiesData = [];
        if (fs.existsSync(COOKIES_FILE)) {
            const fileContent = fs.readFileSync(COOKIES_FILE, 'utf8');
            cookiesData = JSON.parse(fileContent);
        }
        
        // Parse cookie string thành array
        const cookiePairs = cookieString.split(';');
        const newCookies = cookiePairs.map(pair => {
            const [name, value] = pair.trim().split('=');
            return {
                domain: "labs.google",
                name: name,
                value: value,
                expirationDate: Date.now() + (24 * 60 * 60 * 1000), // 24 giờ
                hostOnly: true,
                httpOnly: false,
                path: "/",
                sameSite: "lax",
                secure: true,
                session: false,
                storeId: "0"
            };
        });
        
        // Lọc bỏ cookies cũ từ labs.google và thêm cookies mới
        const filteredCookies = cookiesData.filter(cookie => 
            !cookie.domain.includes('labs.google')
        );
        
        const updatedCookies = [...filteredCookies, ...newCookies];
        
        // Ghi lại file cookies.json
        fs.writeFileSync(COOKIES_FILE, JSON.stringify(updatedCookies, null, 2));
        console.log('🍪 Đã cập nhật cookies.json với cookies mới');
        
        return true;
    } catch (error) {
        console.error('❌ Lỗi cập nhật cookies.json:', error.message);
        return false;
    }
}

// Function để làm mới token
async function refreshToken() {
    if (isRefreshing) {
        console.log('⏳ Đang làm mới token, bỏ qua lần này...');
        return false;
    }
    
    isRefreshing = true;
    console.log('🔄 Bắt đầu làm mới token...');
    
    try {
        const cookies = getCookiesFromFile();
        if (!cookies) {
            console.log('❌ Không thể lấy cookies từ file');
            return false;
        }
        
        console.log('🍪 Đã lấy cookies từ file cookies.json');
        
        // Gọi API để lấy token mới
        const response = await fetch('http://localhost:3000/api/get-new-token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ cookies: cookies }),
        });
        
        const data = await response.json();
        
        if (data.success) {
            console.log('✅ Token đã được làm mới thành công');
            console.log('🔑 Token mới:', data.authorization.substring(0, 50) + '...');
            
            // Cập nhật cookies.json với cookies mới
            if (updateCookiesJsonFile(cookies)) {
                console.log('✅ File cookies.json đã được cập nhật');
            }
            
            return true;
        } else {
            console.log('❌ Lỗi làm mới token:', data.message);
            return false;
        }
        
    } catch (error) {
        console.error('❌ Lỗi khi làm mới token:', error.message);
        return false;
    } finally {
        isRefreshing = false;
    }
}

// Function để kiểm tra trạng thái token
async function checkTokenStatus() {
    try {
        const response = await fetch('http://localhost:3000/api/token-status');
        const data = await response.json();
        
        if (data.success) {
            const timeUntilExpiry = data.timeUntilExpiryMinutes;
            console.log(`⏰ Token còn ${timeUntilExpiry} phút`);
            
            // Nếu token sắp hết hạn (dưới 15 phút), làm mới
            if (timeUntilExpiry < 15) {
                console.log('⚠️ Token sắp hết hạn, tự động làm mới...');
                await refreshToken();
            }
            
            return data;
        } else {
            console.log('❌ Không thể kiểm tra trạng thái token');
            return null;
        }
    } catch (error) {
        console.error('❌ Lỗi kiểm tra trạng thái token:', error.message);
        return null;
    }
}

// Function để dừng tất cả processes trước khi khởi động
function killAllNodeProcesses() {
    return new Promise((resolve) => {
        console.log('🛑 Đang dừng tất cả processes Node.js...');
        exec('taskkill /F /IM node.exe', (error) => {
            if (error) {
                console.log('⚠️ Không tìm thấy process node.exe hoặc đã được dừng');
            } else {
                console.log('✅ Đã dừng tất cả processes Node.js');
            }
            setTimeout(() => resolve(), 2000); // Đợi 2 giây
        });
    });
}

// Function để khởi động server
function startServer() {
    return new Promise(async (resolve) => {
        // Dừng tất cả processes trước khi khởi động
        await killAllNodeProcesses();
        
        console.log('🚀 Đang khởi động server...');
        
        serverProcess = spawn('node', [SERVER_FILE], {
            stdio: 'pipe',
            detached: false
        });
        
        serverProcess.stdout.on('data', (data) => {
            const output = data.toString();
            console.log('📝 Server:', output.trim());
            
            // Kiểm tra nếu server đã khởi động thành công
            if (output.includes('Server đang chạy tại http://localhost:3000')) {
                console.log('✅ Server đã khởi động thành công');
                setTimeout(() => resolve(true), 3000); // Đợi 3 giây
            }
        });
        
        serverProcess.stderr.on('data', (data) => {
            const errorOutput = data.toString();
            console.error('❌ Server error:', errorOutput.trim());
            
            // Nếu lỗi port đã được sử dụng, dừng tất cả processes và thử lại
            if (errorOutput.includes('EADDRINUSE')) {
                console.log('⚠️ Port 3000 đã được sử dụng, đang dừng tất cả processes...');
                killAllNodeProcesses().then(() => {
                    console.log('🔄 Thử khởi động lại server...');
                    setTimeout(() => startServer(), 3000);
                });
            }
        });
        
        serverProcess.on('close', (code) => {
            console.log(`⚠️ Server process exited with code ${code}`);
            // Tự động khởi động lại server sau 5 giây
            setTimeout(() => {
                console.log('🔄 Tự động khởi động lại server...');
                startServer();
            }, 5000);
        });
        
        serverProcess.on('error', (error) => {
            console.error('❌ Lỗi khởi động server:', error);
            resolve(false);
        });
    });
}

// Function để dừng server
function stopServer() {
    if (serverProcess) {
        console.log('🛑 Đang dừng server...');
        serverProcess.kill();
        serverProcess = null;
    }
}

// Function chính để chạy hệ thống
async function startAutoRefreshSystem() {
    console.log('🚀 Khởi động hệ thống tự động làm mới token...');
    
    // Khởi động server
    const serverRunning = await startServer();
    if (!serverRunning) {
        console.error('❌ Không thể khởi động server');
        return;
    }
    
    // Kiểm tra trạng thái token ban đầu
    console.log('🔍 Kiểm tra trạng thái token ban đầu...');
    await checkTokenStatus();
    
    // Thiết lập interval để kiểm tra định kỳ
    refreshInterval = setInterval(async () => {
        console.log('\n🔄 Kiểm tra định kỳ...');
        await checkTokenStatus();
    }, REFRESH_INTERVAL);
    
    console.log(`⏰ Hệ thống sẽ kiểm tra mỗi ${REFRESH_INTERVAL / 60000} phút`);
    console.log('🎯 Hệ thống tự động đã sẵn sàng!');
    console.log('📋 File cookies.json sẽ được tự động cập nhật để tránh hết hạn');
    console.log('🔄 Server sẽ tự động khởi động lại nếu bị crash');
}

// Xử lý tín hiệu dừng
process.on('SIGINT', () => {
    console.log('\n🛑 Đang dừng hệ thống tự động...');
    if (refreshInterval) {
        clearInterval(refreshInterval);
    }
    stopServer();
    console.log('✅ Hệ thống đã được dừng');
    process.exit(0);
});

// Xử lý lỗi không bắt được
process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error);
    // Không thoát, tiếp tục chạy
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
    // Không thoát, tiếp tục chạy
});

// Khởi động hệ thống
startAutoRefreshSystem().catch(error => {
    console.error('❌ Lỗi khởi động hệ thống:', error);
    // Tự động khởi động lại sau 10 giây
    setTimeout(() => {
        console.log('🔄 Tự động khởi động lại hệ thống...');
        startAutoRefreshSystem();
    }, 10000);
});
