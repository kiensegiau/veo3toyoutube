const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');
const ChromeProfileManager = require('./chrome-profile-manager');

/**
 * 🍪 Auto Cookie Extractor - Tự động lấy cookies từ Chrome profile
 */
class AutoCookieExtractor {
    constructor() {
        this.profileManager = new ChromeProfileManager();
    }

    /**
     * Lấy cookies từ Chrome profile bằng Puppeteer
     */
    async extractCookiesFromProfile(profileName = 'Default') {
        try {
            console.log(`🍪 Extracting cookies from profile: ${profileName}`);
            
            const profilePath = path.join(this.profileManager.defaultProfilePath, profileName);
            
            if (!fs.existsSync(profilePath)) {
                throw new Error(`Profile ${profileName} not found at ${profilePath}`);
            }

            // Cấu hình launch options
            const launchOptions = this.profileManager.getStealthLaunchOptions({
                profilePath: profilePath,
                headless: 'new',
                debugMode: false
            });

            console.log(`🚀 Launching Chrome with profile: ${profilePath}`);
            const browser = await puppeteer.launch(launchOptions);
            const page = await browser.newPage();
            
            // Áp dụng stealth settings
            await this.profileManager.applyStealthSettings(page);
            
            console.log(`🌐 Navigating to Google Labs...`);
            await page.goto('https://labs.google', { 
                waitUntil: 'networkidle2',
                timeout: 30000 
            });
            
            // Chờ để đảm bảo cookies được load
            await page.waitForTimeout(5000);
            
            // Kiểm tra xem đã đăng nhập chưa
            const isLoggedIn = await page.evaluate(() => {
                return document.querySelector('a[aria-label="Sign in"]') === null &&
                       document.querySelector('a[href*="accounts.google.com/ServiceLogin"]') === null;
            });
            
            if (!isLoggedIn) {
                console.log('⚠️ Not logged in to Google Labs, cookies may be incomplete');
            } else {
                console.log('✅ Successfully logged in to Google Labs');
            }
            
            // Lấy tất cả cookies
            const allCookies = await page.cookies();
            console.log(`📊 Total cookies found: ${allCookies.length}`);
            
            // Lọc cookies liên quan đến Google Labs
            const relevantCookies = allCookies.filter(cookie => 
                cookie.domain.includes('labs.google') || 
                cookie.domain.includes('.google.com') ||
                cookie.domain.includes('googleapis.com') ||
                cookie.domain.includes('googleusercontent.com')
            );
            
            console.log(`🎯 Relevant cookies found: ${relevantCookies.length}`);
            
            // Log cookies để debug
            relevantCookies.forEach(cookie => {
                console.log(`  - ${cookie.name}=${cookie.value.substring(0, 20)}... (${cookie.domain})`);
            });
            
            // Chuyển đổi thành string format
            const cookieString = relevantCookies
                .map(cookie => `${cookie.name}=${cookie.value}`)
                .join(';');
            
            await browser.close();
            
            console.log(`✅ Successfully extracted ${relevantCookies.length} cookies`);
            console.log(`🍪 Cookie string length: ${cookieString.length} characters`);
            
            return {
                success: true,
                cookies: cookieString,
                cookieCount: relevantCookies.length,
                isLoggedIn: isLoggedIn,
                profileName: profileName
            };
            
        } catch (error) {
            console.error(`❌ Error extracting cookies from profile ${profileName}:`, error.message);
            return {
                success: false,
                error: error.message,
                profileName: profileName
            };
        }
    }

    /**
     * Thử lấy cookies từ tất cả profiles có sẵn
     */
    async extractCookiesFromAllProfiles() {
        try {
            const profiles = this.profileManager.listProfiles();
            console.log(`🔍 Found ${profiles.length} profiles: ${profiles.join(', ')}`);
            
            const results = [];
            
            for (const profileName of profiles) {
                console.log(`\n🔄 Trying profile: ${profileName}`);
                const result = await this.extractCookiesFromProfile(profileName);
                results.push(result);
                
                if (result.success && result.cookies) {
                    console.log(`✅ Successfully extracted cookies from ${profileName}`);
                    return result; // Trả về kết quả đầu tiên thành công
                }
            }
            
            console.log('❌ No cookies extracted from any profile');
            return {
                success: false,
                message: 'No cookies found in any profile',
                results: results
            };
            
        } catch (error) {
            console.error('❌ Error extracting cookies from all profiles:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Lưu cookies vào file
     */
    saveCookiesToFile(cookieString, filename = 'extracted-cookies.txt') {
        try {
            const filePath = path.join(__dirname, filename);
            fs.writeFileSync(filePath, cookieString);
            console.log(`💾 Cookies saved to: ${filePath}`);
            return filePath;
        } catch (error) {
            console.error('❌ Error saving cookies to file:', error);
            return null;
        }
    }

    /**
     * Cập nhật cookies.json file
     */
    updateCookiesJsonFile(cookieString) {
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
            console.log('🍪 Updated cookies.json file with new cookies');
            
            return true;
        } catch (error) {
            console.error('❌ Error updating cookies.json:', error);
            return false;
        }
    }

    /**
     * Test cookies bằng cách gọi Google Labs API
     */
    async testCookies(cookieString) {
        try {
            console.log('🧪 Testing cookies with Google Labs API...');
            
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
                console.log('✅ Cookies are valid and working');
                return {
                    success: true,
                    status: response.status,
                    sessionData: sessionData
                };
            } else {
                console.log('❌ Cookies are invalid or expired');
                return {
                    success: false,
                    status: response.status,
                    message: 'Cookies are invalid or expired'
                };
            }
            
        } catch (error) {
            console.error('❌ Error testing cookies:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
}

// Export cho sử dụng
module.exports = AutoCookieExtractor;

// CLI usage
if (require.main === module) {
    const extractor = new AutoCookieExtractor();
    
    async function main() {
        const args = process.argv.slice(2);
        const profileName = args[0] || 'Default';
        
        console.log('🍪 Auto Cookie Extractor');
        console.log('========================');
        
        if (profileName === 'all') {
            // Thử tất cả profiles
            const result = await extractor.extractCookiesFromAllProfiles();
            if (result.success) {
                extractor.saveCookiesToFile(result.cookies);
                extractor.updateCookiesJsonFile(result.cookies);
                
                // Test cookies
                await extractor.testCookies(result.cookies);
            }
        } else {
            // Thử profile cụ thể
            const result = await extractor.extractCookiesFromProfile(profileName);
            if (result.success) {
                extractor.saveCookiesToFile(result.cookies);
                extractor.updateCookiesJsonFile(result.cookies);
                
                // Test cookies
                await extractor.testCookies(result.cookies);
            }
        }
    }
    
    main().catch(console.error);
}
