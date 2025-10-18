const fs = require('fs');
const path = require('path');
const os = require('os');

/**
 * Module quản lý Chrome profile với cấu hình chống phát hiện bot
 */
class ChromeProfileManager {
    constructor() {
        this.defaultProfilePath = path.join(__dirname, 'chrome-profile');
        this.userAgents = this.getRealisticUserAgents();
        this.viewports = this.getRealisticViewports();
    }

    /**
     * Lấy danh sách User Agent thực tế từ các trình duyệt phổ biến
     */
    getRealisticUserAgents() {
        return [
            // Chrome trên Windows
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36',
            
            // Chrome trên macOS
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
            
            // Edge trên Windows
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36 Edg/119.0.0.0',
            
            // Chrome trên Linux
            'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36'
        ];
    }

    /**
     * Lấy danh sách viewport thực tế
     */
    getRealisticViewports() {
        return [
            { width: 1920, height: 1080 }, // Full HD
            { width: 1366, height: 768 },  // Laptop phổ biến
            { width: 1440, height: 900 },  // MacBook
            { width: 1536, height: 864 },  // Windows laptop
            { width: 1600, height: 900 },  // Wide laptop
            { width: 1280, height: 720 },  // HD
            { width: 2560, height: 1440 }  // 2K
        ];
    }

    /**
     * Tạo cấu hình Chrome sạch cho YouTube (không stealth)
     */
    getCleanLaunchOptions(options = {}) {
        const {
            profilePath = this.defaultProfilePath,
            headless = false,
            executablePath = null
        } = options;

        // Tạo profile path nếu chưa tồn tại
        this.ensureProfileExists(profilePath);

        return {
            headless: headless,
            executablePath: executablePath || this.findChromeExecutable(),
            userDataDir: profilePath,
            args: [
                '--start-maximized',
                '--disable-blink-features=AutomationControlled',
                '--disable-features=VizDisplayCompositor',
                '--disable-extensions',
                '--no-first-run',
                '--disable-default-apps',
                '--disable-popup-blocking',
                '--disable-translate',
                '--disable-background-timer-throttling',
                '--disable-renderer-backgrounding',
                '--disable-backgrounding-occluded-windows',
                '--disable-client-side-phishing-detection',
                '--disable-sync',
                '--allow-running-insecure-content',
                '--disable-features=TranslateUI',
                '--disable-ipc-flooding-protection'
            ]
        };
    }

