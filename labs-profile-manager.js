const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');
const ChromeProfileManager = require('./chrome-profile-manager');
try { require('dotenv').config(); } catch (_) {}

/**
 * 🧪 Labs Profile Manager - Quản lý profile Chrome riêng cho Google Labs
 */
class LabsProfileManager {
    constructor() {
        this.profileManager = new ChromeProfileManager();
        this.labsProfileName = 'GoogleLabs';
        this.labsProfilePath = path.join(this.profileManager.defaultProfilePath, this.labsProfileName);
        this.browser = null;
        this.page = null;
        this.autoExtractInterval = null;
        this.autoExtractEnabled = false;
        this.lastExtractTime = null;
        this.cachedCookies = null;
        this.cachedCookieCount = 0;
        this.cookieCacheTtlMs = 45 * 60 * 1000; // 45 minutes
        this.lastCookiesSource = null; // 'file' | 'browser'
    }

    /**
     * Kiểm tra cache cookies còn hiệu lực
     */
    isCookieCacheValid() {
        if (!this.cachedCookies || !this.lastExtractTime) return false;
        const last = new Date(this.lastExtractTime).getTime();
        return (Date.now() - last) < this.cookieCacheTtlMs;
    }

    /**
     * Lấy cookies từ cache nếu còn hiệu lực
     */
    getCachedCookies() {
        if (!this.isCookieCacheValid()) return null;
        return {
            success: true,
            cookies: this.cachedCookies,
            cookieCount: this.cachedCookieCount,
            isLoggedIn: true,
            profileName: this.labsProfileName,
            fromCache: true
        };
    }

    /**
     * Đọc cookies từ file labs-cookies.txt (nếu có)
     */
    readCookiesFromFile() {
        try {
            const filePath = path.join(__dirname, 'labs-cookies.txt');
            if (!fs.existsSync(filePath)) {
                return null;
            }

            const content = fs.readFileSync(filePath, 'utf8');
            const lines = content.split(/\r?\n/);
            for (let i = 0; i < lines.length; i++) {
                let line = lines[i].trim();
                if (line && !line.startsWith('#')) {
                    // Bỏ cặp nháy bao ngoài nếu có
                    if ((line.startsWith('"') && line.endsWith('"')) || (line.startsWith("'") && line.endsWith("'"))) {
                        line = line.substring(1, line.length - 1);
                    }
                    return line;
                }
            }
            return null;
        } catch (_) {
            return null;
        }
    }

    /**
     * Tạo profile Labs riêng biệt
     */
    createLabsProfile() {
        try {
            if (!fs.existsSync(this.labsProfilePath)) {
                fs.mkdirSync(this.labsProfilePath, { recursive: true });
            }
            return this.labsProfilePath;
        } catch (error) {
            console.error('❌ Lỗi tạo Labs profile:', error.message);
            return null;
        }
    }

    /**
     * Mở Chrome riêng cho Google Labs
     */
    async openLabsBrowser() {
        try {
            // Tạo profile nếu chưa có
            this.createLabsProfile();

            const launchOptions = {
                headless: false,
                executablePath: this.profileManager.findChromeExecutable(),
                args: [
                    `--user-data-dir=${this.labsProfilePath}`,
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
                    '--window-size=1920,1080',
                    '--start-maximized'
                ],
                defaultViewport: null,
                ignoreDefaultArgs: ['--enable-automation'],
                timeout: 30000,
                slowMo: 100,
                devtools: false
            };

            this.browser = await puppeteer.launch(launchOptions);
            this.page = await this.browser.newPage();
            
            // Áp dụng stealth settings
            await this.profileManager.applyStealthSettings(this.page);
            
            await this.page.goto('https://labs.google/fx/tools/flow', { 
                waitUntil: 'networkidle2', 
                timeout: 30000 
            });
            
            // Tự động bật auto-extract mặc định 30 phút
            this.enableAutoExtract(30);
            
            return true;
            
        } catch (error) {
            console.error('❌ Lỗi mở Chrome Labs:', error.message);
            return false;
        }
    }

