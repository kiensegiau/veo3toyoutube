# 🍪 Hướng dẫn tự động lấy Cookie từ Chrome Profile

## 📋 Tổng quan

Hệ thống hiện tại của bạn **CHƯA** có tính năng tự động lấy cookie từ Chrome profile. Hiện tại chỉ có thể:
1. Lấy cookie thủ công từ DevTools
2. Nhập cookie qua API endpoint

## 🔧 Cách thêm tính năng tự động lấy cookie

### **Phương pháp 1: Sử dụng Puppeteer (Khuyến nghị)**

```javascript
// Thêm vào chrome-profile-utils.js
const puppeteer = require('puppeteer-core');

/**
 * Tự động lấy cookies từ Chrome profile
 */
async function extractCookiesFromProfile(profileName = 'Default') {
    try {
        const profilePath = path.join(this.profileManager.defaultProfilePath, profileName);
        
        const launchOptions = this.profileManager.getStealthLaunchOptions({
            profilePath: profilePath,
            headless: 'new'
        });

        const browser = await puppeteer.launch(launchOptions);
        const page = await browser.newPage();
        
        // Điều hướng đến Google Labs
        await page.goto('https://labs.google', { waitUntil: 'networkidle2' });
        
        // Lấy cookies từ page
        const cookies = await page.cookies();
        
        // Chuyển đổi cookies thành string format
        const cookieString = cookies
            .filter(cookie => cookie.domain.includes('labs.google') || cookie.domain.includes('.google.com'))
            .map(cookie => `${cookie.name}=${cookie.value}`)
            .join(';');
        
        await browser.close();
        
        console.log(`🍪 Extracted ${cookies.length} cookies from profile ${profileName}`);
        return cookieString;
        
    } catch (error) {
        console.error(`❌ Error extracting cookies: ${error.message}`);
        return null;
    }
}
```

### **Phương pháp 2: Đọc trực tiếp từ Chrome Database**

```javascript
const sqlite3 = require('sqlite3');
const path = require('path');

/**
 * Đọc cookies trực tiếp từ Chrome SQLite database
 */
async function extractCookiesFromDatabase(profileName = 'Default') {
    return new Promise((resolve, reject) => {
        const profilePath = path.join(__dirname, 'chrome-profile', profileName);
        const cookiesPath = path.join(profilePath, 'Default', 'Cookies');
        
        if (!fs.existsSync(cookiesPath)) {
            reject(new Error('Cookies database not found'));
            return;
        }
        
        const db = new sqlite3.Database(cookiesPath, sqlite3.OPEN_READONLY);
        
        const query = `
            SELECT name, value, host_key, path, expires_utc, is_secure, is_httponly
            FROM cookies 
            WHERE host_key LIKE '%labs.google%' OR host_key LIKE '%.google.com%'
        `;
        
        db.all(query, [], (err, rows) => {
            if (err) {
                reject(err);
                return;
            }
            
            const cookieString = rows
                .map(row => `${row.name}=${row.value}`)
                .join(';');
            
            db.close();
            resolve(cookieString);
        });
    });
}
```

### **Phương pháp 3: Sử dụng Chrome DevTools Protocol**

```javascript
/**
 * Lấy cookies qua Chrome DevTools Protocol
 */
async function extractCookiesViaDevTools(profileName = 'Default') {
    try {
        const profilePath = path.join(this.profileManager.defaultProfilePath, profileName);
        
        const launchOptions = {
            ...this.profileManager.getStealthLaunchOptions({
                profilePath: profilePath,
                headless: 'new'
            }),
            devtools: true
        };

        const browser = await puppeteer.launch(launchOptions);
        const page = await browser.newPage();
        
        // Kết nối với DevTools
        const client = await page.target().createCDPSession();
        
        // Lấy cookies
        const { cookies } = await client.send('Network.getCookies', {
            urls: ['https://labs.google']
        });
        
        const cookieString = cookies
            .map(cookie => `${cookie.name}=${cookie.value}`)
            .join(';');
        
        await browser.close();
        
        return cookieString;
        
    } catch (error) {
        console.error(`❌ Error extracting cookies via DevTools: ${error.message}`);
        return null;
    }
}
```

## 🚀 Cách tích hợp vào hệ thống hiện tại

### **1. Thêm API endpoint mới**

```javascript
// Thêm vào server.js
app.post('/api/extract-cookies', async (req, res) => {
    try {
        const { profileName = 'Default' } = req.body || {};
        
        // Sử dụng Puppeteer method (khuyến nghị)
        const cookieString = await profileUtils.extractCookiesFromProfile(profileName);
        
        if (cookieString) {
            // Cập nhật currentCookies
            currentCookies = cookieString;
            saveStorageData();
            
            // Cập nhật cookies.json
            updateCookiesJsonFile(cookieString);
            
            res.json({
                success: true,
                message: 'Cookies extracted successfully',
                cookies: cookieString,
                profileName: profileName
            });
        } else {
            res.status(400).json({
                success: false,
                message: 'Failed to extract cookies'
            });
        }
        
    } catch (error) {
        console.error('❌ Extract cookies error:', error);
        res.status(500).json({
            success: false,
            message: 'Error extracting cookies',
            error: error.message
        });
    }
});
```

