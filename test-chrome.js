const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

async function testChrome() {
    console.log('🔍 Kiểm tra Chrome...');
    
    // Danh sách đường dẫn Chrome có thể
    const chromePaths = [
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        path.join(process.env.USERPROFILE, 'AppData\\Local\\Google\\Chrome\\Application\\chrome.exe'),
        'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
        'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
    ];
    
    let chromePath = null;
    
    // Tìm Chrome executable
    for (const p of chromePaths) {
        if (fs.existsSync(p)) {
            chromePath = p;
            console.log(`✅ Tìm thấy Chrome: ${p}`);
            break;
        }
    }
    
    if (!chromePath) {
        console.log('❌ Không tìm thấy Chrome. Vui lòng cài đặt Chrome hoặc Edge.');
        return false;
    }
    
    try {
        console.log('🚀 Thử khởi động Chrome...');
        
        const browser = await puppeteer.launch({
            headless: false,
            executablePath: chromePath,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--no-first-run',
                '--no-default-browser-check',
                '--disable-popup-blocking',
                '--disable-notifications',
                '--disable-infobars',
                '--disable-translate',
                '--allow-running-insecure-content',
                '--password-store=basic',
                '--disable-blink-features=AutomationControlled',
                '--window-size=1920,1080'
            ],
            defaultViewport: null,
            ignoreDefaultArgs: ['--enable-automation'],
            timeout: 30000
        });
        
        const page = await browser.newPage();
        await page.goto('https://www.google.com', { waitUntil: 'networkidle2' });
        
        console.log('✅ Chrome hoạt động bình thường!');
        console.log('🌐 Đã mở Google.com');
        console.log('📝 Đóng browser để tiếp tục...');
        
        // Chờ user đóng browser
        return new Promise((resolve) => {
            browser.on('disconnected', () => {
                console.log('✅ Browser đã đóng');
                resolve(true);
            });
        });
        
    } catch (error) {
        console.error('❌ Lỗi khởi động Chrome:', error.message);
        return false;
    }
}

// Chạy test
testChrome().then(success => {
    if (success) {
        console.log('🎉 Test Chrome thành công!');
    } else {
        console.log('❌ Test Chrome thất bại!');
    }
    process.exit(0);
});
