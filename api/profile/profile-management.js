const ChromeProfileUtils = require('../../chrome-profile-utils');
const ChromeProfileManager = require('../../chrome-profile-manager');

// Tạo Chrome profile mới
async function createProfile(req, res) {
    try {
        const { profileName } = req.body;
        
        if (!profileName) {
            return res.status(400).json({
                success: false,
                message: 'Profile name is required'
            });
        }

        const profilePath = ChromeProfileUtils.createProfile(profileName);
        
        if (profilePath) {
            res.json({
                success: true,
                message: `Profile ${profileName} created successfully`,
                profilePath: profilePath
            });
        } else {
            res.status(500).json({
                success: false,
                message: 'Failed to create profile'
            });
        }
    } catch (error) {
        console.error('❌ Create profile error:', error);
        res.status(500).json({
            success: false,
            message: 'Profile creation failed',
            error: error.message
        });
    }
}

// Liệt kê tất cả profiles
async function listProfiles(req, res) {
    try {
        const profiles = await ChromeProfileUtils.listProfiles();
        
        res.json({
            success: true,
            profiles: profiles
        });
    } catch (error) {
        console.error('❌ List profiles error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to list profiles',
            error: error.message
        });
    }
}

// Kiểm tra profile
async function checkProfile(req, res) {
    try {
        const { profileName } = req.params;
        const result = await ChromeProfileUtils.checkProfile(profileName);
        
        if (result.exists) {
            res.json({
                success: true,
                exists: true,
                profileName: result.profileName,
                profilePath: result.profilePath,
                profileSize: result.profileSize,
                importantFiles: result.importantFiles,
                message: result.message
            });
        } else {
            res.json({
                success: true,
                exists: false,
                message: `Profile ${profileName} not found`
            });
        }
    } catch (error) {
        console.error('❌ Check profile error:', error);
        res.status(500).json({
            success: false,
            message: 'Profile check failed',
            error: error.message
        });
    }
}

// Kiểm tra đăng nhập YouTube
async function checkYouTubeLogin(req, res) {
    try {
        const { profileName = 'Default' } = req.body;
        const result = await ChromeProfileUtils.checkYouTubeLogin(profileName);
        
        res.json({
            success: true,
            isLoggedIn: result.isLoggedIn,
            message: result.message,
            profileName: profileName
        });
    } catch (error) {
        console.error('❌ Check YouTube login error:', error);
        res.status(500).json({
            success: false,
            message: 'YouTube login check failed',
            error: error.message
        });
    }
}

// Kiểm tra đăng nhập Google Labs
async function checkLabsLogin(req, res) {
    try {
        const { profileName = 'Default' } = req.body;
        const result = await ChromeProfileUtils.checkLabsLogin(profileName);
        
        res.json({
            success: true,
            isLoggedIn: result.isLoggedIn,
            message: result.message,
            profileName: profileName
        });
    } catch (error) {
        console.error('❌ Check Labs login error:', error);
        res.status(500).json({
            success: false,
            message: 'Labs login check failed',
            error: error.message
        });
    }
}

// Mở profile để đăng nhập
async function openProfileForLogin(req, res) {
    try {
        const { profileName = 'Default', url } = req.body;
        
        if (!url) {
            return res.status(400).json({
                success: false,
                message: 'URL is required'
            });
        }

        const result = await ChromeProfileUtils.openProfileForLogin(profileName, url);
        
        if (result.success) {
            res.json({
                success: true,
                message: `Profile ${profileName} opened for login at ${url}`,
                profileName: profileName,
                url: url
            });
        } else {
            res.status(500).json({
                success: false,
                message: result.error || 'Failed to open profile'
            });
        }
    } catch (error) {
        console.error('❌ Open profile for login error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to open profile for login',
            error: error.message
        });
    }
}

// Xóa profile
async function deleteProfile(req, res) {
    try {
        const { profileName } = req.body;
        
        if (!profileName) {
            return res.status(400).json({
                success: false,
                message: 'Profile name is required'
            });
        }

        const result = await ChromeProfileUtils.deleteProfile(profileName);
        
        if (result.success) {
            res.json({
                success: true,
                message: `Profile ${profileName} deleted successfully`
            });
        } else {
            res.status(500).json({
                success: false,
                message: result.error || 'Failed to delete profile'
            });
        }
    } catch (error) {
        console.error('❌ Delete profile error:', error);
        res.status(500).json({
            success: false,
            message: 'Profile deletion failed',
            error: error.message
        });
    }
}

// Tự động lấy cookies từ profile
async function extractCookies(req, res) {
    try {
        const { profileName = 'Default' } = req.body;
        const result = await ChromeProfileUtils.extractCookiesFromProfile(profileName);
        
        if (result.success) {
            res.json({
                success: true,
                message: `Extracted ${result.cookieCount} cookies from ${profileName}`,
                cookies: result.cookies,
                cookieCount: result.cookieCount,
                isLoggedIn: result.isLoggedIn,
                profileName: result.profileName
            });
        } else {
            res.status(500).json({
                success: false,
                message: result.error || 'Failed to extract cookies'
            });
        }
    } catch (error) {
        console.error('❌ Extract cookies error:', error);
        res.status(500).json({
            success: false,
            message: 'Cookie extraction failed',
            error: error.message
        });
    }
}

