const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

class ContinuousRequestLogger {
    constructor(options = {}) {
        this.requests = [];
        this.browser = null;
        this.page = null;
        this.cookiesFile = options.cookiesFile || 'cookies.json';
        this.userDataDir = options.userDataDir || './chrome-user-data';
        this.stealthMode = options.stealthMode !== false;
        this.isRunning = false;
    }

    async init() {
        try {
            // Tạo thư mục user data nếu chưa có
            if (!fs.existsSync(this.userDataDir)) {
                fs.mkdirSync(this.userDataDir, { recursive: true });
            }

            // Khởi tạo browser với các options chống phát hiện bot
            this.browser = await puppeteer.launch({
                headless: false,
                executablePath: this.getChromePath(),
                userDataDir: this.userDataDir,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-accelerated-2d-canvas',
                    '--no-first-run',
                    '--no-zygote',
                    '--disable-gpu',
                    '--disable-blink-features=AutomationControlled',
                    '--disable-features=VizDisplayCompositor',
                    '--disable-web-security',
                    '--disable-features=TranslateUI',
                    '--disable-ipc-flooding-protection',
                    '--disable-renderer-backgrounding',
                    '--disable-backgrounding-occluded-windows',
                    '--disable-client-side-phishing-detection',
                    '--disable-sync',
                    '--disable-default-apps',
                    '--disable-extensions',
                    '--no-default-browser-check',
                    '--no-first-run',
                    '--disable-background-timer-throttling',
                    '--disable-backgrounding-occluded-windows',
                    '--disable-renderer-backgrounding'
                ]
            });

            this.page = await this.browser.newPage();
            
            // Cấu hình chống phát hiện bot
            if (this.stealthMode) {
                await this.setupStealthMode();
            }
            
            // Load cookies nếu có
            await this.loadCookies();
            
            // Bật request interception
            await this.page.setRequestInterception(true);
            
            // Lắng nghe tất cả requests
            this.setupRequestListeners();
            
            // Lắng nghe form submission
            this.setupFormListeners();
            
            console.log('✅ Continuous Request Logger đã khởi tạo thành công!');
            console.log('📝 Tất cả requests sẽ được lưu liên tục vào file requests.json');
            console.log('🍪 Session và cookies được lưu để tránh login lại');
            console.log('🥷 Stealth mode đã được kích hoạt');
            console.log('⏰ Script sẽ chạy liên tục - nhấn Ctrl+C để dừng');
            
        } catch (error) {
            console.error('❌ Lỗi khi khởi tạo:', error.message);
            throw error;
        }
    }

    getChromePath() {
        const possiblePaths = [
            'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
            'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
            'C:\\Users\\' + process.env.USERNAME + '\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe'
        ];

        for (const chromePath of possiblePaths) {
            if (fs.existsSync(chromePath)) {
                return chromePath;
            }
        }

        throw new Error('Không tìm thấy Chrome. Vui lòng cài đặt Google Chrome hoặc chỉ định đường dẫn thủ công.');
    }

    async setupStealthMode() {
        const userAgents = [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        ];

        const randomUserAgent = userAgents[Math.floor(Math.random() * userAgents.length)];
        await this.page.setUserAgent(randomUserAgent);
        
        const viewports = [
            { width: 1920, height: 1080 },
            { width: 1366, height: 768 },
            { width: 1440, height: 900 },
            { width: 1536, height: 864 },
            { width: 1280, height: 720 }
        ];
        const randomViewport = viewports[Math.floor(Math.random() * viewports.length)];
        await this.page.setViewport(randomViewport);

        await this.page.evaluateOnNewDocument(() => {
            Object.defineProperty(navigator, 'webdriver', {
                get: () => undefined,
            });

            Object.defineProperty(navigator, 'plugins', {
                get: () => [1, 2, 3, 4, 5],
            });

            Object.defineProperty(navigator, 'languages', {
                get: () => ['en-US', 'en'],
            });

            const originalQuery = window.navigator.permissions.query;
            window.navigator.permissions.query = (parameters) => (
                parameters.name === 'notifications' ?
                    Promise.resolve({ state: Notification.permission }) :
                    originalQuery(parameters)
            );

            window.chrome = {
                runtime: {},
                loadTimes: function() {},
                csi: function() {},
                app: {}
            };
        });

        await this.page.setExtraHTTPHeaders({
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
            'Upgrade-Insecure-Requests': '1',
            'Cache-Control': 'max-age=0'
        });

        console.log('🥷 Stealth mode đã được cấu hình');
    }

    async loadCookies() {
        try {
            if (fs.existsSync(this.cookiesFile)) {
                const cookiesData = JSON.parse(fs.readFileSync(this.cookiesFile, 'utf8'));
                if (cookiesData.cookies && cookiesData.cookies.length > 0) {
                    await this.page.setCookie(...cookiesData.cookies);
                    console.log(`🍪 Đã load ${cookiesData.cookies.length} cookies từ file`);
                }
            }
        } catch (error) {
            console.log('⚠️ Không thể load cookies:', error.message);
        }
    }

    async saveCookies() {
        try {
            const cookies = await this.page.cookies();
            const cookiesData = {
                timestamp: new Date().toISOString(),
                cookies: cookies
            };
            
            fs.writeFileSync(this.cookiesFile, JSON.stringify(cookiesData, null, 2), 'utf8');
            console.log(`💾 Đã lưu ${cookies.length} cookies vào file: ${this.cookiesFile}`);
        } catch (error) {
            console.error('❌ Lỗi khi lưu cookies:', error.message);
        }
    }

    async randomDelay(min = 1000, max = 3000) {
        const delay = Math.floor(Math.random() * (max - min + 1)) + min;
        await new Promise(resolve => setTimeout(resolve, delay));
    }

    setupRequestListeners() {
        this.page.on('request', (request) => {
            const requestData = {
                id: request._requestId,
                url: request.url(),
                method: request.method(),
                headers: request.headers(),
                postData: request.postData(),
                resourceType: request.resourceType(),
                timestamp: new Date().toISOString(),
                type: 'request'
            };

            this.requests.push(requestData);
            console.log(`📤 REQUEST: ${request.method()} ${request.url()}`);
            
            request.continue();
        });

        this.page.on('response', (response) => {
            const responseData = {
                id: response.request()._requestId,
                url: response.url(),
                status: response.status(),
                statusText: response.statusText(),
                headers: response.headers(),
                timestamp: new Date().toISOString(),
                type: 'response'
            };

            this.requests.push(responseData);
            console.log(`📥 RESPONSE: ${response.status()} ${response.url()}`);
        });

        this.page.on('requestfailed', (request) => {
            const failedData = {
                id: request._requestId,
                url: request.url(),
                method: request.method(),
                errorText: request.failure().errorText,
                timestamp: new Date().toISOString(),
                type: 'failed'
            };

            this.requests.push(failedData);
            console.log(`❌ FAILED: ${request.method()} ${request.url()} - ${request.failure().errorText}`);
        });
    }

    setupFormListeners() {
        // Inject script để lắng nghe form submission
        this.page.evaluateOnNewDocument(() => {
            // Lắng nghe form submit
            document.addEventListener('submit', (event) => {
                const form = event.target;
                const formData = new FormData(form);
                const formObject = {};
                
                for (let [key, value] of formData.entries()) {
                    formObject[key] = value;
                }
                
                // Gửi thông tin form lên console
                console.log('🔍 FORM SUBMITTED:', {
                    action: form.action,
                    method: form.method,
                    data: formObject,
                    timestamp: new Date().toISOString()
                });
                
                // Dispatch custom event
                window.dispatchEvent(new CustomEvent('formSubmitted', {
                    detail: {
                        action: form.action,
                        method: form.method,
                        data: formObject,
                        timestamp: new Date().toISOString()
                    }
                }));
            });
        });

        // Lắng nghe custom event từ page
        this.page.on('console', (msg) => {
            if (msg.text().includes('FORM SUBMITTED:')) {
                console.log('📝 Form submission detected:', msg.text());
            }
        });
    }

    async navigateToUrl(url) {
        try {
            console.log(`🌐 Đang truy cập: ${url}`);
            
            await this.randomDelay(1000, 2000);
            
            await this.page.goto(url, { 
                waitUntil: 'networkidle2',
                timeout: 30000 
            });
            
            await this.randomDelay(2000, 4000);
            
            await this.saveCookies();
            
            console.log('✅ Đã tải trang thành công!');
        } catch (error) {
            console.error('❌ Lỗi khi tải trang:', error.message);
        }
    }

    async saveRequestsToFile(filename = 'requests.json') {
        try {
            // Tạo backup trước khi ghi file mới
            if (fs.existsSync(filename)) {
                const backupName = filename.replace('.json', `_backup_${Date.now()}.json`);
                fs.copyFileSync(filename, backupName);
                console.log(`📋 Đã tạo backup: ${backupName}`);
            }

            const data = {
                timestamp: new Date().toISOString(),
                totalRequests: this.requests.length,
                requests: this.requests
            };

            // Ghi file tạm thời trước
            const tempFile = filename + '.tmp';
            fs.writeFileSync(tempFile, JSON.stringify(data, null, 2), 'utf8');
            
            // Chỉ ghi đè file chính khi đã ghi thành công
            fs.renameSync(tempFile, filename);
            
            console.log(`💾 Đã lưu ${this.requests.length} requests vào file: ${filename}`);
        } catch (error) {
            console.error('❌ Lỗi khi lưu file:', error.message);
        }
    }

    async close() {
        if (this.browser) {
            await this.saveCookies();
            await this.browser.close();
            console.log('🔒 Đã đóng browser và lưu session');
        }
    }

    // Lưu requests theo định kỳ
    startAutoSave(intervalMs = 10000) {
        setInterval(() => {
            this.saveRequestsToFile();
        }, intervalMs);
        console.log(`⏰ Tự động lưu requests mỗi ${intervalMs/1000} giây`);
    }

    // Chạy liên tục
    async runContinuously() {
        this.isRunning = true;
        
        // Bắt đầu tự động lưu
        this.startAutoSave(10000);
        
        // Truy cập URL mặc định
        const url = process.argv[2] || 'https://www.google.com';
        await this.navigateToUrl(url);
        
        console.log('\n🔄 Script đang chạy liên tục...');
        console.log('💡 Bạn có thể tương tác với trang web, mọi request sẽ được lưu tự động');
        console.log('⏹️  Nhấn Ctrl+C để dừng script');
        
        // Xử lý tín hiệu dừng
        process.on('SIGINT', async () => {
            console.log('\n⏹️  Đang dừng script...');
            this.isRunning = false;
            await this.saveRequestsToFile();
            await this.close();
            process.exit(0);
        });
        
        // Chạy vô hạn
        while (this.isRunning) {
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }
}

// Hàm main
async function main() {
    const options = {
        stealthMode: true,
        cookiesFile: 'cookies.json',
        userDataDir: './chrome-user-data'
    };
    
    const logger = new ContinuousRequestLogger(options);
    
    try {
        await logger.init();
        await logger.runContinuously();
    } catch (error) {
        console.error('❌ Lỗi trong quá trình chạy:', error.message);
        await logger.close();
        process.exit(1);
    }
}

// Chạy script
if (require.main === module) {
    main().catch(console.error);
}

module.exports = ContinuousRequestLogger;