    /**
     * Lấy cookies chỉ từ tab Google Labs
     */
    async extractLabsCookies(force = false) {
        try {
            const shouldValidate = process.env.LABS_VALIDATE_COOKIES === 'true';
            const disableBrowser = process.env.LABS_DISABLE_BROWSER === 'true';
            const cacheValid = this.isCookieCacheValid();
            // Dùng cache nếu còn hiệu lực và không bắt buộc làm mới
            if (!force) {
                const cached = this.getCachedCookies();
                if (cached) {
                    return cached;
                }
            }

            // Ưu tiên dùng file txt trước khi mở Chrome (có thể validate tuỳ chọn)
            const fileCookies = this.readCookiesFromFile();
            if (fileCookies && !force) {
                if (shouldValidate) {
                    try {
                        const test = await this.testLabsCookies(fileCookies);
                        if (test && test.success) {
                            this.cachedCookies = fileCookies;
                            this.cachedCookieCount = fileCookies.split(';').length;
                            this.lastExtractTime = new Date().toISOString();
                            this.lastCookiesSource = 'file';
                            return {
                                success: true,
                                cookies: fileCookies,
                                cookieCount: this.cachedCookieCount,
                                isLoggedIn: true,
                                profileName: this.labsProfileName,
                                fromCache: true,
                                fromFile: true
                            };
                        }
                    } catch (_) {
                    }
                } else {
                    // Không validate: dùng trực tiếp cookies từ file để tránh mở Chrome không cần thiết
                    this.cachedCookies = fileCookies;
                    this.cachedCookieCount = fileCookies.split(';').length;
                    this.lastExtractTime = new Date().toISOString();
                    this.lastCookiesSource = 'file';
                    return {
                        success: true,
                        cookies: fileCookies,
                        cookieCount: this.cachedCookieCount,
                        isLoggedIn: true,
                        profileName: this.labsProfileName,
                        fromCache: true,
                        fromFile: true
                    };
                }
            }

            // Nếu browser chưa mở, mở mới
            if (disableBrowser) {
                return {
                    success: false,
                    error: 'LABS_DISABLE_BROWSER is true, skip opening Chrome',
                    profileName: this.labsProfileName
                };
            }
            if (!this.isLabsBrowserOpen()) {
                console.log(`🚀 Chrome Labs chưa mở, đang mở...`);
                const opened = await this.openLabsBrowser();
                if (!opened) {
                    throw new Error('Không thể mở Chrome Labs');
                }
            }

            
            
            // Đảm bảo đang ở trang Google Labs Flow
            const currentUrl = await this.page.url();
            if (!currentUrl.includes('labs.google/fx/tools/flow')) {
                
                await this.page.goto('https://labs.google/fx/tools/flow', { 
                    waitUntil: 'networkidle2',
                    timeout: 30000 
                });
            }

            // Chờ để đảm bảo trang load hoàn toàn
            await this.page.waitForTimeout(5000);
            
            // Chờ thêm để đảm bảo cookies được load
            try {
                await this.page.waitForSelector('body', { timeout: 10000 });
                
                // Chờ thêm để đảm bảo JavaScript đã chạy
                await this.page.waitForTimeout(3000);
                
                // Kiểm tra trang đã sẵn sàng
                const isReady = await this.page.evaluate(() => {
                    return document.readyState === 'complete';
                });
                
                if (!isReady) {
                    await this.page.waitForTimeout(5000);
                }
                
            } catch (error) {
                
            }
            
            // Kiểm tra đăng nhập cho trang Flow
            const isLoggedIn = await this.page.evaluate(() => {
                // Kiểm tra các dấu hiệu đã đăng nhập
                const hasSignInButton = document.querySelector('a[aria-label="Sign in"]') !== null;
                const hasLoginLink = document.querySelector('a[href*="accounts.google.com/ServiceLogin"]') !== null;
                const hasFlowContent = document.querySelector('[data-testid="flow-interface"]') !== null || 
                                     document.querySelector('.flow-interface') !== null ||
                                     document.querySelector('main') !== null;
                
                // Kiểm tra có session token trong cookies không
                const hasSessionToken = document.cookie.includes('__Secure-next-auth.session-token');
                
                return !hasSignInButton && !hasLoginLink && (hasFlowContent || hasSessionToken);
            });
            
            // Lấy tất cả cookies
            const allCookies = await this.page.cookies();
            
            
            // Lọc cookies liên quan đến Google Labs
            const labsCookies = allCookies.filter(cookie => 
                cookie.domain.includes('labs.google') || 
                cookie.domain.includes('.google.com') ||
                cookie.domain.includes('googleapis.com') ||
                cookie.domain.includes('googleusercontent.com')
            );
            
            
            
            // Log cookies để debug
            // Ẩn log chi tiết từng cookie để giảm noise
            
            // Chuyển đổi thành string format
            const cookieString = labsCookies
                .map(cookie => `${cookie.name}=${cookie.value}`)
                .join(';');
            
            
            
            // Cập nhật cache
            this.cachedCookies = cookieString;
            this.cachedCookieCount = labsCookies.length;
            this.lastExtractTime = new Date().toISOString();
            this.lastCookiesSource = 'browser';
            
            return {
                success: true,
                cookies: cookieString,
                cookieCount: labsCookies.length,
                isLoggedIn: isLoggedIn,
                profileName: this.labsProfileName,
                fromCache: false
            };
            
        } catch (error) {
            console.error(`❌ Error extracting Labs cookies:`, error.message);
            return {
                success: false,
                error: error.message,
                profileName: this.labsProfileName
            };
        }
    }