    /**
     * Tạo cấu hình Chrome launch options chống phát hiện bot
     */
    getStealthLaunchOptions(options = {}) {
        const {
            profilePath = this.defaultProfilePath,
            headless = 'new',
            debugMode = false,
            customUserAgent = null,
            customViewport = null,
            executablePath = null
        } = options;

        // Tạo profile path nếu chưa tồn tại
        this.ensureProfileExists(profilePath);

        // Chọn User Agent ngẫu nhiên
        const userAgent = customUserAgent || this.getRandomUserAgent();
        
        // Chọn viewport ngẫu nhiên
        const viewport = customViewport || this.getRandomViewport();

        // Tìm Chrome executable
        const chromePath = executablePath || this.findChromeExecutable();

        return {
            headless: debugMode ? false : headless,
            executablePath: chromePath,
            args: [
                // Profile và dữ liệu người dùng
                `--user-data-dir=${profilePath}`,
                '--profile-directory=Default',
                
                // Ẩn automation - CẢI THIỆN
                '--disable-blink-features=AutomationControlled',
                '--exclude-switches=enable-automation',
                '--disable-features=VizDisplayCompositor',
                '--disable-ipc-flooding-protection',
                '--disable-renderer-backgrounding',
                '--disable-backgrounding-occluded-windows',
                '--disable-background-timer-throttling',
                '--disable-background-networking',
                '--disable-breakpad',
                '--disable-client-side-phishing-detection',
                '--disable-component-extensions-with-background-pages',
                '--disable-default-apps',
                '--disable-dev-shm-usage',
                '--disable-extensions',
                '--disable-features=TranslateUI',
                '--disable-hang-monitor',
                '--disable-prompt-on-repost',
                '--disable-sync',
                '--disable-web-security',
                '--disable-features=IsolateOrigins,site-per-process',
                '--disable-site-isolation-trials',
                '--disable-features=BlockInsecurePrivateNetworkRequests',
                '--disable-features=SameSiteByDefaultCookies,CookiesWithoutSameSiteMustBeSecure',
                
                // Tối ưu hiệu suất
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
                '--use-fake-ui-for-media-stream',
                '--use-fake-device-for-media-stream',
                '--allow-file-access-from-files',
                
                // Thêm args chống phát hiện
                '--disable-features=TranslateUI,BlinkGenPropertyTrees',
                '--disable-ipc-flooding-protection',
                '--disable-hang-monitor',
                '--disable-prompt-on-repost',
                '--disable-sync',
                '--metrics-recording-only',
                '--safebrowsing-disable-auto-update',
                '--password-store=basic',
                '--use-mock-keychain',
                '--disable-component-extensions-with-background-pages',
                '--disable-default-apps',
                '--disable-extensions',
                '--disable-plugins',
                '--disable-plugins-discovery',
                '--disable-preconnect',
                '--disable-print-preview',
                '--disable-speech-api',
                '--hide-scrollbars',
                '--mute-audio',
                '--no-zygote',
                '--single-process',
                
                // User Agent
                `--user-agent=${userAgent}`,
                
                // Window size
                `--window-size=${viewport.width},${viewport.height}`,
                
                // Thêm các args để tránh phát hiện
                '--disable-plugins-discovery',
                '--disable-preconnect',
                '--disable-print-preview',
                '--disable-speech-api',
                '--hide-scrollbars',
                '--mute-audio',
                '--no-zygote',
                '--single-process',
                '--disable-background-timer-throttling',
                '--disable-renderer-backgrounding',
                '--disable-backgrounding-occluded-windows',
                '--disable-features=TranslateUI,BlinkGenPropertyTrees',
                '--disable-ipc-flooding-protection',
                '--disable-hang-monitor',
                '--disable-prompt-on-repost',
                '--disable-sync',
                '--metrics-recording-only',
                '--no-first-run',
                '--safebrowsing-disable-auto-update',
                '--enable-automation',
                '--password-store=basic',
                '--use-mock-keychain',
                '--disable-component-extensions-with-background-pages',
                '--disable-default-apps',
                '--disable-extensions',
                '--disable-plugins',
                '--disable-plugins-discovery',
                '--disable-preconnect',
                '--disable-print-preview',
                '--disable-speech-api',
                '--hide-scrollbars',
                '--mute-audio',
                '--no-zygote',
                '--single-process'
            ],
            defaultViewport: null,
            ignoreDefaultArgs: ['--enable-automation', '--enable-blink-features=IdleDetection'],
            timeout: 60000,
            slowMo: debugMode ? 100 : 0,
            devtools: debugMode
        };
    }

    /**
     * Tìm Chrome executable trên hệ thống
     */
    findChromeExecutable() {
        const platform = os.platform();
        const possiblePaths = [];

        if (platform === 'win32') {
            possiblePaths.push(
                'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
                'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
                path.join(os.homedir(), 'AppData\\Local\\Google\\Chrome\\Application\\chrome.exe'),
                'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
                'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
            );
        } else if (platform === 'darwin') {
            possiblePaths.push(
                '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
                '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'
            );
        } else if (platform === 'linux') {
            possiblePaths.push(
                '/usr/bin/google-chrome',
                '/usr/bin/google-chrome-stable',
                '/usr/bin/chromium-browser',
                '/usr/bin/chromium',
                '/usr/bin/microsoft-edge',
                '/snap/bin/chromium'
            );
        }

        // Kiểm tra từ environment variables
        const envPaths = [
            process.env.CHROME_PATH,
            process.env.GOOGLE_CHROME_PATH,
            process.env.CHROMIUM_PATH,
            process.env.EDGE_PATH
        ].filter(Boolean);

        possiblePaths.unshift(...envPaths);

        for (const chromePath of possiblePaths) {
            try {
                if (fs.existsSync(chromePath)) {
                    return chromePath;
                }
            } catch (error) {
                // Bỏ qua lỗi và thử path tiếp theo
            }
        }

        throw new Error('Không tìm thấy Chrome executable. Vui lòng cài đặt Chrome hoặc set CHROME_PATH environment variable.');
    }

