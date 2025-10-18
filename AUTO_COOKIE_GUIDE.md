# 🍪 Hướng dẫn tự động lấy Cookie từ Chrome

## 🎯 Tổng quan

Hệ thống đã được cập nhật với tính năng **TỰ ĐỘNG LẤY COOKIE** từ Chrome profile, giúp bạn không cần phải copy cookie thủ công nữa!

## 🚀 Cách sử dụng

### **Bước 1: Tạo Chrome Profile**

```bash
# Tạo profile mới cho Google Labs
POST /api/create-profile
{
    "profileName": "GoogleLabs"
}
```

### **Bước 2: Đăng nhập thủ công (chỉ cần 1 lần)**

```bash
# Mở Chrome với profile để đăng nhập
POST /api/open-profile-login
{
    "profileName": "GoogleLabs",
    "url": "https://labs.google"
}
```

### **Bước 3: Tự động lấy cookies**

```bash
# Lấy cookies từ profile cụ thể
POST /api/extract-cookies
{
    "profileName": "GoogleLabs"
}

# Hoặc lấy từ tất cả profiles
POST /api/extract-cookies-all
{}
```

### **Bước 4: Lấy token từ cookies**

```bash
# Hệ thống sẽ tự động lấy token từ cookies
POST /api/get-new-token
{
    "cookies": "cookie_string_here"
}
```

## 🛠️ API Endpoints mới

### **1. Lấy cookies từ profile cụ thể**
```http
POST /api/extract-cookies
Content-Type: application/json

{
    "profileName": "GoogleLabs"
}
```

**Response:**
```json
{
    "success": true,
    "message": "Cookies extracted successfully",
    "cookies": "cookie_string_here",
    "cookieCount": 15,
    "isLoggedIn": true,
    "profileName": "GoogleLabs"
}
```

### **2. Lấy cookies từ tất cả profiles**
```http
POST /api/extract-cookies-all
Content-Type: application/json

{}
```

**Response:**
```json
{
    "success": true,
    "message": "Cookies extracted successfully",
    "cookies": "cookie_string_here",
    "cookieCount": 15,
    "isLoggedIn": true,
    "profileName": "GoogleLabs"
}
```

## 🧪 Test Script

Chạy script test để kiểm tra tính năng:

```bash
# Test với profile đầu tiên
node test-cookie-extraction.js

# Xem help
node test-cookie-extraction.js --help
```

## 🔧 Sử dụng trực tiếp

### **1. Auto Cookie Extractor Class**

```javascript
const AutoCookieExtractor = require('./auto-cookie-extractor');

const extractor = new AutoCookieExtractor();

// Lấy cookies từ profile cụ thể
const result = await extractor.extractCookiesFromProfile('GoogleLabs');

if (result.success) {
    console.log(`Extracted ${result.cookieCount} cookies`);
    console.log(`Cookies: ${result.cookies}`);
}

// Lấy cookies từ tất cả profiles
const allResult = await extractor.extractCookiesFromAllProfiles();

// Test cookies
const testResult = await extractor.testCookies(result.cookies);
```

### **2. Chrome Profile Utils**

```javascript
const ChromeProfileUtils = require('./chrome-profile-utils');

const profileUtils = new ChromeProfileUtils();

// Lấy cookies từ profile
const result = await profileUtils.extractCookiesFromProfile('GoogleLabs');

// Lấy cookies từ tất cả profiles
const allResult = await profileUtils.extractCookiesFromAllProfiles();
```

## 📋 Workflow hoàn chỉnh

### **Tự động hóa hoàn toàn:**

1. **Tạo profile** → `POST /api/create-profile`
2. **Đăng nhập 1 lần** → `POST /api/open-profile-login`
3. **Tự động lấy cookies** → `POST /api/extract-cookies`
4. **Tự động lấy token** → `POST /api/get-new-token`
5. **Tự động làm mới** → Hệ thống tự động refresh

### **Script tự động:**

```bash
# Tạo profile
curl -X POST http://localhost:8888/api/create-profile \
  -H "Content-Type: application/json" \
  -d '{"profileName": "GoogleLabs"}'

# Mở để đăng nhập (thủ công)
curl -X POST http://localhost:8888/api/open-profile-login \
  -H "Content-Type: application/json" \
  -d '{"profileName": "GoogleLabs", "url": "https://labs.google"}'

# Lấy cookies tự động
curl -X POST http://localhost:8888/api/extract-cookies \
  -H "Content-Type: application/json" \
  -d '{"profileName": "GoogleLabs"}'

# Lấy token từ cookies
curl -X POST http://localhost:8888/api/get-new-token \
  -H "Content-Type: application/json" \
  -d '{"cookies": "cookie_string_from_previous_step"}'
```

## 🔄 Tự động hóa nâng cao

### **Tự động lấy cookies khi cần:**

```javascript
// Thêm vào server.js
async function ensureCookiesAvailable() {
    if (currentCookies) {
        return true; // Đã có cookies
    }
    
    console.log('🍪 No cookies available, attempting to extract...');
    
    const result = await profileUtils.extractCookiesFromAllProfiles();
    
    if (result.success) {
        currentCookies = result.cookies;
        saveStorageData();
        updateCookiesJsonFile(result.cookies);
        console.log('✅ Cookies extracted and saved automatically');
        return true;
    }
    
    return false;
}
```

## ⚠️ Lưu ý quan trọng

1. **Chrome phải được cài đặt** và có thể truy cập từ command line
2. **Profile phải đã đăng nhập** Google Labs trước đó
3. **Chrome phải được đóng** khi không sử dụng để tránh conflict
4. **Cookies sẽ tự động hết hạn** sau 24 giờ, cần làm mới định kỳ

## 🎉 Ưu điểm

- ✅ **Hoàn toàn tự động** - Không cần copy cookie thủ công
- ✅ **Hỗ trợ nhiều profiles** - Có thể lấy từ bất kỳ profile nào
- ✅ **Tự động test** - Kiểm tra cookies có hoạt động không
- ✅ **Tự động lưu** - Cookies được lưu vào file tự động
- ✅ **Error handling** - Xử lý lỗi và fallback
- ✅ **Logging chi tiết** - Theo dõi quá trình lấy cookies

## 🚨 Troubleshooting

### **Lỗi "Profile not found":**
- Kiểm tra profile đã được tạo chưa
- Chạy `GET /api/list-profiles` để xem danh sách

### **Lỗi "No cookies found":**
- Đảm bảo đã đăng nhập Google Labs trong profile
- Thử profile khác với `POST /api/extract-cookies-all`

### **Lỗi "Chrome not found":**
- Kiểm tra Chrome đã cài đặt chưa
- Cập nhật đường dẫn Chrome trong `chrome-profile-manager.js`

### **Lỗi "Cookies invalid":**
- Cookies có thể đã hết hạn
- Thử lấy cookies mới từ profile

## 📞 Hỗ trợ

Nếu gặp vấn đề, hãy:
1. Chạy `node test-cookie-extraction.js` để test
2. Kiểm tra logs trong console
3. Đảm bảo Chrome profile đã đăng nhập Google Labs
4. Thử với profile khác nếu cần

---

**🎊 Chúc mừng! Bây giờ bạn có thể tự động lấy cookies mà không cần can thiệp thủ công!**