// Lấy cookies từ tất cả profiles
async function extractCookiesAll(req, res) {
    try {
        const result = await ChromeProfileUtils.extractCookiesFromAllProfiles();
        
        if (result.success) {
            res.json({
                success: true,
                message: `Extracted cookies from ${result.profiles.length} profiles`,
                profiles: result.profiles,
                totalCookies: result.totalCookies
            });
        } else {
            res.status(500).json({
                success: false,
                message: result.error || 'Failed to extract cookies from any profile'
            });
        }
    } catch (error) {
        console.error('❌ Extract cookies all error:', error);
        res.status(500).json({
            success: false,
            message: 'Cookie extraction from all profiles failed',
            error: error.message
        });
    }
}

// Mở Chrome sạch cho YouTube login
async function openCleanChromeForYouTube(req, res) {
    try {
        const { profileName = 'YouTubeClean' } = req.body;
        
        const puppeteer = require('puppeteer-core');
        const path = require('path');
        const ChromeProfileManager = require('../../chrome-profile-manager');
        
        const chromeManager = new ChromeProfileManager();
        const chromePath = await chromeManager.findChromeExecutable();
        
        if (!chromePath) {
            return res.status(500).json({
                success: false,
                message: 'Chrome executable not found'
            });
        }
        
        // Tạo profile path
        const profilePath = path.join(chromeManager.defaultProfilePath, profileName);
        chromeManager.ensureProfileExists(profilePath);
        
        // Khởi động Chrome sạch
        const browser = await puppeteer.launch({
            executablePath: chromePath,
            userDataDir: profilePath,
            headless: false,
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
        });
        
        const page = await browser.newPage();
        
        // Ẩn automation detection
        await page.evaluateOnNewDocument(() => {
            Object.defineProperty(navigator, 'webdriver', {
                get: () => undefined,
            });
            delete window.navigator.__proto__.webdriver;
            Object.defineProperty(navigator, 'plugins', {
                get: () => [1, 2, 3, 4, 5],
            });
            Object.defineProperty(navigator, 'languages', {
                get: () => ['en-US', 'en'],
            });
        });
        
        await page.setViewport({ width: 1920, height: 1080 });
        await page.goto('https://studio.youtube.com', { waitUntil: 'networkidle2' });
        
        res.json({
            success: true,
            message: `Clean Chrome opened for YouTube login with profile ${profileName}`,
            profilePath: profilePath,
            note: 'Please login manually in the opened browser window'
        });
        
    } catch (error) {
        console.error('❌ Open clean Chrome error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to open clean Chrome',
            error: error.message
        });
    }
}

// Mở Chrome với profile đã login sẵn
async function openChromeWithLoggedInProfile(req, res) {
    try {
        const { profileName = 'YouTubeClean', url = 'https://studio.youtube.com' } = req.body;
        
        const puppeteer = require('puppeteer-core');
        const path = require('path');
        const ChromeProfileManager = require('../../chrome-profile-manager');
        
        const chromeManager = new ChromeProfileManager();
        const chromePath = await chromeManager.findChromeExecutable();
        
        if (!chromePath) {
            return res.status(500).json({
                success: false,
                message: 'Chrome executable not found'
            });
        }
        
        // Tạo profile path
        const profilePath = path.join(chromeManager.defaultProfilePath, profileName);
        
        // Khởi động Chrome với profile đã login
        const browser = await puppeteer.launch({
            executablePath: chromePath,
            userDataDir: profilePath,
            headless: false,
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
        });
        
        const page = await browser.newPage();
        
        // Ẩn automation detection
        await page.evaluateOnNewDocument(() => {
            Object.defineProperty(navigator, 'webdriver', {
                get: () => undefined,
            });
            delete window.navigator.__proto__.webdriver;
            Object.defineProperty(navigator, 'plugins', {
                get: () => [1, 2, 3, 4, 5],
            });
            Object.defineProperty(navigator, 'languages', {
                get: () => ['en-US', 'en'],
            });
        });
        
        await page.setViewport({ width: 1920, height: 1080 });
        await page.goto(url, { waitUntil: 'networkidle2' });
        
        res.json({
            success: true,
            message: `Chrome opened with logged-in profile ${profileName}`,
            profilePath: profilePath,
            url: url,
            note: 'Profile should already be logged in'
        });
        
    } catch (error) {
        console.error('❌ Open Chrome with profile error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to open Chrome with profile',
            error: error.message
        });
    }
}

module.exports = {
    createProfile,
    listProfiles,
    checkProfile,
    checkYouTubeLogin,
    checkLabsLogin,
    openProfileForLogin,
    deleteProfile,
    extractCookies,
    extractCookiesAll,
    openCleanChromeForYouTube,
    openChromeWithLoggedInProfile
};