    /**
     * Test cookies với Google Labs API
     */
    async testLabsCookies(cookieString) {
        try {
            console.log('🧪 Testing Labs cookies with Google Labs API...');
            
            const response = await fetch('https://labs.google/fx/api/auth/session', {
                method: 'GET',
                headers: {
                    'accept': '*/*',
                    'accept-language': 'vi,en-US;q=0.9,en;q=0.8,fr-FR;q=0.7,fr;q=0.6',
                    'content-type': 'application/json',
                    'cookie': cookieString
                },
                referrer: 'https://labs.google/fx/tools/flow/project/42bd5064-e313-4f9e-9a0c-40865bf79b88',
                credentials: 'include'
            });

            console.log(`📊 Test response status: ${response.status}`);
            
            if (response.ok) {
                const sessionData = await response.json();
                console.log('✅ Labs cookies are valid and working');
                return {
                    success: true,
                    status: response.status,
                    sessionData: sessionData
                };
            } else {
                console.log('❌ Labs cookies are invalid or expired');
                return {
                    success: false,
                    status: response.status,
                    message: 'Labs cookies are invalid or expired'
                };
            }
            
        } catch (error) {
            console.error('❌ Error testing Labs cookies:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Lưu cookies vào file duy nhất
     */
    saveLabsCookies(cookieString) {
        try {
            // Bỏ qua nếu cookie hiện tại đến từ file để tránh cập nhật timestamp gây nhầm lẫn
            if (this.lastCookiesSource === 'file') {
                return null;
            }
            // Chỉ lưu vào 1 file duy nhất
            const fileName = 'labs-cookies.txt';
            const filePath = path.join(__dirname, fileName);
            
            // Thêm timestamp vào đầu file
            const timestamp = new Date().toISOString();
            const content = `# Labs Cookies - Updated: ${timestamp}\n${cookieString}`;
            
            fs.writeFileSync(filePath, content);
            console.log(`💾 Labs cookies saved to: ${filePath}`);
            return filePath;
        } catch (error) {
            console.error('❌ Error saving Labs cookies:', error);
            return null;
        }
    }

    /**
     * Cập nhật cookies.json với Labs cookies
     */
    updateCookiesJsonWithLabs(cookieString) {
        try {
            // Đọc file cookies.json hiện tại
            let cookiesData = [];
            if (fs.existsSync('cookies.json')) {
                const fileContent = fs.readFileSync('cookies.json', 'utf8');
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
            fs.writeFileSync('cookies.json', JSON.stringify(updatedCookies, null, 2));
            console.log('🍪 Updated cookies.json with Labs cookies');
            
            return true;
        } catch (error) {
            console.error('❌ Error updating cookies.json with Labs cookies:', error);
            return false;
        }
    }

    /**
     * Đóng Chrome Labs
     */
    async closeLabsBrowser() {
        try {
            if (this.browser) {
                await this.browser.close();
                this.browser = null;
                this.page = null;
                console.log('✅ Chrome Labs đã đóng');
            }
        } catch (error) {
            console.error('❌ Lỗi đóng Chrome Labs:', error.message);
        }
    }

    /**
     * Kiểm tra Chrome Labs có đang mở không
     */
    isLabsBrowserOpen() {
        return this.browser !== null && this.page !== null && this.browser.isConnected();
    }

    /**
     * Kiểm tra xem Labs profile có tồn tại không
     */
    profileExists() {
        return fs.existsSync(this.labsProfilePath);
    }

    /**
     * Lấy thông tin profile Labs
     */
    getLabsProfileInfo() {
        return {
            profileName: this.labsProfileName,
            profilePath: this.labsProfilePath,
            isOpen: this.isLabsBrowserOpen(),
            exists: fs.existsSync(this.labsProfilePath),
            autoExtractEnabled: this.autoExtractEnabled,
            lastExtractTime: this.lastExtractTime
        };
    }

    /**
     * Bật tự động lấy cookies theo thời gian
     */
    enableAutoExtract(intervalMinutes = 30) {
        if (this.autoExtractInterval) {
            clearInterval(this.autoExtractInterval);
        }

        this.autoExtractEnabled = true;
        const intervalMs = intervalMinutes * 60 * 1000;

        console.log(`🔄 Bật tự động lấy cookies mỗi ${intervalMinutes} phút`);

        this.autoExtractInterval = setInterval(async () => {
            try {
                if (this.isLabsBrowserOpen()) {
                    // Bỏ qua nếu cache còn hiệu lực
                    if (this.isCookieCacheValid()) {
                        return;
                    }
                    console.log(`⏰ Tự động lấy cookies...`);
                    const result = await this.extractLabsCookies(false);
                    if (result.success) {
                        this.lastExtractTime = new Date().toISOString();
                        console.log(`✅ Tự động lấy cookies thành công - ${result.cookieCount} cookies`);
                    } else {
                        console.log(`❌ Tự động lấy cookies thất bại: ${result.error}`);
                    }
                } else {
                    console.log(`⚠️ Chrome Labs chưa mở, bỏ qua tự động lấy cookies`);
                }
            } catch (error) {
                console.error(`❌ Lỗi tự động lấy cookies:`, error.message);
            }
        }, intervalMs);

        return {
            success: true,
            message: `Tự động lấy cookies mỗi ${intervalMinutes} phút`,
            intervalMinutes: intervalMinutes
        };
    }

    /**
     * Tắt tự động lấy cookies
     */
    disableAutoExtract() {
        if (this.autoExtractInterval) {
            clearInterval(this.autoExtractInterval);
            this.autoExtractInterval = null;
        }

        this.autoExtractEnabled = false;
        console.log(`🛑 Tắt tự động lấy cookies`);

        return {
            success: true,
            message: 'Đã tắt tự động lấy cookies'
        };
    }

    /**
     * Lấy cookies tự động ngay lập tức
     */
    async autoExtractNow() {
        try {
            if (!this.isLabsBrowserOpen()) {
                return {
                    success: false,
                    message: 'Chrome Labs chưa mở'
                };
            }

            // Nếu cache còn hiệu lực thì trả về luôn
            const cached = this.getCachedCookies();
            if (cached) {
                return cached;
            }

            console.log(`🔄 Tự động lấy cookies ngay lập tức...`);
            const result = await this.extractLabsCookies(false);
            
            if (result.success) {
                this.lastExtractTime = new Date().toISOString();
                console.log(`✅ Tự động lấy cookies thành công - ${result.cookieCount} cookies`);
            }

            return result;
        } catch (error) {
            console.error(`❌ Lỗi tự động lấy cookies:`, error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }
}

module.exports = new LabsProfileManager();
