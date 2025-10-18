const ChromeProfileManager = require('./chrome-profile-manager');
const fs = require('fs');
const path = require('path');

/**
 * Utility functions để quản lý Chrome profiles
 */
class ChromeProfileUtils {
    constructor() {
        this.profileManager = new ChromeProfileManager();
    }

    /**
     * Tạo profile mới cho YouTube upload
     */
    createYouTubeProfile(profileName = 'YouTube') {
        const profilePath = this.profileManager.createNewProfile(profileName);
        console.log(`✅ Tạo profile YouTube: ${profileName} tại ${profilePath}`);
        return profilePath;
    }

    /**
     * Tạo profile mới cho Google Labs
     */
    createLabsProfile(profileName = 'GoogleLabs') {
        const profilePath = this.profileManager.createNewProfile(profileName);
        console.log(`✅ Tạo profile Google Labs: ${profileName} tại ${profilePath}`);
        return profilePath;
    }

    /**
     * Liệt kê tất cả profiles
     */
    listAllProfiles() {
        const profiles = this.profileManager.listProfiles();
        console.log('📋 Danh sách Chrome profiles:');
        profiles.forEach(profile => {
            console.log(`  - ${profile}`);
        });
        return profiles;
    }

    /**
     * Xóa profile
     */
    deleteProfile(profileName) {
        const success = this.profileManager.deleteProfile(profileName);
        if (success) {
            console.log(`✅ Đã xóa profile: ${profileName}`);
        } else {
            console.log(`❌ Không tìm thấy profile: ${profileName}`);
        }
        return success;
    }

    /**
     * Backup profile
     */
    backupProfile(profileName, backupPath = null) {
        const sourcePath = path.join(this.profileManager.defaultProfilePath, profileName);
        
        if (!fs.existsSync(sourcePath)) {
            console.log(`❌ Profile không tồn tại: ${profileName}`);
            return false;
        }

        const backupDir = backupPath || path.join(__dirname, 'backups');
        if (!fs.existsSync(backupDir)) {
            fs.mkdirSync(backupDir, { recursive: true });
        }

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupName = `${profileName}_${timestamp}`;
        const targetPath = path.join(backupDir, backupName);

        try {
            // Copy toàn bộ profile
            this.copyDirectory(sourcePath, targetPath);
            console.log(`✅ Backup profile ${profileName} thành công tại: ${targetPath}`);
            return targetPath;
        } catch (error) {
            console.error(`❌ Lỗi backup profile: ${error.message}`);
            return false;
        }
    }

    /**
     * Restore profile từ backup
     */
    restoreProfile(backupPath, profileName) {
        if (!fs.existsSync(backupPath)) {
            console.log(`❌ Backup không tồn tại: ${backupPath}`);
            return false;
        }

        const targetPath = path.join(this.profileManager.defaultProfilePath, profileName);
        
        try {
            // Xóa profile cũ nếu có
            if (fs.existsSync(targetPath)) {
                fs.rmSync(targetPath, { recursive: true, force: true });
            }

            // Restore từ backup
            this.copyDirectory(backupPath, targetPath);
            console.log(`✅ Restore profile ${profileName} thành công từ: ${backupPath}`);
            return true;
        } catch (error) {
            console.error(`❌ Lỗi restore profile: ${error.message}`);
            return false;
        }
    }

    /**
     * Copy directory recursively
     */
    copyDirectory(source, target) {
        if (!fs.existsSync(target)) {
            fs.mkdirSync(target, { recursive: true });
        }

        const items = fs.readdirSync(source);
        
        for (const item of items) {
            const sourcePath = path.join(source, item);
            const targetPath = path.join(target, item);
            
            if (fs.statSync(sourcePath).isDirectory()) {
                this.copyDirectory(sourcePath, targetPath);
            } else {
                fs.copyFileSync(sourcePath, targetPath);
            }
        }
    }

    /**
     * Kiểm tra profile có đăng nhập YouTube chưa
     */
    async checkYouTubeLogin(profileName = 'Default') {
        const puppeteer = require('puppeteer-core');
        
        try {
            const launchOptions = this.profileManager.getStealthLaunchOptions({
                profilePath: path.join(this.profileManager.defaultProfilePath, profileName),
                headless: 'new'
            });

            const browser = await puppeteer.launch(launchOptions);
            const page = await browser.newPage();
            
            await this.profileManager.applyStealthSettings(page);
            
            await page.goto('https://www.youtube.com', { waitUntil: 'networkidle2' });
            
            // Kiểm tra đăng nhập
            const isLoggedIn = await page.evaluate(() => {
                return document.querySelector('#avatar-btn') !== null || 
                       document.querySelector('yt-img-shadow#avatar') !== null;
            });

            await browser.close();
            
            console.log(`🔍 Profile ${profileName} - YouTube login: ${isLoggedIn ? '✅ Đã đăng nhập' : '❌ Chưa đăng nhập'}`);
            return isLoggedIn;
            
        } catch (error) {
            console.error(`❌ Lỗi kiểm tra login: ${error.message}`);
            return false;
        }
    }