    /**
     * Tạo profile directory nếu chưa tồn tại
     */
    ensureProfileExists(profilePath) {
        if (!fs.existsSync(profilePath)) {
            fs.mkdirSync(profilePath, { recursive: true });
            console.log(`📁 Tạo Chrome profile tại: ${profilePath}`);
        }
    }

    /**
     * Lấy User Agent ngẫu nhiên
     */
    getRandomUserAgent() {
        return this.userAgents[Math.floor(Math.random() * this.userAgents.length)];
    }

    /**
     * Lấy viewport ngẫu nhiên
     */
    getRandomViewport() {
        return this.viewports[Math.floor(Math.random() * this.viewports.length)];
    }

    /**
     * Tạo cấu hình page options để tránh phát hiện
     */
    getStealthPageOptions() {
        return {
            viewport: this.getRandomViewport(),
            userAgent: this.getRandomUserAgent(),
            locale: 'vi-VN',
            timezoneId: 'Asia/Ho_Chi_Minh'
        };
    }

    /**
     * Áp dụng stealth settings cho page
     */
    async applyStealthSettings(page) {
        // Override navigator properties
        await page.evaluateOnNewDocument(() => {
            // Xóa webdriver property
            Object.defineProperty(navigator, 'webdriver', {
                get: () => undefined,
            });

            // Override plugins
            Object.defineProperty(navigator, 'plugins', {
                get: () => [1, 2, 3, 4, 5],
            });

            // Override languages
            Object.defineProperty(navigator, 'languages', {
                get: () => ['vi-VN', 'vi', 'en-US', 'en'],
            });

            // Override permissions
            const originalQuery = window.navigator.permissions.query;
            window.navigator.permissions.query = (parameters) => (
                parameters.name === 'notifications' ?
                    Promise.resolve({ state: Notification.permission }) :
                    originalQuery(parameters)
            );

            // Override chrome property
            window.chrome = {
                runtime: {},
                loadTimes: function() {},
                csi: function() {},
                app: {}
            };

            // Override getParameter
            const getParameter = WebGLRenderingContext.getParameter;
            WebGLRenderingContext.prototype.getParameter = function(parameter) {
                if (parameter === 37445) {
                    return 'Intel Inc.';
                }
                if (parameter === 37446) {
                    return 'Intel Iris OpenGL Engine';
                }
                return getParameter(parameter);
            };

            // Thêm stealth properties
            Object.defineProperty(navigator, 'permissions', {
                get: () => ({
                    query: () => Promise.resolve({ state: 'granted' })
                })
            });

            // Override automation indicators
            delete window.cdc_adoQpoasnfa76pfcZLmcfl_Array;
            delete window.cdc_adoQpoasnfa76pfcZLmcfl_Promise;
            delete window.cdc_adoQpoasnfa76pfcZLmcfl_Symbol;
        });

        // Set extra headers
        await page.setExtraHTTPHeaders({
            'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7',
            'Accept-Encoding': 'gzip, deflate, br',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
            'Upgrade-Insecure-Requests': '1',
            'Cache-Control': 'max-age=0'
        });

        // Set viewport
        const viewport = this.getRandomViewport();
        await page.setViewport(viewport);

        console.log(`🎭 Áp dụng stealth settings - Viewport: ${viewport.width}x${viewport.height}`);
    }

    /**
     * Tạo profile mới với tên tùy chỉnh
     */
    createNewProfile(profileName) {
        const profilePath = path.join(this.defaultProfilePath, profileName);
        this.ensureProfileExists(profilePath);
        return profilePath;
    }

    /**
     * Xóa profile
     */
    deleteProfile(profileName) {
        const profilePath = path.join(this.defaultProfilePath, profileName);
        if (fs.existsSync(profilePath)) {
            fs.rmSync(profilePath, { recursive: true, force: true });
            console.log(`🗑️ Đã xóa profile: ${profileName}`);
            return true;
        }
        return false;
    }

    /**
     * Liệt kê tất cả profiles
     */
    listProfiles() {
        if (!fs.existsSync(this.defaultProfilePath)) {
            return [];
        }
        
        return fs.readdirSync(this.defaultProfilePath, { withFileTypes: true })
            .filter(dirent => dirent.isDirectory())
            .map(dirent => dirent.name);
    }
}

module.exports = ChromeProfileManager;
