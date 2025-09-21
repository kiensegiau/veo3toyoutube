const fs = require('fs');
const { exec } = require('child_process');

console.log('🎯 Hệ thống tự động làm mới token - Tối ưu');
console.log('==========================================');

// Cấu hình
const COOKIES_FILE = 'cookies.json';
const STORAGE_FILE = 'server-storage.json';
const SERVER_FILE = 'server.js';
const REFRESH_INTERVAL = 30 * 60 * 1000; // 30 phút
const TOKEN_EXPIRY_BUFFER = 15 * 60 * 1000; // 15 phút trước khi hết hạn

let isRefreshing = false;
let refreshInterval = null;

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

// Function để khởi động server nếu chưa chạy
function ensureServerRunning() {
    return new Promise((resolve) => {
        fetch('http://localhost:3000/api/token-status')
            .then(response => {
                if (response.ok) {
                    console.log('✅ Server đang chạy');
                    resolve(true);
                } else {
                    throw new Error('Server not running');
                }
            })
            .catch(() => {
                console.log('🔄 Khởi động server...');
                exec(`node ${SERVER_FILE}`, (error, stdout, stderr) => {
                    if (error) {
                        console.error('❌ Lỗi khởi động server:', error);
                        resolve(false);
                    } else {
                        console.log('✅ Server đã được khởi động');
                        setTimeout(() => resolve(true), 3000); // Đợi 3 giây
                    }
                });
            });
    });
}

// Function chính để chạy hệ thống
async function startAutoRefreshSystem() {
    console.log('🚀 Khởi động hệ thống tự động làm mới token...');
    
    // Đảm bảo server đang chạy
    const serverRunning = await ensureServerRunning();
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
}

// Xử lý tín hiệu dừng
process.on('SIGINT', () => {
    console.log('\n🛑 Đang dừng hệ thống tự động...');
    if (refreshInterval) {
        clearInterval(refreshInterval);
    }
    console.log('✅ Hệ thống đã được dừng');
    process.exit(0);
});

// Khởi động hệ thống
startAutoRefreshSystem().catch(error => {
    console.error('❌ Lỗi khởi động hệ thống:', error);
    process.exit(1);
});
