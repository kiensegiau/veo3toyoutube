const fs = require('fs');
const { exec } = require('child_process');

console.log('👀 Đang theo dõi file cookies.json để tự động cập nhật...');

let lastModified = 0;
let isUpdating = false;

function checkFileChange() {
    try {
        const stats = fs.statSync('cookies.json');
        const currentModified = stats.mtime.getTime();
        
        if (currentModified !== lastModified && !isUpdating) {
            console.log('📁 Phát hiện file cookies.json đã thay đổi!');
            lastModified = currentModified;
            updateCookies();
        }
    } catch (error) {
        console.log('⚠️ Không thể đọc file cookies.json:', error.message);
    }
}

function updateCookies() {
    if (isUpdating) return;
    isUpdating = true;
    
    console.log('🔄 Tự động cập nhật cookies...');
    
    try {
        // Đọc cookies từ file JSON
        const cookiesData = JSON.parse(fs.readFileSync('cookies.json', 'utf8'));
        
        // Lọc chỉ cookies từ labs.google domain
        const labsCookies = cookiesData.filter(cookie => 
            cookie.domain === 'labs.google' || 
            cookie.domain === '.labs.google'
        );
        
        // Convert thành chuỗi cookies
        const cookieString = labsCookies.map(cookie => 
            `${cookie.name}=${cookie.value}`
        ).join(';');
        
        console.log('🍪 Đã lấy được', labsCookies.length, 'cookies từ labs.google');
        
        // Cập nhật vào server-storage.json
        const storageData = JSON.parse(fs.readFileSync('server-storage.json', 'utf8'));
        storageData.currentCookies = cookieString;
        storageData.lastUpdated = new Date().toISOString();
        
        fs.writeFileSync('server-storage.json', JSON.stringify(storageData, null, 2));
        
        console.log('✅ Đã cập nhật cookies vào server-storage.json');
        
        // Restart server
        console.log('🔄 Đang restart server...');
        exec('taskkill /F /IM node.exe', (error) => {
            if (error) {
                console.log('⚠️ Không tìm thấy process node.exe để kill');
            }
            
            setTimeout(() => {
                exec('node server.js', (error, stdout, stderr) => {
                    if (error) {
                        console.error('❌ Lỗi khi start server:', error);
                        return;
                    }
                    console.log('🚀 Server đã được restart với cookies mới!');
                    console.log('📝 Hệ thống tự động hoạt động hoàn hảo!');
                    isUpdating = false;
                });
            }, 2000);
        });
        
    } catch (error) {
        console.error('❌ Lỗi khi cập nhật cookies:', error.message);
        isUpdating = false;
    }
}

// Khởi tạo
try {
    const stats = fs.statSync('cookies.json');
    lastModified = stats.mtime.getTime();
    console.log('✅ Đã khởi tạo theo dõi file cookies.json');
} catch (error) {
    console.log('⚠️ Không tìm thấy file cookies.json');
}

// Theo dõi file mỗi 2 giây
setInterval(checkFileChange, 2000);

console.log('🎯 Hệ thống tự động đã sẵn sàng!');
console.log('📋 Chỉ cần cập nhật file cookies.json và hệ thống sẽ tự động restart server');
