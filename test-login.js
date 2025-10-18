const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

async function testLogin() {
    console.log('🔍 Test đăng nhập Google với cấu hình stealth...');
    
    // Tìm Chrome
    const chromePaths = [
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        path.join(process.env.USERPROFILE, 'AppData\\Local\\Google\\Chrome\\Application\\chrome.exe'),
        'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
    ];
    
    let chromePath = null;
    for (const p of chromePaths) {
        if (fs.existsSync(p)) {
            chromePath = p;
            break;
        }
    }
    
    if (!chromePath) {
        console.log('❌ Không tìm thấy Chrome');
        return;
    }
    
    const profilePath = path.join(__dirname, 'chrome-profile', 'TestLogin');
    if (!fs.existsSync(profilePath)) {
        fs.mkdirSync(profilePath, { recursive: true });
    }
    
    try {
        console.log('🚀 Khởi động Chrome...');
        
        const browser = await puppeteer.launch({
            headless: false,
            executablePath: chromePath,
            args: [
                `--user-data-dir=${profilePath}`,
                '--profile-directory=Default',
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
                '--exclude-switches=enable-automation',
                '--disable-features=VizDisplayCompositor',
                '--disable-web-security',
                '--disable-features=IsolateOrigins,site-per-process',
                '--window-size=1920,1080',
                '--start-maximized'
            ],
            defaultViewport: null,
            ignoreDefaultArgs: ['--enable-automation'],
            timeout: 30000
        });
        
        const page = await browser.newPage();
        
        // Stealth settings
        await page.evaluateOnNewDocument(() => {
            Object.defineProperty(navigator, 'webdriver', {
                get: () => undefined,
            });
            
            Object.defineProperty(navigator, 'plugins', {
                get: () => [1, 2, 3, 4, 5],
            });
            
            Object.defineProperty(navigator, 'languages', {
                get: () => ['vi-VN', 'vi', 'en-US', 'en'],
            });
            
            window.chrome = {
                runtime: {},
                loadTimes: function() {},
                csi: function() {},
                app: {}
            };
            
            delete window.cdc_adoQpoasnfa76pfcZLmcfl_Array;
            delete window.cdc_adoQpoasnfa76pfcZLmcfl_Promise;
            delete window.cdc_adoQpoasnfa76pfcZLmcfl_Symbol;
        });
        
        await page.setExtraHTTPHeaders({
            'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7',
            'Accept-Encoding': 'gzip, deflate, br',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
            'Upgrade-Insecure-Requests': '1',
            'Cache-Control': 'max-age=0'
        });
        
        console.log('🌐 Điều hướng đến Google...');
        await page.goto('https://accounts.google.com', { waitUntil: 'networkidle2' });
        
        console.log('✅ Chrome đã mở Google Accounts');
        console.log('📝 Thử đăng nhập thủ công...');
        console.log('🔐 Nếu bị chặn, thử các bước sau:');
        console.log('1. Đợi 30 giây trước khi đăng nhập');
        console.log('2. Sử dụng 2FA nếu có');
        console.log('3. Thử đăng nhập từ tab ẩn danh trước');
        console.log('4. Đóng browser và thử lại');
        
        // Chờ user đóng browser
        return new Promise((resolve) => {
            browser.on('disconnected', () => {
                console.log('✅ Browser đã đóng');
                resolve(true);
            });
        });
        
    } catch (error) {
        console.error('❌ Lỗi:', error.message);
        return false;
    }
}

testLogin().then(success => {
    if (success) {
        console.log('🎉 Test hoàn thành!');
    } else {
        console.log('❌ Test thất bại!');
    }
    process.exit(0);
});