    /**
     * Kiểm tra profile có đăng nhập Google Labs chưa
     */
    async checkLabsLogin(profileName = 'Default') {
        const puppeteer = require('puppeteer-core');
        
        try {
            const launchOptions = this.profileManager.getStealthLaunchOptions({
                profilePath: path.join(this.profileManager.defaultProfilePath, profileName),
                headless: 'new'
            });

            const browser = await puppeteer.launch(launchOptions);
            const page = await browser.newPage();
            
            await this.profileManager.applyStealthSettings(page);
            
            await page.goto('https://labs.google', { waitUntil: 'networkidle2' });
            
            // Kiểm tra đăng nhập
            const isLoggedIn = await page.evaluate(() => {
                return document.querySelector('a[aria-label="Sign in"]') === null &&
                       document.querySelector('a[href*="accounts.google.com/ServiceLogin"]') === null;
            });

            await browser.close();
            
            console.log(`🔍 Profile ${profileName} - Google Labs login: ${isLoggedIn ? '✅ Đã đăng nhập' : '❌ Chưa đăng nhập'}`);
            return isLoggedIn;
            
        } catch (error) {
            console.error(`❌ Lỗi kiểm tra login: ${error.message}`);
            return false;
        }
    }

    /**
     * Mở profile để đăng nhập thủ công
     */
    async openProfileForLogin(profileName = 'Default', url = 'https://www.youtube.com') {
        const puppeteer = require('puppeteer-core');
        
        try {
            // Tạo profile path
            const profilePath = path.join(this.profileManager.defaultProfilePath, profileName);
            
            // Đảm bảo profile directory tồn tại
            if (!fs.existsSync(profilePath)) {
                fs.mkdirSync(profilePath, { recursive: true });
                console.log(`📁 Tạo profile directory: ${profilePath}`);
            }

            // Cấu hình launch options đơn giản hơn
            const launchOptions = {
                headless: false,
                executablePath: this.profileManager.findChromeExecutable(),
                args: [
                    `--user-data-dir=${profilePath}`,
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

            console.log(`🚀 Khởi động Chrome với profile: ${profileName}`);
            console.log(`📁 Profile path: ${profilePath}`);
            
            const browser = await puppeteer.launch(launchOptions);
            const page = await browser.newPage();
            
            // Áp dụng stealth settings
            await this.profileManager.applyStealthSettings(page);
            
            console.log(`🌐 Điều hướng đến: ${url}`);
            await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
            
            console.log(`✅ Đã mở profile ${profileName} tại ${url}`);
            console.log('📝 Đăng nhập thủ công, sau đó đóng browser để tiếp tục...');
            console.log(`💾 Profile sẽ được lưu tại: ${profilePath}`);
            console.log('🔐 Sau khi đăng nhập, thông tin sẽ được lưu tự động');
            
            // Chờ user đóng browser với timeout
            return new Promise((resolve) => {
                let resolved = false;
                
                const timeout = setTimeout(() => {
                    if (!resolved) {
                        resolved = true;
                        console.log('⏰ Timeout - Browser vẫn đang mở');
                        resolve(true);
                    }
                }, 300000); // 5 phút timeout
                
                browser.on('disconnected', () => {
                    if (!resolved) {
                        resolved = true;
                        clearTimeout(timeout);
                        console.log('✅ Browser đã đóng');
                        console.log(`💾 Profile ${profileName} đã được lưu`);
                        console.log('🔐 Thông tin đăng nhập đã được lưu tự động');
                        resolve(true);
                    }
                });
                
                browser.on('error', (error) => {
                    if (!resolved) {
                        resolved = true;
                        clearTimeout(timeout);
                        console.error('❌ Browser error:', error);
                        resolve(false);
                    }
                });
            });
            
        } catch (error) {
            console.error(`❌ Lỗi mở profile: ${error.message}`);
            console.error('🔧 Thử các giải pháp sau:');
            console.error('1. Kiểm tra Chrome đã cài đặt chưa');
            console.error('2. Thử chạy với quyền Administrator');
            console.error('3. Kiểm tra port không bị conflict');
            return false;
        }
    }
}

module.exports = ChromeProfileUtils;
