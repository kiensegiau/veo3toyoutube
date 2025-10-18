# 🍪 Hệ thống tự động làm mới token - Tối ưu

## 🎯 Mục tiêu
Tạo hệ thống tự động làm mới token và cập nhật file `cookies.json` để tránh file "chết" (hết hạn).

## 🚀 Cách sử dụng

### **Bước 1: Lấy cookies 1 lần từ trình duyệt**
1. Vào Google Labs: https://labs.google/fx/tools/flow
2. Mở Developer Tools (F12)
3. Vào tab Application → Cookies
4. Copy tất cả cookies từ `labs.google`
5. Paste vào file `cookies.json`

### **Bước 2: Chạy hệ thống tự động**
```bash
node manager.js
```
Chọn tùy chọn 1 để chạy hệ thống tự động

### **Bước 3: Hệ thống tự động hoạt động**
- ✅ Kiểm tra token mỗi 30 phút
- ✅ Tự động làm mới khi token sắp hết hạn (dưới 15 phút)
- ✅ Cập nhật file `cookies.json` với cookies mới
- ✅ Tránh file cookies.json bị "chết"

## 📁 Files tối ưu

```
web/
├── cookies.json              # File cookies từ Google Labs (chỉ cần lấy 1 lần)
├── server-storage.json       # File lưu trữ cookies và token
├── server.js                 # Server chính
├── auto-refresh.js           # Hệ thống tự động làm mới token
├── manager.js                # Quản lý hệ thống chính
├── watch-cookies.js          # Theo dõi file tự động
├── package.json              # Dependencies
└── public/
    └── index.html            # Frontend
```

## 🔄 Workflow hoàn chỉnh

### **1. Khởi tạo (chỉ làm 1 lần)**
```bash
# Lấy cookies từ trình duyệt → Save vào cookies.json
# Chạy hệ thống quản lý
node manager.js
# Chọn tùy chọn 1
```

### **2. Hệ thống tự động hoạt động**
- **Kiểm tra định kỳ**: Mỗi 30 phút
- **Tự động làm mới**: Khi token còn dưới 15 phút
- **Cập nhật file**: `cookies.json` được cập nhật với cookies mới
- **Tránh hết hạn**: File không bao giờ "chết"

### **3. Kết quả**
- ✅ **File cookies.json luôn "sống"**: Được cập nhật tự động
- ✅ **Token không bao giờ hết hạn**: Tự động làm mới
- ✅ **Không cần can thiệp**: Hệ thống hoạt động hoàn toàn tự động
- ✅ **Chỉ cần lấy cookies 1 lần**: Từ trình duyệt

## 🎯 Tính năng chính

### ✅ **Tự động hoàn toàn**
- Kiểm tra token mỗi 30 phút
- Làm mới token khi sắp hết hạn
- Cập nhật file `cookies.json` tự động
- Không cần can thiệp thủ công

### ✅ **Tránh file chết**
- File `cookies.json` luôn được cập nhật
- Cookies mới được thêm vào file
- Expiration date được cập nhật
- File không bao giờ hết hạn

### ✅ **Quản lý dễ dàng**
- Menu tương tác
- Kiểm tra trạng thái
- Khởi động/dừng server
- Quản lý processes

## 🔧 Cấu hình

### **Thời gian kiểm tra**
- **Interval**: 30 phút
- **Buffer**: 15 phút trước khi hết hạn
- **Expiry**: 24 giờ cho cookies mới

### **Files được cập nhật**
- `server-storage.json`: Cookies và token hiện tại
- `cookies.json`: File gốc với cookies mới

## 🚨 Lưu ý quan trọng

1. **Chỉ cần lấy cookies 1 lần**: Từ trình duyệt Google Labs
2. **Hệ thống tự động**: Không cần can thiệp thủ công
3. **File không bao giờ chết**: Được cập nhật liên tục
4. **Token luôn hoạt động**: Tự động làm mới

## 🎉 Kết quả

- **✅ File cookies.json luôn "sống"**
- **✅ Token không bao giờ hết hạn**
- **✅ Hệ thống hoạt động 24/7**
- **✅ Chỉ cần setup 1 lần**
- **✅ Hoàn toàn tự động**
- **✅ Tối ưu và gọn nhẹ**

**Hệ thống đã hoàn hảo và tối ưu! File cookies.json sẽ không bao giờ "chết"!** 🚀

---

### Ghi chú tối ưu hoá máy chủ

- Bật nén HTTP (middleware `compression`).
- Thiết lập cache dài hạn cho static assets; HTML là no-cache.
- Video trong `public/videos` hỗ trợ HTTP Range để tua/stream mượt.
- Hỗ trợ biến môi trường `PORT` để cấu hình cổng.

---

### Upload YouTube (Puppeteer)

API: POST `/api/upload-youtube`

Body JSON:

```json
{
  "videoPath": "public/videos/your-file.mp4",
  "title": "Tiêu đề video",
  "description": "Mô tả",
  "visibility": "UNLISTED", // PUBLIC | PRIVATE | UNLISTED
  "debug": false,
  "profileName": "YouTube", // Tên profile Chrome
  "customUserAgent": null, // User Agent tùy chỉnh
  "customViewport": { "width": 1920, "height": 1080 } // Viewport tùy chỉnh
}
```

### Quản lý Chrome Profile

Module `chrome-profile-manager.js` cung cấp:

- **Stealth configuration**: Chống phát hiện bot với User Agent ngẫu nhiên, viewport thực tế
- **Profile management**: Tạo, xóa, backup/restore profiles
- **Auto Chrome detection**: Tự động tìm Chrome/Edge trên hệ thống
- **Login checking**: Kiểm tra trạng thái đăng nhập YouTube/Google Labs

#### Sử dụng Chrome Profile Utils:

```javascript
const ChromeProfileUtils = require('./chrome-profile-utils');
const utils = new ChromeProfileUtils();

// Tạo profile mới
utils.createYouTubeProfile('MyYouTube');

// Kiểm tra đăng nhập
await utils.checkYouTubeLogin('MyYouTube');

// Mở profile để đăng nhập thủ công
await utils.openProfileForLogin('MyYouTube', 'https://www.youtube.com');

// Backup/Restore profile
utils.backupProfile('MyYouTube');
utils.restoreProfile('./backups/MyYouTube_2024-01-01', 'MyYouTube');
```

#### Cấu hình Environment:

```bash
# Tùy chọn: Đường dẫn Chrome
CHROME_PATH="C:\Program Files\Google\Chrome\Application\chrome.exe"

# Tùy chọn: User Agent tùy chỉnh
USER_AGENT="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"

# Tùy chọn: Profile path
CHROME_PROFILE_PATH="C:\Users\PC\Documents\web\chrome-profile"
```

Ghi chú quy trình:
- Theo đúng flow và selectors trong phần mô tả quy trình upload
- Sử dụng stealth configuration để tránh phát hiện bot
- Module: `youtube-upload.js`, `chrome-profile-manager.js`, `chrome-profile-utils.js`