### **2. Thêm vào ChromeProfileUtils class**

```javascript
// Thêm vào chrome-profile-utils.js
class ChromeProfileUtils {
    // ... existing methods ...
    
    /**
     * Tự động lấy cookies từ Chrome profile
     */
    async extractCookiesFromProfile(profileName = 'Default') {
        const puppeteer = require('puppeteer-core');
        
        try {
            const profilePath = path.join(this.profileManager.defaultProfilePath, profileName);
            
            if (!fs.existsSync(profilePath)) {
                throw new Error(`Profile ${profileName} not found`);
            }
            
            const launchOptions = this.profileManager.getStealthLaunchOptions({
                profilePath: profilePath,
                headless: 'new'
            });

            const browser = await puppeteer.launch(launchOptions);
            const page = await browser.newPage();
            
            await this.profileManager.applyStealthSettings(page);
            
            // Điều hướng đến Google Labs
            await page.goto('https://labs.google', { 
                waitUntil: 'networkidle2',
                timeout: 30000 
            });
            
            // Chờ một chút để đảm bảo cookies được load
            await page.waitForTimeout(3000);
            
            // Lấy cookies từ page
            const cookies = await page.cookies();
            
            // Lọc cookies liên quan đến Google Labs
            const relevantCookies = cookies.filter(cookie => 
                cookie.domain.includes('labs.google') || 
                cookie.domain.includes('.google.com') ||
                cookie.domain.includes('googleapis.com')
            );
            
            // Chuyển đổi thành string format
            const cookieString = relevantCookies
                .map(cookie => `${cookie.name}=${cookie.value}`)
                .join(';');
            
            await browser.close();
            
            console.log(`🍪 Extracted ${relevantCookies.length} cookies from profile ${profileName}`);
            console.log(`🍪 Cookie string: ${cookieString.substring(0, 100)}...`);
            
            return cookieString;
            
        } catch (error) {
            console.error(`❌ Error extracting cookies from profile ${profileName}:`, error.message);
            return null;
        }
    }
    
    /**
     * Kiểm tra và tự động lấy cookies nếu cần
     */
    async ensureCookiesAvailable(profileName = 'Default') {
        try {
            // Thử lấy cookies từ profile
            const cookieString = await this.extractCookiesFromProfile(profileName);
            
            if (cookieString) {
                return {
                    success: true,
                    cookies: cookieString,
                    source: 'profile'
                };
            } else {
                return {
                    success: false,
                    message: 'No cookies found in profile'
                };
            }
            
        } catch (error) {
            return {
                success: false,
                message: error.message
            };
        }
    }
}
```

### **3. Tự động hóa việc lấy cookies**

```javascript
// Thêm vào server.js - tự động lấy cookies khi cần
async function ensureCookiesAvailable() {
    if (currentCookies) {
        return true; // Đã có cookies
    }
    
    console.log('🍪 No cookies available, attempting to extract from profiles...');
    
    try {
        // Thử lấy từ profile Default trước
        const result = await profileUtils.ensureCookiesAvailable('Default');
        
        if (result.success) {
            currentCookies = result.cookies;
            saveStorageData();
            updateCookiesJsonFile(result.cookies);
            console.log('✅ Cookies extracted and saved');
            return true;
        }
        
        // Thử các profile khác
        const profiles = profileUtils.listAllProfiles();
        for (const profileName of profiles) {
            if (profileName === 'Default') continue;
            
            const result = await profileUtils.ensureCookiesAvailable(profileName);
            if (result.success) {
                currentCookies = result.cookies;
                saveStorageData();
                updateCookiesJsonFile(result.cookies);
                console.log(`✅ Cookies extracted from profile ${profileName}`);
                return true;
            }
        }
        
        console.log('❌ No cookies found in any profile');
        return false;
        
    } catch (error) {
        console.error('❌ Error ensuring cookies:', error);
        return false;
    }
}
```

## 📝 Cách sử dụng

### **1. Lấy cookies thủ công:**
```bash
POST /api/extract-cookies
{
    "profileName": "GoogleLabs"
}
```

### **2. Tự động lấy cookies:**
```javascript
// Hệ thống sẽ tự động lấy cookies khi:
// - Khởi động server
// - Token hết hạn
// - Gọi API cần cookies
```

## ⚠️ Lưu ý quan trọng

1. **Chrome phải được đóng** khi đọc cookies từ database
2. **Profile phải đã đăng nhập** Google Labs trước đó
3. **Cần cài đặt sqlite3** nếu dùng phương pháp đọc database:
   ```bash
   npm install sqlite3
   ```
4. **Puppeteer method** là an toàn nhất và khuyến nghị sử dụng

## 🔄 Workflow hoàn chỉnh

1. **Tạo profile** → `POST /api/create-profile`
2. **Đăng nhập thủ công** → `POST /api/open-profile-login`
3. **Tự động lấy cookies** → `POST /api/extract-cookies`
4. **Lấy token từ cookies** → `POST /api/get-new-token`
5. **Tự động làm mới** → Hệ thống tự động refresh token

Hệ thống này sẽ hoàn toàn tự động hóa việc lấy và quản lý cookies!
